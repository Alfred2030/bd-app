CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  invite_code_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_desc TEXT NOT NULL DEFAULT '',
  competitor_brands TEXT[] NOT NULL DEFAULT '{}',
  value_props JSONB NOT NULL DEFAULT '{}',
  target_markets TEXT[] NOT NULL DEFAULT '{}',
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  competitor_brands_carried TEXT[] NOT NULL DEFAULT '{}',
  main_distribution TEXT NOT NULL DEFAULT '',
  end_industries TEXT NOT NULL DEFAULT '',
  size_estimate TEXT NOT NULL DEFAULT '',
  fit_score INT NOT NULL DEFAULT 3,
  priority TEXT NOT NULL DEFAULT 'B',
  verify_status TEXT NOT NULL DEFAULT 'unverified',
  status TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'inferred',
  phone TEXT NOT NULL DEFAULT '',
  preferred_channel TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email1 JSONB,
  email2 JSONB,
  email3 JSONB,
  linkedin_note TEXT NOT NULL DEFAULT '',
  linkedin_followup TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT '2-待发送',
  channel TEXT NOT NULL DEFAULT '',
  first_touch_date DATE,
  followup1_date DATE,
  followup2_date DATE,
  last_touch_date DATE,
  replied BOOLEAN NOT NULL DEFAULT false,
  next_action TEXT NOT NULL DEFAULT '',
  next_action_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_project ON companies(project_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- ===== 大模型用量计量 + 预付费余额（2026-07-08）=====
-- 计费口径：应收 = GLM 实际成本 × 1.25（25% 手续费）；余额 ≤ 0 且计量开启时自动停止 AI 功能。
-- 金额单位统一为「分」（NUMERIC 保留小数，避免逐次微额扣费累计舍入丢失）；充值/展示时换算为元。
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_cents NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metering_enabled BOOLEAN NOT NULL DEFAULT true;

-- 邀请码携带的 AI 预充值额度（分）：付 ¥299 = 开通账号 + 注册即到账 ¥299 余额。默认 29900 分。
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS credit_cents NUMERIC(14,4) NOT NULL DEFAULT 29900;

-- 模型单价（分 / 1000 tokens）。改此表即生效（运行时读取，缓存 5 分钟），无需改代码/重部署。
-- 现采用统一保守单价 0.025 元/千tokens = 2.5 分/1K（输入输出一致，所有模型），宁高估不吃亏。
-- 如需按智谱控制台实际单价分档，改对应行即可（分/1K = 元每百万 × 0.1）。
CREATE TABLE IF NOT EXISTS model_rates (
  model TEXT PRIMARY KEY,
  in_per_1k NUMERIC(10,5) NOT NULL DEFAULT 0,
  out_per_1k NUMERIC(10,5) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO model_rates (model, in_per_1k, out_per_1k) VALUES
  ('glm-4-flash', 2.5, 2.5),
  ('glm-4-air',   2.5, 2.5),
  ('glm-4.5',     2.5, 2.5),
  ('glm-4.6',     2.5, 2.5),
  ('glm-5.2',     2.5, 2.5),
  ('default',     2.5, 2.5)
ON CONFLICT (model) DO NOTHING;

-- 逐次 LLM 用量流水（tokens + GLM 成本 + 应收）
CREATE TABLE IF NOT EXISTS llm_usage (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL DEFAULT 'bd',
  model TEXT NOT NULL DEFAULT '',
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  glm_cost_cents NUMERIC(14,4) NOT NULL DEFAULT 0,
  billed_cents NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user ON llm_usage(user_id, created_at);

-- 余额流水（充值为正、扣费为负），用于审计对账
CREATE TABLE IF NOT EXISTS balance_txns (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta_cents NUMERIC(14,4) NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  balance_after NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balance_txns_user ON balance_txns(user_id, created_at);
