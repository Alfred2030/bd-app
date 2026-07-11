'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IS_NATIVE_APP } from '@/lib/native'

// 用户端 AI 余额徽标：只显示金额（余额 / 累计已用），不显示 token。余额 ≤0 时红色提示并引导充值。
export default function BalanceBadge() {
  const [b, setB] = useState<{ balance_cents: number; spent_cents: number } | null>(null)
  useEffect(() => {
    const load = () => fetch('/api/me/balance').then(async res => { if (res.ok) setB(await res.json()) }).catch(() => {})
    load()
    // 任何页面在消费额度后 dispatch window 事件 'balance:refresh' 即可让徽标实时刷新（如海关反查完成）。
    window.addEventListener('balance:refresh', load)
    return () => window.removeEventListener('balance:refresh', load)
  }, [])
  if (!b) return null
  const bal = b.balance_cents / 100
  const spent = b.spent_cents / 100
  const low = bal <= 0
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '0 0 12px', borderColor: low ? '#dc2626' : undefined }}>
      <span style={{ fontSize: 14 }}>AI 余额　<b style={{ fontSize: 20, color: low ? '#dc2626' : '#16a34a' }}>¥{bal.toFixed(2)}</b></span>
      <span className="muted" style={{ fontSize: 13 }}>累计已用 ¥{spent.toFixed(2)}</span>
      <span style={{ flex: 1 }} />
      {low && <span className="badge bad">余额已用完，AI 功能暂停</span>}
      {!IS_NATIVE_APP && <Link className="btn secondary" style={{ padding: '6px 16px' }} href="/recharge">充值</Link>}
    </div>
  )
}
