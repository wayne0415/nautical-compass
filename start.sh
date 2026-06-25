#!/bin/bash
# 一鍵啟動：後端 (8000) + 前端 (5173)
# 用法：在專案根目錄執行  ./start.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ 啟動後端 (FastAPI :8000) ..."
cd "$ROOT/backend"
if [ ! -d venv ]; then
  echo "  首次執行：建立虛擬環境並安裝依賴 ..."
  python3 -m venv venv
  ./venv/bin/pip install --quiet --upgrade pip
  ./venv/bin/pip install --quiet -r requirements.txt
fi
./venv/bin/uvicorn main:app --port 8000 &
BACKEND_PID=$!

echo "▶ 啟動前端 (Vite :5173) ..."
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "  首次執行：安裝前端依賴 ..."
  npm install
fi
npm run dev &
FRONTEND_PID=$!

# Ctrl+C 時一起關閉
trap "echo; echo '⏹ 關閉中 ...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

echo ""
echo "=============================================="
echo "  ✅ 啟動完成！打開瀏覽器： http://localhost:5173"
echo "  （按 Ctrl+C 可同時關閉前後端）"
echo "=============================================="
wait
