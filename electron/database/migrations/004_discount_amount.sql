-- Descuento por línea en pesos (antes solo porcentaje). discount_pct se conserva como
-- porcentaje equivalente para mantener los reportes existentes.
ALTER TABLE sale_items ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
