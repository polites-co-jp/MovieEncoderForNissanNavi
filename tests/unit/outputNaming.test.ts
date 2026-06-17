import { describe, it, expect } from 'vitest'
import * as path from 'path'
import {
  baseOutputName,
  resolveOutputPath,
  partPath
} from '../../src/main/ffmpeg/outputNaming'

describe('baseOutputName', () => {
  it('拡張子を .mp4 に変換する', () => {
    expect(baseOutputName('C:/v/movie.mkv')).toBe('movie.mp4')
    expect(baseOutputName('/x/clip.AVI')).toBe('clip.mp4')
    expect(baseOutputName('movie.mp4')).toBe('movie.mp4')
  })

  it('日本語ファイル名を保持する', () => {
    expect(baseOutputName('C:/v/旅行 動画.mov')).toBe('旅行 動画.mp4')
  })
})

describe('resolveOutputPath', () => {
  const outDir = path.join('C:', 'out')

  it('衝突しなければそのまま', () => {
    const p = resolveOutputPath('a/movie.mkv', outDir, () => false)
    expect(p).toBe(path.join(outDir, 'movie.mp4'))
  })

  it('衝突時のみ (1),(2) を付与', () => {
    const taken = new Set<string>([path.join(outDir, 'movie.mp4')])
    const p1 = resolveOutputPath('a/movie.mkv', outDir, (x) => taken.has(x))
    expect(p1).toBe(path.join(outDir, 'movie (1).mp4'))

    taken.add(path.join(outDir, 'movie (1).mp4'))
    const p2 = resolveOutputPath('a/movie.mkv', outDir, (x) => taken.has(x))
    expect(p2).toBe(path.join(outDir, 'movie (2).mp4'))
  })

  it('別フォルダ由来の同名は衝突回避される', () => {
    const taken = new Set<string>()
    const reserve = (input: string): string => {
      const p = resolveOutputPath(input, outDir, (x) => taken.has(x))
      taken.add(p)
      return p
    }
    expect(reserve('A/movie.mkv')).toBe(path.join(outDir, 'movie.mp4'))
    expect(reserve('B/movie.avi')).toBe(path.join(outDir, 'movie (1).mp4'))
  })
})

describe('partPath', () => {
  it('一時名は .part を付与', () => {
    expect(partPath('C:/out/movie.mp4')).toBe('C:/out/movie.mp4.part')
  })
})
