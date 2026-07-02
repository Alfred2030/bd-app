'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['产品线', '竞品品牌', '价值主张', '目标市场与行业']

export default function NewProject() {
  const r = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(''); const [productDesc, setProductDesc] = useState('')
  const [brands, setBrands] = useState(''); const [markets, setMarkets] = useState(''); const [industries, setIndustries] = useState('')
  const [priceAdvantage, setPriceAdvantage] = useState(''); const [proofPoints, setProofPoints] = useState(''); const [riskFreeTerms, setRiskFreeTerms] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  const splitList = (s: string) => s.split(/[,，、\n]/).map(x => x.trim()).filter(Boolean)

  async function submit() {
    setBusy(true); setErr('')
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, productDesc,
        competitorBrands: splitList(brands),
        targetMarkets: splitList(markets),
        targetIndustries: splitList(industries),
        valueProps: { priceAdvantage, proofPoints, riskFreeTerms },
      }),
    })
    setBusy(false)
    if (res.ok) { const { id } = await res.json(); r.push(`/projects/${id}/companies`) }
    else setErr((await res.json()).error || '创建失败')
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>新建开拓项目</h1>
      <p className="muted">第 {step + 1} / 4 步：{STEPS[step]}</p>
      <div className="card">
        {step === 0 && (<>
          <label>项目名称</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：PCBN 刀片欧洲开拓" />
          <label>产品线描述（卖什么、优势是什么）</label>
          <textarea rows={4} value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="如：PCBN 车削刀片，用于淬硬钢/铸铁加工…" />
        </>)}
        {step === 1 && (<>
          <label>竞品品牌（逗号或换行分隔，这是冷邮件的首触钩子）</label>
          <textarea rows={4} value={brands} onChange={e => setBrands(e.target.value)} placeholder="如：Sumitomo, Element Six, Kennametal" />
        </>)}
        {step === 2 && (<>
          <label>价格优势</label><input value={priceAdvantage} onChange={e => setPriceAdvantage(e.target.value)} placeholder="如：同级性能约为竞品 1/3 价格" />
          <label>量化实证（客户实测数据）</label><input value={proofPoints} onChange={e => setProofPoints(e.target.value)} placeholder="如：刀具寿命 +30~200%，效率 +20~50%" />
          <label>零风险条款</label><input value={riskFreeTerms} onChange={e => setRiskFreeTerms(e.target.value)} placeholder="如：90 天验证 / 不达标不成交 / 寄售" />
        </>)}
        {step === 3 && (<>
          <label>目标市场（国家，逗号分隔）</label>
          <input value={markets} onChange={e => setMarkets(e.target.value)} placeholder="如：Germany, USA, Italy, Poland" />
          <label>目标终端行业</label>
          <input value={industries} onChange={e => setIndustries(e.target.value)} placeholder="如：automotive, bearings, gears" />
        </>)}
        {err && <p className="error">{err}</p>}
        <p style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>上一步</button>}
          {step < 3 && <button className="btn" disabled={step === 0 && (!name || !productDesc)} onClick={() => setStep(step + 1)}>下一步</button>}
          {step === 3 && <button className="btn" disabled={busy || !name || !productDesc} onClick={submit}>创建项目</button>}
        </p>
      </div>
    </div>
  )
}
