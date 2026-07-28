#!/usr/bin/env bash
set -euo pipefail
PPTX="$1"
OUTDIR="$2"
mkdir -p "$OUTDIR/png"
soffice --headless --convert-to pdf --outdir "$OUTDIR" "$PPTX"
PDF="$OUTDIR/$(basename "${PPTX%.pptx}.pdf")"
pdftoppm -png -r 180 "$PDF" "$OUTDIR/png/slide"
(
  cd "$OUTDIR/png"
  zip -9 -q "../slides.zip" ./*.png
)
