'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Code = { code: string; used_count: number; max_uses: number; created: string }
type User = { email: string; invite_code_used: string; created: string }

export default function AdminPage() {
  const r = useRouter()
  const [codes, setCodes] = useState<Code[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [fresh, setFresh] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/invites')
    if (res.status === 401) { r.push('/login'); return }
    if (!res.ok) { setMsg('无权访问'); return }
    const j = await res.json()
    setCodes(j.codes); setUsers(j.users)
  }, [r])
  useEffect(() => { load() }, [load])

  async function issue() {
    setBusy(true); setMsg('')
    const res = await fetch('/api/admin/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxUses: 1 }),
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json().catch(() => null); setMsg(j?.error || '生成失败'); return }
    const { code } = await res.json()
    setFresh(code); load()
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => setMsg('已复制'))
      .catch(() => setMsg('复制失败，请长按选中复制'))
  }

  const d = (s: string) => String(s).slice(0, 10)

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 24 }}>邀请码管理</h1>
      <div className="card" style={{ textAlign: 'center' }}>
        <button className="btn" style={{ fontSize: 17, padding: '14px 28px', width: '100%' }} disabled={busy} onClick={issue}>
          {busy ? '生成中…' : '生成一个邀请码（¥99 · 一码一号）'}
        </button>
        {fresh && (
          <div style={{ marginTop: 16 }}>
            <div className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{fresh}</div>
            <p style={{ marginTop: 10 }}>
              <button className="btn secondary" onClick={() => copy(fresh)}>复制邀请码</button>
            </p>
          </div>
        )}
        {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>码 · 使用情况</h2>
        <table>
          <thead><tr><th>码</th><th>已用/上限</th><th>日期</th></tr></thead>
          <tbody>
            {codes.map(c => (
              <tr key={c.code}>
                <td className="num">{c.code}</td>
                <td>
                  {c.max_uses === 0 ? <span className="badge bad">停用</span>
                    : c.used_count >= c.max_uses ? <span className="badge ok">{c.used_count}/{c.max_uses} 已用完</span>
                    : <span className="badge ai">{c.used_count}/{c.max_uses} 可用</span>}
                </td>
                <td className="muted">{d(c.created)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>最近注册</h2>
        <table>
          <thead><tr><th>邮箱</th><th>所用码</th><th>日期</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td className="num">{u.invite_code_used}</td>
                <td className="muted">{d(u.created)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
