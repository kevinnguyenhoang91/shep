#!/usr/bin/env bash
# PostToolUse hook: warns when an edit introduces cross-layer import violations.
# Advisory only — exits 0 regardless.

FILEPATH="$1"

# Only check TypeScript files in src/ or packages/core/src/
case "$FILEPATH" in
  */packages/core/src/*.ts|*/src/presentation/*.ts|*/src/presentation/*.tsx) ;;
  *) exit 0 ;;
esac

# Determine which layer the file belongs to
LAYER=""
case "$FILEPATH" in
  */packages/core/src/domain/*) LAYER="domain" ;;
  */packages/core/src/application/*) LAYER="application" ;;
  */packages/core/src/infrastructure/*) LAYER="infrastructure" ;;
  */src/presentation/*) LAYER="presentation" ;;
  *) exit 0 ;;
esac

# Check for violations based on layer
check_imports() {
  local file="$1"
  local forbidden_pattern="$2"
  local message="$3"

  if grep -qE "$forbidden_pattern" "$file" 2>/dev/null; then
    echo "WARNING: Architecture violation in $file"
    echo "  $message"
    grep -nE "$forbidden_pattern" "$file" | head -5 | sed 's/^/  /'
  fi
}

case "$LAYER" in
  domain)
    check_imports "$FILEPATH" "from.*infrastructure/" "Domain layer must not import from infrastructure"
    check_imports "$FILEPATH" "from.*application/" "Domain layer must not import from application"
    check_imports "$FILEPATH" "from.*presentation/" "Domain layer must not import from presentation"
    ;;
  application)
    check_imports "$FILEPATH" "from.*infrastructure/" "Application layer must not import from infrastructure"
    check_imports "$FILEPATH" "from.*presentation/" "Application layer must not import from presentation"
    ;;
  presentation)
    check_imports "$FILEPATH" "from.*packages/core/src/infrastructure/" "Presentation must not import directly from infrastructure"
    ;;
esac

exit 0
