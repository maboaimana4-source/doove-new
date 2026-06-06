#!/usr/bin/env bash
# Update the Homebrew Cask formula for Doove after a release publishes.
#
# Downloads the just-published DMGs from the GitHub release, computes
# their SHA256s, renders `doove.rb.template` with the version + hashes
# substituted, and pushes the result to the
# `taoufikhicham23-stack/homebrew-doove` tap repo so Mac users get the new
# version on their next `brew upgrade` (or `brew install --cask`).
#
# Skips silently when HOMEBREW_TAP_TOKEN is unset so the release
# workflow stays green even when the Homebrew tap isn't configured
# yet. See HOMEBREW_TAP_SETUP.md for the one-time bootstrap.
#
# Inputs (env vars):
#   TAG                 — release tag (e.g. v1.2.3)
#   GITHUB_TOKEN        — token used by `gh release download` to fetch
#                         the DMGs (the workflow's default GITHUB_TOKEN
#                         is fine; it has read access to releases on
#                         the same repo)
#   HOMEBREW_TAP_TOKEN  — PAT with `repo` scope on the tap repo. When
#                         unset, the script no-ops with a notice. Set
#                         it as a repository secret in the doove repo.
#   TAP_REPO            — owner/repo for the tap (default
#                         "taoufikhicham23-stack/homebrew-doove"). Override
#                         only if forking the tap location.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

: "${TAG:?TAG is required (e.g. v1.2.3)}"
TAP_REPO="${TAP_REPO:-taoufikhicham23-stack/homebrew-doove}"

if [[ -z "${HOMEBREW_TAP_TOKEN:-}" ]]; then
  echo "::notice::HOMEBREW_TAP_TOKEN not set — skipping Homebrew Cask publish."
  echo "::notice::To enable: see scripts/release/HOMEBREW_TAP_SETUP.md"
  exit 0
fi

version="${TAG#v}"
arm_dmg="doove_${version}_aarch64.dmg"
intel_dmg="doove_${version}_x64.dmg"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

echo "Fetching $arm_dmg and $intel_dmg from release $TAG…"
# `gh release download` uses GITHUB_TOKEN automatically. We download
# from the live release rather than reusing CI artifacts because the
# hashes we ship in the formula MUST match what users actually
# download — proving byte-equality via the release URL is the only way
# to be sure.
gh release download "$TAG" \
  --repo "$GITHUB_REPOSITORY" \
  --pattern "$arm_dmg" \
  --pattern "$intel_dmg" \
  --dir "$work_dir"

[[ -f "$work_dir/$arm_dmg" ]] || {
  echo "::error::$arm_dmg not found in release $TAG"
  exit 1
}
[[ -f "$work_dir/$intel_dmg" ]] || {
  echo "::error::$intel_dmg not found in release $TAG"
  exit 1
}

arm_sha=$(shasum -a 256 "$work_dir/$arm_dmg" | awk '{print $1}')
intel_sha=$(shasum -a 256 "$work_dir/$intel_dmg" | awk '{print $1}')

echo "Computed SHA256s:"
echo "  arm64:  $arm_sha"
echo "  x86_64: $intel_sha"

# Clone the tap. Token-in-URL auth is fine for the duration of this
# job; the work_dir is wiped on EXIT.
tap_dir="$work_dir/tap"
git clone --depth 1 \
  "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/${TAP_REPO}.git" \
  "$tap_dir" \
  || {
    echo "::error::Failed to clone ${TAP_REPO} — does the repo exist and does the PAT have access?"
    echo "::error::See scripts/release/HOMEBREW_TAP_SETUP.md"
    exit 1
  }
mkdir -p "$tap_dir/Casks"

# Render the formula by substituting @-delimited placeholders.
template="$SCRIPT_DIR/doove.rb.template"
formula="$tap_dir/Casks/doove.rb"
sed -e "s|@VERSION@|${version}|g" \
    -e "s|@ARM_SHA256@|${arm_sha}|g" \
    -e "s|@INTEL_SHA256@|${intel_sha}|g" \
    "$template" > "$formula"

# Commit + push. Skip the commit if the formula is byte-identical to
# what's already in the tap (re-runs of the same release).
cd "$tap_dir"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add Casks/doove.rb
if git diff --quiet --cached; then
  echo "::notice::Cask formula is already at v${version}; nothing to commit."
  exit 0
fi
git commit -m "doove ${version}

Auto-published by ${GITHUB_REPOSITORY:-doove}'s release workflow.
Release: https://github.com/${GITHUB_REPOSITORY:-maboaimana4-source/doove-new}/releases/tag/${TAG}"
git push

echo "✓ Published doove ${version} to ${TAP_REPO}"
echo "Users can now run: brew install --cask maboaimana4-source/doove-new/doove"
