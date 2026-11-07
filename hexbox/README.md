# HEXBOX

Juego de estrategia en tiempo real sobre un mapa de hexágonos, hecho para el navegador.
Funciona en iPad, celular y computadora: no hay que instalar nada.

Construye tu base, expande tu territorio con ingenieros y destruye los Núcleos rivales
por tierra, mar y aire. Los rivales son bots que construyen, se expanden y atacan.

## Cómo jugar

Abre `hexbox.html` en Safari o Chrome. En el iPad lo más cómodo es usar el enlace publicado.

| Acción | Toque (iPad / celular) | Computadora |
| --- | --- | --- |
| Mover el mapa | Arrastra con un dedo | Arrastra o WASD / flechas |
| Zoom y giro | Pellizca y gira con dos dedos | Rueda del ratón, Q y E |
| Seleccionar | Toca una tropa o edificio | Clic |
| Todas las tropas de un tipo | Doble toque | Doble clic |
| Varias tropas | Botón «Recuadro» y arrastra | Mayús + arrastrar |
| Mover / atacar | Toca un destino o un enemigo | Clic izquierdo o derecho |
| Construir | Panel «Construir» y toca una casilla dorada | Igual, o tecla B |
| Pausa | Botón de pausa | Esc o P |

**Ganar:** destruye todos los Núcleos enemigos. **Perder:** si cae tu Núcleo.

## Contenido

- **Modos:** Duelo, Todos contra todos (4), Equipos 2 vs 2 y Gran batalla (6).
- **Mapas:** Archipiélago (islas con puentes), Mar abierto (sin puentes) y Continente.
- **Opciones:** dificultad de los bots, niebla de guerra y ritmo ×2.
- **13 edificios:** Núcleo, Granja, Mina, Plataforma, Casa, Cuartel, Fábrica, Puerto,
  Helipuerto, Torreta, Muro, Enfermería y Puesto avanzado.
- **12 unidades:** Ingeniero, Fusilero, Tirador, Lanzacohetes, Jeep, Tanque, Antiaéreo,
  Lancha, Barco ingeniero, Destructor, Submarino y Helicóptero.

## Editar el juego

El código está en `src/` y se une en un solo archivo:

```bash
node hexbox/build.mjs   # genera hexbox/hexbox.html
```

| Archivo | Qué contiene |
| --- | --- |
| `src/js/00-config.js` | Costos, vida, daño, ingresos, modos y dificultad |
| `src/js/02-map.js` | Generación de islas y terreno |
| `src/js/04-world.js` | Reglas: economía, combate, territorio, victoria |
| `src/js/05-ai.js` | Comportamiento de los bots |
| `src/js/03-models.js` | Modelos 3D de edificios y tropas |
| `src/js/06-render.js` | Gráficos, efectos, minimapa y cámara |
| `src/js/07-input.js` | Controles táctiles, ratón y teclado |
| `src/js/08-ui.js` | Menús, paneles y sonido |
| `src/index.template.html` | Estructura y estilos de la interfaz |

Para cambiar el balance (por ejemplo, que la Granja dé más monedas) edita `00-config.js`
y vuelve a ejecutar `node hexbox/build.mjs`.

Usa [three.js](https://threejs.org) r128 desde cdnjs para los gráficos 3D.
