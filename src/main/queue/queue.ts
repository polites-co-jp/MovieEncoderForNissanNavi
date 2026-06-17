import * as fs from 'fs'
import type {
  JobFile,
  JobUpdate,
  LogLine,
  Preset,
  QueueSummary
} from '@shared/types'
import { EncodeTask } from '../ffmpeg/encoder'
import { resolveOutputPath } from '../ffmpeg/outputNaming'

export interface QueueCallbacks {
  onJobUpdate: (u: JobUpdate) => void
  onLog: (l: LogLine) => void
  onDone: (s: QueueSummary) => void
}

interface InternalJob {
  file: JobFile
  outputPath: string
  task: EncodeTask | null
  status: 'waiting' | 'encoding' | 'done' | 'error' | 'canceled'
}

/**
 * 同時実行数つきの変換キュー。
 * - concurrency 本まで並列にエンコード
 * - 1 ジョブのエラーは他に波及させず継続（設計どおり）
 * - cancelJob / cancelAll に対応
 */
export class ConversionQueue {
  private jobs: InternalJob[] = []
  private running = new Set<string>()
  private nextIndex = 0
  private concurrency = 1
  private preset!: Preset
  private outputDir = ''
  private aborted = false
  private active = false
  // バッチ内で予約済みの出力名（実ファイル化前でも衝突回避するため）
  private reserved = new Set<string>()

  constructor(private cb: QueueCallbacks) {}

  get isActive(): boolean {
    return this.active
  }

  start(
    files: JobFile[],
    outputDir: string,
    preset: Preset,
    concurrency: number
  ): void {
    if (this.active) return
    this.active = true
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

    this.jobs = files.map((file) => {
      const outputPath = resolveOutputPath(
        file.inputPath,
        outputDir,
        (p) => this.reserved.has(p) || fs.existsSync(p)
      )
      this.reserved.add(outputPath)
      return { file, outputPath, task: null, status: 'waiting' as const }
    })

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
      job.outputPath,
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
          job.status = 'done'
          this.cb.onJobUpdate({
            id,
            status: 'done',
            progress: 100,
            etaSec: 0,
            outputPath: result.outputPath ?? null
          })
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
    if (!this.active) return
    const pending = this.jobs.some(
      (j) => j.status === 'waiting' || j.status === 'encoding'
    )
    if (pending) return
    if (this.running.size > 0) return

    const summary: QueueSummary = {
      done: this.jobs.filter((j) => j.status === 'done').length,
      error: this.jobs.filter((j) => j.status === 'error').length,
      canceled: this.jobs.filter((j) => j.status === 'canceled').length,
      abortedByUser: this.aborted,
      outputDir: this.outputDir
    }
    this.active = false
    this.cb.onDone(summary)
  }
}
