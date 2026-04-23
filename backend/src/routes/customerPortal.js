'use strict';

const express = require('express');
const db = require('../db');
const { authenticateCustomer } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require customer authentication
router.use(authenticateCustomer);

/**
 * GET /customer/profile
 * Return the authenticated customer's profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT name, email, phone, customer_type, company_name, tax_id, street, zip, city
       FROM customers WHERE id = $1`,
      [req.customer.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /customer/profile
 * Update the authenticated customer's profile
 */
router.put('/profile', async (req, res, next) => {
  try {
    const { name, phone, customer_type, company_name, tax_id, street, zip, city } = req.body;

    // Validate customer_type if provided
    if (customer_type !== undefined && !['private', 'business'].includes(customer_type)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'customer_type must be "private" or "business".',
      });
    }

    const fields = [];
    const params = [req.customer.id];
    let paramIdx = 1;

    if (name !== undefined) {
      paramIdx++;
      fields.push(`name = $${paramIdx}`);
      params.push(name);
    }
    if (phone !== undefined) {
      paramIdx++;
      fields.push(`phone = $${paramIdx}`);
      params.push(phone);
    }
    if (customer_type !== undefined) {
      paramIdx++;
      fields.push(`customer_type = $${paramIdx}`);
      params.push(customer_type);
    }
    if (company_name !== undefined) {
      paramIdx++;
      fields.push(`company_name = $${paramIdx}`);
      params.push(company_name);
    }
    if (tax_id !== undefined) {
      paramIdx++;
      fields.push(`tax_id = $${paramIdx}`);
      params.push(tax_id);
    }
    if (street !== undefined) {
      paramIdx++;
      fields.push(`street = $${paramIdx}`);
      params.push(street);
    }
    if (zip !== undefined) {
      paramIdx++;
      fields.push(`zip = $${paramIdx}`);
      params.push(zip);
    }
    if (city !== undefined) {
      paramIdx++;
      fields.push(`city = $${paramIdx}`);
      params.push(city);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'No fields to update.' });
    }

    const result = await db.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $1
       RETURNING name, email, phone, customer_type, company_name, tax_id, street, zip, city`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found.' });
    }

    logger.info('Customer profile updated', { customerId: req.customer.id });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /customer/bookings
 * Return the authenticated customer's contracts/bookings
 */
router.get('/bookings', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, s.spot_number, l.name as location_name, l.address as location_address, l.city as location_city
       FROM contracts c
       JOIN spots s ON c.spot_id = s.id
       JOIN locations l ON s.location_id = l.id
       WHERE c.customer_id = $1
       ORDER BY c.created_at DESC`,
      [req.customer.id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /customer/invoices
 * Return the authenticated customer's invoices
 */
router.get('/invoices', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC`,
      [req.customer.id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /customer/invoices/:id
 * Return a single invoice with all details
 */
router.get('/invoices/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM invoices WHERE id = $1 AND customer_id = $2`,
      [req.params.id, req.customer.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Invoice not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
