'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  signCustomerToken: jest.fn(() => 'test-customer-token'),
}));

const db = require('../src/db');
const customerAuthRoutes = require('../src/routes/customerAuth');

describe('POST /register (customer)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', customerAuthRoutes);
    app.use((err, _req, res, _next) => {
      return res.status(500).json({ message: err.message || 'internal error' });
    });
    db.query.mockReset();
  });

  test('registers without tenant_slug when exactly one active tenant exists', async () => {
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'tenant-1' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'customer-1',
            name: 'Max Kunde',
            email: 'kunde@example.com',
            customer_type: 'private',
            company_name: null,
            phone: '+491****4567',
            street: 'Musterstraße 1',
            zip: '20095',
            city: 'Hamburg',
          },
        ],
      });

    const res = await request(app)
      .post('/register')
      .send({
        name: 'Max Kunde',
        email: 'kunde@example.com',
        phone: '+491****4567',
        street: 'Musterstraße 1',
        zip: '20095',
        city: 'Hamburg',
        password: 'Test1234!',
        legal_agb_accepted: true,
        legal_datenschutz_accepted: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.customer.email).toBe('kunde@example.com');
  });

  test('returns disambiguation error when multiple tenants exist and no tenant_slug provided', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 't1' }, { id: 't2' }] });

    const res = await request(app)
      .post('/register')
      .send({
        name: 'Max Kunde',
        email: 'kunde2@example.com',
        phone: '+491****4567',
        street: 'Musterstraße 1',
        zip: '20095',
        city: 'Hamburg',
        password: 'Test1234!',
        legal_agb_accepted: true,
        legal_datenschutz_accepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TenantSelectionRequired');
  });
});

describe('GET /tenants (customer)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', customerAuthRoutes);
    app.use((err, _req, res, _next) => {
      return res.status(500).json({ message: err.message || 'internal error' });
    });
    db.query.mockReset();
  });

  test('lists active tenants for customer self-registration', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: 't1', slug: 'alpha', name: 'Alpha Park', available_spots: '5' },
        { id: 't2', slug: 'beta', name: 'Beta Park', available_spots: '0' },
      ],
    });

    const res = await request(app).get('/tenants');

    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(2);
    expect(res.body.tenants[0]).toEqual({
      id: 't1',
      slug: 'alpha',
      name: 'Alpha Park',
      available_spots: 5,
    });
  });
});
