-- Add minimum batch stock level to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_batch_stock_level integer DEFAULT 5;

COMMENT ON COLUMN products.min_batch_stock_level IS 'Minimum stock level threshold for individual batches to trigger low stock alerts';