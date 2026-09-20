// Isolated public-site fixture: never connects to a database or sends reminders.
const { EventEmitter } = require('node:events');
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1/fixture';
process.env.NODE_ENV = 'test';
delete process.env.RAILWAY_ENVIRONMENT;
delete process.env.SEMAPHORE_API_KEY;
const pool = new EventEmitter();
pool.query = async () => ({ rows: [] });
pool.end = async () => {};
require.cache[require.resolve('../../database')] = { exports: {
  pool, initDatabase: async () => {}, getDoctors: async () => [],
  getDoctor: async () => null
} };
require.cache[require.resolve('../../sms-reminders')] = { exports: { startReminderScheduler() {} } };
require('../../server');
