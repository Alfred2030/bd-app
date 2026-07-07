'use client'

import { useState } from 'react'

export default function VideoDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} style={{ background: '#b0832f', borderColor: '#b0832f', color: '#fff' }}>▶ 视频演示</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(900px, 96vw)' }}>
            <button
              onClick={() => setOpen(false)}
              aria-label="关闭"
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer' }}
            >✕</button>
            <video src="/demo.mp4" controls autoPlay playsInline style={{ width: '100%', maxHeight: '92vh', borderRadius: 10, background: '#000' }} />
          </div>
        </div>
      )}
    </>
  )
}
