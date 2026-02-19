import axios from 'axios';

const PORT = 3000;
const URL = `http://localhost:${PORT}`;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
};

const log = (msg: string, color: string = colors.reset) => {
  console.log(`${color}${msg}${colors.reset}`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDemo() {
  log(`\n🚀 STARTING PORTFOLIO DEMO SCENARIO`, colors.bright + colors.cyan);
  log(`Target: ${URL}\n`, colors.cyan);
  log(`Detection Engine: Z-Score Statistical Anomaly Detection (3-sigma threshold)`, colors.cyan);

  // ─── 1. Authentication ──────────────────────────────────────────────────────
  let token: string | null = null;
  const uniqueId = Math.floor(Math.random() * 10000);
  const userEmail = `recruiter${uniqueId}@demo.com`;
  const userPass = 'DemoPass123!';

  try {
    log(`\n[1/4] 🔐 Authenticating as ${userEmail}...`, colors.yellow);

    try {
      await axios.post(`${URL}/users`, { email: userEmail, password: userPass });
      log(`  ✓ Registered new user`, colors.green);
    } catch (e: any) {
      if (e.response?.status === 409) {
        log(`  ℹ User already exists, proceeding to login`, colors.yellow);
      } else {
        throw e;
      }
    }

    const loginRes = await axios.post(`${URL}/auth/login`, {
      email: userEmail,
      password: userPass,
    });
    token = loginRes.data.access_token;
    if (!token) throw new Error('No access token received');
    log(`  ✓ Login successful. JWT received.`, colors.green);
  } catch (error: any) {
    log(`❌ Auth Failed: ${error.message}`, colors.red);
    if (error.response) {
      log(`  Status: ${error.response.status}`, colors.red);
      console.log(error.response.data);
    }
    process.exit(1);
  }

  // ─── 2. Normal Traffic — Establishes Baseline ──────────────────────────────
  try {
    log(
      `\n[2/4] 🟢 Simulating Normal Traffic (building Z-Score baseline)...`,
      colors.yellow,
    );
    log(`  Sending INFO logs — these will form the "normal" baseline.`, colors.cyan);

    const services = ['payment-service', 'user-service', 'notification-service'];
    for (let i = 0; i < 10; i++) {
      const service = services[Math.floor(Math.random() * services.length)];
      await axios.post(`${URL}/ingest`, {
        service_id: service,
        level: 'INFO',
        message: `Processed request ${i} successfully`,
        metadata: { duration_ms: Math.random() * 100 },
        timestamp: new Date().toISOString(),
      });
      process.stdout.write('.');
      await sleep(200);
    }
    log(`\n  ✓ Sent 10 normal logs. Baseline established. No incident expected.`, colors.green);
  } catch (error: any) {
    log(`❌ Normal traffic ingestion failed: ${error.message}`, colors.red);
  }

  // ─── 3. Anomaly Simulation — The Z-Score Trigger ────────────────────────────
  log(
    `\n[3/4] 💥 SIMULATING 3-SIGMA ANOMALY (Triggering Z-Score Detection)`,
    colors.bgRed + colors.bright,
  );
  log(`  Sending 20 ERROR logs in rapid succession...`, colors.red);
  log(`  This will produce Z > 3.0, breaching the anomaly threshold.`, colors.cyan);

  try {
    const burstSize = 20; // Well above the MIN_ERROR_COUNT guard (5)
    for (let i = 0; i < burstSize; i++) {
      await axios.post(`${URL}/ingest`, {
        service_id: 'payment-service',
        level: 'ERROR',
        message: `CRITICAL: Database connection pool exhausted — attempt ${i}`,
        metadata: { error_code: 'ECONNRESET', attempt: i },
        timestamp: new Date().toISOString(),
      });
      process.stdout.write('x');
    }
    log(
      `\n  ✓ Burst of ${burstSize} errors sent. Waiting for Z-Score engine to detect anomaly...`,
      colors.yellow,
    );
    log(`  (Detection cron runs every 10 seconds)`, colors.cyan);
  } catch (error: any) {
    log(`❌ Error burst failed: ${error.message}`, colors.red);
  }

  // ─── 4. Verification — Polling for Created Incident ────────────────────────
  log(`\n[4/4] 🕵️  Verifying Incident Auto-Creation...`, colors.yellow);
  const maxRetries = 15; // 30s max wait window
  let found = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await axios.get(`${URL}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // API returns paginated response: { data: [...], meta: { total, page, ... } }
      const incidents = res.data.data as Array<{ id: string; title: string; severity: string; status: string }>;
      const anomalyIncident = incidents.find(
        (inc) => inc.status === 'OPEN' && inc.title.includes('Anomaly Detected'),
      );

      if (anomalyIncident) {
        log(`\n✅ SUCCESS! Statistical anomaly auto-detected and incident created.`, colors.bright + colors.green);
        log(`  Incident ID: ${anomalyIncident.id}`, colors.cyan);
        log(`  Title:       ${anomalyIncident.title}`, colors.cyan);
        log(`  Severity:    ${anomalyIncident.severity}`, colors.red);
        found = true;
        break;
      }
    } catch (e: any) {
      if (i === maxRetries - 1) log(`  Polling error: ${e.message}`, colors.red);
    }

    process.stdout.write('.');
    await sleep(2000);
  }

  if (!found) {
    log(`\n❌ No incident detected within the expected time window.`, colors.red);
    log(`  Possible reasons: Not enough baseline data yet (need 5+ error minutes), or cron is delayed.`, colors.yellow);
    log(`  Tip: Run the demo again after ~2 minutes to allow the baseline to accumulate.`, colors.cyan);
  } else {
    log(`\n✨ DEMO COMPLETE. The Z-Score Anomaly Detection engine works as intended.`, colors.bright + colors.green);
    log(`  Swagger UI: http://localhost:${PORT}/api`, colors.cyan);
  }
}

runDemo();
