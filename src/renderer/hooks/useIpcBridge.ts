import { useEffect } from 'react'
import { useStore } from '../store/useStore'

/** Main → Renderer のイベントを store に接続し、初期設定をロードする */
export function useIpcBridge(): void {
  const applyUpdate = useStore((s) => s.applyUpdate)
  const appendLog = useStore((s) => s.appendLog)
  const setSummary = useStore((s) => s.setSummary)
  const setEncoding = useStore((s) => s.setEncoding)
  const setPresets = useStore((s) => s.setPresets)
  const setPresetId = useStore((s) => s.setPresetId)
  const setConcurrency = useStore((s) => s.setConcurrency)

  useEffect(() => {
    let mounted = true

    // 初期データ
    void (async () => {
      const [presets, config] = await Promise.all([
        window.api.getPresets(),
        window.api.getConfig()
      ])
      if (!mounted) return
      setPresets(presets)
      setPresetId(config.lastPresetId)
      setConcurrency(config.concurrency)
    })()

    const offUpdate = window.api.onJobUpdate((u) => applyUpdate(u))
    const offLog = window.api.onLog((l) => appendLog(l))
    const offDone = window.api.onQueueDone((s) => {
      setEncoding(false)
      setSummary(s)
    })

    return () => {
      mounted = false
      offUpdate()
      offLog()
      offDone()
    }
  }, [
    applyUpdate,
    appendLog,
    setSummary,
    setEncoding,
    setPresets,
    setPresetId,
    setConcurrency
  ])
}
