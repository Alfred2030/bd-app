'use client'
import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Contact = { id: number; name: string; title: string; linkedin_url: string; email: string; email_status: string; notes: string }
const STATUS_LABEL: Record<string, string> = { verified: '已验证', inferred: '推测', catchall: '通用', invalid: '无效' }

export default function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [persona, setPersona] = useState(''); const [busy, setBusy] = useState(false)
  const [discovering, setDiscovering] = useState(false); const [discoverMsg, setDiscoverMsg] = useState('')
  const [f, setF] = useState({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' })
  const [editId, setEditId] = useState<number | null>(null)
  const [ef, setEf] = useState({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' })

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(res => {
      if (res.status === 401) { router.push('/login'); return }
      return res.json()
    }).then((cs?: Company[]) => {
      if (!cs) return
      setCompanies(cs); if (cs.length && sel === null) setSel(cs[0].id)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const selCompany = companies.find(c => c.id === sel)

  const loadContacts = useCallback(async () => {
    if (sel === null) return
    setContacts(await fetch(`/api/companies/${sel}/contacts`).then(r => r.json()))
  }, [sel])
  useEffect(() => { setPersona(''); loadContacts() }, [loadContacts])

  async function genPersona() {
    setBusy(true); setPersona('AI 生成中…')
    const res = await fetch(`/api/companies/${sel}/persona`, { method: 'POST' })
    setBusy(false)
    setPersona(res.ok ? (await res.json()).text : '生成失败，可重试')
  }
  async function discover() {
    setDiscovering(true); setDiscoverMsg('公网检索 + AI 提取中（约 30–60 秒）…')
    const res = await fetch(`/api/companies/${sel}/contacts/discover`, { method: 'POST' })
    setDiscovering(false)
    const j = await res.json().catch(() => null)
    if (!res.ok) { setDiscoverMsg(j?.error || '查找失败，可重试'); return }
    setDiscoverMsg(j.inserted > 0
      ? `已自动录入 ${j.inserted} 位候选（标"AI 检索·待核实"），请核实后再补邮箱`
      : '公开网页上没检索到可靠人选，试试上面 AI 画像给的 LinkedIn 搜索词手动找')
    loadContacts()
  }
  async function hunterFind() {
    setDiscovering(true); setDiscoverMsg('Hunter 查邮箱中（跨境查询，约 10–40 秒，请稍候）…')
    const res = await fetch(`/api/companies/${sel}/contacts/hunter`, { method: 'POST' })
    setDiscovering(false)
    const j = await res.json().catch(() => null)
    if (!res.ok) { setDiscoverMsg(j?.error || '查找失败，可重试'); return }
    setDiscoverMsg(j.inserted > 0
      ? `Hunter 录入 ${j.inserted} 条邮箱${j.generic ? `（其中 ${j.generic} 条为通用邮箱）` : ''}，已按可信度标注邮箱状态，发送前请复核`
      : '该公司官网域名下 Hunter 暂无可用邮箱，试试上面公网检索或 LinkedIn 搜索')
    loadContacts()
  }
  async function addContact() {
    const res = await fetch(`/api/companies/${sel}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    })
    if (res.ok) { setF({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' }); loadContacts() }
  }
  async function setStatus(cid: number, emailStatus: string) {
    await fetch(`/api/contacts/${cid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailStatus }) })
    loadContacts()
  }
  async function delContact(cid: number) {
    await fetch(`/api/contacts/${cid}`, { method: 'DELETE' }); loadContacts()
  }
  function startEdit(t: Contact) {
    setEditId(t.id)
    setEf({ name: t.name || '', title: t.title || '', linkedinUrl: t.linkedin_url || '', email: t.email || '', emailStatus: t.email_status || 'inferred' })
  }
  async function saveEdit() {
    if (editId === null) return
    await fetch(`/api/contacts/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ef) })
    setEditId(null); loadContacts()
  }

  return (
    <>
      <ProjectNav id={id} active="contacts" />
      <div className="container">
        <h1>决策人</h1>
        <p className="notice">邮箱只人工录入并标注状态；&quot;推测/通用&quot;地址有退信风险，发送前请核实。本工具不代发。</p>
        <div className="grid2">
          <div className="card">
            <label>选择公司</label>
            <select value={sel ?? ''} onChange={e => setSel(Number(e.target.value))}>
              {companies.map(c => <option key={c.id} value={c.id}>[{c.priority}] {c.name}（{c.country}）</option>)}
            </select>
            <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" disabled={discovering || sel === null} onClick={hunterFind}>
                {discovering ? '查找中…' : 'Hunter 查邮箱决策人'}
              </button>
              <button className="btn secondary" disabled={discovering || sel === null} onClick={discover}>AI 公网检索决策人</button>
              <button className="btn secondary" disabled={busy || sel === null} onClick={genPersona}>AI：该找谁 + 搜索话术</button>
            </p>
            {discoverMsg && <p className="muted" style={{ fontSize: 13 }}>{discoverMsg}</p>}
            <p className="muted" style={{ fontSize: 12 }}>只检索公开网页（含公开 LinkedIn 页/公司团队页），不登录、不操作任何 LinkedIn 账号。</p>
            {persona && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 10 }} className="muted">{persona}</pre>}
          </div>
          <div className="card">
            <h2>联系人</h2>
            <table>
              <thead><tr><th>姓名/职位</th><th>邮箱</th><th>状态</th><th></th></tr></thead>
              <tbody>
                {contacts.map(t => editId === t.id ? (
                  <tr key={t.id}>
                    <td>
                      <input placeholder="姓名" value={ef.name} onChange={e => setEf({ ...ef, name: e.target.value })} style={{ marginBottom: 4 }} />
                      <input placeholder="职位" value={ef.title} onChange={e => setEf({ ...ef, title: e.target.value })} style={{ marginBottom: 4 }} />
                      <input placeholder="LinkedIn URL" value={ef.linkedinUrl} onChange={e => setEf({ ...ef, linkedinUrl: e.target.value })} />
                    </td>
                    <td><input placeholder="邮箱" value={ef.email} onChange={e => setEf({ ...ef, email: e.target.value })} /></td>
                    <td>
                      <select value={ef.emailStatus} onChange={e => setEf({ ...ef, emailStatus: e.target.value })} style={{ width: 90 }}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn" style={{ padding: '2px 8px', marginRight: 4 }} onClick={saveEdit}>保存</button>
                      <button className="btn secondary" style={{ padding: '2px 8px' }} onClick={() => setEditId(null)}>取消</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{t.name}<div className="muted">{t.title}</div>{t.linkedin_url && <a href={t.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}</td>
                    <td>{t.email || <span className="muted">—</span>}</td>
                    <td>
                      <select value={t.email_status} onChange={e => setStatus(t.id, e.target.value)} style={{ width: 90 }}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn secondary" style={{ padding: '2px 8px', marginRight: 4 }} onClick={() => startEdit(t)}>编辑</button>
                      <button className="btn danger" style={{ padding: '2px 8px' }} onClick={() => delContact(t.id)}>删</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2 style={{ marginTop: 16 }}>新增</h2>
            <input placeholder="姓名" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="职位" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="LinkedIn URL" value={f.linkedinUrl} onChange={e => setF({ ...f, linkedinUrl: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="邮箱" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={{ marginBottom: 6 }} />
            <button className="btn" disabled={sel === null} onClick={addContact}>添加联系人</button>
          </div>
        </div>
      </div>
    </>
  )
}
