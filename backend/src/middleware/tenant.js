'use strict';

const db = require('../db');
const logger = require('../utils/logger');

/**
 * Tenant Resolver Middleware
 *
 * Resolves the current tenant from:
 *   1. URL parameter :tenantSlug  (e.g. /api/v1/tenants/:tenantSlug/...)
 *   2. Request header X-Tenant-Slug
 *   3. Subdomain (e.g. acme.parksaas.io -> slug = 'acme')
 *
 * Priority: URL param > header > subdomain
 *
 * On success: sets req.tenant = { id, slug, name, email, plan, commission_percent,
 *                                  mollie_onboarding_complete, is_active }
 *
 * The tenant data is fetched from the DB and cached in-process for 30 seconds
 * to avoid hammering the DB on every request.
 */

// Simple in-process LRU-style cache: slug -> { tenant, expiresAt }
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const tenantCache = new Map();

function getCached(slug) {
  const entry = tenantCache.get(slug);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tenantCache.delete(slug);
    return null;
  }
  return entry.tenant;
}

function setCache(slug, tenant) {
  // Keep cache from growing unbounded
  if (tenantCache.size > 1000) {
    // Evict oldest entries
    const oldest = [...tenantCache.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
      .slice(0, 200);
    oldest.forEach(([k]) => tenantCache.delete(k));
  }
  tenantCache.set(slug, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Invalidates the cache for a specific tenant slug.
 * Call this whenever tenant data changes.
 */
function invalidateTenantCache(slug) {
  tenantCache.delete(slug);
}

/**
 * Extracts the slug from the request subdomain.
 * Assumes format: <slug>.parksaas.io or <slug>.localhost
 */
function extractSlugFromSubdomain(req) {
  const host = req.hostname || '';
  const parts = host.split('.');
  // Require at least 2 parts and not 'www'
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'api') {
    return parts[0];
  }
  return null;
}

/**
 * Resolves tenant slug from the request.
 */
function resolveSlug(req) {
  // 1. URL param (set by Express router via :tenantSlug)
  if (req.params && req.params.tenantSlug) {
    return req.params.tenantSlug;
  }

  // 2. Custom header
  const headerSlug = req.headers['x-tenant-slug'];
  if (headerSlug && typeof headerSlug === 'string') {
    return headerSlug.trim().toLowerCase();
  }

  // 3. Subdomain
  const subdomainSlug = extractSlugFromSubdomain(req);
  if (subdomainSlug) return subdomainSlug;

  return null;
}

/**
 * Core tenant resolution logic. Can be called as middleware or standalone.
 */
async function resolveTenant(slug) {
  if (!slug) return null;

  // Validate slug format before hitting DB
  if (!/^[a-z0-9-]+$/.test(slug)) return null;

  const cached = getCached(slug);
  if (cached) return cached;

  const result = await db.query(
    `SELECT id, name, slug, email, plan, commission_percent,
            mollie_onboarding_complete, mollie_profile_id, is_active
     FROM tenants
     WHERE slug = $1`,
    [slug]
  );

  if (result.rows.length === 0) return null;

  const tenant = result.rows[0];
  setCache(slug, tenant);
  return tenant;
}

/**
 * Middleware: Resolves and attaches tenant to req.tenant.
 * Returns 404 if tenant not found, 403 if tenant is inactive.
 *
 * @param {object} options
 * @param {boolean} [options.required=true] - If false, continues even if no tenant found
 * @param {boolean} [options.enforceActive=true] - If true, rejects inactive tenants
 */
function resolveTenantMiddleware(options = {}) {
  const required = options.required !== false;
  const enforceActive = options.enforceActive !== false;

  return async (req, res, next) => {
    try {
      const slug = resolveSlug(req);

      if (!slug) {
        if (required) {
          return res.status(400).json({
            error: 'BadRequest',
            message: 'Tenant identifier is required but was not provided.',
          });
        }
        return next();
      }

      const tenant = await resolveTenant(slug);

      if (!tenant) {
        if (required) {
          return res.status(404).json({
            error: 'NotFound',
            message: `Tenant '${slug}' not found.`,
          });
        }
        return next();
      }

      if (enforceActive && !tenant.is_active) {
        logger.warn('Rejected request to inactive tenant', { slug });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'This tenant account is inactive.',
        });
      }

      req.tenant = tenant;
      logger.debug('Tenant resolved', { tenantId: tenant.id, slug: tenant.slug });
      next();
    } catch (err) {
      logger.error('Tenant resolution error', { error: err.message, stack: err.stack });
      next(err);
    }
  };
}

/**
 * Middleware: Verifies that req.operator (set by auth middleware) belongs to req.tenant.
 * Prevents operators from accessing other tenants' data.
 * Must run AFTER authenticateOperator and resolveTenantMiddleware.
 */
function assertOperatorOwnsTenant(req, res, next) {
  if (!req.operator) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
  }
  if (!req.tenant) {
    return res.status(400).json({ error: 'BadRequest', message: 'Tenant not resolved.' });
  }

  if (req.operator.id !== req.tenant.id) {
    logger.warn('Operator attempted to access foreign tenant', {
      operatorId: req.operator.id,
      tenantId: req.tenant.id,
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this tenant.',
    });
  }

  next();
}

module.exports = {
  resolveTenantMiddleware,
  assertOperatorOwnsTenant,
  resolveTenant,
  invalidateTenantCache,
};
