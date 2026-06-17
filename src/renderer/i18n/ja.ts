// UI 文言は本ファイルに集約（i18n フレームワークは使わない）。
// 将来の多言語化はこのオブジェクトを言語別に分けるだけで対応できる。

export const t = {
  appTitle: 'MovieEncoder for Nissan Navi',
  subtitle: 'MM521D-L 向け一括動画変換',

  dropHere: 'ここに動画ファイルやフォルダをドラッグ＆ドロップ',
  dropHint: '対応: mp4 / mkv / avi / mov / wmv / flv / m4v / ts / mts / m2ts / webm（フォルダは直下のみ）',
  selectFiles: 'ファイルを選択',
  clearAll: '全てクリア',

  preset: 'プリセット',
  concurrency: '同時実行数',
  start: '変換開始',
  stop: '停止',
  saveLog: 'ログ保存',

  colName: 'ファイル名',
  colInfo: 'メディア情報',
  colStatus: '状態',
  colProgress: '進捗',
  colEta: '残り',
  colAction: '',
  remove: '削除',

  statusWaiting: '待機中',
  statusEncoding: '変換中',
  statusDone: '完了',
  statusError: 'エラー',
  statusCanceled: '中止',

  metaFailed: 'メタ取得失敗',
  metaLoading: '取得中…',

  logTitle: 'ログ',
  logFilterAll: '全て',
  logEmpty: 'ログはまだありません',

  noFiles: 'ファイルが登録されていません',
  encoding: '変換中…',

  // ダイアログ
  doneTitle: '変換完了',
  abortedTitle: '変換を中止しました',
  summary: (done: number, error: number, canceled: number): string => {
    const parts = [`完了 ${done} 件`]
    if (error > 0) parts.push(`エラー ${error} 件`)
    if (canceled > 0) parts.push(`中止 ${canceled} 件`)
    return parts.join(' / ')
  },
  openOutput: '出力フォルダを開く',
  close: '閉じる',
  errorList: 'エラー一覧',

  confirmOutputTitle: '出力先を選択してください',
  outputDirLabel: '出力先',
  cancel: 'キャンセル'
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'waiting':
      return t.statusWaiting
    case 'encoding':
      return t.statusEncoding
    case 'done':
      return t.statusDone
    case 'error':
      return t.statusError
    case 'canceled':
      return t.statusCanceled
    default:
      return status
  }
}

export function formatEta(sec: number | null): string {
  if (sec == null) return '—'
  if (sec <= 0) return '0秒'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m > 0) return `約${m}分${s}秒`
  return `約${s}秒`
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
