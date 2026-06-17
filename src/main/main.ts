import { app, BrowserWindow, Notification } from 'electron'
import * as path from 'path'
import type { QueueSummary } from '@shared/types'
import { registerIpcHandlers } from './ipc/handlers'
import { loadConfig, saveConfig } from './config/configStore'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const cfg = loadConfig()
  mainWindow = new BrowserWindow({
    width: cfg.window?.width ?? 1100,
    height: cfg.window?.height ?? 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5f6f8',
    title: 'MovieEncoder for Nissan Navi',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [width, height] = mainWindow.getSize()
      saveConfig({ window: { width, height } })
    }
  })

  // electron-vite: 開発時は dev server、本番は dist の index.html
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/** キュー完了サマリの OS 通知（ダイアログは Renderer 側で表示） */
function notifyDone(summary: QueueSummary): void {
  if (!Notification.isSupported()) return
  const title = summary.abortedByUser ? '変換を中止しました' : '変換が完了しました'
  const parts = [`完了 ${summary.done} 件`]
  if (summary.error > 0) parts.push(`エラー ${summary.error} 件`)
  if (summary.canceled > 0) parts.push(`中止 ${summary.canceled} 件`)
  new Notification({ title, body: parts.join(' / ') }).show()
}

app.whenReady().then(() => {
  // Windows 通知のために AppUserModelId を設定
  app.setAppUserModelId('jp.co.polites.movieencoderfornissannavi')
  registerIpcHandlers(() => mainWindow, notifyDone)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
