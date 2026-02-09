import { IsEnum, IsString, IsOptional } from 'class-validator';
import { IncidentStatus, Severity } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIncidentDto {
  @ApiProperty({ example: 'High Error Rate Detected', description: 'Title of the incident' })
  @IsString()
  title: string;

  @ApiProperty({ enum: Severity, example: 'HIGH', description: 'Severity of the incident', required: false })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiProperty({ enum: IncidentStatus, example: 'OPEN', description: 'Status of the incident', required: false })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;
}

