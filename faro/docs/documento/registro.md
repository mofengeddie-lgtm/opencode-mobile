# Registro de mejoras

Una entrada por versión, de la más nueva a la más vieja. **Cada versión nueva agrega aquí sus mejoras y partes importantes** antes de publicarse (regla del proyecto). El detalle completo de cada una está en su PRD (`docs/prd/`).

## v1.7 · 15-17 nov 2026

- Basada en tu «Dirección visual UI 0.4» y tu PRD Roblox v1.8 (guardados en `docs/roblox/`).
- Arsenal en el vestíbulo, «Conoce tu ejército»: todas las tropas y edificios con su miniatura real, buscador (sin importar tildes), filtros y ficha con precio, comunidad, tiempo, quién lo produce y contra qué es fuerte o débil.
- Equipo nuevo, primer lote de tu lista: Dron de ataque y Dron kamikaze (Helipuerto), Lanzacohetes múltiple (Fábrica, salva de 6 cohetes con daño en área) y Lancha misilera (Puerto). Modelos hechos con Blender. Los bots también los usan, en poca cantidad.
- Lanzador DF-17: el Lanzador de misiles cambia de nombre y estrena modelo según tu propuesta (mismos números).
- Lanzador nuclear móvil y opción «Arsenal estratégico» en Personalizado: un solo uso estratégico por jugador y partida, con preparación de 60 s, contador 1/1 → 0/1 y ventana «¿Usar ahora?» con «Confirmar uso único». El AIR DEFENSE de nivel 4 comparte ese uso. Sin la opción, todo sigue como antes.
- Barra de arriba como en tu UI 0.4: Monedas, Ingresos, Población, Energía y Partida.
- Barra de selección: nombre del grupo, «Vida del grupo · N %», orden actual, «Centrar» y «Quitar selección»; lista de pasajeros con nombre; plazas reservadas y «Comunidad al terminar» en la cola.
- Carga en 3 pasos (Recursos esenciales, Tu perfil, La partida) y perfil seguro: si lo guardado no se puede leer no se pisa (queda una copia) y se pregunta; un dato con el tipo equivocado se repara solo.
- Resultado con tres fichas (Duración, Territorio, Experiencia), «Revancha» y botones siempre a la vista.
- Ajustes: «Tamaño de la interfaz» (100 a 130 %) y «Reducir destellos».
- Sitio web del juego (`site/`) con capturas reales, el ejército, los mapas, la bitácora y el botón «Jugar».
- Pruebas: 14 de 14 aprobadas (N05, N07 y N08 se repitieron tras corregir errores de las pruebas). 114 pruebas anteriores bien, 30 partidas largas sin problemas (15 con «Arsenal estratégico»), 30 minutos de toques al azar sin errores, campaña y equilibrio iguales a la v1.6. Las pruebas encontraron un error real: en el celular vertical la pestaña «Inventario» quedaba fuera de la pantalla (arreglado).

## v1.6.1 · 16 nov 2026 (del usuario)

- Luz nueva: menos luz de relleno, colores más vivos y, en Alta calidad, sombras que se ven; en la pausa se puede volver a la luz clásica.
- Mar vivo: reflejos que se mueven y espuma en las orillas (2 dibujos más por cuadro).
- Áreas táctiles de 44 px que faltaban (avisos del borde, botones chicos).

## v1.6 · 13-15 nov 2026

- Pantalla de carga real: muestra cada fase (página, motor 3D, modelos «k de n», cielo, perfil) con barra; si algo falla lo dice en palabras simples y ofrece «Reintentar». Tope de 90 s por si se queda trabada.
- Error real arreglado: si el motor 3D no llegaba, la carga se quedaba en «Abriendo el juego…» sin aviso. Ahora se revisa justo después de pedirlo.
- Transiciones suaves en paneles, lista de construcción y ventanas; los botones se hunden un poco al tocarlos. Se apagan con «ahorro de batería» o si el iPad pide menos movimiento.
- Motivos junto a la acción: cada edificio y cada tropa que no se puede hacer dice por qué («Faltan 40 monedas», «Límite: 3 de 3», «Comunidad llena: construye Casas») y se actualiza en vivo.
- Alcance al colocar: al elegir una defensa se ve su círculo de alcance (más grande en terreno alto) en ámbar si se puede colocar y en rojo si no.
- Ventana «Acerca de»: versión, novedades y créditos (Blender, Poly Haven, CMU, three.js).
- Documentos: PRD Roblox v1.6 del usuario en PDF con sus dos capturas y el esquema de la interfaz; este documento completo con historia, archivos y todo el código, que se vuelve a generar en cada versión; pruebas automáticas guardadas en `faro/tests/`.
- Sin cambios de reglas, mapa ni equilibrio.
- Pruebas: carga, transiciones, motivos, alcance, «Acerca de», toques al azar, partidas largas y rendimiento aprobadas. Las pruebas viejas del navegador de la v0.7 a la v1.1 y tres tamaños de pantalla no llegaron a correr sobre la v1.6 (dos reinicios de la máquina de pruebas); pasaron sobre la v1.7, que contiene todo lo de la v1.6.

