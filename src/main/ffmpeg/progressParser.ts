/**
 * ffmpeg `-progress pipe:1` の出力をパースする。
 *
 * 出力は `key=value` 改行区切りで、`progress=continue|end` で 1 ブロックの区切りになる。
 * 主に使うキー:
 *   out_time_us / out_time_ms ... 処理済みの出力時間
 *   progress ... continue / end
 */

export interface ProgressSnapshot {
  /** 出力済み時間（秒）。取得できなければ null */
  outTimeSec: number | null
  ended: boolean
}

/** 1 つ以上の key=value 行を含むチャンクから最新スナップショットを抽出 */
export function parseProgressChunk(chunk: string): ProgressSnapshot | null {
  const lines = chunk.split(/\r?\n/)
  let outTimeSec: number | null = null
  let ended = false
  let sawAny = false

  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()

    switch (key) {
      case 'out_time_us':
      case 'out_time_ms': {
        // out_time_us はマイクロ秒、out_time_ms も実際にはマイクロ秒で出る ffmpeg がある。
        // どちらも µs とみなして秒換算（ffmpeg の既知の挙動）。
        const n = Number(value)
        if (Number.isFinite(n) && n >= 0) {
          outTimeSec = n / 1_000_000
          sawAny = true
        }
        break
      }
      case 'out_time': {
        // HH:MM:SS.micro 形式のフォールバック
        if (outTimeSec == null) {
          const sec = hmsToSeconds(value)
          if (sec != null) {
            outTimeSec = sec
            sawAny = true
          }
        }
        break
      }
      case 'progress':
        if (value === 'end') ended = true
        sawAny = true
        break
    }
  }

  if (!sawAny) return null
  return { outTimeSec, ended }
}

/** HH:MM:SS.micro → 秒 */
export function hmsToSeconds(hms: string): number | null {
  const m = hms.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const s = Number(m[3])
  if (![h, min, s].every(Number.isFinite)) return null
  return h * 3600 + min * 60 + s
}

/**
 * 進捗率(0..100)と残り時間(秒)を算出。
 * duration 不明（null/0）なら progress=null（不定）。
 */
export function computeProgress(
  outTimeSec: number | null,
  durationSec: number | null,
  elapsedSec: number
): { percent: number | null; etaSec: number | null } {
  if (!durationSec || durationSec <= 0 || outTimeSec == null) {
    return { percent: null, etaSec: null }
  }
  const ratio = Math.min(1, Math.max(0, outTimeSec / durationSec))
  const percent = Math.round(ratio * 1000) / 10 // 小数1桁
  let etaSec: number | null = null
  if (ratio > 0.001 && elapsedSec > 0) {
    const total = elapsedSec / ratio
    etaSec = Math.max(0, Math.round(total - elapsedSec))
  }
  return { percent, etaSec }
}
