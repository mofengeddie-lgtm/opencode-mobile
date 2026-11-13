# Faro de Ámbar · prototipo web

Juego de estrategia en tiempo real sobre un mapa de hexágonos, hecho para el navegador.
Funciona en iPad, celular y computadora (Safari o Chrome), sin instalar nada. Es el banco de
pruebas de las reglas del PRD 1.5 antes de llevarlas a Roblox Studio.

Empiezas con tu Núcleo, una Granja y un Constructor: entrena más, levanta tu base, conquista
islas y mantén el **Faro** (un 50 % más de monedas). Los rivales son bots que construyen,
mejoran, capturan, cruzan el mar y atacan.

**Versión actual:** 1.5 · PRD y PDF en `docs/prd/`.

## Cómo jugar

Abre `faro.html` en Safari o Chrome. En el iPad lo más cómodo es el enlace publicado.

| Acción | Toque (iPad / celular) | Computadora |
| --- | --- | --- |
| Mover el mapa | Arrastra con un dedo | Arrastra o WASD / flechas |
| Zoom y giro | Pellizca y gira con dos dedos | Rueda del ratón, Q y E |
| Seleccionar | Toca una tropa o un edificio | Clic |
| Todas las tropas de un tipo | Doble toque | Doble clic |
| Varias tropas | Botón «Recuadro» y arrastra | Mayús + arrastrar |
| Rueda de selección | Mantén pulsado el mapa y elige (Tierra, Mar, Aire, Todo, Constructores, grupos) | Tab |
| Patrullar / mantener posición | Botones «Patrullar» (y luego toca el otro punto) y «Mantener posición» en el panel de tropas | Igual |
| Grupos 1, 2 y 3 | «Guardar en 1/2/3» y botones 1-2-3 junto al minimapa (dos toques: ir) | Número elige; Ctrl, Cmd o Mayús + número guarda |
| Avanzar atacando | Botón en el panel de tropas y luego toca el destino | F y clic |
| Constructores | Botón junto al minimapa (primero los que no trabajan) | C |
| Mover / atacar | Toca un destino o un enemigo | Clic izquierdo o derecho |
| Construir | Elige edificio → toca una casilla dorada → «Construir» (puedes poner varias seguidas) → «Terminar» | Igual; R gira, Enter construye |
| Mejorar | Toca un edificio terminado → «Mejorar» | Igual |
| Capturar | Lleva infantería junto a una Bandera o al Faro | Igual |
| Pausa / salir | Botón de pausa → «Salir al menú» (la partida queda guardada) | Esc o P |

**Ganar:** destruye todos los Núcleos enemigos (en «Rey del Faro», también manteniendo el Faro
3 minutos). **Perder:** si cae tu Núcleo.

## Novedades de la v1.5

- **Sin decoraciones de temporada:** ya no hay calabazas ni nieve por la fecha. Las temporadas de la Liga y del Pase siguen.
- **Portada nueva:** la imagen grande con el botón JUGAR adentro, el modo con la miniatura del mapa, iconos dibujados y tus números en fichas.
- **Núcleo nuevo (Blender):** una ciudadela con una torre central que crece en cada nivel, franjas y techos del color del jugador y un aro de luz que gira alrededor del cristal. El rayo del cielo tiene el color del jugador.
- **Edificios:** banderín del color del dueño, marcas doradas de nivel, barra celeste mientras se mejoran y aviso «zz» si un edificio que entrena se queda sin cola.
- **Fichas:** la cola dice cuánto falta y cada tropa tiene su «×» para quitarla (devuelve el dinero); lo que cambia al mejorar se ve siempre; las tarjetas de tropas ya no se cortan.
- **Tropas:** anillo del color del jugador debajo de cada una, icono de su tipo al alejar la cámara, ficha con vida, daño, alcance, velocidad y contra qué es fuerte o débil; con varias elegidas, tocar un tipo deja solo esas.
- **Errores arreglados (caza de errores):**
  - Dúos en el mapa Arrecife Doble no se podía empezar.
  - Un Constructor o Ingeniero mandado a reparar un edificio rodeado se quedaba esperando para siempre.
  - «Avanzar atacando» podía quedar quieto viendo enemigos al otro lado del agua.
  - La fila de jugadores de arriba se partía en dos líneas en el iPad.

## Novedades de la v1.4

