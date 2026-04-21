# ROADMAP.md — DogCare Backend

> Живой документ. Обновляется после каждого закрытого этапа.

**Текущий статус:** ⬜ Этап 1 — Фундамент (не начат)

---

## Легенда

- ⬜ Не начато
- 🟨 В работе
- ✅ Завершено
- ⏸ Приостановлено
- ❌ Отменено

---

## Этап 1 — Фундамент

**Длительность:** 1–2 недели
**Цель:** рабочий проект с auth, базовой структурой и CI.
**Статус:** ⬜

### Задачи

#### 1.1 Инициализация NestJS проекта
- [ ] `nest new dogcare-backend`
- [ ] Настроить TypeORM + PostgreSQL
- [ ] Настроить `@nestjs/config` + Joi-валидация env
- [ ] Подключить Swagger (`@nestjs/swagger`) на `/api` и `/api-json`
- [ ] Глобальный `ValidationPipe` + `ClassSerializerInterceptor`
- [ ] Response interceptor (унификация формата)
- [ ] Exception filter (унификация ошибок)
- [ ] Request ID middleware (X-Request-Id)
- [ ] CORS конфиг (см. `CLAUDE.md`)
- [ ] Helmet
- [ ] Pino logger с форматом из `ARCHITECTURE.md §11.1`

#### 1.2 Модуль Auth
- [ ] `AuthModule`, `UsersModule` (базовый)
- [ ] `UserEntity`, `CuratorProfileEntity`
- [ ] Регистрация (`POST /auth/register`) с bcrypt
- [ ] Логин (`POST /auth/login`)
- [ ] JWT strategy (access + refresh)
- [ ] Refresh в Redis с TTL
- [ ] `POST /auth/refresh` (с rotation)
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] Guards: `JwtAuthGuard`, `RolesGuard`, `OptionalAuthGuard`
- [ ] Декораторы: `@Roles()`, `@Public()`, `@CurrentUser()`

#### 1.3 Миграции БД
- [ ] Настроить TypeORM CLI
- [ ] Миграции для `users`, `curator_profiles` (полный DDL из `ARCHITECTURE.md §6.1`)
- [ ] Seeds: admin user, тестовый curator (verified), тестовый donor

#### 1.4 S3 / Media
- [ ] `MediaModule`
- [ ] Presigned URL endpoint (`POST /media/upload-url`)
- [ ] Валидация content_type и размера
- [ ] MinIO в docker-compose

#### 1.5 Docker dev окружение
- [ ] `docker-compose.yml` (postgres, redis, minio)
- [ ] `.env.example` с комментариями
- [ ] README с инструкцией запуска

#### 1.6 CI/CD базовый
- [ ] GitHub Actions: lint + typecheck + unit tests на PR
- [ ] Dockerfile для продакшена

**Критерии готовности этапа:**
- `POST /auth/register` создаёт пользователя
- `POST /auth/login` возвращает JWT
- `GET /auth/me` возвращает текущего пользователя
- Swagger доступен на `/api`
- `docker compose up` поднимает окружение
- CI зелёный на main

---

## Этап 2 — Собаки и кураторы

**Длительность:** 1–2 недели
**Цель:** куратор добавляет собак, публичный каталог работает.
**Статус:** ⬜

### Задачи

#### 2.1 Модуль Users расширенный
- [ ] `POST /curators/apply` — заявка на куратора
- [ ] `PATCH /curators/me`
- [ ] Миграция: CURATOR_PROFILE полная схема

#### 2.2 Модуль Dogs
- [ ] `DogEntity`
- [ ] Миграция `dogs` таблицы (включая full-text index)
- [ ] `DogsPublicController`: GET endpoints
- [ ] `DogsCuratorController`: POST, PATCH endpoints
- [ ] Фильтры и пагинация (QueryBuilder)
- [ ] DTO: `CreateDogDto`, `UpdateDogDto`, `DogFilterDto`, `DogResponseDto`
- [ ] Guard: проверка что curator владеет собакой

#### 2.3 Модуль Admin (curators management)
- [ ] `GET /admin/curators`
- [ ] `POST /admin/curators/invite` с email-invite
- [ ] `PATCH /admin/curators/:id/verify`
- [ ] Email нотификации (верификация, отказ)

