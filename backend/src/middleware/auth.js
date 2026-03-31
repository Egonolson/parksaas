'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const PLATFORM_ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || process.env.JWT_SECRET;

/**
 * Parses the Bearer token from the Authorization header.
 * Returns null if not present or malformed.
 */
function extractBearerToken(req) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Middleware: authenticate as Tenant Operator.
 *
 * Expects a JWT signed with JWT_SECRET containing:
 *   { sub: <tenantId>, slug: <tenantSlug>, email: <email>, role: 'operator' }
 *
 * Sets req.operator = { id, slug, email, role, plan }
 */
function authenticateOperator(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header.',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (payload.role !== 'operator') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token does not grant operator access.',
      });
    }

    req.operator = {
      id: payload.sub,
      slug: payload.slug,
      email: payload.email,
      plan: payload.plan,
      role: payload.role,
    };

    logger.debug('Operator authenticated', { operatorId: req.operator.id, slug: req.operator.slug });
    next();
  } catch (err) {
    logger.warn('Operator JWT verification failed', { error: err.message });

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'JWT has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid JWT.',
    });
  }
}

/**
 * Middleware: authenticate as Platform Admin.
 *
 * Expects a JWT signed with PLATFORM_ADMIN_SECRET containing:
 *   { sub: <adminId>, email: <email>, role: 'platform_admin' }
 *
 * Sets req.platformAdmin = { id, email, role }
 */
function authenticatePlatformAdmin(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header.',
    });
  }

  try {
    const payload = jwt.verify(token, PLATFORM_ADMIN_SECRET, {
      algorithms: ['HS256'],
    });

    if (payload.role !== 'platform_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token does not grant platform admin access.',
      });
    }

    req.platformAdmin = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    logger.debug('Platform admin authenticated', { adminId: req.platformAdmin.id });
    next();
  } catch (err) {
    logger.warn('Platform admin JWT verification failed', { error: err.message });

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'JWT has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid JWT.',
    });
  }
}

/**
 * Middleware: authenticate as either Operator OR Platform Admin.
 * Useful for routes accessible by both roles.
 * Sets req.operator or req.platformAdmin accordingly.
 */
function authenticateAny(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header.',
    });
  }

  // Try operator token first
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role === 'operator') {
      req.operator = {
        id: payload.sub,
        slug: payload.slug,
        email: payload.email,
        plan: payload.plan,
        role: payload.role,
      };
      return next();
    }
  } catch (_) {
    // Try platform admin secret next
  }

  try {
    const payload = jwt.verify(token, PLATFORM_ADMIN_SECRET, { algorithms: ['HS256'] });
    if (payload.role === 'platform_admin') {
      req.platformAdmin = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TokenExpired',
        message: 'JWT has expired. Please log in again.',
      });
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid JWT.',
  });
}

/**
 * Helper: generate a signed operator JWT.
 * @param {object} tenant - Tenant row from DB
 * @param {string} [expiresIn]
 * @returns {string}
 */
function signOperatorToken(tenant, expiresIn) {
  return jwt.sign(
    {
      sub: tenant.id,
      slug: tenant.slug,
      email: tenant.email,
      plan: tenant.plan,
      role: 'operator',
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '24h',
    }
  );
}

/**
 * Helper: generate a signed platform admin JWT.
 * @param {object} admin
 * @param {string} [expiresIn]
 * @returns {string}
 */
function signPlatformAdminToken(admin, expiresIn) {
  return jwt.sign(
    {
      sub: admin.id,
      email: admin.email,
      role: 'platform_admin',
    },
    PLATFORM_ADMIN_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '24h',
    }
  );
}

module.exports = {
  authenticateOperator,
  authenticatePlatformAdmin,
  authenticateAny,
  signOperatorToken,
  signPlatformAdminToken,
  extractBearerToken,
};
