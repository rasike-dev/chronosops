import { Injectable } from "@nestjs/common";
import { ScenarioSchema, type Scenario } from "@chronosops/contracts";

@Injectable()
export class ScenarioService {
  getLatencySpike(): Scenario {
    const deployTs = "2026-01-01T13:12:00.000Z";
    const start = new Date("2026-01-01T13:00:00.000Z");

    const metrics: any[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = new Date(start.getTime() + i * 60_000).toISOString();
      const before = t < deployTs;

      const p95 = before ? 220 + i * 2 : 700 + (i - 12) * 15;
      const err = before ? 0.004 + i * 0.0001 : 0.028 + (i - 12) * 0.0006;
      const rps = 120 + ((i % 5) - 2) * 1.2;

      metrics.push(
        { serviceId: "checkout-api", metric: "p95_latency_ms", timestamp: t, value: Math.round(p95) },
        { serviceId: "checkout-api", metric: "error_rate", timestamp: t, value: Number(err.toFixed(5)) },
        { serviceId: "checkout-api", metric: "rps", timestamp: t, value: Number(rps.toFixed(2)) }
      );
    }

    const scenario = {
      scenarioId: "latency-spike",
      title: "Production latency spike after deployment",
      description: "p95 latency and error rate increase within minutes after a deployment.",
      deployment: {
        id: "dep_001",
        serviceId: "checkout-api",
        versionFrom: "1.8.2",
        versionTo: "1.8.3",
        timestamp: deployTs
      },
      metrics
    };

    return ScenarioSchema.parse(scenario);
  }

  getErrorSpikeConfig(): Scenario {
    const deployTs = "2026-01-01T15:05:00.000Z";
    const start = new Date("2026-01-01T14:45:00.000Z");

    const metrics: any[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = new Date(start.getTime() + i * 60_000).toISOString();
      const before = t < deployTs;

      // latency mostly stable; error rate spikes after config change
      const p95 = before ? 240 + i * 1.5 : 260 + (i - 20) * 2;
      const err = before ? 0.006 + i * 0.0001 : 0.045 + (i - 20) * 0.0008;
      const rps = 140 + ((i % 6) - 3) * 1.1;

      metrics.push(
        { serviceId: "auth-api", metric: "p95_latency_ms", timestamp: t, value: Math.round(p95) },
        { serviceId: "auth-api", metric: "error_rate", timestamp: t, value: Number(err.toFixed(5)) },
        { serviceId: "auth-api", metric: "rps", timestamp: t, value: Number(rps.toFixed(2)) }
      );
    }

    const scenario = {
      scenarioId: "error-spike-config",
      title: "Error spike after config change",
      description: "A config change causes auth-api error rate to spike while latency remains mostly stable.",
      deployment: {
        id: "dep_002",
        serviceId: "auth-api",
        versionFrom: "2.3.0",
        versionTo: "2.3.0+config",
        timestamp: deployTs
      },
      metrics
    };

    return ScenarioSchema.parse(scenario);
  }

  getById(scenarioId: string): Scenario {
    if (scenarioId === "latency-spike") return this.getLatencySpike();
    if (scenarioId === "error-spike-config") return this.getErrorSpikeConfig();
    throw new Error(`Unknown scenarioId: ${scenarioId}`);
  }

  list() {
    return [
      { scenarioId: "latency-spike", title: "Production latency spike after deployment" },
      { scenarioId: "error-spike-config", title: "Error spike after config change" }
    ];
  }
}
