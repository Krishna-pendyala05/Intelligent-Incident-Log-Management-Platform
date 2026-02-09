import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors();
  const config = new DocumentBuilder()
    .setTitle('Incident Management API')
    .setDescription('The Intelligent Incident & Log Management Platform API')
    .setVersion('1.0')
    .addTag('logs')
    .addTag('incidents')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3001);

}
bootstrap();
