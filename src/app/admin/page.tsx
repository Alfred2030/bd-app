'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import InstallButton from '../install-button'

type Code = { code: string; used_count: number; max_uses: number; created: string }
type User = { email: string; invite_code_used: string; created: string }
type Bill = { id: number; email: string; balance_cents: number; metering_enabled: boolean; month_billed: number; total_billed: number; total_cost: number; total_tokens: number; calls: number }

export default function AdminPage() {
  const r = useRouter()
  const [codes, setCodes] = useState<Code[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [bill, setBill] = useState<Bill[]>([])
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
    if (bres.ok) { const bj = await bres.json(); setBill(bj.users) }
  }, [r])
  useEffect(() => { load() }, [load])

  const yuan = (c: number) => (Number(c) / 100).toFixed(2)
  async function topup(email: string) {
    const input = prompt(`给 ${email} 充值多少元？（¥299 预收款标准档）`, '299')
    if (input == null) return
    const y = Number(input)
    if (!(y > 0)) { setMsg('金额不合法'); return }
    const res = await fetch('/api/admin/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topup', email, yuan: y }) })
    if (res.ok) { setMsg(`已给 ${email} 充值 ¥${y.toFixed(2)}`); load() }
    else { const j = await res.json().catch(() => null); setMsg(j?.error || '充值失败') }
  }
  async function toggle(email: string, enabled: boolean) {
    const res = await fetch('/api/admin/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', email, enabled }) })
    if (res.ok) load(); else setMsg('操作失败')
  }
  function exportCsv() {
    const head = ['邮箱', '余额(元)', '本月应收(元)', '累计应收(元)', '累计成本(元)', '累计tokens', '调用次数', '计量']
    const lines = bill.map(u => [u.email, yuan(u.balance_cents), yuan(u.month_billed), yuan(u.total_billed), yuan(u.total_cost), u.total_tokens, u.calls, u.metering_enabled ? '开' : '停'].join(','))
    const csv = '﻿' + [head.join(','), ...lines].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'cxodex-billing.csv'; a.click()
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

  const d = (s: string) => String(s).slice(0, 10)

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h1 style={{ marginTop: 24 }}>邀请码管理 <span className="badge ai">管理员专用</span></h1>
      <p style={{ margin: '10px 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <InstallButton />
        <span className="muted" style={{ fontSize: 13 }}>装到手机主屏，发码更快（仅管理员账号可打开本页）</span>
      </p>
      <div className="card" style={{ textAlign: 'center' }}>
        <button className="btn" style={{ fontSize: 17, padding: '14px 28px', width: '100%' }} disabled={busy} onClick={issue}>
          {busy ? '生成中…' : '生成一个邀请码（¥299 · 一码一号 · 含¥299额度）'}
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
        <h2>用量与余额 <span className="badge ai">AI 计费</span></h2>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 10px', lineHeight: 1.7 }}>
          应收 = GLM 成本 × 2（单价 0.025 元/千tokens）。余额 ≤ 0 且「计量」开启时，该用户 AI 功能自动停止；收到 ¥299 付款后点「充值」补额度。
          <button className="btn secondary" style={{ padding: '2px 10px', marginLeft: 8, fontSize: 12 }} onClick={exportCsv}>导出 CSV</button>
        </p>
        <table>
          <thead><tr><th>邮箱</th><th>余额¥</th><th>本月¥</th><th>累计¥</th><th>成本/次/tokens</th><th>计量</th><th>充值</th></tr></thead>
          <tbody>
            {bill.map(u => (
              <tr key={u.id}>
                <td style={{ fontSize: 12 }}>{u.email}</td>
                <td className="num"><b style={{ color: Number(u.balance_cents) <= 0 ? '#dc2626' : '#16a34a' }}>{yuan(u.balance_cents)}</b></td>
                <td className="num">{yuan(u.month_billed)}</td>
                <td className="num">{yuan(u.total_billed)}</td>
                <td className="muted" style={{ fontSize: 11 }}>¥{yuan(u.total_cost)} · {u.calls}次 · {u.total_tokens}tok</td>
                <td>
                  <button className={`badge ${u.metering_enabled ? 'ok' : 'bad'}`} style={{ border: 'none', cursor: 'pointer' }}
                    onClick={() => toggle(u.email, !u.metering_enabled)}>{u.metering_enabled ? '开·点停' : '停·点开'}</button>
                </td>
                <td><button className="btn secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => topup(u.email)}>充值</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
