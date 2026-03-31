'use strict';

/**
 * ParkSaaS API Server
 *
 * Startup sequence:
 *   1. Load .env
 *   2. Validate required environment variables
 *   3. Initialize DB pool
 *   4. Test DB connection
 *   5. Build Express app
 *   6. Start listening
 *   7. Register graceful shutdown handlers
 */

// Load environment variables first, before any other module
require('dotenv').config();

const logger = require('./utils/logger');

// =============================================================================
// STARTUP VALIDATION
// Must happen before importing modules that rely on env vars
// =============================================================================

function validateEnvironment() {
  const errors = [];

  // DATABASE_URL is required
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is not set. Example: postgresql://user:pass@localhost:5432/parksaas');
  }

  // JWT_SECRET must be at least 32 characters
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is not set.');
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push(
      `JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars). ` +
      'Minimum 32 characters required. Generate with: openssl rand -hex 32'
    );
  }

  // PLATFORM_ADMIN_SECRET must be at least 32 characters
  if (!process.env.PLATFORM_ADMIN_SECRET) {
    errors.push('PLATFORM_ADMIN_SECRET is not set.');
  } else if (process.env.PLATFORM_ADMIN_SECRET.length < 32) {
    errors.push(
      `PLATFORM_ADMIN_SECRET is too short (${process.env.PLATFORM_ADMIN_SECRET.length} chars). ` +
      'Minimum 32 characters required.'
    );
  }

  if (errors.length > 0) {
    logger.error('Environment validation failed. Cannot start server.');
    errors.forEach((e) => logger.error(`  - ${e}`));
    process.exit(1);
  }

  logger.info('Environment validation passed.');
}

validateEnvironment();

// =============================================================================
// MODULE IMPORTS (after env validation)
// =============================================================================

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route handlers
const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/locations');
const spotRoutes = require('./routes/spots');
const customerRoutes = require('./routes/customers');
const contractRoutes = require('./routes/contracts');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const platformRoutes = require('./routes/platform');

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

function buildApp() {
  const app = express();

  // Trust proxy headers if behind a load balancer / reverse proxy
  const behindProxy = process.env.TRUST_PROXY || (process.env.NODE_ENV === 'production' ? '1' : false);
  if (behindProxy) app.set('trust proxy', parseInt(behindProxy, 10) || true);

  // ---------------------------------------------------------------------------
  // Request ID middleware - attach a unique ID to every request
  // ---------------------------------------------------------------------------
  app.use((req, _res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    next();
  });

  // ---------------------------------------------------------------------------
  // Security headers via Helmet
  // ---------------------------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding if needed
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    })
  );

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests without origin (e.g., mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID', 'X-Tenant-Slug'],
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // ---------------------------------------------------------------------------
  // Compression
  // ---------------------------------------------------------------------------
  app.use(compression());

  // ---------------------------------------------------------------------------
  // HTTP request logging
  // ---------------------------------------------------------------------------
  const morganFormat = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
  app.use(
    morgan(morganFormat, {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: (req) => req.url === '/health',
    })
  );

  // ---------------------------------------------------------------------------
  // Body parsing
  // Webhooks need raw body, so we defer urlencoded/json parsing to routes
  // that need it, and handle webhook raw body separately
  // ---------------------------------------------------------------------------
  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api', express.urlencoded({ extended: true, limit: '2mb' }));

  // ---------------------------------------------------------------------------
  // Global rate limiting
  // ---------------------------------------------------------------------------
  const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use authenticated tenant ID if available, otherwise IP
      return req.operator?.id || req.platformAdmin?.id || req.ip;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', { ip: req.ip, url: req.originalUrl });
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 1000),
      });
    },
  });

  // Stricter limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many authentication attempts. Please try again later.',
      });
    },
  });

  app.use('/api', globalLimiter);
  app.use('/api/v1/auth', authLimiter);

  // ---------------------------------------------------------------------------
  // Health check (before auth middleware)
  // ---------------------------------------------------------------------------
  app.get('/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({
        status: 'ok',
        service: 'parksaas-api',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        requestId: req.id,
      });
    } catch (err) {
      logger.error('Health check DB query failed', { error: err.message });
      res.status(503).json({
        status: 'error',
        service: 'parksaas-api',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/v1/health', async (req, res) => {
    res.redirect('/health');
  });

  // ---------------------------------------------------------------------------
  // API Version prefix
  // ---------------------------------------------------------------------------
  const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  // Auth (public)
  app.use(`${API_PREFIX}/auth`, authRoutes);

  // Webhook endpoints (no auth, but verified via Mollie signature in handlers)
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);

  // Platform admin routes
  app.use(`${API_PREFIX}/platform`, platformRoutes);

  // Tenant-scoped operator routes
  // Pattern: /api/v1/tenants/:tenantSlug/<resource>
  app.use(`${API_PREFIX}/tenants/:tenantSlug/locations`, locationRoutes);
  app.use(`${API_PREFIX}/tenants/:tenantSlug/spots`, spotRoutes);
  app.use(`${API_PREFIX}/tenants/:tenantSlug/customers`, customerRoutes);
  app.use(`${API_PREFIX}/tenants/:tenantSlug/contracts`, contractRoutes);
  app.use(`${API_PREFIX}/tenants/:tenantSlug/payments`, paymentRoutes);

  // ---------------------------------------------------------------------------
  // 404 and global error handler (must be last)
  // ---------------------------------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function start() {
  // Initialize DB pool
  db.initPool();
  logger.info('Database pool initialized.');

  // Test DB connectivity
  try {
    await db.testConnection();
  } catch (err) {
    logger.error('Cannot connect to database. Shutting down.', {
      error: err.message,
      connectionString: process.env.DATABASE_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@'),
    });
    process.exit(1);
  }

  // Build and start Express app
  const app = buildApp();
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  const server = http.createServer(app);

  // Configure keep-alive for production
  if (process.env.NODE_ENV === 'production') {
    server.keepAliveTimeout = 65000; // > load balancer timeout
    server.headersTimeout = 66000;
  }

  await new Promise((resolve, reject) => {
    server.listen(port, host, resolve);
    server.once('error', reject);
  });

  logger.info(`ParkSaaS API server started`, {
    port,
    host,
    env: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
    pid: process.pid,
  });

  // =============================================================================
  // GRACEFUL SHUTDOWN
  // =============================================================================

  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
      } else {
        logger.info('HTTP server closed. No new connections accepted.');
      }

      // Close DB pool
      try {
        await db.closePool();
      } catch (dbErr) {
        logger.error('Error closing DB pool', { error: dbErr.message });
      }

      logger.info('Graceful shutdown complete. Exiting.');
      process.exit(err ? 1 : 0);
    });

    // Force exit if graceful shutdown takes too long
    const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10);
    setTimeout(() => {
      logger.error(`Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) exceeded. Forcing exit.`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    // Don't exit on unhandled rejections in dev, do in production
    if (process.env.NODE_ENV === 'production') {
      shutdown('unhandledRejection');
    }
  });

  return server;
}

// Only start server if this file is run directly (not required as a module)
if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

module.exports = { buildApp, start };
