import { contextBridge, ipcRenderer } from 'electron'
import type {
  Api,
  AppConfig,
  JobFile,
  JobUpdate,
  LogLine,
  Preset,
  QueueSummary,
  StartQueueRequest
} from '@shared/types'

// channels.ts は main 配下にあるが、文字列は単純なのでここで再定義して結合度を下げる。
const IPC = {
  probeFiles: 'probe-files',
  pickOutputDir: 'pick-output-dir',
  getDefaultOutputDir: 'get-default-output-dir',
  startQueue: 'start-queue',
  cancelJob: 'cancel-job',
  cancelAll: 'cancel-all',
  saveLog: 'save-log',
  openPath: 'open-path',
  getConfig: 'get-config',
  setConfig: 'set-config',
  getPresets: 'get-presets',
  jobUpdate: 'job-update',
  log: 'log-line',
  queueDone: 'queue-done'
} as const

const api: Api = {
  probeFiles: (paths: string[]): Promise<JobFile[]> =>
    ipcRenderer.invoke(IPC.probeFiles, paths),
  pickOutputDir: (defaultDir: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.pickOutputDir, defaultDir),
  getDefaultOutputDir: (): Promise<string> =>
    ipcRenderer.invoke(IPC.getDefaultOutputDir),
  startQueue: (req: StartQueueRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.startQueue, req),
  cancelJob: (id: string): Promise<void> => ipcRenderer.invoke(IPC.cancelJob, id),
  cancelAll: (): Promise<void> => ipcRenderer.invoke(IPC.cancelAll),
  saveLog: (text: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.saveLog, text),
  openPath: (target: string): Promise<void> =>
    ipcRenderer.invoke(IPC.openPath, target),
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.getConfig),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke(IPC.setConfig, patch),
  getPresets: (): Promise<Preset[]> => ipcRenderer.invoke(IPC.getPresets),

  onJobUpdate: (cb: (u: JobUpdate) => void): (() => void) => {
    const listener = (_e: unknown, u: JobUpdate): void => cb(u)
    ipcRenderer.on(IPC.jobUpdate, listener)
    return () => ipcRenderer.removeListener(IPC.jobUpdate, listener)
  },
  onLog: (cb: (l: LogLine) => void): (() => void) => {
    const listener = (_e: unknown, l: LogLine): void => cb(l)
    ipcRenderer.on(IPC.log, listener)
    return () => ipcRenderer.removeListener(IPC.log, listener)
  },
  onQueueDone: (cb: (s: QueueSummary) => void): (() => void) => {
    const listener = (_e: unknown, s: QueueSummary): void => cb(s)
    ipcRenderer.on(IPC.queueDone, listener)
    return () => ipcRenderer.removeListener(IPC.queueDone, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
