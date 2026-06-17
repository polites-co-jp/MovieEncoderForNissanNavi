import type { Preset } from '../types'
import nissanStandard from './nissan-standard.json'
import highQuality from './high-quality.json'
import fast from './fast.json'
import safeCompat from './safe-compat.json'

// プリセットは読み取り専用（v1 では GUI 編集なし）。
// 既定は先頭（Nissan 標準）。
// JSON 由来の型は frameRate が number[]、rateControl.mode が string に推論されるため、
// Preset の厳密型（タプル/リテラル）へは unknown 経由でキャストする。
export const PRESETS: Preset[] = [
  nissanStandard as unknown as Preset,
  highQuality as unknown as Preset,
  fast as unknown as Preset,
  safeCompat as unknown as Preset
]

export const DEFAULT_PRESET_ID = 'nissan-standard'

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
