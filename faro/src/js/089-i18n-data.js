'use strict';
// v1.9: tablas de datos con textos para el jugador. Si el idioma no es español, se traducen una vez al arrancar
// (antes de dibujar el vestíbulo). Nuevas tablas con textos: agregarlas aquí (el revisor de idioma las lee de aquí).
function i18nTables() {
  return {
    objects: { POINTS, RESEARCH, TERRAIN, BUILDINGS, BUILD_TABS, UNITS, MODES, MAPS, DIFFICULTY, PERSONALITIES, CAMPAIGN, OBJECTIVES,
      SKIN_LOOKS, CODES, RARITY, CHESTS, SKIN_SLOTS, CRYSTAL_PACKS, MISSIONS, TUTORIAL_STEPS, ACHIEVEMENTS, WEEKLY_CHALLENGES },
    lists: { PLAYER_NAMES, BASE_NAMES, CVD_NAMES, ABOUT_NEWS, RANKS, LADDER_NAMES, TOP_PREFIX, TOP_SUFFIX, MONTHS },
    maps: { ALLY_LINES, CAT_NAMES, ARSENAL_ON },
    pairs: { ARSENAL_FILTERS },
  };
}

function i18nApplyData() {
  if (I18N.lang === 'es') return;
  const t = i18nTables();
  for (const o of Object.values(t.objects)) I18N.applyData(o);
  for (const l of Object.values(t.lists)) I18N.applyList(l);
  for (const m of Object.values(t.maps)) for (const k of Object.keys(m)) if (typeof m[k] === 'string') m[k] = T$(m[k]);
  for (const list of Object.values(t.pairs)) for (const pair of list) pair[1] = T$(pair[1]);
  // Aspectos armados al cargar (lugar + estilo): se vuelven a armar con los nombres traducidos.
  for (const s of SKINS) {
    if (s.id === `${s.look}_${s.slot}` && SKIN_LOOKS[s.look] && SKIN_SLOTS[s.slot] && !['toxico_inf', 'dorado_inf'].includes(s.id)) s.name = `${SKIN_LOOKS[s.look].name} ${SKIN_SLOTS[s.slot].name}`;
    else s.name = T$(s.name);
    if (s.special) s.special = T$(s.special);
  }
}
