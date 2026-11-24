import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type {
  JobFile,
  JobUpdate,
  LogLine,
  Preset,
  QueueSummary
} from '@shared/types'
import { EncodeTask } from '../ffmpeg/encoder'
import { resolveOutputPath } from '../ffmpeg/outputNaming'
import { transferInNameOrder } from './nameOrderTransfer'

export interface QueueCallbacks {
  onJobUpdate: (u: JobUpdate) => void
  onLog: (l: LogLine) => void
  onDone: (s: QueueSummary) => void
}

interface InternalJob {
  file: JobFile
  /** 出力先での最終パス */
  outputPath: string
  /** 一時領域での変換先パス（ファイル名は outputPath と同じ） */
  stagedPath: string
  task: EncodeTask | null
  status: 'waiting' | 'encoding' | 'staged' | 'done' | 'error' | 'canceled'
}

/** encoding: 変換中 / transferring: 出力先へ転記中 / idle: 未開始または完了 */
type Phase = 'idle' | 'encoding' | 'transferring'

/**
 * 同時実行数つきの変換キュー。
 * - concurrency 本まで並列にエンコード
 * - 1 ジョブのエラーは他に波及させず継続（設計どおり）
 * - cancelJob / cancelAll に対応
 * - 変換は一時領域へ行い、全ジョブ終了後にファイル名順で出力先へ転記する
 *   （ナビはフォルダへの書き込み順で表示するため。nameOrderTransfer.ts 参照）
 * - 停止しても変換済みのファイルは転記する
 */
export class ConversionQueue {
  private jobs: InternalJob[] = []
  private running = new Set<string>()
  private nextIndex = 0
  private concurrency = 1
  private preset!: Preset
  private outputDir = ''
  private aborted = false
  private phase: Phase = 'idle'
  private stagingDir = ''
  // バッチ内で予約済みの出力名（実ファイル化前でも衝突回避するため）
  private reserved = new Set<string>()

  constructor(private cb: QueueCallbacks) {}

  get isActive(): boolean {
    return this.phase !== 'idle'
  }

