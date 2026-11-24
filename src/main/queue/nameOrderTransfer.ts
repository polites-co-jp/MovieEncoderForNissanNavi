import * as fs from 'fs'
import * as path from 'path'

/**
 * 日産ナビ（MM521D-L）は USB メモリ内のファイルを「名前順」ではなく
 * FAT のディレクトリエントリ順（＝出力先フォルダへ書き込まれた順）で表示する。
 * 並列エンコードでは完了順がバラバラになるため、一時領域へ変換し終えてから
 * ファイル名順に 1 件ずつ出力先へ転記し、名前順＝ナビの表示順にする。
 */

// Windows エクスプローラーの並び（数字は数値として比較: "2" < "10"）に合わせる
const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' })

/**
 * 出力ファイル名の比較。エクスプローラーと同様に拡張子を除いた名前で比べ
 * （`movie.mp4` → `movie (1).mp4` の順）、次に拡張子、最後にコードポイント順で決定的にする。
 */
export function compareFileNames(a: string, b: string): number {
  const extA = path.extname(a)
  const extB = path.extname(b)
  const c =
    collator.compare(a.slice(0, a.length - extA.length), b.slice(0, b.length - extB.length)) ||
    collator.compare(extA, extB)
  if (c !== 0) return c
  return a < b ? -1 : a > b ? 1 : 0
}

export interface TransferItem {
  id: string
  /** 一時領域にある変換済みファイル */
  stagedPath: string
  /** 出力先での最終パス */
  finalPath: string
}

export type TransferOutcome =
  | { id: string; ok: true; finalPath: string }
  | { id: string; ok: false; reason: string; detail: string }

/** 最終ファイル名で並べ替えた転記順を返す。 */
export function sortForTransfer(items: TransferItem[]): TransferItem[] {
  return [...items].sort((a, b) =>
    compareFileNames(path.basename(a.finalPath), path.basename(b.finalPath))
  )
}

/**
 * ファイル名順に 1 件ずつ（直列で）出力先へ転記する。
 * - 既存ファイルは上書きしない
 * - 同一ボリュームならリネーム、別ボリューム（USB メモリ等）ならコピー後に一時ファイルを削除
 * - 1 件の失敗は他に波及させず継続
 */
export async function transferInNameOrder(
  items: TransferItem[],
  onOutcome: (o: TransferOutcome) => void
): Promise<TransferOutcome[]> {
  const outcomes: TransferOutcome[] = []
  for (const item of sortForTransfer(items)) {
    const o = await transferOne(item)
    outcomes.push(o)
    onOutcome(o)
  }
  return outcomes
}

async function transferOne(item: TransferItem): Promise<TransferOutcome> {
  const { id, stagedPath, finalPath } = item
  try {
    // rename は Windows で既存を上書きするため、先に存在確認する
    if (fs.existsSync(finalPath)) {
      const err = new Error(`既に存在します: ${finalPath}`) as NodeJS.ErrnoException
      err.code = 'EEXIST'
      throw err
    }
    try {
      await fs.promises.rename(stagedPath, finalPath)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
      await copyThenRemove(stagedPath, finalPath)
    }
    return { id, ok: true, finalPath }
  } catch (e) {
    return { id, ok: false, reason: transferErrorReason(e), detail: String(e) }
  }
}

async function copyThenRemove(src: string, dest: string): Promise<void> {
  try {
    await fs.promises.copyFile(src, dest, fs.constants.COPYFILE_EXCL)
  } catch (e) {
    // 途中まで書かれた壊れたファイルを残さない（他人のファイル＝EEXIST は消さない）
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
      await fs.promises.rm(dest, { force: true }).catch(() => undefined)
    }
    throw e
  }
  await fs.promises.rm(src, { force: true }).catch(() => undefined)
}

export function transferErrorReason(e: unknown): string {
  switch ((e as NodeJS.ErrnoException | null)?.code) {
    case 'ENOSPC':
      return '出力先の容量不足の可能性があります'
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return '出力先への書き込み権限がない可能性があります'
    case 'EEXIST':
      return '出力先に同名ファイルが作成されたため転記しませんでした'
    case 'ENOENT':
      return '出力先が見つかりません（USB メモリが外れた可能性があります）'
    default:
      return '出力先への転記に失敗しました（詳細はログを参照）'
  }
}
