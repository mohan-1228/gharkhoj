#!/usr/bin/env bash
# Commit the current feature branch, merge it into develop (--no-ff), and start the next branch.
# Usage: scripts/ship-phase.sh <commit-msg-file> <next-branch|->
set -euo pipefail
msg_file="$1"; next="${2:--}"
branch="$(git branch --show-current)"
[[ "$branch" == feature/* ]] || { echo "Not on a feature branch ($branch)"; exit 1; }
pnpm -s lint && pnpm -s typecheck && pnpm -s test >/dev/null
git add -A
git commit -q -F "$msg_file"
git checkout -q develop
git merge -q --no-ff "$branch" -m "$(head -1 "$msg_file" | cut -d: -f1 | cut -d'(' -f1): merge $branch into develop"
[[ "$next" != "-" ]] && git checkout -qb "$next"
git log --oneline -3
