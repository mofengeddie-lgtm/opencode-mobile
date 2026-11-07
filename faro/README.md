# Faro de Ámbar · prototipo web

Juego de estrategia en tiempo real sobre un mapa de hexágonos, hecho para el navegador.
Funciona en iPad, celular y computadora, sin instalar nada. Es el banco de pruebas de las
reglas del PRD 1.5 antes de llevarlas a Roblox Studio.

Construye tu base, conquista islas con infantería y mantén el **Faro**: quien lo controla gana
un 50 % más de monedas. Los rivales son bots que construyen, capturan, cruzan el mar y atacan.

**Versión actual:** 0.4 · PRD y PDF en `docs/prd/`.

## Cómo jugar

Abre `faro.html` en Safari o Chrome. En el iPad lo más cómodo es el enlace publicado.

| Acción | Toque (iPad / celular) | Computadora |
| --- | --- | --- |
| Mover el mapa | Arrastra con un dedo | Arrastra o WASD / flechas |
| Zoom y giro | Pellizca y gira con dos dedos | Rueda del ratón, Q y E |
| Seleccionar | Toca una tropa o un edificio | Clic |
| Todas las tropas de un tipo | Doble toque | Doble clic |
| Varias tropas | Botón «Recuadro» y arrastra | Mayús + arrastrar |
| Mover / atacar | Toca un destino o un enemigo | Clic izquierdo o derecho |
| Construir | Elige edificio → toca casilla → «Girar» → «Construir» | Igual; R gira, Enter confirma |
| Capturar | Lleva infantería junto a una Bandera o al Faro | Igual |
| Reparar | Ingeniero seleccionado + toca tu edificio dañado | Igual |
| Pausa | Botón de pausa | Esc o P |

**Ganar:** destruye todos los Núcleos enemigos (en «Rey del Faro», también manteniendo el Faro
3 minutos). **Perder:** si cae tu Núcleo.

## Contenido

- **6 modos:** Duelo, Todos contra todos, Equipos 2 vs 2, Gran batalla, Rey del Faro y Relámpago.
- **3 mapas:** Archipiélago (islas con puentes), Mar abierto (sin puentes) y Continente.
- **Recursos:** monedas y energía (la producen los Molinos).
- **Puntos de captura:** el Faro (+50 % de ingresos) y Banderas en las islas (+200/min y territorio).
- **Defensa del Núcleo:** escudo de emergencia automático al 25 %, Cúpula comprable y curación de
  las tropas cercanas.
- **Bots con personalidad:** Agresivo, Constructor, Almirante y Guardián del Faro. Combinan
  ejércitos, contrarrestan tus tropas, reúnen sus oleadas, se retiran heridos y te avisan antes
  de atacar.
- **Interfaz:** alertas con «Ver», mensajes de los bots, marcador (toca la lista de jugadores),
  desglose de monedas y energía (toca la barra superior), fichas de unidad (mantén pulsada una
  tarjeta), círculo de alcance e indicador de producción.
- **16 edificios:** Núcleo, Granja (mejorable a Pozo petrolero), Molino, Mina, Plataforma, Casa
  (niveles 1–4), Cuartel, Fábrica, Puerto, Helipuerto, Torreta, Batería antiaérea, Muro,
  Enfermería y Puesto avanzado.
- **14 unidades:** Ingeniero, Fusilero, Tirador, Lanzacohetes, Jeep, Tanque, Antiaéreo,
  Lanzamisiles, Lancha, Barco ingeniero, Barcaza, Destructor, Submarino y Helicóptero.

## Editar el juego

El código está en `src/` y se une en un solo archivo:

```bash
node faro/build.mjs                                   # genera faro/faro.html
node faro/docs/pdf.cjs faro/docs/prd/PRD_web_v0.3.html  # PDF del PRD (requiere Playwright)
```

| Archivo | Qué contiene |
| --- | --- |
| `src/js/00-config.js` | Costos, energía, vida, daño, capturas, escudos, modos y dificultad |
| `src/js/02-map.js` | Generación de islas, el Faro y las Banderas |
| `src/js/04-world.js` | Reglas: economía, combate, captura, territorio, victoria |
| `src/js/05-ai.js` | Comportamiento de los bots |
| `src/js/03-models.js` | Modelos 3D de edificios, tropas, Faro y Banderas |
| `src/js/06-render.js` | Gráficos, efectos, Cúpulas, minimapa y cámara |
| `src/js/07-input.js` | Controles táctiles, ratón y teclado |
| `src/js/08-ui.js` | Menús, paneles y sonido |
| `src/index.template.html` | Estructura y estilos de la interfaz |

Cada versión empieza con su PRD y termina con su PDF (ver `AGENTS.md`).

Usa [three.js](https://threejs.org) r128 desde cdnjs para los gráficos 3D.
