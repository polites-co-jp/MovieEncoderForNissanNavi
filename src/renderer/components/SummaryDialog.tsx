import { useStore } from '../store/useStore'
import { t } from '../i18n/ja'

export function SummaryDialog(): JSX.Element | null {
  const summary = useStore((s) => s.summary)
  const setSummary = useStore((s) => s.setSummary)
  const jobs = useStore((s) => s.jobs)

  if (!summary) return null

  const errorJobs = jobs.filter((j) => j.status === 'error')

  const close = (): void => setSummary(null)
  const openOutput = (): void => {
    if (summary.outputDir) void window.api.openPath(summary.outputDir)
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{summary.abortedByUser ? t.abortedTitle : t.doneTitle}</h2>
        <p className="summary-line">
          {t.summary(summary.done, summary.error, summary.canceled)}
        </p>

        {errorJobs.length > 0 && (
          <div className="error-box">
            <div className="error-box-title">{t.errorList}</div>
            <ul>
              {errorJobs.map((j) => (
                <li key={j.id}>
                  <span className="error-file">{j.fileName}</span>
                  <span className="error-reason">{j.errorReason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions">
          {summary.outputDir && (
            <button type="button" className="btn-primary" onClick={openOutput}>
              {t.openOutput}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={close}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
