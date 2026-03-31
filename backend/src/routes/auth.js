'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { signOperatorToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/v1/auth/register
 * Register a new tenant/operator account
 */
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 characters'),
    body('slug')
      .trim()
      .toLowerCase()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug must be lowercase letters, numbers, and hyphens only'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(errors.array());
      }

      const { name, slug, email, password } = req.body;
      const password_hash = await bcrypt.hash(password, 12);

      const result = await db.query(
        `INSERT INTO tenants (name, slug, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, slug, email, plan, created_at`,
        [name, slug, email, password_hash]
      );

      const tenant = result.rows[0];
      const token = signOperatorToken(tenant);

      logger.info('New tenant registered', { tenantId: tenant.id, slug: tenant.slug });

      res.status(201).json({
        message: 'Registration successful.',
        token,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          email: tenant.email,
          plan: tenant.plan,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Operator login
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(errors.array());
      }

      const { email, password } = req.body;

      const result = await db.query(
        `SELECT id, name, slug, email, password_hash, plan, is_active
         FROM tenants WHERE email = $1`,
        [email]
      );

      const tenant = result.rows[0];

      // Constant-time comparison to prevent timing attacks
      const dummyHash = '$2a$12$dummyhashfordummycomparison00000000000000000000000000000';
      const hashToCompare = tenant ? tenant.password_hash : dummyHash;
      const valid = await bcrypt.compare(password, hashToCompare);

      if (!tenant || !valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password.',
        });
      }

      if (!tenant.is_active) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Account is inactive. Please contact support.',
        });
      }

      const token = signOperatorToken(tenant);

      logger.info('Operator logged in', { tenantId: tenant.id, slug: tenant.slug });

      res.json({
        token,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          email: tenant.email,
          plan: tenant.plan,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/auth/platform/login
 * Platform admin login
 */
router.post(
  '/platform/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(errors.array());
      }

      const { email, password } = req.body;
      const { signPlatformAdminToken } = require('../middleware/auth');

      // Platform admin credentials are stored in env or a separate admin table
      const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
      const adminHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH;

      if (!adminEmail || !adminHash) {
        logger.error('Platform admin credentials not configured');
        return res.status(503).json({ error: 'ServiceUnavailable', message: 'Admin login not configured.' });
      }

      const dummyHash = '$2a$12$dummyhashfordummycomparison00000000000000000000000000000';
      const hashToCompare = email === adminEmail ? adminHash : dummyHash;
      const valid = await bcrypt.compare(password, hashToCompare);

      if (email !== adminEmail || !valid) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials.' });
      }

      const token = signPlatformAdminToken({ id: 'platform-admin', email: adminEmail });
      res.json({ token });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
