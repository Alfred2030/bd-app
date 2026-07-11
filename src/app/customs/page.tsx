'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BalanceBadge from '../balance-badge'
import { IS_NATIVE_APP } from '@/lib/native'

type Buyer = {
  buyer_name: string; location: string; products: string; shipments: number
  most_recent_date: string; source_supplier: string; signal: '高' | '中' | '低'; pitch: string
}
type Supplier = { name: string; slug: string; address: string; total_shipments: number; most_recent: string }
type Result = {
  query: string; matched: boolean; suppliers: Supplier[]; buyers: Buyer[]
  notes: string; caveat: string; cost_cents: number; cached?: boolean
}
type Hist = { query: string; matched: boolean; buyers_count: number; created_at: string }

const SIG_COLOR: Record<string, string> = { 高: '#16a34a', 中: '#d97706', 低: '#6b7280' }

export default function CustomsPage() {
  const r = useRouter()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [lowBalance, setLowBalance] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const [hist, setHist] = useState<Hist[]>([])

  function loadHist() {
    fetch('/api/customs/history').then(async x => { if (x.ok) setHist(await x.json()) }).catch(() => {})
  }
  useEffect(() => { loadHist() }, [])

  async function lookup(query: string) {
    const name = query.trim()
    if (name.length < 2) { setErr('请输入竞争对手的英文公司名'); return }
    setBusy(true); setErr(''); setLowBalance(false); setRes(null)
    try {
      const x = await fetch('/api/customs/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: name }),
      })
      if (x.status === 401) { r.push('/login?next=/customs'); return }
      const data = await x.json().catch(() => ({}))
      if (!x.ok) {
        if (x.status === 402) setLowBalance(true)
        setErr(data?.error || '反查失败，请重试')
        return
      }
      setRes(data as Result)
      loadHist()
      // 通知顶部余额徽标实时刷新（本次已扣费）
      try { window.dispatchEvent(new Event('balance:refresh')) } catch { /* ignore */ }
    } catch {
      setErr('网络错误，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topnav">
        <strong>竞争对手客户海关数据</strong><span className="spacer" />
        <Link className="btn secondary" href="/dashboard">返回项目</Link>
      </div>
      <div className="container" style={{ maxWidth: 860 }}>
        <BalanceBadge />

        <div className="card">
          <h1 style={{ marginTop: 0 }}>竞争对手客户海关数据</h1>
          <p className="muted" style={{ lineHeight: 1.8 }}>
            输入竞争对手的<b>英文公司名</b>，反查它在<b>美国海关公开进口记录</b>中的美国买家——这些正在采购同类产品的公司，就是你的现成开发目标。
          </p>
          <label>竞争对手英文公司名</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) lookup(q) }}
            placeholder="如：Ehwa Diamond / Beijing Worldia Diamond Tools"
            disabled={busy}
          />
          <p style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy || q.trim().length < 2} onClick={() => lookup(q)}>
              {busy ? '检索分析中…' : '反查美国买家'}
            </button>
          </p>
          {busy && (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
              正在检索美国海关进口记录并分析买家，预计 <b>1–2 分钟</b>，请勿刷新或离开页面……
            </p>
          )}
          {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
          {lowBalance && !IS_NATIVE_APP && (
            <p style={{ marginTop: 6 }}><Link className="btn secondary" href="/recharge">前往充值</Link></p>
          )}
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 14, borderTop: '1px solid #2a2f3a', paddingTop: 10 }}>
            ⚠️ 数据来源为美国海关海运进口提单公开记录，仅含海运、不含空运/快递。体积小、单价高的刀片类产品多走空运，可能不完整；结果为线索参考，请再行核实。
          </p>
        </div>

        {res && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>反查结果：{res.query}</h2>
              <span className="spacer" />
              {res.cached
                ? <span className="badge">来自最近记录 · 未扣费</span>
                : <span className="muted" style={{ fontSize: 13 }}>本次消耗 ¥{(res.cost_cents / 100).toFixed(2)}</span>}
            </div>

            {res.suppliers.length > 0 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                匹配出口档案：{res.suppliers.map(s => `${s.name}（${s.total_shipments} 票，最近 ${s.most_recent || '—'}）`).join('；')}
              </p>
            )}

            {res.buyers.length === 0 ? (
              <p style={{ marginTop: 12 }}>{res.notes || '未找到清晰的美国买家记录。'}</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid #2a2f3a' }}>
                        <th style={{ padding: '8px 10px' }}>美国买家</th>
                        <th style={{ padding: '8px 10px' }}>地点</th>
                        <th style={{ padding: '8px 10px' }}>在买什么</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>票数</th>
                        <th style={{ padding: '8px 10px' }}>最近</th>
                        <th style={{ padding: '8px 10px' }}>信号</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.buyers.map((b, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #232833', verticalAlign: 'top' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{b.buyer_name}</td>
                          <td style={{ padding: '8px 10px' }} className="muted">{b.location || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{b.products || '—'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{b.shipments || '—'}</td>
                          <td style={{ padding: '8px 10px' }} className="muted">{b.most_recent_date || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ color: '#fff', background: SIG_COLOR[b.signal] || '#6b7280', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{b.signal}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 14 }}>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 6px' }}>开发切入话术：</p>
                  {res.buyers.map((b, i) => (
                    b.pitch ? (
                      <p key={i} style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 8px', paddingLeft: 10, borderLeft: `3px solid ${SIG_COLOR[b.signal] || '#6b7280'}` }}>
                        <b>{b.buyer_name}</b>：{b.pitch}
                      </p>
                    ) : null
                  ))}
                </div>
              </>
            )}

            {res.notes && res.buyers.length > 0 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>提示：{res.notes}</p>
            )}
          </div>
        )}

        {hist.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>最近查询</h3>
            <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>点击可复看（7 天内不重复扣费）</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hist.map((h, i) => (
                <button key={i} className="btn secondary" style={{ padding: '4px 12px', fontSize: 13 }}
                  disabled={busy} onClick={() => { setQ(h.query); lookup(h.query) }}>
                  {h.query} {h.matched ? `· ${h.buyers_count} 家` : '· 无匹配'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
