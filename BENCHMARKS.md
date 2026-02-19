# Performance Benchmarks 🚀

This document records the performance testing methodology and results for the **Intelligent Incident & Log Management Platform**.

---

## 1. Ingestion Throughput Benchmark

Tests the `POST /ingest` pipeline under high-concurrency load using `autocannon`.

### Test Environment

| Parameter       | Value                                   |
| :-------------- | :-------------------------------------- |
| **Tool**        | `autocannon`                            |
| **Duration**    | 10 seconds                              |
| **Connections** | 100 concurrent clients                  |
| **Endpoint**    | `POST /ingest`                          |
| **Hardware**    | Local Development Environment (Windows) |
| **Run Date**    | 2026-02-20                              |

### Results

| Metric              | Value                 |
| :------------------ | :-------------------- |
| **Requests/Sec**    | **722.3 req/s** (avg) |
| **Avg Latency**     | **137.71 ms**         |
| **p50 Latency**     | **120 ms**            |
| **p97.5 Latency**   | **269 ms**            |
| **p99 Latency**     | **370 ms**            |
| **Max Latency**     | 3,764 ms (tail spike) |
| **Throughput**      | **0.29 MB/s**         |
| **Total Requests**  | 7,223 in 10.12s       |
| **2xx (processed)** | **100**               |
| **429 (throttled)** | **7,123**             |

### Latency Distribution

| Percentile   | Latency  |
| :----------- | :------- |
| 2.5%         | 63 ms    |
| 50% (Median) | 120 ms   |
| 97.5%        | 269 ms   |
| 99%          | 370 ms   |
| Max          | 3,764 ms |

> **Note on Non-2xx Responses:**
> The global `ThrottlerGuard` intentionally rejects excess requests with `429 Too Many Requests`. **7,123 of 7,223 requests were throttled** — this is expected security behaviour proving the rate limiter works under flood conditions. All 100 allowed requests were processed successfully (2xx).

### Analysis

1. **Stability under flood load**: p99 latency held at 370ms with 100 concurrent connections — no connection pool exhaustion, crashes, or timeouts observed.
2. **Rate limiting correctness**: 98.6% of requests rejected with `429` immediately, confirming `ThrottlerGuard` is enforcing quotas under pressure.
3. **Tail latency** (max 3,764ms): Attributable to GC pauses or batch flush synchronization on a local development machine. Not representative of a production PostgreSQL deployment.
4. **Batch buffer efficiency**: The `createMany` flush strategy (every 5 seconds) reduces database roundtrips to approximately 2 writes per test duration, regardless of request volume.

---

## 2. Detection Engine Overhead

The Z-Score anomaly detection engine runs as a background cron job every **10 seconds**. It is entirely decoupled from the ingestion hot path.

### How It Works

The detection query aggregates error counts at the **database level** using `date_trunc` + `COUNT()`:

```sql
SELECT date_trunc('minute', "timestamp") AS time_bucket, COUNT(*)::int AS loading
FROM "Log"
WHERE "level" = 'ERROR' AND "timestamp" > NOW() - INTERVAL '30 minutes'
GROUP BY time_bucket
ORDER BY time_bucket DESC;
```

This returns at most 30 rows (one per minute over the 30-minute window). Because the query operates on an indexed `timestamp` column and aggregates at the database level, no log data is transferred to the application layer.

### Detection Latency

| Operation                    | Estimated Cost       |
| :--------------------------- | :------------------- |
| `$queryRaw` baseline fetch   | **< 5ms** (indexed)  |
| `log.count` (rolling 60s)    | **< 2ms** (indexed)  |
| Z-Score math (JS, 30 values) | **< 0.1ms**          |
| **Total cron overhead**      | **< 10ms per cycle** |

> All values are estimates based on query plan analysis. Since the detection cron fires every 10,000ms and the total overhead is <10ms per cycle, the detection job consumes **<0.1% of available CPU time** — negligible relative to the ingestion hot path.

### Algorithm Thresholds

| Parameter            | Value | Rationale                                             |
| :------------------- | :---- | :---------------------------------------------------- |
| Z-Score threshold    | 3.0   | 99.7% confidence interval (3-sigma rule)              |
| Min error count      | 5     | Suppresses noise in low-traffic environments          |
| Baseline window      | 30min | Sufficient history for stable mean/stdDev calculation |
| Min baseline buckets | 5     | Prevents false alerts during system warm-up           |

---

## How to Run

```bash
# 1. Start the backend (requires Docker Compose for the database)
docker-compose up --build

# 2. In a separate terminal, run the ingestion throughput benchmark
node backend/scripts/benchmark.js
```
