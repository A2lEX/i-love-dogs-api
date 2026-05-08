#!/bin/bash
set -e

# Конфигурация
SERVER="root@girsa.ru"
# Если проект на сервере лежит по другому пути - измени эту переменную
APP_DIR="/root/i-love-dogs-api" 

echo "🚀 Начинаем деплой бэкенда на сервер $SERVER..."

ssh $SERVER << EOF
  set -e
  echo "📦 Переходим в папку проекта: $APP_DIR"
  cd $APP_DIR

  echo "⬇️ Получаем последние обновления из репозитория..."
  git pull origin main

  echo "🛠 Собираем новые образы Docker..."
  docker compose -f docker-compose.prod.yml build

  echo "⚠️ Обновляем базу данных (разрешаем удаление колонки city для перехода на city_id)..."
  # Запускаем db push во временном контейнере перед запуском основного приложения,
  # чтобы избежать крэша основного контейнера из-за ошибки потери данных
  docker compose -f docker-compose.prod.yml run --rm api npx prisma db push --accept-data-loss
  
  echo "🌱 Запускаем сидирование базы (добавление новых стран и городов)..."
  docker compose -f docker-compose.prod.yml run --rm api npx prisma db seed

  echo "🔄 Перезапускаем рабочие контейнеры..."
  docker compose -f docker-compose.prod.yml up -d

  echo "✅ Деплой успешно завершен!"
EOF
