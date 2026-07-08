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
        <h2>注册即送 <span style={{ color: '#16a34a' }}>¥5</span> 免费试用</h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.8 }}>
          用邀请码注册即得 <b>¥5</b> AI 免费额度，先试后买。额度用完后，支付宝扫码充值 <b>¥299</b> 继续使用（按实际用量从余额扣减）。
        </p>
        <ol className="muted" style={{ fontSize: 14, lineHeight: 2, paddingLeft: 20, margin: '8px 0' }}>
          <li>没有邀请码？扫右侧二维码加微信免费索取；</li>
          <li>回本页用邀请码注册，<b>¥5 试用额度自动到账</b>；</li>
          <li>用完后支付宝扫左侧码充值 <b>¥299</b>，发付款截图给微信即时到账。</li>
        </ol>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pay-token-299.jpg" alt="支付宝收款码 ¥299" style={{ width: '100%', maxWidth: 150, borderRadius: 8 }} />
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>充值 ¥299（用完再扫）</p>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wechat-qr.png" alt="微信联系二维码" style={{ width: '100%', maxWidth: 150, borderRadius: 8 }} />
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>加微信免费领码</p>
          </div>
        </div>
      </div>
    </div>
  )
}
