import { Module } from "@nestjs/common";
import { GcpMetricsCollector } from "./gcp-metrics/gcp-metrics.collector";
import { GcpMetricsClient } from "./gcp-metrics/gcp-metrics.client";
import { GcpMetricsNormalizer } from "./gcp-metrics/gcp-metrics.normalizer";
import { DeploysCollector } from "./deploys/deploys.collector";
import { DeploysClient } from "./deploys/deploys.client";
import { DeploysNormalizer } from "./deploys/deploys.normalizer";
import { ConfigDiffCollector } from "./configdiff/configdiff.collector";
import { ConfigDiffClient } from "./configdiff/configdiff.client";
import { ConfigDiffNormalizer } from "./configdiff/configdiff.normalizer";
import { LogsCollector } from "./logs/logs.collector";
import { LogsClient } from "./logs/logs.client";
import { LogsNormalizer } from "./logs/logs.normalizer";
import { TracesCollector } from "./traces/traces.collector";
import { TracesClient } from "./traces/traces.client";
import { TracesNormalizer } from "./traces/traces.normalizer";

@Module({
  providers: [
    // Metrics
    GcpMetricsClient,
    GcpMetricsNormalizer,
    GcpMetricsCollector,
    // Deployments
    DeploysClient,
    DeploysNormalizer,
    DeploysCollector,
    // Config Diff
    ConfigDiffClient,
    ConfigDiffNormalizer,
    ConfigDiffCollector,
    // Logs
    LogsClient,
    LogsNormalizer,
    LogsCollector,
    // Traces
    TracesClient,
    TracesNormalizer,
    TracesCollector,
  ],
  exports: [GcpMetricsCollector, DeploysCollector, ConfigDiffCollector, LogsCollector, TracesCollector],
})
export class CollectorsModule {}
