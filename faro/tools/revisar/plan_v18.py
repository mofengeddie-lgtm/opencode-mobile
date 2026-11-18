"""Plan de la v1.8: todo lo que pidió el usuario en sus documentos, con su lugar en el juego.

Lo usan el programa revisor (revisar.py) y el PRD de la v1.8. Fuentes del usuario:
- docs/roblox/PRD_Faro_de_Ambar_v1_8.md (secciones 37-54: 78 tropas y 32 edificios; 55: DF-5C).
- docs/roblox/ui-0.4/ (14 pantallas y 2 vehículos: Lanzador nuclear móvil y DF-17).
- docs/roblox/Equipamiento_Militar_2.md (lista de equipo militar moderno).
Los números de las tropas y edificios nuevos son una propuesta para probar: el usuario decide el balance.
"""

# ---------------------------------------------------------------------------------------------------------------
# Nombre en el catálogo del usuario → clave en el juego. Las que no existen todavía se agregan en la v1.8.
# ---------------------------------------------------------------------------------------------------------------
USER_MAP = {
    # Infantería y personal
    'Constructor': 'builder', 'Ingeniero': 'engineer', 'Artillero': 'rifle', 'Escopetero': 'shotgun', 'Ranger': 'ranger',
    'Francotirador': 'sniper', 'Rompedor': 'breaker', 'Cazador': 'hunter', 'Cohetero': 'rocket', 'Explorador': 'scout',
    'Soldado': 'soldier', 'Médico de campaña': 'medic', 'Oficial de campo': 'officer', 'Operador de comunicaciones': 'radioman',
    'Zapador': 'sapper', 'Equipo de mortero': 'mortar', 'Paracaidista': 'paratrooper', 'Infante de marina': 'marine',
    # Blindados, artillería y apoyo terrestre
    'Tanque': 'tank', 'Camión antiaéreo': 'aa', 'Blindado ligero': 'armoredcar', 'Tanque ligero': 'lighttank',
    'Tanque pesado': 'heavytank', 'Transporte blindado de personal': 'apc', 'Vehículo de combate de infantería': 'ifv',
    'Camión de tropas': 'trooptruck', 'Ambulancia militar': 'ambulance', 'Vehículo de recuperación': 'recovery',
    'Camión de suministros': 'supplytruck', 'Camión cisterna militar': 'tanker', 'Vehículo de mando': 'commandveh',
    'Radar móvil': 'mobileradar', 'Obús autopropulsado': 'howitzer', 'Artillería remolcada': 'towedgun',
    'Lanzacohetes múltiple convencional': 'mlrs', 'Cazacarros': 'tankdestroyer', 'Transporte anfibio': 'amphib',
    'Vehículo lanzapuentes': 'bridgelayer', 'Vehículo de despeje': 'clearer', 'Topadora blindada': 'dozer',
    # Drones
    'Dron explorador': 'scoutdrone', 'Dron de carga': 'cargodrone', 'Dron de ataque': 'drone', 'Dron interceptor': 'interceptor',
    'Dron naval de superficie': 'navaldrone', 'Dron submarino': 'subdrone',
    # Helicópteros
    'Helicóptero': 'heli', 'Apache Guardián': 'apache', 'Helicóptero de transporte': 'transheli',
    'Helicóptero de rescate': 'rescueheli', 'Helicóptero de patrulla naval': 'navalheli',
    # Aviación de ala fija
    'Avión de combate': 'fighter', 'Avión de apoyo terrestre': 'attackjet', 'Bombardero convencional': 'heavybomber',
    'Avión de transporte militar': 'transportplane', 'Avión de vigilancia aérea': 'awacs', 'Avión de reabastecimiento': 'tankerplane',
    'Avión de apoyo electrónico': 'ewplane',
    # Flota naval
    'Lancha rápida': 'speedboat', 'Barco constructor': 'boatEng', 'Barcaza': 'barge', 'Destructor': 'destroyer', 'Submarino': 'sub',
    'Cañonera': 'gunboat', 'Acorazado': 'battleship', 'Patrullera costera': 'patrolboat', 'Corbeta': 'corvette',
    'Fragata de escolta': 'frigate', 'Crucero de mando': 'cruiser', 'Portaaviones': 'carrier', 'Buque de desembarco': 'landingship',
    'Buque logístico': 'logship', 'Buque hospital': 'hospitalship', 'Aerodeslizador militar': 'hovercraft', 'Dragaminas': 'minesweeper',
    'Buque minador': 'minelayer', 'Submarino de reconocimiento': 'reconsub',
    # Estratégico
    'Lanzador nuclear móvil · un misil': 'nukelauncher',
    # Infraestructura
    'Núcleo': 'core', 'Granja': 'farm', 'Molino': 'wind', 'Casa': 'house', 'Cuartel': 'barracks', 'Fábrica': 'factory', 'Puerto': 'harbor',
    'Helipuerto / Hangar de helicópteros': 'helipad', 'Muro': 'wall', 'Torreta': 'turret', 'Antiaéreo': 'aadef', 'Bomba de petróleo': 'pump',
    'Plataforma petrolera': 'rig', 'Corral de ganadería': 'corral', 'Mina de oro': 'mine', 'Hospital de campaña': 'hospital',
    'Taller de mantenimiento': 'workshop', 'Centro de investigación': 'research', 'Estación de radar': 'radarstation',
    'Aeropuerto militar': 'airport', 'Centro de drones': 'dronecenter', 'Astillero mayor': 'shipyard', 'Depósito logístico': 'depot',
    'Centro de mando avanzado': 'hq', 'Central de energía': 'powerplant', 'Búnker de guarnición': 'bunker', 'Puerta reforzada': 'gate',
    'Puente modular': 'bridge', 'Muelle logístico': 'dock', 'Torre de observación': 'watchtower', 'Batería de defensa costera': 'coastal',
    'Complejo estratégico / Silo': 'silo',
}
# Otros elementos de los documentos del usuario que no están en las tablas de las secciones 37-54.
EXTRA_USER = [
    ('Lanzador DF-17', 'launcher', 'UI 0.4 · pantalla 09 y referencia 2'),
    ('DF-5C (misil del Silo)', 'silo', 'PRD 1.8 · sección 55'),
]
# Tropas que ya estaban y suman el productor que pide el catálogo (se quedan también donde estaban).
PRODUCER_ADDS = {'drone': 'dronecenter', 'fpv': 'dronecenter', 'frigate': 'shipyard', 'carrier': 'shipyard'}
# Nombres que el usuario eligió antes y se aceptan aunque no sean iguales al catálogo.
NAME_ALIASES = {'Antiaéreo': ('AIR DEFENSE', 'nombre que elegiste en la v0.9')}
# Nombres del juego que cambian para coincidir con el catálogo del usuario (mismos números).
RENAMES = {'fighter': 'Avión de combate furtivo', 'medic': 'Médico de campaña', 'hospital': 'Hospital de campaña', 'frigate': 'Fragata de escolta', 'wind': 'Molino eólico',
           'apc': 'Transporte blindado de personal'}

