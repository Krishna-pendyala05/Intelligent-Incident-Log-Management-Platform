# Backend API — Technical Reference

> For high-level project goals and architecture, see the [Root README](../README.md).

---

## Development Setup

### Option 1: Docker (Recommended)

Starts the complete stack (API + PostgreSQL) without requiring local Node.js or database installations.

```bash
# Run from the project root directory
docker-compose up --build
```

### Option 2: Local Development

To run the API natively for step-through debugging:

1. **Start the database container only:**

   ```bash
   docker-compose up -d db
   ```

2. **Install dependencies:**

   ```bash
   yarn install
   ```

3. **Initialise the database schema:**

   ```bash
   npx prisma generate   # Generate the Prisma client
   npx prisma db push    # Push schema to the running database
   ```

4. **Start the API in watch mode:**
   ```bash
   yarn start:dev
   ```

---

## Testing & Quality Assurance

The project maintains a multi-layer testing strategy.

### Unit Tests

Validates individual service and controller behaviour using mocked dependencies. All database and external service interactions are isolated via Jest mocks, ensuring tests remain fast and deterministic.

```bash
cd backend
yarn test
```

**Coverage includes:**

- `DetectionService` — Z-Score calculation, dual-threshold alert conditions, cold-start edge case (σ = 0), lock-skip behaviour
- `IncidentsService` — CRUD operations with mocked Prisma
- `AuthService` — JWT generation and credential validation
- `IngestionService` — Batch buffer accumulation and flush logic

### End-to-End (E2E) Tests

Exercises the full HTTP request lifecycle: user registration → authentication → incident creation → log ingestion. Requires a running PostgreSQL instance (port 5433, provided by `docker-compose up -d db`).

```bash
cd backend
yarn test:e2e
```

### Performance Benchmark

Measures ingestion throughput and rate-limiter behaviour under high-concurrency flood conditions using `autocannon`.

```bash
# From the backend directory (requires the API to be running)
node scripts/benchmark.js
```

**Interpreting Results:**

The outcome depends on the `THROTTLE_LIMIT` value in `.env`:

| Scenario                          | Config                | Expected Result      | Interpretation                                                                                                                |
| :-------------------------------- | :-------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Security Validation** (default) | `THROTTLE_LIMIT=10`   | High 429 rate (~98%) | Rate limiter is functioning correctly under flood conditions — protects against unintentional and malicious request flooding. |
| **Throughput Test**               | `THROTTLE_LIMIT=1000` | 700–800+ req/s       | Batch buffer is sustaining high ingestion volume without exhausting the database connection pool.                             |

> The production default (`THROTTLE_LIMIT=10`) is intentionally restrictive. When evaluating raw ingestion throughput, set `THROTTLE_LIMIT=1000` to bypass the rate limiter and isolate the ingestion pipeline's performance characteristics.

👉 **[View Full Benchmark Report](../BENCHMARKS.md)**

### End-to-End Demo Script

Simulates a complete operational scenario, demonstrating the system's automated detection and response capabilities.

**Steps executed:**

1. Registers a new user and authenticates to obtain a JWT token.
2. Sends a stream of normal `INFO` logs to establish a Z-Score baseline.
3. Sends a burst of **20 `ERROR` logs** in rapid succession — a simulated 3-sigma anomaly.
4. Polls `GET /incidents` until an incident containing `"Anomaly Detected"` in its title appears, confirming automated detection triggered correctly.

```bash
cd backend
yarn demo
```

> **Note on timing:** Detection runs on a 10-second cron cycle and requires a minimum of 5 historical baseline buckets before statistical analysis begins. If the demo does not detect an incident on the first run, allow approximately 2 minutes for the baseline to accumulate and run again.

---

## API Reference

Full interactive documentation is available via Swagger UI at **`http://localhost:3000/api`** once the server is running.

### Key Endpoints

| Method  | Path                  | Auth | Description                             |
| :------ | :-------------------- | :--- | :-------------------------------------- |
| `POST`  | `/users`              | None | Register a new user                     |
| `POST`  | `/auth/login`         | None | Authenticate and receive a JWT          |
| `POST`  | `/ingest`             | None | Ingest a structured log entry           |
| `GET`   | `/incidents`          | JWT  | List incidents (paginated)              |
| `GET`   | `/incidents/:id`      | JWT  | Retrieve a single incident              |
| `GET`   | `/incidents/:id/logs` | JWT  | Retrieve logs correlated to an incident |
| `PATCH` | `/incidents/:id`      | JWT  | Update incident status or severity      |

---

## Codebase Structure

```
backend/
├── src/
│   ├── ingestion/          # Log ingestion: HTTP handler + in-memory batch buffer
│   ├── incidents/          # Incident CRUD (IncidentsService) + Z-Score detection (DetectionService)
│   ├── auth/               # JWT strategy, login handler, authentication guard
│   ├── users/              # User registration and management
│   ├── prisma/             # PrismaService wrapper (singleton database client)
│   └── common/             # Global exception filters, interceptors, validation pipes
├── prisma/
│   └── schema.prisma       # Database schema: Log, Incident, User, CronLock models
├── scripts/
│   ├── demo_scenario.ts    # End-to-end operational demo
│   └── benchmark.js        # Autocannon throughput benchmark
└── test/
    └── *.e2e-spec.ts       # End-to-end test suites
```

**Key design note:** `DetectionService` (inside `src/incidents/`) uses the `CronLock` database table to implement distributed mutual exclusion — ensuring only one detection job runs at a time even when multiple API instances are deployed horizontally.
