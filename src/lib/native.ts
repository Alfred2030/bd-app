// App Store 3.1.1：苹果 App / iOS 设备内不展示充值入口与收款码（额度在 App 内只能查看和使用，购买走网页端）。
// 原生外壳里工具经 SFSafariViewController 打开——没有 Capacitor 桥、也不带自定义 UA，
// 所以不能只认 Capacitor/UA：凡 iOS 设备(iPhone/iPad，含桌面模式 iPad)一律隐藏；另支持 ?capp=1 参数（记入 sessionStorage）。
export const IS_NATIVE_APP = (() => {
  if (typeof window === 'undefined') return false
  try {
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    if (w.Capacitor?.isNativePlatform?.()) return true
    const ua = navigator.userAgent || ''
    if (/CXODEXApp/i.test(ua)) return true
    if (new URLSearchParams(window.location.search).has('capp')) { try { sessionStorage.setItem('capp', '1') } catch { /* ignore */ } return true }
    try { if (sessionStorage.getItem('capp') === '1') return true } catch { /* ignore */ }
    if (/iPhone|iPad|iPod/i.test(ua)) return true
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true // iPad 桌面模式 UA 伪装
  } catch { /* ignore */ }
  return false
})()
