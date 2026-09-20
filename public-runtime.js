const crypto = require('node:crypto');

// Log only an error code and correlation ID, never database messages or patient data.
function reportOperationalError(event, error, logger = console.error) {
  const reference = crypto.randomUUID();
  const code = /^[A-Z0-9_]{2,40}$/.test(error?.code || '') ? error.code : 'UNEXPECTED_ERROR';
  logger(JSON.stringify({ event, code, reference }));
  return reference;
}

function installPoolErrorHandler(pool, logger) {
  const handler = error => reportOperationalError('database_idle_connection_error', error, logger);
  pool.on('error', handler);
  return () => pool.removeListener('error', handler);
}

function createHealthHandler(pool) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await pool.query({ text: 'SELECT 1', query_timeout: 5000 });
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  };
}

function installShutdown(server, pool, { signals = process, exit = code => process.exit(code), timeoutMs = 10000 } = {}) {
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => exit(1), timeoutMs);
    deadline.unref?.();
    // Stop accepting traffic, drain active requests, then release DB connections.
    server.close(async error => {
      try {
        await pool.end();
        clearTimeout(deadline);
        exit(error ? 1 : 0);
      } catch {
        clearTimeout(deadline);
        exit(1);
      }
    });
    server.closeIdleConnections?.();
  };
  signals.once('SIGTERM', stop);
  signals.once('SIGINT', stop);
  return stop;
}

module.exports = { reportOperationalError, installPoolErrorHandler, createHealthHandler, installShutdown };
