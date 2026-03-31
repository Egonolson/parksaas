const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireOperator } = require('../middleware/auth');

const router = express.Router();

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

// POST /api/operators/register
router.post('/register', async (req, res) => {
  const { name, email, password, slug } = req.body;

  if (!name || !email || !password || !slug) {
    return res.status(400).json({ error: 'name, email, password and slug are required' });
  }

  if (!SLUG_REGEX.test(slug)) {
    return res.status(400).json({
      error: 'slug must be lowercase, contain only letters, numbers and hyphens, and be 3-50 characters long'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    // Check unique email
    const emailCheck = await db.query('SELECT id FROM tenants WHERE email = $1', [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'email already registered' });
    }

    // Check unique slug
    const slugCheck = await db.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.rows.length > 0) {
      return res.status(409).json({ error: 'slug already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO tenants (name, email, password_hash, slug, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, email, slug, created_at`,
      [name, email.toLowerCase(), passwordHash, slug]
    );

    const tenant = result.rows[0];

    const token = jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ token, tenant });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/operators/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, email, slug, password_hash, created_at, mollie_access_token, mollie_onboarding_status FROM tenants WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const tenant = result.rows[0];

    const valid = await bcrypt.compare(password, tenant.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...tenantData } = tenant;

    return res.json({ token, tenant: tenantData });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/operators/me
router.get('/me', requireOperator, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, slug, commission_percent, mollie_onboarding_status,
              mollie_profile_id, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [req.tenant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'tenant not found' });
    }

    return res.json({ tenant: result.rows[0] });
  } catch (err) {
    console.error('get me error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PUT /api/operators/me
router.put('/me', requireOperator, async (req, res) => {
  const { name, email, slug, password } = req.body;

  try {
    const current = await db.query(
      'SELECT id, name, email, slug FROM tenants WHERE id = $1',
      [req.tenant.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'tenant not found' });
    }

    const existing = current.rows[0];

    // Validate new slug if provided
    if (slug && slug !== existing.slug) {
      if (!SLUG_REGEX.test(slug)) {
        return res.status(400).json({
          error: 'slug must be lowercase, contain only letters, numbers and hyphens, and be 3-50 characters long'
        });
      }
      const slugCheck = await db.query(
        'SELECT id FROM tenants WHERE slug = $1 AND id != $2',
        [slug, req.tenant.id]
      );
      if (slugCheck.rows.length > 0) {
        return res.status(409).json({ error: 'slug already taken' });
      }
    }

    // Validate new email if provided
    if (email && email.toLowerCase() !== existing.email) {
      const emailCheck = await db.query(
        'SELECT id FROM tenants WHERE email = $1 AND id != $2',
        [email.toLowerCase(), req.tenant.id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'email already registered' });
      }
    }

    const updates = {
      name: name || existing.name,
      email: email ? email.toLowerCase() : existing.email,
      slug: slug || existing.slug,
    };

    let passwordClause = '';
    const params = [updates.name, updates.email, updates.slug, req.tenant.id];

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      passwordClause = ', password_hash = $5';
      params.splice(3, 0, passwordHash);
      params[params.length - 1] = req.tenant.id;
    }

    const idxId = password ? 5 : 4;
    const query = `
      UPDATE tenants
      SET name = $1, email = $2, slug = $3${passwordClause}, updated_at = NOW()
      WHERE id = $${idxId}
      RETURNING id, name, email, slug, commission_percent, mollie_onboarding_status, created_at, updated_at
    `;

    const result = await db.query(query, params);

    return res.json({ tenant: result.rows[0] });
  } catch (err) {
    console.error('update me error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
