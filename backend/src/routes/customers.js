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
 * GET /api/v1/tenants/:tenantSlug/customers
 */
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { search, limit = 50, offset = 0 } = req.query;
      const params = [req.tenant.id];
      let where = 'WHERE tenant_id = $1';

      if (search) {
        params.push(`%${search}%`);
        where += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR customer_number ILIKE $${params.length})`;
      }

      params.push(limit, offset);
      const result = await db.query(
        `SELECT id, tenant_id, customer_number, type, name, email, phone, address, mollie_customer_id, created_at, updated_at
         FROM customers ${where}
         ORDER BY name ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const countParams = params.slice(0, params.length - 2);
      const countResult = await db.query(
        `SELECT COUNT(*) FROM customers ${where}`,
        countParams
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
 * POST /api/v1/tenants/:tenantSlug/customers
 */
router.post(
  '/',
  [
    body('type').isIn(['private', 'business']),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('address').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { type, name, email, phone, address } = req.body;

      // Generate next customer number
      const counterResult = await db.query(
        `SELECT COUNT(*) + 1 AS next_num FROM customers WHERE tenant_id = $1`,
        [req.tenant.id]
      );
      const customer_number = `C${String(counterResult.rows[0].next_num).padStart(6, '0')}`;

      const result = await db.query(
        `INSERT INTO customers (tenant_id, customer_number, type, name, email, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.tenant.id, customer_number, type, name, email, phone || null, address || null]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantSlug/customers/:id
 */
router.get('/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(errors.array());

    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Customer not found.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/tenants/:tenantSlug/customers/:id
 */
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('type').optional().isIn(['private', 'business']),
    body('name').optional().trim().isLength({ min: 1, max: 255 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 50 }),
    body('address').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { type, name, email, phone, address } = req.body;
      const result = await db.query(
        `UPDATE customers
         SET type = COALESCE($3::customer_type, type),
             name = COALESCE($4, name),
             email = COALESCE($5, email),
             phone = COALESCE($6, phone),
             address = COALESCE($7, address)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [req.params.id, req.tenant.id, type, name, email, phone, address]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Customer not found.' });
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
