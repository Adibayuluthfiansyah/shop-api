import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { conditionalCsrfMiddleware } from './common/middleware/conditional-csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService>(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use(cookieParser());

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // This will skip CSRF for OAuth endpoints while protecting all other routes
  app.use(conditionalCsrfMiddleware);

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('E-Commerce Shop API')
    .setDescription('API documentation for E-Commerce Shop application')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and profile management')
    .addTag('Products', 'Product catalog management')
    .addTag('Categories', 'Product category management')
    .addTag('Cart', 'Shopping cart operations')
    .addTag('Orders', 'Order management and payment processing')
    .addTag('Health', 'API health check and status monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'E-Commerce Shop API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { font-size: 36px; }
    `,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
