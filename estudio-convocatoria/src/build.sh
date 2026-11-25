#!/usr/bin/env bash
# Genera todos los PDF del paquete de estudio (y el video si se pasa "video").
set -euo pipefail
cd "$(dirname "$0")"

python3 build.py

node render.cjs \
  "build/01-prd.html::../01-PRD-plan-del-material.pdf::PRD · Plan del material" \
  "build/02-plan.html::../02-plan-de-estudio-por-dias.pdf::Plan de estudio por días · Study plan" \
  "build/04-estudio.html::../04-PDF-de-estudio-teoria.pdf::PDF de estudio · Study book" \
  "build/05-resumen.html::../05-resumen-examenes-pasados.pdf::Resumen detallado · Detailed summary" \
  "build/06-practica.html::../06-practica-examen.pdf::Examen de práctica · Practice test" \
  "build/07-guia.html::../07-guia-de-estudio.pdf::Guía de estudio · Study guide"

python3 slides.py
python3 web/build_web.py
python3 app/build_app.py
node video.cjs pdf

if [[ "${1:-}" == "video" ]]; then
  node video.cjs frames
  bash make-video.sh
fi