# ---------------------------------------------------------------------------------------------------------------
# Tropas nuevas. w = arma (daño, recarga en s, alcance en casillas, proyectil); números propuestos para probar.
# ---------------------------------------------------------------------------------------------------------------
U = lambda **k: k
NEW_UNITS = [
    # ----- Infantería (Cuartel) -----
    U(key='scout', name='Explorador', fam='inf', prod='barracks', cost=250, energy=0, hp=140, speed=2.0, pop=1, build=4, w='8 · 0,8 s · 3 · bala',
      special='Ve 6 casillas y captura Banderas y el Faro un 50 % más rápido.', model='Soldado ligero con gorra, prismáticos y mochila chica.', src='PRD 1.8 · 38'),
    U(key='soldier', name='Soldado', fam='inf', prod='barracks', cost=300, energy=0, hp=220, speed=1.5, pop=1, build=4, w='13 · 0,7 s · 3 · bala',
      special='Combatiente básico y barato.', model='Soldado de bloques con casco y rifle compacto.', src='PRD 1.8 · 38 y Equipamiento (soldado)'),
    U(key='officer', name='Oficial de campo', fam='inf', prod='barracks', cost=1200, energy=0, hp=260, speed=1.5, pop=1, build=8, w='10 · 0,8 s · 3 · bala',
      special='Mando: las tropas propias a 2 casillas hacen un 15 % más de daño (no se suma con otro Oficial ni con un Vehículo de mando).', model='Uniforme con gorra de mando y tableta con el color del equipo.', src='PRD 1.8 · 39'),
    U(key='radioman', name='Operador de comunicaciones', fam='inf', prod='barracks', cost=900, energy=0, hp=200, speed=1.5, pop=1, build=7, w='8 · 0,8 s · 3 · bala',
      special='Ve 8 casillas y descubre submarinos, minas y unidades ocultas cerca.', model='Mochila de radio grande con antena y auriculares.', src='PRD 1.8 · 39'),
    U(key='sapper', name='Zapador', fam='inf', prod='barracks', cost=800, energy=0, hp=300, speed=1.5, pop=1, build=7, w='60 · 2,5 s · 1 · cargas (×3 a edificios, ×4 a muros)',
      special='Cargas explosivas contra muros y edificios; desactiva minas cercanas.', model='Casco con visor, equipo de trabajo y cargas a la espalda.', src='PRD 1.8 · 39 y Equipamiento (MICLIC)'),
    U(key='mortar', name='Equipo de mortero', fam='inf', prod='barracks', cost=1100, energy=0, hp=300, speed=1.1, pop=2, build=9, w='70 · 4 s · 6 · granada con daño en área',
      special='Tiro curvo de largo alcance con daño en área.', model='Dos soldados junto a un mortero sobre base redonda.', src='PRD 1.8 · 39 y Equipamiento (morteros)'),
    U(key='paratrooper', name='Paracaidista', fam='inf', prod='barracks', cost=900, energy=0, hp=300, speed=1.6, pop=1, build=8, w='20 · 0,6 s · 3 · bala',
      special='Si tienes Aeropuerto militar, sale en paracaídas sobre el punto de reunión (si lo ves). Los aviones de transporte lo lanzan donde quieras.', model='Soldado con mochila de paracaídas.', src='PRD 1.8 · 39'),
    U(key='marine', name='Infante de marina', fam='inf', prod='barracks', cost=800, energy=0, hp=320, speed=1.5, pop=1, build=7, w='18 · 0,6 s · 3 · bala',
      special='Anfibio: camina por el agua poco profunda de la costa.', model='Soldado con chaleco ancho y marcas navales.', src='PRD 1.8 · 39'),
    U(key='atguided', name='Equipo antitanque', fam='inf', prod='barracks', cost=1600, energy=0, hp=240, speed=1.2, pop=1, build=9, w='180 · 4 s · 6 · misil guiado (×2 a vehículos)',
      special='Misil guiado que cae sobre el techo de los tanques.', model='Soldado con lanzador grueso al hombro y mira.', src='Equipamiento (misiles portátiles)'),
    U(key='gunner', name='Ametrallador pesado', fam='inf', prod='barracks', cost=1000, energy=0, hp=340, speed=1.2, pop=1, build=8, w='9 · 0,12 s · 3 · ráfaga',
      special='Ametralladora rotativa: muchísimas balas contra infantería.', model='Soldado grande con ametralladora rotativa.', src='Equipamiento (minigun)'),
    U(key='antidrone', name='Soldado antidrones', fam='inf', prod='barracks', cost=700, energy=0, hp=220, speed=1.5, pop=1, build=6, w='40 · 0,8 s · 4 · inhibidor (×3 a drones)',
      special='Corta la señal de los drones: muy fuerte contra drones.', model='Soldado con fusil inhibidor de antenas.', src='Equipamiento (rifles antidrones)'),
    # ----- Tierra (Fábrica) -----
    U(key='robodog', name='Perro robot', fam='land', prod='factory', cost=1200, energy=5, hp=400, speed=2.4, pop=1, build=7, w='—',
      special='Patrulla: ve 7 casillas y descubre lo oculto. No pelea.', model='Robot de cuatro patas con cámara.', src='Equipamiento (perros robot)'),
    U(key='armoredcar', name='Blindado ligero', fam='land', prod='factory', cost=1900, energy=10, hp=1000, speed=2.4, pop=2, build=9, w='30 · 0,6 s · 3 · cañón automático',
      special='Rápido y con ruedas.', model='Carro de ruedas con torreta baja.', src='PRD 1.8 · 40'),
    U(key='ifv', name='Vehículo de combate de infantería', fam='land', prod='factory', cost=2800, energy=20, hp=1700, speed=1.8, pop=3, build=12, w='45 · 0,8 s · 4 · cañón',
      special='Lleva 4 soldados y pelea.', model='Orugas, torreta chica y portón trasero.', src='PRD 1.8 · 41'),
    U(key='trooptruck', name='Camión de tropas', fam='land', prod='factory', cost=1200, energy=5, hp=700, speed=2.2, pop=2, build=7, w='—',
      special='Lleva 8 soldados; poca protección.', model='Cabina militar y caja cubierta con lona.', src='PRD 1.8 · 41'),
    U(key='ambulance', name='Ambulancia militar', fam='land', prod='factory', cost=1500, energy=10, hp=800, speed=2.2, pop=2, build=8, w='—',
      special='Cura a la infantería a 2 casillas (6 % de su vida por segundo).', model='Caja cerrada clara con cruz y baliza.', src='PRD 1.8 · 41'),
    U(key='recovery', name='Vehículo de recuperación', fam='land', prod='factory', cost=2200, energy=15, hp=1800, speed=1.4, pop=2, build=10, w='—',
      special='Repara vehículos a 1 casilla (4 % por segundo).', model='Chasis pesado con grúa corta.', src='PRD 1.8 · 41'),
    U(key='supplytruck', name='Camión de suministros', fam='land', prod='factory', cost=1600, energy=10, hp=800, speed=2.0, pop=2, build=8, w='—',
      special='Suministros: las tropas propias a 2 casillas recargan un 20 % más rápido.', model='Camión de caja abierta con cajas.', src='PRD 1.8 · 41'),
    U(key='tanker', name='Camión cisterna militar', fam='land', prod='factory', cost=1500, energy=5, hp=900, speed=2.0, pop=2, build=8, w='—',
      special='Combustible: los vehículos propios a 2 casillas van un 20 % más rápido.', model='Cabina baja y depósito cilíndrico.', src='PRD 1.8 · 41'),
    U(key='commandveh', name='Vehículo de mando', fam='land', prod='factory', cost=3000, energy=20, hp=1600, speed=1.6, pop=3, build=12, w='14 · 0,4 s · 3 · ametralladora',
      special='Mando: +15 % de daño a las tropas propias a 3 casillas (no se suma con el Oficial).', model='Caja alta con dos antenas.', src='PRD 1.8 · 42'),
    U(key='mobileradar', name='Radar móvil', fam='land', prod='factory', cost=2400, energy=20, hp=900, speed=1.5, pop=2, build=10, w='—',
      special='Ve 10 casillas y descubre aviones furtivos y submarinos.', model='Camión con antena plana grande.', src='PRD 1.8 · 42'),
    U(key='howitzer', name='Obús autopropulsado', fam='land', prod='factory', cost=4600, energy=40, hp=1500, speed=0.9, pop=3, build=16, w='220 · 5 s · 8 · obús con daño en área',
      special='Artillería de muy largo alcance.', model='Orugas, torreta amplia y cañón largo.', src='PRD 1.8 · 42 y Equipamiento (artillería autopropulsada)'),
    U(key='towedgun', name='Artillería remolcada', fam='land', prod='factory', cost=2600, energy=10, hp=800, speed=0.7, pop=2, build=11, w='170 · 5 s · 7 · obús con daño en área',
      special='Barata y lenta.', model='Cañón sobre dos ruedas con base abierta.', src='PRD 1.8 · 42 y Equipamiento (M777)'),
    U(key='tankdestroyer', name='Cazacarros', fam='land', prod='factory', cost=3600, energy=30, hp=1900, speed=1.4, pop=3, build=14, w='200 · 2,6 s · 5 · obús (×1,8 a vehículos)',
      special='Especialista contra tanques.', model='Casco bajo y cañón dominante.', src='PRD 1.8 · 42'),
    U(key='amphib', name='Transporte anfibio', fam='land', prod='factory', cost=2400, energy=15, hp=1500, speed=1.8, pop=2, build=10, w='12 · 0,4 s · 3 · ametralladora',
      special='Anfibio: va por tierra y por agua poco profunda; lleva 6 soldados.', model='Casco ancho de proa redonda.', src='PRD 1.8 · 43 y Equipamiento (anfibios)'),
    U(key='bridgelayer', name='Vehículo lanzapuentes', fam='land', prod='factory', cost=2600, energy=20, hp=1600, speed=1.4, pop=2, build=10, w='—',
      special='«Tender puente»: pone un Puente modular en el agua poco profunda de al lado.', model='Orugas con dos tramos de puente plegados.', src='PRD 1.8 · 43'),
    U(key='clearer', name='Vehículo de despeje', fam='land', prod='factory', cost=2000, energy=15, hp=2000, speed=1.3, pop=2, build=9, w='90 · 2 s · 1 · rodillo (×2,5 a edificios)',
      special='Abre paso: rompe muros y obras, y desactiva minas.', model='Vehículo pesado con rodillo frontal.', src='PRD 1.8 · 43'),
    U(key='dozer', name='Topadora blindada', fam='land', prod='factory', cost=1800, energy=10, hp=2200, speed=1.3, pop=2, build=9, w='—',
      special='Construye y repara como un Ingeniero, con blindaje.', model='Orugas cortas, cabina protegida y pala.', src='PRD 1.8 · 43'),
    U(key='thermo', name='Lanzacohetes termobárico', fam='land', prod='factory', cost=5200, energy=45, hp=1300, speed=1.0, pop=3, build=18, w='60 · 10 s · 5 · salva de 8 con daño en área',
      special='Nube de fuego en un área: muy fuerte contra infantería.', model='Orugas con caja de 24 tubos.', src='Equipamiento (TOS-1A)'),
    # ----- Drones -----
    U(key='scoutdrone', name='Dron explorador', fam='drone', prod='helipad', cost=800, energy=5, hp=150, speed=3.2, pop=1, build=5, w='—',
      special='Ve 8 casillas desde el aire.', model='Cuadricóptero chico con cámara.', src='PRD 1.8 · 44'),
    U(key='cargodrone', name='Dron de carga', fam='drone', prod='dronecenter', cost=1200, energy=10, hp=250, speed=2.6, pop=1, build=6, w='—',
      special='Suministros desde el aire: +20 % de recarga a las tropas a 2 casillas.', model='Cuatro rotores y caja colgante.', src='PRD 1.8 · 44'),
    U(key='interceptor', name='Dron interceptor', fam='drone', prod='dronecenter', cost=1400, energy=10, hp=300, speed=3.6, pop=1, build=6, w='60 · 1 s · 3 · solo aire (×2 a drones)',
      special='Caza drones y helicópteros.', model='Ala en flecha y cuerpo chico.', src='PRD 1.8 · 44'),
    U(key='navaldrone', name='Dron naval de superficie', fam='sea', prod='harbor', cost=1000, energy=5, hp=400, speed=3.0, pop=1, build=6, w='—',
      special='Explora el mar: ve 7 casillas y descubre submarinos y minas.', model='Casco bajo de dos flotadores y mástil.', src='PRD 1.8 · 44'),
    U(key='subdrone', name='Dron submarino', fam='sea', prod='harbor', cost=1200, energy=5, hp=300, speed=2.0, pop=1, build=6, w='—',
      special='Va oculto bajo el agua y descubre submarinos y minas.', model='Cápsula pequeña con aletas.', src='PRD 1.8 · 44'),
    # ----- Helicópteros (Helipuerto) -----
    U(key='transheli', name='Helicóptero de transporte', fam='heli', prod='helipad', cost=5000, energy=40, hp=2000, speed=2.4, pop=3, build=14, w='—',
      special='Lleva 8 soldados y los baja en cualquier tierra.', model='Fuselaje ancho, puerta lateral y dos rotores.', src='PRD 1.8 · 45'),
    U(key='rescueheli', name='Helicóptero de rescate', fam='heli', prod='helipad', cost=4000, energy=30, hp=1600, speed=2.5, pop=3, build=12, w='—',
      special='Cura a la infantería y repara aeronaves a 2 casillas.', model='Cabina redonda, patines y cruz.', src='PRD 1.8 · 45'),
    U(key='navalheli', name='Helicóptero de patrulla naval', fam='heli', prod='helipad', cost=6000, energy=50, hp=2000, speed=2.3, pop=4, build=16, w='200 · 4 s · 3 · torpedo (×2 a submarinos)',
      special='Descubre submarinos y los ataca con torpedos.', model='Cuerpo medio con cúpula de sonar.', src='PRD 1.8 · 45 y Equipamiento (Seahawk)'),
    # ----- Aviación (Aeropuerto militar) -----
    U(key='attackjet', name='Avión de apoyo terrestre', fam='air', prod='airport', cost=7000, energy=60, hp=2600, speed=2.4, pop=4, build=20, w='40 · 0,25 s · 3 · cañón de 30 mm (×1,8 a vehículos)',
      special='Vuela bajo y destruye tanques.', model='Alas rectas anchas y dos motores atrás.', src='PRD 1.8 · 46 y Equipamiento (A-10)'),
    U(key='heavybomber', name='Bombardero convencional', fam='air', prod='airport', cost=11000, energy=100, hp=4200, speed=1.6, pop=6, build=30, w='900 · 7 s · 1 · bombas con daño en área',
      special='Bombardero pesado: destruye bases. Se ve en el radar.', model='Avión grande, alas largas y cuatro motores.', src='PRD 1.8 · 46 y Equipamiento (B-52, B-1B)'),
    U(key='transportplane', name='Avión de transporte militar', fam='air', prod='airport', cost=6000, energy=50, hp=3000, speed=2.0, pop=4, build=18, w='—',
      special='Lleva 10 soldados y los baja en cualquier tierra.', model='Fuselaje grande, ala alta y rampa.', src='PRD 1.8 · 46 y Equipamiento (C-17)'),
    U(key='awacs', name='Avión de vigilancia aérea', fam='air', prod='airport', cost=7500, energy=60, hp=2200, speed=1.8, pop=4, build=20, w='—',
      special='Ve 14 casillas y descubre aviones furtivos.', model='Avión con disco grande encima.', src='PRD 1.8 · 46'),
    U(key='tankerplane', name='Avión de reabastecimiento', fam='air', prod='airport', cost=6500, energy=50, hp=2600, speed=2.0, pop=4, build=18, w='—',
      special='Repara aeronaves propias a 3 casillas (3 % por segundo).', model='Fuselaje largo con pértiga trasera.', src='PRD 1.8 · 46'),
    U(key='ewplane', name='Avión de apoyo electrónico', fam='air', prod='airport', cost=8000, energy=70, hp=2400, speed=2.2, pop=4, build=22, w='300 · 8 s · 6 · misil antirradar (×2 a defensas)',
      special='Interferencia: las defensas enemigas a 4 casillas disparan un 40 % más lento.', model='Avión mediano con antenas.', src='PRD 1.8 · 46 y Equipamiento (HARM)'),
    U(key='gunship', name='Avión artillado', fam='air', prod='airport', cost=9500, energy=80, hp=3800, speed=1.4, pop=5, build=26, w='120 · 1,5 s · 5 · obús lateral con daño en área',
      special='Da vueltas sobre el blanco y dispara de costado.', model='Avión de carga con cañones al costado.', src='Equipamiento (AC-130)'),
    # ----- Flota (Puerto y Astillero mayor) -----
    U(key='gunboat', name='Cañonera', fam='sea', prod='harbor', cost=2200, energy=15, hp=1300, speed=2.0, pop=2, build=10, w='90 · 1,8 s · 4 · cañón',
      special='Apoyo naval barato contra la costa.', model='Casco compacto con cañón al frente.', src='PRD 1.8 · 47'),
    U(key='battleship', name='Acorazado', fam='sea', prod='harbor', cost=12000, energy=100, hp=7000, speed=0.9, pop=6, build=34, w='400 · 4 s · 7 · salva de 2 con daño en área',
      special='El buque más fuerte contra bases y barcos.', model='Casco ancho y tres torres grandes.', src='PRD 1.8 · 47'),
    U(key='patrolboat', name='Patrullera costera', fam='sea', prod='harbor', cost=1600, energy=10, hp=900, speed=2.6, pop=1, build=8, w='16 · 0,5 s · 3 · ametralladora',
      special='Vigila la costa: ve 7 casillas y descubre submarinos.', model='Casco estrecho y cabina alta.', src='PRD 1.8 · 48'),
    U(key='corvette', name='Corbeta', fam='sea', prod='harbor', cost=3200, energy=25, hp=2000, speed=2.0, pop=3, build=12, w='80 · 1,2 s · 5 · cañón de proa',
      special='Defensa de punto: derriba misiles y cohetes cerca.', model='Casco corto, puente central y cañón.', src='PRD 1.8 · 48 y Equipamiento (corbetas, Mk 45, Phalanx)'),
    U(key='cruiser', name='Crucero de mando', fam='sea', prod='shipyard', cost=9000, energy=80, hp=5200, speed=1.1, pop=5, build=28, w='260 · 3 s · 7 · misiles de lanzamiento vertical',
      special='Mando naval (+15 % de daño a barcos a 3 casillas) y derriba misiles cerca.', model='Casco amplio y mástil alto.', src='PRD 1.8 · 48 y Equipamiento (VLS, Aegis)'),
    U(key='landingship', name='Buque de desembarco', fam='sea', prod='shipyard', cost=4200, energy=30, hp=3200, speed=1.4, pop=4, build=16, w='—',
      special='Lleva 12 plazas (soldados y vehículos) y los baja en la costa.', model='Casco ancho y rampa frontal grande.', src='PRD 1.8 · 48 y Equipamiento (buques anfibios)'),
    U(key='logship', name='Buque logístico', fam='sea', prod='harbor', cost=3500, energy=20, hp=2600, speed=1.3, pop=3, build=14, w='—',
      special='Repara barcos a 3 casillas (2 % por segundo) y los hace recargar un 20 % más rápido.', model='Cubierta con contenedores y grúa.', src='PRD 1.8 · 48'),
    U(key='hospitalship', name='Buque hospital', fam='sea', prod='shipyard', cost=4000, energy=20, hp=3000, speed=1.2, pop=3, build=14, w='—',
      special='Repara barcos y cura a la infantería a 3 casillas.', model='Casco blanco con cruz.', src='PRD 1.8 · 49'),
    U(key='hovercraft', name='Aerodeslizador militar', fam='sea', prod='harbor', cost=2600, energy=20, hp=1400, speed=2.8, pop=2, build=10, w='—',
      special='Anfibio: va por agua y tierra de la costa; lleva 6 plazas (también vehículos).', model='Base con faldón y dos ventiladores.', src='PRD 1.8 · 49 y Equipamiento (aerodeslizadores)'),
    U(key='minesweeper', name='Dragaminas', fam='sea', prod='harbor', cost=2000, energy=15, hp=1400, speed=1.8, pop=2, build=10, w='120 · 1 s · 3 · solo minas',
      special='Descubre y destruye minas.', model='Casco compacto con brazo trasero.', src='PRD 1.8 · 49'),
    U(key='minelayer', name='Buque minador', fam='sea', prod='harbor', cost=2500, energy=20, hp=1500, speed=1.6, pop=2, build=10, w='—',
      special='«Sembrar mina»: deja una mina oculta (hasta 8). Explota con barcos enemigos.', model='Cubierta trasera con módulos.', src='PRD 1.8 · 49 y Equipamiento (minas navales)'),
    U(key='reconsub', name='Submarino de reconocimiento', fam='sea', prod='shipyard', cost=3000, energy=25, hp=1200, speed=1.8, pop=2, build=12, w='—',
      special='Oculto: ve 8 casillas y descubre submarinos.', model='Casco compacto y vela chica.', src='PRD 1.8 · 49'),
    # ----- Estratégico -----
    U(key='stratsub', name='Submarino estratégico', fam='strat', prod='shipyard', cost=24000, energy=100, hp=2600, speed=1.2, pop=5, build=40, w='misil nuclear (un uso)',
      special='Solo con «Arsenal estratégico»: un misil, comparte el uso único.', model='Casco largo con tapas de misiles.', src='Equipamiento (submarinos estratégicos)'),
]

