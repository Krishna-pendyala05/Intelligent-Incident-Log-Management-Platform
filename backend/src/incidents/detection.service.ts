import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';
import { Severity, IncidentStatus } from '@prisma/client';

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private prisma: PrismaService,
    private incidentsService: IncidentsService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    // 1. Define the window (last 60 seconds)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // 2. Count ERROR logs that are not yet associated with an incident
    const recentErrorCount = await this.prisma.log.count({
      where: {
        level: 'ERROR',
        timestamp: { gte: oneMinuteAgo },
        incident_id: null,
      },
    });

    this.logger.debug(`Checking for incidents... Found ${recentErrorCount} recent errors.`);

    // 3. Threshold: If > 5 errors, create an incident
    if (recentErrorCount > 5) {
      this.logger.warn(`High error rate detected (${recentErrorCount} errors). Creating incident...`);

      const incident = await this.incidentsService.create({
        title: `High Error Rate Detected: ${recentErrorCount} errors in last minute`,
        severity: Severity.HIGH,
        status: IncidentStatus.OPEN,
      });

      this.logger.log(`Incident created: ${incident.id}`);

      // 4. Link these logs to the incident (Optional/Future: efficient batch update)
      // For now, simpler to just mark them? Or leave them?
      // Let's link them to avoid re-triggering (idempotency)
      await this.prisma.log.updateMany({
        where: {
          level: 'ERROR',
          timestamp: { gte: oneMinuteAgo },
          incident_id: null,
        },
        data: {
          incident_id: incident.id,
        },
      });
    }
  }
}
