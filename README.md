# Intelligent Incident & Log Management Platform 🛡️

> **A high-performance backend system for structured log ingestion, statistical anomaly detection, and automated incident response.**

[![CI](https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform/actions)
![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)

---

## System Overview

**Intelligent Incident & Log Management Platform** is a production-oriented backend that emulates core observability patterns found in enterprise SRE tooling. It handles high-volume structured log ingestion, runs continuous statistical anomaly detection in the background, and automatically creates and correlates incidents — without manual intervention.

### Why "Intelligent"?

The term reflects the detection architecture, not marketing. Most log management systems are passive: they store data and wait for a human (or a static rule) to identify problems. This system is **active** — it continuously models normal system behavior and flags statistically significant deviations automatically.

The detection engine uses **Z-Score analysis** to establish a rolling 30-minute baseline of per-minute error rates. If the current error rate deviates by more than **3 standard deviations** from the historical mean (a 3-sigma event, representing 99.7% statistical confidence of anomaly), the system automatically creates an Incident record and associates the triggering logs with it. This eliminates both the false positives of static threshold alerting (triggering on low-traffic noise) and the false negatives (missing proportional degradation under high traffic).

### Engineering Highlights

- **Statistical Anomaly Detection**: A Z-Score engine with a 30-minute rolling baseline and a dual-threshold alert condition (`Z > 3.0` AND `count > 5`) prevents both false positives from noise and false negatives from proportional degradation — without manual tuning.
- **High-Throughput Ingestion**: An in-memory batch buffer decouples HTTP receipt from database writes. Incoming logs are flushed via `createMany` every 5 seconds, reducing database write frequency by ~98% under load.
- **Database Query Optimization**: Pagination (`skip`/`take`) and removal of eager log loading from list endpoints reduced `GET /incidents` response time from ~500ms to <20ms.
- **Containerized Deployment**: A multi-stage Dockerfile separates build tooling from the runtime layer, reducing image size by ~80%. Docker Compose service networking allows reliable inter-container communication.
- **Security**: JWT-based authentication, global rate limiting via `ThrottlerGuard`, password hashing with `bcrypt`, and automatic response sanitization to prevent credential leakage.

---

## Documentation Map

| Document                                                  | Purpose                                                                                               |
| :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **[Backend Setup Guide](./backend/README.md)**            | Technical reference: how to run, test, benchmark, and interact with the API locally.                  |
| **[Implementation Journey](./IMPLEMENTATION_JOURNEY.md)** | Engineering deep-dive: the problems, trade-offs, and design decisions made during development.        |
| **[Benchmark Report](./BENCHMARKS.md)**                   | Measured performance data: ingestion throughput, latency distribution, and detection engine overhead. |

---

## Performance & Scalability

The system has been benchmarked under realistic flood conditions using `autocannon` (100 concurrent connections, 10-second duration).

| Metric         | Result                                              |
| :------------- | :-------------------------------------------------- |
| **Throughput** | **722 req/s** average under 100 concurrent clients  |
| **Latency**    | **137ms** average · **370ms** p99                   |
| **Security**   | **98.6%** of flood traffic rejected by rate limiter |

> The majority of rejected requests are `429 Too Many Requests` from `ThrottlerGuard` — this is intentional. The purpose of the benchmark is to demonstrate that the system remains stable under flood conditions, not to maximize raw throughput.

👉 **[View Full Benchmark Report](./BENCHMARKS.md)**

---

## Architecture Overview

The system operates as a pipeline:

1.  **Ingestion** — Services push structured log payloads to `POST /ingest`. An in-memory buffer accumulates entries and flushes them to PostgreSQL in batches every 5 seconds.
2.  **Detection** — A background cron job runs every 10 seconds. It queries the last 30 minutes of per-minute error rates, computes the Z-Score for the current window, and creates an Incident if the dual threshold (Z > 3.0 and count > 5) is breached.
3.  **Incident Correlation** — On incident creation, all triggering error logs within the detection window are linked to the incident record via `updateMany`, providing full traceability from alert back to root cause.

```mermaid
flowchart LR
    %% 🎨 Styles
    classDef client fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#0d47a1
    classDef ingest fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#1b5e20
    classDef db fill:#eceff1,stroke:#455a64,stroke-width:2px,color:#263238
    classDef detect fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c
    classDef alert fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#b71c1c,stroke-dasharray: 5 5

    %% 🧩 Nodes
    Client(["👤 Client Traffic"]) ::: client
    API["⚡ Ingestion API"] ::: ingest
    Buffer["📦 Batch Buffer"] ::: ingest
    DB[("🗄️ PostgreSQL")] ::: db

    subgraph Analysis ["🧠 Background Analysis"]
        direction TB
        Cron(("⏱️ 10s Cron")) ::: detect
        Detector["🔍 Detection Service"] ::: detect
        Check{"📈 Z > 3?"} ::: detect
    end

    Alert["🚨 Incident Alert"] ::: alert

    %% 🔗 Pipeline Flow (Left to Right)
    Client -->|POST /ingest| API
    API -->|Push| Buffer
    Buffer -->|Flush (5s)| DB

    %% Detection Cycle
    Cron -->|Wake| Detector
    Detector -->|"1. Query (30m)"| DB
    Detector -->|"2. Stats"| Check
    Check -->|Yes| Alert
    Check -.->|No| DB

    Alert -.->|"3. Correlate"| DB
```

### Tech Stack

| Layer                | Technology                    |
| :------------------- | :---------------------------- |
| **API Framework**    | NestJS (Node.js) + TypeScript |
| **Database**         | PostgreSQL via Prisma ORM     |
| **Auth**             | JWT (passport-jwt) + bcrypt   |
| **Containerization** | Docker + Docker Compose       |
| **CI/CD**            | GitHub Actions                |

---

## Quick Start

The entire stack (API + database) can be started with a single Docker Compose command.

```bash
# Clone the repository
git clone https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform.git
cd "Intelligent-Incident-Log-Management-Platform"

# Start all services
docker-compose up --build
```

Once running:

- **API**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/api`

### End-to-End Demo

The demo script simulates authenticated traffic, triggers a statistical anomaly, and verifies automatic incident creation:

```bash
cd backend
yarn install
yarn demo
```

---

## Troubleshooting

### "Docker daemon is not running"

Open **Docker Desktop** and wait for the engine to reach a running state (green status icon), then retry `docker-compose up`.

### "Port 3000 or 5432 already in use"

Another process is bound to the required port.

```bash
# Windows
npx kill-port 3000 5432

# macOS / Linux
lsof -i :3000 | awk 'NR>1 {print $2}' | xargs kill -9

# Clean up stale Docker containers
docker-compose down
```

### "Invalid Prisma client" / schema mismatch

The generated Prisma client is out of sync with the schema. Regenerate it:

```bash
cd backend
npx prisma generate
```

---

## Author

**Murali Krishna Pendyala**
_Software Engineer_
[LinkedIn](https://linkedin.com/in/p-muralikrishna) | [GitHub](https://github.com/Krishna-pendyala05)
