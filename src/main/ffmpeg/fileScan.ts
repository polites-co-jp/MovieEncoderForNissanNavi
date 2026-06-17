import * as fs from 'fs'
import * as path from 'path'
import { SUPPORTED_EXTENSIONS } from '@shared/types'

const SUPPORTED = new Set<string>(SUPPORTED_EXTENSIONS as readonly string[])

export function isSupported(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  return SUPPORTED.has(ext)
}

/**
 * 投入された path 群を、登録対象の入力ファイル絶対パス一覧へ展開する。
 * - ファイル: 対応拡張子のみ採用
 * - フォルダ: 直下のみ（再帰なし）の対応拡張子を採用
 * - 重複は除外
 */
export function collectInputFiles(paths: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  const add = (p: string): void => {
    const abs = path.resolve(p)
    if (seen.has(abs)) return
    if (!isSupported(abs)) return
    seen.add(abs)
    result.push(abs)
  }

  for (const p of paths) {
    let stat: fs.Stats
    try {
      stat = fs.statSync(p)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(p, { withFileTypes: true })
      } catch {
        continue
      }
      // 直下のみ・再帰しない
      for (const e of entries) {
        if (e.isFile()) add(path.join(p, e.name))
      }
    } else if (stat.isFile()) {
      add(p)
    }
  }

  return result
}
