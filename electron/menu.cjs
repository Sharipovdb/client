// Application menu. Role items get explicit Russian labels because Electron's
// built-in role labels on Windows are English.
const path = require('node:path')
const { app, dialog, Menu, shell } = require('electron')
const log = require('electron-log/main')

const { checkForUpdatesManually } = require('./updater.cjs')

function buildAppMenu(getMainWindow) {
  /** @type {import('electron').MenuItemConstructorOptions[]} */
  const template = [
    {
      label: 'Файл',
      submenu: [{ role: 'quit', label: 'Выход' }],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'forceReload', label: 'Обновить без кеша' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Обычный масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' },
      ],
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'Проверить обновления…',
          click: () => checkForUpdatesManually(),
        },
        { label: 'Открыть папку логов', click: () => openLogsFolder() },
        { type: 'separator' },
        { label: 'О программе', click: () => showAbout(getMainWindow()) },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

function logFilePath() {
  return log.transports.file.getFile().path
}

function openLogsFolder() {
  shell.openPath(path.dirname(logFilePath())).then((error) => {
    if (error) {
      log.error(`Failed to open logs folder: ${error}`)
    }
  })
}

function showAbout(window) {
  const options = {
    type: 'info',
    title: 'О программе',
    message: `CrewMove ${app.getVersion()}`,
    detail: [
      `Версия приложения: ${app.getVersion()}`,
      `Electron: ${process.versions.electron}`,
      `Chromium: ${process.versions.chrome}`,
      '',
      `Логи: ${logFilePath()}`,
    ].join('\n'),
    buttons: ['OK'],
  }

  return window
    ? dialog.showMessageBox(window, options)
    : dialog.showMessageBox(options)
}

module.exports = { buildAppMenu }
