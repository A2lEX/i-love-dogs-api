# ARCHITECTURE.md — DogCare Backend

> Архитектура серверной части. Фронт в отдельном репозитории, взаимодействие через REST API.

**Версия:** 1.0
**Обновлено:** 2026-04-21
**Статус:** Living document

---

## Содержание

1. [Обзор](#1-обзор)
2. [Функциональные требования](#2-функциональные-требования)
3. [Нефункциональные требования](#3-нефункциональные-требования)
4. [ADR — архитектурные решения](#4-adr--архитектурные-решения)
5. [Компонентная диаграмма](#5-компонентная-диаграмма)
6. [Схема данных](#6-схема-данных)
7. [Модули приложения](#7-модули-приложения)
8. [Потоки данных](#8-потоки-данных)
9. [Инфраструктура](#9-инфраструктура)
10. [Безопасность](#10-безопасность)
11. [Наблюдаемость](#11-наблюдаемость)
12. [Масштабирование](#12-масштабирование)

---

## 1. Обзор

**DogCare** — платформа патронажа бездомных собак. Решает три проблемы:

1. **Доверие к донатам.** Каждая собака имеет верифицированного куратора, публичную финансовую историю и регулярные фото-отчёты.
2. **Эмоциональная связь.** Помощь конкретной собаке с именем, фото и историей — не абстрактному фонду.
3. **Вовлечение сверх денег.** Механика прогулок и эксклюзивного патронажа делает пользователя частью жизни собаки.

### 1.1. Роли

| Роль | Описание |
|---|---|
| **donor** | Донатит, становится патроном, записывается на прогулки. Может быть анонимным. |
| **curator** | Верифицированный владелец передержки. Добавляет собак, ведёт цели, публикует отчёты. |
| **admin** | Верифицирует кураторов, модерирует, аналитика. |

### 1.2. Фичи

- Каталог собак с фильтрацией
- Финансовые цели с прогрессом (medical, sterilization, food, custom)
- Патронаж: exclusive (одна собака = один патрон) и regular (без ограничений)
- Прогулки: бронирование, подтверждение, отчёты
- Донаты: авторизованные и анонимные
- Верификация кураторов
- Нотификации (email, push)

---

## 2. Функциональные требования

### 2.1. Каталог собак
- FR-D01: Публичный просмотр `status = active`
- FR-D02: Фильтры: city, breed, has_active_goal, has_exclusive_slot, goal_category
- FR-D03: Пагинация (default 20, max 100)
- FR-D04: Сортировка (default `created_at DESC`)
- FR-D05: Full-text search по имени и описанию

### 2.2. Цели
- FR-G01: 4 категории: `medical`, `sterilization`, `food`, `custom`
- FR-G02: Обязательно: `dog_id`, `title`, `amount_target`
- FR-G03: Опционально: `description`, `deadline`, `is_recurring`
- FR-G04: Recurring сбрасывается раз в месяц (cron)
- FR-G05: При `amount_collected >= amount_target` → статус `completed`
- FR-G06: Закрытая цель не принимает донаты

### 2.3. Патронаж
- FR-P01: Два типа: `exclusive`, `regular`
- FR-P02: Максимум один активный `exclusive` на собаку
- FR-P03: Попытка создать второй → 409
- FR-P04: Exclusive покрывает все активные цели собаки
- FR-P05: Отмена exclusive — grace period 30 дней
- FR-P06: Regular патронов неограниченно

### 2.4. Прогулки
- FR-W01: Любой авторизованный может бронировать
- FR-W02: Без пересечения слотов для одной собаки
- FR-W03: Мин 24 часа вперёд, макс 30 дней
- FR-W04: State machine: `pending → confirmed → started → completed | cancelled`
- FR-W05: Отчёт обязателен в течение 24 часов после `completed`

### 2.5. Платежи
- FR-PM01: Разовые донаты на цель
- FR-PM02: Рекуррентные платежи патронажа
- FR-PM03: Анонимные донаты (email обязателен)
- FR-PM04: YooKassa + Stripe
- FR-PM05: Webhook с верификацией подписи
- FR-PM06: Идемпотентность через `Idempotency-Key` header

### 2.6. Верификация кураторов
- FR-C01: Регистрация создаёт `USER` + `CURATOR_PROFILE` (pending)
- FR-C02: До `verified` — не может добавлять собак
- FR-C03: Админ меняет статус с комментарием
- FR-C04: Email при `verified` и `rejected`

---

## 3. Нефункциональные требования

### 3.1. Производительность
| Метрика | Target |
|---|---|
| p50 API | < 100 ms |
| p99 API | < 500 ms |
| DB query p99 | < 50 ms |
| Webhook → UI | < 5 s |
| Max throughput | 500 RPS (старт), 5000 RPS (scale) |

### 3.2. Доступность
- SLO: 99.9% uptime
- RPO: 1 час (бэкапы)
- RTO: 4 часа

### 3.3. Безопасность
- TLS 1.3 обязателен
- bcrypt 10+ rounds
- JWT access 15 мин, refresh 30 дней с rotation
- PII шифруется at-rest
- Audit log для admin действий

### 3.4. Соответствие
- GDPR (EU)
- ФЗ-152 (РФ)
- Right to be forgotten → soft delete + анонимизация финансов

---

## 4. ADR — архитектурные решения

### ADR-001: Monolith First
**Решение.** Модульный монолит NestJS.
**Почему.** 1-2 разработчика, домены ещё эволюционируют, операционная сложность микросервисов съест весь бюджет команды. NestJS даёт модульность без legacy.
**Пересмотр.** При команде > 5 человек или RPS > 2000.

### ADR-002: PostgreSQL как основная БД
**Решение.** PostgreSQL 16.
**Почему.** ACID для финансов, `SELECT FOR UPDATE` для race condition в exclusive патронаже, JSONB для гибких полей, full-text search из коробки, отличная поддержка в TypeORM.

### ADR-003: Деньги в минорных единицах
**Решение.** Integer, копейки/центы.
**Почему.** Float — классический источник багов округления. Преобразование в рубли — только в DTO representation layer.

### ADR-004: Idempotency-Key для платежей
**Решение.** `POST /payments/*` требуют `Idempotency-Key` header (UUID).
**Почему.** Сетевые повторы неизбежны, двойное списание недопустимо, стандарт индустрии (Stripe, YooKassa).
**Реализация.** Redis TTL 24h, ключ scoped к user_id.

### ADR-005: Webhook через очередь
**Решение.** Webhook endpoint верифицирует подпись и ставит job в BullMQ. Обработка в worker.
**Почему.** Провайдеры требуют <30s ответа, обработка может быть медленной, retry с backoff нужен.

### ADR-006: Refresh tokens только в Redis
**Решение.** Refresh в Redis с TTL, не в БД.
**Почему.** Быстрая инвалидация, rotation на каждом refresh, TTL чистит истёкшие автоматически.
**Структура.** `refresh:{user_id}:{token_id}` → `{created_at, device_info}`.

### ADR-007: Append-only для финансов
**Решение.** `PAYMENT` и `ANON_DONATION` — никогда не DELETE/UPDATE суммы. Только изменение `status`.
**Почему.** Аудит, налоговая, восстановимость, защита от багов.
**Практически.** Refund → новая запись `type=adjustment`, не изменение оригинала.

### ADR-008: Pino для логов
**Решение.** Pino с JSON форматом.
**Почему.** Самый быстрый Node.js логгер, JSON легко парсится в Loki/ELK, интеграция с NestJS через `nestjs-pino`.

### ADR-009: Два репозитория (bek + front)
**Решение.** Backend отдельно, frontend отдельно.
**Почему.** Унаследовано, фронт деплоится на Vercel независимо, разные релизные циклы.
**Следствия.** Типы синхронизируются через OpenAPI codegen. Любое изменение DTO бекенда → deploy бекенда ДО фронта.

---

## 5. Компонентная диаграмма

### 5.1. Высокоуровневая

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTS                               │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Next.js     │  Mobile App  │  Telegram    │  Public API    │
│  (Vercel)    │(React Native)│    Bot       │  (3rd party)   │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       └──────────────┼──────────────┼────────────────┘
                      │              │
                ┌─────▼──────────────▼─────┐
                │    API Gateway / LB       │
                │   HTTPS · WAF · Rate lim  │
                └─────────────┬─────────────┘
                              │
                      ┌───────▼────────┐
                      │  NestJS App    │
                      │  (horizontal   │
                      │   scalable)    │
                      └───────┬────────┘
                              │
      ┌───────────────┬───────┼───────┬────────────────┐
      ▼               ▼       ▼       ▼                ▼
┌──────────┐   ┌──────────┐  ┌──────────┐  ┌────────────────┐
│Postgres  │   │  Redis   │  │   S3     │  │ External APIs  │
│   16     │   │ (cache + │  │ (media)  │  │ - YooKassa     │
│primary+  │   │  BullMQ) │  │          │  │ - SendGrid     │
│replica   │   │          │  │          │  │ - FCM          │
└──────────┘   └──────────┘  └──────────┘  └────────────────┘
```

### 5.2. Worker процессы

```
         ┌──────────────────┐
         │   BullMQ Queues  │
         │     (Redis)      │
         └────────┬─────────┘
                  │
     ┌────────────┼────────────┬──────────────┐
     ▼            ▼            ▼              ▼
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│payment- │ │notific- │ │walk-     │ │recurring-    │
│webhook  │ │ations   │ │reminders │ │goals-reset   │
│worker   │ │worker   │ │worker    │ │worker (cron) │
└─────────┘ └─────────┘ └──────────┘ └──────────────┘
```

Worker'ы запускаются отдельными процессами (или k8s Pod'ами) для изоляции и независимого масштабирования.

---

## 6. Схема данных

### 6.1. DDL

```sql
-- USERS
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL DEFAULT 'donor'
                    CHECK (role IN ('donor', 'curator', 'admin')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_role_status ON users(role, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- CURATOR_PROFILES
CREATE TABLE curator_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  shelter_name    VARCHAR(200) NOT NULL,
  address         TEXT NOT NULL,
  city            VARCHAR(100) NOT NULL,
  description     TEXT,
  verify_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (verify_status IN ('pending', 'verified', 'rejected')),
  verified_at     TIMESTAMPTZ,
  verified_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_curator_profiles_verify_status ON curator_profiles(verify_status);
CREATE INDEX idx_curator_profiles_city ON curator_profiles(city)
  WHERE verify_status = 'verified';

-- DOGS
CREATE TABLE dogs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id      UUID NOT NULL REFERENCES curator_profiles(id) ON DELETE RESTRICT,
  name            VARCHAR(100) NOT NULL,
  breed           VARCHAR(100),
  age_months      INTEGER CHECK (age_months >= 0 AND age_months < 360),
  gender          VARCHAR(10) NOT NULL DEFAULT 'unknown'
                    CHECK (gender IN ('male', 'female', 'unknown')),
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'adopted', 'deceased', 'archived')),
  city            VARCHAR(100) NOT NULL,
  cover_photo_url VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_dogs_status_city ON dogs(status, city) WHERE deleted_at IS NULL;
CREATE INDEX idx_dogs_curator_id ON dogs(curator_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dogs_fulltext ON dogs
  USING gin(to_tsvector('russian', name || ' ' || COALESCE(description, '')))
  WHERE deleted_at IS NULL;

-- GOALS
CREATE TABLE goals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id            UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category          VARCHAR(20) NOT NULL
                      CHECK (category IN ('medical','sterilization','food','custom')),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  amount_target     INTEGER NOT NULL CHECK (amount_target > 0),
  amount_collected  INTEGER NOT NULL DEFAULT 0 CHECK (amount_collected >= 0),
  deadline          TIMESTAMPTZ,
  is_recurring      BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_dog_status ON goals(dog_id, status);
CREATE INDEX idx_goals_status_category ON goals(status, category);
CREATE INDEX idx_goals_deadline ON goals(deadline)
  WHERE status = 'active' AND deadline IS NOT NULL;

-- PATRONAGES
CREATE TABLE patronages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id          UUID NOT NULL REFERENCES dogs(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('exclusive', 'regular')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'cancelled')),
  subscription_id VARCHAR(255),
  monthly_amount  INTEGER NOT NULL CHECK (monthly_amount > 0),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Критический индекс: гарантия одного активного exclusive патрона на собаку
CREATE UNIQUE INDEX uq_patronages_exclusive_per_dog
  ON patronages(dog_id)
  WHERE type = 'exclusive' AND status = 'active';

CREATE INDEX idx_patronages_user ON patronages(user_id, status);
CREATE INDEX idx_patronages_dog ON patronages(dog_id, status);

-- WALKS
CREATE TABLE walks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id           UUID NOT NULL REFERENCES dogs(id) ON DELETE RESTRICT,
  walker_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_min     INTEGER NOT NULL DEFAULT 60
                     CHECK (duration_min >= 30 AND duration_min <= 180),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','started','completed','cancelled')),
  notes            TEXT,
  report_text      TEXT,
  report_photo_urls TEXT[],
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_walks_dog_scheduled ON walks(dog_id, scheduled_at);
CREATE INDEX idx_walks_walker ON walks(walker_id, status);
CREATE INDEX idx_walks_status_scheduled ON walks(status, scheduled_at);

-- Защита от пересечения слотов
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE walks ADD CONSTRAINT no_overlap_walks_per_dog
  EXCLUDE USING gist (
    dog_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_min || ' minutes')::interval) WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'started'));

-- PAYMENTS (append-only)
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  goal_id           UUID REFERENCES goals(id) ON DELETE RESTRICT,
  patronage_id      UUID REFERENCES patronages(id) ON DELETE RESTRICT,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  currency          VARCHAR(3) NOT NULL DEFAULT 'RUB',
  provider          VARCHAR(20) NOT NULL CHECK (provider IN ('yookassa','stripe')),
  provider_ref      VARCHAR(255) NOT NULL,
  idempotency_key   VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','succeeded','failed','refunded')),
  type              VARCHAR(20) NOT NULL
                      CHECK (type IN ('donation','subscription','adjustment')),
  failure_reason    TEXT,
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (goal_id IS NOT NULL OR patronage_id IS NOT NULL)
);

CREATE UNIQUE INDEX uq_payments_provider_ref ON payments(provider, provider_ref);
CREATE UNIQUE INDEX uq_payments_idempotency_key ON payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_goal ON payments(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(status);

-- ANON_DONATIONS (append-only)
CREATE TABLE anon_donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  email           VARCHAR(255) NOT NULL,
  display_name    VARCHAR(100),
  amount          INTEGER NOT NULL CHECK (amount > 0),
  currency        VARCHAR(3) NOT NULL DEFAULT 'RUB',
  provider        VARCHAR(20) NOT NULL CHECK (provider IN ('yookassa','stripe')),
  provider_ref    VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','succeeded','failed','refunded')),
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_anon_donations_provider_ref ON anon_donations(provider, provider_ref);
CREATE INDEX idx_anon_donations_goal ON anon_donations(goal_id, created_at DESC);
CREATE INDEX idx_anon_donations_email ON anon_donations(email);

-- REPORTS
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id        UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  curator_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type          VARCHAR(20) NOT NULL
                  CHECK (type IN ('general','medical','walk','adoption')),
  content       TEXT NOT NULL,
  photo_urls    TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_dog_created ON reports(dog_id, created_at DESC);

-- AUDIT_LOG
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID NOT NULL REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     UUID,
  before        JSONB,
  after         JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

### 6.2. Инварианты на уровне БД

| Инвариант | Механизм |
|---|---|
| ≤1 активный exclusive патрон на собаку | `uq_patronages_exclusive_per_dog` partial unique |
| Нет пересечений прогулок для собаки | `EXCLUDE USING gist` constraint |
| Уникальность платежа провайдера | `uq_payments_provider_ref` |
| Идемпотентность клиентских платежей | `uq_payments_idempotency_key` |
| Платёж привязан к цели ИЛИ патронажу | `CHECK (goal_id IS NOT NULL OR patronage_id IS NOT NULL)` |
| Суммы > 0 | `CHECK (amount > 0)` |

### 6.3. Soft delete политика

| Таблица | Soft delete | Причина |
|---|---|---|
| users | ✓ | GDPR — заменяется анонимизацией |
| dogs | ✓ | Сохраняем историю |
| goals | ✗ | Вместо — `status = cancelled` |
| patronages | ✗ | Вместо — `status = cancelled` |
| walks | ✗ | Вместо — `status = cancelled` |
| payments | ✗ | Append-only |
| anon_donations | ✗ | Append-only |
| reports | ✗ | Постоянная история |
| audit_log | ✗ | Append-only |

---

## 7. Модули приложения

```
src/
├── main.ts
├── app.module.ts
├── auth/                    # JWT, guards, strategies
├── users/                   # USER + CURATOR_PROFILE entities
├── curators/                # Self-service куратора
├── dogs/                    # Public + curator controllers
├── goals/                   # CRUD + recurring reset worker
├── patronages/              # Exclusive logic
├── walks/                   # Scheduling + reminders
├── payments/                # YooKassa/Stripe + webhooks
├── reports/                 # Обновления от куратора
├── notifications/           # Email + push
├── media/                   # S3 presigned URLs
├── admin/                   # Админские эндпоинты
├── audit/                   # Audit interceptor + storage
├── common/                  # Filters, interceptors, pipes, DTO
├── config/                  # ConfigService + env validation
├── database/                # Migrations, seeds, data source
└── health/                  # Health checks
```

### Правила импорта модулей

- Модуль A → публичный API модуля B (экспорт из `b.module.ts`)
- **Запрещено:** импорт entity из чужого модуля напрямую
- **Запрещено:** circular dependencies (выносим в `common/`)
- **Запрещено:** импорт контроллеров / DTO чужих модулей

### Схема зависимостей

```
auth      → users
users     → (база)
curators  → users, media
dogs      → users, curators, media
goals     → dogs
patronages → dogs, users, payments
walks     → dogs, users, notifications
payments  → goals, patronages, notifications
reports   → dogs, users, media
notifications → users
media     → (storage)
admin     → все (в основном read-only)
audit     → (глобальный interceptor)
```

---

## 8. Потоки данных

### 8.1. Анонимный донат

```
1. POST /donations/anonymous {goal_id, amount, email}
2. Валидация goal активна
3. INSERT anon_donation (status=pending)
4. YooKassa API → payment_url
5. Возврат {donation_id, payment_url}
6. User редиректится, платит
7. YooKassa → POST /webhooks/payment (с HMAC подписью)
8. Верификация подписи → INSERT webhook_events → enqueue BullMQ job → 200 OK
9. Worker:
   - UPDATE anon_donation.status = 'succeeded'
   - UPDATE goal.amount_collected += amount (atomic)
   - IF amount_collected >= amount_target: UPDATE goal.status = 'completed'
   - SEND email receipt
   - IF goal completed: notify curator + all donors
```

### 8.2. Exclusive патронаж (critical path)

```
POST /patronages {dog_id, type: 'exclusive'}

BEGIN TRANSACTION
  SELECT FROM dogs WHERE id=... FOR UPDATE
  SELECT FROM patronages
    WHERE dog_id=... AND type='exclusive' AND status='active'
    FOR UPDATE
  IF found: ROLLBACK, return 409 exclusive_patronage_taken
  monthly_amount = SUM(active goals.amount_target / goals.deadline_months)
  INSERT patronage
COMMIT

Create YooKassa subscription
UPDATE patronage.subscription_id
Return 201 {patronage}
```

Partial unique index — вторая линия защиты: даже если транзакция проскочит, INSERT упадёт.

### 8.3. Webhook от провайдера

```
POST /webhooks/payment + X-Signature header

1. Middleware: verify HMAC-SHA256(body + secret)
   invalid → 401 + audit log
2. INSERT webhook_events (raw_payload, signature, received_at)
3. Enqueue BullMQ: payment-webhook queue, attempts=5, backoff=exp
4. Return 200 immediately

Worker:
  a. Find PAYMENT or ANON_DONATION by provider_ref
  b. Not found → retry (race с созданием)
  c. Strict state machine transition
  d. Atomic UPDATE goal.amount_collected
  e. Trigger downstream events
```

---

## 9. Инфраструктура

### 9.1. Development

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dogcare
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ['5432:5432']
    volumes: ['pg_data:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    volumes: ['redis_data:/data']

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']
    volumes: ['minio_data:/data']

# Environment Variables for S3
# S3_ENDPOINT=http://minio:9000        # Internal endpoint for backend
# S3_PUBLIC_ENDPOINT=https://.../minio # Public endpoint for presigned URLs
# S3_PUBLIC_URL=https://.../dogcare    # Public URL for direct access

volumes:
  pg_data:
  redis_data:
  minio_data:
```

### 9.2. Production

```
          ┌──────────────┐
          │  CloudFlare  │   (CDN + WAF + DDoS)
          └──────┬───────┘
                 │
          ┌──────▼───────┐
          │ Load Balancer│
          └──────┬───────┘
                 │
   ┌─────────────┼─────────────┐
   ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐
│API Pod1│  │API Pod2│  │API PodN│
└────┬───┘  └────┬───┘  └────┬───┘
     │           │           │
     └───────────┼───────────┘
                 │
    ┌────────────┼────────────┬──────────────┐
    ▼            ▼            ▼              ▼
┌────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐
│Postgres│ │  Redis  │ │Worker pods│ │S3 storage │
│primary │ │cluster  │ │(pay, etc) │ │           │
│+replica│ │         │ │           │ │           │
└────────┘ └─────────┘ └──────────┘ └────────────┘
```

### 9.3. CI/CD

```
PR Opened → Tests + Lint → Build Docker → Deploy (stage) → Manual approval → Deploy (prod)
```

Deploy: rolling update с health checks и readiness probes. Blue/green не нужен на старте.

---

## 10. Безопасность

### 10.1. Модель угроз

| Угроза | Митигация |
|---|---|
| Перехват трафика | TLS 1.3, HSTS |
| Подмена запросов | CSRF для cookie flows (JWT в header — защищён) |
| XSS | Валидация + CSP headers + escape на фронте |
| SQL Injection | Параметризованные запросы (TypeORM) |
| Brute force | Rate limit 5/мин на IP+email, captcha после 3 фэйлов |
| Account takeover | 2FA (phase 2), email notify на новые логины |
| Privilege escalation | Guards на каждом write-endpoint, audit log |
| Webhook spoofing | HMAC verification, IP whitelist (backup) |
| Payment replay | Idempotency keys + unique provider_ref |

### 10.2. Secrets

- Никогда в коде или `.env` коммитах
- Dev: локальный `.env.local` (в `.gitignore`)
- Staging/Prod: k8s Secrets или Vault / AWS Secrets Manager
- Ротация: JWT — квартально, webhook — при компрометации

---

## 11. Наблюдаемость

### 11.1. Логи

**Стек.** Pino → JSON stdout → fluent-bit → Loki.

**Обязательные поля:**
```json
{
  "timestamp": "2026-04-21T10:23:45.123Z",
  "level": "info",
  "context": "PaymentsService",
  "requestId": "req_abc123",
  "userId": "user_xyz789",
  "message": "Payment succeeded",
  "metadata": { "payment_id": "...", "amount": 50000 }
}
```

### 11.2. Метрики (Prometheus)

**RED:** Rate, Errors, Duration на HTTP слое.
**USE:** Utilization, Saturation, Errors для БД и Redis.
**Business:** `payments_succeeded_total`, `goals_completed_total`, `patronages_created_total{type}`.

### 11.3. Трейсинг

OpenTelemetry → Jaeger. Автоматический span на HTTP, DB, external API. Корреляция через `trace-id`.

### 11.4. Алертинг

| Условие | Приоритет | Канал |
|---|---|---|
| p99 latency > 1s (5 мин) | P1 | PagerDuty |
| Error rate > 1% (5 мин) | P1 | PagerDuty |
| DB pool > 90% | P2 | Slack |
| Webhook delay > 30s | P2 | Slack |
| Failed payments > 5% (1ч) | P1 | PagerDuty |

---

## 12. Масштабирование

### 12.1. Forecast

| Период | DAU | RPS | DB size |
|---|---|---|---|
| MVP (3 мес) | 100 | 5 | 100 MB |
| Год 1 | 5,000 | 50 | 5 GB |
| Год 2 | 50,000 | 300 | 50 GB |
| Год 3 | 200,000 | 1500 | 200 GB |

### 12.2. Триггеры

- Scale API pods — p99 > 300ms или CPU > 70%
- Add PostgreSQL replica — read queries > 60%
- Move media to CDN — bandwidth > 100 GB/мес
- Partition payments — > 10M строк
- Extract notifications to microservice — > 100 msg/sec

### 12.3. Bottlenecks

1. PostgreSQL connections → PgBouncer transaction pooling
2. Webhook обработка → increase BullMQ worker concurrency
3. Image delivery → CDN (CloudFlare Images / Imgproxy)
4. Search по собакам → Elasticsearch при > 10k собак

### 12.4. НЕ делаем преждевременно

- Kubernetes (docker-compose / managed App Service на старте)
- Микросервисы (см. ADR-001)
- GraphQL (REST покрывает 95%)
- Event sourcing (избыточно)
- Multi-region deploy
