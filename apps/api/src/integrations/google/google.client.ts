import { Injectable, Logger } from "@nestjs/common";
import { GOOGLE_CLOUD_STATUS } from "./google.constants";

type GcpIncidentJson = {
  id: string;
  begin?: string;
  created?: string;
  end?: string;
  modified?: string;
  external_desc?: string;
  severity?: string;
  status_impact?: string;
  uri?: string;
  affected_products?: { id: string; title?: string }[];
  currently_affected_locations?: { id: string; title?: string }[];
  previously_affected_locations?: { id: string; title?: string }[];
  most_recent_update?: {
    status?: string;
    text?: string;
    when?: string;
    created?: string;
    modified?: string;
  };
  updates?: {
    status?: string;
    text?: string;
    when?: string;
    created?: string;
    modified?: string;
    affected_locations?: { id: string; title?: string }[];
  }[];
};

@Injectable()
export class GoogleIncidentsClient {
  private readonly logger = new Logger(GoogleIncidentsClient.name);

  async fetchPublicIncidentsJson(): Promise<{ incidents: GcpIncidentJson[]; fetchedAt: string }> {
    const fetchedAt = new Date().toISOString();

    try {
      // Day 21: Add timeout for external fetch (5 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      let res;
      try {
        res = await fetch(GOOGLE_CLOUD_STATUS.incidentsJsonUrl, {
          method: "GET",
          headers: {
            "accept": "application/json",
            "user-agent": "ChronosOps/1.0 (+https://github.com/chronosops)", // safe UA
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError' || controller.signal.aborted) {
          throw new Error("Google incidents fetch timed out after 5s");
        }
        throw error;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.warn(`Failed to fetch incidents.json: ${res.status} ${res.statusText}`);
        throw new Error(`Google incidents fetch failed: ${res.status} ${res.statusText} ${text?.slice(0, 200)}`);
      }

      const data = (await res.json()) as unknown;

      if (!Array.isArray(data)) {
        throw new Error("Google incidents.json unexpected shape: expected array");
      }

      this.logger.log(`Fetched ${data.length} incidents from Google Cloud Status`);
      return { incidents: data as GcpIncidentJson[], fetchedAt };
    } catch (error: any) {
      this.logger.error(`Error fetching Google incidents: ${error?.message || error}`);
      throw error;
    }
  }

  // Keep the old method for backward compatibility during transition
  async fetchPublicIncidents() {
    const { incidents, fetchedAt } = await this.fetchPublicIncidentsJson();
    return {
      incidents: [],
      fetchedAt,
      source: "GOOGLE_CLOUD_PUBLIC" as const,
    };
  }
}
