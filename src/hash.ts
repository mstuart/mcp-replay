import { createHash } from 'node:crypto';

/**
 * Recursively remove specified fields from an object.
 */
export function scrub(obj: unknown, fields: string[]): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrub(item, fields));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (fields.includes(key)) continue;
    result[key] = scrub(value, fields);
  }
  return result;
}

/**
 * Hash method + params into a deterministic SHA-256 hex string.
 */
export function hashRequest(method: string, params?: Record<string, unknown>, scrubFields?: string[]): string {
  let sanitized = params;
  if (sanitized && scrubFields && scrubFields.length > 0) {
    sanitized = scrub(sanitized, scrubFields) as Record<string, unknown>;
  }
  const payload = JSON.stringify({ method, params: sanitized ?? null });
  return createHash('sha256').update(payload).digest('hex');
}
