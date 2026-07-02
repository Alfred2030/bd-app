'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TABS = [
  { key: 'companies', label: '目标客户库' },
  { key: 'contacts', label: '决策人' },
  { key: 'drafts', label: '冷邮件工坊' },
  { key: 'board', label: '30天看板' },
]

export default function ProjectNav({ id, active }: { id: string; active: string }) {
  const r = useRouter()
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/') }
  return (
    <div className="topnav">
      <Link href="/dashboard"><strong>← 项目</strong></Link>
      {TABS.map(t => (
        <Link key={t.key} href={`/projects/${id}/${t.key}`}
          style={{ color: active === t.key ? 'var(--text)' : 'var(--muted)', fontWeight: active === t.key ? 600 : 400 }}>
          {t.label}
        </Link>
      ))}
      <span className="spacer" />
      <a className="btn secondary" href={`/api/projects/${id}/export`}>导出 Excel</a>
      <button className="btn secondary" onClick={logout}>退出</button>
    </div>
  )
}
