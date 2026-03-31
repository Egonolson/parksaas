'use strict';

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
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
 * GET /api/v1/tenants/:tenantSlug/spots
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['available', 'reserved', 'active', 'suspended']),
    query('location_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { status, location_id, limit = 50, offset = 0 } = req.query;

      let paramIdx = 1;
      const params = [req.tenant.id];
      let where = 'WHERE s.tenant_id = $1';

      if (status) {
        paramIdx++;
        where += ` AND s.status = $${paramIdx}::spot_status`;
        params.push(status);
      }
      if (location_id) {
        paramIdx++;
        where += ` AND s.location_id = $${paramIdx}`;
        params.push(location_id);
      }

      params.push(limit, offset);
      const result = await db.query(
        `SELECT s.*, l.name AS location_name
         FROM spots s
         LEFT JOIN locations l ON l.id = s.location_id
         ${where}
         ORDER BY l.name ASC, s.spot_number ASC
         LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
        params
      );

      const countResult = await db.query(
        `SELECT COUNT(*) FROM spots s ${where}`,
        params.slice(0, paramIdx)
      );

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
 * POST /api/v1/tenants/:tenantSlug/spots
 */
router.post(
  '/',
  [
    body('location_id').isUUID(),
    body('spot_number').trim().isLength({ min: 1, max: 50 }),
    body('label').optional().trim().isLength({ max: 255 }),
    body('monthly_rent_eur').isFloat({ min: 0.01 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { location_id, spot_number, label, monthly_rent_eur } = req.body;

      // Verify location belongs to tenant
      const locCheck = await db.query(
        'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
        [location_id, req.tenant.id]
      );
      if (locCheck.rowCount === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
      }

      const result = await db.query(
        `INSERT INTO spots (tenant_id, location_id, spot_number, label, monthly_rent_eur)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.tenant.id, location_id, spot_number, label || null, monthly_rent_eur]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantSlug/spots/:id
 */
router.get('/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(errors.array());

    const result = await db.query(
      `SELECT s.*, l.name AS location_name
       FROM spots s LEFT JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [req.params.id, req.tenant.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Spot not found.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/tenants/:tenantSlug/spots/:id
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('label').optional().trim().isLength({ max: 255 }),
    body('monthly_rent_eur').optional().isFloat({ min: 0.01 }),
    body('status').optional().isIn(['available', 'reserved', 'active', 'suspended']),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { label, monthly_rent_eur, status, is_active } = req.body;
      const result = await db.query(
        `UPDATE spots
         SET label = COALESCE($3, label),
             monthly_rent_eur = COALESCE($4, monthly_rent_eur),
             status = COALESCE($5::spot_status, status),
             is_active = COALESCE($6, is_active)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [req.params.id, req.tenant.id, label, monthly_rent_eur, status, is_active]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Spot not found.' });
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
