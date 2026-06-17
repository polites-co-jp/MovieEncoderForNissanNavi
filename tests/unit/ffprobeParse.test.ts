import { describe, it, expect } from 'vitest'
import { parseFfprobeJson, parseFrameRate } from '../../src/main/ffmpeg/ffprobe'

describe('parseFrameRate', () => {
  it('分数 30000/1001 を 29.97 に', () => {
    expect(parseFrameRate('30000/1001')).toBeCloseTo(29.97, 1)
  })
  it('30/1 を 30 に', () => {
    expect(parseFrameRate('30/1')).toBe(30)
  })
  it('0除算や不正は null', () => {
    expect(parseFrameRate('30/0')).toBeNull()
    expect(parseFrameRate(undefined)).toBeNull()
  })
})

describe('parseFfprobeJson', () => {
  it('映像ストリームから解像度/コーデック/fps/再生時間', () => {
    const info = parseFfprobeJson({
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          avg_frame_rate: '30000/1001'
        },
        { codec_type: 'audio', codec_name: 'aac' }
      ],
      format: { duration: '123.45' }
    })
    expect(info.resolution).toBe('1920x1080')
    expect(info.videoCodec).toBe('h264')
    expect(info.frameRate).toBeCloseTo(29.97, 1)
    expect(info.durationSec).toBeCloseTo(123.45)
    expect(info.failed).toBe(false)
  })

  it('映像なしでも duration は拾う', () => {
    const info = parseFfprobeJson({
      streams: [{ codec_type: 'audio', codec_name: 'aac' }],
      format: { duration: '10' }
    })
    expect(info.videoCodec).toBeNull()
    expect(info.durationSec).toBe(10)
    expect(info.failed).toBe(false)
  })

  it('H.265(hevc) 入力も認識', () => {
    const info = parseFfprobeJson({
      streams: [
        { codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160, r_frame_rate: '24/1' }
      ],
      format: { duration: '5' }
    })
    expect(info.videoCodec).toBe('hevc')
    expect(info.resolution).toBe('3840x2160')
    expect(info.frameRate).toBe(24)
  })
})
