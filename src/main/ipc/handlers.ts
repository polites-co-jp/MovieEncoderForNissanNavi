import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type {
  AppConfig,
  JobFile,
  JobUpdate,
  LogLine,
  QueueSummary,
  StartQueueRequest
} from '@shared/types'
import { PRESETS, getPreset } from '@shared/presets'
import { IPC } from './channels'
import { collectInputFiles } from '../ffmpeg/fileScan'
import { probe } from '../ffmpeg/ffprobe'
import { ConversionQueue } from '../queue/queue'
import {
  loadConfig,
  saveConfig,
  defaultOutputDir
} from '../config/configStore'

let queue: ConversionQueue | null = null
let idCounter = 0

function send(win: BrowserWindow | null, channel: string, payload: unknown): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

/** 投入 path 群を JobFile[] へ。メタ取得は並列数を絞って非同期に行う。 */
async function buildJobFiles(paths: string[]): Promise<JobFile[]> {
  const files = collectInputFiles(paths)
  const jobs: JobFile[] = files.map((inputPath) => ({
    id: `job-${++idCounter}`,
    inputPath,
    fileName: path.basename(inputPath),
    media: null
  }))

  // ffprobe を同時 4 本までで処理（UI ブロックを避ける）
  const limit = 4
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const i = cursor++
      jobs[i].media = await probe(jobs[i].inputPath)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker))
  return jobs
}

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  onQueueDone: (s: QueueSummary) => void
): void {
  ipcMain.handle(IPC.getPresets, () => PRESETS)

  ipcMain.handle(IPC.getConfig, (): AppConfig => loadConfig())

  ipcMain.handle(IPC.setConfig, (_e, patch: Partial<AppConfig>): AppConfig =>
    saveConfig(patch)
  )

  ipcMain.handle(IPC.getDefaultOutputDir, (): string => {
    const cfg = loadConfig()
    return cfg.lastOutputDir ?? defaultOutputDir()
  })

  ipcMain.handle(IPC.probeFiles, async (_e, paths: string[]): Promise<JobFile[]> => {
    return buildJobFiles(paths)
  })

  ipcMain.handle(
    IPC.pickOutputDir,
    async (_e, defaultDir: string): Promise<string | null> => {
      const win = getWindow()
      const result = await dialog.showOpenDialog(win!, {
        title: '出力先フォルダを選択',
        defaultPath: defaultDir,
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      const dir = result.filePaths[0]
      saveConfig({ lastOutputDir: dir })
      return dir
    }
  )

  ipcMain.handle(IPC.startQueue, async (_e, req: StartQueueRequest): Promise<void> => {
    const win = getWindow()
    const preset = getPreset(req.presetId)
    saveConfig({
      lastPresetId: req.presetId,
      lastOutputDir: req.outputDir,
      concurrency: req.concurrency
    })

    queue = new ConversionQueue({
      onJobUpdate: (u: JobUpdate) => send(win, IPC.jobUpdate, u),
      onLog: (l: LogLine) => send(win, IPC.log, l),
      onDone: (s: QueueSummary) => {
        send(win, IPC.queueDone, s)
        onQueueDone(s)
      }
    })
    queue.start(req.jobs, req.outputDir, preset, req.concurrency)
  })

  ipcMain.handle(IPC.cancelJob, (_e, id: string): void => {
    queue?.cancelJob(id)
  })

  ipcMain.handle(IPC.cancelAll, (): void => {
    queue?.cancelAll()
  })

  ipcMain.handle(IPC.saveLog, async (_e, text: string): Promise<string | null> => {
    const win = getWindow()
    const result = await dialog.showSaveDialog(win!, {
      title: 'ログを保存',
      defaultPath: 'encode-log.txt',
      filters: [{ name: 'テキスト', extensions: ['txt'] }]
    })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, text, 'utf-8')
    return result.filePath
  })

  ipcMain.handle(IPC.openPath, async (_e, target: string): Promise<void> => {
    await shell.openPath(target)
  })
}
