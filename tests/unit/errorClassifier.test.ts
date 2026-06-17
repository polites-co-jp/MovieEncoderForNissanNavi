import { describe, it, expect } from 'vitest'
import { classifyError, tailLines } from '../../src/main/ffmpeg/errorClassifier'

describe('classifyError', () => {
  it('容量不足', () => {
    expect(classifyError('av_interleaved_write_frame(): No space left on device').kind).toBe(
      'disk-full'
    )
  })
  it('権限', () => {
    expect(classifyError('Error opening output: Permission denied').kind).toBe('permission')
  })
  it('破損', () => {
    expect(classifyError('Invalid data found when processing input').kind).toBe('corrupt')
    expect(classifyError('moov atom not found').kind).toBe('corrupt')
  })
  it('ストリームなし', () => {
    expect(classifyError('Output file does not contain any stream').kind).toBe('no-stream')
  })
  it('不明はフォールバック', () => {
    const r = classifyError('something totally unexpected')
    expect(r.kind).toBe('unknown')
    expect(r.reason).toContain('変換に失敗')
  })
})

describe('tailLines', () => {
  it('末尾 N 行を返し空行を除く', () => {
    const text = ['a', '', 'b', 'c', '', 'd'].join('\n')
    expect(tailLines(text, 2)).toBe('c\nd')
  })
})
