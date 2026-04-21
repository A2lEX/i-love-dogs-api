# API_INTEGRATION.md — DogCare Frontend

> Как фронт потребляет Backend API. Типы, клиент, ошибки, паттерны.

**Парная документация:** `dogcare-backend/docs/API_SPEC.md` — источник правды для API.

---

## Содержание

1. [Источник правды](#1-источник-правды)
2. [Генерация типов](#2-генерация-типов)
3. [API клиент](#3-api-клиент)
4. [Auth flow подробно](#4-auth-flow-подробно)
5. [Обработка ошибок](#5-обработка-ошибок)
6. [Паттерны использования](#6-паттерны-использования)
7. [Кэширование и invalidation](#7-кэширование-и-invalidation)
8. [Работа с формами и мутациями](#8-работа-с-формами-и-мутациями)
9. [Работа с платежами](#9-работа-с-платежами)
10. [Environment и контракт](#10-environment-и-контракт)

---

## 1. Источник правды

Backend генерирует OpenAPI 3.1 спеку на эндпоинте `/api-json`. Это **единственный источник правды** для контракта API.

Фронт не держит ручных интерфейсов для API моделей. Всё — из сгенерированного `src/types/api.ts`.

### Процесс изменения API

```
1. Backend: изменить DTO или endpoint
2. Backend: обновить docs/API_SPEC.md
3. Backend: deploy в staging (или вручную запустить локально)
4. Frontend: npm run gen:api
5. Frontend: TypeScript показывает ошибки там где контракт изменился
6. Frontend: починить, протестировать, commit
```

**Важно:** изменение API = изменение фронта. Не деплоим бекенд без обновления фронта при breaking changes.

---

## 2. Генерация типов

### 2.1. Инструмент

`openapi-typescript` — конвертирует OpenAPI JSON в TypeScript типы.

### 2.2. Скрипты

`package.json`:
```json
{
  "scripts": {
    "gen:api": "openapi-typescript https://api.dogcare.ru/api-json -o src/types/api.ts",
    "gen:api:local": "openapi-typescript http://localhost:3000/api-json -o src/types/api.ts",
    "gen:api:staging": "openapi-typescript https://staging-api.dogcare.ru/api-json -o src/types/api.ts"
  }
}
```

### 2.3. Результат

```typescript
// src/types/api.ts (AUTO-GENERATED)
export interface paths {
  '/dogs': {
    get: {
      parameters: {
        query?: {
          city?: string;
          breed?: string;
          page?: number;
          limit?: number;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              data: components['schemas']['Dog'][];
              pagination: components['schemas']['Pagination'];
            };
          };
        };
      };
    };
  };
  '/dogs/{id}': { /* ... */ };
  // ...
}

export interface components {
  schemas: {
    Dog: { id: string; name: string; /* ... */ };
    Goal: { /* ... */ };
  };
}
```

### 2.4. Удобные type helpers

`src/types/api-helpers.ts`:

```typescript
import type { paths, components } from './api';

// Type helper для response body
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
  Status extends number = 200
> = paths[Path][Method] extends { responses: { [S in Status]: { content: { 'application/json': infer R } } } }
  ? R
  : never;

// Type helper для request body
export type ApiRequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path]
> = paths[Path][Method] extends { requestBody: { content: { 'application/json': infer B } } }
  ? B
  : never;

// Удобные алиасы для частых сущностей
export type Dog = components['schemas']['Dog'];
export type Goal = components['schemas']['Goal'];
export type User = components['schemas']['User'];
export type Patronage = components['schemas']['Patronage'];
export type Walk = components['schemas']['Walk'];
```

### 2.5. Использование

```typescript
import type { Dog, ApiResponse } from '@/types/api-helpers';

// Ответ GET /dogs
const response: ApiResponse<'/dogs', 'get'> = await apiClient.GET('/dogs');

// Используем именованный алиас
const dog: Dog = response.data[0];
```

---

## 3. API клиент

### 3.1. Библиотека

`openapi-fetch` — лёгкий типизированный fetch wrapper, работает с типами из openapi-typescript.

### 3.2. Создание клиента

`src/lib/api-client.ts`:

```typescript
import createClient from 'openapi-fetch';
import type { paths } from '@/types/api';

export const apiClient = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  fetch: customFetch,  // см. ниже
});
```

### 3.3. Custom fetch для auth и retry

```typescript
async function customFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',  // отправлять cookies
    headers: {
      ...init?.headers,
      'X-Request-Id': crypto.randomUUID(),
    },
  });

  // Автоматический refresh при 401
  if (response.status === 401) {
    const body = await response.clone().json();
    if (body.error?.code === 'token_expired') {
      await refreshToken();
      return fetch(input, init);  // retry
    }
  }

  return response;
}
```

### 3.4. Server-side клиент

Для Server Components нужен отдельный клиент, который читает cookies из `next/headers`:

```typescript
// src/lib/api-client-server.ts
import { cookies } from 'next/headers';
import createClient from 'openapi-fetch';
import type { paths } from '@/types/api';

export function getServerApiClient() {
  const accessToken = cookies().get('access_token')?.value;

  return createClient<paths>({
    baseUrl: process.env.API_INTERNAL_URL,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}
```

Использование:

```typescript
// Server Component
export default async function ProfilePage() {
  const api = getServerApiClient();
  const { data } = await api.GET('/auth/me');
  return <ProfileView user={data.user} />;
}
```

---

## 4. Auth flow подробно

### 4.1. Регистрация

```typescript
// src/app/actions/auth.ts
'use server';

import { registerSchema } from '@/schemas/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const response = await fetch(`${process.env.API_INTERNAL_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error.error };
  }

  const { access_token, refresh_token } = await response.json();

  const cookieStore = cookies();
  cookieStore.set('access_token', access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 15 * 60,  // 15 min
    path: '/',
  });
  cookieStore.set('refresh_token', refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,  // 30 days
    path: '/api/auth',  // только для /api/auth/*
  });

  redirect('/profile');
}
```

### 4.2. Refresh через Route Handler

```typescript
// src/app/api/auth/refresh/route.ts
import { cookies } from 'next/headers';

export async function POST() {
  const refreshToken = cookies().get('refresh_token')?.value;
  if (!refreshToken) return Response.json({ error: 'No refresh token' }, { status: 401 });

  const response = await fetch(`${process.env.API_INTERNAL_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    cookies().delete('access_token');
    cookies().delete('refresh_token');
    return Response.json({ error: 'Refresh failed' }, { status: 401 });
  }

  const { access_token, refresh_token: new_refresh } = await response.json();

  cookies().set('access_token', access_token, { /* ... */ });
  cookies().set('refresh_token', new_refresh, { /* ... */ });

  return Response.json({ ok: true });
}
```

### 4.3. useAuth hook (Client Components)

```typescript
// src/hooks/useAuth.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/auth/me');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
```

---

## 5. Обработка ошибок

### 5.1. Типизация ошибок

```typescript
// src/types/errors.ts
export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; code: string; message: string }>;
  request_id: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}
```

### 5.2. Сопоставление error code → UX

```typescript
// src/lib/error-messages.ts
export const errorMessages: Record<string, string> = {
  validation_failed: 'Проверьте правильность заполнения формы',
  unauthorized: 'Необходимо войти',
  token_expired: 'Сессия истекла, войдите снова',
  forbidden: 'Нет доступа',
  not_found: 'Не найдено',
  email_already_exists: 'Пользователь с таким email уже зарегистрирован',
  invalid_credentials: 'Неверный email или пароль',
  curator_not_verified: 'Ваш профиль куратора ещё не проверен',
  exclusive_patronage_taken: 'У этой собаки уже есть эксклюзивный патрон',
  goal_already_completed: 'Эта цель уже закрыта, спасибо за участие',
  walk_slot_conflict: 'Это время уже занято',
  walk_too_early: 'Можно бронировать минимум за сутки',
  payment_provider_error: 'Ошибка платёжного сервиса, попробуйте позже',
  rate_limit_exceeded: 'Слишком много запросов, подождите немного',
  internal_error: 'Что-то пошло не так, мы уже чиним',
  service_unavailable: 'Сервис временно недоступен',
};

export function getErrorMessage(error: ApiError): string {
  return errorMessages[error.code] ?? error.message ?? 'Неизвестная ошибка';
}
```

### 5.3. Обработка в формах

```typescript
const { mutate, error } = useMutation({
  mutationFn: async (data: CreateDogInput) => {
    const { data: result, error } = await apiClient.POST('/curator/dogs', { body: data });
    if (error) throw error;
    return result;
  },
  onSuccess: () => {
    toast.success('Собака добавлена');
    queryClient.invalidateQueries({ queryKey: ['dogs'] });
  },
  onError: (err: ApiError) => {
    toast.error(getErrorMessage(err));
    // Если validation_failed — показать ошибки полей
    if (err.code === 'validation_failed' && err.details) {
      err.details.forEach(d => form.setError(d.field as any, { message: d.message }));
    }
  },
});
```

### 5.4. Global error boundary

```typescript
// src/app/error.tsx
'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // Sentry.captureException(error);
  }, [error]);

  return (
    <div>
      <h2>Что-то пошло не так</h2>
      <button onClick={reset}>Попробовать снова</button>
    </div>
  );
}
```

---

## 6. Паттерны использования

### 6.1. Список с фильтрами (Server Component)

```typescript
// src/app/(public)/dogs/page.tsx
export default async function DogsPage({
  searchParams,
}: {
  searchParams: { city?: string; page?: string };
}) {
  const api = getServerApiClient();
  const { data } = await api.GET('/dogs', {
    params: {
      query: {
        city: searchParams.city,
        page: Number(searchParams.page ?? 1),
        limit: 20,
      },
    },
  });

  return (
    <>
      <DogsFilters />
      <DogsGrid dogs={data!.data} />
      <Pagination {...data!.pagination} />
    </>
  );
}
```

### 6.2. Список с интерактивными фильтрами (Client Component)

```typescript
'use client';

export function DogsList() {
  const [filters, setFilters] = useState<DogFilters>({});

  const { data, isLoading } = useQuery({
    queryKey: ['dogs', filters],
    queryFn: () => apiClient.GET('/dogs', { params: { query: filters } }),
  });

  if (isLoading) return <DogsGridSkeleton />;
  return <DogsGrid dogs={data.data} />;
}
```

### 6.3. Детали ресурса + мутация

```typescript
// Server Component — initial data
async function DogDetailPage({ params }: { params: { id: string } }) {
  const api = getServerApiClient();
  const { data: dog } = await api.GET('/dogs/{id}', { params: { path: { id: params.id } } });

  return <DogDetailClient initialDog={dog!} dogId={params.id} />;
}

// Client Component — интерактивность
'use client';
function DogDetailClient({ initialDog, dogId }: { initialDog: Dog; dogId: string }) {
  const { data: dog } = useQuery({
    queryKey: ['dog', dogId],
    queryFn: () => apiClient.GET('/dogs/{id}', { params: { path: { id: dogId } } }),
    initialData: { data: initialDog, error: null },
  });

  // Мутация: создать донат
  const donate = useMutation({
    mutationFn: (amount: number) => apiClient.POST('/payments/donate', {
      body: { goal_id: dog.active_goals[0].id, amount },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
    onSuccess: (response) => {
      window.location.href = response.data.payment_url;
    },
  });

  return <DogView dog={dog} onDonate={donate.mutate} />;
}
```

---

## 7. Кэширование и invalidation

### 7.1. Server-side кэш (Next.js fetch)

```typescript
fetch(url, {
  next: {
    revalidate: 60,              // Re-generate через 60 секунд
    tags: ['dogs', `dog-${id}`], // Теги для selective invalidation
  },
});
```

Invalidate из Server Action:

```typescript
'use server';
import { revalidateTag } from 'next/cache';

export async function updateDog(id: string, data: UpdateDogInput) {
  await fetch(/* ... */);
  revalidateTag('dogs');
  revalidateTag(`dog-${id}`);
}
```

### 7.2. Client-side кэш (React Query)

```typescript
// Query keys convention
['dogs']                              // Список
['dogs', { city: 'Moscow' }]          // Список с фильтрами
['dog', id]                           // Конкретная собака
['dog', id, 'goals']                  // Цели собаки
['dog', id, 'reports']                // Отчёты собаки
['user', 'me']                        // Текущий юзер
['patronages']                        // Мои патронажи
['walks', { dogId }]                  // Прогулки
```

Invalidate после мутации:

```typescript
const mutation = useMutation({
  mutationFn: createGoal,
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['dog', variables.dogId] });
    queryClient.invalidateQueries({ queryKey: ['dog', variables.dogId, 'goals'] });
  },
});
```

### 7.3. Optimistic updates

```typescript
const mutation = useMutation({
  mutationFn: ({ id, status }) => apiClient.PATCH('/walks/{id}/status', {
    params: { path: { id } },
    body: { status },
  }),
  onMutate: async ({ id, status }) => {
    await queryClient.cancelQueries({ queryKey: ['walks'] });
    const previous = queryClient.getQueryData(['walks']);
    queryClient.setQueryData(['walks'], (old) => /* ... */);
    return { previous };
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['walks'], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['walks'] });
  },
});
```

---

## 8. Работа с формами и мутациями

### 8.1. Стандартная форма с Server Action

```typescript
'use client';

import { useFormState } from 'react-dom';
import { createDog } from '@/app/actions/dogs';

export function CreateDogForm() {
  const [state, formAction] = useFormState(createDog, { errors: null });

  return (
    <form action={formAction}>
      <input name="name" required />
      {state.errors?.name && <p className="error">{state.errors.name}</p>}

      <select name="gender">
        <option value="male">Мальчик</option>
        <option value="female">Девочка</option>
      </select>

      <button type="submit">Создать</button>
    </form>
  );
}
```

### 8.2. Форма с react-hook-form

Для сложных форм с client-side валидацией и UX:

```typescript
'use client';

const form = useForm<CreateDogInput>({
  resolver: zodResolver(createDogSchema),
});

const mutation = useMutation({
  mutationFn: (data: CreateDogInput) => apiClient.POST('/curator/dogs', { body: data }),
  onSuccess: () => {
    toast.success('Собака создана');
    router.push('/curator/dashboard');
  },
});

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(mutation.mutate)}>
      {/* ... fields */}
    </form>
  </Form>
);
```

---

## 9. Работа с платежами

### 9.1. Флоу доната

```typescript
'use client';

export function DonateButton({ goalId, amount }: { goalId: string; amount: number }) {
  const mutation = useMutation({
    mutationFn: () => apiClient.POST('/payments/donate', {
      body: { goal_id: goalId, amount },
      headers: {
        'Idempotency-Key': crypto.randomUUID(),  // КРИТИЧНО
      },
    }),
    onSuccess: (response) => {
      // Редирект на страницу оплаты провайдера
      window.location.href = response.data.payment_url;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  return (
    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      Помочь {formatMoney(amount)}
    </Button>
  );
}
```

### 9.2. Обработка возврата с платёжной страницы

YooKassa редиректит на `/payment/success` или `/payment/failed` (настраивается в бекенде).

```typescript
// src/app/payment/success/page.tsx
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { payment_id: string };
}) {
  // НЕ проверяем статус тут — это делает webhook!
  // Просто показываем оптимистичное сообщение.
  return (
    <div>
      <h1>Спасибо!</h1>
      <p>Платёж в обработке, вы получите email-подтверждение через несколько минут.</p>
      <Link href="/">На главную</Link>
    </div>
  );
}
```

### 9.3. Anonymous donation

```typescript
'use client';

export function AnonymousDonationForm({ goalId }: { goalId: string }) {
  const form = useForm<AnonDonationInput>({
    resolver: zodResolver(anonDonationSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: AnonDonationInput) =>
      apiClient.POST('/donations/anonymous', {
        body: { ...data, goal_id: goalId },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: (response) => {
      window.location.href = response.data.payment_url;
    },
  });

  return (
    <form onSubmit={form.handleSubmit(mutation.mutate)}>
      <input {...form.register('amount')} type="number" />
      <input {...form.register('email')} type="email" />
      <input {...form.register('display_name')} placeholder="Ваше имя (необязательно)" />
      <button type="submit">Перейти к оплате</button>
    </form>
  );
}
```

---

## 10. Environment и контракт

### 10.1. Required env

```bash
# .env.local (dev)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
API_INTERNAL_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

```bash
# Vercel (production)
NEXT_PUBLIC_API_URL=https://api.dogcare.ru/api/v1
API_INTERNAL_URL=https://api.dogcare.ru/api/v1
NEXT_PUBLIC_SITE_URL=https://dogcare.ru
```

### 10.2. Валидация env

```typescript
// src/env.mjs
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_INTERNAL_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
  },
  runtimeEnv: {
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
});
```

### 10.3. Контракт с бекендом

| Ответственность | Где |
|---|---|
| Источник правды схемы API | Backend OpenAPI (`/api-json`) |
| Типы на фронте | Сгенерированы из спеки |
| Валидация ввода | Zod на фронте + class-validator на бекенде |
| Idempotency key | Генерирует фронт, бекенд уважает |
| Auth tokens | Бекенд выдаёт, фронт хранит в httpOnly cookies |
| CORS | Бекенд контролирует origin |
| Rate limits | Бекенд enforce, фронт graceful 429 handling |

### 10.4. Синхронизация релизов

При breaking change API:
1. Backend deploy → staging → проверка
2. Frontend `gen:api` → правка кода → PR → preview
3. Backend deploy → prod
4. Frontend deploy → prod (сразу после)

Окно несовместимости минимально, координируем релизы.
