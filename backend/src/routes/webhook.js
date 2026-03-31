const express = require('express');
const db = require('../db');
const { createMollieClient } = require('@mollie/api-client');

const router = express.Router();

// POST /webhooks/:tenantSlug/mollie
router.post('/:tenantSlug/mollie', async (req, res) => {
  const { tenantSlug } = req.params;
  const { id: paymentId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: 'payment id is required' });
  }

  // Always respond 200 quickly to Mollie; process asynchronously if needed
  // Here we process synchronously but still respond after processing

  try {
    // Load tenant by slug
    const tenantResult = await db.query(
      `SELECT id, slug, mollie_access_token, commission_percent
       FROM tenants
       WHERE slug = $1`,
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      console.warn(`webhook: tenant not found for slug ${tenantSlug}`);
      return res.status(200).json({ received: true }); // Still 200 to avoid Mollie retries for unknown tenants
    }

    const tenant = tenantResult.rows[0];

    if (!tenant.mollie_access_token) {
      console.warn(`webhook: tenant ${tenantSlug} has no mollie access token`);
      return res.status(200).json({ received: true });
    }

    const mollieClient = createMollieClient({ accessToken: tenant.mollie_access_token });

    // Fetch payment details from Mollie
    let payment;
    try {
      payment = await mollieClient.payments.get(paymentId);
    } catch (mollieErr) {
      console.error(`webhook: failed to fetch payment ${paymentId}:`, mollieErr.message);
      return res.status(200).json({ received: true });
    }

    const metadata = payment.metadata || {};
    const contractId = metadata.contractId;
    const spotId = metadata.spotId;
    const customerId = metadata.customerId;

    if (!contractId) {
      console.warn(`webhook: payment ${paymentId} has no contractId in metadata`);
      return res.status(200).json({ received: true });
    }

    // Load the payment record from DB
    const dbPaymentResult = await db.query(
      `SELECT id, payment_type, mollie_payment_id
       FROM payments
       WHERE mollie_payment_id = $1`,
      [paymentId]
    );

    const dbPayment = dbPaymentResult.rows[0];

    switch (payment.status) {
      case 'paid': {
        if (payment.sequenceType === 'first') {
          // First payment paid -> setup mandate + subscription + activate contract
          await handleFirstPaymentPaid(
            mollieClient,
            payment,
            contractId,
            spotId,
            customerId,
            tenant,
            dbPayment
          );
        } else {
          // Recurring payment paid -> log it
          await handleRecurringPaymentPaid(payment, contractId, dbPayment);
        }
        break;
      }

      case 'failed':
      case 'expired':
      case 'canceled': {
        await handlePaymentFailed(payment, contractId, spotId, dbPayment);
        break;
      }

      default:
        // Status open/pending — update payment status in DB
        if (dbPayment) {
          await db.query(
            `UPDATE payments SET status = $1, updated_at = NOW() WHERE mollie_payment_id = $2`,
            [payment.status, paymentId]
          );
        }
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`webhook error for tenant ${tenantSlug}:`, err);
    // Still return 200 to prevent Mollie from retrying indefinitely on transient errors
    // For critical errors you may want to return 500 so Mollie retries
    return res.status(500).json({ error: 'webhook processing failed' });
  }
});

