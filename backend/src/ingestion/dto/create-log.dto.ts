import { IsString, IsEnum, IsOptional, IsObject, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export class CreateLogDto {
  @ApiProperty({ example: 'payment-service', description: 'ID of the service generating the log' })
  @IsString()
  service_id: string;

  @ApiProperty({ example: '2023-10-27T10:00:00Z', description: 'ISO 8601 timestamp of the log' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ enum: LogLevel, example: 'ERROR', description: 'Severity level of the log' })
  @IsEnum(LogLevel)
  level: LogLevel;

  @ApiProperty({ example: 'Payment gateway timeout', description: 'Log message content' })
  @IsString()
  message: string;

  @ApiProperty({ example: { transaction_id: 'tx_123', amount: 50 }, description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
