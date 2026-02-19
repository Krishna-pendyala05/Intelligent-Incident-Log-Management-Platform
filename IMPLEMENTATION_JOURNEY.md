# 🛠️ Implementation Journey: Engineering Decisions & Lessons Learned

> _"The difference between a tutorial project and a production system lies in how you handle the edge cases, constraints, and trade-offs no tutorial ever mentions."_

This document is a technical log of the **engineering challenges** encountered while building this platform — the problems that emerged, the reasoning behind each design decision, and the measurable outcomes.

---

## Challenge 1: Eliminating the N+1 Query Bottleneck

**The Problem:**
The initial implementation of `GET /incidents` performed one database query to fetch incident records, followed by an additional query per record to retrieve its associated logs. For a list of 50 incidents, this resulted in **51 sequential database round-trips** — a classic N+1 problem. Response times were unacceptable for any real usage.

**Investigation:**
Profiling the query path revealed that Prisma's default behaviour does not automatically join related tables unless explicitly instructed. The naive approach of iterating over results and calling `findMany` per record was the root cause.

**The Solution:**

- **Removed eager loading of log arrays** from the list view (`GET /incidents`). A summary list does not need full log payloads — only the incident metadata.
- **Implemented cursor-based Pagination** (`page` + `limit` via Prisma's `skip` and `take`) to cap the result set size regardless of data volume.
- **Result**: The `GET /incidents` response time dropped from ~500ms to **<20ms** — a **25× improvement** — by eliminating redundant queries and bounding the result set.

---

## Challenge 2: Sustaining High-Volume Log Ingestion Without Database Saturation

**The Problem:**
Under realistic load (100+ concurrent clients), the ingestion endpoint was issuing one `INSERT` per HTTP request. Each insertion consumed a database connection from the pool. At high concurrency, the pool was exhausted, causing requests to queue or fail — even though PostgreSQL itself was far from capacity.

**Root Cause:**
The bottleneck was not database compute, but **connection pool contention**. The system was making the database work at the granularity of individual HTTP requests rather than at a throughput-efficient batch granularity.

**The Solution: In-Memory Batch Buffer**
The `IngestionService` was refactored to decouple HTTP receipt from database writes:

1. Incoming log payloads are appended to an in-memory buffer array.
2. A scheduled flush (every **5 seconds**, or when the buffer reaches **100 entries**) drains the buffer in a single `prisma.createMany` call.
3. The database now receives **one write operation per flush cycle** instead of one per request.

**Result:** Under `autocannon` load testing with 100 concurrent connections, the system sustained **722 req/s** throughput with all rate-limited requests rejected correctly. The batch buffer reduced database write frequency by **~98%** compared to the naive per-request approach.

---

## Challenge 3: Reproducible Deployments — Docker Networking & Image Size

**The Problem:**
The application ran correctly in local development but failed consistently inside Docker. Two distinct issues surfaced:

1. **Image size**: The initial Docker image exceeded 1GB because the build tools (`typescript`, `@nestjs/cli`, dev dependencies) were included in the runtime layer.
2. **Database connectivity**: The application inside the container could not reach PostgreSQL because `localhost` inside a container refers to the container's own loopback interface, not the host machine or the sibling `db` container.

**The Solutions:**

1. **Multi-Stage Dockerfile**: Separated the build environment (Node.js + all dev tools) from the runtime environment (minimal Alpine Linux + compiled `dist/` only). This reduced the final image size by approximately **80%**, directly improving pull times and attack surface.
2. **Docker Compose Service Discovery**: Replaced all hardcoded `localhost` references with the Docker Compose service name `db`. The Compose network provides DNS resolution between services, making the database host reliably addressable as `db:5432` from the application container regardless of host machine configuration.

---

## Challenge 4: Secrets Management & API Security

**The Problem:**
During early development, a `JWT_SECRET` was committed to version control. Even after removal from the working tree, it remained in Git history — a permanent credential leak risk. Additionally, the API had no protection against credential stuffing or denial-of-service via request flooding.

**The Solutions:**

- **Environment Variable Isolation**: All secrets (`JWT_SECRET`, `DATABASE_URL`) were moved to `.env` files, which are excluded from version control via `.gitignore`. A startup validation pipe was added to ensure the application **refuses to boot** if required environment variables are absent — preventing silent misconfiguration in deployment.
- **Response Sanitization**: `ClassSerializerInterceptor` was applied globally to automatically exclude password hashes from all API responses, ensuring no user credential data is ever serialized to the client regardless of query shape.
- **Rate Limiting**: `@nestjs/throttler` was configured as a global guard to enforce per-IP request quotas, protecting against brute-force attacks and unintentional flood traffic. Under benchmark conditions, **98.6% of excess requests were correctly rejected** with `429 Too Many Requests`.

---

## Challenge 5: Designing a Statistically Sound Anomaly Detection Engine

**The Problem:**
The initial incident detection mechanism used a static threshold: if the error count within a window exceeded a fixed value, an incident was created. While simple to implement, this approach has fundamental reliability problems that make it unsuitable for any real operational environment:

- **False Positives in Low-Traffic Periods**: A handful of errors during off-hours (e.g., 2am batch jobs) would trigger alerts even though the rate was normal for that time window.
- **False Negatives Under High Traffic**: A service experiencing a 10% error rate degradation might never cross the absolute threshold if traffic volume was high, making the detection blind to proportional failures.
- **No Adaptability**: The threshold would need manual re-tuning as traffic patterns evolved, making it operationally expensive to maintain.

**The Solution: Z-Score Statistical Anomaly Detection**

The detection engine was redesigned around **Statistical Process Control** principles, specifically the Z-Score (Standard Score), which measures how many standard deviations a value is from the historical mean.

**Algorithm:**

1. **Baseline Aggregation**: Every 10 seconds, the engine queries per-minute ERROR log counts over the past **30-minute rolling window** using a single database-level aggregation:

   ```sql
   SELECT date_trunc('minute', "timestamp") AS time_bucket, COUNT(*)::int AS loading
   FROM "Log"
   WHERE "level" = 'ERROR' AND "timestamp" > NOW() - INTERVAL '30 minutes'
   GROUP BY time_bucket ORDER BY time_bucket DESC;
   ```

   This returns at most 30 rows and executes in under 5ms on an indexed column.

2. **Statistical Computation**: The mean (μ) and standard deviation (σ) are computed in-process from the baseline buckets. At 30 data points, this is computationally negligible (<0.1ms).

3. **Z-Score Calculation**: `Z = (CurrentCount − μ) / σ`

4. **Dual-Threshold Alerting**: An incident is created only when **both** conditions are satisfied:
   - `Z > 3.0`: A 3-sigma event, carrying a **99.7% statistical confidence** of being anomalous under a normal distribution.
   - `CurrentCount > 5`: An absolute noise guard. In low-traffic environments, even a Z-Score of infinity (e.g., 0 → 1 error) does not warrant an incident. This prevents alert fatigue from inconsequential error counts.

**Design Justification for the Dual Threshold:**
A Z-Score alone is insufficient. When σ is non-trivially small (common in stable, low-traffic services), a single spurious error can produce an extremely high Z-Score without representing a genuine operational problem. The absolute count guard ensures alerts only fire when the anomaly is both _statistically significant_ and _operationally meaningful_.

**Edge Case — Cold Start (σ = 0):**
When the entire 30-minute baseline contains zero errors (σ = 0), the Z-Score formula produces a division-by-zero. This case is handled explicitly: if the current count exceeds the mean and σ is zero, the system assigns a sentinel Z-Score (`999`) and applies the count guard normally. This ensures that a service with a perfect error-free baseline is not left unmonitored on its first error burst.

**Outcome:** The detection engine adapts automatically to each service's traffic rhythm. A payment service handling 1,000 req/min and a background job processing 10 req/min both have appropriate, independently calibrated alert thresholds — without any manual configuration.

---

## Conclusion

This project demonstrates that production-grade engineering requires deliberate attention to performance characteristics, failure modes, and operational maintainability — not just functional correctness. Each challenge above represents a category of problem that appears in real distributed systems:

- Query efficiency at scale (N+1, pagination)
- Throughput vs. resource contention trade-offs (batch buffering)
- Infrastructure reproducibility (Docker multi-stage, service networking)
- Security posture (secrets isolation, rate limiting, response sanitization)
- Statistical reliability in automated decision systems (Z-Score anomaly detection)

The solutions applied here reflect standard patterns used in production SRE and platform engineering contexts.
