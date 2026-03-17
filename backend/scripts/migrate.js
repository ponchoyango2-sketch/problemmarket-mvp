const fs = require('fs');
const path = require('path');
const db = require('../db');

async function run() {
  const migrationFiles = [
    path.join(__dirname, '..', 'migrations', 'schema.sql'),
    path.join(__dirname, '..', 'migrations', '002_add_auth.sql'),
    path.join(__dirname, '..', 'migrations', '003_chat_history.sql'),
    path.join(__dirname, '..', 'migrations', '004_add_problem_payment_fields.sql'),
    path.join(__dirname, '..', 'migrations', '005_add_stripe_webhook_events.sql'),
  ];

  const client = await db.pool.connect();
  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      await client.query(sql);
      console.log(`Applied migration: ${path.basename(file)}`);
    }
    console.log('Migrations completed successfully.');
  } finally {
    client.release();
    await db.pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
