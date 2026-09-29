#!/bin/bash
# RockSort TestFlight 打包与提交脚本（Mac 版）
cd "$(dirname "$0")"
echo "=========================================================="
echo "  RockSort TestFlight 打包与提交脚本（Mac 版）"
echo "=========================================================="

if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装（nodejs.org）。"; exit 1
fi

echo "[1/4] 检查 EAS CLI..."
npx eas-cli --version >/dev/null 2>&1 || npm install -g eas-cli

echo "[2/4] 登录 Expo 账号..."
npx eas-cli whoami >/dev/null 2>&1 || npx eas-cli login

echo "[3/4] 云端构建 iOS 安装包（约 10-15 分钟）..."
npx eas-cli build --platform ios --profile production

echo "[4/4] 提交到 App Store Connect / TestFlight..."
npx eas-cli submit --platform ios --profile production

echo "=========================================================="
echo "  完成！构建已提交，请到 App Store Connect 查看 TestFlight。"
echo "=========================================================="
read -p "按回车退出..." dummy