- **Mandar mejor a tu ejército:**
  - **Patrullar:** van y vuelven entre dos puntos, peleando en el camino.
  - **Mantener posición:** se quedan quietas y solo disparan a lo que tienen a tiro.
  - **Tropas veteranas:** 1, 2 y 3 estrellas con 3, 8 y 15 eliminaciones. Cada estrella da +10 % de vida y +8 % de daño. Los bots también las ganan.
  - **Reparación sola:** los Constructores e Ingenieros libres reparan lo dañado a 4 casillas. Se puede apagar.
  - **Producción continua:** el botón «Siempre» sigue entrenando la última tropa mientras alcance el dinero y la comunidad.
- **Más motivos para volver:**
  - **12 logros** con insignia y cristales; se ven en el Inventario.
  - **Top jugadores** (documento, pág. 20) con pestañas Liga 3 vs 3, Victorias e Islas tomadas. Tu fila siempre se ve. Los demás son comandantes bot.
  - **Desafío semanal:** mapa, semilla y regla fijos toda la semana. Cambia el lunes y la primera victoria da 150 cristales.
- **Para tu iPad** (en la pausa):
  - **Ahorro de batería:** unos 30 cuadros por segundo y menos partículas.
  - **Colores para daltonismo:** elegidos con simulación de los 3 tipos de daltonismo, con una forma por jugador en el minimapa.
  - **Letra grande.**
- **Arreglo:** si los soldados no pueden llegar a la orilla junto a la Barcaza (lejos de la costa o con la orilla ocupada por edificios), la Barcaza va a buscarlos. Antes esperaban para siempre.

## Novedades de la v1.3

Los 29 puntos de la revisión «Bugs y mejoras»:

- **Bugs arreglados:**
  - «Avanzar atacando» ya no se congela con enemigos inalcanzables.
  - Abandonar la Liga cuenta como derrota.
  - El misil nuclear no daña lo tuyo ni a tus aliados, y la Cúpula lo frena.
  - Ninguna tropa de tierra queda sobre el agua.
  - «Construye 12 edificios» cuenta obras terminadas.
  - Demoler devuelve la mejora en curso.
  - El primer objetivo, la fila «aliado» y los textos de la Casa y del Cuartel ya están bien.
- **Más fluido:**
  - El guardado es unas 6-8 veces más chico, se hace cada minuto y al pausar o cambiar de app.
  - Los bots piensan por turnos (nunca dos en el mismo paso).
- **Interfaz:**
  - Panel de selección compacto: los botones principales arriba y «Más detalles» para el resto.
  - En el celular el panel ya no tapa la barra de arriba, y en el iPad deja libre el centro.
  - Todos los botones del juego miden 44 × 44 px como mínimo.
- **Como el documento de juego v2:**
  - 6 rangos (Recluta, Cabo, Sargento, Capitán, Comandante y Almirante del Faro), solo en la Liga 3 vs 3 y desde el nivel 10.
  - Recién llegado a un rango, la primera derrota no te baja.
  - Temporadas de 2 meses: el pase vuelve a empezar y la Liga baja 1 rango.
  - Tutorial de 3 pasos con Puerto y Barcaza para tomar la isla del bot.
  - Muro a 30.
  - El modo «Relámpago» ahora se llama «Choque exprés».
- **Copia de tu progreso:** un código o un archivo para llevar tu nivel, cristales, aspectos y rango a otro iPad.

## Novedades de la v1.2

- **Rueda de selección:** mantén pulsado el mapa (o la tecla Tab) y elige Tierra, Mar, Aire, Todo,
  Constructores o un grupo; puedes soltar el dedo sobre la opción.
- **Mensajes:** ventana con pestañas Todos / Aliados y mensajes rápidos («¡Gracias!», «¡Bien hecho!»,
  «¡Cuidado!», «¡Ayuda!», «¡Ataquemos!»); los bots aliados contestan. Se abre desde el marcador o tocando
  los mensajes de la esquina.
- **Tabla de la Clasificatoria:** tú y 20 comandantes bot (marcados como bots), ordenados por puntos.
- **Colecciones nuevas:** «Frente 1940» y «Marea» (soldados, vehículos, barcos y Núcleo).
- **Planos, fragmentos y Taller:** un cofre da un aspecto, un plano o fragmentos; los repetidos dan
  fragmentos; en el Taller, plano + fragmentos = aspecto.
