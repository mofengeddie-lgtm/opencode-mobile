# Estudio para la convocatoria · Make-up Science Test (4 dic 2026)

Paquete de estudio bilingüe (español / inglés) de **Geología** y **La Célula**, 7.º grado.
*Bilingual study pack (Spanish / English) for Geology and The Cell, 7th grade.*

| # | Archivo · File | Qué es · What it is |
|---|---|---|
| 01 | `01-PRD-plan-del-material.pdf` | PRD: diagnóstico, objetivos, alcance y entregables · *requirements* |
| 02 | `02-plan-de-estudio-por-dias.pdf` | Plan día por día, 26 nov – 4 dic · *day-by-day plan* |
| 03 | `03-presentacion-diapositivas.pdf` | Presentación de 39 diapositivas · *slides* |
| 04 | `04-PDF-de-estudio-teoria.pdf` | Toda la teoría con diagramas · *full theory* |
| 05 | `05-resumen-examenes-pasados.pdf` | Resumen de los temas + cada pregunta de los exámenes pasados · *summary + every past-test item* |
| 06 | `06-practica-examen.pdf` | 2 exámenes de práctica con clave · *2 practice tests with key* |
| 07 | `07-guia-de-estudio.pdf` | Método, tarjetas, plantillas, videos de YouTube · *study guide* |
| 08 | `08-video-repaso.mp4` | Video de repaso de 16 min (sin voz) · *16-min review video (no voice)* |
| ★ | `app-entender.html` | **App «Entender»** (Fase 1 web de los documentos maestros y la Biblia Maestra): Sistema de Entender en 5 pasos con imagen tocable (diagrama, proceso, mapa mental, comparación, línea de tiempo, ejemplo), FSRS-6 con 2 botones y gestos, tutor Feynman con chips, Solo lo difícil / Solo mis fallos, retos «¿Quién soy?», modo TDAH, voz primero, letra fácil de leer, Claro / Oscuro, Subir y Entender, recordatorios en Google Calendar, Modo Pánico y simulacro con tachado y «Hoy sacarías» ([abrir](https://claude.ai/artifact/DWHg9mvRsX87YFjpJPUUwF)) |
| ★ | `resumen-interactivo.html` | Resumen interactivo para el celular: diagnóstico, temas, examen pasado con modo práctica y tarjetas · *interactive summary* ([abrir](https://claude.ai/artifact/2zbCJnWytaoMLAtBFS9KUs)) |

**Orden sugerido · Suggested order**: 01 → 02 → (04 + 03) → 05 → 07 + 08 → 06.

## Regenerar · Rebuild

Los archivos fuente están en `src/` (Markdown + SVG). Requiere Python 3 (`pip install markdown`), Node con Playwright y ffmpeg.

```bash
src/build.sh          # todos los PDF
src/build.sh video    # PDF + video MP4
```
