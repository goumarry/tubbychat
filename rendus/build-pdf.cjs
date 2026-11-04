// Génère rendus/DOSSIER-TECHNIQUE.pdf à partir de DOSSIER-TECHNIQUE.md (+ USAGE-IA.md en annexe).
// Les schémas Mermaid sont dessinés dans Chrome, puis la page est imprimée en A4.
//
//   cd rendus
//   npm install --no-save marked@14 mermaid@11 puppeteer@23
//   node build-pdf.cjs
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const here = __dirname;
const read = f => fs.readFileSync(path.join(here, f), 'utf8');

let md = read('DOSSIER-TECHNIQUE.md');
// Le sommaire et l'annexe commencent sur une nouvelle page.
md = md.replace(/\n## (1\.|10\.) /g, '\n<div style="break-before:page"></div>\n\n## $1 ');
// Annexe : le journal d'usage de l'IA, tel qu'il est à la racine du dépôt (titre principal rétrogradé).
const usage = read('../USAGE-IA.md').replace(/^# .*\n/, '').replace(/^## /gm, '### ');
md = md.replace(/(## 10\. Annexe : USAGE-IA\.md\n\n)[\s\S]*$/, `$1${usage}`);

// Les blocs ```mermaid deviennent des <pre class="mermaid"> que mermaid.js dessinera.
const renderer = new marked.Renderer();
const baseCode = renderer.code.bind(renderer);
// (marked ≥ 13 passe un objet « token », les versions plus anciennes passent (texte, langage).)
renderer.code = (token, lang) => {
  const text = typeof token === 'string' ? token : token.text;
  const language = typeof token === 'string' ? lang : token.lang;
  return language === 'mermaid' ? `<pre class="mermaid">${text}</pre>` : baseCode(token, lang);
};
const body = marked.parse(md, { renderer });

const mermaidJs = fs.readFileSync(require.resolve('mermaid/dist/mermaid.min.js'), 'utf8');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>TubbyChat — Dossier technique</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  body { font: 10pt/1.45 "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #222; }
  h1 { color: #6a3fb5; font-size: 22pt; margin: 0 0 6pt; }
  h2 { color: #6a3fb5; border-bottom: 2px solid #f4d03f; padding-bottom: 3pt; margin-top: 18pt; break-after: avoid; }
  h3 { color: #2e7d32; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 8.8pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th { background: #efe7fb; text-align: left; }
  th, td { border: 1px solid #d5cce6; padding: 3pt 5pt; vertical-align: top; }
  code { font-family: Consolas, "DejaVu Sans Mono", monospace; font-size: 8.6pt; background: #f4f1f8; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f4f1f8; padding: 6pt; border-radius: 4pt; white-space: pre-wrap; }
  pre.mermaid { background: none; text-align: center; break-inside: avoid; }
  hr { display: none; }
</style></head><body>${body}
<script>${mermaidJs}</script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', flowchart: { useMaxWidth: true } });
  mermaid.run().then(() => { document.body.dataset.ready = '1'; });
</script></body></html>`;

(async () => {
  fs.writeFileSync(path.join(here, '.dossier.html'), html);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(here, '.dossier.html'));
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
  await page.pdf({
    path: path.join(here, 'DOSSIER-TECHNIQUE.pdf'),
    format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8pt;width:100%;text-align:center;color:#888">TubbyChat — Dossier technique — <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
  });
  await browser.close();
  if (!process.env.KEEP_HTML) fs.unlinkSync(path.join(here, '.dossier.html'));
  console.log('rendus/DOSSIER-TECHNIQUE.pdf généré');
})().catch(e => { console.error(e); process.exit(1); });
