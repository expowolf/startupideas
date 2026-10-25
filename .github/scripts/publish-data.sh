#!/usr/bin/env bash
# Publish directory $1 as a single fresh commit on the `data` branch (force-push, no history kept,
# so daily snapshots don't bloat the repo).
set -euo pipefail
cd "$1"
git init -q
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -q --orphan "publish-$GITHUB_RUN_ID"
git add -A
git commit -q -m "$2"
git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/data"
