# Pruebas de Faro de Ámbar

Copias de los scripts con los que se probó cada versión (v0.6 a v1.5). Están guardados aquí para que
el proyecto tenga **todo su código**; se escribieron para la máquina donde se desarrolló el juego.

| Archivo | Para qué sirve |
| --- | --- |
| `sim.cjs` | Carga la lógica del juego (sin gráficos) en Node para simular partidas. |
| `helpers.cjs` | Ayudas para Chromium: archivos locales del juego. |
| `test-vXX*.cjs` | Pruebas de cada versión (las de `-sim` son de lógica; las demás, en Chromium). |
| `soak15.cjs` | Partidas largas con chequeos automáticos cada segundo (v1.5). |
| `duel-diff.cjs` | Equilibrio: un piloto de nivel medio contra los bots en cada dificultad. |
| `camp-*.cjs` | Campaña: el piloto juega las misiones. |
| `fill-prd*.py` | Rellenan el PRD de cada versión con los resultados reales. |

Cómo correrlas (desde esta carpeta):

```bash
npm install three@0.128.0 --prefix three   # three.js para las pruebas en Chromium
node faro/build.mjs                          # (desde la raíz) genera faro/faro.html
node test-v15-sim.cjs                        # lógica
node test-v15.cjs                            # Chromium (Playwright con Chromium instalado)
```

Las pruebas de Chromium corren sin tarjeta gráfica: los cuadros por segundo que miden sirven solo para
comparar versiones entre sí, no para saber cómo va en un iPad.
