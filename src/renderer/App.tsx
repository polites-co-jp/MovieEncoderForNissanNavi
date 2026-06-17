import { useCallback } from 'react'
import { useIpcBridge } from './hooks/useIpcBridge'
import { useStore } from './store/useStore'
import { Toolbar } from './components/Toolbar'
import { DropZone } from './components/DropZone'
import { FileList } from './components/FileList'
import { LogViewer } from './components/LogViewer'
import { SummaryDialog } from './components/SummaryDialog'
import { t } from './i18n/ja'
import type { JobFile } from '@shared/types'

export default function App(): JSX.Element {
  useIpcBridge()

  const jobs = useStore((s) => s.jobs)
  const presetId = useStore((s) => s.presetId)
  const concurrency = useStore((s) => s.concurrency)
  const clearJobs = useStore((s) => s.clearJobs)
  const setEncoding = useStore((s) => s.setEncoding)
  const setSummary = useStore((s) => s.setSummary)
  const logs = useStore((s) => s.logs)

  const onStart = useCallback(async () => {
    const waiting = jobs.filter((j) => j.status === 'waiting')
    if (waiting.length === 0) return

    // 実行ボタン押下直後に出力先選択ダイアログを必ず表示
    const defaultDir = await window.api.getDefaultOutputDir()
    const outputDir = await window.api.pickOutputDir(defaultDir)
    if (!outputDir) return // キャンセルされたら何もしない

    const jobFiles: JobFile[] = waiting.map((j) => ({
      id: j.id,
      inputPath: j.inputPath,
      fileName: j.fileName,
      media: j.media
    }))

    setSummary(null)
    setEncoding(true)
    await window.api.startQueue({
      jobs: jobFiles,
      outputDir,
      presetId,
      concurrency
    })
  }, [jobs, presetId, concurrency, setEncoding, setSummary])

  const onStop = useCallback(() => {
    void window.api.cancelAll()
  }, [])

  const onSaveLog = useCallback(async () => {
    const text = logs
      .map((l) => (l.fileName ? `[${l.fileName}] ${l.text}` : l.text))
      .join('\n')
    await window.api.saveLog(text)
  }, [logs])

  const onClearAll = useCallback(() => {
    clearJobs()
  }, [clearJobs])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">{t.appTitle}</div>
        <div className="app-subtitle">{t.subtitle}</div>
      </header>

      <Toolbar
        onStart={() => void onStart()}
        onStop={onStop}
        onSaveLog={() => void onSaveLog()}
        onClearAll={onClearAll}
      />

      <DropZone />

      <main className="app-main">
        <section className="filelist-section">
          <FileList />
        </section>
        <section className="log-section">
          <LogViewer />
        </section>
      </main>

      <SummaryDialog />
    </div>
  )
}
