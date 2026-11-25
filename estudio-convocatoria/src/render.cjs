// Convierte los HTML de build/ en PDF tamaño carta con número de página.
// Uso: node render.js build/archivo.html:../salida.pdf:"Título del pie"
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const specs = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const spec of specs) {
    const [html, pdf, title] = spec.split('::');
    await page.goto('file://' + path.resolve(html), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: pdf,
      format: 'Letter',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '13mm', right: '13mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:Inter,sans-serif;font-size:7.5px;color:#7a8191;width:100%;padding:0 13mm;display:flex;justify-content:space-between;">
        <span>${title}</span>
        <span>Make-up Science Test · 4 dic / Dec 4, 2026 · <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>`,
    });
    console.log(`[pdf] ${pdf}`);
  }
  await browser.close();
})();
