import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import type { Preset } from '@shared/types'
import { ffmpegPath } from './ffmpegLocator'
import { buildFfmpegArgs } from './argBuilder'
import { parseProgressChunk, computeProgress } from './progressParser'
import { classifyError, tailLines } from './errorClassifier'
import { partPath } from './outputNaming'

export interface EncodeCallbacks {
  onProgress: (percent: number | null, etaSec: number | null) => void
  onLog: (text: string) => void
}

export type EncodeResultStatus = 'done' | 'error' | 'canceled'

export interface EncodeResult {
  status: EncodeResultStatus
  /** error 時の日本語理由 */
  errorReason?: string
  /** error 時の stderr 末尾 */
  errorDetail?: string
  outputPath?: string
}

/**
 * 1 ジョブをエンコードする。
 * - 一時名(.part)へ書き、成功時のみ最終名へリネーム
 * - キャンセル/エラー時は一時ファイルを削除
 */
export class EncodeTask {
  private proc: ChildProcess | null = null
  private canceled = false
  private finalPath: string

  constructor(
    private input: string,
    finalOutputPath: string,
    private preset: Preset,
    private startTimeMs: number
  ) {
    this.finalPath = finalOutputPath
  }

  cancel(): void {
    this.canceled = true
    if (this.proc && !this.proc.killed) {
      // Windows では子ツリーごと終了させる必要があるが、ffmpeg は単一プロセスなので kill で十分。
      this.proc.kill('SIGKILL')
    }
  }

  run(cb: EncodeCallbacks, durationSec: number | null): Promise<EncodeResult> {
    const tmp = partPath(this.finalPath)
    const args = buildFfmpegArgs(this.input, tmp, this.preset)

    return new Promise<EncodeResult>((resolve) => {
      let bin: string
      try {
        bin = ffmpegPath()
      } catch (e) {
        resolve({
          status: 'error',
          errorReason: 'ffmpeg バイナリが見つかりません',
          errorDetail: String(e)
        })
        return
      }

      cb.onLog(`$ ffmpeg ${args.join(' ')}`)
      const proc = spawn(bin, args, { windowsHide: true })
      this.proc = proc

      let stderrBuf = ''
      let progressBuf = ''

      proc.stdout.on('data', (d: Buffer) => {
        progressBuf += d.toString()
        // 完結したブロック単位で処理（progress= で終わる）
        let idx: number
        while ((idx = progressBuf.indexOf('progress=')) !== -1) {
          const nl = progressBuf.indexOf('\n', idx)
          if (nl === -1) break
          const block = progressBuf.slice(0, nl + 1)
          progressBuf = progressBuf.slice(nl + 1)
          const snap = parseProgressChunk(block)
          if (snap) {
            const elapsed = (nowMs() - this.startTimeMs) / 1000
            const { percent, etaSec } = computeProgress(
              snap.outTimeSec,
              durationSec,
              elapsed
            )
            cb.onProgress(percent, etaSec)
          }
        }
      })

      proc.stderr.on('data', (d: Buffer) => {
        const text = d.toString()
        stderrBuf += text
        // 肥大化を防ぐため保持は末尾のみ
        if (stderrBuf.length > 64 * 1024) {
          stderrBuf = stderrBuf.slice(-32 * 1024)
        }
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) cb.onLog(line)
        }
      })

      proc.on('error', (err) => {
        cleanup(tmp)
        resolve({
          status: 'error',
          errorReason: 'ffmpeg の起動に失敗しました',
          errorDetail: String(err)
        })
      })

      proc.on('close', (code) => {
        if (this.canceled) {
          cleanup(tmp)
          resolve({ status: 'canceled' })
          return
        }
        if (code === 0) {
          try {
            // 既存があっても最終名は衝突回避済みだが、念のため上書きでリネーム
            fs.renameSync(tmp, this.finalPath)
            cb.onProgress(100, 0)
            resolve({ status: 'done', outputPath: this.finalPath })
          } catch (e) {
            cleanup(tmp)
            resolve({
              status: 'error',
              errorReason: '出力ファイルの確定に失敗しました',
              errorDetail: String(e)
            })
          }
          return
        }
        // 異常終了
        cleanup(tmp)
        const { reason } = classifyError(stderrBuf)
        resolve({
          status: 'error',
          errorReason: reason,
          errorDetail: tailLines(stderrBuf)
        })
      })
    })
  }
}

function cleanup(p: string): void {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // 無視（残骸が残っても致命的ではない）
  }
}

// テスト/モック差し替えのために分離（Date.now を直接使う）
function nowMs(): number {
  return Date.now()
}
