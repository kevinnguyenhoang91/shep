#!/usr/bin/env bash
# PostToolUse hook: warns when translation files drift from the English reference.
# Advisory only — exits 0 regardless.

FILEPATH="$1"

# Only run on translation JSON files
case "$FILEPATH" in
  */translations/*.json) ;;
  *) exit 0 ;;
esac

TRANSLATIONS_DIR="$(cd "$(dirname "$0")/../.." && pwd)/translations"

# Use English web.json as reference
REF_FILE="$TRANSLATIONS_DIR/en/web.json"
if [ ! -f "$REF_FILE" ]; then
  exit 0
fi

REF_KEYS=$(grep -c '"' "$REF_FILE" 2>/dev/null || echo 0)

for lang_dir in "$TRANSLATIONS_DIR"/*/; do
  lang=$(basename "$lang_dir")
  [ "$lang" = "en" ] && continue

  LANG_FILE="$lang_dir/web.json"
  if [ -f "$LANG_FILE" ]; then
    LANG_KEYS=$(grep -c '"' "$LANG_FILE" 2>/dev/null || echo 0)
    if [ "$LANG_KEYS" -lt "$REF_KEYS" ]; then
      echo "WARNING: i18n drift — $lang/web.json has ~$LANG_KEYS keys vs en's ~$REF_KEYS"
    fi
  else
    echo "WARNING: i18n missing — $lang/web.json does not exist"
  fi
done

exit 0
