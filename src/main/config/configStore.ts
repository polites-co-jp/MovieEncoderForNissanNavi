import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { AppConfig, DEFAULT_CONFIG } from '@shared/types'

/**
 * 設定の永続化。
 * 第一候補: exe と同階層の config.json（ポータブル思想に一致）。
 * 書込不可なら userData にフォールバック。
 */
function portableConfigPath(): string {
  // パッケージ時は exe のあるフォルダ、開発時は cwd を使う
  const dir = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  return path.join(dir, 'config.json')
}

function userDataConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

let resolvedPath: string | null = null

function canWrite(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath)
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function configPath(): string {
  if (resolvedPath) return resolvedPath
  const portable = portableConfigPath()
  resolvedPath = canWrite(portable) ? portable : userDataConfigPath()
  return resolvedPath
}

export function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...loadConfig(), ...patch }
  try {
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf-8')
  } catch {
    // 保存失敗は致命的でないため握りつぶす
  }
  return next
}

/** デフォルト出力先 = アプリフォルダ配下 output/ */
export function defaultOutputDir(): string {
  const base = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
  return path.join(base, 'output')
}
