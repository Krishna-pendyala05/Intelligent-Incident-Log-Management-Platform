import { Injectable } from '@nestjs/common';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateIncidentDto) {
    return this.prisma.incident.create({ data });
  }

  findAll() {
    return this.prisma.incident.findMany({
      orderBy: { created_at: 'desc' },
      include: { logs: true },
    });
  }

  findOne(id: string) {
    return this.prisma.incident.findUnique({
      where: { id },
      include: { logs: true },
    });
  }

  update(id: string, updateIncidentDto: UpdateIncidentDto) {
    return this.prisma.incident.update({
      where: { id },
      data: updateIncidentDto,
    });
  }

  remove(id: string) {
    return this.prisma.incident.delete({ where: { id } });
  }
}