## v1.5 · 13 nov 2026

- Sin decoraciones de temporada (Calabazas e Invierno), a pedido del usuario. Las temporadas de la Liga y del Pase siguen.
- Portada nueva: JUGAR grande dentro de la imagen, modo con miniatura del mapa, iconos dibujados y fichas de números.
- Núcleo nuevo hecho con Blender: ciudadela con torre central que crece por nivel, color del jugador y aro de luz.
- Edificios con banderín del color del dueño, marcas de nivel, barra de mejora y aviso «zz» si están parados.
- Tropas con anillo de color, icono de tipo al alejar la cámara y ficha con daño, alcance, velocidad y contra qué son buenas.
- Caza de errores: 30 partidas largas con chequeos y 30 minutos de toques al azar. Arreglados: Dúos en Arrecife Doble, reparación sin camino, «Avanzar atacando» quieto, fila de jugadores partida y botón «¡A jugar!» escondido en el celular.
- Pruebas: 12 de 12 aprobadas; 96 pruebas anteriores bien.

## v1.4 · 12-13 nov 2026

- Patrullar, Mantener posición, tropas veteranas (1 a 3 estrellas), reparación sola y producción continua («Siempre»).
- 12 logros, Top jugadores y desafío semanal.
- Opciones para el iPad: ahorro de batería, colores para daltonismo (probados con simulación) y letra grande.
- Arreglo: la Barcaza va a buscar a los soldados que no pueden llegar a su orilla.
- Pruebas: 13 de 13 aprobadas.

## v1.3 · 10-11 nov 2026

- Los 29 puntos de la revisión «Bugs y mejoras» del usuario: «Avanzar atacando», abandono de la Liga, misil nuclear, Cúpula, agua, guardado más liviano, bots repartidos, panel compacto, botones de 44 px.
- Rangos de la Liga y tutorial de 3 pasos con Barcaza según el documento del usuario; copia del progreso para llevarlo a otro iPad.
- Pruebas: 14 de 14 aprobadas.

## v1.2 · 9-10 nov 2026

- Rueda de selección, mensajes a los aliados, tabla de la Liga, aspectos y planos en el Taller.
- Mapas nuevos (Mesetas de Cobre y Dunas Rojas) con miniaturas, tutorial que señala qué tocar y temporadas.
- Pruebas: 11 de 11 aprobadas.

## v1.1 · 9 nov 2026

- Alianzas, modo Dúos, Clasificatoria y órdenes a los aliados.
- Escudo antimisiles, música, modo espectador y resumen final con gráficas.

## v1.0 · 9 nov 2026

- Botón «Construir», comunidad de 240, radiación del misil, «Mejorar todo» y mejoras automáticas, salva de 3 misiles.
- Dificultad Difícil más fuerte, Aeropuerto, Caza y Bombardero, portada 3D.

## v0.9 · 8 nov 2026

- 30 mejoras pedidas: límites, población 180, Casas, escudos de 3 colores, construir de un toque, tierra fértil, daño a edificios.
- Ejército nuevo: Aeropuerto, cazas, bombardero, portaaviones, fragata, lancha, fábrica, médico, torreta 4, misil nuclear, helicópteros.
- Soldados realistas, AIR DEFENSE, Núcleo y portada; vuelta al suelo de colores lisos de la v0.6.

## v0.8 · 8 nov 2026

- Bots más listos (defensa, línea, fuego concentrado, hostigamiento, aliados).
- Interfaz: avisos en el borde, barra de producción, iconos y ficha del enemigo.
- Caminar y correr de los soldados con captura de movimiento de CMU (Blender).

## v0.7 · 8 nov 2026

- Campaña «La ruta del Faro» con 6 misiones y estrellas.
- Mejores controles: grupos 1-2-3, formación en línea, avanzar atacando.

## v0.6 · 8 nov 2026

- Ritmo más rápido (Constructor inicial, bots que atacan antes), modo fluido y calidad automática.
- 15 modelos nuevos con Blender, efectos y sonidos.

## v0.5 · 7 nov 2026

- Constructores, niveles 1 a 3, cinco energías, lugares de recursos y límites.
- Vestíbulo con progresión, tutorial, volver a la partida, guardado y modo creador.
- Primeros modelos 3D hechos con Blender y luz de ambiente de Poly Haven.

## v0.4 · 7 nov 2026

- Bots con personalidad; interfaz con alertas, marcador y fichas.

## v0.3 · 7 nov 2026

- Nace «Faro de Ámbar»: el Faro, Banderas, energía, escudos, Cúpula, construcción con vista previa y 6 modos.

## v0.2 · 7 nov 2026

- Transporte, Pozo petrolero, Batería antiaérea y Lanzamisiles.

## v0.1 · 6 nov 2026

- Primera versión jugable, entonces llamada «HEXBOX»: mapa de hexágonos, Núcleo, economía y bots.
