'use strict';

const express = require('express');
const { param, query, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateOperator } = require('../middleware/auth');
const { resolveTenantMiddleware, assertOperatorOwnsTenant } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });

router.use(
  authenticateOperator,
  resolveTenantMiddleware({ required: true }),
  assertOperatorOwnsTenant
);

/**
 * GET /api/v1/tenants/:tenantSlug/payments
 */
router.get(
  '/',
  [
    query('contract_id').optional().isUUID(),
    query('status').optional().trim(),
    query('payment_type').optional().isIn(['first', 'recurring']),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { contract_id, status, payment_type, limit = 50, offset = 0 } = req.query;
      const params = [req.tenant.id];
      let where = 'WHERE p.tenant_id = $1';

      if (contract_id) {
        params.push(contract_id);
        where += ` AND p.contract_id = $${params.length}`;
      }
      if (status) {
        params.push(status);
        where += ` AND p.status = $${params.length}`;
      }
      if (payment_type) {
        params.push(payment_type);
        where += ` AND p.payment_type = $${params.length}::payment_type`;
      }

      params.push(limit, offset);
      const result = await db.query(
        `SELECT p.*, c.license_plate, cu.name AS customer_name
         FROM payments p
         LEFT JOIN contracts c ON c.id = p.contract_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({ data: result.rows, limit, offset });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantSlug/payments/:id
 */
router.get('/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(errors.array());

    const result = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Payment not found.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/tenants/:tenantSlug/payments/summary
 * Revenue summary
 */
router.get('/summary/revenue', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'paid') AS total_paid_count,
         COALESCE(SUM(amount_eur) FILTER (WHERE status = 'paid'), 0) AS total_revenue_eur,
         COALESCE(SUM(platform_fee_eur) FILTER (WHERE status = 'paid'), 0) AS total_platform_fees_eur,
         COUNT(*) FILTER (WHERE status = 'open') AS pending_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         DATE_TRUNC('month', NOW()) AS month_start
       FROM payments
       WHERE tenant_id = $1
         AND created_at >= DATE_TRUNC('month', NOW())`,
      [req.tenant.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
