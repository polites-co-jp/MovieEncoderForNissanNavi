import { create } from 'zustand'
import type {
  JobFile,
  JobState,
  JobUpdate,
  LogLine,
  Preset,
  QueueSummary
} from '@shared/types'
import { isJobBusy } from '@shared/types'

interface StoreLogLine extends LogLine {
  seq: number
}

interface AppState {
  jobs: JobState[]
  presets: Preset[]
  presetId: string
  concurrency: number
  logs: StoreLogLine[]
  logFilterJobId: string | null
  isEncoding: boolean
  summary: QueueSummary | null

  setPresets: (p: Preset[]) => void
  setPresetId: (id: string) => void
  setConcurrency: (n: number) => void

  addJobs: (files: JobFile[]) => void
  removeJob: (id: string) => void
  clearJobs: () => void

  applyUpdate: (u: JobUpdate) => void
  appendLog: (l: LogLine) => void
  setLogFilter: (jobId: string | null) => void
  clearLogs: () => void

  setEncoding: (v: boolean) => void
  setSummary: (s: QueueSummary | null) => void
}

let logSeq = 0

export const useStore = create<AppState>((set) => ({
  jobs: [],
  presets: [],
  presetId: 'nissan-standard',
  concurrency: 3,
  logs: [],
  logFilterJobId: null,
  isEncoding: false,
  summary: null,

  setPresets: (presets) => set({ presets }),
  setPresetId: (presetId) => set({ presetId }),
  setConcurrency: (concurrency) => set({ concurrency }),

  addJobs: (files) =>
    set((state) => {
      const existing = new Set(state.jobs.map((j) => j.inputPath))
      const fresh = files
        .filter((f) => !existing.has(f.inputPath))
        .map<JobState>((f) => ({
          id: f.id,
          inputPath: f.inputPath,
          fileName: f.fileName,
          media: f.media,
          status: 'waiting',
          progress: null,
          etaSec: null,
          outputPath: null,
          errorReason: null
        }))
      return { jobs: [...state.jobs, ...fresh] }
    }),

  removeJob: (id) =>
    set((state) => ({
      // 変換中・転記待ちは削除しない
      jobs: state.jobs.filter((j) => !(j.id === id && !isJobBusy(j.status)))
    })),

  clearJobs: () =>
    set((state) => ({
      // 変換中・転記待ちの行は残す
      jobs: state.jobs.filter((j) => isJobBusy(j.status))
    })),

  applyUpdate: (u) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === u.id
          ? {
              ...j,
              status: u.status ?? j.status,
              progress: u.progress !== undefined ? u.progress : j.progress,
              etaSec: u.etaSec !== undefined ? u.etaSec : j.etaSec,
              outputPath: u.outputPath !== undefined ? u.outputPath : j.outputPath,
              errorReason:
                u.errorReason !== undefined ? u.errorReason : j.errorReason
            }
          : j
      )
    })),

  appendLog: (l) =>
    set((state) => {
      const next = [...state.logs, { ...l, seq: logSeq++ }]
      // メモリ肥大化を防ぐため上限を設ける
      const MAX = 5000
      return { logs: next.length > MAX ? next.slice(next.length - MAX) : next }
    }),

  setLogFilter: (logFilterJobId) => set({ logFilterJobId }),
  clearLogs: () => set({ logs: [] }),

  setEncoding: (isEncoding) => set({ isEncoding }),
  setSummary: (summary) => set({ summary })
}))
