// Electron main process. CommonJS because package.json has "type": "module".
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron')
const log = require('electron-log/main')

const { resolveDistFile } = require('./dist-protocol.cjs')
const { buildAppMenu } = require('./menu.cjs')
const { initAutoUpdater } = require('./updater.cjs')

// The built frontend is served from a custom scheme instead of file:// so the
// Vite build works with its default base "/" and API requests carry a stable
// Origin (app://crewmove) that the backend can allow in CORS_ORIGINS.
const APP_SCHEME = 'app'
const APP_ORIGIN = `${APP_SCHEME}://crewmove`
const DEV_SERVER_URL = 'http://localhost:3000'
const DIST_DIR = path.join(__dirname, '..', 'dist')

const startUrl = app.isPackaged ? `${APP_ORIGIN}/` : DEV_SERVER_URL
const startOrigin = urlOrigin(startUrl)

log.errorHandler.startCatching()
log.info(`Starting CrewMove ${app.getVersion()} (Electron ${process.versions.electron}), packaged=${app.isPackaged}`)

// Must run before app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

/** @type {BrowserWindow | null} */
let mainWindow = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.srp.crewmove')
    registerAppProtocol()
    Menu.setApplicationMenu(buildAppMenu(() => mainWindow))
    createMainWindow()
    initAutoUpdater(() => mainWindow)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveDistFile(DIST_DIR, request.url)

    if (!filePath) {
      log.warn(`Blocked request outside dist: ${request.url}`)
      return new Response('Not found', { status: 404 })
    }

    // net.fetch on file:// reads through asar and sets Content-Type by extension.
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function createMainWindow() {
  const title = `CrewMove — v${app.getVersion()}`

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Keep the versioned title instead of the page's <title>.
  mainWindow.on('page-title-updated', (event) => event.preventDefault())
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const { webContents } = mainWindow

  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })

  webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) {
      return
    }

    event.preventDefault()
    openExternal(url)
  })

  webContents.on('did-finish-load', () => {
    log.info(`Loaded ${webContents.getURL()}`)
  })

  webContents.on('did-fail-load',(_event, errorCode, errorDescription, validatedUrl) => {
    log.error(`Failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`)
  })

  webContents.on('render-process-gone', (_event, details) => {
    log.error(`Renderer process gone: ${details.reason} (exit code ${details.exitCode})`)
  })

  mainWindow.loadURL(startUrl)
}

// URL#origin is "null" for schemes Node does not know (app:), so compare
// protocol + host explicitly.
function urlOrigin(url) {
  const { protocol: scheme, host } = new URL(url)
  return `${scheme}//${host}`
}

function isAppUrl(url) {
  try {
    return urlOrigin(url) === startOrigin
  } catch {
    return false
  }
}

// Only hand web and mail links to the OS — never file:// or custom schemes.
function openExternal(url) {
  let protocolName

  try {
    protocolName = new URL(url).protocol
  } catch {
    return
  }

  if (['http:', 'https:', 'mailto:'].includes(protocolName)) {
    shell.openExternal(url).catch((error) => log.error(`openExternal failed for ${url}`, error))
  } else {
    log.warn(`Refused to open external URL: ${url}`)
  }
}
