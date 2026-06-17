import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile, execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import { buildFfmpegArgs } from '../../src/main/ffmpeg/argBuilder'
import { getPreset } from '../../src/shared/presets'

// 実 ffmpeg を起動する統合テスト。サンプル動画は同梱せず lavfi で生成する。
const ffmpeg = ffmpegStatic as unknown as string
const ffprobe = (ffprobeStatic as unknown as { path: string }).path

let tmpDir = ''

function run(bin: string, args: string[]): Promise<{ code: number }> {
  return new Promise((resolve) => {
    execFile(bin, args, { maxBuffer: 50 * 1024 * 1024 }, (err) => {
      resolve({ code: err ? 1 : 0 })
    })
  })
}

/** lavfi で映像+音声付きのテスト入力を生成 */
function genInput(file: string, size: string, seconds: number): Promise<{ code: number }> {
  return run(ffmpeg, [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=size=${size}:rate=30:duration=${seconds}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:duration=${seconds}`,
    '-shortest',
    file
  ])
}

function probeJson(file: string): { streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }> } {
  const out = execFileSync(ffprobe, [
    '-v',
    'error',
    '-show_streams',
    '-of',
    'json',
    file
  ]).toString()
  return JSON.parse(out)
}

describe('統合: lavfi 生成 → MM521D-L 形式へエンコード', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'menc-it-'))
  })
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // 無視
    }
  })

  it('ffmpeg/ffprobe バイナリが解決できる', () => {
    expect(ffmpeg && fs.existsSync(ffmpeg)).toBeTruthy()
    expect(ffprobe && fs.existsSync(ffprobe)).toBeTruthy()
  })

  it('日本語ファイル名の入力を 1280x720 / h264 へ変換できる', async () => {
    const input = path.join(tmpDir, '旅行 動画.mkv')
    const output = path.join(tmpDir, 'out.mp4')
    expect((await genInput(input, '640x480', 2)).code).toBe(0)

    const preset = getPreset('nissan-standard')
    const args = buildFfmpegArgs(input, output, preset)
    const { code } = await run(ffmpeg, args)
    expect(code).toBe(0)
    expect(fs.existsSync(output)).toBe(true)

    const info = probeJson(output)
    const v = info.streams?.find((s) => s.codec_type === 'video')
    expect(v?.codec_name).toBe('h264')
    expect(v?.width).toBe(1280)
    expect(v?.height).toBe(720)
    const a = info.streams?.find((s) => s.codec_type === 'audio')
    expect(a?.codec_name).toBe('aac')
  })

  it('4K 入力もアスペクト維持で 720p に収まる', async () => {
    const input = path.join(tmpDir, '4k.mp4')
    const output = path.join(tmpDir, '4k_out.mp4')
    expect((await genInput(input, '3840x2160', 1)).code).toBe(0)

    const args = buildFfmpegArgs(input, output, getPreset('fast'))
    expect((await run(ffmpeg, args)).code).toBe(0)

    const v = probeJson(output).streams?.find((s) => s.codec_type === 'video')
    expect(v?.width).toBe(1280)
    expect(v?.height).toBe(720)
  })
})
