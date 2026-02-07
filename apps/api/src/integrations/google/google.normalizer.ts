import { Injectable } from "@nestjs/common";
import { GooglePublicIncident } from "./google.types";

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

function toStatus(s?: string): GooglePublicIncident["status"] {
  const v = (s ?? "").toLowerCase();
  if (v.includes("investigat")) return "investigating";
  if (v.includes("identif")) return "identified";
  if (v.includes("monitor")) return "monitoring";
  if (v.includes("resolv")) return "resolved";
  return "unknown";
}

function toSeverity(s?: string): GooglePublicIncident["severity"] {
  const v = (s ?? "").toLowerCase();
  if (v.includes("critical")) return "critical";
  if (v.includes("high")) return "high";
  if (v.includes("medium")) return "medium";
  if (v.includes("low")) return "low";
  return "unknown";
}

@Injectable()
export class GoogleIncidentNormalizer {
  fromJsonIncident(i: GcpIncidentJson): GooglePublicIncident {
    const mr = i.most_recent_update ?? {};
    const affectedProduct = (i.affected_products?.[0]?.title ?? i.affected_products?.[0]?.id) as string | undefined;
    const affectedLocation = (i.currently_affected_locations?.[0]?.title ?? i.currently_affected_locations?.[0]?.id) as
      | string
      | undefined;

    return {
      id: i.id,
      title: i.external_desc ?? affectedProduct ?? `Google Cloud incident ${i.id}`,
      summary: i.external_desc,
      status: toStatus(mr.status ?? i.status_impact),
      severity: toSeverity(i.severity),
      service: affectedProduct,
      region: affectedLocation,
      startTime: i.begin,
      updateTime: i.modified ?? mr.modified ?? mr.when,
      endTime: i.end,
      url: i.uri,
      raw: i, // IMPORTANT: keep raw for sourcePayload
    };
  }

  // Keep the old method for backward compatibility
  toChronosOpsIncident(gi: GooglePublicIncident) {
    // Map Google incident status to ChronosOps status
    // ChronosOps uses "analyzed" as default, but we can map Google statuses
    let status = "analyzed";
    if (gi.status === "resolved") {
      status = "resolved";
    } else if (gi.status === "investigating" || gi.status === "identified") {
      status = "open";
    }

    return {
      scenarioId: "google-cloud", // Placeholder - Google incidents don't have scenarios
      title: gi.title,
      sourceType: "GOOGLE_CLOUD" as const,
      sourceRef: gi.id,
      sourcePayload: gi.raw,
      // Note: status is set in createIncident, but we can override if needed
      // For now, we'll use the default "analyzed" and let the service handle status mapping
    };
  }
}
