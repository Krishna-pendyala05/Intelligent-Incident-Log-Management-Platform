import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { CreateLogDto } from './dto/create-log.dto';

@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async ingestLog(@Body() createLogDto: CreateLogDto) {
    this.ingestionService.processLog(createLogDto);
    return { status: 'success', received: true };
  }
}
