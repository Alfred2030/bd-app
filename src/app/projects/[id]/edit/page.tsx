'use client'
import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProjectForm, { ProjectInitial } from '../../project-form'

type ProjectRow = {
  name: string; product_desc: string; competitor_brands: string[]
  value_props: { priceAdvantage?: string; proofPoints?: string; riskFreeTerms?: string } | null
  target_markets: string[]; target_industries: string[]
}

export default function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [initial, setInitial] = useState<ProjectInitial | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(res => {
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 404) { router.push('/dashboard'); return }
      return res.json()
    }).then((p?: ProjectRow) => {
      if (!p) return
      setInitial({
        name: p.name ?? '',
        productDesc: p.product_desc ?? '',
        brands: (p.competitor_brands ?? []).join(', '),
        markets: (p.target_markets ?? []).join(', '),
        industries: (p.target_industries ?? []).join(', '),
        priceAdvantage: p.value_props?.priceAdvantage ?? '',
        proofPoints: p.value_props?.proofPoints ?? '',
        riskFreeTerms: p.value_props?.riskFreeTerms ?? '',
      })
    })
  }, [id, router])

  if (!initial) return <div className="container"><p className="muted">加载中…</p></div>
  return <ProjectForm projectId={Number(id)} initial={initial} />
}
