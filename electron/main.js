// electron/main.js
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const { getDB }        = require('./database/Database')
const { seedDemoData } = require('./database/seeds/demo_data')

const { registerAuthHandlers }      = require('./ipc/AuthHandlers')
const { registerInventoryHandlers } = require('./ipc/InventoryHandlers')
const { registerSalesHandlers }     = require('./ipc/SalesHandlers')
const { registerSettingsHandlers }  = require('./ipc/SettingsHandlers')
const { registerCashHandlers }      = require('./ipc/CashHandlers')
const { registerCustomerHandlers }  = require('./ipc/CustomerHandlers')
const { registerReportHandlers }    = require('./ipc/ReportHandlers')
const { registerDocumentHandlers }  = require('./ipc/DocumentHandlers')
const { registerSyncHandlers }      = require('./ipc/SyncHandlers')

const AuthService = require('./auth/AuthService')
const ProductImageService = require('./media/ProductImageService')
const SettingsService = require('./settings/SettingsService')
const SupabaseSync = require('./sync/SupabaseSync')
const { autoUpdater } = require('electron-updater')

// Sincronización automática: 12:00 y 19:00, hora de Colombia (UTC-5, sin cambio de horario).
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000
const SYNC_HOURS_COLOMBIA = [12, 19]
const LAST_AUTO_SYNC_KEY = 'last_auto_sync_ms'
let syncTimer = null

// Horas de sincronización (en milisegundos UTC) para los días indicados respecto a hoy en Colombia.
function syncSlots(fromMs, dayOffsets) {
  const col = new Date(fromMs + COLOMBIA_OFFSET_MS)
  const slots = []
  for (const d of dayOffsets) {
    for (const h of SYNC_HOURS_COLOMBIA) {
      slots.push(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate() + d, h) - COLOMBIA_OFFSET_MS)
    }
  }
  return slots
}
const nextSyncSlot = fromMs => Math.min(...syncSlots(fromMs, [0, 1]).filter(t => t > fromMs))
const lastSyncSlot = fromMs => Math.max(...syncSlots(fromMs, [-1, 0]).filter(t => t <= fromMs))

// Carpeta de datos de la app: osmar-pos. No copia nada por sí sola.
function prepareUserData() {
  app.setPath('userData', path.join(app.getPath('appData'), 'osmar-pos'))
}
prepareUserData()

// Copia la base y las imágenes de una instalación anterior (J97). La carpeta anterior no se toca.
function copyLegacyData(legacyDir) {
  const targetDir = app.getPath('userData')
  try {
    fs.mkdirSync(targetDir, { recursive: true })
    const legacyImages = path.join(legacyDir, 'product-images')
    if (fs.existsSync(legacyImages)) {
      fs.cpSync(legacyImages, path.join(targetDir, 'product-images'), { recursive: true })
    }
    const targetDb = path.join(targetDir, 'pos-ropa.db')
    const tmp = `${targetDb}.tmp`
    fs.copyFileSync(path.join(legacyDir, 'pos-ropa.db'), tmp)
    for (const suffix of ['-wal', '-shm']) {
      const src = path.join(legacyDir, `pos-ropa.db${suffix}`)
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(targetDir, `pos-ropa.db${suffix}`))
    }
    fs.renameSync(tmp, targetDb)
    console.log('[Datos] Datos importados desde la instalación anterior')
  } catch (error) {
    console.error('[Datos] No se pudieron importar los datos anteriores:', error)
  }
}

// En el primer arranque, si existe una instalación anterior, pregunta antes de importar.
// Sin respuesta afirmativa, Osmar empieza completamente limpia.
async function maybeImportLegacyData() {
  const legacyDir = path.join(app.getPath('appData'), 'j97-pos')
  const targetDb  = path.join(app.getPath('userData'), 'pos-ropa.db')
  if (fs.existsSync(targetDb) || !fs.existsSync(path.join(legacyDir, 'pos-ropa.db'))) return
  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Osmar POS',
    message: 'Se encontró una instalación anterior en este equipo.',
    detail: '¿Quieres importar sus productos, ventas y clientes? Si eliges "Empezar limpia", Osmar inicia sin datos.',
    buttons: ['Empezar limpia', 'Importar datos anteriores'],
    defaultId: 0,
    cancelId: 0,
  })
  if (response === 1) copyLegacyData(legacyDir)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'osmar-image',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

let mainWindow, db, authService, productImageService



let updateCheckInProgress = false

function configureAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[Updater] Desactivado en desarrollo.')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Comprobando actualizaciones...')
  })

  autoUpdater.on('update-available', async (info) => {
    console.log(`[Updater] Actualización disponible: ${info.version}`)

    if (!mainWindow || mainWindow.isDestroyed()) return

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: "Osmar POS — Actualización disponible",
      message: `Hay una nueva versión de Osmar POS: ${info.version}`,
      detail: 'Puedes descargarla ahora. La aplicación se reiniciará cuando confirmes la instalación. Tus datos locales, base de datos e imágenes no forman parte del paquete de actualización.',
      buttons: ['Descargar actualización', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })

    if (result.response !== 0) return

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('[Updater] Error descargando actualización:', error)
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: "Osmar POS — Error de actualización",
        message: 'No se pudo descargar la actualización.',
        detail: error?.message || 'Error desconocido.',
        buttons: ['Cerrar'],
      })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Descarga: ${progress.percent.toFixed(1)}%`)
  })

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`[Updater] Actualización descargada: ${info.version}`)

    if (!mainWindow || mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall()
      return
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: "Osmar POS — Actualización lista",
      message: `La versión ${info.version} está lista para instalarse.`,
      detail: 'Osmar se cerrará y se reiniciará para completar la actualización. La base de datos local y las imágenes permanecen fuera del paquete de actualización.',
      buttons: ['Instalar y reiniciar', 'Después'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })

    if (result.response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true))
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[Updater] Osmar ya está actualizado: ${info.version}`)
  })

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error)
  })

  setTimeout(async () => {
    if (updateCheckInProgress) return
    updateCheckInProgress = true
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      console.error('[Updater] No se pudo comprobar la actualización:', error)
    } finally {
      updateCheckInProgress = false
    }
  }, 5000)
}

function getDBPath() {
  return path.join(app.getPath('userData'), 'pos-ropa.db')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 1024, minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

async function bootstrap() {
  await maybeImportLegacyData()
  db = getDB(getDBPath())
  productImageService = new ProductImageService(app)
  const bootstrapAdmin = await seedDemoData(db)
  authService = new AuthService(db)

  if (bootstrapAdmin?.created) {
    await dialog.showMessageBox({
      type: 'info',
      title: "Osmar POS — Administrador inicial",
      message: 'Se creó el usuario administrador inicial.',
      detail: `Usuario: ${bootstrapAdmin.username}\nContraseña inicial: ${bootstrapAdmin.password}\n\nPuedes cambiarla posteriormente desde Configuración > Seguridad.`,
      buttons: ['Entendido'],
    })
  }

  registerAuthHandlers(ipcMain, authService)
  registerInventoryHandlers(ipcMain, db, authService, app)
  registerSalesHandlers(ipcMain, db, authService)
  registerSettingsHandlers(ipcMain, db, authService)
  registerCashHandlers(ipcMain, db, authService)
  registerCustomerHandlers(ipcMain, db, authService)
  registerReportHandlers(ipcMain, db, authService)
  registerDocumentHandlers(ipcMain, db, app, authService)

  // Respaldo en la nube (Supabase): opcional, se activa desde Ajustes.
  // Un fallo aquí (sin internet, credenciales incompletas) nunca debe
  // impedir que la app abra, por eso corre aparte y con su propio manejo
  // de errores interno (ver SupabaseSync.runSync).
  const settingsService = new SettingsService(db)
  const sync = new SupabaseSync(db, app, productImageService)
  registerSyncHandlers(ipcMain, authService, sync, settingsService)

  const lastOk = () => Number(db.get('SELECT value FROM settings WHERE key = ?', [LAST_AUTO_SYNC_KEY])?.value || 0)
  const markOk = () => db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [LAST_AUTO_SYNC_KEY, String(Date.now())]
  )
  const scheduleNextSync = () => {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(runScheduledSync, nextSyncSlot(Date.now()) - Date.now())
  }
  async function runScheduledSync() {
    try {
      const result = await sync.runSync(settingsService)
      if (result?.ok && !result.skipped && !(result.errors?.length)) markOk()
    } catch (e) {
      console.error('[Sync] Error inesperado:', e.message)
    }
    scheduleNextSync()
  }
  // Si la app estaba cerrada en un horario de sincronización, se sincroniza una vez al abrir.
  if (lastOk() < lastSyncSlot(Date.now())) runScheduledSync()
  else scheduleNextSync()

  console.log('[App] Bootstrap OK')
}

app.whenReady().then(async () => {
  protocol.handle('osmar-image', async (request) => {
    try {
      const url = new URL(request.url)
      // En osmar-image://products/UUID.webp, "products" es el hostname
      // y "UUID.webp" es el pathname. Ambos deben reconstruirse.
      const host = decodeURIComponent(url.hostname || '')
      const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const relativePath = [host, pathname].filter(Boolean).join('/')

      const absolutePath = productImageService?.getAbsolutePath(relativePath)
      if (!absolutePath || !fs.existsSync(absolutePath)) {
        return new Response('Not found', { status: 404 })
      }
      const data = await fs.promises.readFile(absolutePath)
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  })
  try {
    await bootstrap()
    createWindow()
    configureAutoUpdater()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (error) {
    console.error('[App] Bootstrap fallido:', error)
    if (db) {
      try { db.close() } catch {}
    }
    await dialog.showMessageBox({
      type: 'error',
      title: "Osmar POS — Error de inicio",
      message: 'No se pudo iniciar la aplicación.',
      detail: 'La base de datos o una migración no pudo inicializarse correctamente. No se realizaron operaciones de venta. Revisa el registro técnico antes de volver a intentarlo.',
      buttons: ['Cerrar']
    })
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
  if (process.platform !== 'darwin') { db?.close(); app.quit() }
})
