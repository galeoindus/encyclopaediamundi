/** Client-side file extraction. File bytes never enter persistent chat history. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 4;
export const MAX_EXTRACTED_CHARS = 12_000;
export const MAX_IMAGE_COUNT = 2;
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml']);

function extension(name) { return String(name || '').split('.').pop()?.toLowerCase() || ''; }
function safeText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

export function isSupportedFile(file) {
  const ext = extension(file?.name);
  const type = String(file?.type || '').toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || type.startsWith('text/') || type === 'application/pdf' || ext === 'pdf' || type.startsWith('image/');
}

async function extractPdf(file) {
  // PDF.js is loaded only when a PDF is attached. Its library and PDF bytes
  // are processed in the browser; no upload is made to a conversion service.
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = [];
  const pageLimit = Math.min(pdf.numPages, 15);
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items.map((item) => String(item.str || '')).join(' ');
    if (line.trim()) pages.push(`Page ${pageNumber}: ${line}`);
    if (pages.join('\n').length >= MAX_EXTRACTED_CHARS) break;
  }
  return { text: safeText(pages.join('\n\n')), note: pdf.numPages > pageLimit ? `Read the first ${pageLimit} of ${pdf.numPages} pages.` : '' };
}

/**
 * Read the text out of an image, in the browser.
 *
 * Tesseract is fetched only when an image is attached, and the picture never
 * leaves the device — the recognition runs locally in a worker. A failure here
 * is not fatal: the image is still attached for a vision-capable model, it just
 * arrives without its text.
 */
async function ocrImage(dataUrl, name) {
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    const Tesseract = mod.default || mod;
    const { data } = await Tesseract.recognize(dataUrl, 'eng+hin', { logger: () => {} });
    return safeText(data?.text || '');
  } catch {
    return '';
  }
}

async function readImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(dataUrl)) {
    throw new Error(`${file.name}: use PNG, JPG or WebP images.`);
  }
  // OCR runs only for images small enough to be worth the wait, and its result
  // travels with the attachment as text so a text-only model can still answer.
  const text = Number(file.size) <= 3 * 1024 * 1024 ? await ocrImage(dataUrl, file.name) : '';
  return { name: String(file.name || 'Image').slice(0, 120), kind: 'image', dataUrl, text, size: file.size };
}

export async function extractFile(file) {
  if (!file || !isSupportedFile(file)) throw new Error('Supported files: TXT, Markdown, CSV, JSON, HTML, XML, PDF and images.');
  if (Number(file.size) > MAX_FILE_BYTES) throw new Error(`${file.name}: files must be 4 MB or smaller.`);
  const ext = extension(file.name);
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return readImage(file);
  if (type === 'application/pdf' || ext === 'pdf') {
    const result = await extractPdf(file);
    if (!result.text) throw new Error(`${file.name}: no selectable text was found. Scanned PDFs need OCR first.`);
    return { name: String(file.name || 'PDF').slice(0, 120), kind: 'text', text: result.text, note: result.note, size: file.size };
  }
  const raw = await file.text();
  let source = raw;
  if (ext === 'html' || ext === 'htm' || type === 'text/html') {
    // Strip active and presentation-only content before sending document text
    // to a model. The file is never inserted into the live page DOM.
    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    parsed.querySelectorAll('script,style,noscript,iframe,object,embed,svg,canvas').forEach((node) => node.remove());
    source = parsed.body?.innerText || parsed.body?.textContent || '';
  }
  const text = safeText(source);
  if (!text) throw new Error(`${file.name}: no readable text was found.`);
  return { name: String(file.name || 'Text file').slice(0, 120), kind: 'text', text, size: file.size };
}

export function buildAttachmentMessages(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).slice(0, 6).map((item) => ({
    name: String(item?.name || 'Attachment').slice(0, 120),
    text: item?.text ? safeText(item.text) : '',
  })).filter((item) => item.text);
}
