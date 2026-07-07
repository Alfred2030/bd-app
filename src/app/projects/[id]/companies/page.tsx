'use client'
import { useCallback, useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import ProjectNav from '../nav'

type Company = {
  id: number; name: string; country: string; city: string; website: string; source: string
  competitor_brands_carried: string[]; main_distribution: string; end_industries: string
  size_estimate: string; fit_score: number; priority: string; verify_status: string; notes: string; stage: string | null
}
type Project = { target_markets: string[] }
const REGIONS = ['北美', '南美', '欧洲', '北欧', '俄罗斯', '非洲', '中东', '亚洲', '拉丁美洲']

export default function CompaniesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [market, setMarket] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState(''); const [newCountry, setNewCountry] = useState('')

  const load = useCallback(async () => {
    const cRes = await fetch(`/api/projects/${id}/companies`)
    if (cRes.status === 401) { router.push('/login'); return }
    const [c, p] = await Promise.all([
      cRes.json(),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ])
    setCompanies(c); setProject(p)
    if (!market && p.target_markets?.length) setMarket(p.target_markets[0])
  }, [id, market, router])
  useEffect(() => { load() }, [load])

  async function generate() {
    if (!market) { setMsg('请先选择市场'); return }
    setBusy(true); setMsg('AI 生成中（约 1–2 分钟，逐一核实真实经销商，可多次生成累加）…')
    const res = await fetch(`/api/projects/${id}/companies/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market }),
    })
    setBusy(false)
    if (res.ok) { const { inserted, dropped, duplicate } = await res.json(); setMsg(`已新增 ${inserted} 家候选${duplicate ? `（跳过 ${duplicate} 家重复）` : ''}${dropped ? `（丢弃 ${dropped} 条不合规行）` : ''}，均为"AI 建议 · 待验证"`); load() }
    else { const j = await res.json().catch(() => null); setMsg(j?.error || '生成失败，可重试') }
  }

  async function addManual() {
    if (!newName) return
    const res = await fetch(`/api/projects/${id}/companies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, country: newCountry }),
    })
    if (res.ok) { setNewName(''); setNewCountry(''); setShowAdd(false); load() }
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('file', f)
    const res = await fetch(`/api/projects/${id}/companies/import`, { method: 'POST', body: fd })
    const j = await res.json()
    setMsg(res.ok ? `导入 ${j.inserted} 家${j.errors?.length ? `，${j.errors.length} 行有误：${j.errors.slice(0, 3).join('；')}` : ''}` : j.error)
    load(); e.target.value = ''
  }

  async function patch(cid: number, body: Record<string, unknown>) {
    await fetch(`/api/companies/${cid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  async function del(cid: number) {
    if (!confirm('删除这家公司及其联系人/草稿/追踪记录？')) return
    await fetch(`/api/companies/${cid}`, { method: 'DELETE' }); load()
  }

  return (
    <>
      <ProjectNav id={id} active="companies" />
      <div className="container">
        <h1>目标客户库 <span className="muted" style={{ fontSize: 14 }}>{companies.length} 家</span></h1>
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ width: 180 }} value={market} onChange={e => setMarket(e.target.value)}>
            <option value="">选择市场…</option>
            <optgroup label="大区">
              {REGIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </optgroup>
            {project?.target_markets?.filter(m => !REGIONS.includes(m)).length ? (
              <optgroup label="项目目标市场">
                {project.target_markets.filter(m => !REGIONS.includes(m)).map(m => <option key={m} value={m}>{m}</option>)}
              </optgroup>
            ) : null}
          </select>
          <button className="btn" disabled={busy} onClick={generate}>AI 生成候选经销商</button>
          <button className="btn secondary" onClick={() => setShowAdd(!showAdd)}>+ 手动添加</button>
          <label className="btn secondary" style={{ width: 'auto', margin: 0 }}>
            导入 Excel<input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={importFile} />
          </label>
          {msg && <span className="muted">{msg}</span>}
          <p className="muted" style={{ fontSize: 12, width: '100%', margin: '4px 0 0', lineHeight: 1.7 }}>
            说明：「大区」覆盖全球（亚洲/中东/非洲/欧洲/北美/南美等），选定后点「AI 生成候选经销商」；
            想按具体国家找，在建项目时「目标市场」里填国家（英文名，如 Japan、UAE），会出现在本下拉的「项目目标市场」分组。每次生成最多 15 家，可换市场多次生成累加。
          </p>
        </div>
        {showAdd && (
          <div className="card" style={{ display: 'flex', gap: 8 }}>
            <input placeholder="公司名称" value={newName} onChange={e => setNewName(e.target.value)} />
            <input placeholder="国家" value={newCountry} onChange={e => setNewCountry(e.target.value)} />
            <button className="btn" onClick={addManual}>保存</button>
          </div>
        )}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>公司</th><th>国家/城市</th><th>在售竞品</th><th>契合</th><th>优先级</th><th>验证</th><th>阶段</th><th>备注</th><th></th></tr></thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>{' '}
                    {c.source === 'ai' && <span className="badge ai">AI 建议 · 待验证</span>}
                    {c.website && <div><a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="muted">{c.website}</a></div>}
                  </td>
                  <td>{c.country}{c.city ? ` / ${c.city}` : ''}</td>
                  <td>{c.competitor_brands_carried.join(', ')}</td>
                  <td>{c.fit_score}</td>
                  <td>
                    <select value={c.priority} onChange={e => patch(c.id, { priority: e.target.value })} style={{ width: 56 }}>
                      <option>A</option><option>B</option><option>C</option>
                    </select>
                  </td>
                  <td>
                    <select value={c.verify_status} onChange={e => patch(c.id, { verifyStatus: e.target.value })} style={{ width: 100 }}>
                      <option value="unverified">待验证</option>
                      <option value="verified">已验证</option>
                      <option value="rejected">已排除</option>
                    </select>
                  </td>
                  <td>{c.stage ?? '—'}</td>
                  <td style={{ maxWidth: 260 }} className="muted">{c.notes}</td>
                  <td><button className="btn danger" style={{ padding: '2px 8px' }} onClick={() => del(c.id)}>删</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
