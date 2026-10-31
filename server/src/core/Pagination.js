// Keyset pagination helpers — encode/decode an opaque cursor.
// Sort must be deterministic: we paginate by a sortable field + _id descending.

import { ObjectId } from 'mongodb';

/**
 * Build a cursor string from the last document in a page.
 * @param {object} doc - last document
 * @param {string} sortField
 * @returns {string} base64url-encoded JSON
 */
export function encodeCursor(doc, sortField) {
  const cursor = {
    v: doc[sortField] instanceof Date ? doc[sortField].toISOString() : doc[sortField],
    id: doc._id.toString(),
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

/**
 * Decode a cursor string into { v, id }.
 * @param {string} str
 */
export function decodeCursor(str) {
  if (!str) return null;
  try {
    const json = JSON.parse(Buffer.from(str, 'base64url').toString());
    return {
      v: typeof json.v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(json.v)
        ? new Date(json.v)
        : json.v,
      id: json.id,
    };
  } catch {
    throw new Error('Invalid pagination cursor');
  }
}

/**
 * Build the keyset `$or` filter for a descending sort on [sortField, _id].
 * Returns null when there is no cursor (first page).
 *
 * @param {string|undefined} cursorStr
 * @param {string} sortField
 * @returns {object|null}
 */
export function keysetFilter(cursorStr, sortField) {
  if (!cursorStr) return null;
  const cursor = decodeCursor(cursorStr);
  if (!cursor) return null;
  return {
    $or: [
      { [sortField]: { $lt: cursor.v } },
      { [sortField]: cursor.v, _id: { $lt: new ObjectId(cursor.id) } },
    ],
  };
}

/**
 * Build the keyset filter for an ascending sort on [sortField, _id].
 */
export function keysetFilterAsc(cursorStr, sortField) {
  if (!cursorStr) return null;
  const cursor = decodeCursor(cursorStr);
  if (!cursor) return null;
  return {
    $or: [
      { [sortField]: { $gt: cursor.v } },
      { [sortField]: cursor.v, _id: { $gt: new ObjectId(cursor.id) } },
    ],
  };
}
