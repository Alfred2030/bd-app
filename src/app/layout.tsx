import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CXODEX 国际市场开拓工作台',
  description: '竞品信号法：AI 辅助的海外经销商开发全流程工作台',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: '抓单数字人',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#0e1117',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
