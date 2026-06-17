// IPC チャンネル名の一元管理（preload と main で共有）
export const IPC = {
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
  // Main → Renderer
  jobUpdate: 'job-update',
  log: 'log-line',
  queueDone: 'queue-done'
} as const
