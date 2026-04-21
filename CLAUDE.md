# CLAUDE.md — DogCare Backend

> Автоматически читается Claude Code при каждом запуске в корне этого репозитория.

---

## TL;DR

**DogCare Backend** — REST API на NestJS для платформы помощи бездомным собакам.

**Парный репозиторий:** `dogcare-frontend` (Next.js, деплоится на Vercel).

**Полная архитектура:** `docs/ARCHITECTURE.md`
**API спека (источник правды):** `docs/API_SPEC.md`
**Прогресс по этапам:** `docs/ROADMAP.md`

---

## Стек

| Слой | Технология | Версия |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x (strict) |
| ORM | TypeORM | 0.3.x |
| DB | PostgreSQL | 16 |
| Cache / Queue | Redis | 7 |
| Queue Library | BullMQ | 5.x |
| Storage | S3-совместимое (MinIO dev) | — |
| Payments | YooKassa (primary), Stripe | — |
| Email | SendGrid | — |
| Push | FCM | — |
| API Docs | @nestjs/swagger (OpenAPI 3.1) | — |
| Logger | Pino | — |
| Tests | Jest (unit) + Supertest (e2e) | — |
| Deploy | Docker → Railway / Fly.io / VPS | — |

---

## Роли пользователей

- **donor** — обычный пользователь. Донатит, становится патроном, гуляет с собаками
- **curator** — верифицированный владелец передержки. Добавляет собак, создаёт цели, публикует отчёты
- **admin** — верифицирует кураторов, модерирует, смотрит аналитику

Анонимные донаты — отдельная сущность `ANON_DONATION`, НЕ пользователь.

---

## Ключевые инварианты

Нарушать нельзя. Если кажется что надо — это баг в требованиях.

1. **Одна собака → максимум один активный exclusive патрон.** Защита: `SELECT FOR UPDATE` в транзакции + partial unique index `uq_patronages_exclusive_per_dog`
2. **Куратор управляет только своими собаками.** Проверка в guard по `DOG.curator_id`
3. **Только `verify_status = 'verified'` куратор добавляет собак.** Иначе 403
4. **`GOAL.amount_collected` меняется ТОЛЬКО через BullMQ job из webhook.** Никаких прямых UPDATE из контроллеров
5. **Анонимный донат → `ANON_DONATION`, не `USER`.** Не создаём гостевых юзеров
6. **Refresh tokens только в Redis.** В БД не попадают
7. **Все суммы — integer в минорных единицах** (копейки для RUB)
8. **Все timestamps — UTC** (`timestamp with time zone`)
9. **`PAYMENT` и `ANON_DONATION` — append-only.** Никаких DELETE / UPDATE суммы
10. **Webhook без верификации подписи → 401.** Не обрабатываем

---

## Текущий этап

**Статус:** ⬜ Этап 1 — Фундамент (не начат)

Обновляй после каждого закрытого этапа. Детали в `docs/ROADMAP.md`.

---

## CORS — важно для работы с фронтом

Фронт на Vercel, деплоится на разные домены (preview deployments + production). Конфиг CORS:

```typescript
app.enableCors({
  origin: [
    'http://localhost:3001',                    // dev frontend
    /^https:\/\/dogcare-frontend-.*\.vercel\.app$/,  // Vercel preview
    'https://dogcare.ru',                       // production
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
});
```

---

## Синхронизация типов с фронтом

Два репо → типы дублируются. Решаем через **автоматическую генерацию**:

1. NestJS генерирует OpenAPI спеку в `/api-json` (Swagger plugin)
2. Фронт в своём CI тянет эту спеку и генерирует типы через `openapi-typescript`
3. Команда: `pnpm gen:api` в frontend → получает готовые `Dog`, `Goal`, `PatronageResponse` и т.д.

**Правило:** любое изменение DTO в бекенде — требует deploy бекенда ДО обновления фронта. Обратная последовательность сломает preview deployments.

---

## Конвенции кода

### TypeScript
- `strict: true`, никаких `any` без комментария
- Никаких `!` (non-null assertion) в прод-коде
- Пути через `@/` алиас
- Barrel экспорты (`index.ts`) — только для публичного API модуля

