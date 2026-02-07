export type GooglePublicIncident = {
  id: string;                 // stable ref (used as sourceRef)
  title: string;
  summary?: string;
  status: "investigating" | "identified" | "monitoring" | "resolved" | "unknown";
  severity?: "low" | "medium" | "high" | "critical" | "unknown";
  service?: string;
  region?: string;
  startTime?: string;         // ISO
  updateTime?: string;        // ISO
  endTime?: string;           // ISO if resolved
  url?: string;
  raw: unknown;               // keep raw for sourcePayload
};

export type FetchGoogleIncidentsResult = {
  incidents: GooglePublicIncident[];
  fetchedAt: string;          // ISO
  source: "GOOGLE_CLOUD_PUBLIC";
};
