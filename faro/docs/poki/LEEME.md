# Faro de Ámbar en Poki (v1.9)

## Qué subir

1. Arma el paquete: `python3 faro/tools/poki/empaquetar.py` → `faro/poki/faro-poki.zip` (adentro va `index.html`, el juego entero).
2. En Poki for Developers: crea el juego y sube `faro-poki.zip`.
3. Ábrelo en el **Poki Inspector**: revisa la lista de QA, el registro de eventos (gameLoadingFinished, gameplayStart,
   gameplayStop, commercialBreak, rewardedBreak), las advertencias y el **modo celular** con el código QR
   (ahí se ve dónde queda la «píldora» de Poki).
4. Sube una de las dos miniaturas de esta carpeta (`miniatura-1.png` o `miniatura-2.png`, 1024×1024, sin texto)
   y los textos de descripción que ya tienes; después pide la prueba con jugadores.

## Qué hace el juego en Poki

- Carga todo desde su propio archivo (sin pedidos a otros sitios).
- Avisa a Poki: carga terminada, empieza a jugar (primer toque), deja de jugar (pausa, menú, final).
- Anuncio de Poki al empezar una partida y al salir de la pausa (Poki decide si lo muestra); mientras dura, sonido y controles quietos.
- «🎬 Doble premio» opcional al final de una partida: duplica XP y cristales una vez.
- Idioma: el de Poki (español si es «es»; si no, inglés) o el que elijas en Ajustes · Interfaz.
- Sin zona de creadores, sin pestaña de paquetes de cristales y sin menciones a Roblox.

## Lo que hay que probar en un aparato real

El iPad y los celulares (fluidez, toques, la píldora de Poki) solo los puedes probar tú: estas pruebas se hicieron en Chromium sin tarjeta gráfica.
