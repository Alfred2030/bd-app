'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import InstallButton from '../install-button'

type Code = { code: string; used_count: number; max_uses: number; created: string }
type User = { email: string; invite_code_used: string; created: string }
type Acct = { key: string; name: string; balance_cents: number; spent_cents: number; metering: boolean }
type Group = { tool: string; label: string; tier: number; keyLabel: string; accounts?: Acct[]; error?: string }

export default function AdminPage() {
  const r = useRouter()
  const [codes, setCodes] = useState<Code[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [fresh, setFresh] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/invites')
    if (res.status === 401) { r.push('/login?next=/admin'); return }
    if (!res.ok) { setMsg('无权访问'); return }
    const j = await res.json()
    setCodes(j.codes); setUsers(j.users)
    const bres = await fetch('/api/admin/billing')
    if (bres.ok) { const bj = await bres.json(); setGroups(bj.groups || []) }
  }, [r])
  useEffect(() => { load() }, [load])

  const yuan = (c: number) => (Number(c) / 100).toFixed(2)
  async function topup(tool: string, key: string, name: string, tier: number) {
    const input = prompt(`【${name}】充值多少元？（标准档 ¥${tier}）`, String(tier))
    if (input == null) return
    const y = Number(input)
    if (!(y > 0)) { setMsg('金额不合法'); return }
    const res = await fetch('/api/admin/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool, key, yuan: y }) })
    if (res.ok) { setMsg(`已给「${name}」充值 ¥${y.toFixed(2)}`); load() }
    else { const j = await res.json().catch(() => null); setMsg(j?.error || '充值失败') }
  }

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

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    r.push('/login?next=/admin')
  }

  const d = (s: string) => String(s).slice(0, 10)

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 24 }}>邀请码管理 <span className="badge ai">管理员专用</span></h1>
      <p style={{ margin: '10px 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <InstallButton />
        <button className="btn secondary" style={{ padding: '5px 14px', fontSize: 13 }} onClick={logout}>退出 · 换号登录</button>
        <span className="muted" style={{ fontSize: 13 }}>本页仅 <b>info@cxodex.com</b> 可用；如显示「无权访问」，点上面退出后用 info@ 重新登录</span>
      </p>
      <div className="card" style={{ textAlign: 'center' }}>
        <button className="btn" style={{ fontSize: 17, padding: '14px 28px', width: '100%' }} disabled={busy} onClick={issue}>
          {busy ? '生成中…' : '生成一个邀请码（免费 · 一码一号 · 含¥5试用额度）'}
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
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>统一计费台 <span className="badge ai">全工具余额充值</span></h2>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px', lineHeight: 1.7 }}>
          应收 = 成本基准 0.0125 元/千 × 系数 2 = <b>0.025 元/千tokens</b>。收到付款后，找到对应工具 + 账号，点「充值」补额度。
          ¥299 档：外贸/面试/排产/财务；¥99 档：法律。
        </p>
        {groups.length === 0 && <p className="muted" style={{ fontSize: 13 }}>加载中…</p>}
        {groups.map(g => (
          <div key={g.tool} style={{ marginBottom: 18 }}>
            <h3 style={{ margin: '6px 0', fontSize: 15 }}>
              {g.label} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>· ¥{g.tier} 档 · 按{g.keyLabel}</span>
            </h3>
            {g.error ? <p className="badge bad" style={{ fontSize: 12 }}>库连接失败：{g.error}</p>
              : !g.accounts || g.accounts.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>暂无账号</p>
              : (
                <table>
                  <thead><tr><th>{g.keyLabel}</th><th>余额¥</th><th>已用¥</th><th>充值</th></tr></thead>
                  <tbody>
                    {g.accounts.map(a => (
                      <tr key={a.key}>
                        <td style={{ fontSize: 12 }}>{a.name}</td>
                        <td className="num"><b style={{ color: a.balance_cents <= 0 ? '#dc2626' : '#16a34a' }}>{yuan(a.balance_cents)}</b></td>
                        <td className="num muted">{yuan(a.spent_cents)}</td>
                        <td><button className="btn secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => topup(g.tool, a.key, a.name, g.tier)}>充值</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}