### NestJS
- Один модуль = одна зона ответственности
- Контроллеры тонкие, логика в сервисах
- DTO раздельно: `Create*Dto`, `Update*Dto`, `*ResponseDto`
- Валидация через `class-validator` на DTO
- Guards: `JwtAuthGuard` + `RolesGuard` + `@Roles('curator')`
- Публичные эндпоинты — декоратор `@Public()`

### БД
- Миграции только через TypeORM CLI, руками не пишем
- `synchronize: false` ВСЕГДА, даже в dev
- Имена: snake_case, таблицы множественные (`users`, `dogs`)
- Индексы: `idx_<table>_<columns>`
- FK: `fk_<table>_<ref_table>` с явной `ON DELETE` политикой
- Partial indexes где применимо (`WHERE status = 'active'`)

### Именование
- Классы: PascalCase (`DogsService`, `CreateGoalDto`)
- Методы / переменные: camelCase
- Константы: UPPER_SNAKE_CASE
- Enum'ы: PascalCase с PascalCase значениями (`UserRole.Donor`)
- Файлы: kebab-case.role.ts (`dogs.service.ts`)

### Git
- Branches: `feature/<issue>-<desc>`, `fix/<issue>-<desc>`
- Commits: Conventional Commits (`feat(dogs): add filter by city`)

---

## Чего НЕ делать

1. Не хранить пароли в плейнтексте — только bcrypt (10+ rounds)
2. Не давать curator'у доступ к чужим собакам — всегда `WHERE curator_id = :me`
3. Не обновлять `GOAL.amount_collected` из контроллера — только через worker из webhook
4. Не делать cascade delete для финансов — `PAYMENT` append-only
5. Не синхронизировать схему автоматом (`synchronize: false`)
6. Не коммитить `.env` — только `.env.example`
7. Не писать `SELECT *` — явный список колонок
8. Не обрабатывать webhook без верификации подписи — 401
9. Не логировать PII (email, phone) в info-level — только debug с маскированием
10. Не использовать `console.log` — только инжектированный `Logger`
11. Не добавлять новые endpoint'ы без обновления `docs/API_SPEC.md`

---

## Observability

### Логирование
- Pino → structured JSON stdout
- Обязательные поля: `timestamp`, `level`, `context`, `requestId`, `userId`, `message`
- `X-Request-Id` корреляция через все слои

### Метрики (Prometheus)
- HTTP: `http_requests_total{method, route, status}`, `http_request_duration_seconds`
- БД: `db_query_duration_seconds`, `db_pool_connections_active`
- Бизнес: `payments_succeeded_total`, `goals_completed_total`, `patronages_active`

### Health check
- `GET /health` — полный (db + redis + s3)
- `GET /health/live` — процесс жив
- `GET /health/ready` — готов принимать траффик

---

## Performance targets (SLO)

| Метрика | Target |
|---|---|
| p50 API latency | < 100ms |
| p99 API latency | < 500ms |
| DB query p99 | < 50ms |
| Availability | 99.9% |
| Error rate | < 0.1% |

---

## Команды

```bash
# Dev
npm run start:dev            # watch mode
npm run typecheck            # проверка типов
npm run lint                 # ESLint
npm run format               # Prettier

# Tests
npm run test                 # unit
npm run test:e2e             # e2e
npm run test:cov             # coverage

# Миграции
npm run migration:generate -- src/database/migrations/AddDogsTable
npm run migration:run
npm run migration:revert

# Docker dev
docker compose up -d         # postgres + redis + minio
docker compose logs -f
docker compose down

# Генерация OpenAPI для фронта
npm run build
npm run start:prod &
curl http://localhost:3000/api-json > openapi.json
```

---

## Связанные документы

- `docs/ARCHITECTURE.md` — схема данных, модули, инфраструктура, ADR
- `docs/API_SPEC.md` — полная спека эндпоинтов (источник правды для фронта)
- `docs/ROADMAP.md` — этапы, прогресс, backlog