#### 2.4 Модуль Reports
- [ ] `ReportEntity`, миграция
- [ ] `POST /curator/dogs/:id/reports`
- [ ] `GET /dogs/:id/reports` (публичный)

#### 2.5 Email провайдер
- [ ] `NotificationsModule` с `EmailProvider`
- [ ] Интеграция SendGrid
- [ ] Шаблоны: welcome, curator_invited, curator_verified, curator_rejected

**Критерии готовности:**
- Админ приглашает куратора → тот получает email → регистрируется → загружает документы → админ верифицирует → куратор добавляет собаку → публичный GET /dogs показывает её
- Tests: e2e для полного флоу

---

## Этап 3 — Цели и донаты

**Длительность:** 1–2 недели
**Цель:** деньги текут, цели закрываются автоматически.
**Статус:** ⬜

### Задачи

#### 3.1 Модуль Goals
- [ ] `GoalEntity`, миграция
- [ ] CRUD endpoints (curator + admin)
- [ ] Публичный `GET /dogs/:id/goals`
- [ ] DTO + валидация

#### 3.2 YooKassa интеграция
- [ ] `PaymentProviderInterface`
- [ ] `YooKassaProvider` (создание платежа, webhook verify)
- [ ] Обработка webhook в `/webhooks/yookassa`
- [ ] HMAC-SHA256 верификация подписи
- [ ] `webhook_events` таблица для аудита

#### 3.3 Модуль Payments
- [ ] `PaymentEntity`, `AnonDonationEntity`, миграции
- [ ] `POST /payments/donate` (auth)
- [ ] `POST /donations/anonymous` (public)
- [ ] `GET /payments/history`
- [ ] Idempotency-Key middleware (Redis-backed)

#### 3.4 BullMQ обработка платежей
- [ ] `payment-webhook` queue
- [ ] Worker: atomic UPDATE goal.amount_collected
- [ ] Автозакрытие goal при достижении суммы
- [ ] Retry logic с exponential backoff (max 5 попыток)
- [ ] Dead letter queue для failed jobs

#### 3.5 Email после доната
- [ ] Шаблон `donation_receipt`
- [ ] Отправка для авторизованных и анонимных

**Критерии готовности:**
- Анонимный донат на 1000 руб → webhook → goal.amount_collected += 1000 → если достигли target → goal.status = completed → email куратору
- E2E тест полного флоу

---

## Этап 4 — Патронаж

**Длительность:** 1 неделя
**Цель:** рекуррентные списания, exclusive работает.
**Статус:** ⬜

### Задачи

#### 4.1 Модуль Patronages
- [ ] `PatronageEntity` + уникальный partial index
- [ ] `POST /patronages` с SELECT FOR UPDATE
- [ ] `GET /patronages`, `GET /patronages/:id`
- [ ] `DELETE /patronages/:id` (отмена с grace period)
- [ ] `GET /dogs/:id/patronage` (публичный статус)

#### 4.2 YooKassa subscriptions
- [ ] Создание subscription в провайдере
- [ ] Обработка recurring payment webhook
- [ ] Автоматическое продление / отмена

#### 4.3 Бизнес-логика exclusive
- [ ] Расчёт monthly_amount = сумма активных целей / 12
- [ ] Распределение полученной суммы по целям пропорционально
- [ ] При отмене exclusive — уведомление куратору
- [ ] Grace period 30 дней

**Критерии готовности:**
- User оформляет exclusive → YooKassa создаёт subscription → ежемесячно автосписание → goals пополняются
- Попытка оформить второй exclusive → 409
- Отмена exclusive → subscription cancelled у провайдера, но доступ до конца периода

---

## Этап 5 — Прогулки

**Длительность:** 1 неделя
**Цель:** полный цикл прогулки работает.
**Статус:** ⬜

### Задачи

#### 5.1 Модуль Walks
- [ ] `WalkEntity` + EXCLUDE constraint
- [ ] `POST /walks` с проверкой слотов
- [ ] `GET /walks`, `GET /walks/:id`
- [ ] `PATCH /walks/:id/status` с state machine
- [ ] `POST /walks/:id/report`
- [ ] `GET /dogs/:id/walks/slots` (публичный)

