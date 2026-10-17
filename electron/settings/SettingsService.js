// electron/settings/SettingsService.js
const { safeStorage } = require('electron')

// Valor que se muestra en lugar de una llave guardada. Nunca se devuelve la llave real a la interfaz.
const SECRET_MASK = '••••••••'

class SettingsService {
  constructor(db) { this.db = db }

  static ALLOWED_KEYS = new Set([
    'store_name', 'store_nit', 'store_address', 'store_phone', 'store_email',
    'invoice_prefix', 'invoice_next', 'tax_rate', 'low_stock_threshold',
    'backup_enabled', 'backup_days', 'tax_enabled', 'logo_path', 'theme', 'currency',
    'supabase_url', 'supabase_service_key', 'sync_enabled'
  ])

  // Llaves que se guardan cifradas con el almacenamiento seguro del sistema operativo.
  static SECRET_KEYS = new Set(['supabase_service_key'])

  getAll() {
    const rows = this.db.all('SELECT key, value FROM settings')
    const all = Object.fromEntries(rows.map(r => [r.key, r.value]))
    for (const key of SettingsService.SECRET_KEYS) {
      if (key in all) all[key] = all[key] ? SECRET_MASK : ''
    }
    return all
  }

  set(key, value) {
    if (!SettingsService.ALLOWED_KEYS.has(key)) {
      throw new Error('Configuración no permitida')
    }

    if (SettingsService.SECRET_KEYS.has(key)) {
      return this._setSecret(key, value)
    }

    if (key === 'currency' && String(value).toUpperCase() !== 'COP') {
      throw new Error('La moneda del sistema debe ser COP')
    }

    if (key === 'invoice_prefix') {
      const v = String(value ?? '').trim().toUpperCase()
      // El prefijo se usa para construir el número de factura y, a partir
      // de este, el nombre del archivo PDF generado en disco. Debe limitarse
      // a letras, números y guiones para evitar factura inválidas o rutas
      // de archivo inesperadas (por ejemplo "../../").
      if (!v || !/^[A-Z0-9-]{1,10}$/.test(v)) {
        throw new Error('El prefijo de factura solo puede contener letras, números y guiones (máx. 10 caracteres)')
      }
      value = v
    }

    if (key === 'invoice_next') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) throw new Error('El próximo número de factura debe ser un entero positivo')
      value = n
    }

    if (key === 'tax_rate') {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('La tasa de impuesto debe estar entre 0 y 100')
      value = n
    }

    if (key === 'low_stock_threshold') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0) throw new Error('El umbral de stock debe ser un entero no negativo')
      value = n
    }

    if (key === 'supabase_url') {
      const v = String(value ?? '').trim()
      if (v && !/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(v)) {
        throw new Error('La URL de Supabase no parece válida (debe terminar en .supabase.co)')
      }
      value = v.replace(/\/$/, '')
    }

    if (key === 'sync_enabled') {
      value = String(value) === '1' || value === true ? '1' : '0'
    }

    this.db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, String(value)]
    )
  }

  get(key) {
    const row = this.db.get('SELECT value FROM settings WHERE key = ?', [key])
    return row?.value ?? null
  }

  // Guarda una llave cifrada. Vacío o la máscara significan "sin cambios".
  _setSecret(key, value) {
    const v = String(value ?? '').trim()
    if (!v || v === SECRET_MASK) return
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Este equipo no permite guardar la llave de forma segura')
    }
    const stored = 'enc:' + safeStorage.encryptString(v).toString('base64')
    this.db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, stored]
    )
  }

  // Lee una llave para uso interno (solo el proceso principal). No se expone a la interfaz.
  getSecret(key) {
    const raw = this.get(key) || ''
    if (!raw.startsWith('enc:')) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    try {
      return safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64'))
    } catch (error) {
      console.error('[Settings] No se pudo descifrar la llave guardada:', error.message)
      return ''
    }
  }
}

module.exports = SettingsService
