// Utilidades de tamanho de página (pixels para o preview a ~96dpi)
const PAGE_SIZES = {
  A4: { w: 794, h: 1123 },          // 210×297mm @96dpi aprox
  Letter: { w: 816, h: 1056 }       // 8.5×11in @96dpi
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const preview = $('#preview');
const emptyPreview = $('#emptyPreview');
const pageSizeSel = $('#pageSize');
const orientationSel = $('#orientation');
const fitToPageChk = $('#fitToPage');
const btnGenerate = $('#btnGenerate');
const btnClear = $('#btnClear');
const progressBar = $('#progressBar');
const metaInfo = $('#metaInfo');
const projectName = $('#projectName');

let currentFile = null;
let renderedContainer = null; // container com o conteúdo unificado para render -> PDF

// Drag & Drop
;['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
});
;['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files?.[0];
  if (f) handleFile(f);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
});

// Atualiza dimensões do preview conforme opções
function updatePageVars() {
  const ps = PAGE_SIZES[pageSizeSel.value];
  const portrait = orientationSel.value === 'portrait';
  const w = portrait ? ps.w : ps.h;
  const h = portrait ? ps.h : ps.w;
  document.documentElement.style.setProperty('--a4w', w + 'px');
  document.documentElement.style.setProperty('--a4h', h + 'px');
  $$('.page').forEach(pg => pg.style.width = w + 'px');
}
pageSizeSel.addEventListener('change', () => { updatePageVars(); if (currentFile) renderPreview(currentFile); });
orientationSel.addEventListener('change', () => { updatePageVars(); if (currentFile) renderPreview(currentFile); });
fitToPageChk.addEventListener('change', () => { if (currentFile) renderPreview(currentFile); });

function clearPreview() {
  preview.innerHTML = '';
  preview.appendChild(emptyPreview);
  emptyPreview.style.display = 'block';
  metaInfo.textContent = 'Nenhum arquivo carregado';
  currentFile = null;
  progress(0);
}
btnClear.addEventListener('click', clearPreview);

function progress(pct) {
  progressBar.style.width = pct + '%';
  progressBar.textContent = Math.round(pct) + '%';
  progressBar.ariaValueNow = Math.round(pct);
}

async function handleFile(file) {
  currentFile = file;
  metaInfo.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  await renderPreview(file);
}

async function renderPreview(file) {
  emptyPreview.style.display = 'none';
  preview.innerHTML = '';

  if (renderedContainer) renderedContainer.remove();
  renderedContainer = document.createElement('div');
  renderedContainer.style.position = 'absolute';
  renderedContainer.style.left = '-99999px';
  renderedContainer.style.top = '0';
  document.body.appendChild(renderedContainer);

  const ext = file.name.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    await renderImage(file);
  } else if (ext === 'docx') {
    await renderDocx(file);
  } else if (['html', 'htm', 'txt'].includes(ext)) {
    await renderTextLike(file, ext);
  } else {
    preview.innerHTML = '<div class="empty-state">Formato não suportado. Use imagens, DOCX, HTML ou TXT.</div>';
  }
}

// Faz uma página sem permitir alterar margens
function makePage() {
  const ps = PAGE_SIZES[pageSizeSel.value];
  const portrait = orientationSel.value === 'portrait';
  const w = portrait ? ps.w : ps.h;
  const h = portrait ? ps.h : ps.w;

  const page = document.createElement('div');
  page.className = 'page';
  page.style.width = w + 'px';
  page.style.minHeight = h + 'px';

  const content = document.createElement('div');
  content.className = 'content';
  // Margens fixas (não editáveis)
  content.style.padding = '10mm';
  page.appendChild(content);

  return { page, content, w, h };
}

async function renderImage(file) {
  const { page, content } = makePage();

  const imgURL = URL.createObjectURL(file);
  const img = new Image();
  img.src = imgURL;
  await img.decode();

  img.className = 'thumb';
  if (fitToPageChk.checked) {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  }

  content.appendChild(img);
  preview.appendChild(page);

  const renderClone = page.cloneNode(true);
  renderedContainer.appendChild(renderClone);
}

async function renderDocx(file) {
  const { page, content } = makePage();

  const holder = document.createElement('div');
  content.appendChild(holder);

  const arrayBuffer = await file.arrayBuffer();
  await window.docx.renderAsync(arrayBuffer, holder, holder, {
    className: 'docx', inWrapper: false, ignoreFonts: true
  });

  preview.appendChild(page);

  const ps = page.cloneNode(true);
  renderedContainer.appendChild(ps);
}

async function renderTextLike(file, ext) {
  const { page, content } = makePage();

  let html = '';
  const raw = await file.text();
  if (ext === 'txt') {
    html = `<pre style="white-space:pre-wrap;word-wrap:break-word;margin:0">${escapeHtml(raw)}</pre>`;
  } else {
    html = raw;
  }

  const safe = stripDangerousTags(html);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = safe;

  content.appendChild(wrapper);
  preview.appendChild(page);

  const ps = page.cloneNode(true);
  renderedContainer.appendChild(ps);
}

function escapeHtml(str) {
  return str.replace(/[&<>\"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[s]));
}

function stripDangerousTags(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
  tmp.querySelectorAll('style').forEach(el => el.remove());
  return tmp.innerHTML;
}

btnGenerate.addEventListener('click', async () => {
  if (!renderedContainer || !renderedContainer.children.length) {
    alert('Envie um arquivo para converter.');
    return;
  }

  progress(5);

  const { jsPDF } = window.jspdf;
  const pdfSize = pageSizeSel.value === 'A4' ? 'a4' : 'letter';
  const pdf = new jsPDF({
    orientation: orientationSel.value,
    unit: 'mm',
    format: pdfSize
  });

  const pageWidthMM = pdf.internal.pageSize.getWidth();
  const pageHeightMM = pdf.internal.pageSize.getHeight();

  const pages = renderedContainer.querySelectorAll('.page');
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, pageHeightMM);

    progress(5 + (i / pages.length) * 90);
  }

  progress(100);
  const name = (projectName.value || 'documento') + '.pdf';
  pdf.save(name);
});

updatePageVars();
