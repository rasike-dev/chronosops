import { Injectable } from "@nestjs/common";
import { GoogleIncidentsClient } from "./google.client";
import { GoogleIncidentNormalizer } from "./google.normalizer";

@Injectable()
export class GoogleIntegrationService {
  constructor(
    private readonly client: GoogleIncidentsClient,
    private readonly normalizer: GoogleIncidentNormalizer
  ) {}

  async fetchAndNormalize() {
    const { incidents, fetchedAt } = await this.client.fetchPublicIncidentsJson();
    const normalized = incidents.map((x) => this.normalizer.fromJsonIncident(x));

    return {
      incidents: normalized,
      fetchedAt,
      source: "GOOGLE_CLOUD_PUBLIC" as const,
      normalized: normalized.map((i) => this.normalizer.toChronosOpsIncident(i)),
    };
  }
}
