/**
 * Deterministic log signature algorithm
 * Normalizes log messages by removing variable tokens (IDs, hex, UUIDs, numbers)
 * to create stable signatures for grouping
 */
export function logSignature(message: string): string {
  let s = (message || "").toLowerCase();

  // Replace UUIDs
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>");
  
  // Replace hex blobs
  s = s.replace(/\b0x[0-9a-f]+\b/g, "<hex>");
  
  // Replace numbers (integers and decimals)
  s = s.replace(/\b\d+(\.\d+)?\b/g, "<num>");
  
  // Replace long base64-ish tokens
  s = s.replace(/\b[a-z0-9+\/]{20,}={0,2}\b/g, "<token>");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  
  // Truncate to 300 chars
  if (s.length > 300) s = s.slice(0, 300);
  
  return s || "<empty>";
}
