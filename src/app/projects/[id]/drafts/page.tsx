'use client'
import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Email = { subject: string; body: string }
type Drafts = { email1: Email | null; email2: Email | null; email3: Email | null; linkedin_note: string; linkedin_followup: string } | null
const EMPTY: Email = { subject: '', body: '' }
const LANGS: [string, string][] = [
  ['en', '英语（默认）'], ['auto', '自动 · 按目标国'],
  ['ja', '日语'], ['ko', '韩语'],
  ['de', '德语'], ['fr', '法语'], ['it', '意大利语'], ['es', '西班牙语'],
  ['pt-BR', '葡萄牙语（巴西）'], ['pt-PT', '葡萄牙语（葡萄牙）'], ['nl', '荷兰语'],
  ['sv', '瑞典语'], ['pl', '波兰语'], ['cs', '捷克语'], ['tr', '土耳其语'],
  ['ru', '俄语'], ['ar', '阿拉伯语'], ['th', '泰语'], ['vi', '越南语'], ['id', '印尼语'],
]

export default function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [e1, setE1] = useState<Email>(EMPTY); const [e2, setE2] = useState<Email>(EMPTY); const [e3, setE3] = useState<Email>(EMPTY)
  const [note, setNote] = useState(''); const [followup, setFollowup] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const [lang, setLang] = useState('en')

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(res => {
      if (res.status === 401) { router.push('/login'); return }
      return res.json()
    }).then((cs?: Company[]) => {
      if (!cs) return
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
    const res = await fetch(`/api/companies/${sel}/drafts/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang }),
    })
    setBusy(false)
    if (res.ok) { setMsg('已生成，可编辑后保存'); load() }
    else { const j = await res.json().catch(() => null); setMsg(j?.error || '生成失败，可重试（已填内容未丢失）') }
  }
  async function save() {
    const res = await fetch(`/api/companies/${sel}/drafts`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email1: e1, email2: e2, email3: e3, linkedin_note: note, linkedin_followup: followup }),
    })
    if (res.ok) { setMsg('已保存') }
    else {
      const j = await res.json().catch(() => null)
      setMsg('保存失败：' + (j?.error === '草稿格式不合法' || !j?.error ? '三封邮件的主题和正文都不能为空' : j.error))
    }
  }
  function copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => setMsg('已复制到剪贴板'))
      .catch(() => setMsg('复制失败，请手动选中复制'))
  }

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
          <select style={{ width: 170 }} value={lang} onChange={e => setLang(e.target.value)} title="邮件语言">
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn" disabled={busy || sel === null} onClick={generate}>AI 生成三封邮件模板</button>
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
