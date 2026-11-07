// Convierte un PRD en HTML a PDF A4 con número de página.
// Uso: node faro/docs/pdf.cjs faro/docs/prd/PRD_web_v0.3.html [salida.pdf]
// Requiere Playwright con Chromium instalado.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const input = path.resolve(process.argv[2] || '');
  if (!input.endsWith('.html')) {
    console.error('[PDF] Indica un archivo .html');
    process.exit(1);
  }
  const output = path.resolve(process.argv[3] || input.replace(/\.html$/, '.pdf'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('file://' + input);
    const title = await page.title();
    const small = 'font-family: DejaVu Sans, Arial, sans-serif; font-size: 7.5pt; color: #5d6b70; width: 100%; padding: 0 18mm;';
    await page.pdf({
      path: output,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="${small} display:flex; justify-content:space-between; border-top: 3mm solid #d99a2b; padding-top: 4mm;">
        <span style="color:#1b6b63; font-weight:700;">FARO DE ÁMBAR</span><span>${title.split('·').slice(1).join('·').trim().toUpperCase()}</span></div>`,
      footerTemplate: `<div style="${small} display:flex; justify-content:space-between;">
        <span>7 NOV 2026 · Prototipo web</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '24mm', bottom: '18mm', left: '18mm', right: '18mm' },
    });
    console.log(`[PDF] ✅ ${output}`);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('[PDF] ❌', err.message);
  process.exit(1);
});