async function handleFirstPaymentPaid(
  mollieClient,
  payment,
  contractId,
  spotId,
  customerId,
  tenant,
  dbPayment
) {
  await db.query('BEGIN');

  try {
    // 1. Find and store the mandate
    const mollieCustomerId = payment.customerId;
    let mandateId = null;

    if (mollieCustomerId) {
      try {
        const mandates = await mollieClient.customerMandates.list({ customerId: mollieCustomerId });
        const validMandate = mandates.find((m) => m.status === 'valid');
        if (validMandate) {
          mandateId = validMandate.id;

          // Save mandate to customer record
          await db.query(
            `UPDATE customers
             SET mollie_customer_id = $1, mollie_mandate_id = $2, updated_at = NOW()
             WHERE id = $3`,
            [mollieCustomerId, mandateId, customerId]
          );
        }
      } catch (mandateErr) {
        console.warn('could not fetch mandates:', mandateErr.message);
      }
    }

    // 2. Get monthly price from contract/spot
    const spotResult = await db.query(
      'SELECT monthly_price FROM spots WHERE id = $1',
      [spotId]
    );

    const monthlyPrice = spotResult.rows[0]?.monthly_price;

    // 3. Create monthly Mollie subscription
    if (mollieCustomerId && monthlyPrice && mandateId) {
      try {
        const subscriptionData = {
          amount: {
            currency: 'EUR',
            value: parseFloat(monthlyPrice).toFixed(2),
          },
          interval: '1 month',
          description: `Monatliche Parkgebuehr (Vertrag #${contractId})`,
          webhookUrl: `${process.env.APP_URL}/webhooks/${tenant.slug}/mollie`,
          mandateId,
          metadata: {
            contractId: contractId.toString(),
            tenantId: tenant.id.toString(),
            spotId: spotId.toString(),
          },
          ...(tenant.commission_percent > 0 && {
            applicationFee: {
              amount: {
                currency: 'EUR',
                value: (parseFloat(monthlyPrice) * (tenant.commission_percent / 100)).toFixed(2),
              },
              description: 'ParkSaaS platform fee',
            },
          }),
        };

        const subscription = await mollieClient.customerSubscriptions.create({
          customerId: mollieCustomerId,
          ...subscriptionData,
        });

        // Store subscription ID on contract
        await db.query(
          `UPDATE contracts
           SET mollie_subscription_id = $1, mollie_customer_id = $2, updated_at = NOW()
           WHERE id = $3`,
          [subscription.id, mollieCustomerId, contractId]
        );
      } catch (subErr) {
        console.error('failed to create subscription:', subErr.message);
        // Non-fatal: we still activate the contract
      }
    }

    // 4. Activate contract
    await db.query(
      `UPDATE contracts
       SET status = 'active', start_date = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [contractId]
    );

    // 5. Mark spot as active (occupied)
    await db.query(
      `UPDATE spots
       SET status = 'active', reserved_until = NULL, updated_at = NOW()
       WHERE id = $1`,
      [spotId]
    );

    // 6. Update payment record
    if (dbPayment) {
      await db.query(
        `UPDATE payments
         SET status = 'paid', paid_at = NOW(), updated_at = NOW()
         WHERE mollie_payment_id = $1`,
        [payment.id]
      );
    } else {
      await db.query(
        `INSERT INTO payments (contract_id, mollie_payment_id, amount, status, payment_type, paid_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'paid', 'first', NOW(), NOW(), NOW())`,
        [contractId, payment.id, parseFloat(payment.amount.value)]
      );
    }

    await db.query('COMMIT');
    console.log(`contract ${contractId} activated after first payment ${payment.id}`);
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

async function handleRecurringPaymentPaid(payment, contractId, dbPayment) {
  try {
    if (dbPayment) {
      await db.query(
        `UPDATE payments
         SET status = 'paid', paid_at = NOW(), updated_at = NOW()
         WHERE mollie_payment_id = $1`,
        [payment.id]
      );
    } else {
      await db.query(
        `INSERT INTO payments (contract_id, mollie_payment_id, amount, status, payment_type, paid_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'paid', 'recurring', NOW(), NOW(), NOW())`,
        [contractId, payment.id, parseFloat(payment.amount.value)]
      );
    }

    console.log(`recurring payment ${payment.id} logged for contract ${contractId}`);
  } catch (err) {
    console.error('failed to log recurring payment:', err.message);
    throw err;
  }
}

async function handlePaymentFailed(payment, contractId, spotId, dbPayment) {
  await db.query('BEGIN');

  try {
    // Update payment record
    if (dbPayment) {
      await db.query(
        `UPDATE payments
         SET status = $1, updated_at = NOW()
         WHERE mollie_payment_id = $2`,
        [payment.status, payment.id]
      );
    } else {
      await db.query(
        `INSERT INTO payments (contract_id, mollie_payment_id, amount, status, payment_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, 'first'), NOW(), NOW())`,
        [
          contractId,
          payment.id,
          parseFloat(payment.amount.value),
          payment.status,
          payment.sequenceType,
        ]
      );
    }

    // Suspend contract
    await db.query(
      `UPDATE contracts SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [contractId]
    );

    // Suspend spot if it was a first payment failure (spot never activated)
    if (payment.sequenceType === 'first') {
      await db.query(
        `UPDATE spots
         SET status = 'available', reserved_until = NULL, updated_at = NOW()
         WHERE id = $1`,
        [spotId]
      );
    } else {
      // Recurring payment failed -> suspend spot
      await db.query(
        `UPDATE spots SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [spotId]
      );
    }

    await db.query('COMMIT');
    console.log(`payment ${payment.id} failed, contract ${contractId} suspended`);
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

// Handle subscription webhook events
// Mollie sends subscription cancellation as a separate payment webhook with status 'canceled'
// but we also handle the subscription.canceled event which Mollie may send as an id prefixed 'sub_'
router.post('/:tenantSlug/mollie/subscription', async (req, res) => {
  const { tenantSlug } = req.params;
  const { id: subscriptionId } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscription id is required' });
  }

  try {
    const tenantResult = await db.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(200).json({ received: true });
    }

    const tenant = tenantResult.rows[0];

    // Find contract by subscription ID
    const contractResult = await db.query(
      `SELECT c.id, c.spot_id
       FROM contracts c
       JOIN spots s ON s.id = c.spot_id
       JOIN locations l ON l.id = s.location_id
       WHERE c.mollie_subscription_id = $1
         AND l.tenant_id = $2`,
      [subscriptionId, tenant.id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(200).json({ received: true });
    }

    const contract = contractResult.rows[0];

    // End contract and free the spot
    await db.query('BEGIN');

    await db.query(
      `UPDATE contracts SET status = 'ended', end_date = NOW(), updated_at = NOW() WHERE id = $1`,
      [contract.id]
    );

    await db.query(
      `UPDATE spots SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [contract.spot_id]
    );

    await db.query('COMMIT');

    console.log(`subscription ${subscriptionId} canceled, contract ${contract.id} ended`);

    return res.status(200).json({ received: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error(`subscription webhook error for tenant ${tenantSlug}:`, err);
    return res.status(500).json({ error: 'webhook processing failed' });
  }
});

module.exports = router;
