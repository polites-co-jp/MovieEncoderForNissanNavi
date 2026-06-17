import { describe, it, expect } from 'vitest'
import {
  parseProgressChunk,
  hmsToSeconds,
  computeProgress
} from '../../src/main/ffmpeg/progressParser'

describe('parseProgressChunk', () => {
  it('out_time_us と progress=continue を読む', () => {
    const chunk = ['frame=10', 'out_time_us=5000000', 'progress=continue', ''].join('\n')
    const snap = parseProgressChunk(chunk)
    expect(snap).not.toBeNull()
    expect(snap!.outTimeSec).toBeCloseTo(5)
    expect(snap!.ended).toBe(false)
  })

  it('progress=end で ended=true', () => {
    const snap = parseProgressChunk('out_time_us=12000000\nprogress=end\n')
    expect(snap!.ended).toBe(true)
    expect(snap!.outTimeSec).toBeCloseTo(12)
  })

  it('out_time(HH:MM:SS) フォールバック', () => {
    const snap = parseProgressChunk('out_time=00:00:03.50\nprogress=continue\n')
    expect(snap!.outTimeSec).toBeCloseTo(3.5)
  })

  it('関係ない行のみなら null', () => {
    expect(parseProgressChunk('foo\nbar\n')).toBeNull()
  })
})

describe('hmsToSeconds', () => {
  it('時分秒を秒に', () => {
    expect(hmsToSeconds('01:02:03')).toBe(3723)
    expect(hmsToSeconds('00:00:10.5')).toBeCloseTo(10.5)
  })
  it('不正値は null', () => {
    expect(hmsToSeconds('abc')).toBeNull()
  })
})

describe('computeProgress', () => {
  it('duration 既知なら % と eta を計算', () => {
    const { percent, etaSec } = computeProgress(30, 120, 10)
    expect(percent).toBe(25)
    // 25% に 10 秒 → 残り 30 秒
    expect(etaSec).toBe(30)
  })

  it('duration 不明なら不定 (null)', () => {
    expect(computeProgress(30, null, 10)).toEqual({ percent: null, etaSec: null })
    expect(computeProgress(30, 0, 10)).toEqual({ percent: null, etaSec: null })
  })

  it('out_time 不明なら不定', () => {
    expect(computeProgress(null, 120, 10)).toEqual({ percent: null, etaSec: null })
  })

  it('% は 0..100 にクランプ', () => {
    const { percent } = computeProgress(200, 120, 10)
    expect(percent).toBe(100)
  })
})
