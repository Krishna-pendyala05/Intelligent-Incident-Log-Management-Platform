import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { DetectionService } from './detection.service';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsService, DetectionService],
})
export class IncidentsModule {}
