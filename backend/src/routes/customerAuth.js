'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signCustomerToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /auth/customer/tenants
 * List active tenants for customer self-registration
 */
router.get('/tenants', async (_req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.slug, t.name,
              (SELECT count(*)::int FROM spots s WHERE s.tenant_id = t.id AND s.is_active = true AND s.status = 'available') AS available_spots
       FROM tenants t
       WHERE t.is_active = true
       ORDER BY available_spots DESC, t.name ASC`
    );

    res.json({
      tenants: result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        available_spots: parseInt(row.available_spots, 10) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/customer/login
 * Customer login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Email and password are required.',
      });
    }

    const result = await db.query(
      `SELECT id, tenant_id, name, email, password_hash, phone,
              customer_type, company_name, tax_id, street, zip, city
       FROM customers WHERE email = $1 AND password_hash IS NOT NULL
       LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    const customer = result.rows[0];

    // Constant-time comparison to prevent timing attacks
    const dummyHash = '$2a$12$dummyhashfordummycomparison00000000000000000000000000000';
    const hashToCompare = customer ? customer.password_hash : dummyHash;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!customer || !valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const token = signCustomerToken(customer);

    logger.info('Customer logged in', { customerId: customer.id, email: customer.email });

    res.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        customer_type: customer.customer_type,
        company_name: customer.company_name,
        phone: customer.phone,
        street: customer.street,
        zip: customer.zip,
        city: customer.city,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/customer/register
 * Customer self-registration
 */
router.post('/register', async (req, res, next) => {
  try {
    const {
      email, password, name, phone,
      customer_type, company_name, tax_id,
      street, zip, city, tenant_slug,
      legal_agb_accepted, legal_datenschutz_accepted,
    } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'email, password, and name are required.',
      });
    }

    // Require legal acceptance
    if (!legal_agb_accepted || !legal_datenschutz_accepted) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Both legal_agb_accepted and legal_datenschutz_accepted must be true.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Password must be at least 8 characters.',
      });
    }

    // Validate customer_type
    const type = customer_type || 'private';
    if (!['private', 'business'].includes(type)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'customer_type must be "private" or "business".',
      });
    }

    // Resolve tenant by explicit slug or, as fallback, single active tenant on the platform
    let tenantResult;
    if (tenant_slug && tenant_slug.trim()) {
      tenantResult = await db.query(
        'SELECT id FROM tenants WHERE slug = $1 AND is_active = true',
        [tenant_slug.toLowerCase().trim()]
      );
    } else {
      tenantResult = await db.query(
        'SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 2'
      );
      if (tenantResult.rowCount > 1) {
        return res.status(400).json({
          error: 'TenantSelectionRequired',
          message: 'Bitte wählen Sie zuerst einen Betreiber aus.',
        });
      }
    }

    if (tenantResult.rowCount === 0) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Tenant not found.',
      });
    }

    const tenantId = tenantResult.rows[0].id;

    // Check email uniqueness within this tenant
    const existing = await db.query(
      'SELECT id FROM customers WHERE email = $1 AND tenant_id = $2',
      [email.toLowerCase().trim(), tenantId]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A customer with this email already exists for this tenant.',
      });
    }

    // Hash password and create customer
    const password_hash = await bcrypt.hash(password, 12);

    const now = new Date();
    const customer_number = `CUS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO customers (tenant_id, customer_number, name, email, phone, password_hash, customer_type, company_name, tax_id, street, zip, city, legal_agb_accepted_at, legal_datenschutz_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, tenant_id, customer_number, name, email, phone, customer_type, company_name, tax_id, street, zip, city`,
      [tenantId, customer_number, name, email.toLowerCase().trim(), phone || null, password_hash, type, company_name || null, tax_id || null, street || null, zip || null, city || null, legal_agb_accepted ? now : null, legal_datenschutz_accepted ? now : null]
    );

    const customer = insertResult.rows[0];
    const token = signCustomerToken(customer);

    logger.info('Customer registered', { customerId: customer.id, tenantId, email: customer.email });

    res.status(201).json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        customer_type: customer.customer_type,
        company_name: customer.company_name,
        phone: customer.phone,
        street: customer.street,
        zip: customer.zip,
        city: customer.city,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
