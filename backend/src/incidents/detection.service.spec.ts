import { DetectionService } from './detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

// Helper: default mocks for a clean lock cycle (no existing lock, create succeeds)
function mockCleanLock(prismaMock: any) {
  prismaMock.cronLock.findUnique.mockResolvedValue(null); // No existing lock
  prismaMock.cronLock.create.mockResolvedValue({});       // Lock acquired
  prismaMock.cronLock.delete.mockResolvedValue({});       // Lock released
}

describe('DetectionService', () => {
  let service: DetectionService;
  let prismaMock: any;
  let incidentsMock: any;

  beforeEach(() => {
    prismaMock = {
      cronLock: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      log: {
        count: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: jest.fn(),
    };

    incidentsMock = {
      create: jest.fn().mockResolvedValue({ id: 'inc-test-123' }),
    };

    // Instantiate service directly — bypasses NestJS DI to keep tests fast and isolated
    service = new DetectionService(
      prismaMock as unknown as PrismaService,
      incidentsMock as unknown as IncidentsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Lock Tests ────────────────────────────────────────────────────────────

  it('should skip detection when lock is held by another instance', async () => {
    const futureExpiry = new Date(Date.now() + 5000);
    prismaMock.cronLock.findUnique.mockResolvedValue({ id: 'lock', expiry: futureExpiry });

    await service.handleCron();

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(incidentsMock.create).not.toHaveBeenCalled();
  });

  // ─── Z-Score Detection Tests ────────────────────────────────────────────────

  it('should NOT alert when current error rate is within normal range (Z < 3)', async () => {
    mockCleanLock(prismaMock);

    // Baseline: Mean ≈ 10.6, StdDev ≈ 0.8
    prismaMock.$queryRaw.mockResolvedValue([
      { loading: 10 }, { loading: 12 }, { loading: 10 },
      { loading: 11 }, { loading: 10 },
    ]);
    // Current = 11 → Z = (11 - 10.6) / 0.8 ≈ 0.5 → well below threshold
    prismaMock.log.count.mockResolvedValue(11);

    await service.handleCron();

    expect(incidentsMock.create).not.toHaveBeenCalled();
  });

  it('should alert when there is a real statistical spike (Z > 3, stdDev > 0)', async () => {
    mockCleanLock(prismaMock);

    // Baseline: Mean = 10, StdDev ≈ 1.8 (some variance)
    prismaMock.$queryRaw.mockResolvedValue([
      { loading: 8 }, { loading: 10 }, { loading: 12 },
      { loading: 9 }, { loading: 11 }, { loading: 10 },
    ]);
    // Current = 50 → Z = (50 - 10) / 1.8 ≈ 22 → massive anomaly
    prismaMock.log.count.mockResolvedValue(50);

    await service.handleCron();

    expect(incidentsMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Anomaly Detected'),
      }),
    );
  });

  it('should alert on cold-start: system was quiet (stdDev = 0), then a spike occurs', async () => {
    mockCleanLock(prismaMock);

    // Baseline: 10 buckets all zero (perfectly healthy system)
    prismaMock.$queryRaw.mockResolvedValue(Array(10).fill({ loading: 0 }));
    // Sudden spike of 20 errors → stdDev=0 path → zScore=999 → ALERT
    prismaMock.log.count.mockResolvedValue(20);

    await service.handleCron();

    expect(incidentsMock.create).toHaveBeenCalled();
  });

  it('should NOT alert if error count ≤ 5, even when Z-Score is high (noise guard)', async () => {
    mockCleanLock(prismaMock);

    // Baseline: Mean = 0, StdDev = 0 (new system, no prior errors)
    prismaMock.$queryRaw.mockResolvedValue(Array(10).fill({ loading: 0 }));
    // Only 3 errors — below MIN_ERROR_COUNT (5), so no alert despite Z=999
    prismaMock.log.count.mockResolvedValue(3);

    await service.handleCron();

    expect(incidentsMock.create).not.toHaveBeenCalled();
  });

  it('should skip detection when baseline has fewer than 5 data points', async () => {
    mockCleanLock(prismaMock);

    // Only 3 baseline buckets — not enough for reliable stats
    prismaMock.$queryRaw.mockResolvedValue([
      { loading: 5 }, { loading: 3 }, { loading: 4 },
    ]);

    await service.handleCron();

    expect(prismaMock.log.count).not.toHaveBeenCalled();
    expect(incidentsMock.create).not.toHaveBeenCalled();
  });
});
