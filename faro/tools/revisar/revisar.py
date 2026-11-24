#!/usr/bin/env python3
"""Revisor de Faro de Ámbar: ¿el juego tiene lo que piden los documentos del usuario?

Compara el archivo real del juego (faro.html) con:
  1. El catálogo del PRD 1.8 del usuario (secciones 37-54: 78 tropas y 32 edificios).
  2. La lista «Equipamiento militar moderno» (texto y capturas del PDF).
  3. Las 14 pantallas de la Dirección visual UI 0.4.
Muestra las imágenes del usuario (modelos 0.2 y pantallas) junto a las miniaturas del juego.

Uso:
  python3 revisar.py                     # revisa faro/faro.html y escribe salida/informe.html, .json y .pdf
  python3 revisar.py --juego otro.html   # revisa otra versión del juego
  python3 revisar.py --fotos             # además abre el juego en Chromium y saca las miniaturas 3D
  python3 revisar.py --sin-pdf           # sin PDF (más rápido)
  python3 revisar.py --estricto          # termina con error (1) si falta algo

El programa no cambia el juego: solo lee y escribe el informe.
"""
import argparse
import base64
import datetime
import hashlib
import html
import io
import json
import os
import re
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
FARO = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import plan_v18 as PLAN  # noqa: E402

try:
    from PIL import Image
except ImportError:  # sin Pillow, el informe sale sin imágenes reducidas
    Image = None

MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
NUM_FIELDS_U = ['cost', 'energy', 'hp', 'speed', 'pop', 'build']
NUM_FIELDS_B = ['cost', 'energy', 'hp', 'build', 'limit']
FIELD_NAMES = {'cost': 'precio', 'energy': 'energía', 'hp': 'vida', 'speed': 'velocidad', 'pop': 'población', 'build': 'tiempo', 'limit': 'límite'}


def esc(s) -> str:
    return html.escape(str(s if s is not None else ''))


def norm(s: str) -> str:
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# ----------------------------------------------------------------------------------------------- lectura de documentos
def parse_catalog(md_path: str) -> list:
    """Filas de las tablas de las secciones 37-54 del PRD 1.8 del usuario."""
    rows, sec = [], None
    with open(md_path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'## (\d+)\. (.+)', line)
            if m:
                n = int(m.group(1))
                sec = (n, m.group(2).split(' · ')[0].strip()) if 37 <= n <= 54 else None
                continue
            if not sec or not line.startswith('| **'):
                continue
            m = re.match(r'\| \*\*(.+?)\*\* · ([^|]+?) \| (.+?) \| (.+?) \|\s*$', line.strip())
            if not m:
                continue
            name, doc_status, func, ui = (x.strip() for x in m.groups())
            forma = re.search(r'\*\*Forma:\*\* (.+)$', func)
            prod = re.search(r'Productor: ([^.]+)\.', ui)
            rows.append({
                'sec': sec[0], 'group': sec[1], 'name': name, 'doc_status': doc_status,
                'kind': 'unit' if sec[0] <= 50 else 'building',
                'funcion': func.split(' **Forma:**')[0].strip(), 'forma': forma.group(1).strip() if forma else '',
                'ui': ui, 'producer': prod.group(1).strip() if prod else None,
            })
    return rows


