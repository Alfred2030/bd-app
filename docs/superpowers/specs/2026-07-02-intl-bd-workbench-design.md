# CXODEX 国际市场开拓工作台 — 设计文档

日期：2026-07-02
状态：已获用户批准（brainstorming 阶段结论）
线上目标：`bd.cxodex.com`（腾讯云香港 Lighthouse，PM2 端口 3005，Nginx 反代；Vercel 作备份）
本地路径：`D:\Projects\Cxodex\bd-app`

## 1. 背景与定位

把 `funik-international-bd` 技能（为富耐克 CBN 超硬刀具开发海外经销商的已验证工作流）泛化为一个**行业无关的国际市场开拓工作台**，作为 cxodex 工具矩阵新成员（与 diagnosis / legal / finance / interview 并列），既是产品也是 cxodex 的获客入口。

方法论核心是"竞品信号开拓法"，与具体行业无关：

| Funik 专用要素 | 泛化后 |
|---|---|
| PCBN/PCD 刀具产品线 | 用户在项目向导中定义的任意产品线 |
| Sumitomo / Element Six 等竞品牌号 | 用户输入的竞品品牌清单（= 冷邮件首触钩子） |
| ~1/3 价格 + 寿命 +30–200% / 效率 +20–50% | 用户填写的价格优势 + 可量化实证数据 |
| 牌号对照表（grade cross-reference） | 通用"竞品对照表"生成器（**v1.5，可选，本期不做**） |

五步流水线原样保留：**目标客户库 → 决策人 → 邮箱标注 → 三封冷邮件 + LinkedIn 文案 → 30 天追踪看板**。

### 已确认的关键决策（用户拍板）

1. **定位**：cxodex 工具矩阵成员，多租户在线工具。
2. **v1 范围**：一步到位的完整工作台（五步全做，含追踪看板），不是轻量生成器。
3. **线索数据来源**：**纯 AI 知识生成**（GLM 按训练知识生成候选经销商），不接实时搜索/抓取 API。产品层面用"AI 建议 · 待验证"标签管理预期；支持手动录入与 Excel 导入作补充。
4. **账户体系**：**邀请码制**注册（邮箱 + 密码 + 有效邀请码），多租户，每用户多项目空间。
5. **技术路线**：Next.js（App Router）全栈单体 + Neon Postgres + GLM API，与 interview/legal 同模。

### 合规铁律（继承自源方法论，产品内建）

- App **只生成、只管理，永不代发**任何邮件 / LinkedIn 消息。所有外发动作由用户在自己的邮箱/LinkedIn 中人工执行。界面在冷邮件工坊与追踪页明示此原则。
- AI 生成的公司线索一律带"AI 建议 · 待验证"状态，用户核实官网后可置为"已验证"。
- 邮箱字段带四态：已验证 / 推测 / 通用(catch-all) / 无效；界面提示推测与 catch-all 地址的退信风险。
- 生成的邮件模板默认包含退订语句与发件人地址占位，提示 CAN-SPAM / GDPR 合规要点。

## 2. 架构

- **框架**：Next.js（App Router，React Server Components + API Route Handlers），单仓库单进程。
- **数据库**：Neon Postgres（serverless driver）。
- **AI**：GLM API（智谱，chat completions，JSON 输出模式），服务端调用，key 走环境变量。
- **鉴权**：邮箱 + 密码（bcrypt 哈希），JWT 存 HttpOnly Cookie；注册需有效邀请码。
- **部署**：香港服务器 PM2 新增进程（端口 3005），Nginx 加 `bd.cxodex.com` server 块 + SSL；Vercel 备份部署。
- **本地构建注意**：D 盘构建须加 `--webpack`（既有项目经验）。
- **界面语言**：中文 UI；AI 产出的冷邮件 / LinkedIn 文案为英文。

## 3. 数据模型（Neon Postgres）

- `users`：id · email(唯一) · password_hash · invite_code_used · created_at
- `invite_codes`：code(主键) · max_uses · used_count · expires_at · created_at
- `projects`：id · user_id → users · name · product_desc（产品线描述）· competitor_brands text[]（竞品品牌）· value_props jsonb（价格优势、量化实证、零风险条款如样品测试/寄售）· target_markets text[]（国家）· target_industries text[] · created_at
- `companies`（目标客户库，字段对齐原 tracker【2-目标客户库】）：id · project_id → projects · name · country · city · website · source（`ai` / `manual` / `import`）· competitor_brands_carried text[]（该公司在售竞品，= 钩子）· main_distribution · end_industries · size_estimate · fit_score int(1–5) · priority（A/B/C）· verify_status（`unverified` / `verified` / `rejected`）· status · notes · created_at
- `contacts`（决策人，对齐【3-决策人】）：id · company_id → companies · name · title · linkedin_url · email · email_status（`verified` / `inferred` / `catchall` / `invalid`）· phone · preferred_channel · notes
- `drafts`（冷邮件工坊产物）：id · company_id → companies · email1 / email2 / email3（主题+正文 jsonb）· linkedin_note（≤300 字符）· linkedin_followup · generated_at · edited_at
- `activities`（追踪，对齐【4-30天追踪】）：id · company_id → companies · stage（`2-待发送`…`7-约电话/寄样`）· channel · first_touch_date · followup1_date · followup2_date · last_touch_date · replied bool · next_action · next_action_date · notes · updated_at