# ---------------------------------------------------------------------------------------------------------------
# Edificios nuevos.
# ---------------------------------------------------------------------------------------------------------------
NEW_BLD = [
    U(key='corral', name='Corral de ganadería', tab='Economía', cost=600, energy=0, hp=500, build=7, limit=8, on='tierra',
      special='+280 monedas/min.', model='Cercado con cobertizo y animales.', src='PRD 1.8 · 52'),
    U(key='powerplant', name='Central de energía', tab='Energía', cost=3000, energy=0, hp=1200, build=14, limit=2, on='tierra',
      special='La energía más fuerte (+25 cada 10 s).', model='Módulos industriales y chimeneas con luces.', src='PRD 1.8 · 54'),
    U(key='workshop', name='Taller de mantenimiento', tab='Apoyo', cost=1800, energy=0, hp=1200, build=10, limit=3, on='tierra',
      special='Repara vehículos a 2 casillas (30 por segundo).', model='Nave baja con portón y grúa.', src='PRD 1.8 · 53'),
    U(key='research', name='Centro de investigación', tab='Apoyo', cost=3000, energy=20, hp=1400, build=14, limit=1, on='tierra',
      special='3 investigaciones: Blindaje (+10 % de vida a vehículos), Puntería (+10 % de daño a infantería) y Motores (+15 % de velocidad a aeronaves).', model='Laboratorios modulares y torre corta.', src='PRD 1.8 · 53'),
    U(key='radarstation', name='Estación de radar', tab='Apoyo', cost=2000, energy=30, hp=900, build=10, limit=2, on='tierra',
      special='Ve 12 casillas y descubre furtivos y submarinos a 8.', model='Base con antena de plato grande.', src='PRD 1.8 · 53'),
    U(key='dronecenter', name='Centro de drones', tab='Producción', cost=2200, energy=20, hp=1100, build=12, limit=2, on='tierra',
      special='Produce drones y los repara.', model='Taller con plataformas y antenas.', src='PRD 1.8 · 53'),
    U(key='shipyard', name='Astillero mayor', tab='Producción', cost=4000, energy=30, hp=2200, build=18, limit=1, on='agua junto a la orilla',
      special='Produce los buques grandes.', model='Dique ancho con grúas.', src='PRD 1.8 · 53'),
    U(key='depot', name='Depósito logístico', tab='Apoyo', cost=2500, energy=0, hp=1300, build=12, limit=2, on='tierra',
      special='Suministros: las tropas a 3 casillas recargan un 20 % más rápido; +5 de energía cada 10 s.', model='Almacenes y contenedores.', src='PRD 1.8 · 53'),
    U(key='hq', name='Centro de mando avanzado', tab='Apoyo', cost=3500, energy=20, hp=2400, build=16, limit=1, on='tierra',
      special='Gana territorio (3 casillas) y da +10 % de daño a las tropas a 3 casillas.', model='Edificio bajo protegido con mástil.', src='PRD 1.8 · 53'),
    U(key='bunker', name='Búnker de guarnición', tab='Defensa', cost=1600, energy=0, hp=2000, build=10, limit=6, on='tierra',
      special='Dispara solo; caben 4 soldados y cada uno suma un 25 % de daño.', model='Volumen bajo de hormigón con aberturas.', src='PRD 1.8 · 54'),
    U(key='gate', name='Puerta reforzada', tab='Defensa', cost=400, energy=0, hp=900, build=5, limit=10, on='tierra',
      special='Muro que deja pasar a tus tropas y a tus aliados.', model='Dos pilares y hojas con bandas de color.', src='PRD 1.8 · 54'),
    U(key='bridge', name='Puente modular', tab='Apoyo', cost=800, energy=0, hp=1000, build=8, limit=10, on='agua poco profunda junto a tierra',
      special='Las tropas de tierra cruzan por encima (los barcos ya no pasan por esa casilla).', model='Tablero recto con barandas.', src='PRD 1.8 · 54'),
    U(key='dock', name='Muelle logístico', tab='Apoyo', cost=1500, energy=0, hp=1000, build=8, limit=3, on='agua junto a la orilla',
      special='Repara barcos a 2 casillas (20 por segundo).', model='Pasarela ancha con rampa y cajas.', src='PRD 1.8 · 54'),
    U(key='watchtower', name='Torre de observación', tab='Defensa', cost=600, energy=0, hp=600, build=6, limit=6, on='tierra',
      special='Ve 9 casillas y descubre lo oculto a 4.', model='Torre alta y estrecha.', src='PRD 1.8 · 54'),
    U(key='coastal', name='Batería de defensa costera', tab='Defensa', cost=3000, energy=20, hp=1800, build=14, limit=4, on='tierra junto al agua',
      special='Cañón contra barcos (×1,8) de 7 casillas.', model='Base con cañón grande hacia el agua.', src='PRD 1.8 · 54'),
    U(key='silo', name='Complejo estratégico', tab='Defensa', cost=15000, energy=100, hp=3000, build=30, limit=1, on='tierra',
      special='Solo con «Arsenal estratégico»: lanza el DF-5C (misil nuclear, comparte el uso único).', model='Plataforma con compuerta redonda y señal ámbar.', src='PRD 1.8 · 54 y 55'),
    U(key='ciws', name='Defensa de punto', tab='Defensa', cost=1800, energy=20, hp=900, build=10, limit=6, on='tierra',
      special='Derriba misiles y cohetes a 3 casillas y dispara a drones.', model='Torreta con cañón rotativo y radar.', src='Equipamiento (Phalanx, C-RAM, Cúpula de Hierro)'),
    U(key='laser', name='Torre láser', tab='Defensa', cost=2500, energy=40, hp=900, build=12, limit=4, on='tierra',
      special='Rayo contra aeronaves (×2 a drones), 5 casillas.', model='Torre con emisor y paneles.', src='Equipamiento (HELIOS)'),
]

