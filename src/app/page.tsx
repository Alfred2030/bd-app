import Link from 'next/link'

export default function Home() {
  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div style={{ padding: '60px 0 30px' }}>
        <h1>CXODEX 国际市场开拓工作台</h1>
        <p className="muted" style={{ fontSize: 17 }}>
          用&quot;竞品信号法&quot;开发海外经销商：找到已经在卖竞品的渠道商，用竞品钩子首触，
          以价格优势 + 量化实证 + 零风险条款打开对话。源自超硬刀具行业已验证的出海打法，适用于任何 B2B 产品。
        </p>
        <p style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link className="btn" href="/register">邀请码注册</Link>
          <Link className="btn secondary" href="/login">登录</Link>
        </p>
      </div>
      <div className="grid2">
        <div className="card"><h2>① 目标客户库</h2><p className="muted">AI 按目标市场生成候选经销商（标注&quot;AI 建议 · 待验证&quot;），支持手动录入与 Excel 导入导出。</p></div>
        <div className="card"><h2>② 决策人定位</h2><p className="muted">AI 生成职位画像与 LinkedIn 搜索话术；联系方式人工核实录入，邮箱四态标注控制退信风险。</p></div>
        <div className="card"><h2>③ 冷邮件工坊</h2><p className="muted">一键生成英文三封序列（竞品钩子 / OEM 贴牌 / 零风险收尾）+ LinkedIn 文案，可编辑导出 Word。</p></div>
        <div className="card"><h2>④ 30 天追踪看板</h2><p className="muted">阶段漏斗、超 3 天未跟进提醒、一键生成跟进草稿。工具只生成不代发，发送永远由你人工执行。</p></div>
      </div>
    </div>
  )
}
