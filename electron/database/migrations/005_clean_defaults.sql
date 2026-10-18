-- Instalación limpia: el nombre de tienda por defecto es Osmar (no J'97).
-- No cambia un nombre que el negocio ya escribió.
UPDATE settings SET value = 'Osmar' WHERE key = 'store_name' AND value IN ('J''97', 'J97');