  start(
    files: JobFile[],
    outputDir: string,
    preset: Preset,
    concurrency: number
  ): void {
    if (this.phase !== 'idle') return
    this.phase = 'encoding'
    this.aborted = false
    this.outputDir = outputDir
    this.preset = preset
    this.concurrency = Math.max(1, concurrency)
    this.nextIndex = 0
    this.reserved.clear()
    this.running.clear()

    // 出力先を用意
    try {
      fs.mkdirSync(outputDir, { recursive: true })
    } catch {
      // mkdir 失敗は各ジョブ実行時にエラーとして顕在化する
    }

    let stagingError: unknown = null
    try {
      this.stagingDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'movie-encoder-for-nissan-navi-')
      )
    } catch (e) {
      stagingError = e
      this.stagingDir = ''
    }

    this.jobs = files.map((file) => {
      const outputPath = resolveOutputPath(
        file.inputPath,
        outputDir,
        (p) => this.reserved.has(p) || fs.existsSync(p)
      )
      this.reserved.add(outputPath)
      // 出力名はバッチ内で一意なので、一時領域でも同じファイル名で衝突しない
      const stagedPath = path.join(this.stagingDir, path.basename(outputPath))
      return { file, outputPath, stagedPath, task: null, status: 'waiting' as const }
    })

    if (stagingError) {
      for (const job of this.jobs) {
        job.status = 'error'
        this.cb.onJobUpdate({
          id: job.file.id,
          status: 'error',
          errorReason: '一時フォルダを作成できませんでした'
        })
      }
      this.cb.onLog({ jobId: null, fileName: null, text: String(stagingError) })
    }

    this.pump()
  }

  cancelJob(id: string): void {
    const job = this.jobs.find((j) => j.file.id === id)
    if (!job) return
    if (job.status === 'encoding' && job.task) {
      job.task.cancel()
    } else if (job.status === 'waiting') {
      job.status = 'canceled'
      this.cb.onJobUpdate({ id, status: 'canceled' })
      this.maybeFinish()
    }
  }

  cancelAll(): void {
    this.aborted = true
    // 待機中をキャンセル扱いに
    for (const job of this.jobs) {
      if (job.status === 'waiting') {
        job.status = 'canceled'
        this.cb.onJobUpdate({ id: job.file.id, status: 'canceled' })
      }
    }
    // 実行中を kill
    for (const job of this.jobs) {
      if (job.status === 'encoding' && job.task) {
        job.task.cancel()
      }
    }
    this.maybeFinish()
  }

  private pump(): void {
    while (
      !this.aborted &&
      this.running.size < this.concurrency &&
      this.nextIndex < this.jobs.length
    ) {
      const job = this.jobs[this.nextIndex++]
      if (job.status !== 'waiting') continue
      this.runJob(job)
    }
    this.maybeFinish()
  }

  private runJob(job: InternalJob): void {
    const id = job.file.id
    const fileName = job.file.fileName
    job.status = 'encoding'
    this.running.add(id)
    this.cb.onJobUpdate({ id, status: 'encoding', progress: null })

    const durationSec = job.file.media?.durationSec ?? null
    const task = new EncodeTask(
      job.file.inputPath,
      job.stagedPath,
      this.preset,
      Date.now()
    )
    job.task = task

    task
      .run(
        {
          onProgress: (percent, etaSec) =>
            this.cb.onJobUpdate({ id, progress: percent, etaSec }),
          onLog: (text) => this.cb.onLog({ jobId: id, fileName, text })
        },
        durationSec
      )
      .then((result) => {
        this.running.delete(id)
        if (result.status === 'done') {
          // 出力先への転記は全ジョブ終了後にファイル名順でまとめて行う
          job.status = 'staged'
          this.cb.onJobUpdate({ id, status: 'staged', progress: 100, etaSec: 0 })
        } else if (result.status === 'canceled') {
          job.status = 'canceled'
          this.cb.onJobUpdate({ id, status: 'canceled' })
        } else {
          job.status = 'error'
          this.cb.onJobUpdate({
            id,
            status: 'error',
            errorReason: result.errorReason ?? '変換に失敗しました'
          })
          if (result.errorDetail) {
            this.cb.onLog({ jobId: id, fileName, text: result.errorDetail })
          }
        }
        // 次を投入（他ファイルは継続）
        this.pump()
      })
  }

  private maybeFinish(): void {
    if (this.phase !== 'encoding') return
    const pending = this.jobs.some(
      (j) => j.status === 'waiting' || j.status === 'encoding'
    )
    if (pending) return
    if (this.running.size > 0) return

    this.phase = 'transferring'
    void this.transferAndFinish()
  }

  /** 変換済みファイルをファイル名順に出力先へ転記してからサマリを通知する。 */
  private async transferAndFinish(): Promise<void> {
    const staged = this.jobs.filter((j) => j.status === 'staged')
    const byId = new Map(staged.map((j) => [j.file.id, j]))

    if (staged.length > 0) {
      this.cb.onLog({
        jobId: null,
        fileName: null,
        text: `出力先へファイル名順に転記します（${staged.length} 件）`
      })
    }

    await transferInNameOrder(
      staged.map((j) => ({
        id: j.file.id,
        stagedPath: j.stagedPath,
        finalPath: j.outputPath
      })),
      (o) => {
        const job = byId.get(o.id)
        if (!job) return
        if (o.ok) {
          job.status = 'done'
          this.cb.onJobUpdate({ id: o.id, status: 'done', outputPath: o.finalPath })
        } else {
          job.status = 'error'
          this.cb.onJobUpdate({ id: o.id, status: 'error', errorReason: o.reason })
          this.cb.onLog({ jobId: o.id, fileName: job.file.fileName, text: o.detail })
        }
      }
    )

    if (this.stagingDir) {
      try {
        fs.rmSync(this.stagingDir, { recursive: true, force: true })
      } catch {
        // 一時フォルダの残骸は致命的ではない
      }
    }

    const summary: QueueSummary = {
      done: this.jobs.filter((j) => j.status === 'done').length,
      error: this.jobs.filter((j) => j.status === 'error').length,
      canceled: this.jobs.filter((j) => j.status === 'canceled').length,
      abortedByUser: this.aborted,
      outputDir: this.outputDir
    }
    this.phase = 'idle'
    this.cb.onDone(summary)
  }
}
