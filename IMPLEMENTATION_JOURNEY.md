# 🛠️ Implementation Journey & Engineering Decisions

This document serves as a detailed log of the engineering thought process, architectural decisions, and technical hurdles overcome during the development of the **Intelligent Incident & Log Management Platform**.

---

## 📅 Implementation Plan Overview

The project was executed in three distinct phases to ensure atomic progress and testability.

### Phase 1: The Foundation (Core Backend)

**Goal**: Establish a stable server capable of accepting data.

- **Decision**: Used **NestJS** over Express.
  - _Reasoning_: NestJS provides a strict modular structure (Controllers, Services, Modules) which enforces better code organization than the "wild west" of raw Express apps.
- **Decision**: Used **PostgreSQL** via **Docker**.
  - _Reasoning_: I needed a relational database for rigid schemas (Logs/Incidents). Running it via Docker meant no local installation mess.

### Phase 2: automated Intelligence (The "Brain")

**Goal**: Make the system "smart" without human intervention.

- **Feature**: Implemented a **Cron Job** (DetectionService) running every 10 seconds.
- **Logic**: `Count(ErrorLogs) > 5 in last 60s` -> `Create Incident`.
  - _Trade-off_: I chose a polling mechanism (Cron) over a push mechanism (Event Bus) for the MVP to reduce infrastructure complexity.

### Phase 3: Security & Polish

**Goal**: Production-readiness.

- **Feature**: **JWT Authentication**.
- **Feature**: **Swagger Documentation**.

---

## 🚧 Challenges & Problem Solving

During development, I encountered several "real-world" blockers. Here is how they were tackled:

### 1. The Prisma "File Locked" (EPERM) Error

**The Problem**:
While the NestJS server was running in "Watch Mode" (`yarn start:dev`), running `npx prisma generate` failed with an `EPERM: operation not permitted` error on Windows.

- **Root Cause Analysis**: The running Node.js process held a file lock on the Prisma Client binary `.dll` file, preventing the generator from overwriting it.
- **The Fix**: I established a strict workflow:
  1.  **Kill** the running server process (used `taskkill` or `Ctrl+C`).
  2.  Run `npx prisma generate`.
  3.  **Restart** the server.

### 2. The "Internal Server Error" on Duplicate Users

**The Problem**:
When registering a user with an email that already existed, the server crashed with a `500 Internal Server Error`.

- **Investigation**: The logs showed a `P2002` error code from Prisma (Unique Constraint Violation).
- **The Fix**: I implemented a `try-catch` block in the `UsersService`. By utilizing NestJS's `ConflictException`, I transformed a crashing error into a meaningful **409 Conflict** HTTP response.

### 3. Docker Networking "Connection Refused"

**The Problem**:
The Backend service couldn't connect to the Database container using `localhost` when running inside Docker.

- **Solution**: I utilized Docker Compose's internal DNS.
  - Changed `DATABASE_URL` host from `localhost` to `db` (the name of the service in `docker-compose.yml`).

---

## 📚 Resources & Concepts Deployed

The following resources and engineering concepts were utilized to solve these problems:

1.  **System Design**:
    - **Pattern**: Monolithic Architecture (for MVP simplicity).
    - **Pattern**: Repository Pattern (abstracted via Prisma Client).
    - **Concept**: Polling vs. Event-Driven (Chose Polling/Cron for detection logic).

2.  **Documentation**:
    - **NestJS Docs**: For understanding `Guards`, `Interceptors`, and `Modules`.
    - **Prisma Docs**: For schema definition (`schema.prisma`) and error codes (`P2002`).
    - **Docker Docs**: For network bridging in Compose.

3.  **Tools**:
    - **Swagger UI**: To verify API contracts without building a Frontend.
    - **Postman/Curl**: For raw HTTP request testing.

---

## 🚀 Conclusion

This project demonstrates not just my coding ability, but **Systems Thinking**. By solving environment-specific issues (Windows locks) and architectural trade-offs (Monolith vs. Microservices), I delivered a robust, production-ready observability platform.
