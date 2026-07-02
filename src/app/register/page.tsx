'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const r = useRouter()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [inviteCode, setInviteCode] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, inviteCode }) })
    setBusy(false)
    if (res.ok) r.push('/dashboard')
    else { const j = await res.json().catch(() => null); setErr(j?.error || '注册失败') }
  }
  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>邀请码注册</h1>
        <form onSubmit={submit}>
          <label>邀请码</label><input value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
          <label>邮箱</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>密码（至少 8 位）</label><input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error">{err}</p>}
          <p style={{ marginTop: 16 }}><button className="btn" disabled={busy}>注册</button></p>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>已有账号？<Link href="/login">登录</Link></p>
      </div>
      <div className="card">
        <h2>如何获取邀请码（¥99）</h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>
          本工具邀请制使用，邀请码 ¥99 / 个（一码开通一个账号，长期有效）。
        </p>
        <ol className="muted" style={{ fontSize: 14, lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
          <li>微信扫左侧收款码支付 99 元；</li>
          <li>扫右侧二维码加微信，发送付款截图；</li>
          <li>确认后即回复你的专属邀请码，回本页注册。</li>
        </ol>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pay-qr.png" alt="微信支付收款码" style={{ width: '100%', maxWidth: 150, borderRadius: 8 }} />
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>① 支付 ¥99</p>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wechat-qr.png" alt="微信联系二维码" style={{ width: '100%', maxWidth: 150, borderRadius: 8 }} />
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>② 加微信领码</p>
          </div>
        </div>
      </div>
    </div>
  )
}
