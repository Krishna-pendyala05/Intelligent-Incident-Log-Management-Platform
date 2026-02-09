# Intelligent Incident & Log Management Platform

> **"Silence is Deadly."**  
> A centralized observability engine designed to ingest logs, detect anomalies in real-time, and automate incident response for distributed systems.

🔍 **Curious about how this was built?** Check out the [Implementation Journey & Engineering Decisions](./IMPLEMENTATION_JOURNEY.md) for a deep dive into the code and challenges.

---

## 🧐 The Problem: Why This Exists

In modern distributed architectures (microservices), visibility is often the first casualty.

- **Logs are Scattered**: Debugging requires SSH-ing into multiple servers or sifting through text files.
- **Delayed Detection**: Engineering teams often find out about outages from angry users on Twitter before their own systems alert them.
- **Manual Response**: Creating incident tickets and linking them to root cause logs is a manual, error-prone process.

**The Stakeholders**:

- **DevOps & SREs**: Need immediate alerts and a paper trail for post-mortems.
- **Product Developers**: Need a simple API to send logs to without configuring complex agents.
- **Compliance Teams**: Require strict meaningful logs and incident lifecycles.

## 💡 The Solution

This platform bridges the gap between **Log Aggregation** and **Incident Management**. Instead of just storing logs, it _understands_ them.

**Core Philosophy**:

1.  **Centralize**: One API (`POST /ingest`) for all services.
2.  **Automate**: A background detection engine watches for patterns (e.g., "High Error Rate") and acts immediately.
3.  **Secure**: Strict JWT authentication ensures that only authorized personnel can manage critical incident data.

---

## 🏗️ Architecture

The system is built as a robust Monolithic Service for reliability and ease of deployment, orchestrated via Docker.

![System Architecture](assets/architecture.png)

## 🛠️ Tech Stack & Motivation

| Component         | Technology            | Why this choice?                                                                                                        |
| :---------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Framework**     | **NestJS** (Node.js)  | Specific architecture patterns (Modules, Guards, Pipes) ensure scalability and maintainability compared to raw Express. |
| **Language**      | **TypeScript**        | Strict typing prevents runtime errors and ensures valid DTOs at the compiled level.                                     |
| **Database**      | **PostgreSQL 16**     | ACID compliance is non-negotiable for audit logs and incident records.                                                  |
| **ORM**           | **Prisma**            | Provides type-safe database queries and automated migrations, reducing SQL boilerplate.                                 |
| **Security**      | **Passport + JWT**    | Industry-standard stateless authentication for secure API access.                                                       |
| **Documentation** | **Swagger (OpenAPI)** | Auto-generated, interactive documentation makes onboarding new developers instant.                                      |
| **DevOps**        | **Docker Compose**    | One command (`docker-compose up`) sets up the entire stack (App + DB) identically on any machine.                       |

---

## 🚀 Getting Started

### Prerequisites

- **Docker Desktop** (Recommended)
- **Node.js v18+** & **Yarn** (If running locally)

### Option A: Run with Docker (Recommended)

This will spin up both the **Backend** and the **PostgreSQL** database.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd "Intelligent Incident & Log Management Platform"

# 2. Start services
docker-compose up --build
```

**Access the App**:

- **API**: `http://localhost:3000`
- **Swagger Docs**: `http://localhost:3000/api`

### Option B: Run Locally (Dev Mode)

If you want to develop or debug the code.

```bash
cd backend

# 1. Install dependencies
yarn install

# 2. Start only the Database via Docker
docker-compose up db -d

# 3. Generate Prisma Client
npx prisma generate

# 4. Start the Server
yarn start:dev
```

**Local URL**: `http://localhost:3001` (Note: Local dev sometimes defaults to 3001 to avoid conflicts)

---

## 🧠 Challenges & Key Learnings

During the development of this platform, I encountered and solved several engineering challenges:

1.  **Handling Duplicate User Creation**:
    - _Challenge_: Prisma throws a generic `P2002` error when a user email already exists, causing a 500 server crash.
    - _Solution_: Intercepted the specific error code in the Service layer and transformed it into a meaningful **409 Conflict** exception for the client.

2.  **Concurrency & File Locks**:
    - _Challenge_: Windows file locking (`EPERM`) prevented `prisma generate` from running while the server was active.
    - _Solution_: Established a workflow to strictly terminate node processes before regenerating the database client.

3.  **Type-Safe APIs**:
    - _Challenge_: Ensuring incoming Logs match the strict schema required for analysis.
    - _Solution_: leveraged `class-validator` and DTOs to automatically reject malformed requests before they touch the logic layer.

---

## 🔧 Common Issues & Troubleshooting

**Q: I get `EADDRINUSE: :::3000` when starting.**
A: Another service is using port 3000. The app will try to fallback or fail.

- _Fix_: Run `npx kill-port 3000` or check your running Docker containers.

**Q: Swagger UI says "Failed to fetch".**
A: This is usually a CORS issue or the server is down.

- _Fix_: I enabled generic CORS in `main.ts`, but ensure your browser isn't blocking local requests.

**Q: "Invalid `this.prisma.user.create()` invocation".**
A: This usually means the Prisma Client is out of sync with the schema.

- _Fix_: Stop the server and run `npx prisma generate`.

---

## 🎨 Customization & Usage Guide

Want to adapt this platform for your own needs? Here are the key files you can modify:

### 1. Adjusting Incident Thresholds

By default, the system triggers an incident if **> 5 errors** occur in **60 seconds**.

- **File**: `backend/src/incidents/detection.service.ts`
- **How to Change**:

  ```typescript
  // Change the time window (e.g., 5 minutes)
  const timeWindow = new Date(Date.now() - 5 * 60 * 1000);

  // Change the error count threshold
  if (recentErrorCount > 20) { ... }
  ```

### 2. Changing Database Connection

- **File**: `backend/.env`
- **Parameter**: `DATABASE_URL`
  - Update the user, password, port, or DB name here.
  - _Note_: If you change the port here, make sure to update `docker-compose.yml` as well.

### 3. Adding New Log Metadata

- **File**: `backend/src/ingestion/dto/create-log.dto.ts`
- **Action**: Add new fields to the `CreateLogDto` class to validate extra data (e.g., `user_id`, `request_id`) in your incoming logs.

---

## 🔮 Future Roadmap

- [ ] **Real-time WebSockets**: Push alerts to the frontend immediately instead of polling.
- [ ] **Slack Integration**: Webhook support to post incidents directly to team channels.
- [ ] **AI Analysis**: Use an LLM to summarize log patterns and suggest root causes.

---

_Built with Sincerity by Murali Krishna Pendyala_
