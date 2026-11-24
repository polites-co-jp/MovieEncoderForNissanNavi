// Main / Preload / Renderer 共通のドメイン型・IPC 型

/** 対応入力拡張子（小文字・ドットなし） */
export const SUPPORTED_EXTENSIONS = [
  'mp4',
  'mkv',
  'avi',
  'mov',
  'wmv',
  'flv',
  'm4v',
  'ts',
  'mts',
  'm2ts',
  'webm'
] as const

/**
 * staged: 一時領域への変換が済み、出力先への転記（全件終了後にファイル名順で実施）を待っている状態
 */
export type JobStatus = 'waiting' | 'encoding' | 'staged' | 'done' | 'error' | 'canceled'

/** 実行中（一覧から削除できない）状態か */
export function isJobBusy(status: JobStatus): boolean {
  return status === 'encoding' || status === 'staged'
}

/** ffprobe で取得する映像メタ情報 */
export interface MediaInfo {
  /** 例: 1920x1080 */
  resolution: string | null
  /** 例: h264 */
  videoCodec: string | null
  /** 例: 29.97 */
  frameRate: number | null
  /** 秒 */
  durationSec: number | null
  /** メタ取得に失敗したか */
  failed: boolean
}

export interface JobFile {
  id: string
  inputPath: string
  fileName: string
  media: MediaInfo | null
}

/** Renderer が保持する 1 ジョブの状態 */
export interface JobState {
  id: string
  inputPath: string
  fileName: string
  media: MediaInfo | null
  status: JobStatus
  /** 0..100。duration 不明時は null（不定プログレス） */
  progress: number | null
  /** 残り時間推定（秒）。不明時 null */
  etaSec: number | null
  outputPath: string | null
  /** エラー時の推定理由（日本語） */
  errorReason: string | null
}

/** Main → Renderer のジョブ更新イベント */
export interface JobUpdate {
  id: string
  status?: JobStatus
  progress?: number | null
  etaSec?: number | null
  outputPath?: string | null
  errorReason?: string | null
}

/** ログ行イベント */
export interface LogLine {
  jobId: string | null
  fileName: string | null
  text: string
}

/** キュー完了サマリ */
export interface QueueSummary {
  done: number
  error: number
  canceled: number
  /** ユーザーキャンセルによる全停止か */
  abortedByUser: boolean
  outputDir: string | null
}

export type RateControl =
  | { mode: 'abr'; videoBitrateKbps: number }
  | { mode: 'crf'; crf: number; maxrateKbps?: number }

/** プリセット定義（shared/presets/*.json と一致） */
export interface Preset {
  id: string
  name: string
  description: string
  /** H.264 プロファイル（互換に関わるため固定運用） */
  profile: 'baseline' | 'main' | 'high'
  level: string // 例: "4.0"
  width: number
  height: number
  /** フレームレート分数: [num, den] 例 [30000, 1001] */
  frameRate: [number, number]
  pixFmt: string // yuv420p
  x264Preset: string // medium / slow / veryfast ...
  rateControl: RateControl
  audioCodec: 'aac'
  audioBitrateKbps: number
  audioSampleRate: number
  faststart: boolean
}

export interface StartQueueRequest {
  jobs: JobFile[]
  outputDir: string
  presetId: string
  concurrency: number
}

export interface AppConfig {
  concurrency: number
  lastOutputDir: string | null
  lastPresetId: string
  window: { width: number; height: number } | null
}

/** preload が公開する API（window.api） */
export interface Api {
  probeFiles(paths: string[]): Promise<JobFile[]>
  pickOutputDir(defaultDir: string): Promise<string | null>
  getDefaultOutputDir(): Promise<string>
  startQueue(req: StartQueueRequest): Promise<void>
  cancelJob(id: string): Promise<void>
  cancelAll(): Promise<void>
  saveLog(text: string): Promise<string | null>
  openPath(target: string): Promise<void>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  getPresets(): Promise<Preset[]>
  onJobUpdate(cb: (u: JobUpdate) => void): () => void
  onLog(cb: (l: LogLine) => void): () => void
  onQueueDone(cb: (s: QueueSummary) => void): () => void
}

export const DEFAULT_CONFIG: AppConfig = {
  concurrency: 3,
  lastOutputDir: null,
  lastPresetId: 'nissan-standard',
  window: null
}

export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 8
