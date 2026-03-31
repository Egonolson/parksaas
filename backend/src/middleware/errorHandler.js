'use strict';

const logger = require('../utils/logger');

/**
 * 404 handler - must be registered AFTER all routes.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central error handler.
 * Express identifies 4-argument functions as error handlers.
 *
 * Handles:
 *   - Validation errors from express-validator (passed as arrays)
 *   - PostgreSQL errors (unique violation, FK violation, etc.)
 *   - JWT errors
 *   - Generic operational errors
 *   - Unexpected crashes (500)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Attach request ID if available
  const requestId = req.id || req.headers['x-request-id'];

  // --- Validation error from express-validator (array of errors) ---
  if (Array.isArray(err)) {
    return res.status(422).json({
      error: 'ValidationError',
      message: 'Request validation failed.',
      details: err.map((e) => ({ field: e.path || e.param, message: e.msg })),
      requestId,
    });
  }

  // --- PostgreSQL errors ---
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          error: 'Conflict',
          message: 'A record with the same unique value already exists.',
          detail: process.env.NODE_ENV !== 'production' ? err.detail : undefined,
          requestId,
        });

      case '23503': // foreign_key_violation
        return res.status(409).json({
          error: 'ReferenceError',
          message: 'Referenced record does not exist.',
          requestId,
        });

      case '23502': // not_null_violation
        return res.status(422).json({
          error: 'ValidationError',
          message: `Required field '${err.column}' is missing.`,
          requestId,
        });

      case '22P02': // invalid_text_representation (e.g. invalid UUID)
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid data format in request.',
          requestId,
        });

      case '42P01': // undefined_table
        logger.error('DB: undefined table referenced', { err: err.message });
        break;

      default:
        break;
    }
  }

  // --- JWT-specific errors (in case they propagate here) ---
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid JWT.',
      requestId,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'TokenExpired',
      message: 'JWT has expired.',
      requestId,
    });
  }

  // --- Operational errors with a known HTTP status ---
  if (err.statusCode || err.status) {
    const status = err.statusCode || err.status;
    // Don't expose internal details for 5xx
    const isClientError = status < 500;
    return res.status(status).json({
      error: err.name || 'Error',
      message: isClientError ? err.message : 'An unexpected error occurred.',
      requestId,
    });
  }

  // --- Unknown / programmer errors ---
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    requestId,
    method: req.method,
    url: req.originalUrl,
    tenantId: req.tenant?.id,
    operatorId: req.operator?.id,
  });

  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred. Please try again later.',
    requestId,
  });
}

/**
 * Creates an operational error with a given HTTP status.
 * Use this instead of throwing generic Error objects.
 */
function createHttpError(statusCode, message, name = 'HttpError') {
  const err = new Error(message);
  err.name = name;
  err.statusCode = statusCode;
  return err;
}

module.exports = {
  notFoundHandler,
  errorHandler,
  createHttpError,
};
