// Auto-update from GitHub Releases (electron-updater reads app-update.yml that
// electron-builder bakes into the packaged app). Runs only in a packaged app.
const { app, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log/main')

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** @type {() => import('electron').BrowserWindow | null} */
let getWindow = () => null
let downloadedVersion = null
let promptedVersion = null

function initAutoUpdater(getMainWindow) {
  getWindow = getMainWindow

  if (!app.isPackaged) {
    log.info('Auto-update disabled: app is not packaged')
    return
  }

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Background errors go to the log only; a manual check reports its own.
  autoUpdater.on('error', (error) => log.error('Auto-update error:', error))

  autoUpdater.on('update-downloaded', (info) => {
    downloadedVersion = info.version

    // Later periodic checks re-emit this for the cached download — ask once.
    if (promptedVersion !== info.version) {
      promptedVersion = info.version
      promptRestart(info.version)
    }
  })

  checkInBackground()
  setInterval(checkInBackground, CHECK_INTERVAL_MS)
}

function checkInBackground() {
  autoUpdater.checkForUpdates().catch(() => {
    // Already logged by the 'error' listener.
  })
}

async function promptRestart(version) {
  const { response } = await showMessage({
    type: 'info',
    title: 'Обновление CrewMove',
    message: `Доступна новая версия ${version}.`,
    detail:
      'Перезапустить приложение для установки?\nЕсли выбрать «Позже», обновление установится при выходе из приложения.',
    buttons: ['Перезапустить', 'Позже'],
    defaultId: 0,
    cancelId: 1,
  })

  if (response === 0) {
    log.info(`Restarting to install ${version}`)
    // Silent + force-run: the assisted NSIS installer updates in place and
    // relaunches the app instead of walking the user through the wizard again.
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  } else {
    log.info(`Update ${version} postponed until quit`)
  }
}

// Help → "Проверить обновления…": unlike background checks, always answers.
async function checkForUpdatesManually() {
  if (!app.isPackaged) {
    await showMessage({
      type: 'info',
      title: 'Проверка обновлений',
      message:
        'Проверка обновлений работает только в установленном приложении.',
    })
    return
  }

  if (downloadedVersion) {
    await promptRestart(downloadedVersion)
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()

    if (result?.isUpdateAvailable) {
      await showMessage({
        type: 'info',
        title: 'Проверка обновлений',
        message: `Найдена версия ${result.updateInfo.version}, загружается…`,
        detail:
          'Когда загрузка завершится, приложение предложит перезапуститься.',
      })
    } else {
      await showMessage({
        type: 'info',
        title: 'Проверка обновлений',
        message: 'У вас последняя версия.',
        detail: `Установлена версия ${app.getVersion()}.`,
      })
    }
  } catch (error) {
    await showMessage({
      type: 'error',
      title: 'Проверка обновлений',
      message: 'Не удалось проверить обновления.',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

function showMessage(options) {
  const window = getWindow()
  return window
    ? dialog.showMessageBox(window, options)
    : dialog.showMessageBox(options)
}

module.exports = { initAutoUpdater, checkForUpdatesManually }
