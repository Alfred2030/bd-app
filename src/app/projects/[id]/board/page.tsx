'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

const STAGES = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样']
type Row = {
  id: number; name: string; country: string; priority: string; stage: string | null
  activity?: { stage: string; first_touch_date: string | null; last_touch_date: string | null; replied: boolean; next_action: string; next_action_date: string | null }
}

const d = (s: string | null) => (s ? String(s).slice(0, 10) : '')

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rows, setRows] = useState<Row[]>([])
  const [followup, setFollowup] = useState<{ company: string; subject: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const companies: Row[] = await fetch(`/api/projects/${id}/companies`).then(r => r.json())
    const withActivity = await Promise.all(companies.map(async c => ({
      ...c, activity: await fetch(`/api/companies/${c.id}/activity`).then(r => r.json()),
    })))
    setRows(withActivity)
  }, [id])
  useEffect(() => { load() }, [load])

  async function put(cid: number, body: Record<string, unknown>) {
    await fetch(`/api/companies/${cid}/activity`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  async function genFollowup(c: Row) {
    setBusy(true)
    const res = await fetch(`/api/companies/${c.id}/followup`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { const j = await res.json(); setFollowup({ company: c.name, ...j }) }
  }

  const today = new Date()
  const overdue = rows.filter(r => {
    const a = r.activity
    if (!a || a.replied || !a.last_touch_date) return false
    if (a.stage === '2-待发送' || a.stage === '3-草稿就绪') return false
    return (today.getTime() - new Date(a.last_touch_date).getTime()) / 86400000 >= 3
  })

  return (
    <>
      <ProjectNav id={id} active="board" />
      <div className="container">
        <h1>30 天追踪看板</h1>
        <p className="notice">首触/跟进由你人工发送后，回来这里更新阶段与日期。工具不代发。</p>
        <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{rows.filter(r => r.activity?.stage === s).length}</div>
              <div className="muted" style={{ fontSize: 12 }}>{s}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent2)' }}>{rows.filter(r => r.activity?.replied).length}</div>
            <div className="muted" style={{ fontSize: 12 }}>已回复（30天目标：3+ 实质对话）</div>
          </div>
        </div>
        {overdue.length > 0 && (
          <div className="card" style={{ borderColor: 'var(--danger)' }}>
            <h2 style={{ color: 'var(--danger)' }}>⚠ 超 3 天未跟进（{overdue.length}）</h2>
            {overdue.map(c => (
              <p key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>[{c.priority}] {c.name} · 最近触达 {c.activity?.last_touch_date}</span>
                <button className="btn secondary" disabled={busy} onClick={() => genFollowup(c)}>{busy ? 'AI 生成中（约 1–3 分钟）…' : 'AI 跟进草稿'}</button>
              </p>
            ))}
          </div>
        )}
        {followup && (
          <div className="card" style={{ borderColor: 'var(--warn)' }}>
            <h2>跟进草稿 — {followup.company}
              <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }}
                onClick={() => { navigator.clipboard.writeText(`Subject: ${followup.subject}\n\n${followup.body}`) }}>复制</button>
            </h2>
            <p><strong>Subject:</strong> {followup.subject}</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{followup.body}</pre>
          </div>
        )}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>公司</th><th>阶段</th><th>首触</th><th>最近触达</th><th>回复</th><th>下一步</th><th>下一步日期</th></tr></thead>
            <tbody>
              {rows.map(c => {
                const a = c.activity
                return (
                  <tr key={c.id}>
                    <td><strong>[{c.priority}] {c.name}</strong><div className="muted">{c.country}</div></td>
                    <td>
                      <select value={a?.stage ?? STAGES[0]} onChange={e => put(c.id, { stage: e.target.value })}>
                        {STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input type="date" value={d(a?.first_touch_date ?? null)} onChange={e => put(c.id, { firstTouchDate: e.target.value || null })} style={{ width: 140 }} /></td>
                    <td><input type="date" value={d(a?.last_touch_date ?? null)} onChange={e => put(c.id, { lastTouchDate: e.target.value || null })} style={{ width: 140 }} /></td>
                    <td><input type="checkbox" checked={a?.replied ?? false} onChange={e => put(c.id, { replied: e.target.checked, ...(e.target.checked ? { stage: '6-已回复' } : {}) })} style={{ width: 'auto' }} /></td>
                    <td><input defaultValue={a?.next_action ?? ''} onBlur={e => put(c.id, { nextAction: e.target.value })} style={{ width: 160 }} /></td>
                    <td><input type="date" value={d(a?.next_action_date ?? null)} onChange={e => put(c.id, { nextActionDate: e.target.value || null })} style={{ width: 140 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
