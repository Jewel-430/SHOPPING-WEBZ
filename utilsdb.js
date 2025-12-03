// utils/db.js
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is not defined in .env");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,                 // max number of connections
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 5000 // timeout if cannot connect in 5s
});

// --- Log when DB connects ---
pool.on('connect', () => {
  console.log('📦 PostgreSQL connected');
});

// --- Handle connection errors ---
pool.on('error', (err) => {
  console.error('❌ Unexpected PG error', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
