import { execFile } from 'child_process'
import type { MediaInfo } from '@shared/types'
import { ffprobePath } from './ffmpegLocator'
import { buildFfprobeArgs } from './argBuilder'

const FAILED: MediaInfo = {
  resolution: null,
  videoCodec: null,
  frameRate: null,
  durationSec: null,
  failed: true
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  avg_frame_rate?: string
  r_frame_rate?: string
  duration?: string
}

interface FfprobeOutput {
  streams?: FfprobeStream[]
  format?: { duration?: string }
}

/** "30000/1001" や "30/1" を fps 数値へ。失敗時 null */
export function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null
  const m = value.match(/^(\d+)\/(\d+)$/)
  if (m) {
    const den = Number(m[2])
    if (den === 0) return null
    return Math.round((Number(m[1]) / den) * 100) / 100
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** ffprobe の JSON 出力から MediaInfo を抽出（パースのみ。テスト容易化のため分離） */
export function parseFfprobeJson(json: FfprobeOutput): MediaInfo {
  const video = json.streams?.find((s) => s.codec_type === 'video')
  const duration =
    Number(json.format?.duration) || (video?.duration ? Number(video.duration) : NaN)

  if (!video) {
    return {
      resolution: null,
      videoCodec: null,
      frameRate: null,
      durationSec: Number.isFinite(duration) ? duration : null,
      failed: false
    }
  }

  return {
    resolution:
      video.width && video.height ? `${video.width}x${video.height}` : null,
    videoCodec: video.codec_name ?? null,
    frameRate: parseFrameRate(video.avg_frame_rate ?? video.r_frame_rate),
    durationSec: Number.isFinite(duration) ? duration : null,
    failed: false
  }
}

/** 実 ffprobe を起動してメタ情報を取得。失敗時は failed: true を返す（例外を投げない）。 */
export function probe(inputPath: string): Promise<MediaInfo> {
  return new Promise((resolve) => {
    let bin: string
    try {
      bin = ffprobePath()
    } catch {
      resolve(FAILED)
      return
    }
    execFile(
      bin,
      buildFfprobeArgs(inputPath),
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve(FAILED)
          return
        }
        try {
          const json = JSON.parse(stdout) as FfprobeOutput
          resolve(parseFfprobeJson(json))
        } catch {
          resolve(FAILED)
        }
      }
    )
  })
}
