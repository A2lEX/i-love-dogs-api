# ---- Development Stage ----
FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma
# Устанавливаем все зависимости, включая devDependencies для hot-reload
RUN npm install

COPY . .
RUN npx prisma generate

# Запуск в режиме наблюдения за изменениями (hot-reload)
CMD [ "npm", "run", "start:dev" ]

# ---- Builder Stage ----
FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./
EXPOSE 3000
CMD [ "sh", "-c", "npx prisma db push && npm run start:prod" ]
