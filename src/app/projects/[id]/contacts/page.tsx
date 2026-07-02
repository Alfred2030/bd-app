'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Contact = { id: number; name: string; title: string; linkedin_url: string; email: string; email_status: string; notes: string }
const STATUS_LABEL: Record<string, string> = { verified: '已验证', inferred: '推测', catchall: '通用', invalid: '无效' }

export default function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [persona, setPersona] = useState(''); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' })

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(r => r.json()).then((cs: Company[]) => {
      setCompanies(cs); if (cs.length && sel === null) setSel(cs[0].id)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
            <p style={{ marginTop: 12 }}><button className="btn" disabled={busy || sel === null} onClick={genPersona}>AI：该找谁 + LinkedIn 搜索话术</button></p>
            {persona && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 10 }} className="muted">{persona}</pre>}
          </div>
          <div className="card">
            <h2>联系人</h2>
            <table>
              <thead><tr><th>姓名/职位</th><th>邮箱</th><th>状态</th><th></th></tr></thead>
              <tbody>
                {contacts.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}<div className="muted">{t.title}</div>{t.linkedin_url && <a href={t.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}</td>
                    <td>{t.email}</td>
                    <td>
                      <select value={t.email_status} onChange={e => setStatus(t.id, e.target.value)} style={{ width: 90 }}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td><button className="btn danger" style={{ padding: '2px 8px' }} onClick={() => delContact(t.id)}>删</button></td>
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
