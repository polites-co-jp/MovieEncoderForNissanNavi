import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import ffmpegStatic from 'ffmpeg-static'
import type { JobFile, JobUpdate, QueueSummary } from '@shared/types'
import { getPreset } from '../../src/shared/presets'

// ffmpegLocator が electron の app を参照するため、テストでは非パッケージ扱いにする
vi.mock('electron', () => ({ app: { isPackaged: false } }))

const { ConversionQueue } = await import('../../src/main/queue/queue')

const ffmpeg = ffmpegStatic as unknown as string
let root = ''

function genInput(file: string, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `testsrc=size=320x240:rate=30:duration=${seconds}`,
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=440:duration=${seconds}`,
        '-shortest',
        file
      ],
      (err) => (err ? reject(err) : resolve())
    )
  })
}

describe('統合: 一括変換は名前順に出力先へ転記される', () => {
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'menc-queue-'))
  })
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('並列変換の完了順に関係なく、出力先への書き込みはファイル名順になる', async () => {
    const inDir = path.join(root, 'in')
    const outDir = path.join(root, 'out')
    fs.mkdirSync(inDir)

    // 名前順で先のものほど長くし、並列実行だと完了順が名前順と逆になるようにする
    const specs: Array<[string, number]> = [
      ['1.mkv', 6],
      ['2.mkv', 3],
      ['10.mkv', 1]
    ]
    const jobs: JobFile[] = []
    for (const [name, sec] of specs) {
      const p = path.join(inDir, name)
      await genInput(p, sec)
      jobs.push({
        id: name,
        inputPath: p,
        fileName: name,
        media: { resolution: '320x240', videoCodec: 'mpeg4', frameRate: 30, durationSec: sec, failed: false }
      })
    }

    const stagingDirs = (): string[] =>
      fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('movie-encoder-for-nissan-navi-'))
    const before = new Set(stagingDirs())

    const stagedOrder: string[] = []
    const doneOrder: string[] = []
    const summary = await new Promise<QueueSummary>((resolve) => {
      const q = new ConversionQueue({
        onJobUpdate: (u: JobUpdate) => {
          if (u.status === 'staged') {
            stagedOrder.push(u.id)
            // 転記前は出力先にまだ置かれていない
            expect(fs.existsSync(path.join(outDir, u.id.replace('.mkv', '.mp4')))).toBe(false)
          }
          if (u.status === 'done') doneOrder.push(u.id)
        },
        onLog: () => undefined,
        onDone: resolve
      })
      q.start(jobs, outDir, getPreset('fast'), 3)
    })

    expect(summary.done).toBe(3)
    expect(summary.error).toBe(0)
    expect(stagedOrder).toHaveLength(3)
    // 転記（＝出力先への書き込み）はファイル名順
    expect(doneOrder).toEqual(['1.mkv', '2.mkv', '10.mkv'])
    expect(fs.readdirSync(outDir).sort()).toEqual(['1.mp4', '10.mp4', '2.mp4'])
    // 一時フォルダは片付けられている
    expect(stagingDirs().filter((n) => !before.has(n))).toEqual([])
  })
})
