'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// AI 额度充值页：展示 ¥299 支付宝收款码 + 当前余额（金额口径，不露 token）。
export default function Recharge() {
  const r = useRouter()
  const [b, setB] = useState<{ balance_cents: number; spent_cents: number } | null>(null)
  useEffect(() => {
    fetch('/api/me/balance').then(async res => {
      if (res.status === 401) { r.push('/login?next=/recharge'); return }
      if (res.ok) setB(await res.json())
    }).catch(() => {})
  }, [r])
  const bal = b ? b.balance_cents / 100 : null
  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 40 }}>
      <div className="card">
        <h1>AI 额度充值</h1>
        {b && (
          <p className="muted" style={{ marginTop: 4 }}>
            当前余额 <b style={{ color: (bal as number) <= 0 ? '#dc2626' : '#16a34a' }}>¥{(bal as number).toFixed(2)}</b>
            　·　累计已用 ¥{(b.spent_cents / 100).toFixed(2)}
          </p>
        )}
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.9, marginTop: 10 }}>
          支付宝扫码预充值 <b>¥299</b>，AI 用量按实际消耗从余额扣减。付款后加微信发送
          <b>付款截图 + 注册邮箱</b>，确认后额度即时到账。
        </p>
        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pay-token-299.jpg" alt="支付宝收款码 ¥299 token 预收款" style={{ width: '100%', maxWidth: 280, borderRadius: 10 }} />
        </div>
        <p style={{ marginTop: 4 }}><Link className="btn secondary" href="/dashboard">返回项目</Link></p>
      </div>
    </div>
  )
}
