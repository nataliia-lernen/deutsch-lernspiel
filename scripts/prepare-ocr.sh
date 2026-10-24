#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/ocr
cp node_modules/tesseract.js/dist/worker.min.js public/ocr/
cp node_modules/tesseract.js/LICENSE.md public/ocr/TESSERACT-LICENSE.md
cp node_modules/tesseract.js-core/LICENSE public/ocr/CORE-LICENSE
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js public/ocr/
cp node_modules/tesseract.js-core/tesseract-core-lstm.wasm public/ocr/
for lang in deu ukr; do
  if [ ! -s "public/ocr/$lang.traineddata.gz" ]; then
    curl --fail --location --retry 2 "https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/$lang.traineddata.gz" -o "public/ocr/$lang.traineddata.gz.tmp"
    gzip -t "public/ocr/$lang.traineddata.gz.tmp"
    mv "public/ocr/$lang.traineddata.gz.tmp" "public/ocr/$lang.traineddata.gz"
  fi
done
