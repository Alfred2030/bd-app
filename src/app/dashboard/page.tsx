'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  return (
    <>
      <div className="topnav">
        <strong>CXODEX 国际市场开拓</strong><span className="spacer" />
        <button className="btn secondary" onClick={logout}>退出</button>
      </div>
      <div className="container">
        <h1>我的项目</h1>
        <p style={{ margin: '12px 0' }}><Link className="btn" href="/projects/new">+ 新建开拓项目</Link></p>
        {projects === null ? <p className="muted">加载中…</p> :
          projects.length === 0 ? <div className="card muted">还没有项目，点上方新建。</div> :
          projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}/companies`}>
              <div className="card">
                <h2>{p.name}</h2>
                <p className="muted">{p.product_desc}</p>
                <p className="muted">市场：{p.target_markets.join('、') || '未设置'}</p>
              </div>
            </Link>
          ))}
      </div>
    </>
  )
}
