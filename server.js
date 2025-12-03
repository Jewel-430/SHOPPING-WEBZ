// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const morgan = require('morgan');
const db = require('./utils/db');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------
// SECURITY & MIDDLEWARE
// --------------------------
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined'));

// CORS — allow localhost + env URLs
const allowedOrigins = (process.env.FRONTEND_URL && process.env.FRONTEND_URL.split(',')) || [
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all non-browser (e.g., server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Blocked by CORS'));
    }
  })
);

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// --------------------------
// HELPERS
// --------------------------
function generateOrderRef() {
  return 'AX-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function requireAdmin(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key && key === process.env.ADMIN_API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// --------------------------
// ROUTES
// --------------------------

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));


// --------------------------
// PRODUCTS
// --------------------------
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, sku, title, category, description, price, img 
      FROM products 
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});


// --------------------------
// CREATE ORDER
// --------------------------
app.post('/api/orders', async (req, res) => {
  // Validation schema
  const schema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().optional().allow(''),
    address: Joi.string().min(5).required(),
    items: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().required(),
          title: Joi.string().required(),
          price: Joi.number().min(0.01).required(),
          qty: Joi.number().integer().min(1).required()
        })
      )
      .min(1)
      .required(),
    total: Joi.number().min(0.01).required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create order
    const orderRef = generateOrderRef();
    const order = await client.query(
      `INSERT INTO orders (order_ref, customer_name, customer_email, customer_address, total) 
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, order_ref, created_at, status`,
      [orderRef, value.name, value.email || null, value.address, value.total]
    );

    const orderId = order.rows[0].id;

    // Insert items
    const insertItem = `
      INSERT INTO order_items (order_id, product_id, title, unit_price, qty) 
      VALUES ($1,$2,$3,$4,$5)
    `;

    for (const item of value.items) {
      await client.query(insertItem, [
        orderId,
        item.id,
        item.title,
        item.price,
        item.qty
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json(order.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});


// --------------------------
// GET SINGLE ORDER
// --------------------------
app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderRes = await db.query(
      `SELECT id, order_ref, customer_name, customer_email, customer_address, total, status, created_at 
       FROM orders 
       WHERE id=$1`,
      [req.params.id]
    );

    if (orderRes.rows.length === 0)
      return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await db.query(
      `SELECT product_id, title, unit_price, qty 
       FROM order_items 
       WHERE order_id=$1`,
      [req.params.id]
    );

    const order = orderRes.rows[0];
    order.items = itemsRes.rows;

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});


// --------------------------
// ADMIN: LIST ORDERS
// --------------------------
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, order_ref, customer_name, total, status, created_at
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});


// --------------------------
// ADMIN: UPDATE ORDER STATUS
// --------------------------
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('Processing', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled')
      .required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const result = await db.query(
      `UPDATE orders SET status=$1 
       WHERE id=$2 
       RETURNING id, status`,
      [value.status, req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Order not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});


// --------------------------
// ADMIN: CREATE PRODUCT
// --------------------------
app.post('/api/products', requireAdmin, async (req, res) => {
  const schema = Joi.object({
    sku: Joi.string().required(),
    title: Joi.string().required(),
    category: Joi.string().allow('').optional(),
    description: Joi.string().allow('').optional(),
    price: Joi.number().min(0.01).required(),
    img: Joi.string().uri().allow('').optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const r = await db.query(
      `INSERT INTO products (sku,title,category,description,price,img)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [value.sku, value.title, value.category, value.description, value.price, value.img]
    );

    res.status(201).json({ id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Serve static asset folder
app.use('/assets', express.static('public/assets'));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Start server
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
function generateTrackingNumber() {
  return 'TRK-' + Math.random().toString(36).substr(2, 10).toUpperCase();
}
