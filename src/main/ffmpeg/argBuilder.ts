import type { Preset } from '@shared/types'

/**
 * プリセット＋入出力パスから ffmpeg の引数配列を組み立てる。
 *
 * 進捗は stdout へ機械可読に出す（-progress pipe:1 -nostats）。
 * stderr は通常のログとして利用する。
 */
export function buildFfmpegArgs(input: string, output: string, preset: Preset): string[] {
  const { width, height } = preset

  // アスペクト維持で縮小し、黒帯でパディング
  const vf =
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`

  const args: string[] = [
    '-hide_banner',
    '-y', // 出力は .part の一時名なので上書き許可（最終名は別途衝突回避済み）
    '-i',
    input,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    preset.x264Preset,
    '-profile:v',
    preset.profile,
    '-level',
    preset.level,
    '-pix_fmt',
    preset.pixFmt,
    '-r',
    `${preset.frameRate[0]}/${preset.frameRate[1]}`
  ]

  // レート制御
  if (preset.rateControl.mode === 'abr') {
    args.push('-b:v', `${preset.rateControl.videoBitrateKbps}k`)
  } else {
    args.push('-crf', String(preset.rateControl.crf))
    if (preset.rateControl.maxrateKbps) {
      args.push(
        '-maxrate',
        `${preset.rateControl.maxrateKbps}k`,
        '-bufsize',
        `${preset.rateControl.maxrateKbps * 2}k`
      )
    }
  }

  // 音声
  args.push(
    '-c:a',
    preset.audioCodec,
    '-b:a',
    `${preset.audioBitrateKbps}k`,
    '-ar',
    String(preset.audioSampleRate)
  )

  if (preset.faststart) {
    args.push('-movflags', '+faststart')
  }

  // 進捗を stdout へ
  args.push('-progress', 'pipe:1', '-nostats')

  // 出力は `<final>.mp4.part` の一時名のため、拡張子からコンテナを判定できない。
  // 明示的に mp4 マルチプレクサを指定する。
  args.push('-f', 'mp4')

  args.push(output)
  return args
}

/** ffprobe の引数（メタ情報を JSON で取得） */
export function buildFfprobeArgs(input: string): string[] {
  return [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    input
  ]
}
