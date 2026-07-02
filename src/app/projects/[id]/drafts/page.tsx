'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Email = { subject: string; body: string }
type Drafts = { email1: Email | null; email2: Email | null; email3: Email | null; linkedin_note: string; linkedin_followup: string } | null
const EMPTY: Email = { subject: '', body: '' }

export default function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [e1, setE1] = useState<Email>(EMPTY); const [e2, setE2] = useState<Email>(EMPTY); const [e3, setE3] = useState<Email>(EMPTY)
  const [note, setNote] = useState(''); const [followup, setFollowup] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(r => r.json()).then((cs: Company[]) => {
      setCompanies(cs); if (cs.length && sel === null) setSel(cs[0].id)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (sel === null) return
    const d: Drafts = await fetch(`/api/companies/${sel}/drafts`).then(r => r.json())
    setE1(d?.email1 ?? EMPTY); setE2(d?.email2 ?? EMPTY); setE3(d?.email3 ?? EMPTY)
    setNote(d?.linkedin_note ?? ''); setFollowup(d?.linkedin_followup ?? ''); setMsg('')
  }, [sel])
  useEffect(() => { load() }, [load])

  async function generate() {
    setBusy(true); setMsg('AI 生成中（约 1–3 分钟）…')
    const res = await fetch(`/api/companies/${sel}/drafts/generate`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { setMsg('已生成，可编辑后保存'); load() }
    else setMsg((await res.json()).error || '生成失败，可重试（已填内容未丢失）')
  }
  async function save() {
    const res = await fetch(`/api/companies/${sel}/drafts`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email1: e1, email2: e2, email3: e3, linkedin_note: note, linkedin_followup: followup }),
    })
    setMsg(res.ok ? '已保存' : '保存失败：三封邮件的主题和正文都不能为空')
  }
  function copy(text: string) { navigator.clipboard.writeText(text); setMsg('已复制到剪贴板') }

  const editor = (label: string, v: Email, set: (e: Email) => void) => (
    <div className="card">
      <h2>{label} <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }} onClick={() => copy(`Subject: ${v.subject}\n\n${v.body}`)}>复制</button></h2>
      <label>Subject</label><input value={v.subject} onChange={e => set({ ...v, subject: e.target.value })} />
      <label>Body</label><textarea rows={8} value={v.body} onChange={e => set({ ...v, body: e.target.value })} />
    </div>
  )

  return (
    <>
      <ProjectNav id={id} active="drafts" />
      <div className="container">
        <h1>冷邮件工坊</h1>
        <p className="notice"><strong>本工具只生成草稿，不代发。</strong>请用你自己的邮箱/LinkedIn 人工发送；冷邮件建议独立发件域名 + SPF/DKIM/DMARC + 小批量，遵守 CAN-SPAM/GDPR。</p>
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ width: 320 }} value={sel ?? ''} onChange={e => setSel(Number(e.target.value))}>
            {companies.map(c => <option key={c.id} value={c.id}>[{c.priority}] {c.name}（{c.country}）</option>)}
          </select>
          <button className="btn" disabled={busy || sel === null} onClick={generate}>AI 生成三封序列</button>
          <button className="btn secondary" disabled={sel === null} onClick={save}>保存编辑</button>
          <a className="btn secondary" href={sel !== null ? `/api/companies/${sel}/drafts/export` : '#'}>导出 Word</a>
          {msg && <span className="muted">{msg}</span>}
        </div>
        {editor('Email 1 · Day 0（竞品钩子）', e1, setE1)}
        {editor('Email 2 · +3 天（OEM/贴牌）', e2, setE2)}
        {editor('Email 3 · +7 天（零风险收尾）', e3, setE3)}
        <div className="card">
          <h2>LinkedIn 文案 <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }} onClick={() => copy(note)}>复制连接语</button></h2>
          <label>连接请求（≤300 字符，当前 {note.length}）</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
          <label>通过后跟进</label>
          <textarea rows={4} value={followup} onChange={e => setFollowup(e.target.value)} />
        </div>
      </div>
    </>
  )
}
