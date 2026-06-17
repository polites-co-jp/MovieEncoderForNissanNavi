import { describe, it, expect } from 'vitest'
import { buildFfmpegArgs, buildFfprobeArgs } from '../../src/main/ffmpeg/argBuilder'
import { getPreset } from '../../src/shared/presets'

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

describe('buildFfmpegArgs (Nissan 標準 / ABR)', () => {
  const preset = getPreset('nissan-standard')
  const args = buildFfmpegArgs('in.mkv', 'out.mp4.part', preset)

  it('入出力が含まれる', () => {
    expect(argValue(args, '-i')).toBe('in.mkv')
    expect(args[args.length - 1]).toBe('out.mp4.part')
  })

  it('H.264 High/Level4.0/yuv420p', () => {
    expect(argValue(args, '-c:v')).toBe('libx264')
    expect(argValue(args, '-profile:v')).toBe('high')
    expect(argValue(args, '-level')).toBe('4.0')
    expect(argValue(args, '-pix_fmt')).toBe('yuv420p')
  })

  it('29.97fps と 4000k 平均ビットレート', () => {
    expect(argValue(args, '-r')).toBe('30000/1001')
    expect(argValue(args, '-b:v')).toBe('4000k')
    expect(args).not.toContain('-crf')
  })

  it('x264 preset と音声 AAC 48k 128k', () => {
    expect(argValue(args, '-preset')).toBe('medium')
    expect(argValue(args, '-c:a')).toBe('aac')
    expect(argValue(args, '-b:a')).toBe('128k')
    expect(argValue(args, '-ar')).toBe('48000')
  })

  it('faststart と progress pipe', () => {
    expect(argValue(args, '-movflags')).toBe('+faststart')
    expect(argValue(args, '-progress')).toBe('pipe:1')
    expect(args).toContain('-nostats')
  })

  it('一時ファイル(.part)向けに mp4 コンテナを明示する', () => {
    expect(argValue(args, '-f')).toBe('mp4')
  })

  it('scale+pad のフィルタ', () => {
    const vf = argValue(args, '-vf')
    expect(vf).toContain('scale=1280:720:force_original_aspect_ratio=decrease')
    expect(vf).toContain('pad=1280:720')
  })
})

describe('buildFfmpegArgs (高画質 / CRF)', () => {
  const preset = getPreset('high-quality')
  const args = buildFfmpegArgs('in.mp4', 'out.mp4.part', preset)

  it('CRF 指定で maxrate/bufsize が付き、-b:v は付かない', () => {
    expect(argValue(args, '-crf')).toBe('18')
    expect(argValue(args, '-maxrate')).toBe('8000k')
    expect(argValue(args, '-bufsize')).toBe('16000k')
    expect(args).not.toContain('-b:v')
  })

  it('x264 preset は slow、音声 192k', () => {
    expect(argValue(args, '-preset')).toBe('slow')
    expect(argValue(args, '-b:a')).toBe('192k')
  })
})

describe('buildFfprobeArgs', () => {
  it('JSON 出力で format/streams を要求', () => {
    const a = buildFfprobeArgs('in.mkv')
    expect(a).toContain('-show_format')
    expect(a).toContain('-show_streams')
    expect(argValue(a, '-of')).toBe('json')
    expect(a[a.length - 1]).toBe('in.mkv')
  })
})
