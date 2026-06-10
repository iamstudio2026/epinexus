/**
 * Utilidades de exportación cero-dependencias.
 *  - exportSvg(svgEl, filename)          → descarga el SVG tal cual
 *  - exportSvgAsPng(svgEl, filename, w?) → rasteriza vía <canvas>
 *  - exportUmbrellaExcel({...})          → archivo .xls multi-tabla (HTML compatible Excel)
 *  - downloadCsv(name, rows)             → CSV genérico
 */

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSvg(svgEl, filename = "dag.svg") {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // fondo sólido para que se vea bien fuera del fondo oscuro de la app
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "100%"); rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "#0b1220");
  clone.insertBefore(rect, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  download(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export function exportSvgAsPng(svgEl, filename = "dag.png", width = 1600) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const ratio = img.height / img.width;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = Math.round(width * ratio);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => { download(b, filename); URL.revokeObjectURL(url); }, "image/png");
  };
  img.src = url;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Genera un .xls (Excel abrirá el HTML con varias hojas).
 * Tablas: revisiones, matriz CCA (RS × estudios primarios), meta-análisis, credibilidad, PRISMA.
 */
export function exportUmbrellaExcel({ reviews, cca, meta, credibility, filename = "umbrella.xls" }) {
  // Matriz de cobertura RS × estudios primarios
  const studyIds = [...new Set(reviews.flatMap((r) => (r.studies || "").split(",").map((s) => s.trim()).filter(Boolean)))].sort();
  const matrixRows = reviews.map((r) => {
    const set = new Set((r.studies || "").split(",").map((s) => s.trim()));
    return `<tr><td>${esc(r.name)}</td>` +
      studyIds.map((s) => `<td style="text-align:center">${set.has(s) ? "✓" : ""}</td>`).join("") +
      `<td>${set.size}</td></tr>`;
  }).join("");
  const matrixHeader = `<tr><th>Revisión</th>${studyIds.map((s) => `<th>${esc(s)}</th>`).join("")}<th>N</th></tr>`;

  const reviewsRows = reviews.map((r) =>
    `<tr><td>${esc(r.name)}</td><td>${esc(r.studies)}</td><td>${r.critFlaws}</td><td>${r.nonCrit}</td></tr>`
  ).join("");

  const metaRows = meta
    ? `<tr><td>Pooled (log)</td><td>${meta.pooled.toFixed(4)}</td></tr>
       <tr><td>IC95% (log)</td><td>[${meta.ci[0].toFixed(3)}; ${meta.ci[1].toFixed(3)}]</td></tr>
       <tr><td>τ²</td><td>${meta.tau2.toFixed(4)}</td></tr>
       <tr><td>I²</td><td>${meta.I2.toFixed(1)}%</td></tr>
       <tr><td>Q (df=${meta.df})</td><td>${meta.Q.toFixed(3)} (p=${meta.pQ.toExponential(2)})</td></tr>
       <tr><td>Intervalo de predicción 95%</td><td>[${meta.predInt[0].toFixed(3)}; ${meta.predInt[1].toFixed(3)}]</td></tr>`
    : `<tr><td colspan="2">k&lt;2: meta-análisis no calculable</td></tr>`;

  const credRows = `
    <tr><td>Clase</td><td>${esc(credibility.class)}</td></tr>
    <tr><td>Casos</td><td>${credibility.cases}</td></tr>
    <tr><td>p</td><td>${credibility.p}</td></tr>
    <tr><td>I²</td><td>${credibility.i2}%</td></tr>
    <tr><td>Mayor significativo</td><td>${credibility.largestSig}</td></tr>
    <tr><td>IP excluye nulo</td><td>${credibility.predNull}</td></tr>
    <tr><td>Sesgo de estudios pequeños</td><td>${credibility.smallBias}</td></tr>
    <tr><td>Exceso de significancia</td><td>${credibility.excess}</td></tr>`;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"/><style>table{border-collapse:collapse} td,th{border:1px solid #999;padding:4px 6px;font-family:Calibri,Arial}</style>
<xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Revisiones</x:Name><x:WorksheetOptions/></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>MatrizCCA</x:Name><x:WorksheetOptions/></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>MetaAnalisis</x:Name><x:WorksheetOptions/></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Credibilidad</x:Name><x:WorksheetOptions/></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml></head>
<body>
<h3>Revisiones</h3>
<table><tr><th>Revisión</th><th>Estudios</th><th>Fallas críticas</th><th>Debilidades</th></tr>${reviewsRows}</table>
<p>CCA: ${cca.val.toFixed(1)}% (${cca.lvl}) · r=${cca.r} · c=${cca.c} · N=${cca.N}</p>
<h3>Matriz CCA (RS × estudios primarios)</h3>
<table>${matrixHeader}${matrixRows}</table>
<h3>Meta-análisis (DerSimonian-Laird)</h3>
<table><tr><th>Métrica</th><th>Valor</th></tr>${metaRows}</table>
<h3>Credibilidad</h3>
<table><tr><th>Campo</th><th>Valor</th></tr>${credRows}</table>
</body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), filename);
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}
