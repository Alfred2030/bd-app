'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const r = useRouter()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    setBusy(false)
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next')
      r.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard')
    }
    else { const j = await res.json().catch(() => null); setErr(j?.error || '登录失败') }
  }
  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>登录</h1>
        <form onSubmit={submit}>
          <label>邮箱</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error">{err}</p>}
          <p style={{ marginTop: 16 }}><button className="btn" disabled={busy}>登录</button></p>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>没有账号？<Link href="/register">邀请码注册</Link></p>
      </div>
    </div>
  )
}
