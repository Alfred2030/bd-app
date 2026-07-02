import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CXODEX 国际市场开拓工作台',
  description: '竞品信号法：AI 辅助的海外经销商开发全流程工作台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
