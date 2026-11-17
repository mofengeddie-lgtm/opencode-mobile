# Faro de Ámbar · reglas de trabajo

Prototipo web del juego de estrategia **Faro de Ámbar** (nombre de trabajo). La ruta final es
Roblox Studio + Luau según el PRD 1.5 del usuario; esta versión web sirve para probar reglas y
controles en el iPad mientras tanto.

## Regla obligatoria: PRD y PDF en cada versión

Pedido explícito del usuario: **cada versión del juego empieza con un PRD y termina con su PDF.**

1. Antes de programar, escribe `docs/prd/PRD_web_vX.Y.html`: objetivo, alcance, reglas y números,
   controles, pruebas de aceptación (estado «Pendiente») y decisiones abiertas.
2. Envía al usuario el PDF del plan antes de implementar.
3. Al terminar, rellena el estado real de cada prueba (Aprobada / Fallida / No probada) con su
   evidencia y vuelve a generar el PDF: `node faro/docs/pdf.cjs faro/docs/prd/PRD_web_vX.Y.html`.
4. Nunca marques «Aprobada» una prueba que no se ejecutó. Las pruebas en navegador no sustituyen
   una prueba en un iPad físico: dilo.

## Regla obligatoria: documento completo en cada mejora (desde la v1.6)

Pedido explícito del usuario: **un documento completo del juego, desde la primera versión, con todos
los archivos y el código, que se amplía cada vez que hay una mejora.** Es aparte del PRD/PDF.

1. Agrega las mejoras y partes importantes de la versión en `docs/documento/registro.md`.
2. Vuelve a generarlo: `python3 faro/docs/documento/build_documento.py` y
   `node faro/docs/pdf.cjs faro/docs/documento/Documento_Completo_Faro_de_Ambar.html`.
3. Si agregas archivos de código o herramientas, súmalos a `CODE_FILES` en `build_documento.py`.
   Las pruebas van en `tests/` (el documento las lista).

## Sitio web del juego (desde la v1.7)

Pedido del usuario: un sitio web solo para su juego. Está en `site/`: `capture.cjs` saca capturas reales y las fichas
del juego (`img/`, `data.json`), y `python3 faro/site/build_site.py` arma `site/index.html` (página completa para
cualquier alojamiento) y `site/sitio_artifact.html` (la que se publica como artifact). En cada versión nueva: volver a
sacar las capturas, volver a armarlo y volver a publicarlo en el mismo enlace.

## Fuentes del usuario

- `docs/roblox/PRD_Faro_de_Ambar_v1_6.md` (13 nov 2026): PRD y plan de inicio para Roblox escrito por
  el usuario (5 etapas). El desarrollo en Roblox empieza solo cuando el usuario lo indique.
  `docs/roblox/build_prd_roblox.py` arma su PDF con las capturas de `docs/img/`.

- `docs/roblox/PRD_Faro_de_Ambar_v1_8.md` (14 nov 2026): revisión del usuario que amplía el plan Roblox:
  auditoría del código Luau (R-01 a R-14), catálogo de 78 unidades y 32 edificios, arsenal estratégico
  (silo DF-5C y lanzador nuclear móvil de un solo uso), UI del arsenal y mejoras profesionales (P0–P2).
  Es documentación; nada de eso está aprobado como balance. Se guarda sin cambios.
- `docs/roblox/ui-0.4/` (14 nov 2026): las 14 pantallas de la «Dirección visual UI 0.4» del usuario
  (`ui04-02.jpg` … `ui04-15.jpg`) y sus dos propuestas de vehículos (`ref-nuclear-movil.jpg`, `ref-df-17.jpg`).
  Son la guía de aspecto de la interfaz web desde la v1.7: paneles azul noche, acento ámbar, celeste para
  la información y verde para lo que está bien. Las fotos de prensa de referencia no se guardan en el proyecto.

- `PRD_Faro_de_Ambar_v1_5.pdf` (6 nov 2026): PRD maestro para Roblox. Sus cifras marcadas como
  EJEMPLO no son precios aprobados.
- Las capturas de otros juegos son referencias de composición. No copies nombres, números, mapas
  ni arte de otros juegos.

## Código

- `src/js/*.js` se une con `node faro/build.mjs` en `faro/faro.html`.
- Balance en `src/js/00-config.js`; reglas en `04-world.js`; bots en `05-ai.js`.
- Interfaz en español, pensada para iPad horizontal; prueba también iPad vertical y celular.
