'use strict';

const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticatePlatformAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All platform routes require platform admin auth
router.use(authenticatePlatformAdmin);

/**
 * GET /api/v1/platform/tenants
 * List all tenants
 */
router.get(
  '/tenants',
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('is_active').optional().isBoolean().toBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { limit = 50, offset = 0, is_active } = req.query;
      const params = [];
      let where = '';

      if (is_active !== undefined) {
        params.push(is_active);
        where = `WHERE is_active = $${params.length}`;
      }

      params.push(limit, offset);
      const result = await db.query(
        `SELECT id, name, slug, email, plan, commission_percent,
                mollie_onboarding_complete, is_active, created_at
         FROM tenants ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const countParams = params.slice(0, params.length - 2);
      const countResult = await db.query(`SELECT COUNT(*) FROM tenants ${where}`, countParams);

      res.json({
        data: result.rows,
        total: parseInt(countResult.rows[0].count, 10),
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/platform/tenants/:id
 */
router.get('/tenants/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(errors.array());

    const result = await db.query(
      `SELECT id, name, slug, email, plan, commission_percent,
              mollie_onboarding_complete, mollie_profile_id, is_active,
              created_at, updated_at
       FROM tenants WHERE id = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Tenant not found.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/platform/tenants/:id
 * Update tenant settings (plan, commission, active status)
 */
router.patch(
  '/tenants/:id',
  [
    param('id').isUUID(),
    body('plan').optional().isIn(['starter', 'growth', 'professional', 'enterprise']),
    body('commission_percent').optional().isFloat({ min: 0, max: 100 }),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { plan, commission_percent, is_active } = req.body;

      const result = await db.query(
        `UPDATE tenants
         SET plan = COALESCE($2::tenant_plan, plan),
             commission_percent = COALESCE($3, commission_percent),
             is_active = COALESCE($4, is_active)
         WHERE id = $1
         RETURNING id, name, slug, email, plan, commission_percent, is_active, updated_at`,
        [req.params.id, plan, commission_percent, is_active]
      );

      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Tenant not found.' });

      logger.info('Platform admin updated tenant', {
        adminId: req.platformAdmin.id,
        tenantId: req.params.id,
        changes: { plan, commission_percent, is_active },
      });

      await db.query(
        `INSERT INTO audit_log (tenant_id, actor_id, actor_type, action, resource, resource_id, new_data)
         VALUES ($1, $2, 'platform_admin', 'tenant.updated', 'tenant', $1, $3)`,
        [req.params.id, req.platformAdmin.id, JSON.stringify({ plan, commission_percent, is_active })]
      );

      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/platform/stats
 * Platform-wide statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [tenantsResult, paymentsResult, contractsResult] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) AS total_tenants,
          COUNT(*) FILTER (WHERE is_active) AS active_tenants,
          COUNT(*) FILTER (WHERE mollie_onboarding_complete) AS onboarded_tenants
        FROM tenants
      `),
      db.query(`
        SELECT
          COALESCE(SUM(amount_eur) FILTER (WHERE status = 'paid'), 0) AS total_revenue_eur,
          COALESCE(SUM(platform_fee_eur) FILTER (WHERE status = 'paid'), 0) AS total_platform_fees_eur,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid_payment_count
        FROM payments
      `),
      db.query(`
        SELECT
          COUNT(*) AS total_contracts,
          COUNT(*) FILTER (WHERE status = 'active') AS active_contracts,
          COUNT(*) FILTER (WHERE status = 'reserved') AS reserved_contracts
        FROM contracts
      `),
    ]);

    res.json({
      data: {
        tenants: tenantsResult.rows[0],
        payments: paymentsResult.rows[0],
        contracts: contractsResult.rows[0],
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/platform/audit-log
 */
router.get(
  '/audit-log',
  [
    query('tenant_id').optional().isUUID(),
    query('action').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { tenant_id, action, limit = 50, offset = 0 } = req.query;
      const params = [];
      const conditions = [];

      if (tenant_id) {
        params.push(tenant_id);
        conditions.push(`tenant_id = $${params.length}`);
      }
      if (action) {
        params.push(`${action}%`);
        conditions.push(`action LIKE $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const result = await db.query(
        `SELECT al.*, t.name AS tenant_name, t.slug AS tenant_slug
         FROM audit_log al
         LEFT JOIN tenants t ON t.id = al.tenant_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({ data: result.rows, limit, offset });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
