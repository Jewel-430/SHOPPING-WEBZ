-- ===========================
-- SCHEMA: PRODUCTS
-- ===========================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  img TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);


-- ===========================
-- SCHEMA: ORDERS
-- ===========================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_ref TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'Processing' CHECK (status IN 
    ('Processing', 'Shipped', 'Delivered', 'Cancelled')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON orders(order_ref);


-- ===========================
-- SCHEMA: ORDER ITEMS
-- ===========================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);


-- ===========================
-- SAMPLE DATA (SAFE INSERT)
-- ===========================
INSERT INTO products (sku, title, category, description, price, img)
VALUES
('IP15-PRO','iPhone 15 Pro','Phones','Apple iPhone 15 Pro, 256GB',999.00,'/assets/iphone15.jpg'),
('LV-NFMM','Louis Vuitton Neverfull MM','Bags','Monogram canvas tote',1890.00,'/assets/lv_neverfull.jpg'),
('MK-JET','Michael Kors Jet Set Tote','Bags','Signature monogram tote',350.00,'/assets/mk_tote.jpg'),
('NIKE-AJ1','Nike Air Jordan 1','Shoes','Air Jordan 1 Retro High OG',180.00,'/assets/aj1.jpg'),
('ADIDAS-UB','Adidas Ultraboost','Shoes','Ultraboost running shoe',190.00,'/assets/ultraboost.jpg'),
('LAMER-60','La Mer Moisturizer 60ml','Skin Care','La Mer moisturizing cream',380.00,'/assets/lamer.jpg'),
('ORD-NIAC','The Ordinary Niacinamide 10%','Skin Care','Niacinamide serum 30ml',6.00,'/assets/ordinary.jpg'),
('CERA-LO','CeraVe Moisturizing Lotion','Skin Care','Daily moisturizing lotion',25.00,'/assets/cerave.jpg')
ON CONFLICT (sku) DO NOTHING;
