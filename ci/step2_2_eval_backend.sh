#!/usr/bin/env bash
# step2_2 backend CI (Git Bash on Windows runner). Repo root from script path.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/step2_2/backend"
python -m venv .venv-ci
if [ -x .venv-ci/bin/python ]; then PY=.venv-ci/bin/python
elif [ -x .venv-ci/Scripts/python.exe ]; then PY=.venv-ci/Scripts/python.exe
else echo "venv python not found" >&2; exit 1; fi
"$PY" -m pip install -U pip wheel
"$PY" -m pip install -r requirements.txt
"$PY" -m compileall -q app