- **Mapas nuevos:** «Mesetas de Cobre» (desde una meseta se dispara y se ve 1 casilla más lejos) y
  «Dunas Rojas» (desierto con oasis). Todos los mapas muestran su miniatura al elegir.
- **Tutorial que señala:** un aro y un texto marcan qué tocar en cada paso; si el lugar está fuera de la
  pantalla o tapado por un panel, señala el punto en el minimapa.
- **Temporadas:** «Calabazas» (15 oct-5 nov) e «Invierno» (10 dic-6 ene, con nieve), solas según la fecha
  o elegidas en la pausa.
- **Toques más fáciles:** tocar el cuerpo o el techo de un edificio también lo elige.

## Novedades de la v1.1

- **Alianzas** en los modos de todos contra todos: desde el marcador, «Aliarse» con un rival (el bot acepta o
  no, y dice por qué) y «Romper». Los aliados no se atacan y comparten lo que ven; si solo quedan aliados, la
  alianza se rompe: gana uno solo.
- **Dúos:** 3 parejas (tú y un bot aliado), cada pareja en su zona del mapa.
- **Clasificatoria:** 3 vs 3 por puntos con 10 rangos (Bronce I a Ámbar); el panel «Rangos» del vestíbulo
  muestra tu rango, tus puntos y tus últimas partidas.
- **Órdenes a aliados:** «¡Ayuda!» y «¡Ataquemos!» en el marcador.
- **Escudo antimisiles:** además del misil nuclear, derriba misiles y cohetes enemigos a 3 casillas.
- **Música propia** generada por el juego (vestíbulo y batalla, más intensa en combate) con volumen en la pausa.
- **Espectador:** al perder, «Seguir mirando» hasta el final.
- **Resumen final** con gráficas de monedas por minuto y tropas de cada imperio.

## Novedades de la v1.0

- **Construir:** vuelve el botón «Construir» (tocar una casilla solo muestra la obra) y el constructor tiene
  que llegar y quedarse pegado a la obra para que avance; mientras trabaja, martilla.
- **Base grande:** comunidad hasta 240 (8 Casas). Con el Núcleo en nivel 3: «Mejorar todo» (un clic) y
  «Mejoras automáticas» hasta dejar todo al máximo, guardando una reserva de monedas.
- **Misil nuclear:** deja 1 minuto de radiación que quema a los enemigos de dentro (con cuenta regresiva), y
  «Lanzar los 3» dispara los tres AIR DEFENSE de nivel 4 a la vez (un Escudo antimisiles solo derriba uno).
- **Difícil de verdad:** más monedas, piensa y ataca antes, y tácticas propias (busca Constructores y
  economía, retira heridos antes, defensa antiaérea al ver aviones, mejora y usa el misil antes).
- **Aviones:** Caza, Bombardero y Aeropuerto rehechos en Blender; los aviones dan vueltas en el aire, se
  inclinan y dejan estela; fichas con misiles, bombas y si están ocultos, orden «Bombardear zona» y torre de
  control en el Aeropuerto.
- **Portada:** más grande, con cazas, Bombardero, Apache y Portaaviones, logo, versión y novedades.

## Novedades de la v0.9

- **Ejército nuevo:** Aeropuerto militar con Caza furtivo y Bombardero furtivo; Portaaviones, Fragata y
  Lancha de desembarco en el Puerto; Tanque ligero, Tanque pesado, Camión de misiles, Transporte blindado
  y Lanzacohetes en la Fábrica; Médico en el Cuartel. El Jeep y el Transporte llevan soldados.
- **Helicópteros:** el Helicóptero tiene ahora el equipo y el precio del Apache viejo (con artilleros en
  las puertas); el Apache cuesta 10 000 y es más fuerte (cañón, misiles y bengalas). Sin límite propio,
  vuelven solos a repararse al Helipuerto o al Aeropuerto. Se ve cuándo disparan y lanzan misiles.
- **Defensas:** 20 Torretas; la Torreta nivel 4 tiene 3 miniguns, más daño y tiro antiaéreo. La AIR
  DEFENSE fija el blanco con el radar, prioriza aeronaves y lanza ráfagas de 2 misiles, con ficha de
  radar. Nivel 4 (solo 3): misil nuclear carísimo con 3 minutos de recarga; el Escudo antimisiles lo derriba.
