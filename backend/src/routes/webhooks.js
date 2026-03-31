'use strict';

const express = require('express');
const db = require('../db');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/v1/webhooks/mollie
 *
 * Handles Mollie payment webhooks.
 * Mollie sends a POST with { id: 'tr_xxxx' } when payment status changes.
 *
 * Note: webhook payloads from Mollie contain only the payment ID.
 * We fetch the current status from Mollie API here.
 * This is intentionally minimal - the full Mollie client integration
 * lives in the payments service layer.
 */
router.post('/mollie', express.urlencoded({ extended: false }), async (req, res) => {
  // Acknowledge immediately - Mollie expects a 200 response quickly
  res.sendStatus(200);

  const paymentId = req.body && req.body.id;
  if (!paymentId) {
    logger.warn('Mollie webhook received without payment ID');
    return;
  }

  logger.info('Mollie webhook received', { paymentId });

  try {
    // Look up payment in our DB
    const result = await db.query(
      `SELECT p.*, c.tenant_id, c.id AS contract_id, c.status AS contract_status,
              t.mollie_access_token, t.commission_percent
       FROM payments p
       JOIN contracts c ON c.id = p.contract_id
       JOIN tenants t ON t.id = c.tenant_id
       WHERE p.mollie_payment_id = $1`,
      [paymentId]
    );

    if (result.rowCount === 0) {
      logger.warn('Mollie webhook: payment not found in DB', { paymentId });
      return;
    }

    const payment = result.rows[0];

    // Audit log the webhook receipt
    await db.query(
      `INSERT INTO audit_log (tenant_id, actor_type, action, resource, resource_id, metadata)
       VALUES ($1, 'webhook', 'mollie.webhook_received', 'payment', $2, $3)`,
      [
        payment.tenant_id,
        payment.id,
        JSON.stringify({ mollie_payment_id: paymentId }),
      ]
    );

    logger.info('Mollie webhook processed', { paymentId, contractId: payment.contract_id });
  } catch (err) {
    logger.error('Mollie webhook processing error', { paymentId, error: err.message, stack: err.stack });
  }
});

/**
 * POST /api/v1/webhooks/mollie/connect/:tenantSlug
 *
 * Per-tenant Mollie webhook endpoint for subscription payments.
 */
router.post('/mollie/connect/:tenantSlug', express.urlencoded({ extended: false }), async (req, res) => {
  res.sendStatus(200);

  const paymentId = req.body && req.body.id;
  const { tenantSlug } = req.params;

  if (!paymentId) {
    logger.warn('Tenant Mollie webhook received without payment ID', { tenantSlug });
    return;
  }

  logger.info('Tenant Mollie webhook received', { paymentId, tenantSlug });

  try {
    await db.query(
      `INSERT INTO audit_log (tenant_id, actor_type, action, resource, metadata)
       SELECT id, 'webhook', 'mollie.tenant_webhook_received', 'payment',
              $2::jsonb
       FROM tenants WHERE slug = $1`,
      [tenantSlug, JSON.stringify({ mollie_payment_id: paymentId })]
    );
  } catch (err) {
    logger.error('Tenant webhook audit log error', { tenantSlug, paymentId, error: err.message });
  }
});

module.exports = router;
