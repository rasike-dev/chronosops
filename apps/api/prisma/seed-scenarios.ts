import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env file (same logic as PrismaService)
const cwd = process.cwd();
const rootEnv = resolve(cwd, '../../.env');
const localEnv = resolve(cwd, '../.env');

if (existsSync(rootEnv)) {
  config({ path: rootEnv });
} else if (existsSync(localEnv)) {
  config({ path: localEnv });
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Please ensure it\'s defined in your .env file.');
  process.exit(1);
}

// Initialize PrismaClient with adapter (same as PrismaService)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Generate metrics for a scenario
 */
function generateMetrics(params: {
  startTime: Date;
  deployTime: Date;
  serviceId: string;
  beforeLatency: number;
  afterLatency: number;
  beforeErrorRate: number;
  afterErrorRate: number;
  baseRps: number;
  minutes: number;
}): any[] {
  const metrics: any[] = [];
  const { startTime, deployTime, serviceId, beforeLatency, afterLatency, beforeErrorRate, afterErrorRate, baseRps, minutes } = params;

  for (let i = 0; i <= minutes; i++) {
    const t = new Date(startTime.getTime() + i * 60_000);
    const isBefore = t < deployTime;
    const minutesAfterDeploy = Math.max(0, (t.getTime() - deployTime.getTime()) / 60_000);

    // Latency: gradual increase before, spike after
    const p95 = isBefore
      ? beforeLatency + i * 2
      : afterLatency + minutesAfterDeploy * 15;

    // Error rate: stable before, spike after
    const err = isBefore
      ? beforeErrorRate + i * 0.0001
      : afterErrorRate + minutesAfterDeploy * 0.0006;

    // RPS: slight variation
    const rps = baseRps + ((i % 5) - 2) * 1.2;

    metrics.push(
      { serviceId, metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
      { serviceId, metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
      { serviceId, metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
    );
  }

  return metrics;
}

async function main() {
  console.log('🌱 Seeding scenarios...');

  const scenarios = [
    // 1. Latency Spike
    {
      scenarioId: 'latency-spike',
      title: 'Production latency spike after deployment',
      description: 'p95 latency and error rate increase within minutes after a deployment. Classic deployment regression scenario.',
      deploymentId: 'dep_001',
      serviceId: 'checkout-api',
      versionFrom: '1.8.2',
      versionTo: '1.8.3',
      deploymentTimestamp: new Date('2026-01-01T13:12:00.000Z'),
      startTime: new Date('2026-01-01T13:00:00.000Z'),
      metrics: generateMetrics({
        startTime: new Date('2026-01-01T13:00:00.000Z'),
        deployTime: new Date('2026-01-01T13:12:00.000Z'),
        serviceId: 'checkout-api',
        beforeLatency: 220,
        afterLatency: 700,
        beforeErrorRate: 0.004,
        afterErrorRate: 0.028,
        baseRps: 120,
        minutes: 30,
      }),
      tags: ['latency', 'deployment', 'production', 'regression'],
      category: 'latency',
      severity: 'high',
    },

    // 2. Error Spike Config
    {
      scenarioId: 'error-spike-config',
      title: 'Error spike after config change',
      description: 'A config change causes auth-api error rate to spike while latency remains mostly stable. Configuration regression.',
      deploymentId: 'dep_002',
      serviceId: 'auth-api',
      versionFrom: '2.3.0',
      versionTo: '2.3.0+config',
      deploymentTimestamp: new Date('2026-01-01T15:05:00.000Z'),
      startTime: new Date('2026-01-01T14:45:00.000Z'),
      metrics: generateMetrics({
        startTime: new Date('2026-01-01T14:45:00.000Z'),
        deployTime: new Date('2026-01-01T15:05:00.000Z'),
        serviceId: 'auth-api',
        beforeLatency: 240,
        afterLatency: 260,
        beforeErrorRate: 0.006,
        afterErrorRate: 0.045,
        baseRps: 140,
        minutes: 30,
      }),
      tags: ['errors', 'config', 'auth', 'production'],
      category: 'errors',
      severity: 'critical',
    },

    // 3. Gradual Degradation
    {
      scenarioId: 'gradual-degradation',
      title: 'Gradual performance degradation over time',
      description: 'Slow memory leak or resource exhaustion causing gradual latency increase over 2 hours. Capacity issue.',
      deploymentId: 'dep_003',
      serviceId: 'payment-service',
      versionFrom: '3.1.0',
      versionTo: '3.1.0',
      deploymentTimestamp: new Date('2026-01-02T10:00:00.000Z'),
      startTime: new Date('2026-01-02T08:00:00.000Z'),
      metrics: (() => {
        const metrics: any[] = [];
        const start = new Date('2026-01-02T08:00:00.000Z');
        for (let i = 0; i <= 120; i++) {
          const t = new Date(start.getTime() + i * 60_000);
          const p95 = 200 + i * 3; // Gradual increase
          const err = 0.001 + i * 0.0001;
          const rps = 200 + ((i % 10) - 5) * 2;
          metrics.push(
            { serviceId: 'payment-service', metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
            { serviceId: 'payment-service', metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
            { serviceId: 'payment-service', metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
          );
        }
        return metrics;
      })(),
      tags: ['latency', 'capacity', 'memory', 'gradual'],
      category: 'latency',
      severity: 'medium',
    },

    // 4. Database Connection Pool Exhaustion
    {
      scenarioId: 'db-pool-exhaustion',
      title: 'Database connection pool exhaustion',
      description: 'Connection pool reaches 100% capacity causing timeouts and errors. Database bottleneck.',
      deploymentId: 'dep_004',
      serviceId: 'order-service',
      versionFrom: '2.5.1',
      versionTo: '2.5.2',
      deploymentTimestamp: new Date('2026-01-03T14:30:00.000Z'),
      startTime: new Date('2026-01-03T14:15:00.000Z'),
      metrics: generateMetrics({
        startTime: new Date('2026-01-03T14:15:00.000Z'),
        deployTime: new Date('2026-01-03T14:30:00.000Z'),
        serviceId: 'order-service',
        beforeLatency: 180,
        afterLatency: 2500, // High latency due to timeouts
        beforeErrorRate: 0.002,
        afterErrorRate: 0.15, // High error rate
        baseRps: 80,
        minutes: 30,
      }),
      tags: ['database', 'timeout', 'connection-pool', 'critical'],
      category: 'errors',
      severity: 'critical',
    },

    // 5. Cache Miss Storm
    {
      scenarioId: 'cache-miss-storm',
      title: 'Cache miss storm after cache invalidation',
      description: 'Massive cache invalidation causes all requests to hit database, overwhelming backend. Cache dependency issue.',
      deploymentId: 'dep_005',
      serviceId: 'product-catalog',
      versionFrom: '1.2.0',
      versionTo: '1.2.1',
      deploymentTimestamp: new Date('2026-01-04T09:00:00.000Z'),
      startTime: new Date('2026-01-04T08:45:00.000Z'),
      metrics: generateMetrics({
        startTime: new Date('2026-01-04T08:45:00.000Z'),
        deployTime: new Date('2026-01-04T09:00:00.000Z'),
        serviceId: 'product-catalog',
        beforeLatency: 50,
        afterLatency: 800,
        beforeErrorRate: 0.001,
        afterErrorRate: 0.08,
        baseRps: 500,
        minutes: 30,
      }),
      tags: ['cache', 'database', 'latency', 'high-traffic'],
      category: 'latency',
      severity: 'high',
    },

    // 6. Network Partition
    {
      scenarioId: 'network-partition',
      title: 'Network partition causing service unavailability',
      description: 'Network issues between services cause cascading failures and timeouts. Infrastructure issue.',
      deploymentId: 'dep_006',
      serviceId: 'api-gateway',
      versionFrom: '4.0.0',
      versionTo: '4.0.0',
      deploymentTimestamp: new Date('2026-01-05T16:20:00.000Z'),
      startTime: new Date('2026-01-05T16:10:00.000Z'),
      metrics: (() => {
        const metrics: any[] = [];
        const start = new Date('2026-01-05T16:10:00.000Z');
        const partitionStart = new Date('2026-01-05T16:20:00.000Z');
        for (let i = 0; i <= 20; i++) {
          const t = new Date(start.getTime() + i * 60_000);
          const isPartitioned = t >= partitionStart;
          const p95 = isPartitioned ? 5000 : 150; // Extreme latency
          const err = isPartitioned ? 0.5 : 0.003; // 50% error rate
          const rps = isPartitioned ? 10 : 300; // Traffic drops
          metrics.push(
            { serviceId: 'api-gateway', metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
            { serviceId: 'api-gateway', metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
            { serviceId: 'api-gateway', metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
          );
        }
        return metrics;
      })(),
      tags: ['network', 'infrastructure', 'timeout', 'critical'],
      category: 'errors',
      severity: 'critical',
    },

    // 7. Rate Limiting Triggered
    {
      scenarioId: 'rate-limit-triggered',
      title: 'Rate limiting triggered by traffic spike',
      description: 'Sudden traffic spike triggers rate limiting, causing 429 errors and degraded user experience. Traffic anomaly.',
      deploymentId: 'dep_007',
      serviceId: 'user-api',
      versionFrom: '1.0.5',
      versionTo: '1.0.5',
      deploymentTimestamp: new Date('2026-01-06T11:00:00.000Z'),
      startTime: new Date('2026-01-06T10:50:00.000Z'),
      metrics: (() => {
        const metrics: any[] = [];
        const start = new Date('2026-01-06T10:50:00.000Z');
        const spikeStart = new Date('2026-01-06T11:00:00.000Z');
        for (let i = 0; i <= 20; i++) {
          const t = new Date(start.getTime() + i * 60_000);
          const isSpike = t >= spikeStart;
          const p95 = isSpike ? 1200 : 100; // Rate limit adds latency
          const err = isSpike ? 0.25 : 0.002; // 25% rate limit errors
          const rps = isSpike ? 1000 : 150; // Traffic spike
          metrics.push(
            { serviceId: 'user-api', metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
            { serviceId: 'user-api', metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
            { serviceId: 'user-api', metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
          );
        }
        return metrics;
      })(),
      tags: ['rate-limit', 'traffic', '429', 'throttling'],
      category: 'errors',
      severity: 'medium',
    },

    // 8. Memory Leak
    {
      scenarioId: 'memory-leak',
      title: 'Memory leak causing OOM kills',
      description: 'Gradual memory consumption increase leading to OOM kills and service restarts. Resource leak.',
      deploymentId: 'dep_008',
      serviceId: 'analytics-processor',
      versionFrom: '2.1.0',
      versionTo: '2.1.1',
      deploymentTimestamp: new Date('2026-01-07T08:00:00.000Z'),
      startTime: new Date('2026-01-07T07:00:00.000Z'),
      metrics: (() => {
        const metrics: any[] = [];
        const start = new Date('2026-01-07T07:00:00.000Z');
        for (let i = 0; i <= 60; i++) {
          const t = new Date(start.getTime() + i * 60_000);
          // Latency increases as memory pressure builds
          const p95 = 200 + i * 8;
          // Errors spike when OOM kills happen (every ~15 minutes)
          const err = (i % 15 === 0 && i > 0) ? 0.1 : 0.005;
          const rps = 50 + ((i % 5) - 2) * 1;
          metrics.push(
            { serviceId: 'analytics-processor', metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
            { serviceId: 'analytics-processor', metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
            { serviceId: 'analytics-processor', metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
          );
        }
        return metrics;
      })(),
      tags: ['memory', 'oom', 'resource-leak', 'gradual'],
      category: 'latency',
      severity: 'high',
    },

    // 9. Downstream Service Outage
    {
      scenarioId: 'downstream-outage',
      title: 'Downstream service outage causing cascading failures',
      description: 'Critical downstream service goes down, causing all dependent services to fail. Dependency failure.',
      deploymentId: 'dep_009',
      serviceId: 'recommendation-engine',
      versionFrom: '1.5.0',
      versionTo: '1.5.0',
      deploymentTimestamp: new Date('2026-01-08T13:00:00.000Z'),
      startTime: new Date('2026-01-08T12:50:00.000Z'),
      metrics: (() => {
        const metrics: any[] = [];
        const start = new Date('2026-01-08T12:50:00.000Z');
        const outageStart = new Date('2026-01-08T13:00:00.000Z');
        for (let i = 0; i <= 25; i++) {
          const t = new Date(start.getTime() + i * 60_000);
          const isOutage = t >= outageStart;
          const p95 = isOutage ? 3000 : 120;
          const err = isOutage ? 0.95 : 0.001; // 95% failure rate
          const rps = isOutage ? 5 : 200;
          metrics.push(
            { serviceId: 'recommendation-engine', metric: 'p95_latency_ms', timestamp: t.toISOString(), value: Math.round(p95) },
            { serviceId: 'recommendation-engine', metric: 'error_rate', timestamp: t.toISOString(), value: Number(err.toFixed(5)) },
            { serviceId: 'recommendation-engine', metric: 'rps', timestamp: t.toISOString(), value: Number(rps.toFixed(2)) }
          );
        }
        return metrics;
      })(),
      tags: ['dependency', 'outage', 'cascading-failure', 'critical'],
      category: 'errors',
      severity: 'critical',
    },

    // 10. CPU Saturation
    {
      scenarioId: 'cpu-saturation',
      title: 'CPU saturation from inefficient code path',
      description: 'New code path consumes excessive CPU, causing service to become unresponsive. Performance regression.',
      deploymentId: 'dep_010',
      serviceId: 'search-service',
      versionFrom: '3.2.0',
      versionTo: '3.2.1',
      deploymentTimestamp: new Date('2026-01-09T15:30:00.000Z'),
      startTime: new Date('2026-01-09T15:15:00.000Z'),
      metrics: generateMetrics({
        startTime: new Date('2026-01-09T15:15:00.000Z'),
        deployTime: new Date('2026-01-09T15:30:00.000Z'),
        serviceId: 'search-service',
        beforeLatency: 80,
        afterLatency: 2000,
        beforeErrorRate: 0.001,
        afterErrorRate: 0.12,
        baseRps: 300,
        minutes: 30,
      }),
      tags: ['cpu', 'performance', 'regression', 'saturation'],
      category: 'latency',
      severity: 'high',
    },
  ];

  for (const scenario of scenarios) {
    await prisma.scenario.upsert({
      where: { scenarioId: scenario.scenarioId },
      create: {
        scenarioId: scenario.scenarioId,
        title: scenario.title,
        description: scenario.description,
        deploymentId: scenario.deploymentId,
        serviceId: scenario.serviceId,
        versionFrom: scenario.versionFrom,
        versionTo: scenario.versionTo,
        deploymentTimestamp: scenario.deploymentTimestamp,
        metrics: scenario.metrics,
        tags: scenario.tags,
        category: scenario.category,
        severity: scenario.severity,
      },
      update: {
        title: scenario.title,
        description: scenario.description,
        deploymentId: scenario.deploymentId,
        serviceId: scenario.serviceId,
        versionFrom: scenario.versionFrom,
        versionTo: scenario.versionTo,
        deploymentTimestamp: scenario.deploymentTimestamp,
        metrics: scenario.metrics,
        tags: scenario.tags,
        category: scenario.category,
        severity: scenario.severity,
        updatedAt: new Date(),
      },
    });

    console.log(`  ✓ Seeded scenario: ${scenario.scenarioId}`);
  }

  console.log(`\n✅ Seeded ${scenarios.length} scenarios successfully!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding scenarios:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
