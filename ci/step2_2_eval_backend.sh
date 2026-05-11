#!/usr/bin/env bash
# step2_2 后端 CI：在 Windows PowerShell executor 下由 Git Bash 执行。
# 仓库根目录由脚本路径解析，避免 CI_PROJECT_DIR 反斜杠在 bash 中被当作转义（C:\Users → C:Users）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/step2_2/backend"
python -m venv .venv-ci
if [ -x .venv-ci/bin/python ]; then PY=.venv-ci/bin/python
elif [ -x .venv-ci/Scripts/python.exe ]; then PY=.venv-ci/Scripts/python.exe
else echo "venv python not found" >&2; exit 1; fi
"$PY" -m pip install -U pip wheel
"$PY" -m pip install -r requirements.txt
"$PY" -m compileall -q app
