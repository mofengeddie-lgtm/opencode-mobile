# Faro de Ámbar · prototipo web

Juego de estrategia en tiempo real sobre un mapa de hexágonos, hecho para el navegador.
Funciona en iPad, celular y computadora (Safari o Chrome), sin instalar nada. Es el banco de
pruebas de las reglas del PRD 1.5 antes de llevarlas a Roblox Studio.

Empiezas con tu Núcleo, una Granja y un Constructor: entrena más, levanta tu base, conquista
islas y mantén el **Faro** (un 50 % más de monedas). Los rivales son bots que construyen,
mejoran, capturan, cruzan el mar y atacan.

**Versión actual:** 0.6 · PRD y PDF en `docs/prd/`.

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
| Construir | Elige edificio → toca casilla → «Construir» | Igual; R gira, Enter confirma |
| Mejorar | Toca un edificio terminado → «Mejorar» | Igual |
| Capturar | Lleva infantería junto a una Bandera o al Faro | Igual |
| Pausa / salir | Botón de pausa → «Salir al menú» (la partida queda guardada) | Esc o P |

**Ganar:** destruye todos los Núcleos enemigos (en «Rey del Faro», también manteniendo el Faro
3 minutos). **Perder:** si cae tu Núcleo.

## Novedades de la v0.6

- **Ritmo más rápido:** cada imperio empieza con 1 Constructor y los bots atacan antes (primera
  oleada hacia el minuto 4-5 en Normal).
- **Modo fluido para iPad:** gráficos «Automática» (baja la calidad sola si el iPad no llega a 40
  cuadros por segundo), «Alta calidad» y «Más fluido», y un contador de cuadros por segundo.
- **15 modelos más con Blender:** Cuartel, Fábrica, Puerto, Casa, las cinco energías, Submarino,
  Apache Guardián, Camión antiaéreo, Torreta chica, Puesto avanzado y Enfermería 1-3.
- **Efectos y sonidos:** explosiones con fuego, humo y restos, fogonazos, estelas, chispas,
  salpicaduras, humo en edificios dañados y sonidos sintetizados nuevos.

## Contenido de la v0.5

- **Constructores:** las obras quedan «En construcción» hasta que un Constructor, un Ingeniero
  (el doble de rápido) o un Barco constructor (obras de mar) las termina.
- **Niveles 1-3** en todos los edificios (Casa hasta 4). Núcleo con láser en todos los niveles y
  doble láser en el 3; la Cúpula se compra con el Núcleo en nivel 3 y, en su nivel 3, da escudo a
  tus tropas. Torreta con 1 minigun en nivel 2 y 2 en nivel 3. Enfermería: clínica, mini hospital
  y hospital grande.
- **Cinco energías:** Solar, Eólica, Hidráulica, Mareomotriz y Undimotriz, cada una en su lugar.
- **Lugares de recursos:** Granjas en tierra fértil, Minas en vetas de oro, Bombas en petróleo de
  tierra y Plataformas en petróleo del mar (sin aviso de territorio). Cada edificio tiene límite.
- **20 unidades** y **AIR DEFENSE**. 5 mapas: Archipiélago Ámbar, Mar abierto, Continente,
  Bahía Gris y Arrecife Doble.
- **Vestíbulo:** PLAY, CAMBIAR modo, Personalizado, Tutorial, Tus números, Pase de 40 niveles,
  misiones, premio diario, códigos, Tienda (apariencias y cofres) e Inventario.
- **Volver a la partida:** salir al menú la deja en pausa y se guarda sola cada 15 s.
- **Modo creador** (solo para la cuenta dueña del juego): monedas y energía infinitas.
- **Modelos 3D hechos con Blender** (`blender/`), incluido el skin Brigada Tóxica, y luz de
  ambiente con un cielo de [Poly Haven](https://polyhaven.com) (CC0, «Kloofendal 48d Partly
  Cloudy», Greg Zaal).

## Editar el juego

El código está en `src/` y se une en un solo archivo:

```bash
node faro/build.mjs                                   # genera faro/faro.html
node faro/docs/pdf.cjs faro/docs/prd/PRD_web_v0.5.html  # PDF del PRD (requiere Playwright)
python faro/blender/generate_models.py faro/assets/models  # modelos 3D (requiere el módulo bpy)
```

| Archivo | Qué contiene |
| --- | --- |
| `src/js/00-config.js` | Costos, niveles, energías, límites, unidades, modos y dificultad |
| `src/js/02-map.js` | Generación de islas, lugares de recursos, el Faro y las Banderas |
| `src/js/03-models.js` | Carga de los modelos GLB, aspectos y luz de ambiente |
| `src/js/04-world.js` | Reglas: obras, mejoras, economía, combate, captura, victoria |
| `src/js/045-save.js` | Guardar y cargar la partida |
| `src/js/05-ai.js` | Comportamiento de los bots |
| `src/js/06-render.js` | Gráficos, Cúpulas, minimapa, cámara y calidad |
| `src/js/061-fx.js` | Partículas: explosiones, humo, chispas, estelas y agua |
| `src/js/07-input.js` | Controles táctiles, ratón y teclado |
| `src/js/08-ui.js` | Barra superior, paneles, avisos y sonido |
| `src/js/085-meta.js` | Vestíbulo, progresión, tienda, final de partida y modo creador |
| `blender/` | Generador de modelos 3D en Python para Blender |
| `src/index.template.html` | Estructura y estilos de la interfaz |

Cada versión empieza con su PRD y termina con su PDF (ver `AGENTS.md`).

Usa [three.js](https://threejs.org) r128 desde cdnjs y su cargador GLTF desde jsDelivr.
