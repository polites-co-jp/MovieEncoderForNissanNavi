import { useStore } from '../store/useStore'
import { t, statusLabel, formatEta, formatDuration } from '../i18n/ja'
import type { JobState } from '@shared/types'

function MediaInfoCell({ job }: { job: JobState }): JSX.Element {
  const m = job.media
  if (!m) return <span className="muted">{t.metaLoading}</span>
  if (m.failed) return <span className="error-text">{t.metaFailed}</span>
  const parts: string[] = []
  if (m.resolution) parts.push(m.resolution)
  if (m.videoCodec) parts.push(m.videoCodec)
  if (m.frameRate) parts.push(`${m.frameRate}fps`)
  if (m.durationSec) parts.push(formatDuration(m.durationSec))
  return <span className="muted">{parts.join(' / ') || '—'}</span>
}

function ProgressCell({ job }: { job: JobState }): JSX.Element {
  if (job.status === 'done') return <span className="badge-done">100%</span>
  if (job.status === 'error')
    return <span className="error-text">{job.errorReason ?? t.statusError}</span>
  if (job.status === 'canceled') return <span className="muted">—</span>
  if (job.status === 'waiting') return <span className="muted">—</span>
  // encoding
  const pct = job.progress
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div
          className={`progress-fill${pct == null ? ' indeterminate' : ''}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <span className="progress-label">{pct != null ? `${pct}%` : t.encoding}</span>
    </div>
  )
}

export function FileList(): JSX.Element {
  const jobs = useStore((s) => s.jobs)
  const removeJob = useStore((s) => s.removeJob)
  const setLogFilter = useStore((s) => s.setLogFilter)

  if (jobs.length === 0) {
    return <div className="empty">{t.noFiles}</div>
  }

  return (
    <table className="filelist">
      <thead>
        <tr>
          <th>{t.colName}</th>
          <th>{t.colInfo}</th>
          <th>{t.colStatus}</th>
          <th>{t.colProgress}</th>
          <th>{t.colEta}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr
            key={job.id}
            className={`status-${job.status}`}
            onClick={() => setLogFilter(job.id)}
          >
            <td className="name" title={job.inputPath}>
              {job.fileName}
            </td>
            <td>
              <MediaInfoCell job={job} />
            </td>
            <td>
              <span className={`status-badge status-${job.status}`}>
                {statusLabel(job.status)}
              </span>
            </td>
            <td className="progress-cell">
              <ProgressCell job={job} />
            </td>
            <td className="eta">
              {job.status === 'encoding' ? formatEta(job.etaSec) : '—'}
            </td>
            <td className="action">
              <button
                type="button"
                className="btn-link"
                disabled={job.status === 'encoding'}
                onClick={(e) => {
                  e.stopPropagation()
                  removeJob(job.id)
                }}
              >
                {t.remove}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
