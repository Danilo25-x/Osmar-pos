-- Cambio de marca: el prefijo por defecto de factura pasa a OSMAR.
-- Solo cambia cuando el negocio conserva el prefijo original; las facturas ya emitidas no se modifican.
UPDATE settings SET value = 'OSMAR' WHERE key = 'invoice_prefix' AND value = 'J97';
