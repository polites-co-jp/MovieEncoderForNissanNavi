import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  compareFileNames,
  sortForTransfer,
  transferInNameOrder,
  transferErrorReason,
  type TransferOutcome
} from '../../src/main/queue/nameOrderTransfer'

describe('compareFileNames', () => {
  it('数字は数値として比較する（エクスプローラーと同じ並び）', () => {
    const names = ['10.mp4', '2.mp4', '1.mp4', 'ep 11.mp4', 'ep 9.mp4']
    expect([...names].sort(compareFileNames)).toEqual([
      '1.mp4',
      '2.mp4',
      '10.mp4',
      'ep 9.mp4',
      'ep 11.mp4'
    ])
  })

  it('連番付きの衝突回避名は元の名前の直後に並ぶ', () => {
    const names = ['movie (1).mp4', 'movie.mp4', 'movie (2).mp4']
    expect([...names].sort(compareFileNames)).toEqual([
      'movie.mp4',
      'movie (1).mp4',
      'movie (2).mp4'
    ])
  })

  it('大文字小文字だけが違う名前も決定的に並ぶ', () => {
    expect(compareFileNames('A.mp4', 'a.mp4')).not.toBe(0)
    expect(compareFileNames('A.mp4', 'a.mp4')).toBe(-compareFileNames('a.mp4', 'A.mp4'))
  })
})

describe('sortForTransfer', () => {
  it('出力先のファイル名で並べる（一時パス・入力順は無関係）', () => {
    const items = [
      { id: 'c', stagedPath: '/t/x', finalPath: '/o/第10話.mp4' },
      { id: 'a', stagedPath: '/t/y', finalPath: '/o/第1話.mp4' },
      { id: 'b', stagedPath: '/t/z', finalPath: '/o/第2話.mp4' }
    ]
    expect(sortForTransfer(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('transferInNameOrder', () => {
  let root = ''
  let staging = ''
  let out = ''

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'menc-transfer-'))
    staging = path.join(root, 'staging')
    out = path.join(root, 'out')
    fs.mkdirSync(staging)
    fs.mkdirSync(out)
  })
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function stage(name: string, content = name): string {
    const p = path.join(staging, name)
    fs.writeFileSync(p, content)
    return p
  }

  it('ファイル名順に 1 件ずつ転記し、一時ファイルは残さない', async () => {
    const names = ['10.mp4', '2.mp4', '1.mp4']
    const items = names.map((n) => ({
      id: n,
      stagedPath: stage(n),
      finalPath: path.join(out, n)
    }))
    const seen: string[] = []
    const outcomes = await transferInNameOrder(items, (o) => seen.push(o.id))

    expect(seen).toEqual(['1.mp4', '2.mp4', '10.mp4'])
    expect(outcomes.every((o) => o.ok)).toBe(true)
    for (const n of names) {
      expect(fs.readFileSync(path.join(out, n), 'utf-8')).toBe(n)
    }
    expect(fs.readdirSync(staging)).toEqual([])
  })

  it('既存ファイルは上書きせず、その 1 件だけエラーにして継続する', async () => {
    fs.writeFileSync(path.join(out, 'b.mp4'), 'existing')
    const items = ['a.mp4', 'b.mp4', 'c.mp4'].map((n) => ({
      id: n,
      stagedPath: stage(n),
      finalPath: path.join(out, n)
    }))
    const outcomes: TransferOutcome[] = await transferInNameOrder(items, () => undefined)

    expect(outcomes.map((o) => [o.id, o.ok])).toEqual([
      ['a.mp4', true],
      ['b.mp4', false],
      ['c.mp4', true]
    ])
    expect(fs.readFileSync(path.join(out, 'b.mp4'), 'utf-8')).toBe('existing')
    const failed = outcomes[1]
    expect(failed.ok === false && failed.reason).toContain('同名ファイル')
  })

  it('出力先が無ければエラー理由を返す', async () => {
    const items = [
      { id: 'x', stagedPath: stage('x.mp4'), finalPath: path.join(root, 'missing', 'x.mp4') }
    ]
    const [o] = await transferInNameOrder(items, () => undefined)
    expect(o.ok).toBe(false)
  })
})

describe('transferErrorReason', () => {
  it('errno コードから日本語の理由を返す', () => {
    expect(transferErrorReason({ code: 'ENOSPC' })).toContain('容量不足')
    expect(transferErrorReason({ code: 'EACCES' })).toContain('権限')
    expect(transferErrorReason(new Error('x'))).toContain('転記に失敗')
  })
})
