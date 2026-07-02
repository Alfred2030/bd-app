# bd.cxodex.com 部署手册（2026-07-02 首次上线实录）

## 拓扑

- 服务器：腾讯云香港 Lighthouse `43.160.214.195`，SSH `ubuntu` 用户，密钥 `~/.ssh/cxodex_hk`（本机 Windows）。
- 应用目录：`/home/ubuntu/bd-app`（git archive 解包，非 git clone）。
- 进程：PM2 `bd-app` → `./node_modules/next/dist/bin/next start -p 3011`（**端口 3011**；3005 在服务器上已被其他应用占用，勿照 README 的本地端口）。
- Nginx：`/etc/nginx/sites-available/bd`（软链到 sites-enabled），反代 127.0.0.1:3011，`proxy_read_timeout 300s`（GLM-5.2 推理生成最长约 3 分钟）；`/api/auth/` 走 `limit_req zone=bdauth`（zone 定义在 `/etc/nginx/conf.d/bd-limit.conf`，10r/m + burst 10）。
- TLS：certbot（Let's Encrypt），证书 `/etc/letsencrypt/live/bd.cxodex.com/`，certbot 自动续期。
- DNS：GoDaddy（domaincontrol NS），A 记录 `bd → 43.160.214.195`。
- 数据库：Neon 共享实例上的独立库 `bd`（与 interview 等共用实例、不同 database）。**本地开发与线上共用此库**。
- 环境变量：`/home/ubuntu/bd-app/.env.local`（chmod 600）：`DATABASE_URL` / `JWT_SECRET`（线上独立随机值）/ `GLM_API_KEY`（与 interview-app 同一个）/ `GLM_MODEL=GLM-5.2`。
- Cookie：`Secure` 标志由 `NODE_ENV=production` 自动附加（`next start` 即 production）。
- 邀请码（**2026-07-02 起收费制 ¥99/码**，见 `docs/发码操作卡.md`）：正式发放全部走一次性码（`seed-invite.mjs '' 1`），人工确认微信到账后发码。`BD-LAUNCH` 已停用（max_uses=0）；`DEV-TEST` 已删除，本地开发/冒烟用私有码 **`DEV-2fe79387`**（100 次，勿外传，共库线上同样有效）。冒烟命令记得 `SMOKE_INVITE=DEV-2fe79387`。

## 发布新版本

```bash
# 本机（D:\Projects\Cxodex\bd-app，master 分支）
git archive master -o /tmp/bd-app.tar.gz
scp -i ~/.ssh/cxodex_hk /tmp/bd-app.tar.gz ubuntu@43.160.214.195:~/bd-app.tar.gz

# 服务器
cd ~ && tar xzf bd-app.tar.gz -C bd-app && rm bd-app.tar.gz
cd ~/bd-app && npm ci && npm run build
pm2 restart bd-app
curl -s -o /dev/null -w '%{http_code}\n' https://bd.cxodex.com/   # 期望 200
SMOKE_BASE=https://bd.cxodex.com SMOKE_INVITE=DEV-2fe79387 node scripts/smoke.mjs  # 期望 SMOKE PASS
# 冒烟会留下一个 smoke-*@test.local 用户并消耗 1 次邀请码，可按需清理：
# DELETE FROM users WHERE email LIKE 'smoke-%@test.local';
# UPDATE invite_codes SET used_count = GREATEST(used_count-1,0) WHERE code='DEV-2fe79387';
```

若改了 `db/schema.sql`：`export $(grep DATABASE_URL .env.local) && node scripts/migrate.mjs`（幂等）。

## 发新邀请码

```bash
cd ~/bd-app && export $(grep DATABASE_URL .env.local)
node scripts/seed-invite.mjs <CODE> <max_uses>
```

## 首次部署完整步骤（已执行，供重建参考）

1. 上传解包到 `~/bd-app`，写 `.env.local`（新随机 `JWT_SECRET`：`openssl rand -hex 32`）。
2. `npm ci && node scripts/migrate.mjs && node scripts/seed-invite.mjs BD-LAUNCH 20 && npm run build`。
3. `pm2 start ./node_modules/next/dist/bin/next --name bd-app -- start -p 3011 && pm2 save`。
4. 写 nginx `sites-available/bd`（见上）+ `conf.d/bd-limit.conf`，`ln -s` 启用，`nginx -t && systemctl reload nginx`。
5. GoDaddy 加 A 记录 `bd → 43.160.214.195`。
6. `sudo certbot --nginx -d bd.cxodex.com --non-interactive --agree-tos`。
7. 验收：HTTP 301→HTTPS、`Set-Cookie` 含 `Secure`、`SMOKE_BASE=https://bd.cxodex.com` 冒烟 PASS，随后清理冒烟数据。

## 已知注意事项

- AI 生成（候选/序列/跟进）单次 1–3 分钟是正常的（GLM-5.2 推理模型），前端有 busy 提示，nginx 已放宽到 300s。
- 服务器 nginx reload 时的 `protocol options redefined` warning 是既有站点的历史问题，与 bd 无关。
- Vercel 备份部署暂未做（Neon/GLM 均可直连 Vercel，如需可后续加）。
