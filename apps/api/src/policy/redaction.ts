/**
 * Simple key-based redactor for sensitive data in evidence payloads
 */

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /authorization/i,
  /cookie/i,
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /credential/i,
  /auth[_-]?header/i,
];

/**
 * Checks if a key looks sensitive and should be redacted
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redacts sensitive keys from an object recursively
 */
export function redactSensitiveKeys(obj: any, depth: number = 0, maxDepth: number = 5): any {
  if (depth > maxDepth) {
    return "[MAX_DEPTH_REACHED]";
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveKeys(item, depth + 1, maxDepth));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveKeys(value, depth + 1, maxDepth);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Redacts sensitive data from evidence bundle payload
 */
export function redactEvidenceBundle(bundle: any): any {
  if (!bundle || typeof bundle !== "object") {
    return bundle;
  }

  const redacted = { ...bundle };

  // Redact artifacts payloads
  if (Array.isArray(redacted.artifacts)) {
    redacted.artifacts = redacted.artifacts.map((artifact: any) => {
      if (artifact.payload && typeof artifact.payload === "object") {
        return {
          ...artifact,
          payload: redactSensitiveKeys(artifact.payload),
        };
      }
      return artifact;
    });
  }

  return redacted;
}
