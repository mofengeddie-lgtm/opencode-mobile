// SDK de Poki de prueba (v1.9): anota cada llamada con la hora; los anuncios duran AD_MS.
(() => {
  const AD_MS = window.FAKE_AD_MS || 1500;
  const log = (window.POKI_LOG = []);
  const rec = (ev, x) => log.push({ ev, t: Math.round(performance.now()), ...(x || {}) });
  window.PokiSDK = {
    init: () => { rec('init'); return Promise.resolve(); },
    setDebug: () => {},
    gameLoadingFinished: () => rec('gameLoadingFinished'),
    gameplayStart: () => rec('gameplayStart'),
    gameplayStop: () => rec('gameplayStop'),
    commercialBreak: (onStart) => { rec('commercialBreak'); if (onStart) onStart(); window.POKI_AD = true;
      return new Promise((res) => setTimeout(() => { window.POKI_AD = false; rec('commercialBreak-fin'); res(); }, AD_MS)); },
    rewardedBreak: (a) => { rec('rewardedBreak'); const onStart = typeof a === 'function' ? a : a && a.onStart; if (onStart) onStart(); window.POKI_AD = true;
      return new Promise((res) => setTimeout(() => { window.POKI_AD = false; const ok = window.FAKE_REWARD !== false; rec('rewardedBreak-fin', { ok }); res(ok); }, AD_MS)); },
    getLanguage: () => window.FAKE_LANG || 'es',
    movePill: (a, b) => rec('movePill', { a, b }),
    getURLParam: () => '',
  };
})();
