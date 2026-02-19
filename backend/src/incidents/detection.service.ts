import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';
import { Severity, IncidentStatus } from '@prisma/client';

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  // Z-Score threshold: >3 sigma = 99.7% confidence of anomaly in a normal distribution
  private readonly Z_SCORE_THRESHOLD = 3.0;
  // Minimum absolute count to suppress low-volume noise (e.g., 0→1 error = huge Z but not an incident)
  private readonly MIN_ERROR_COUNT = 5;
  // Rolling baseline window: last 30 minutes of per-minute error counts
  private readonly BASELINE_WINDOW_MINUTES = 30;
  // Minimum number of historical data points needed before statistical analysis is valid
  private readonly MIN_BASELINE_BUCKETS = 5;

  constructor(
    private prisma: PrismaService,
    private incidentsService: IncidentsService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    const lockId = 'detection_service_lock';
    const now = new Date();

    // --- 1. Distributed Lock Acquisition ---
    // Prevents multiple horizontally-scaled instances from running detection simultaneously.
    const existingLock = await this.prisma.cronLock.findUnique({
      where: { id: lockId },
    });

    if (existingLock) {
      if (existingLock.expiry > now) {
        this.logger.debug('Detection job locked by another instance. Skipping.');
        return;
      }
      // Lock is stale/expired — delete and re-acquire
      await this.prisma.cronLock.delete({ where: { id: lockId } }).catch(() => {});
    }

    try {
      await this.prisma.cronLock.create({
        data: {
          id: lockId,
          lockedAt: now,
          expiry: new Date(now.getTime() + 9000), // 9s expiry (< 10s cron interval)
        },
      });
    } catch {
      // Another instance won the race. Safe to skip.
      return;
    }

    try {
      await this.runDetection();
    } finally {
      // Always release the lock, even on failure
      await this.prisma.cronLock.delete({ where: { id: lockId } }).catch(() => {});
    }
  }

  /**
   * Z-Score Statistical Anomaly Detection
   *
   * Algorithm:
   *   1. Fetch per-minute ERROR counts over the last 30 minutes (baseline).
   *   2. Compute the mean (μ) and standard deviation (σ) of those counts.
   *   3. Measure the current rolling 60-second ERROR count (X).
   *   4. Calculate Z = (X - μ) / σ.
   *   5. If Z > 3.0 (3-sigma event, 99.7% confidence) AND X > 5 (noise guard),
   *      create an Incident and correlate the triggering logs to it.
   *
   * Edge Case — Cold Start (σ = 0):
   *   When the system has been perfectly quiet (all baseline buckets = 0),
   *   any non-trivial error burst is flagged as an infinite anomaly.
   */
  async runDetection() {
    // Step 1: Aggregate baseline — error counts per minute for the last 30 minutes
    const baselineMetrics: Array<{ time_bucket: Date; loading: number }> =
      await this.prisma.$queryRaw`
        SELECT
          date_trunc('minute', "timestamp") AS time_bucket,
          COUNT(*)::int AS loading
        FROM "Log"
        WHERE
          "level" = 'ERROR'
          AND "timestamp" > NOW() - INTERVAL '30 minutes'
        GROUP BY time_bucket
        ORDER BY time_bucket DESC;
      `;

    if (baselineMetrics.length < this.MIN_BASELINE_BUCKETS) {
      this.logger.debug(
        `Detection skipped: only ${baselineMetrics.length} baseline buckets (need ${this.MIN_BASELINE_BUCKETS}).`,
      );
      return;
    }

    // Step 2: Compute mean and standard deviation from baseline
    const values = baselineMetrics.map((m) => Number(m.loading));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Step 3: Current rolling-60s error count (un-correlated only — avoids counting already-handled spikes)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const currentErrorCount = await this.prisma.log.count({
      where: {
        level: 'ERROR',
        timestamp: { gte: oneMinuteAgo },
        incident_id: null,
      },
    });

    // Step 4: Compute Z-Score
    let zScore: number;
    if (stdDev === 0) {
      // Cold-start edge case: baseline was perfectly quiet.
      // Any spike above the mean is an anomaly of infinite magnitude.
      zScore = currentErrorCount > mean ? 999 : 0;
    } else {
      zScore = (currentErrorCount - mean) / stdDev;
    }

    this.logger.debug(
      `Detection stats — Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}, ` +
        `Current: ${currentErrorCount}, Z-Score: ${zScore.toFixed(2)}`,
    );

    // Step 5: Dual-threshold alert
    if (zScore > this.Z_SCORE_THRESHOLD && currentErrorCount > this.MIN_ERROR_COUNT) {
      this.logger.warn(
        `Anomaly detected — Z-Score: ${zScore.toFixed(2)} ` +
          `(current=${currentErrorCount} errors, baseline mean=${mean.toFixed(2)})`,
      );

      const severity = zScore > 5 ? Severity.CRITICAL : Severity.HIGH;
      const incident = await this.incidentsService.create({
        title: `Anomaly Detected: Error Spike (Z-Score: ${zScore.toFixed(2)}, Count: ${currentErrorCount})`,
        severity,
        status: IncidentStatus.OPEN,
      });

      this.logger.log(`Incident ${incident.id} created (severity: ${severity}).`);

      // Correlate the triggering logs to the new incident
      await this.prisma.log.updateMany({
        where: {
          level: 'ERROR',
          timestamp: { gte: oneMinuteAgo },
          incident_id: null,
        },
        data: { incident_id: incident.id },
      });
    }
  }
}
