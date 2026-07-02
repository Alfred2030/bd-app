const BASE = process.env.SMOKE_BASE || 'http://localhost:3005'
const email = `smoke-${Date.now()}@test.local`
let cookie = ''

async function call(method, path, body, expectStatus) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  if (res.status !== expectStatus) {
    console.error(`FAIL ${method} ${path} → ${res.status} (want ${expectStatus}):`, await res.text())
    process.exit(1)
  }
  console.log(`ok   ${method} ${path} → ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.arrayBuffer()
}

const invite = process.env.SMOKE_INVITE || 'DEV-TEST'
await call('POST', '/api/auth/register', { email, password: 'password1', inviteCode: invite }, 201)
await call('GET', '/api/auth/me', null, 200)
const proj = await call('POST', '/api/projects', {
  name: '冒烟项目', productDesc: '超硬刀具',
  competitorBrands: ['BrandX'], targetMarkets: ['Germany'], targetIndustries: ['automotive'],
  valueProps: { priceAdvantage: '1/3 价格', proofPoints: '寿命+100%', riskFreeTerms: '90天验证' },
}, 201)
const comp = await call('POST', `/api/projects/${proj.id}/companies`, { name: 'Smoke GmbH', country: 'Germany' }, 201)
await call('POST', `/api/companies/${comp.id}/contacts`, { name: 'Jo Smoke', title: 'Buyer', email: 'jo@smoke.de', emailStatus: 'inferred' }, 201)
await call('PUT', `/api/companies/${comp.id}/activity`, { stage: '4-首触已发', firstTouchDate: '2026-07-02', lastTouchDate: '2026-07-02' }, 200)
const xlsxBuf = await call('GET', `/api/projects/${proj.id}/export`, null, 200)
if (xlsxBuf.byteLength < 1000) { console.error('FAIL export too small'); process.exit(1) }
await call('DELETE', `/api/projects/${proj.id}`, null, 200)
console.log('SMOKE PASS')
