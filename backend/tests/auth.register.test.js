'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  signOperatorToken: jest.fn(() => 'test-operator-token'),
}));

const db = require('../src/db');
const authRoutes = require('../src/routes/auth');

describe('POST /register (operator)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', authRoutes);
    app.use((err, _req, res, _next) => {
      if (Array.isArray(err) && err.length > 0) {
        return res.status(422).json({ message: err[0].msg });
      }
      return res.status(500).json({ message: err.message || 'internal error' });
    });
    db.query.mockReset();
  });

  test('accepts company_name as alias for name', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'tenant-1',
          name: 'Acme Parkhaus GmbH',
          slug: 'acme-parkhaus',
          email: 'owner@example.com',
          plan: 'professional',
        },
      ],
    });

    const res = await request(app)
      .post('/register')
      .send({
        company_name: 'Acme Parkhaus GmbH',
        slug: 'acme-parkhaus',
        email: 'owner@example.com',
        password: 'Test1234!',
      });

    expect(res.status).toBe(201);
    expect(res.body.tenant.name).toBe('Acme Parkhaus GmbH');
    expect(db.query).toHaveBeenCalled();
  });
});
