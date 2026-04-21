# API_SPEC.md — DogCare Backend

> Полная спецификация REST API. Источник правды для фронта. Машиночитаемая версия — `openapi.json` (генерируется из Swagger decorator'ов в `/api-json`).

**Версия API:** v1
**Base URL:** `https://api.dogcare.ru/api/v1`
**Auth:** JWT Bearer
**Content-Type:** `application/json; charset=utf-8`

---

## Содержание

1. [Конвенции](#1-конвенции)
2. [Аутентификация](#2-аутентификация)
3. [Ошибки](#3-ошибки)
4. [Пагинация](#4-пагинация)
5. [Идемпотентность](#5-идемпотентность)
6. [Эндпоинты](#6-эндпоинты)
7. [Rate limiting](#7-rate-limiting)
8. [Версионирование](#8-версионирование)

---

## 1. Конвенции

### 1.1. Формат данных

- **Даты:** ISO 8601 UTC: `2026-04-21T10:23:45.123Z`
- **UUID:** v4: `f47ac10b-58cc-4372-a567-0e02b2c3d479`
- **Деньги:** integer в минорных единицах (копейки, центы)
- **Enum:** lowercase snake_case: `"active"`, `"verify_status"`

### 1.2. HTTP методы

| Метод | Использование |
|---|---|
| GET | Чтение, идемпотентно |
| POST | Создание |
| PATCH | Частичное обновление, идемпотентно |
| DELETE | Удаление/отмена, идемпотентно |

### 1.3. HTTP статусы

| Код | Значение |
|---|---|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async) |
| 204 | No Content |
| 400 | Bad Request (validation) |
| 401 | Unauthorized |
| 403 | Forbidden (нет прав) |
| 404 | Not Found |
| 409 | Conflict (нарушение инварианта) |
| 422 | Unprocessable Entity (бизнес-правило) |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### 1.4. Headers

**Request:**
| Header | Значение |
|---|---|
| `Authorization` | `Bearer <access_token>` |
| `Content-Type` | `application/json; charset=utf-8` |
| `Accept-Language` | `ru`, `en` |
| `Idempotency-Key` | UUID, обязателен для `POST /payments/*` и `POST /donations/*` |

**Response:**
| Header | Значение |
|---|---|
| `X-Request-Id` | UUID (для логов/саппорта) |
| `X-RateLimit-Limit` | Лимит |
| `X-RateLimit-Remaining` | Остаток |
| `X-RateLimit-Reset` | Unix timestamp |

---

## 2. Аутентификация

### 2.1. JWT

**Access token** (TTL 15 мин):
```json
{
  "sub": "user_uuid",
  "role": "donor",
  "email": "user@example.com",
  "iat": 1713706800,
  "exp": 1713707700
}
```

**Refresh token** (TTL 30 дней): opaque, хранится в Redis.

### 2.2. Flow

1. `POST /auth/login` → `{access_token, refresh_token}`
2. Access в `Authorization: Bearer`
3. При 401 `code: token_expired` → `POST /auth/refresh`
4. Новая пара (rotation), старый refresh инвалидируется

### 2.3. Публичные эндпоинты

Без авторизации:
- `POST /auth/register`, `/auth/login`, `/auth/refresh`
- `GET /dogs`, `GET /dogs/:id/*`
- `POST /donations/anonymous`
- `POST /webhooks/*`
- `GET /health/*`

---

## 3. Ошибки

### 3.1. Формат

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Email must be a valid email address"
      }
    ],
    "request_id": "req_abc123",
    "timestamp": "2026-04-21T10:23:45.123Z"
  }
}
```

### 3.2. Коды

**Общие:**
| Code | HTTP | Описание |
|---|---|---|
| `validation_failed` | 400 | Ошибки валидации |
| `unauthorized` | 401 | Нет токена |
| `token_expired` | 401 | Access истёк |
| `token_invalid` | 401 | Токен подделан/отозван |
| `forbidden` | 403 | Роль не позволяет |
| `not_found` | 404 | Ресурс не найден |
| `conflict` | 409 | Конфликт состояния |
| `unprocessable` | 422 | Бизнес-правило нарушено |
| `rate_limit_exceeded` | 429 | Превышен лимит |
| `internal_error` | 500 | Наш баг |
| `service_unavailable` | 503 | Зависимость недоступна |

**Специфичные:**
| Code | HTTP | Контекст |
|---|---|---|
| `email_already_exists` | 409 | Регистрация |
| `invalid_credentials` | 401 | Логин |
| `curator_not_verified` | 403 | Куратор добавляет собаку до верификации |
| `exclusive_patronage_taken` | 409 | Второй exclusive патронаж |
| `goal_already_completed` | 422 | Донат на закрытую цель |
| `walk_slot_conflict` | 409 | Пересечение прогулок |
| `walk_too_early` | 422 | Бронирование < 24ч |
| `payment_provider_error` | 502 | Ошибка провайдера |
| `idempotency_key_conflict` | 409 | Тот же ключ, другое тело |
| `webhook_signature_invalid` | 401 | Невалидная подпись |

---

## 4. Пагинация

### 4.1. Query параметры

| Param | Default | Max | Описание |
|---|---|---|---|
| `page` | 1 | — | 1-indexed |
| `limit` | 20 | 100 | Размер страницы |
| `sort` | `created_at` | — | Поле сортировки |
| `order` | `desc` | — | `asc` или `desc` |

### 4.2. Формат ответа

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 5. Идемпотентность

### 5.1. Idempotency-Key

Обязателен для `POST /payments/*` и `POST /donations/*`.

- UUID v4
- TTL в Redis: 24 часа
- При повторе с тем же ключом → кэшированный ответ 200 с заголовком `Idempotency-Replayed: true`
- Тот же ключ с разным телом → 409 `idempotency_key_conflict`

---

## 6. Эндпоинты

### 6.1. Auth

#### POST /auth/register

Создаёт нового пользователя с ролью `donor`.

**Request:**
```json
{
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "password": "SuperSecret123!",
  "phone": "+79001234567"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "role": "donor",
    "email_verified": false,
    "created_at": "2026-04-21T10:23:45Z"
  },
  "access_token": "eyJ...",
  "refresh_token": "opaque-string"
}
```

**Errors:** `email_already_exists` (409), `validation_failed` (400)

#### POST /auth/login

**Request:**
```json
{ "email": "ivan@example.com", "password": "SuperSecret123!" }
```

**Response 200:** `{ user, access_token, refresh_token }`
**Errors:** `invalid_credentials` (401), `validation_failed` (400)

#### POST /auth/refresh

**Request:** `{ "refresh_token": "opaque-string" }`
**Response 200:** `{ access_token, refresh_token }` (новая пара, rotation)
**Errors:** `token_invalid` (401), `token_expired` (401)

#### POST /auth/logout [auth]

**Request:** `{ "refresh_token": "opaque-string" }`
**Response 204**

#### GET /auth/me [auth]

**Response 200:**
```json
{
  "user": { "id", "name", "email", "role", "phone", "email_verified", "created_at" },
  "curator_profile": {
    "id", "shelter_name", "city", "verify_status", "verified_at"
  }
}
```
`curator_profile` присутствует только если `role === 'curator'`.

---

### 6.2. Curators

#### POST /curators/apply [auth, role: donor]

Заявка на становление куратором. Создаёт `CURATOR_PROFILE` с `verify_status='pending'`, меняет `USER.role` в `curator` (но без прав добавления собак до верификации).

**Request:**
```json
{
  "shelter_name": "Добрые руки",
  "address": "Москва, ул. Ленина 10",
  "city": "Москва",
  "description": "Частная передержка на 20 собак"
}
```

**Response 201:** `{ curator_profile }`

#### PATCH /curators/me [auth, role: curator]

Обновить свой профиль куратора. Нельзя менять `verify_status`.

---

### 6.3. Dogs (public)

#### GET /dogs

**Query:**
| Param | Type | Описание |
|---|---|---|
| `city` | string | Фильтр по городу |
| `breed` | string | Порода (partial match) |
| `gender` | enum | `male`, `female`, `unknown` |
| `has_active_goal` | bool | Только с активными целями |
| `has_exclusive_slot` | bool | Только без exclusive патрона |
| `goal_category` | enum | `medical`, `sterilization`, `food`, `custom` |
| `curator_id` | uuid | Фильтр по куратору |
| `search` | string | Full-text по имени и описанию |
| `page`, `limit`, `sort`, `order` | — | Пагинация |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Людвиг",
      "breed": "Метис",
      "age_months": 36,
      "gender": "male",
      "description": "Добрый и ласковый мальчик...",
      "status": "active",
      "city": "Москва",
      "cover_photo_url": "https://...",
      "curator": {
        "id": "uuid",
        "shelter_name": "Добрые руки",
        "city": "Москва"
      },
      "active_goals_count": 2,
      "has_exclusive_patron": false,
      "regular_patrons_count": 5,
      "created_at": "2026-04-21T10:23:45Z"
    }
  ],
  "pagination": { ... }
}
```

#### GET /dogs/:id

**Response 200:** `Dog` с расширенной информацией (включая `curator_profile` полностью).
**Errors:** `not_found` (404)

#### GET /dogs/:id/goals

**Query:** `status` (`active`/`completed`/`cancelled`/`all`), `category`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "dog_id": "uuid",
      "category": "medical",
      "title": "Операция на лапе",
      "description": "...",
      "amount_target": 5000000,
      "amount_collected": 3200000,
      "deadline": "2026-05-15T00:00:00Z",
      "is_recurring": false,
      "status": "active",
      "progress_percent": 64,
      "created_at": "..."
    }
  ]
}
```

#### GET /dogs/:id/reports

**Query:** `type` (`general`/`medical`/`walk`/`adoption`), `page`, `limit`

**Response 200:** список `Report` с `curator` shortcut'ом.

#### GET /dogs/:id/patronage

**Response 200:**
```json
{
  "exclusive_patron": {
    "id": "uuid",
    "name": "Анна",
    "since": "2026-01-15T00:00:00Z"
  },
  "is_exclusive_available": false,
  "regular_patrons_count": 5,
  "monthly_exclusive_amount_suggested": 800000
}
```
`exclusive_patron` = null если свободен. `monthly_exclusive_amount_suggested` = сумма активных целей / 12.

#### GET /dogs/:id/walks/slots

**Query:** `date_from`, `date_to` (ISO dates)

**Response 200:**
```json
{
  "available_slots": [
    { "date": "2026-04-25", "time": "10:00", "duration_min": 60 },
    { "date": "2026-04-25", "time": "12:00", "duration_min": 60 }
  ]
}
```

---

### 6.4. Dogs (curator)

#### POST /curator/dogs [role: curator, admin]

Создание собаки. Для куратора — проверка `verify_status='verified'`.

**Request:**
```json
{
  "name": "Людвиг",
  "breed": "Метис",
  "age_months": 36,
  "gender": "male",
  "description": "Добрый мальчик...",
  "city": "Москва",
  "cover_photo_url": "https://..."
}
```

**Response 201:** `Dog`
**Errors:** `curator_not_verified` (403), `validation_failed` (400)

#### PATCH /curator/dogs/:id [role: curator (owner), admin]

**Request:** `Partial<Dog>` (без `id`, `curator_id`, `created_at`)
**Errors:** `forbidden` (403) если не owner и не admin, `not_found` (404)

#### PATCH /curator/dogs/:id/status [role: curator (owner), admin]

**Request:** `{ "status": "active" | "adopted" | "archived" }`
**Response 200:** `Dog`

---

### 6.5. Goals

#### POST /curator/dogs/:dog_id/goals [role: curator (owner), admin]

**Request:**
```json
{
  "category": "medical",
  "title": "Операция на лапе",
  "description": "Нужна срочная операция...",
  "amount_target": 5000000,
  "deadline": "2026-05-15T00:00:00Z",
  "is_recurring": false
}
```

**Response 201:** `Goal`

#### PATCH /curator/goals/:id [role: curator (owner), admin]

**Request:** `{ title?, description?, amount_target?, deadline? }`
Нельзя менять `category`, `is_recurring`, `status` (отдельный endpoint).

#### PATCH /curator/goals/:id/status [role: curator (owner), admin]

**Request:** `{ "status": "completed" | "cancelled" }`
Автоматический переход в `completed` делается worker'ом при достижении суммы — ручной перевод только для `cancelled`.

---

### 6.6. Patronages

#### POST /patronages [auth]

**Request:**
```json
{
  "dog_id": "uuid",
  "type": "exclusive",
  "monthly_amount": 800000
}
```

Для `exclusive`: `monthly_amount` должен покрывать все активные цели (валидация).
Для `regular`: минимум 30000 (300 руб).

**Response 201:**
```json
{
  "patronage": { ... },
  "payment_url": "https://yookassa.ru/..."
}
```

**Errors:** `exclusive_patronage_taken` (409), `validation_failed` (400)

#### GET /patronages [auth]

Возвращает только свои патронажи.

**Query:** `status`, `dog_id`

#### GET /patronages/:id [auth]

Только свой. Возвращает патронаж + прогресс по целям собаки.

#### DELETE /patronages/:id [auth]

Отмена. `status → cancelled`, отменяется subscription у провайдера. Для `exclusive` — grace period 30 дней (подписка не продлевается, но `ends_at` = now + 30d).

---

### 6.7. Walks

#### POST /walks [auth]

**Request:**
```json
{
  "dog_id": "uuid",
  "scheduled_at": "2026-04-25T10:00:00Z",
  "duration_min": 60,
  "notes": "Первый раз гуляю с этой собакой"
}
```

**Response 201:** `Walk` (status=`pending`)
**Errors:** `walk_slot_conflict` (409), `walk_too_early` (422), `not_found` (404)

#### GET /walks [auth]

Свои прогулки. **Query:** `status`, `dog_id`, `date_from`, `date_to`

#### GET /walks/:id [auth]

Свои или куратора этой собаки.

#### PATCH /walks/:id/status [auth: walker or curator]

**Request:** `{ "status": "confirmed" | "started" | "completed" | "cancelled" }`

**Разрешённые переходы:**
- `pending → confirmed` (только curator)
- `pending → cancelled` (walker или curator)
- `confirmed → started` (walker)
- `confirmed → cancelled` (walker или curator)
- `started → completed` (walker)

#### POST /walks/:id/report [auth: walker]

Обязательный отчёт после `completed`.

**Request:**
```json
{
  "report_text": "Гуляли час, Людвиг играл, много контактировал с другими собаками",
  "photo_urls": ["https://...", "https://..."]
}
```

---

### 6.8. Payments

#### POST /payments/donate [auth, Idempotency-Key required]

**Request:**
```json
{ "goal_id": "uuid", "amount": 100000, "currency": "RUB" }
```

**Response 201:**
```json
{
  "payment_id": "uuid",
  "payment_url": "https://yookassa.ru/...",
  "amount": 100000,
  "currency": "RUB"
}
```

**Errors:** `goal_already_completed` (422), `not_found` (404)

#### GET /payments/history [auth]

Свои платежи. **Query:** `type`, `status`, `date_from`, `date_to`

---

### 6.9. Donations (anonymous)

#### POST /donations/anonymous [public, Idempotency-Key required]

**Request:**
```json
{
  "goal_id": "uuid",
  "amount": 100000,
  "currency": "RUB",
  "email": "donor@example.com",
  "display_name": "Марина из Будвы"
}
```

`display_name` опционален — если пусто, в ленте отобразится "Аноним".

**Response 201:**
```json
{
  "donation_id": "uuid",
  "payment_url": "https://yookassa.ru/..."
}
```

---

### 6.10. Webhooks

#### POST /webhooks/yookassa [public, signature-protected]

Webhook от YooKassa. Верифицируется HMAC-SHA256 в `X-YooKassa-Signature`.

**Response:** 200 OK (всегда быстро). Обработка — через BullMQ worker.

#### POST /webhooks/stripe [public, signature-protected]

Аналогично для Stripe (`Stripe-Signature` header).

---

### 6.11. Reports

#### POST /curator/dogs/:dog_id/reports [role: curator (owner), admin]

**Request:**
```json
{
  "type": "medical",
  "content": "Сделали прививку...",
  "photo_urls": ["https://..."]
}
```

#### GET /curator/dashboard [role: curator]

**Response 200:**
```json
{
  "dogs": [
    {
      "dog": { ... },
      "active_goals": [ ... ],
      "exclusive_patron": { ... } | null,
      "regular_patrons_count": 5,
      "pending_walks": [ ... ],
      "recent_reports": [ ... ]
    }
  ]
}
```

---

### 6.12. Media

#### POST /media/upload-url [auth]

Возвращает presigned URL для прямой загрузки в S3.

**Request:**
```json
{
  "filename": "dog_photo.jpg",
  "content_type": "image/jpeg",
  "purpose": "dog_cover" | "report_photo" | "walk_report"
}
```

**Response 200:**
```json
{
  "upload_url": "https://s3.../presigned?...",
  "public_url": "https://cdn.dogcare.ru/media/...",
  "expires_at": "2026-04-21T11:00:00Z"
}
```

---

### 6.13. Admin

#### GET /admin/curators [role: admin]
**Query:** `verify_status`

#### POST /admin/curators/invite [role: admin]
**Request:** `{ email, name, shelter_name, city }`
Создаёт USER + CURATOR_PROFILE + отправляет email-invite.

#### PATCH /admin/curators/:id/verify [role: admin]
**Request:** `{ status: "verified" | "rejected", note? }`

#### GET /admin/users [role: admin]
#### PATCH /admin/users/:id/status [role: admin]
**Request:** `{ status: "active" | "suspended" }`

#### GET /admin/dogs [role: admin]
Все собаки, включая `archived`.

#### GET /admin/payments [role: admin]
Все платежи с фильтрами.

#### GET /admin/stats [role: admin]
**Response 200:**
```json
{
  "dogs_total": 156,
  "active_goals": 89,
  "collected_total": 45000000,
  "patrons_count": 234,
  "walks_this_month": 412,
  "pending_curators": 3
}
```

---

### 6.14. Health

#### GET /health
**Response 200:**
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "s3": "ok",
  "version": "1.0.0",
  "uptime_seconds": 12345
}
```

#### GET /health/live
Минимальный ping: `200 OK` если процесс жив.

#### GET /health/ready
`200 OK` если готов принимать трафик (все зависимости up).

---

## 7. Rate limiting

| Категория | Лимит |
|---|---|
| Публичные GET | 100 req/min на IP |
| Auth (login, register) | 10 req/min на IP |
| Authenticated (донаты, патронаж) | 60 req/min на user |
| Webhook | Без лимита, IP whitelist от провайдера |
| Admin | 300 req/min на admin user |

При превышении — 429 с `Retry-After` header.

---

## 8. Версионирование

### 8.1. URL versioning

`/api/v1/` — текущая. При breaking changes — `/api/v2/`, с параллельной поддержкой старой версии 6 месяцев.

### 8.2. Что считается breaking change

- Удаление эндпоинта
- Удаление или переименование поля в response
- Изменение типа поля
- Добавление обязательного поля в request
- Изменение бизнес-логики видимое клиенту
- Изменение формата ошибки

### 8.3. Что не ломающее

- Добавление нового эндпоинта
- Добавление опционального поля в request
- Добавление поля в response (клиент должен игнорировать unknown)
- Расширение enum (клиент должен обрабатывать unknown values)
