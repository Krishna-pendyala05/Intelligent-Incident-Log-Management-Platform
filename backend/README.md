# 🔧 Backend API Service

This directory contains the **NestJS** application that powers the Intelligent Incident & Log Management Platform.

> **Note**: For the full system architecture, implementation details, and Docker instructions, please refer to the [Root README](../README.md).

---

## 🏃‍♂️ Quick Start (Local Development)

If you are running the backend in isolation (without Docker Compose), follow these steps:

### 1. Environment Setup

Ensure you have a PostgreSQL database running. You can start just the DB via Docker:

```bash
docker-compose up db -d
```

Update your `.env` file in this directory to matches your local DB credentials.

### 2. Install Dependencies

```bash
yarn install
```

### 3. Database Migration

Generate the Prisma Client to ensure type-safety matches your schema:

```bash
npx prisma generate
```

(Optional) Push schema changes to DB:

```bash
npx prisma db push
```

### 4. Run the Server

```bash
# Watch mode (Recommended for dev)
yarn start:dev

# Production build
yarn build
yarn start:prod
```

The API will be available at `http://localhost:3001` (or port 3000, depending on generic fallback).

---

## 🧪 Testing

I have included unit and e2e tests for critical flows.

```bash
# Unit tests
yarn test

# End-to-end tests
yarn test:e2e
```

## 📂 Project Structure

- `src/ingestion`: Module for `POST /ingest` log collection.
- `src/incidents`: Module for Incident management and Detection Logic (Cron).
- `src/auth`: JWT Authentication strategy and guards.
- `src/users`: User management.
- `prisma/schema.prisma`: Database schema definition.
