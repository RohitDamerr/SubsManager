// Search helpers — user text is never used as a raw regex (that allowed "(" to crash a
// query and ".*" to match everything).

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" match for a free-text query. */
export function containsText(q) {
  return { $regex: escapeRegex(q.trim()), $options: 'i' };
}

/**
 * Prefix match on a document number ("12", "sub-12" or "SUB-000012" → ^SUB-0*12),
 * which can use the unique number index.  Returns null when the query has no digits,
 * so callers search other fields instead of matching every number.
 */
export function numberPrefix(q, prefix) {
  const digits = String(q).toUpperCase().replace(new RegExp(`^${prefix}-?`), '').replace(/\D/g, '');
  return digits ? { $regex: `^${prefix}-0*${digits}` } : null;
}
