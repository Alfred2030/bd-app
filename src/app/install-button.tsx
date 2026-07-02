'use client'
import { useEffect, useState } from 'react'

type BIPEvent = Event & { prompt: () => Promise<void> }

export default function InstallButton() {
  const [bip, setBip] = useState<BIPEvent | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent) }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  async function install() {
    if (bip) { await bip.prompt(); return }
    const ua = navigator.userAgent
    if (/MicroMessenger/i.test(ua)) setHint('请点右上角「···」选择在浏览器打开后再安装')
    else if (/iPhone|iPad/i.test(ua)) setHint('Safari 里点分享按钮 → 「添加到主屏幕」')
    else if (/Android/i.test(ua)) setHint('浏览器菜单里选「添加到主屏幕 / 安装应用」')
    else setHint('地址栏右侧的安装图标可一键安装')
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button className="btn secondary" onClick={install}>📲 安装到手机</button>
      {hint && <span className="muted" style={{ fontSize: 13 }}>{hint}</span>}
    </span>
  )
}
