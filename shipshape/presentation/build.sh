#!/usr/bin/env bash
# Build Reveal.js slides from .adoc sources
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADOC_CMD="asciidoctor-revealjs"

# Use Homebrew gem path if not on PATH
if ! command -v "$ADOC_CMD" &>/dev/null; then
  ADOC_CMD="/opt/homebrew/lib/ruby/gems/4.0.0/bin/asciidoctor-revealjs"
fi

for f in "$SCRIPT_DIR"/*.adoc; do
  [ -f "$f" ] || continue
  echo "Building $(basename "$f")..."
  "$ADOC_CMD" "$f"
done

echo "Done. Open the .html file(s) in a browser."