# ---------------------------------------------------------------------------------------------------------------
# «Equipamiento militar moderno» del usuario: cada sistema y dónde queda en el juego.
# kind: 'unidad' (tropa o edificio), 'arma' (lo usa una tropa), 'fuera' (no se agrega, con el motivo).
# ---------------------------------------------------------------------------------------------------------------
EQUIP = [
    # (grupo, sistema, tipo, clave o motivo, fuente: «texto:palabra» se busca en el archivo; «imagen N» es una captura del PDF)
    ('Aérea', 'F-35 Lightning II (avión furtivo)', 'unidad', 'fighter', 'texto:F-35'),
    ('Aérea', 'B-2 Spirit (bombardero furtivo)', 'unidad', 'bomber', 'texto:B-2'),
    ('Aérea', 'A-10 Thunderbolt II (ataque a tierra)', 'unidad', 'attackjet', 'texto:A-10'),
    ('Aérea', 'AC-130 Ghostrider (avión artillado)', 'unidad', 'gunship', 'texto:AC-130'),
    ('Aérea', 'B-1B Lancer (bombardero pesado)', 'unidad', 'heavybomber', 'texto:B-1B'),
    ('Aérea', 'B-52 Stratofortress (bombardero pesado)', 'unidad', 'heavybomber', 'texto:B-52'),
    ('Aérea', 'AH-64 Apache (helicóptero de combate)', 'unidad', 'apache', 'texto:AH-64'),
    ('Aérea', 'MH-60R Seahawk (helicóptero naval)', 'unidad', 'navalheli', 'texto:Seahawk'),
    ('Aérea', 'MQ-9 Reaper (dron)', 'unidad', 'drone', 'texto:MQ-9'),
    ('Aérea', 'Drones kamikaze FPV', 'unidad', 'fpv', 'texto:FPV'),
    ('Aérea', 'Misil aire-aire AIM-120 AMRAAM', 'arma', 'fighter', 'texto:AIM-120'),
    ('Aérea', 'Misil antirradar AGM-88 HARM', 'arma', 'ewplane', 'texto:HARM'),
    ('Aérea', 'Bombas guiadas JDAM y Paveway', 'arma', 'heavybomber', 'texto:JDAM'),
    ('Aérea', 'Bomba antibúnker GBU-57', 'arma', 'bomber', 'texto:GBU-57'),
    ('Aérea', 'Aviones de carga gigantes (C-17 Globemaster III)', 'unidad', 'transportplane', 'imagen 18'),
    ('Naval', 'Portaaviones nuclear (USS Gerald R. Ford)', 'unidad', 'carrier', 'texto:Ford'),
    ('Naval', 'Destructores (lanzamiento vertical VLS y Aegis)', 'unidad', 'destroyer', 'texto:Destructores'),
    ('Naval', 'Fragatas', 'unidad', 'frigate', 'texto:Fragatas'),
    ('Naval', 'Corbetas', 'unidad', 'corvette', 'texto:Corbetas'),
    ('Naval', 'Interceptor SM-3 (Aegis)', 'arma', 'cruiser', 'texto:SM-3'),
    ('Naval', 'Submarino de ataque (clase Virginia)', 'unidad', 'sub', 'texto:Virginia'),
    ('Naval', 'Submarino estratégico (clase Ohio, Trident II)', 'unidad', 'stratsub', 'texto:Ohio'),
    ('Naval', 'Misil de crucero Tomahawk', 'arma', 'cruiser', 'texto:Tomahawk'),
    ('Naval', 'Lanchas rápidas misileras (Harpoon, Exocet, NSM)', 'unidad', 'missileboat', 'texto:Lanchas Rápidas Misileras'),
    ('Naval', 'Buques anfibios de desembarco', 'unidad', 'landingship', 'texto:Buques Anfibios'),
    ('Naval', 'Aerodeslizadores (LCAC)', 'unidad', 'hovercraft', 'texto:aerodeslizadores'),
    ('Naval', 'Cañón naval Mk 45', 'arma', 'corvette', 'texto:Mk 45'),
    ('Naval', 'Sistema Phalanx CIWS', 'unidad', 'ciws', 'texto:Phalanx'),
    ('Naval', 'Minas navales', 'unidad', 'minelayer', 'texto:Minas Navales'),
    ('Naval', 'Cañones láser en destructores', 'unidad', 'laser', 'imagen 14'),
    ('Terrestre', 'Tanque M1A2 Abrams', 'unidad', 'heavytank', 'texto:Abrams'),
    ('Terrestre', 'Artillería autopropulsada (obuses)', 'unidad', 'howitzer', 'texto:Artillería Autopropulsada'),
    ('Terrestre', 'Obús remolcado M777', 'unidad', 'towedgun', 'texto:M777'),
    ('Terrestre', 'Morteros', 'unidad', 'mortar', 'texto:Morteros'),
    ('Terrestre', 'Lanzacohetes M142 HIMARS', 'unidad', 'mlrs', 'texto:HIMARS'),
    ('Terrestre', 'Misiles ATACMS (submuniciones)', 'arma', 'mlrs', 'texto:ATACMS'),
    ('Terrestre', 'Lanzacohetes termobárico TOS-1A', 'unidad', 'thermo', 'texto:TOS-1A'),
    ('Terrestre', 'Misil hipersónico DF-17', 'unidad', 'launcher', 'texto:DF-17'),
    ('Terrestre', 'Misil hipersónico Dark Eagle', 'unidad', 'launcher', 'texto:Dark Eagle'),
    ('Terrestre', 'Misil balístico intercontinental (ICBM)', 'unidad', 'silo', 'texto:ICBM'),
    ('Terrestre', 'Escudos THAAD y Patriot', 'unidad', 'antinuke', 'texto:THAAD'),
    ('Terrestre', 'Cúpula de Hierro y C-RAM', 'unidad', 'ciws', 'texto:C-RAM'),
    ('Terrestre', 'Misil portátil Javelin', 'unidad', 'atguided', 'texto:Javelin'),
    ('Terrestre', 'Lanzacohetes portátiles AT4, Carl Gustaf y RPG-7', 'unidad', 'rocket', 'texto:RPG-7'),
    ('Terrestre', 'Rifle Barrett .50', 'unidad', 'hunter', 'texto:Barrett'),
    ('Terrestre', 'Ametralladora rotativa (Minigun)', 'unidad', 'gunner', 'texto:Minigun'),
    ('Terrestre', 'Carga lineal MICLIC', 'arma', 'sapper', 'texto:MICLIC'),
    ('Terrestre', 'Mina Claymore', 'fuera', 'Mina antipersonal escondida en tierra: el juego no tiene minas en tierra; el Zapador usa cargas a la vista.', 'texto:Claymore'),
    ('Terrestre', 'Láser HELIOS', 'unidad', 'laser', 'texto:HELIOS'),
    ('Terrestre', 'Rifles antidrones', 'unidad', 'antidrone', 'texto:Antidrones'),
    ('Terrestre', 'Perros robot', 'unidad', 'robodog', 'texto:Perros Robot'),
    ('Capturas', 'Logística e ingeniería (camiones, grúas, ambulancias)', 'unidad', 'supplytruck', 'imagen 9'),
    ('Capturas', 'Equipamiento individual del soldado (visión nocturna)', 'unidad', 'soldier', 'imagen 16'),
    ('Capturas', 'Submarinos nucleares (interior y exterior)', 'unidad', 'sub', 'imagen 17'),
    ('Capturas', 'Lanzadores DF-17 en desfile', 'unidad', 'launcher', 'imagen 8'),
    ('Capturas', 'Lanzador de misil grande sobre camión (desfile)', 'unidad', 'nukelauncher', 'imagen 7'),
    ('Capturas', 'Fuerzas espaciales y satélites militares', 'fuera', 'El juego no tiene espacio ni órbita; la vigilancia de largo alcance la hacen el Avión de vigilancia y la Estación de radar.', 'imagen 14'),
]

