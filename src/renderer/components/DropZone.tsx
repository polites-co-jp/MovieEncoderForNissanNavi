import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store/useStore'
import { t } from '../i18n/ja'

/**
 * D&D ＋「ファイルを選択」ボタン。
 * Electron 環境では drop された File に path が付くため、それを main へ渡してメタ取得する。
 */
export function DropZone(): JSX.Element {
  const addJobs = useStore((s) => s.addJobs)
  const isEncoding = useStore((s) => s.isEncoding)

  const handlePaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      const jobs = await window.api.probeFiles(paths)
      addJobs(jobs)
    },
    [addJobs]
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      // Electron では File に path プロパティが付与される（フォルダもパスとして渡る）
      const paths = accepted
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => Boolean(p))
      void handlePaths(paths)
    },
    [handlePaths]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    // react-dropzone 既定はフォルダを再帰的に展開してしまうため、
    // 生のドロップ要素（フォルダはフォルダのまま）だけを取り出す。
    // 直下のみの展開は main 側 (collectInputFiles) が担う。
    getFilesFromEvent: ((event: Event) => {
      const dt = (event as DragEvent).dataTransfer
      if (dt && dt.files && dt.files.length > 0) {
        return Promise.resolve(Array.from(dt.files))
      }
      const target = event.target as HTMLInputElement | null
      if (target && target.files) {
        return Promise.resolve(Array.from(target.files))
      }
      return Promise.resolve([])
    }) as never,
    // クリックでの自動オープンは無効化し、ボタンから open() を呼ぶ
    noClick: true,
    noKeyboard: true,
    multiple: true
  })

  return (
    <div
      {...getRootProps()}
      className={`dropzone${isDragActive ? ' drag' : ''}${isEncoding ? ' disabled' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone-main">{t.dropHere}</div>
      <div className="dropzone-hint">{t.dropHint}</div>
      <button
        type="button"
        className="btn"
        disabled={isEncoding}
        onClick={(e) => {
          e.stopPropagation()
          open()
        }}
      >
        {t.selectFiles}
      </button>
    </div>
  )
}
