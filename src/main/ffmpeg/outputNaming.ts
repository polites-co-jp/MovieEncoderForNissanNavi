import * as path from 'path'

/**
 * 入力パスから、出力ディレクトリ内での MP4 出力名（ベース名）を決める。
 * 拡張子は常に .mp4 に変換する。
 */
export function baseOutputName(inputPath: string): string {
  const base = path.basename(inputPath, path.extname(inputPath))
  return `${base}.mp4`
}

/**
 * 出力先で衝突しないファイルパスを決定する。
 * - 衝突しなければそのまま `<name>.mp4`
 * - 衝突する場合のみ `<name> (1).mp4`, `<name> (2).mp4` ... と採番
 *
 * @param exists 与えられた絶対パスが既に存在するかを返す述語（同期）。
 *               実ファイルだけでなく、同一バッチ内で予約済みの名前も衝突とみなせるよう外部から渡す。
 */
export function resolveOutputPath(
  inputPath: string,
  outputDir: string,
  exists: (absPath: string) => boolean
): string {
  const ext = '.mp4'
  const stem = path.basename(inputPath, path.extname(inputPath))

  const first = path.join(outputDir, `${stem}${ext}`)
  if (!exists(first)) return first

  for (let i = 1; ; i++) {
    const candidate = path.join(outputDir, `${stem} (${i})${ext}`)
    if (!exists(candidate)) return candidate
  }
}

/** 一時（作業中）ファイル名。成功時にこの名前から最終名へリネームする。 */
export function partPath(finalPath: string): string {
  return `${finalPath}.part`
}
