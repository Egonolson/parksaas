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
 * GET /api/v1/tenants/:tenantSlug/contracts
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['reserved', 'pending_mandate', 'active', 'suspended', 'ended']),
    query('customer_id').optional().isUUID(),
    query('spot_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { status, customer_id, spot_id, limit = 50, offset = 0 } = req.query;
      const params = [req.tenant.id];
      let where = 'WHERE c.tenant_id = $1';

      if (status) {
        params.push(status);
        where += ` AND c.status = $${params.length}::contract_status`;
      }
      if (customer_id) {
        params.push(customer_id);
        where += ` AND c.customer_id = $${params.length}`;
      }
      if (spot_id) {
        params.push(spot_id);
        where += ` AND c.spot_id = $${params.length}`;
      }

      params.push(limit, offset);
      const result = await db.query(
        `SELECT c.*,
                cu.name AS customer_name, cu.email AS customer_email,
                s.spot_number, s.label AS spot_label,
                l.name AS location_name
         FROM contracts c
         LEFT JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN spots s ON s.id = c.spot_id
         LEFT JOIN locations l ON l.id = s.location_id
         ${where}
         ORDER BY c.created_at DESC
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
 * POST /api/v1/tenants/:tenantSlug/contracts
 */
router.post(
  '/',
  [
    body('spot_id').isUUID(),
    body('customer_id').isUUID(),
    body('license_plate').trim().isLength({ min: 1, max: 20 }),
    body('start_date').isISO8601().toDate(),
    body('end_date').optional().isISO8601().toDate(),
    body('monthly_rent_eur').optional().isFloat({ min: 0.01 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { spot_id, customer_id, license_plate, start_date, end_date, monthly_rent_eur } = req.body;

      // Fetch spot to get default rent
      const spotResult = await db.query(
        'SELECT * FROM spots WHERE id = $1 AND tenant_id = $2',
        [spot_id, req.tenant.id]
      );
      if (spotResult.rowCount === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Spot not found.' });
      }
      const spot = spotResult.rows[0];

      if (spot.status !== 'available') {
        return res.status(409).json({ error: 'Conflict', message: `Spot is not available (status: ${spot.status}).` });
      }

      const rent = monthly_rent_eur || spot.monthly_rent_eur;
      const reservedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const result = await db.withTransaction(async (client) => {
        // Update spot status to reserved
        await client.query(
          `UPDATE spots SET status = 'reserved' WHERE id = $1`,
          [spot_id]
        );

        return await client.query(
          `INSERT INTO contracts (tenant_id, spot_id, customer_id, license_plate, monthly_rent_eur, start_date, end_date, reserved_until)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [req.tenant.id, spot_id, customer_id, license_plate, rent, start_date, end_date || null, reservedUntil]
        );
      });

      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantSlug/contracts/:id
 */
router.get('/:id', [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(errors.array());

    const result = await db.query(
      `SELECT c.*,
              cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
              s.spot_number, s.label AS spot_label, s.monthly_rent_eur AS spot_rent,
              l.name AS location_name, l.address AS location_address
       FROM contracts c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN spots s ON s.id = c.spot_id
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [req.params.id, req.tenant.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'NotFound', message: 'Contract not found.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/tenants/:tenantSlug/contracts/:id/status
 * Update contract status with business logic
 */
router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['reserved', 'pending_mandate', 'active', 'suspended', 'ended']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return next(errors.array());

      const { status } = req.body;

      const result = await db.withTransaction(async (client) => {
        const contractRes = await client.query(
          'SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [req.params.id, req.tenant.id]
        );
        if (contractRes.rowCount === 0) return null;

        const contract = contractRes.rows[0];

        // Update spot status when contract ends or is suspended
        let spotStatus = null;
        if (status === 'ended') spotStatus = 'available';
        else if (status === 'active') spotStatus = 'active';
        else if (status === 'suspended') spotStatus = 'suspended';

        if (spotStatus) {
          await client.query(
            'UPDATE spots SET status = $1::spot_status WHERE id = $2',
            [spotStatus, contract.spot_id]
          );
        }

        return await client.query(
          'UPDATE contracts SET status = $1::contract_status WHERE id = $2 RETURNING *',
          [status, req.params.id]
        );
      });

      if (!result) return res.status(404).json({ error: 'NotFound', message: 'Contract not found.' });
      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
