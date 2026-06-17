/**
 * ffmpeg の stderr 末尾からエラー種別を推定し、日本語の理由文を返す。
 * 完全な分類は不可能なので、よくあるパターンのみ拾い、その他は汎用文言にする。
 */

export type ErrorKind =
  | 'disk-full'
  | 'permission'
  | 'corrupt'
  | 'no-stream'
  | 'unknown'

export interface ClassifiedError {
  kind: ErrorKind
  /** 日本語の表示用理由 */
  reason: string
}

export function classifyError(stderr: string): ClassifiedError {
  const s = stderr.toLowerCase()

  if (/no space left on device|enospc/.test(s)) {
    return { kind: 'disk-full', reason: 'ディスク容量不足の可能性があります' }
  }
  if (/permission denied|eacces|access is denied|read-only file system/.test(s)) {
    return { kind: 'permission', reason: '書き込み権限がない可能性があります' }
  }
  if (/no such file or directory|enoent/.test(s)) {
    return { kind: 'permission', reason: '入力ファイルまたは出力先が見つかりません' }
  }
  if (
    /invalid data found when processing input|moov atom not found|error while decoding|could not find codec parameters/.test(
      s
    )
  ) {
    return { kind: 'corrupt', reason: 'ファイルが破損しているか、対応できない形式です' }
  }
  if (/does not contain any stream|output file does not contain any stream/.test(s)) {
    return { kind: 'no-stream', reason: '変換可能な映像/音声ストリームがありません' }
  }
  return { kind: 'unknown', reason: '変換に失敗しました（詳細はログを参照）' }
}

/** stderr のうち末尾 N 行だけ残す（ダイアログ/ログ保持用） */
export function tailLines(text: string, n = 20): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return lines.slice(-n).join('\n')
}