#### 5.2 Нотификации по прогулкам
- [ ] Куратору: новая запись (instant)
- [ ] Пользователю: подтверждение / отказ
- [ ] Пользователю + куратору: напоминание за 2 часа (scheduled job)
- [ ] Куратору + патрону: отчёт после прогулки

#### 5.3 BullMQ scheduled jobs
- [ ] Walk reminder job (delayed до 2 часов до scheduled_at)
- [ ] Auto-cancel pending walks через 24 часа без confirmation

**Критерии готовности:**
- User бронирует слот → куратор подтверждает → напоминание за 2 часа → user приходит, отмечает started → completed → пишет отчёт → патрон получает уведомление

---

## Этап 6 — Дашборды и нотификации

**Длительность:** 1 неделя
**Цель:** куратор видит всё по своим собакам в одном месте.
**Статус:** ⬜

### Задачи

#### 6.1 Dashboard endpoints
- [ ] `GET /curator/dashboard` — агрегированный ответ
- [ ] `GET /admin/stats`

#### 6.2 Push notifications (FCM)
- [ ] `PushProvider` интеграция с FCM
- [ ] Регистрация device tokens (`POST /users/me/devices`)
- [ ] Настройки нотификаций (`GET/PATCH /users/me/notifications`)

#### 6.3 Шаблоны нотификаций
- [ ] welcome
- [ ] curator_verified / curator_rejected
- [ ] new_patronage (куратору)
- [ ] goal_completed (всем донорам)
- [ ] walk_* (reminder, started, completed, report)
- [ ] payment_succeeded / payment_failed

---

## Этап 7 — Hardening и продакшн-рэди

**Длительность:** 1 неделя
**Цель:** prod-ready.
**Статус:** ⬜

### Задачи

#### 7.1 Rate limiting
- [ ] `@nestjs/throttler` настроен
- [ ] Разные лимиты для разных категорий (см. `API_SPEC.md §7`)
- [ ] Redis-backed storage

#### 7.2 Observability
- [ ] Prometheus endpoint `/metrics`
- [ ] Метрики: HTTP RED, DB, business
- [ ] Health checks: `/health`, `/health/live`, `/health/ready`
- [ ] OpenTelemetry tracing

#### 7.3 Audit log
- [ ] `AuditInterceptor` для admin эндпоинтов
- [ ] `audit_log` таблица + retention policy

#### 7.4 Документация
- [ ] OpenAPI спека полная (все examples, descriptions)
- [ ] README с runbook
- [ ] `docs/SECURITY.md` — модель угроз
- [ ] `docs/RUNBOOK.md` — операционные процедуры

#### 7.5 Тесты
- [ ] Unit tests: ≥ 70% coverage для сервисов
- [ ] E2E tests: все критические флоу
- [ ] Load tests: k6 или Artillery (базовый smoke)

#### 7.6 Deploy
- [ ] Dockerfile оптимизирован (multi-stage, non-root)
- [ ] k8s манифесты или Railway / Fly.io конфиг
- [ ] Secrets management (Vault / AWS Secrets Manager)
- [ ] Staging окружение
- [ ] Production deploy с blue-green или rolling update

---

## Backlog (после MVP)

### Фичи
- 2FA для admin и кураторов
- SSO (Google, Apple)
- Статистика для пользователя (сколько помог, каким собакам)
- Реферальная программа
- Геолокация: ближайшие собаки
- In-app чат куратор ↔ патрон
- История медицинской карты собаки
- Интеграция с календарём (iCal для прогулок)
- Мобильное приложение (React Native)
- Telegram Bot

### Инфраструктура
- Переход на микросервис: notifications отдельно
- Partitioning `payments` по месяцам
- Elasticsearch для поиска (>10k собак)
- CDN для медиа (CloudFlare Images)
- Multi-region deploy
- Kubernetes миграция

### Продуктовое
- A/B тесты UI (фронт-задача, но требует backend feature flags)
- Аналитика конверсий
- Email маркетинг (дайджесты раз в неделю)
- Партнёрства с ветклиниками

---

## История релизов

*(Заполняется после каждого deploy в production)*

| Версия | Дата | Изменения |
|---|---|---|
| — | — | — |
