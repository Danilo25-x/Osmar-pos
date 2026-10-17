-- La sincronización usa la llave service_role, guardada cifrada. Se elimina la llave anon guardada en texto plano.
DELETE FROM settings WHERE key = 'supabase_anon_key';
