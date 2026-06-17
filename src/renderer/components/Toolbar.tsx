import { useStore } from '../store/useStore'
import { t } from '../i18n/ja'
import { CONCURRENCY_MAX, CONCURRENCY_MIN } from '@shared/types'

interface Props {
  onStart: () => void
  onStop: () => void
  onSaveLog: () => void
  onClearAll: () => void
}

export function Toolbar({ onStart, onStop, onSaveLog, onClearAll }: Props): JSX.Element {
  const presets = useStore((s) => s.presets)
  const presetId = useStore((s) => s.presetId)
  const setPresetId = useStore((s) => s.setPresetId)
  const concurrency = useStore((s) => s.concurrency)
  const setConcurrency = useStore((s) => s.setConcurrency)
  const isEncoding = useStore((s) => s.isEncoding)
  const jobs = useStore((s) => s.jobs)

  const hasWaiting = jobs.some((j) => j.status === 'waiting')

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <label className="field">
          <span>{t.preset}</span>
          <select
            value={presetId}
            disabled={isEncoding}
            onChange={(e) => setPresetId(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id} title={p.description}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{t.concurrency}</span>
          <select
            value={concurrency}
            disabled={isEncoding}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          >
            {Array.from(
              { length: CONCURRENCY_MAX - CONCURRENCY_MIN + 1 },
              (_, i) => CONCURRENCY_MIN + i
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="toolbar-right">
        <button type="button" className="btn-ghost" onClick={onClearAll} disabled={isEncoding}>
          {t.clearAll}
        </button>
        <button type="button" className="btn-ghost" onClick={onSaveLog}>
          {t.saveLog}
        </button>
        {isEncoding ? (
          <button type="button" className="btn-danger" onClick={onStop}>
            {t.stop}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onStart}
            disabled={!hasWaiting}
          >
            {t.start}
          </button>
        )}
      </div>
    </div>
  )
}
