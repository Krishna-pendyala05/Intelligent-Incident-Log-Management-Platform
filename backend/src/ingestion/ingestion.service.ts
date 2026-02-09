import { Injectable, Logger } from '@nestjs/common';
import { CreateLogDto } from './dto/create-log.dto';
import { PrismaService } from '../prisma/prisma.service';
import { LogLevel } from '@prisma/client';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private prisma: PrismaService) {}

  async processLog(logDto: CreateLogDto) {
    try {
      const log = await this.prisma.log.create({
        data: {
          service_id: logDto.service_id,
          level: logDto.level as LogLevel,
          message: logDto.message,
          timestamp: new Date(logDto.timestamp),
          metadata: logDto.metadata || {},
        },
      });
      this.logger.log(`Log saved: ${log.id}`);
      return log;
    } catch (error) {
      this.logger.error('Failed to save log', error.stack);
      throw error;
    }
  }
}
