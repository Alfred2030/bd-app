#!/bin/bash
# 发一个邀请码：./issue-code.sh [码面] [次数]，默认随机码面、1 次
cd "$(dirname "$0")/.." || exit 1
export $(grep DATABASE_URL .env.local)
node scripts/seed-invite.mjs "${1:-}" "${2:-1}"
