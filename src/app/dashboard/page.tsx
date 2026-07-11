'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BalanceBadge from '../balance-badge'

type Project = { id: number; name: string; product_desc: string; target_markets: string[]; created_at: string }

export default function Dashboard() {
  const r = useRouter()
  const [projects, setProjects] = useState<Project[] | null>(null)
  useEffect(() => {
    fetch('/api/projects').then(async res => {
      if (res.status === 401) { r.push('/login'); return }
      setProjects(await res.json())
    })
  }, [r])
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/') }
  async function delProject(id: number, name: string) {
    if (!confirm(`删除项目「${name}」？\n其下所有目标客户、决策人、邮件草稿、追踪记录都会一并永久删除，不可恢复。`)) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) setProjects(ps => (ps ? ps.filter(p => p.id !== id) : ps))
    else alert('删除失败，请重试')
  }
  return (
    <>
      <div className="topnav">
        <strong>CXODEX 国际市场开拓</strong><span className="spacer" />
        <button className="btn secondary" onClick={logout}>退出</button>
      </div>
      <div className="container">
        <h1>我的项目</h1>
        <BalanceBadge />
        <Link href="/customs" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', borderColor: '#b45309' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>🔍 竞争对手客户海关数据</strong>
            <span className="muted" style={{ fontSize: 13 }}>输入竞品英文名，反查它的美国买家 →</span>
          </div>
        </Link>
        <p style={{ margin: '12px 0' }}><Link className="btn" href="/projects/new">+ 新建开拓项目</Link></p>
        {projects === null ? <p className="muted">加载中…</p> :
          projects.length === 0 ? <div className="card muted">还没有项目，点上方新建。</div> :
          projects.map(p => (
            <div className="card" key={p.id}>
              <Link href={`/projects/${p.id}/companies`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <h2>{p.name}</h2>
                <p className="muted">{p.product_desc}</p>
                <p className="muted">市场：{p.target_markets.join('、') || '未设置'}</p>
              </Link>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Link className="btn secondary" style={{ padding: '4px 12px' }} href={`/projects/${p.id}/edit`}>编辑</Link>
                <button className="btn danger" style={{ padding: '4px 12px' }} onClick={() => delProject(p.id, p.name)}>删除项目</button>
              </div>
            </div>
          ))}
      </div>
    </>
  )
}
