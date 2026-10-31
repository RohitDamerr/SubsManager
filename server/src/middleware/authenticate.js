// authenticate — verify the JWT, load the user, attach to req.user.
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config/env.js';
import { getDb } from '../config/mongo.js';
import { UnauthorizedError } from '../core/AppError.js';

/**
 * Optional auth — attaches req.user when a valid token is present,
 * but does not reject requests without one.
 */
export async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = jwt.verify(token, config.jwt.secret);
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: toObjectId(payload.sub) });
    if (!user || !user.isActive) return next();
    req.user = user;
    return next();
  } catch {
    return next();
  }
}

/**
 * Strict auth — rejects requests without a valid token.
 */
export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new UnauthorizedError('Missing or invalid Authorization header');
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: toObjectId(payload.sub) });
    if (!user) throw new UnauthorizedError('User not found');
    if (!user.isActive) throw new UnauthorizedError('Account is inactive');
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

// JWT `sub` is a string; users._id is an ObjectId. Invalid ids match nothing.
function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
