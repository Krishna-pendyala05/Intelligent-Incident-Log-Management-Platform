# Intelligent Incident & Log Management Platform 🛡️

> **A High-Performance Backend System for Log Ingestion & Automated Incident Response.**

[![CI](https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform/actions)
![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)

---

## 🎯 System Overview

**Intelligent Incident & Log Management Platform** is a high-performance backend designed to emulate core observability patterns found in enterprise-grade systems.

It bridges the gap between raw log ingestion and automated incident response, focusing on **scalability**, **security**, and **reliability**.

### 🧠 Why "Intelligent"?

Unlike passive log storage (e.g., standard ELK stacks), this system is **active**. It runs a background **Anomaly Detection Engine** that monitors log streams in real-time. If it detects critical patterns (like a sudden spike in 500-series errors), it **automatically correlates them into an Incident** and alerts the team, reducing Mean Time To Resolution (MTTR).

### 🚀 Engineering Highlights

- **High-Throughput Engineering**: Implemented **Batch Processing** buffers to handle thousands of logs per second without crashing the database.
- **Database Optimization**: Solved **N+1 Query** performance issues and implemented **Pagination** for scalable data retrieval.
- **DevOps Lifecycle**: Built a **Multi-Stage Dockerfile** (reducing image size) and set up **GitHub Actions CI** for automated testing.
- **Security Best Practices**: Implemented **JWT Authentication**, **Rate Limiting**, and secure password hashing.

---

## 📚 Documentation Map

To keep things organized, I've separated the documentation:

| Document                                                  | Purpose                                                                                                                               |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **[Backend Setup Guide](./backend/README.md)**            | Technical manual. How to run, test, and use the API locally.                                                                          |
| **[Implementation Journey](./IMPLEMENTATION_JOURNEY.md)** | **Deep Dive**. A diary of the engineering challenges I faced (e.g., _Fixing N+1 Queries_, _Docker Networking_) and how I solved them. |

---

## 🛠️ Architecture Overview

The system allows services to send logs via HTTP. It aggregates them, checks for critical patterns (like high error rates), and automatically creates Incidents for the DevOps team.

![System Architecture](assets/architecture.png)

### Tech Stack

- **Core**: NestJS (Node.js) + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **DevOps**: Docker Compose + GitHub Actions

---

## ⚡ Quick Start

You can spin up the entire system (Backend + Database) with a single command using Docker.

```bash
# Clone the repository
git clone https://github.com/Krishna-pendyala05/Intelligent-Incident-Log-Management-Platform.git
cd "Intelligent Incident & Log Management Platform"

# Start services
docker-compose up --build
```

### 🎮 Want to play with it?

Run the interactive demo script to simulate traffic and incidents:

```bash
cd backend
yarn install
yarn demo
```

- **API URL**: `http://localhost:3000`
- **Swagger Docs**: `http://localhost:3000/api`

---

## 🔧 Troubleshooting & Common Issues

### 1. "Docker Error: error during connect..."

**Error:** `error during connect: This error may indicate that the docker daemon is not running.`

- **Cause:** Docker Desktop is not started.
- **Solution:** Open **Docker Desktop** on your machine and wait for the engine to start (green icon). Then run `docker-compose up` again.

### 2. "Port 3000/5432 already in use"

**Error:** `Bind for 0.0.0.0:3000 failed: port is already allocated`

- **Cause:** Another application (or a previous instance of this app) is using these ports.
- **Solution:**
  - **Windows**: `npx kill-port 3000 5432`
  - **Mac/Linux**: `lsof -i :3000` then `kill -9 <PID>`
  - **Docker**: Run `docker-compose down` to clean up old containers.

### 3. "Prisma Client not initialized"

**Error:** `Invalid 'prisma.user.create()'`

- **Cause:** The database schema changed but the client wasn't updated.
- **Solution:**
  ```bash
  cd backend
  npx prisma generate
  ```

---

## 👤 Author

**Murali Krishna Pendyala**  
_Software Engineer_  
[LinkedIn](https://linkedin.com/in/your-profile) | [GitHub](https://github.com/Krishna-pendyala05)
