// scripts/seed.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runSeed() {
  const sqlPath = path.join(__dirname, '..', 'db', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Use direct PG client instead of pool to run multi-statement SQL
  const client = new Client({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://ae_user:ae_password@localhost:5432/ae_db'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Running database seed...');
    await client.query(sql);

    console.log('Database seeded successfully! 🎉');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }

  process.exit(0);
}

runSeed();
