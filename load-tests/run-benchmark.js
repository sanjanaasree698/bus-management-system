const http = require('http');
const fs = require('fs');
const path = require('path');

const TARGET_HOST = 'localhost';
const TARGET_PORT = 8081;
const PATHS = ['/', '/login', '/routes'];
const CONCURRENCY = 100;
const DURATION_MS = 60000; // 1 minute

console.log(`🚀 Starting load test against http://${TARGET_HOST}:${TARGET_PORT}...`);
console.log(`⚙️ Concurrency: ${CONCURRENCY} Virtual Users | Duration: 60s`);

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const latencies = [];

const startTime = Date.now();
let activeWorkers = 0;
let isRunning = true;

function sendRequest(workerId) {
  if (!isRunning) return;

  const targetPath = PATHS[Math.floor(Math.random() * PATHS.length)];
  const reqStart = Date.now();

  const req = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: targetPath,
      method: 'GET',
      timeout: 5000,
    },
    (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const latency = Date.now() - reqStart;
        latencies.push(latency);
        totalRequests++;
        if (res.statusCode >= 200 && res.statusCode < 500) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        if (isRunning) setImmediate(() => sendRequest(workerId));
      });
    }
  );

  req.on('error', (err) => {
    const latency = Date.now() - reqStart;
    latencies.push(latency);
    totalRequests++;
    failedRequests++;
    if (isRunning) setTimeout(() => sendRequest(workerId), 100);
  });

  req.on('timeout', () => {
    req.destroy();
  });

  req.end();
}

// Spawn virtual users
for (let i = 0; i < CONCURRENCY; i++) {
  sendRequest(i);
}

// Stop after DURATION_MS
setTimeout(() => {
  isRunning = false;
  const totalDurationSec = (Date.now() - startTime) / 1000;

  latencies.sort((a, b) => a - b);
  const minLatency = latencies.length ? latencies[0] : 0;
  const maxLatency = latencies.length ? latencies[latencies.length - 1] : 0;
  const avgLatency = latencies.length
    ? (latencies.reduce((sum, l) => sum + l, 0) / latencies.length).toFixed(2)
    : 0;
  const rps = (totalRequests / totalDurationSec).toFixed(2);

  const report = `# 📈 Load Testing Baseline Summary

## ⚙️ Test Parameters
- **Target URL**: \`http://${TARGET_HOST}:${TARGET_PORT}\`
- **Concurrent Virtual Users**: \`${CONCURRENCY}\`
- **Test Duration**: \`${totalDurationSec.toFixed(1)} seconds\`
- **Tested User Flows**: \`/\`, \`/login\`, \`/routes\`

---

## 📊 Performance Metrics

| Metric | Value |
| --- | --- |
| **Total Requests** | \`${totalRequests}\` |
| **Requests Per Second (RPS)** | \`${rps} req/sec\` |
| **Average Response Time** | \`${avgLatency} ms\` |
| **Minimum Response Time** | \`${minLatency} ms\` |
| **Maximum Response Time** | \`${maxLatency} ms\` |
| **Successful Responses** | \`${successfulRequests}\` |
| **Failed Requests** | \`${failedRequests}\` |

---

> Generated automatically on ${new Date().toISOString()}
`;

  const summaryPath = path.join(__dirname, 'summary.md');
  fs.writeFileSync(summaryPath, report, 'utf8');

  console.log('\n====================================');
  console.log('✅ Load Test Completed!');
  console.log(`RPS: ${rps}`);
  console.log(`Latency: Avg ${avgLatency}ms | Min ${minLatency}ms | Max ${maxLatency}ms`);
  console.log(`Summary report written to: ${summaryPath}`);
  console.log('====================================\n');
  process.exit(0);
}, DURATION_MS);