def load_game(path: str) -> dict:
    out = subprocess.run(['node', os.path.join(HERE, 'datos.cjs'), path], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(f'[Revisar] ❌ No pude leer el juego: {out.stderr.strip()}')
    data = json.loads(out.stdout)
    with open(path, 'rb') as f:
        raw = f.read()
    data['sha'] = hashlib.sha1(raw).hexdigest()
    data['text'] = raw.decode('utf-8', 'ignore')
    return data


def img_uri(path: str, width: int = 260) -> str:
    if not path or not os.path.exists(path):
        return ''
    if Image is None:
        with open(path, 'rb') as f:
            return 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()
    im = Image.open(path).convert('RGB')
    if im.width > width:
        im = im.resize((width, max(1, int(im.height * width / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=80)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


# ----------------------------------------------------------------------------------------------- revisiones
def has_model(key: str, models: list) -> bool:
    return any(m == key or m.startswith(key + '_') or m.startswith(key + '@') for m in models)


def name_check(user: str, game: str) -> tuple:
    if game is None:
        return ('—', '')
    if norm(user) == norm(game):
        return ('igual', '')
    alias = PLAN.NAME_ALIASES.get(user)
    if alias and norm(alias[0]) == norm(game):
        return ('alias', alias[1])
    if norm(user).startswith(norm(game)):
        return ('corto', f'en el juego: «{game}»')
    if norm(game).startswith(norm(user)):
        return ('corto', f'en el juego: «{game}» (más largo)')
    return ('distinto', f'en el juego: «{game}»')


def check_catalog(rows: list, game: dict) -> list:
    out = []
    for r in rows:
        key = PLAN.USER_MAP.get(r['name'])
        coll = game['units'] if r['kind'] == 'unit' else game['buildings']
        g = coll.get(key) if key else None
        item = dict(r, key=key, present=bool(g), game_name=g['name'] if g else None)
        item['name_state'], item['name_note'] = name_check(r['name'], item['game_name'])
        item['model'] = bool(key) and has_model(key, game['models'])
        item['prod_state'], item['prod_note'] = '—', ''
        if r['kind'] == 'unit' and g and r['producer']:
            want = PLAN.USER_MAP.get(r['producer'])
            have = g.get('producers') or []
            names = [game['buildings'].get(k, {}).get('name', k) for k in have]
            if want in have:
                extra = [n for k, n in zip(have, names) if k != want]
                item['prod_state'] = 'igual'
                item['prod_note'] = ('también en ' + ', '.join(extra)) if extra else ''
            else:
                item['prod_state'] = 'distinto'
                item['prod_note'] = 'en el juego: ' + (', '.join(names) or 'ninguno')
        problems = []
        if not g:
            state = 'falta'
        else:
            if item['name_state'] == 'distinto':
                problems.append('nombre distinto')
            if not item['model']:
                problems.append('sin modelo 3D')
            if item['prod_state'] == 'distinto':
                problems.append('productor distinto')
            state = 'aviso' if problems else 'ok'
        item['state'], item['problems'] = state, problems
        out.append(item)
    return out


def check_extra_user(game: dict) -> list:
    out = []
    for name, key, src in PLAN.EXTRA_USER:
        g = game['units'].get(key) or game['buildings'].get(key)
        out.append({'name': name, 'key': key, 'src': src, 'present': bool(g), 'game_name': g['name'] if g else None,
                    'model': has_model(key, game['models']), 'state': 'ok' if g else 'falta'})
    return out


def check_equipment(md_path: str, game: dict) -> list:
    text = open(md_path, encoding='utf-8').read().lower() if os.path.exists(md_path) else ''
    out = []
    for grp, name, kind, key, src in PLAN.EQUIP:
        if src.startswith('texto:'):
            word = src[6:]
            found = word.lower() in text
            src_txt = f'texto del PDF («{word}»)' if found else f'❌ no encontré «{word}» en el archivo'
        else:
            found = True
            src_txt = f'{src} del PDF (captura)'
        if kind == 'fuera':
            state, where = 'fuera', key
        else:
            g = game['units'].get(key) or game['buildings'].get(key)
            where = (g['name'] if g else key) + (' (arma de esta tropa)' if kind == 'arma' else '')
            state = 'ok' if g else 'falta'
        if not found:
            state = 'fuente'
        out.append({'group': grp, 'name': name, 'kind': kind, 'key': key if kind != 'fuera' else None, 'where': where,
                    'src': src_txt, 'state': state})
    return out


def check_ui(game: dict, ui_dir: str) -> list:
    text = game['text']
    out = []
    for screen, what, pats, img in PLAN.UI_CHECKS:
        # v1.9: un patrón puede tener alternativas separadas por « || » (los textos ahora pueden ir envueltos para traducir).
        missing = [p for p in pats if not any(alt in text for alt in p.split(' || '))]
        out.append({'screen': screen, 'what': what, 'missing': missing, 'state': 'ok' if not missing else 'falta',
                    'img': os.path.join(ui_dir, img)})
    return out


def check_plan(game: dict) -> list:
    """Números del plan v1.8 contra el juego (solo para lo que ya está en el juego)."""
    out = []
    for it in PLAN.NEW_UNITS:
        g = game['units'].get(it['key'])
        out.append(_plan_row(it, g, NUM_FIELDS_U, 'unit'))
    for it in PLAN.NEW_BLD:
        g = game['buildings'].get(it['key'])
        out.append(_plan_row(it, g, NUM_FIELDS_B, 'building'))
    for key, name in PLAN.RENAMES.items():
        g = game['units'].get(key) or game['buildings'].get(key)
        ok = bool(g) and g['name'] == name
        out.append({'key': key, 'name': name, 'kind': 'renombre', 'present': ok, 'diff': [] if ok else [f'hoy: «{g["name"] if g else "—"}»'],
                    'state': 'ok' if ok else 'falta'})
    for key, prod in PLAN.PRODUCER_ADDS.items():
        g = game['units'].get(key)
        ok = bool(g) and prod in (g.get('producers') or [])
        out.append({'key': key, 'name': (g or {}).get('name', key), 'kind': 'productor', 'present': ok,
                    'diff': [] if ok else [f'falta productor {prod}'], 'state': 'ok' if ok else 'falta'})
    return out


def _plan_row(it: dict, g: dict, fields: list, kind: str) -> dict:
    if not g:
        return {'key': it['key'], 'name': it['name'], 'kind': kind, 'present': False, 'diff': [], 'state': 'falta'}
    diff = []
    for f in fields:
        if f in it and g.get(f, 0) != it[f]:
            diff.append(f'{FIELD_NAMES[f]} {g.get(f)} (plan {it[f]})')
    return {'key': it['key'], 'name': it['name'], 'kind': kind, 'present': True, 'diff': diff, 'state': 'ok' if not diff else 'aviso'}


def extras_in_game(game: dict) -> list:
    known = set(PLAN.USER_MAP.values()) | {k for _, k, _ in PLAN.EXTRA_USER} | {e[3] for e in PLAN.EQUIP if e[2] != 'fuera'}
    out = []
    for k, u in game['units'].items():
        if k not in known:
            out.append({'key': k, 'name': u['name'], 'kind': 'Tropa'})
    for k, b in game['buildings'].items():
        if k not in known:
            out.append({'key': k, 'name': b['name'], 'kind': 'Edificio'})
    return out


# ----------------------------------------------------------------------------------------------- miniaturas del juego
def load_shots(path: str, sha: str) -> tuple:
    if not os.path.exists(path):
        return {}, 'Sin miniaturas del juego: corre «python3 revisar.py --fotos».'
    data = json.load(open(path))
    if data.get('sha') != sha:
        return {}, 'Las miniaturas guardadas son de otra versión del juego; corre «--fotos» otra vez.'
    return data.get('shots', {}), f'Miniaturas sacadas del juego real el {data.get("at", "")[:10]}.'


# ----------------------------------------------------------------------------------------------- informe
CSS = """
@page { size: A4; }
:root { --ink: #17313a; --teal: #1b6b63; --amber: #d99a2b; --soft: #f1f3f1; --line: #d9dfdc; --muted: #5d6b70; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.45; background: #fff; }
.wrap { max-width: 1000px; margin: 0 auto; padding: 16px; }
h1 { font-size: 26pt; margin: 0 0 4px; line-height: 1.1; }
h2 { font-size: 17pt; margin: 18px 0 8px; page-break-after: avoid; }
h3 { color: var(--teal); font-size: 12pt; margin: 14px 0 6px; page-break-after: avoid; }
p { margin: 0 0 8px; }
.eyebrow { font-size: 8.5pt; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; }
.meta { color: var(--muted); font-size: 9pt; margin-bottom: 12px; }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 14px; }
.tile { background: var(--soft); border-radius: 8px; padding: 8px 10px; }
.tile b { display: block; font-size: 15pt; color: var(--teal); white-space: nowrap; }
.tile span { font-size: 8.5pt; }
.bar { height: 8px; border-radius: 4px; background: #e3e7e5; overflow: hidden; margin-top: 4px; }
.bar i { display: block; height: 100%; background: var(--teal); }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.5pt; }
th { background: var(--teal); color: #fff; text-align: left; padding: 5px 6px; }
td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr { page-break-inside: avoid; }
tbody tr:nth-child(odd) td { background: var(--soft); }
td img { width: 64px; height: 64px; object-fit: contain; border-radius: 6px; background: #22262a; display: block; }
td img.game { background: #e9eef0; }
.ph { width: 64px; height: 64px; border-radius: 6px; border: 1px dashed var(--line); color: var(--muted); font-size: 7pt; display: flex; align-items: center; justify-content: center; text-align: center; }
.chip { white-space: nowrap; display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 7.5pt; font-weight: 700; }
.ok { background: #d5f0dd; color: #165a2b; }
.aviso { background: #f6e6c4; color: #6b4a0b; }
.falta, .fuente { background: #f8d6d6; color: #8a1f1f; }
.fuera { background: #e3e7e5; color: #3d4a4f; }
.small { font-size: 8pt; color: var(--muted); }
.note { border-left: 3px solid var(--amber); padding: 6px 10px; background: #fbf5e8; margin: 8px 0 12px; font-size: 9pt; }
.uiimg { width: 150px; border-radius: 6px; border: 1px solid var(--line); display: block; }
section { page-break-before: always; }
section.first { page-break-before: auto; }
@media (max-width: 640px) { .tiles { grid-template-columns: repeat(2, 1fr); } td img, .ph { width: 44px; height: 44px; } .uiimg { width: 90px; } }
"""

STATE_TXT = {'ok': 'En el juego', 'aviso': 'Con aviso', 'falta': 'Falta', 'fuera': 'Fuera (decidido)', 'fuente': 'No está en tu archivo'}


def chip(state: str, txt: str = None) -> str:
    return f'<span class="chip {state}">{esc(txt or STATE_TXT.get(state, state))}</span>'


def pct(a: int, b: int) -> int:
    return round(100 * a / b) if b else 0


def build_html(rep: dict, refs_dir: str, shots: dict, shots_note: str) -> str:
    cat, eq, ui, plan = rep['catalog'], rep['equipment'], rep['ui'], rep['plan']
    s = rep['summary']
    now = datetime.date.today()
    fecha = f'{now.day} {MONTHS[now.month - 1]} {now.year}'

    def pic_user(key):
        uri = img_uri(os.path.join(refs_dir, f'{key}.jpg'), 160) if key else ''
        return f'<img src="{uri}" alt="Tu modelo">' if uri else '<div class="ph">sin imagen tuya</div>'

    def pic_game(key):
        uri = shots.get(key) if key else None
        return f'<img class="game" src="{uri}" alt="En el juego">' if uri else '<div class="ph">sin miniatura</div>'

    h = [f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
         f'<meta name="fecha" content="{fecha}"><meta name="pie" content="Programa revisor">'
         f'<title>Faro de Ámbar · Informe del revisor · juego v{esc(rep["game"]["version"])}</title><style>{CSS}</style></head><body><div class="wrap">']
    h.append('<section class="first"><div class="eyebrow">Faro de Ámbar · Programa revisor</div>')
    h.append(f'<h1>¿El juego tiene lo de tus documentos?</h1>')
    h.append(f'<p class="meta">Juego revisado: <b>{esc(os.path.basename(rep["game"]["file"]))}</b> · versión {esc(rep["game"]["version"])} · '
             f'{rep["game"]["units"]} tropas, {rep["game"]["buildings"]} edificios y {rep["game"]["models"]} modelos 3D · {esc(rep["at"])}</p>')
    h.append('<div class="tiles">')
    for label, a, b in [('Tu catálogo (PRD 1.8)', s['catalog_ok'], s['catalog_total']), ('Tropas', s['units_ok'], s['units_total']),
                        ('Edificios', s['bld_ok'], s['bld_total']), ('Con modelo 3D', s['models_ok'], s['catalog_total']),
                        ('Equipamiento militar', s['equip_ok'], s['equip_total']), ('Pantallas UI 0.4', s['ui_ok'], s['ui_total']),
                        ('Plan v1.8 hecho', s['plan_ok'], s['plan_total']), ('Extras del juego', s['extras'], None)]:
        frac = f'{a} de {b}' if b is not None else f'{a}'
        bar = f'<div class="bar"><i style="width:{pct(a, b)}%"></i></div>' if b else ''
        h.append(f'<div class="tile"><b>{frac}</b><span>{esc(label)}</span>{bar}</div>')
    h.append('</div>')
    h.append('<div class="note">«En el juego» = la tropa o edificio existe en el archivo del juego con su modelo 3D, con tu nombre (o uno más corto que empieza igual) y, en las tropas, sale del productor que pusiste. '
             '«Con aviso» = existe pero algo no coincide (se dice qué). «Falta» = todavía no existe. '
             'El programa lee el archivo del juego; no juega partidas. Las mecánicas se prueban aparte con las pruebas del PRD.</div>')
    h.append(f'<p class="small">Fuentes leídas: {esc(", ".join(rep["sources"]))}. {esc(shots_note)}</p>')
    h.append('</section>')

    # Catálogo por grupo
    h.append('<section><h2>1. Tu catálogo: 78 tropas y 32 edificios</h2>')
    h.append('<p>Tablas de las secciones 37-54 de tu PRD 1.8, en tu orden. A la izquierda tu imagen (modelos 0.2 de tu PDF v1.8), al lado la miniatura real del juego.</p>')
    groups = []
    for it in cat:
        if not groups or groups[-1][0] != it['group']:
            groups.append((it['group'], []))
        groups[-1][1].append(it)
    for gname, items in groups:
        ok = sum(1 for i in items if i['state'] == 'ok')
        h.append(f'<h3>{esc(gname)} · {ok} de {len(items)}</h3><table><thead><tr><th style="width:70px">Tuyo</th><th style="width:70px">Juego</th>'
                 '<th>Elemento (tu nombre)</th><th>Para qué sirve (tu texto)</th><th style="width:150px">Revisión</th></tr></thead><tbody>')
        for i in items:
            notes = []
            if i['present']:
                notes.append(f'clave <code>{esc(i["key"])}</code>')
                if i['name_state'] in ('corto', 'alias', 'distinto'):
                    notes.append(i['name_note'] if i['name_state'] != 'alias' else f'«{i["game_name"]}»: {i["name_note"]}')
                notes.append('modelo 3D ✓' if i['model'] else 'sin modelo 3D')
                if i['prod_state'] == 'igual':
                    notes.append('productor ✓' + (f' ({i["prod_note"]})' if i['prod_note'] else ''))
                elif i['prod_state'] == 'distinto':
                    notes.append(f'productor: pediste {i["producer"]}; {i["prod_note"]}')
            else:
                notes.append(f'clave prevista <code>{esc(i["key"] or "—")}</code>' + (f' · productor: {esc(i["producer"])}' if i['producer'] else ''))
            h.append(f'<tr><td>{pic_user(i["key"])}</td><td>{pic_game(i["key"] if i["present"] else None)}</td>'
                     f'<td><b>{esc(i["name"])}</b><div class="small">{esc(i["doc_status"])} · sección {i["sec"]}</div></td>'
                     f'<td>{esc(i["funcion"])}<div class="small">Forma: {esc(i["forma"])}</div></td>'
                     f'<td>{chip(i["state"])}<div class="small">{"<br>".join(notes)}</div></td></tr>')
        h.append('</tbody></table>')
    h.append('<h3>Otros elementos de tus documentos</h3><table><thead><tr><th>Elemento</th><th>Fuente</th><th>Revisión</th></tr></thead><tbody>')
    for e in rep['extra_user']:
        h.append(f'<tr><td><b>{esc(e["name"])}</b></td><td>{esc(e["src"])}</td><td>{chip(e["state"])} <span class="small">{esc(e["game_name"] or e["key"])}</span></td></tr>')
    h.append('</tbody></table></section>')

    # Equipamiento
    h.append(f'<section><h2>2. Tu lista «Equipamiento militar moderno»</h2>')
    h.append('<p>Cada sistema de tu PDF (texto y capturas) y dónde queda en el juego. Lo marcado como «arma» es el arma de una tropa; «Fuera» son las dos cosas que no entran, con el motivo.</p>')
    h.append('<table><thead><tr><th>Grupo</th><th>Sistema (tu lista)</th><th>Dónde está en tu archivo</th><th>En el juego</th><th style="width:110px">Revisión</th></tr></thead><tbody>')
    for e in eq:
        h.append(f'<tr><td>{esc(e["group"])}</td><td><b>{esc(e["name"])}</b></td><td class="small">{esc(e["src"])}</td><td>{esc(e["where"])}</td><td>{chip(e["state"])}</td></tr>')
    h.append('</tbody></table></section>')

    # UI 0.4
    h.append('<section><h2>3. Tu Dirección visual UI 0.4</h2><p>Para cada pantalla se buscan en el archivo del juego los textos o elementos que la representan.</p>')
    h.append('<table><thead><tr><th style="width:160px">Tu pantalla</th><th>Qué se busca</th><th style="width:150px">Revisión</th></tr></thead><tbody>')
    for u in ui:
        uri = img_uri(u['img'], 300)
        pic = f'<img class="uiimg" src="{uri}" alt="Tu pantalla">' if uri else ''
        miss = ('<div class="small">No encontré: ' + esc(', '.join(u['missing'])) + '</div>') if u['missing'] else ''
        h.append(f'<tr><td>{pic}<div class="small">{esc(u["screen"])}</div></td><td>{esc(u["what"])}</td><td>{chip(u["state"])}{miss}</td></tr>')
    h.append('</tbody></table></section>')

    # Plan
    h.append('<section><h2>4. Plan v1.8: números y cambios</h2><p>Lo que el PRD v1.8 promete agregar o cambiar. Para lo que ya está, se comparan precio, vida, velocidad, población, tiempo, energía y límite con el plan.</p>')
    h.append('<table><thead><tr><th>Elemento</th><th>Tipo</th><th>Diferencias con el plan</th><th style="width:110px">Revisión</th></tr></thead><tbody>')
    kinds = {'unit': 'Tropa nueva', 'building': 'Edificio nuevo', 'renombre': 'Nombre nuevo', 'productor': 'Productor nuevo'}
    for p in plan:
        h.append(f'<tr><td><b>{esc(p["name"])}</b> <span class="small">{esc(p["key"])}</span></td><td>{kinds[p["kind"]]}</td>'
                 f'<td class="small">{esc("; ".join(p["diff"]) or ("igual al plan" if p["present"] else "todavía no está"))}</td><td>{chip(p["state"])}</td></tr>')
    h.append('</tbody></table>')
    if rep['extras']:
        h.append('<h3>Extras del juego que no están en tu catálogo</h3><p>Se quedan en el juego; los puedes quitar o renombrar cuando quieras.</p><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Clave</th></tr></thead><tbody>')
        for e in rep['extras']:
            h.append(f'<tr><td>{esc(e["name"])}</td><td>{e["kind"]}</td><td><code>{esc(e["key"])}</code></td></tr>')
        h.append('</tbody></table>')
    h.append('</section></div></body></html>')
    return '\n'.join(h)


def main() -> int:
    ap = argparse.ArgumentParser(description='Revisa si el juego tiene los elementos de tus documentos.')
    ap.add_argument('--juego', default=os.path.join(FARO, 'faro.html'))
    ap.add_argument('--prd', default=os.path.join(FARO, 'docs', 'roblox', 'PRD_Faro_de_Ambar_v1_8.md'))
    ap.add_argument('--equipo', default=os.path.join(FARO, 'docs', 'roblox', 'Equipamiento_Militar_2.md'))
    ap.add_argument('--ui', default=os.path.join(FARO, 'docs', 'roblox', 'ui-0.4'))
    ap.add_argument('--refs', default=os.path.join(FARO, 'docs', 'roblox', 'modelos-0.2'))
    ap.add_argument('--salida', default=os.path.join(HERE, 'salida'))
    ap.add_argument('--fotos', action='store_true', help='abre el juego en Chromium y saca las miniaturas 3D')
    ap.add_argument('--sin-pdf', action='store_true')
    ap.add_argument('--estricto', action='store_true', help='termina con error si falta algo')
    a = ap.parse_args()
    os.makedirs(a.salida, exist_ok=True)

    print(f'[Revisar] Leyendo el juego: {a.juego}')
    game = load_game(a.juego)
    rows = parse_catalog(a.prd)
    if len(rows) != 110:
        print(f'[Revisar] ℹ️ El catálogo tiene {len(rows)} filas (se esperaban 110).')
    cat = check_catalog(rows, game)
    extra_user = check_extra_user(game)
    eq = check_equipment(a.equipo, game)
    ui = check_ui(game, a.ui)
    plan = check_plan(game)
    extras = extras_in_game(game)

    shots_path = os.path.join(a.salida, 'fotos.json')
    if a.fotos:
        env = dict(os.environ)
        r = subprocess.run(['node', os.path.join(HERE, 'fotos.cjs'), a.juego, shots_path], env=env)
        if r.returncode != 0:
            print('[Revisar] ❌ No pude sacar las miniaturas; el informe sale sin ellas.')
    shots, shots_note = load_shots(shots_path, game['sha'])

    units = [i for i in cat if i['kind'] == 'unit']
    blds = [i for i in cat if i['kind'] == 'building']
    s = {
        'catalog_total': len(cat), 'catalog_ok': sum(i['state'] == 'ok' for i in cat),
        'catalog_present': sum(i['present'] for i in cat), 'catalog_warn': sum(i['state'] == 'aviso' for i in cat),
        'units_total': len(units), 'units_ok': sum(i['state'] == 'ok' for i in units),
        'bld_total': len(blds), 'bld_ok': sum(i['state'] == 'ok' for i in blds),
        'models_ok': sum(1 for i in cat if i['present'] and i['model']),
        'equip_total': len(eq), 'equip_ok': sum(e['state'] in ('ok', 'fuera') for e in eq),
        'ui_total': len(ui), 'ui_ok': sum(u['state'] == 'ok' for u in ui),
        'plan_total': len(plan), 'plan_ok': sum(p['state'] == 'ok' for p in plan),
        'extras': len(extras),
    }
    rep = {
        'at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'game': {'file': a.juego, 'sha': game['sha'], 'version': game['version'], 'units': len(game['units']),
                 'buildings': len(game['buildings']), 'models': len(game['models'])},
        'sources': [os.path.basename(a.prd), os.path.basename(a.equipo), 'UI 0.4 (' + os.path.basename(a.ui) + ')', 'modelos 0.2 de tu PDF v1.8'],
        'summary': s, 'catalog': cat, 'extra_user': extra_user, 'equipment': eq, 'ui': ui, 'plan': plan, 'extras': extras,
    }
    with open(os.path.join(a.salida, 'informe.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=1)
    out_html = os.path.join(a.salida, 'informe.html')
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(build_html(rep, a.refs, shots, shots_note))

    print(f'[Revisar] Juego v{game["version"]}: {len(game["units"])} tropas, {len(game["buildings"])} edificios, {len(game["models"])} modelos')
    print(f'[Revisar] Tu catálogo: {s["catalog_ok"]} de {s["catalog_total"]} en el juego sin avisos '
          f'({s["catalog_present"]} existen, {s["catalog_warn"]} con aviso, {s["catalog_total"] - s["catalog_present"]} faltan)')
    print(f'[Revisar]   Tropas {s["units_ok"]} de {s["units_total"]} · Edificios {s["bld_ok"]} de {s["bld_total"]} · Con modelo 3D {s["models_ok"]}')
    print(f'[Revisar] Equipamiento: {s["equip_ok"]} de {s["equip_total"]} · UI 0.4: {s["ui_ok"]} de {s["ui_total"]} · Plan v1.8: {s["plan_ok"]} de {s["plan_total"]}')
    missing = [i['name'] for i in cat if i['state'] == 'falta']
    if missing:
        print(f'[Revisar] ❌ Faltan ({len(missing)}): ' + ', '.join(missing))
    for i in cat:
        if i['state'] == 'aviso':
            print(f'[Revisar] 💡 {i["name"]}: ' + ', '.join(i['problems']) + (f' ({i["name_note"]})' if i['name_note'] else '') + (f' ({i["prod_note"]})' if i['prod_state'] == 'distinto' else ''))
    for u in ui:
        if u['missing']:
            print(f'[Revisar] ❌ UI {u["screen"]}: no encontré ' + ', '.join(u['missing']))
    for e in eq:
        if e['state'] in ('falta', 'fuente'):
            print(f'[Revisar] ❌ Equipo: {e["name"]} → {e["where"]} ({e["src"]})')
    print(f'[Revisar] ✅ Informe: {out_html}')
    if not a.sin_pdf:
        r = subprocess.run(['node', os.path.join(FARO, 'docs', 'pdf.cjs'), out_html], capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())
    bad = s['catalog_ok'] < s['catalog_total'] or s['ui_ok'] < s['ui_total'] or any(e['state'] in ('falta', 'fuente') for e in eq)
    return 1 if (a.estricto and bad) else 0


if __name__ == '__main__':
    sys.exit(main())
