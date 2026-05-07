import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

let cachedApp: INestApplication;

async function bootstrap(): Promise<INestApplication> {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://tailo.org',
        'https://www.tailo.org',
        /^https:\/\/.*\.tailo\.org$/,
        /^https:\/\/i-love-dogs-frontend-.*\.vercel\.app$/,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Region', 'X-Country', 'X-Currency'],
      exposedHeaders: ['Set-Cookie'],
    });

    const swaggerConfig = new DocumentBuilder()
      .setTitle('DogCare API')
      .setDescription('The DogCare Platform API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);

    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

// Standalone mode (for local development or Docker)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  bootstrap().then(async (app) => {
    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port', 3000);
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  });
}

// Export the handler for Vercel
export default async (req: any, res: any) => {
  const app = await bootstrap();
  const instance = app.getHttpAdapter().getInstance();
  instance(req, res);
};
