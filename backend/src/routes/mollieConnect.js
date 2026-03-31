const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireOperator } = require('../middleware/auth');
const { createMollieClient } = require('@mollie/api-client');

const router = express.Router();

const MOLLIE_AUTH_URL = 'https://www.mollie.com/oauth2/authorize';
const MOLLIE_TOKEN_URL = 'https://api.mollie.com/oauth2/tokens';
const MOLLIE_SCOPES = [
  'payments.read',
  'payments.write',
  'subscriptions.read',
  'subscriptions.write',
  'mandates.read',
  'mandates.write',
  'customers.read',
  'customers.write',
  'profiles.read',
  'onboarding.read',
].join(' ');

function getMollieBasicAuth() {
  const credentials = Buffer.from(
    `${process.env.MOLLIE_CLIENT_ID}:${process.env.MOLLIE_CLIENT_SECRET}`
  ).toString('base64');
  return `Basic ${credentials}`;
}

// GET /api/mollie/connect
router.get('/connect', requireOperator, async (req, res) => {
  try {
    // Sign a short-lived state token with tenantId to protect against CSRF
    const state = jwt.sign(
      { tenantId: req.tenant.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const params = new URLSearchParams({
      client_id: process.env.MOLLIE_CLIENT_ID,
      redirect_uri: process.env.MOLLIE_REDIRECT_URI,
      response_type: 'code',
      scope: MOLLIE_SCOPES,
      state,
    });

    return res.redirect(`${MOLLIE_AUTH_URL}?${params.toString()}`);
  } catch (err) {
    console.error('mollie connect error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/mollie/connect/callback
router.get('/connect/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.status(400).json({ error: `OAuth error: ${oauthError}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'code and state are required' });
  }

  let tenantId;
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    tenantId = decoded.tenantId;
  } catch (err) {
    return res.status(400).json({ error: 'invalid or expired state parameter' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      MOLLIE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.MOLLIE_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          Authorization: getMollieBasicAuth(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
    } = tokenResponse.data;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Fetch onboarding status using the new token
    let onboardingStatus = 'needs-data';
    let profileId = null;
    try {
      const mollieClient = createMollieClient({ accessToken: access_token });
      const onboarding = await mollieClient.onboarding.get();
      onboardingStatus = onboarding.status;

      const profiles = await mollieClient.profiles.list();
      if (profiles && profiles.length > 0) {
        profileId = profiles[0].id;
      }
    } catch (mollieErr) {
      console.warn('could not fetch onboarding/profile info:', mollieErr.message);
    }

    await db.query(
      `UPDATE tenants
       SET mollie_access_token = $1,
           mollie_refresh_token = $2,
           mollie_token_expires_at = $3,
           mollie_onboarding_status = $4,
           mollie_profile_id = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [access_token, refresh_token, expiresAt, onboardingStatus, profileId, tenantId]
    );

    // Redirect to dashboard or return JSON depending on setup
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard?mollie=connected`);
  } catch (err) {
    console.error('mollie callback error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'failed to exchange OAuth token' });
  }
});

// POST /api/mollie/connect/refresh
router.post('/connect/refresh', requireOperator, async (req, res) => {
  try {
    const tenantResult = await db.query(
      'SELECT mollie_refresh_token FROM tenants WHERE id = $1',
      [req.tenant.id]
    );

    const tenant = tenantResult.rows[0];

    if (!tenant || !tenant.mollie_refresh_token) {
      return res.status(400).json({ error: 'no refresh token available, please reconnect Mollie' });
    }

    const tokenResponse = await axios.post(
      MOLLIE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tenant.mollie_refresh_token,
      }).toString(),
      {
        headers: {
          Authorization: getMollieBasicAuth(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await db.query(
      `UPDATE tenants
       SET mollie_access_token = $1,
           mollie_refresh_token = $2,
           mollie_token_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [access_token, refresh_token || tenant.mollie_refresh_token, expiresAt, req.tenant.id]
    );

    return res.json({ message: 'token refreshed successfully', expiresAt });
  } catch (err) {
    console.error('mollie refresh error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'failed to refresh Mollie token' });
  }
});

// GET /api/mollie/connect/status
router.get('/connect/status', requireOperator, async (req, res) => {
  try {
    const tenantResult = await db.query(
      `SELECT mollie_access_token, mollie_onboarding_status, mollie_profile_id,
              mollie_token_expires_at
       FROM tenants WHERE id = $1`,
      [req.tenant.id]
    );

    const tenant = tenantResult.rows[0];

    if (!tenant || !tenant.mollie_access_token) {
      return res.json({ connected: false, onboardingStatus: null });
    }

    // Optionally refresh onboarding status live from Mollie
    let onboardingStatus = tenant.mollie_onboarding_status;
    try {
      const mollieClient = createMollieClient({ accessToken: tenant.mollie_access_token });
      const onboarding = await mollieClient.onboarding.get();
      onboardingStatus = onboarding.status;

      if (onboardingStatus !== tenant.mollie_onboarding_status) {
        await db.query(
          'UPDATE tenants SET mollie_onboarding_status = $1, updated_at = NOW() WHERE id = $2',
          [onboardingStatus, req.tenant.id]
        );
      }
    } catch (mollieErr) {
      console.warn('could not fetch live onboarding status:', mollieErr.message);
    }

    return res.json({
      connected: true,
      onboardingStatus,
      profileId: tenant.mollie_profile_id,
      tokenExpiresAt: tenant.mollie_token_expires_at,
    });
  } catch (err) {
    console.error('mollie status error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /api/mollie/connect
router.delete('/connect', requireOperator, async (req, res) => {
  try {
    // Revoke token at Mollie
    const tenantResult = await db.query(
      'SELECT mollie_access_token FROM tenants WHERE id = $1',
      [req.tenant.id]
    );

    const tenant = tenantResult.rows[0];

    if (tenant && tenant.mollie_access_token) {
      try {
        await axios.delete(`${MOLLIE_TOKEN_URL}`, {
          headers: {
            Authorization: getMollieBasicAuth(),
          },
          data: {
            token: tenant.mollie_access_token,
            token_type_hint: 'access_token',
          },
        });
      } catch (revokeErr) {
        console.warn('could not revoke Mollie token:', revokeErr.message);
        // Continue regardless
      }
    }

    await db.query(
      `UPDATE tenants
       SET mollie_access_token = NULL,
           mollie_refresh_token = NULL,
           mollie_token_expires_at = NULL,
           mollie_onboarding_status = NULL,
           mollie_profile_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [req.tenant.id]
    );

    return res.json({ message: 'Mollie connection removed successfully' });
  } catch (err) {
    console.error('mollie disconnect error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
