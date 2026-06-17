import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import { t } from '../i18n/ja'

export function LogViewer(): JSX.Element {
  const logs = useStore((s) => s.logs)
  const filter = useStore((s) => s.logFilterJobId)
  const setFilter = useStore((s) => s.setLogFilter)
  const jobs = useStore((s) => s.jobs)
  const endRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => (filter ? logs.filter((l) => l.jobId === filter) : logs),
    [logs, filter]
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [filtered.length])

  const filterName = filter
    ? jobs.find((j) => j.id === filter)?.fileName ?? filter
    : null

  return (
    <div className="logviewer">
      <div className="logviewer-head">
        <span className="logviewer-title">{t.logTitle}</span>
        {filter && (
          <button type="button" className="btn-link" onClick={() => setFilter(null)}>
            {filterName} ✕ → {t.logFilterAll}
          </button>
        )}
      </div>
      <div className="logviewer-body">
        {filtered.length === 0 ? (
          <div className="log-empty">{t.logEmpty}</div>
        ) : (
          filtered.map((l) => (
            <div key={l.seq} className="log-line">
              {l.fileName && <span className="log-prefix">[{l.fileName}]</span>}{' '}
              {l.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
