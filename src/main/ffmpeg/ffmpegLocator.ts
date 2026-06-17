import { app } from 'electron'

// ffmpeg-static / ffprobe-static はバイナリへの絶対パスを default export する。
// パッケージ後は asar 内パスになるため、asarUnpack した実体（app.asar.unpacked）へ置換する。
import ffmpegStatic from 'ffmpeg-static'
// ffprobe-static は { path } 形式
import ffprobeStatic from 'ffprobe-static'

function unpacked(p: string): string {
  // 開発時は node_modules の生パス、パッケージ時は app.asar 内パスになる。
  // packaged のときだけ unpacked へ差し替える。
  if (app.isPackaged && p.includes('app.asar')) {
    return p.replace('app.asar', 'app.asar.unpacked')
  }
  return p
}

export function ffmpegPath(): string {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg バイナリが見つかりません（ffmpeg-static 未解決）')
  }
  return unpacked(ffmpegStatic as unknown as string)
}

export function ffprobePath(): string {
  const p = (ffprobeStatic as unknown as { path: string }).path
  if (!p) {
    throw new Error('ffprobe バイナリが見つかりません（ffprobe-static 未解決）')
  }
  return unpacked(p)
}
