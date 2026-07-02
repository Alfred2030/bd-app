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
    else setErr((await res.json()).error || '注册失败')
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
    </div>
  )
}
