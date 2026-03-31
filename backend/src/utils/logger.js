'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, json, colorize, printf } = format;

const isDev = process.env.NODE_ENV !== 'production';

// Dev-friendly console format
const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  let line = `${ts} [${level}] ${message}`;
  if (stack) line += `\n${stack}`;
  const keys = Object.keys(meta);
  if (keys.length > 0) line += ` ${JSON.stringify(meta)}`;
  return line;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    isDev
      ? combine(colorize({ all: true }), devFormat)
      : json()
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Add file transport in production
if (!isDev) {
  logger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    })
  );
  logger.add(
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 10,
      tailable: true,
    })
  );
}

module.exports = logger;
