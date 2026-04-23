'use strict';

/**
 * Compatibility Routes
 *
 * Maps the old frontend API paths to the existing backend DB schema.
 * These routes use the operator's JWT token (req.operator.id) as the tenant_id.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateOperator } = require('../middleware/auth');

const router = express.Router();

const VALID_DURATION_TYPES = ['30min', '1h', '2h', '4h', 'daily', 'weekly', 'monthly', 'yearly'];

// =============================================================================
// AUTHENTICATED ROUTES (operator JWT required)
// =============================================================================

// ---------------------------------------------------------------------------
// GET /operators/stats
// ---------------------------------------------------------------------------
router.get('/operators/stats', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const [contractsRes, spotsRes, revenueRes, pendingRes] = await Promise.all([
      db.query(
        "SELECT count(*) as active_contracts FROM contracts WHERE tenant_id=$1 AND status='active'",
        [tenantId]
      ),
      db.query(
        "SELECT count(*) as available_spots FROM spots WHERE tenant_id=$1 AND status='available'",
        [tenantId]
      ),
      db.query(
        "SELECT COALESCE(SUM(amount_eur),0) as monthly_revenue FROM payments WHERE tenant_id=$1 AND status='paid' AND paid_at >= date_trunc('month', CURRENT_DATE)",
        [tenantId]
      ),
      db.query(
        "SELECT COALESCE(SUM(amount_eur),0) as pending_amount FROM payments WHERE tenant_id=$1 AND status='open'",
        [tenantId]
      ),
    ]);

    res.json({
      active_contracts: parseInt(contractsRes.rows[0].active_contracts, 10),
      available_spots: parseInt(spotsRes.rows[0].available_spots, 10),
      monthly_revenue: parseFloat(revenueRes.rows[0].monthly_revenue),
      pending_amount: parseFloat(pendingRes.rows[0].pending_amount),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /operators/me
// ---------------------------------------------------------------------------
router.get('/operators/me', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      'SELECT name, email, slug, commission_percent FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Tenant not found.' });
    }

    const tenant = result.rows[0];

    res.json({
      company_name: tenant.name,
      email: tenant.email,
      phone: null,
      slug: tenant.slug,
      datev_connected: false, // placeholder for DATEV integration
      commission_rate: parseFloat(tenant.commission_percent),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /operators/me
// ---------------------------------------------------------------------------
router.put('/operators/me', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { company_name, email, phone, commission_rate } = req.body;

    // Build dynamic update
    const fields = [];
    const params = [tenantId];
    let paramIdx = 1;

    if (company_name !== undefined) {
      paramIdx++;
      fields.push(`name = $${paramIdx}`);
      params.push(company_name);
    }

    if (email !== undefined) {
      paramIdx++;
      fields.push(`email = $${paramIdx}`);
      params.push(email);
    }

    if (commission_rate !== undefined) {
      paramIdx++;
      fields.push(`commission_percent = $${paramIdx}`);
      params.push(commission_rate);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'No fields to update.' });
    }

    const result = await db.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $1
       RETURNING name, email, slug, commission_percent`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Tenant not found.' });
    }

    const tenant = result.rows[0];

    res.json({
      company_name: tenant.name,
      email: tenant.email,
      phone: null,
      slug: tenant.slug,
      datev_connected: false, // placeholder for DATEV integration
      commission_rate: parseFloat(tenant.commission_percent),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /locations
// ---------------------------------------------------------------------------
router.get('/locations', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      `SELECT l.*,
              (SELECT count(*) FROM spots WHERE location_id = l.id) as spot_count,
              (SELECT count(*) FROM spots WHERE location_id = l.id AND status = 'available') as available_spots
       FROM locations l
       WHERE l.tenant_id = $1
       ORDER BY l.name ASC`,
      [tenantId]
    );

    res.json(result.rows.map(loc => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      zip: loc.postal_code,
      postal_code: loc.postal_code,
      description: loc.description,
      is_active: loc.is_active,
      spot_count: parseInt(loc.spot_count, 10),
      available_spots: parseInt(loc.available_spots, 10),
      created_at: loc.created_at,
      updated_at: loc.updated_at,
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /locations
// ---------------------------------------------------------------------------
router.post('/locations', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { name, address, zip, city } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({ error: 'BadRequest', message: 'name, address, and city are required.' });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO locations (id, tenant_id, name, address, city, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, tenantId, name, address, city, zip || '']
    );

    const loc = result.rows[0];
    res.status(201).json({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      zip: loc.postal_code,
      postal_code: loc.postal_code,
      spot_count: 0,
      available_spots: 0,
      created_at: loc.created_at,
      updated_at: loc.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /locations/:id
// ---------------------------------------------------------------------------
router.put('/locations/:id', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { name, address, zip, city } = req.body;

    const result = await db.query(
      `UPDATE locations
       SET name = COALESCE($2, name),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           postal_code = COALESCE($5, postal_code)
       WHERE id = $1 AND tenant_id = $6
       RETURNING *`,
      [req.params.id, name, address, city, zip, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const loc = result.rows[0];
    res.json({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      zip: loc.postal_code,
      postal_code: loc.postal_code,
      created_at: loc.created_at,
      updated_at: loc.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /locations/:id
// ---------------------------------------------------------------------------
router.delete('/locations/:id', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      'DELETE FROM locations WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /spots
// ---------------------------------------------------------------------------
router.get('/spots', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      `SELECT s.*, l.name as location_name
       FROM spots s
       LEFT JOIN locations l ON s.location_id = l.id
       WHERE s.tenant_id = $1
       ORDER BY l.name ASC, s.spot_number ASC`,
      [tenantId]
    );

    const statusMap = { available: 'free', active: 'occupied', reserved: 'reserved', suspended: 'suspended' };

    res.json(result.rows.map(spot => ({
      id: spot.id,
      location_id: spot.location_id,
      location_name: spot.location_name,
      number: spot.spot_number,
      spot_number: spot.spot_number,
      price: parseFloat(spot.monthly_rent_eur),
      monthly_rent_eur: parseFloat(spot.monthly_rent_eur),
      status: statusMap[spot.status] || spot.status,
      label: spot.label,
      is_active: spot.is_active,
      created_at: spot.created_at,
      updated_at: spot.updated_at,
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /spots
// ---------------------------------------------------------------------------
router.post('/spots', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { location_id, number, price } = req.body;

    if (!location_id || !number || price === undefined) {
      return res.status(400).json({ error: 'BadRequest', message: 'location_id, number, and price are required.' });
    }

    // Verify location belongs to tenant
    const locCheck = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [location_id, tenantId]
    );
    if (locCheck.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO spots (id, tenant_id, location_id, spot_number, monthly_rent_eur)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, tenantId, location_id, String(number), price]
    );

    const spot = result.rows[0];
    res.status(201).json({
      id: spot.id,
      location_id: spot.location_id,
      number: spot.spot_number,
      spot_number: spot.spot_number,
      price: parseFloat(spot.monthly_rent_eur),
      monthly_rent_eur: parseFloat(spot.monthly_rent_eur),
      status: 'free',
      created_at: spot.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /spots/bulk
// ---------------------------------------------------------------------------
router.post('/spots/bulk', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { location_id, prefix, from, to, price } = req.body;

    if (!location_id || prefix === undefined || from === undefined || to === undefined || price === undefined) {
      return res.status(400).json({ error: 'BadRequest', message: 'location_id, prefix, from, to, and price are required.' });
    }

    if (from > to) {
      return res.status(400).json({ error: 'BadRequest', message: '"from" must be <= "to".' });
    }

    // Verify location belongs to tenant
    const locCheck = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [location_id, tenantId]
    );
    if (locCheck.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const created = [];
    for (let i = from; i <= to; i++) {
      const spotNumber = `${prefix}${i}`;
      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO spots (id, tenant_id, location_id, spot_number, monthly_rent_eur)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, tenantId, location_id, spotNumber, price]
      );
      created.push({
        id: result.rows[0].id,
        number: result.rows[0].spot_number,
        spot_number: result.rows[0].spot_number,
        price: parseFloat(result.rows[0].monthly_rent_eur),
        status: 'free',
      });
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /contracts
// ---------------------------------------------------------------------------
router.get('/contracts', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      `SELECT c.*, cu.name as customer_name, cu.email as customer_email,
              s.spot_number, l.name as location_name
       FROM contracts c
       JOIN customers cu ON c.customer_id = cu.id
       JOIN spots s ON c.spot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE c.tenant_id = $1
       ORDER BY c.created_at DESC`,
      [tenantId]
    );

    res.json(result.rows.map(c => ({
      id: c.id,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      customer_id: c.customer_id,
      spot_id: c.spot_id,
      spot_number: c.spot_number,
      location_name: c.location_name,
      license_plate: c.license_plate,
      monthly_rent_eur: parseFloat(c.monthly_rent_eur),
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /payments
// ---------------------------------------------------------------------------
router.get('/payments', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    let query = `SELECT p.*, cu.name as customer_name, s.spot_number
       FROM payments p
       JOIN contracts c ON p.contract_id = c.id
       JOIN customers cu ON c.customer_id = cu.id
       JOIN spots s ON c.spot_id = s.id
       WHERE p.tenant_id = $1
       ORDER BY p.created_at DESC`;

    const params = [tenantId];

    if (limit && limit > 0) {
      query += ' LIMIT $2';
      params.push(limit);
    }

    const result = await db.query(query, params);

    res.json(result.rows.map(p => ({
      id: p.id,
      contract_id: p.contract_id,
      customer_name: p.customer_name,
      spot_number: p.spot_number,
      amount: parseFloat(p.amount_eur),
      amount_eur: parseFloat(p.amount_eur),
      status: p.status,
      payment_type: p.payment_type,
      paid_at: p.paid_at,
      created_at: p.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// PARKING DURATIONS (authenticated)
// =============================================================================

// ---------------------------------------------------------------------------
// GET /locations/:locationId/durations
// ---------------------------------------------------------------------------
router.get('/locations/:locationId/durations', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      'SELECT * FROM parking_durations WHERE location_id = $1 AND tenant_id = $2 ORDER BY sort_order',
      [req.params.locationId, tenantId]
    );

    res.json(result.rows.map(d => ({
      id: d.id,
      location_id: d.location_id,
      duration_type: d.duration_type,
      label: d.label,
      price_eur: parseFloat(d.price_eur),
      sort_order: d.sort_order,
      is_active: d.is_active,
      created_at: d.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /locations/:locationId/durations
// ---------------------------------------------------------------------------
router.post('/locations/:locationId/durations', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { duration_type, label, price_eur, sort_order } = req.body;

    if (!duration_type || !label || price_eur === undefined) {
      return res.status(400).json({ error: 'BadRequest', message: 'duration_type, label, and price_eur are required.' });
    }

    if (!VALID_DURATION_TYPES.includes(duration_type)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: `Invalid duration_type. Must be one of: ${VALID_DURATION_TYPES.join(', ')}`,
      });
    }

    if (parseFloat(price_eur) <= 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'price_eur must be greater than 0.' });
    }

    // Verify location belongs to tenant
    const locCheck = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [req.params.locationId, tenantId]
    );
    if (locCheck.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const result = await db.query(
      `INSERT INTO parking_durations (location_id, tenant_id, duration_type, label, price_eur, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.params.locationId, tenantId, duration_type, label, price_eur, sort_order || 0]
    );

    const d = result.rows[0];
    res.status(201).json({
      id: d.id,
      location_id: d.location_id,
      duration_type: d.duration_type,
      label: d.label,
      price_eur: parseFloat(d.price_eur),
      sort_order: d.sort_order,
      is_active: d.is_active,
      created_at: d.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /locations/:locationId/durations/:id
// ---------------------------------------------------------------------------
router.delete('/locations/:locationId/durations/:id', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      'DELETE FROM parking_durations WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [req.params.id, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Duration not found.' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// ONBOARDING (authenticated)
// =============================================================================

// ---------------------------------------------------------------------------
// GET /onboarding/status
// ---------------------------------------------------------------------------
router.get('/onboarding/status', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    const result = await db.query(
      `SELECT onboarding_step, onboarding_completed,
              legal_agb_accepted_at, legal_datenschutz_accepted_at, legal_avv_accepted_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Tenant not found.' });
    }

    const t = result.rows[0];
    res.json({
      step: t.onboarding_step || 0,
      completed: t.onboarding_completed || false,
      legal: {
        agb: t.legal_agb_accepted_at ? true : false,
        datenschutz: t.legal_datenschutz_accepted_at ? true : false,
        avv: t.legal_avv_accepted_at ? true : false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /onboarding/step
// ---------------------------------------------------------------------------
router.put('/onboarding/step', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { step } = req.body;

    if (step === undefined || typeof step !== 'number') {
      return res.status(400).json({ error: 'BadRequest', message: 'step (number) is required.' });
    }

    await db.query(
      'UPDATE tenants SET onboarding_step = $2 WHERE id = $1',
      [tenantId, step]
    );

    res.json({ step });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /onboarding/complete
// ---------------------------------------------------------------------------
router.put('/onboarding/complete', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    await db.query(
      'UPDATE tenants SET onboarding_completed = true, onboarding_step = 5 WHERE id = $1',
      [tenantId]
    );

    res.json({ completed: true, step: 5 });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /onboarding/legal
// ---------------------------------------------------------------------------
router.put('/onboarding/legal', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const { agb, datenschutz, avv } = req.body;

    const fields = [];
    const params = [tenantId];
    let paramIdx = 1;

    if (agb === true) {
      paramIdx++;
      fields.push(`legal_agb_accepted_at = $${paramIdx}`);
      params.push(new Date());
    }

    if (datenschutz === true) {
      paramIdx++;
      fields.push(`legal_datenschutz_accepted_at = $${paramIdx}`);
      params.push(new Date());
    }

    if (avv === true) {
      paramIdx++;
      fields.push(`legal_avv_accepted_at = $${paramIdx}`);
      params.push(new Date());
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'At least one legal field must be true.' });
    }

    const result = await db.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $1
       RETURNING legal_agb_accepted_at, legal_datenschutz_accepted_at, legal_avv_accepted_at`,
      params
    );

    const t = result.rows[0];
    res.json({
      legal: {
        agb: t.legal_agb_accepted_at ? true : false,
        datenschutz: t.legal_datenschutz_accepted_at ? true : false,
        avv: t.legal_avv_accepted_at ? true : false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// BOOKING PAGE CONFIG (authenticated)
// =============================================================================

// ---------------------------------------------------------------------------
// GET /locations/:locationId/booking-config
// ---------------------------------------------------------------------------
router.get('/locations/:locationId/booking-config', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;

    // Verify location belongs to tenant
    const locCheck = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [req.params.locationId, tenantId]
    );
    if (locCheck.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const result = await db.query(
      'SELECT * FROM booking_page_config WHERE location_id = $1 AND tenant_id = $2',
      [req.params.locationId, tenantId]
    );

    if (result.rowCount === 0) {
      // Return defaults
      return res.json({
        location_id: req.params.locationId,
        enabled: true,
        primary_color: '#059669',
        accent_color: '#10b981',
        background_color: '#f9fafb',
        text_color: '#111827',
        button_text: 'Jetzt buchen',
        welcome_text: 'Willkommen! Wählen Sie einen Stellplatz.',
        logo_url: null,
        custom_css: null,
        hide_branding: false,
      });
    }

    const c = result.rows[0];
    res.json({
      id: c.id,
      location_id: c.location_id,
      enabled: c.enabled,
      primary_color: c.primary_color,
      accent_color: c.accent_color,
      background_color: c.background_color,
      text_color: c.text_color,
      button_text: c.button_text,
      welcome_text: c.welcome_text,
      logo_url: c.logo_url,
      custom_css: c.custom_css,
      hide_branding: c.hide_branding,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /locations/:locationId/booking-config
// ---------------------------------------------------------------------------
router.put('/locations/:locationId/booking-config', authenticateOperator, async (req, res, next) => {
  try {
    const tenantId = req.operator.id;
    const locationId = req.params.locationId;

    // Verify location belongs to tenant
    const locCheck = await db.query(
      'SELECT id FROM locations WHERE id = $1 AND tenant_id = $2',
      [locationId, tenantId]
    );
    if (locCheck.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const {
      primary_color, accent_color, background_color, text_color,
      button_text, welcome_text, logo_url, custom_css,
      hide_branding, enabled,
    } = req.body;

    const result = await db.query(
      `INSERT INTO booking_page_config (tenant_id, location_id, enabled, primary_color, accent_color, background_color, text_color, button_text, welcome_text, logo_url, custom_css, hide_branding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (location_id)
       DO UPDATE SET
         enabled = COALESCE($3, booking_page_config.enabled),
         primary_color = COALESCE($4, booking_page_config.primary_color),
         accent_color = COALESCE($5, booking_page_config.accent_color),
         background_color = COALESCE($6, booking_page_config.background_color),
         text_color = COALESCE($7, booking_page_config.text_color),
         button_text = COALESCE($8, booking_page_config.button_text),
         welcome_text = COALESCE($9, booking_page_config.welcome_text),
         logo_url = $10,
         custom_css = $11,
         hide_branding = COALESCE($12, booking_page_config.hide_branding),
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId, locationId,
        enabled !== undefined ? enabled : true,
        primary_color || '#059669',
        accent_color || '#10b981',
        background_color || '#f9fafb',
        text_color || '#111827',
        button_text || 'Jetzt buchen',
        welcome_text || 'Willkommen! Wählen Sie einen Stellplatz.',
        logo_url || null,
        custom_css || null,
        hide_branding !== undefined ? hide_branding : false,
      ]
    );

    const c = result.rows[0];
    res.json({
      id: c.id,
      location_id: c.location_id,
      enabled: c.enabled,
      primary_color: c.primary_color,
      accent_color: c.accent_color,
      background_color: c.background_color,
      text_color: c.text_color,
      button_text: c.button_text,
      welcome_text: c.welcome_text,
      logo_url: c.logo_url,
      custom_css: c.custom_css,
      hide_branding: c.hide_branding,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// PUBLIC ENDPOINTS (no auth)
// =============================================================================

// ---------------------------------------------------------------------------
// GET /embed/:locationId  (public, no auth)
// ---------------------------------------------------------------------------
router.get('/embed/:locationId', async (req, res, next) => {
  try {
    const locationId = req.params.locationId;

    // Get location info
    const locResult = await db.query(
      `SELECT l.*, t.name as operator_name, t.slug as operator_slug
       FROM locations l
       JOIN tenants t ON l.tenant_id = t.id
       WHERE l.id = $1 AND l.is_active = true AND t.is_active = true`,
      [locationId]
    );

    if (locResult.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Location not found.' });
    }

    const location = locResult.rows[0];

    // Get booking page config
    const configResult = await db.query(
      'SELECT * FROM booking_page_config WHERE location_id = $1',
      [locationId]
    );

    const config = configResult.rowCount > 0 ? configResult.rows[0] : null;

    const bookingConfig = {
      enabled: config ? config.enabled : true,
      primary_color: config ? config.primary_color : '#059669',
      accent_color: config ? config.accent_color : '#10b981',
      background_color: config ? config.background_color : '#f9fafb',
      text_color: config ? config.text_color : '#111827',
      button_text: config ? config.button_text : 'Jetzt buchen',
      welcome_text: config ? config.welcome_text : 'Willkommen! Wählen Sie einen Stellplatz.',
      logo_url: config ? config.logo_url : null,
      custom_css: config ? config.custom_css : null,
      hide_branding: config ? config.hide_branding : false,
    };

    // Get available spots
    const spotsResult = await db.query(
      `SELECT id, spot_number, monthly_rent_eur, status
       FROM spots
       WHERE location_id = $1 AND is_active = true AND status = 'available'
       ORDER BY spot_number ASC`,
      [locationId]
    );

    // Get parking durations
    const durationsResult = await db.query(
      'SELECT id, duration_type, label, price_eur, sort_order FROM parking_durations WHERE location_id = $1 AND is_active = true ORDER BY sort_order',
      [locationId]
    );

    res.json({
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        postal_code: location.postal_code,
      },
      operator: {
        name: location.operator_name,
        slug: location.operator_slug,
      },
      config: bookingConfig,
      spots: spotsResult.rows.map(s => ({
        id: s.id,
        spot_number: s.spot_number,
        price: parseFloat(s.monthly_rent_eur),
      })),
      durations: durationsResult.rows.map(d => ({
        id: d.id,
        duration_type: d.duration_type,
        label: d.label,
        price_eur: parseFloat(d.price_eur),
        sort_order: d.sort_order,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /public/:slug
// ---------------------------------------------------------------------------
router.get('/public/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Get operator/tenant info
    const tenantResult = await db.query(
      'SELECT id, name, slug, email FROM tenants WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Operator not found.' });
    }

    const tenant = tenantResult.rows[0];

    // Get locations
    const locationsResult = await db.query(
      `SELECT l.*,
              (SELECT count(*) FROM spots WHERE location_id = l.id) as spot_count,
              (SELECT count(*) FROM spots WHERE location_id = l.id AND status = 'available') as available_spots
       FROM locations l
       WHERE l.tenant_id = $1 AND l.is_active = true
       ORDER BY l.name ASC`,
      [tenant.id]
    );

    // Get parking durations for each location
    const durationsResult = await db.query(
      'SELECT * FROM parking_durations WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order',
      [tenant.id]
    );

    // Group durations by location_id
    const durationsByLocation = {};
    for (const d of durationsResult.rows) {
      if (!durationsByLocation[d.location_id]) {
        durationsByLocation[d.location_id] = [];
      }
      durationsByLocation[d.location_id].push({
        id: d.id,
        duration_type: d.duration_type,
        label: d.label,
        price_eur: parseFloat(d.price_eur),
        sort_order: d.sort_order,
      });
    }

    // Get booking page configs for all locations
    const bookingConfigResult = await db.query(
      'SELECT * FROM booking_page_config WHERE tenant_id = $1',
      [tenant.id]
    );

    // Index configs by location_id
    const configByLocation = {};
    for (const c of bookingConfigResult.rows) {
      configByLocation[c.location_id] = {
        enabled: c.enabled,
        primary_color: c.primary_color,
        accent_color: c.accent_color,
        background_color: c.background_color,
        text_color: c.text_color,
        button_text: c.button_text,
        welcome_text: c.welcome_text,
        logo_url: c.logo_url,
        custom_css: c.custom_css,
        hide_branding: c.hide_branding,
      };
    }

    const defaultBookingConfig = {
      enabled: true,
      primary_color: '#059669',
      accent_color: '#10b981',
      background_color: '#f9fafb',
      text_color: '#111827',
      button_text: 'Jetzt buchen',
      welcome_text: 'Willkommen! Wählen Sie einen Stellplatz.',
      logo_url: null,
      custom_css: null,
      hide_branding: false,
    };

    // Get available spots
    const spotsResult = await db.query(
      `SELECT s.id, s.spot_number, s.monthly_rent_eur, s.location_id, s.status, l.name as location_name
       FROM spots s
       LEFT JOIN locations l ON s.location_id = l.id
       WHERE s.tenant_id = $1 AND s.is_active = true AND s.status = 'available'
       ORDER BY l.name ASC, s.spot_number ASC`,
      [tenant.id]
    );

    res.json({
      operator: {
        name: tenant.name,
        slug: tenant.slug,
      },
      locations: locationsResult.rows.map(loc => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        postal_code: loc.postal_code,
        spot_count: parseInt(loc.spot_count, 10),
        available_spots: parseInt(loc.available_spots, 10),
        durations: durationsByLocation[loc.id] || [],
        booking_page_config: configByLocation[loc.id] || defaultBookingConfig,
      })),
      spots: spotsResult.rows.map(s => ({
        id: s.id,
        spot_number: s.spot_number,
        number: s.spot_number,
        price: parseFloat(s.monthly_rent_eur),
        monthly_rent_eur: parseFloat(s.monthly_rent_eur),
        location_id: s.location_id,
        location_name: s.location_name,
        status: s.status === 'available' ? 'free' : s.status,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /public/:slug/book
// ---------------------------------------------------------------------------
router.post('/public/:slug/book', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { spot_id, duration_type, name, email, phone, license_plate, street, zip, city } = req.body;

    // Validate required fields
    if (!spot_id || !name || !email || !license_plate) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'spot_id, name, email, and license_plate are required.',
      });
    }

    // Get tenant
    const tenantResult = await db.query(
      'SELECT id, name, slug, commission_percent FROM tenants WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Operator not found.' });
    }

    const tenant = tenantResult.rows[0];

    // Get spot and verify it's available
    const spotResult = await db.query(
      `SELECT s.*, l.name as location_name
       FROM spots s
       JOIN locations l ON s.location_id = l.id
       WHERE s.id = $1 AND s.tenant_id = $2 AND s.is_active = true AND s.status = 'available'`,
      [spot_id, tenant.id]
    );

    if (spotResult.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Spot not found or not available.' });
    }

    const spot = spotResult.rows[0];

    // Look up duration price if duration_type provided
    let priceEur = parseFloat(spot.monthly_rent_eur);
    if (duration_type) {
      const durationResult = await db.query(
        'SELECT price_eur FROM parking_durations WHERE location_id = $1 AND tenant_id = $2 AND duration_type = $3 AND is_active = true',
        [spot.location_id, tenant.id, duration_type]
      );

      if (durationResult.rowCount > 0) {
        priceEur = parseFloat(durationResult.rows[0].price_eur);
      }
    }

    // Create or update customer
    const customerAddress = [street, zip, city].filter(Boolean).join(', ') || null;

    // Generate a customer number
    const customerCountResult = await db.query(
      'SELECT count(*) as cnt FROM customers WHERE tenant_id = $1',
      [tenant.id]
    );
    const customerNumber = `K-${(parseInt(customerCountResult.rows[0].cnt, 10) + 1).toString().padStart(5, '0')}`;

    const customerResult = await db.query(
      `INSERT INTO customers (tenant_id, customer_number, name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, address = EXCLUDED.address
       RETURNING id`,
      [tenant.id, customerNumber, name, email.toLowerCase(), phone || null, customerAddress]
    );

    const customerId = customerResult.rows[0].id;

    // Create contract
    const contractResult = await db.query(
      `INSERT INTO contracts (tenant_id, spot_id, customer_id, license_plate, monthly_rent_eur, status, start_date)
       VALUES ($1, $2, $3, $4, $5, 'reserved', CURRENT_DATE)
       RETURNING id`,
      [tenant.id, spot_id, customerId, license_plate, priceEur]
    );

    const contractId = contractResult.rows[0].id;

    // Update spot status
    await db.query(
      "UPDATE spots SET status = 'reserved' WHERE id = $1",
      [spot_id]
    );

    res.status(201).json({
      success: true,
      booking_id: contractId,
      message: 'Booking created successfully. Payment will be handled by the operator.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
