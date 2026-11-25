// node video.cjs pdf     → ../03-presentacion-diapositivas.pdf
// node video.cjs frames  → build/frames/*.png + build/frames/list.txt (duraciones para ffmpeg)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SLIDES = path.resolve(__dirname, 'build/slides.html');
const FRAMES = path.resolve(__dirname, 'build/frames');

// Segundos que se muestra cada paso, según cuántas palabras aparecen.
const stepSeconds = (words, first) => {
  const s = first ? 2.5 + 0.18 * words : 1.2 + 0.27 * words;
  return Math.min(first ? 9 : 15, Math.max(first ? 3 : 3.5, s));
};

(async () => {
  const mode = process.argv[2] || 'pdf';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + SLIDES, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  if (mode === 'pdf') {
    const out = path.resolve(__dirname, '../03-presentacion-diapositivas.pdf');
    await page.pdf({ path: out, width: '1920px', height: '1080px', printBackground: true });
    console.log(`[pdf] ${out}`);
    await browser.close();
    return;
  }

  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
  const list = [];
  let n = 0;
  for (let i = 0; i < total; i++) {
    const steps = await page.evaluate((idx) => {
      document.querySelectorAll('.slide').forEach((s, j) => { s.style.display = j === idx ? 'flex' : 'none'; });
      const slide = document.querySelectorAll('.slide')[idx];
      const reveals = [...slide.querySelectorAll('.r')];
      reveals.forEach((el) => el.classList.add('hidden-step'));
      const count = (t) => t.trim().split(/\s+/).filter(Boolean).length;
      const clone = slide.cloneNode(true);
      clone.querySelectorAll('.r, .top').forEach((el) => el.remove());
      return { reveals: reveals.length, base: count(clone.textContent), words: reveals.map((el) => count(el.textContent)) };
    }, i);
    for (let k = 0; k <= steps.reveals; k++) {
      if (k > 0) {
        await page.evaluate(([idx, kk]) => {
          const el = document.querySelectorAll('.slide')[idx].querySelectorAll('.r')[kk - 1];
          el.classList.remove('hidden-step');
        }, [i, k]);
      }
      // Diapositivas sin pasos (portadas) se muestran completas una sola vez.
      if (k === 0 && steps.reveals > 0 && steps.base < 3) continue;
      const file = `f${String(++n).padStart(3, '0')}.png`;
      await page.screenshot({ path: path.join(FRAMES, file), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      let secs = k === 0 ? stepSeconds(steps.base, true) : stepSeconds(steps.words[k - 1], false);
      if (k === steps.reveals) secs += 1.5;
      list.push(`file '${file}'\nduration ${secs.toFixed(2)}`);
    }
    process.stdout.write(`\r[frames] diapositiva ${i + 1}/${total}`);
  }
  list.push(`file 'f${String(n).padStart(3, '0')}.png'`);
  fs.writeFileSync(path.join(FRAMES, 'list.txt'), list.join('\n') + '\n');
  console.log(`\n[frames] ${n} imágenes`);
  await browser.close();
})();