# ---------------------------------------------------------------------------------------------------------------
# Pantallas de la UI 0.4 del usuario: qué elementos se buscan en el juego (texto o elemento en faro.html).
# ---------------------------------------------------------------------------------------------------------------
UI_CHECKS = [
    ('01 Carga', 'Carga en 3 pasos (Recursos esenciales, Tu perfil, La partida)', ['Recursos esenciales', 'Tu perfil', 'La partida', 'id="boot-steps"'], 'ui04-02.jpg'),
    ('01 Carga', 'Aviso si el perfil no se lee, con Reintentar', ['No pudimos cargar tu perfil', 'boot-retry'], 'ui04-02.jpg'),
    ('02 Vestíbulo', 'Pestañas Jugar, Arsenal, Inventario y Misiones', ['data-view="play"', 'data-view="arsenal"', 'data-view="inv"', 'data-view="missions"'], 'ui04-03.jpg'),
    ('02 Vestíbulo', 'Tutorial y Ajustes en el menú del vestíbulo', ["'Tutorial'", 'data-act="settings"'], 'ui04-03.jpg'),
    ('02 Vestíbulo', 'Escena «Tu ejército» detrás del vestíbulo (base y tropas en 3D)', ['const Showcase', 'Tu ejército'], 'ui04-03.jpg'),
    ('03 Modos', 'Tarjetas de modo y Partida personalizada con Arsenal estratégico', ['Personalizado', 'Arsenal estratégico'], 'ui04-04.jpg'),
    ('03 Modos', 'Modo «Campo de pruebas» para ver y probar todas las tropas', ['Campo de pruebas'], 'ui04-04.jpg'),
    ('04 Partida', 'Barra con Monedas, Ingresos, Energía, Población y Partida', ['>Monedas<', '>Ingresos<', '>Energía<', '>Población<', '>Partida<'], 'ui04-05.jpg'),
    ('04 Partida', 'Selección: vida del grupo, orden actual, Centrar y Quitar selección', ['Vida del grupo', 'Orden actual', 'btn-center', 'Quitar selección'], 'ui04-05.jpg'),
    ('05 Construcción', 'Categorías, vista previa, motivo y «N de 32 edificios»', ['data-why', 'Girar', 'edificios</span>'], 'ui04-06.jpg'),
    ('06 Producción', 'Cola con plazas reservadas y comunidad al terminar', ['plazas reservadas', 'Comunidad al terminar', 'Punto de reunión'], 'ui04-07.jpg'),
    ('07 Transporte', 'Pasajeros con nombre y plazas', ['paxbox', 'en camino', 'Desembarcar'], 'ui04-08.jpg'),
    ('08 Aviación', 'Aeronaves con su estado y puesto', ['planecard', 'Aeropuerto militar'], 'ui04-09.jpg'),
    ('09 Arsenal', 'Arsenal con buscador y filtros (Tierra, Drones, Helicópteros, Aviación, Mar, Estratégico)', ['ars-search', "'Infantería'", "'Tierra'", "'Drones'", "'Helicópteros'", "'Aviación'", "'Mar'", "'Estratégico'"], 'ui04-10.jpg'),
    ('10 Lanzador', 'Lanzador nuclear móvil: 1/1 → 0/1 y «¿Usar ahora?»', ['¿Usar ahora?', 'Confirmar uso único'], 'ui04-11.jpg'),
    ('11 Inventario', 'Inventario de aspectos («no cambian las estadísticas»)', ['Inventario', 'Equipar'], 'ui04-12.jpg'),
    ('12 Misiones', 'Misiones diarias y semanales con «Reclamar»', ['Misiones', 'Reclamar'], 'ui04-13.jpg'),
    ('13 Ajustes', '«A tu manera»: secciones Interfaz, Sonido, Cámara, Accesibilidad y Controles, y Restablecer', ['id="settings"', 'data-setsec="interfaz"', 'data-setsec="sonido"', 'data-setsec="camara"', 'data-setsec="accesibilidad"', 'data-setsec="controles"', 'Restablecer'], 'ui04-14.jpg'),
    ('14 Resultado', 'Resultado con Duración, Territorio y Experiencia, Revancha', ['Duración', 'Territorio máximo', 'Experiencia', 'Revancha'], 'ui04-15.jpg'),
]