- **Reglas:** comunidad hasta 180 (y más por eliminar tropas y Núcleos), Casa nivel 2 = Apartamento
  (+20), 6 Helipuertos, cada edificio con su escudo, escudo de las tropas solo dentro de la Cúpula,
  barras de escudo en azul, amarillo y rojo, tarjeta «Qué mejoró» en cada mejora, tierra fértil más
  grande, construir de un toque y todas las tropas armadas dañan edificios.
- **Modelos y portada:** soldados más realistas (chaleco, mochila, brazos que sostienen el arma),
  Núcleo con banderas, Apartamento, aviones, barcos y vehículos nuevos hechos en Blender, y una portada
  con una escena 3D del juego.
- **Calidad:** «Más fluido» usa materiales más livianos y «Alta» se ve más nítida en pantallas Retina.
- **Suelo de la v0.6:** vuelven los colores lisos por terreno; se quitaron las texturas de la v0.8.

## Novedades de la v0.8

- **Interfaz:** suelo con texturas escaneadas de Poly Haven, flechas en el borde cuando atacan algo
  tuyo fuera de la pantalla, barra de producción (con los edificios parados en amarillo), iconos en
  los botones y ficha del enemigo (vida, nivel y qué usar contra él).
- **Bots más listos:** defensa en equipo con una Torreta del lado del ataque, se forman en línea antes
  de atacar, fuego concentrado en el enemigo más débil, hostigamiento a Granjas y Minas, aliados que
  atacan al mismo rival y se ayudan, y oleadas con todo el ejército pasados 15 minutos.
- **Soldados con movimiento real:** caminar y correr de la base de datos de captura de movimiento de
  CMU, procesados en Blender y aplicados a piernas con rodilla.

## Novedades de la v0.7

- **Campaña «La ruta del Faro»:** 6 misiones con historia, meta, progreso en pantalla y hasta 3
  estrellas cada una (Primera luz, Defender la costa, El Faro, Cruzar el mar, Asedio y La gran
  batalla). Cada misión se abre al terminar la anterior; premio de cristales la primera vez y por
  cada estrella nueva.
- **Mejores controles:** grupos 1-2-3, «Avanzar atacando», formación en bloque o en línea (de frente
  al destino), «Repetir» y «×5» en los edificios que entrenan, y botón Constructores.

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
node faro/docs/pdf.cjs faro/docs/prd/PRD_web_v0.7.html  # PDF del PRD (requiere Playwright)
python faro/blender/generate_models.py faro/assets/models  # modelos 3D (requiere el módulo bpy)
python faro/blender/cmu_gait.py <carpeta_bvh> faro/assets/anim/cmu_gait.json  # caminar y correr de CMU
```

| Archivo | Qué contiene |
| --- | --- |
| `src/js/00-config.js` | Costos, niveles, energías, límites, unidades, modos, dificultad y misiones |
| `src/js/02-map.js` | Generación de islas, lugares de recursos, el Faro y las Banderas |
| `src/js/03-models.js` | Carga de los modelos GLB, aspectos y luz de ambiente |
| `src/js/04-world.js` | Reglas: obras, mejoras, economía, combate, captura, victoria |
| `src/js/045-save.js` | Guardar y cargar la partida |
| `src/js/046-campaign.js` | Campaña: preparación de cada misión, metas, progreso y estrellas |
| `src/js/05-ai.js` | Comportamiento de los bots |
| `src/js/06-render.js` | Gráficos, Cúpulas, minimapa, cámara y calidad |
| `src/js/061-fx.js` | Partículas: explosiones, humo, chispas, estelas y agua |
| `src/js/07-input.js` | Controles táctiles, ratón y teclado |
| `src/js/08-ui.js` | Barra superior, paneles, avisos y sonido |
| `src/js/085-meta.js` | Vestíbulo, progresión, tienda, final de partida y modo creador |
| `blender/` | Generador de modelos 3D y ciclos de paso de CMU (`cmu_gait.py`) para Blender |
| `assets/anim/` | Ciclos de caminar y correr sacados de CMU |
| `src/index.template.html` | Estructura y estilos de la interfaz |

Cada versión empieza con su PRD y termina con su PDF (ver `AGENTS.md`).

Usa [three.js](https://threejs.org) r128 desde cdnjs y su cargador GLTF desde jsDelivr.

## Créditos

- Cielo de ambiente: [Poly Haven](https://polyhaven.com) (CC0).
- Captura de movimiento: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), conversión
  BVH de B. Hahne (archivos 02_01 y 35_17), de uso libre.
