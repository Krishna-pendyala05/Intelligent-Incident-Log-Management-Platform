import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('IngestionService', () => {
  let service: IngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: PrismaService,
          useValue: {
            log: {
              create: jest.fn(),
              createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            doesExist: jest.fn().mockReturnValue(false),
            deleteInterval: jest.fn(),
            addInterval: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should buffer a log entry', async () => {
    await service.processLog({
      service_id: 'test-service',
      level: 'INFO',
      message: 'test message',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
    // Buffer should have 1 entry (below batch size of 100)
    expect(service['logBuffer']).toHaveLength(1);
  });
});
