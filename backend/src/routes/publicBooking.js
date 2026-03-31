const express = require('express');
const db = require('../db');
const { createMollieClient } = require('@mollie/api-client');

const router = express.Router();

// Helper to load tenant by slug
async function getTenantBySlug(slug) {
  const result = await db.query(
    `SELECT id, name, slug, commission_percent, mollie_access_token, mollie_profile_id
     FROM tenants
     WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

// GET /park/:tenantSlug/info
router.get('/:tenantSlug/info', async (req, res) => {
  const { tenantSlug } = req.params;

  try {
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return res.status(404).json({ error: 'parking operator not found' });
    }

    return res.json({
      name: tenant.name,
      slug: tenant.slug,
    });
  } catch (err) {
    console.error('get tenant info error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /park/:tenantSlug/spots
router.get('/:tenantSlug/spots', async (req, res) => {
  const { tenantSlug } = req.params;

  try {
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return res.status(404).json({ error: 'parking operator not found' });
    }

    // Only return spots that are available and not past reservation expiry
    const result = await db.query(
      `SELECT s.id, s.name, s.description, s.monthly_price,
              l.name AS location_name, l.address, l.city, l.postal_code
       FROM spots s
       JOIN locations l ON l.id = s.location_id
       WHERE l.tenant_id = $1
         AND s.is_active = true
         AND l.is_active = true
         AND s.status = 'available'
         AND (s.reserved_until IS NULL OR s.reserved_until < NOW())
       ORDER BY l.name, s.name`,
      [tenant.id]
    );

    return res.json({ spots: result.rows });
  } catch (err) {
    console.error('get public spots error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /park/:tenantSlug/book
router.post('/:tenantSlug/book', async (req, res) => {
  const { tenantSlug } = req.params;
  const { spotId, name, email, phone, licensePlate, address } = req.body;

  // Validate required fields
  if (!spotId || !name || !email || !phone || !licensePlate) {
    return res.status(400).json({
      error: 'spotId, name, email, phone and licensePlate are required'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'invalid email address' });
  }

  const client = await db.connect ? db.connect() : null;

  // Use transaction for atomicity
  try {
    await db.query('BEGIN');

    // Load tenant
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'parking operator not found' });
    }

    if (!tenant.mollie_access_token) {
      await db.query('ROLLBACK');
      return res.status(503).json({ error: 'online booking temporarily unavailable' });
    }

    // 1. SELECT FOR UPDATE to prevent race conditions
    const spotResult = await db.query(
      `SELECT s.id, s.name, s.monthly_price, s.status, s.is_active, s.reserved_until,
              l.tenant_id
       FROM spots s
       JOIN locations l ON l.id = s.location_id
       WHERE s.id = $1
         AND l.tenant_id = $2
         AND s.is_active = true
         AND l.is_active = true
       FOR UPDATE`,
      [spotId, tenant.id]
    );

    if (spotResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'spot not found' });
    }

    const spot = spotResult.rows[0];

    // Check availability
    const isReserved =
      spot.status === 'reserved' &&
      spot.reserved_until &&
      new Date(spot.reserved_until) > new Date();

    if (spot.status === 'active' || isReserved) {
      await db.query('ROLLBACK');
      return res.status(409).json({ error: 'spot is no longer available' });
    }

    // 2. Reserve the spot for 30 minutes
    const reservedUntil = new Date(Date.now() + 30 * 60 * 1000);
    await db.query(
      `UPDATE spots SET status = 'reserved', reserved_until = $1, updated_at = NOW() WHERE id = $2`,
      [reservedUntil, spot.id]
    );

    // 3. Upsert customer (by email + tenant)
    const customerResult = await db.query(
      `INSERT INTO customers (tenant_id, name, email, phone, license_plate, address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (tenant_id, email) DO UPDATE
         SET name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             license_plate = EXCLUDED.license_plate,
             address = EXCLUDED.address,
             updated_at = NOW()
       RETURNING id`,
      [tenant.id, name, email.toLowerCase(), phone, licensePlate, address || null]
    );

    const customerId = customerResult.rows[0].id;

    // 4. Create contract with status=reserved
    const contractResult = await db.query(
      `INSERT INTO contracts (spot_id, customer_id, status, start_date, created_at, updated_at)
       VALUES ($1, $2, 'reserved', NOW(), NOW(), NOW())
       RETURNING id`,
      [spot.id, customerId]
    );

    const contractId = contractResult.rows[0].id;

    // 5. Create Mollie first payment for SEPA mandate (0.01 EUR)
    const mollieClient = createMollieClient({ accessToken: tenant.mollie_access_token });

    const webhookUrl = `${process.env.APP_URL}/webhooks/${tenantSlug}/mollie`;
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/park/${tenantSlug}/booking/${contractId}/status`;

    const paymentData = {
      amount: {
        currency: 'EUR',
        value: '0.01',
      },
      description: `Parkplatz-Mandat: ${spot.name}`,
      redirectUrl,
      webhookUrl,
      sequenceType: 'first',
      method: ['directdebit'],
      metadata: {
        contractId: contractId.toString(),
        tenantId: tenant.id.toString(),
        customerId: customerId.toString(),
        spotId: spot.id.toString(),
      },
      ...(tenant.commission_percent > 0 && {
        applicationFee: {
          amount: {
            currency: 'EUR',
            value: (0.01 * (tenant.commission_percent / 100)).toFixed(2),
          },
          description: `ParkSaaS platform fee`,
        },
      }),
    };

    // Add profile ID if available
    if (tenant.mollie_profile_id) {
      paymentData.profileId = tenant.mollie_profile_id;
    }

    let payment;
    try {
      payment = await mollieClient.payments.create(paymentData);
    } catch (mollieErr) {
      await db.query('ROLLBACK');
      console.error('mollie payment creation error:', mollieErr);
      return res.status(502).json({ error: 'failed to create payment, please try again' });
    }

    // Log the initial payment record
    await db.query(
      `INSERT INTO payments (contract_id, mollie_payment_id, amount, status, payment_type, created_at, updated_at)
       VALUES ($1, $2, $3, 'open', 'first', NOW(), NOW())`,
      [contractId, payment.id, 0.01]
    );

    await db.query('COMMIT');

    return res.status(201).json({
      contractId,
      checkoutUrl: payment.getCheckoutUrl(),
    });
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('rollback error:', rollbackErr);
    }
    console.error('booking error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
