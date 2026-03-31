'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateOperator } = require('../middleware/auth');
const { resolveTenantMiddleware, assertOperatorOwnsTenant } = require('../middleware/tenant');

const router = express.Router({ mergeParams: true });

// All routes require operator auth + tenant resolution + ownership check
router.use(
  authenticateOperator,
  resolveTenantMiddleware({ required: true }),
  assertOperatorOwnsTenant
);

/**
 * GET /api/v1/tenants/:tenantSlug/locations
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, address, city, postal_code, description, is_active, created_at, updated_at
       FROM locations WHERE tenant_id = $1 ORDER BY name ASC`,
      [req.tenant.id]
    );
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/tenants/:tenantSlug/locations
 */
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('address').trim().isLength({ min: 1, max: 500 }),
    body('city').trim().isLength({ min: 1, max: 100 }),
    body('postal_code').trim().isLength({ min: 1, max: 20 }),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { name, address, city, postal_code, description } = req.body;
      const result = await db.query(
        `INSERT INTO locations (tenant_id, name, address, city, postal_code, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.tenant.id, name, address, city, postal_code, description || null]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantSlug/locations/:id
 */
router.get(
  '/:id',
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const result = await db.query(
        'SELECT * FROM locations WHERE id = $1 AND tenant_id = $2',
        [req.params.id, req.tenant.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/tenants/:tenantSlug/locations/:id
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('address').optional().trim().isLength({ min: 1, max: 500 }),
    body('city').optional().trim().isLength({ min: 1, max: 100 }),
    body('postal_code').optional().trim().isLength({ min: 1, max: 20 }),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { name, address, city, postal_code, description, is_active } = req.body;
      const result = await db.query(
        `UPDATE locations
         SET name = COALESCE($3, name),
             address = COALESCE($4, address),
             city = COALESCE($5, city),
             postal_code = COALESCE($6, postal_code),
             description = COALESCE($7, description),
             is_active = COALESCE($8, is_active)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [req.params.id, req.tenant.id, name, address, city, postal_code, description, is_active]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/tenants/:tenantSlug/locations/:id
 */
router.delete(
  '/:id',
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const result = await db.query(
        'DELETE FROM locations WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [req.params.id, req.tenant.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
