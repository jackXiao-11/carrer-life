#!/usr/bin/env bash
set -eu

# Career Life always deploys to the stable production alias.
# Preview deployment URLs with a random ID are for verification only.
project_root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
commit_message="${1:-Update Career Life}"

cd "$project_root"
if command -v wrangler >/dev/null 2>&1; then
  wrangler pages deploy . --project-name career-life --branch main --commit-message "$commit_message" --commit-dirty=true
else
  npx wrangler pages deploy . --project-name career-life --branch main --commit-message "$commit_message" --commit-dirty=true
fi