所有业务表查询强制按 user_id（经 project → company 链）隔离租户。

## 4. 页面与 AI 流

1. **营销首页 `/`**（免登录）：方法论介绍（竞品信号法 + 五步流程 + 30 天节奏）、案例化文案、邀请码注册/登录入口。
2. **项目向导 `/projects/new`**：四步表单——①产品线 ②竞品品牌 ③价值主张（价格优势 / 量化实证 / 零风险条款）④目标市场与行业。此上下文是后续所有 AI 生成的提示词底座。
3. **目标客户库 `/projects/[id]/companies`**："AI 生成候选"按钮 → GLM 按选定市场逐国生成经销商候选（公司名/国家/城市/可能在售竞品/主营/契合度/优先级 + 生成理由），JSON 严格校验后批量入库，全部标 `unverified`；表格支持行内编辑、手动新增、xlsx 导入；导出 xlsx（五个 tab 对齐原 Funik tracker 结构）。
4. **决策人 `/projects/[id]/contacts`**：GLM 按公司生成"该找的职位画像 + LinkedIn 搜索话术"（采购总监 > 品类经理 > Sourcing Manager；小商找 Owner/BD 的规则内置于提示词）；姓名/LinkedIn/邮箱由用户人工录入；邮箱状态四态下拉。
5. **冷邮件工坊 `/projects/[id]/drafts`**：按公司一键生成英文三封序列——首触（点名其在售竞品 + 等价替代 + 免费对比测试）、+3 天（贴牌/OEM 角度）、+7 天（90 天 ROI 验证 / 不达标不成交 / 寄售）——外加 LinkedIn 连接语与通过后跟进语；富文本可编辑、一键复制、导出 Word（docx）；页面顶部固定"本工具不代发，请人工发送"提示。
6. **30 天追踪看板 `/projects/[id]/board`**：漏斗统计（各阶段公司数）、"超 3 天未跟进且未回复"红色提醒列表（每条附"生成跟进草稿"按钮，调 GLM 生成简短跟进邮件）、30 天目标 vs 实际、阶段拖拽或下拉变更。

## 5. AI 集成细节

- 统一服务端模块封装 GLM 调用：系统提示词注入项目上下文（产品/竞品/价值主张/市场），要求 JSON 输出并给出 schema。
- 响应经 JSON 解析 + 字段校验（zod 或手写校验）后入库；单行不合法则丢弃该行并计数提示，不污染库、不整批失败。
- 失败重试：调用失败向用户展示可重试的错误态，已填表单内容不丢失。
- 成本控制：生成类操作按批（如每国一批 ≤15 家），前端显示消耗预期；邀请码制本身即用量闸门。

## 6. 错误处理

- 鉴权失败/过期统一跳登录；API 层租户校验失败返回 404（不泄露资源存在性）。
- 数据库操作用参数化查询；导入 xlsx 时逐行校验，坏行汇总报告。
- GLM 超时（>60s）中断并提示重试；重复点击生成有防抖/进行中锁。

## 7. 测试与验收

- 构建通过（`next build --webpack` 本地）；
- API 冒烟链路：注册（邀请码）→ 登录 → 建项目 → AI 生成候选入库 → 录入决策人 → 生成三封序列 → 更新追踪阶段 → 导出 xlsx，全链路通过；
- 本地 preview 人工验证六页 UI 与合规提示文案；
- 部署后线上同链路复验。

## 8. 非目标（v1 明确不做）

- 实时联网调研 / 搜索 API 接入（用户已拍板纯 AI 知识生成）；
- 邮件代发、LinkedIn 自动化（合规铁律，永不做）；
- Hunter.io 等第三方邮箱验证 API 集成（v1 人工标注，v2 再议）；
- 竞品对照表生成器（v1.5）；
- 付费/订阅体系（邀请码制先行）；
- 每日定时跟进摘要邮件（v2，可复用 interview 的邮件基建再议）。
