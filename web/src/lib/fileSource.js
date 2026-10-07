// Turns files picked on the device (a PDF, or photos/screenshots of a
// document) into what the AI import needs: base64 data for Claude, plus the
// PDF's own text so the drafted details can be checked against it.

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ACCEPTED_FILE_TYPES = ['application/pdf', ...IMAGE_TYPES].join(',');

// The API takes requests up to 32 MB, and base64 adds a third, so a PDF much
// over 20 MB can't be sent.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 10;
// Claude downscales anything larger than this on its long edge anyway, so
// shrinking first only saves upload time (and keeps phone photos under the
// API's 10 MB per-image limit).
const MAX_IMAGE_EDGE = 2576;
// Below this much text a PDF is treated as scanned: there's nothing reliable
// to check the details against.
const MIN_PDF_TEXT_CHARS = 200;

// The files picked on the search screen, held here while the app navigates to
// the import screen (router state can't be relied on to carry File objects).
let pending = null;

export function setPendingImport(files) {
  pending = files;
}

export function getPendingImport() {
  return pending;
}

// Returns an error message if this selection can't be imported, else null.
export function checkFileSelection(files) {
  if (!files || files.length === 0) return 'No file was chosen.';
  const pdfs = files.filter(f => f.type === 'application/pdf');
  const images = files.filter(f => IMAGE_TYPES.includes(f.type));
  if (pdfs.length + images.length !== files.length) {
    return 'Only PDFs and images (JPEG, PNG, GIF or WebP) can be imported.';
  }
  if (pdfs.length > 1 || (pdfs.length === 1 && images.length > 0)) {
    return 'Choose one PDF, or up to 10 images of the same document.';
  }
  if (images.length > MAX_IMAGES) return `Choose at most ${MAX_IMAGES} images at a time.`;
  if (pdfs.length === 1 && pdfs[0].size > MAX_PDF_BYTES) {
    return 'That PDF is over 20 MB, which is too large to send for reading.';
  }
  return null;
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // In chunks: spreading a whole PDF into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // pdf.js takes ownership of the buffer it's given, so it gets a copy.
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

// Re-encodes an image no larger than Claude will use; small ones pass through.
async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 5 * 1024 * 1024) {
    bitmap.close();
    return { mediaType: file.type, base64: bytesToBase64(await file.arrayBuffer()) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

// Reads the chosen files. `pageText` is the PDF's own text, or null when
// there is none to check against (images, or a scanned PDF).
export async function readFilesForImport(files) {
  const problem = checkFileSelection(files);
  if (problem) throw new Error(problem);

  if (files[0].type === 'application/pdf') {
    const buffer = await files[0].arrayBuffer();
    // A PDF pdf.js can't parse may still be readable by Claude, so a failure
    // here only loses the cross-check.
    const text = await extractPdfText(buffer).catch(() => '');
    return {
      kind: 'pdf',
      names: [files[0].name],
      parts: [{ type: 'document', mediaType: 'application/pdf', base64: bytesToBase64(buffer) }],
      pageText: text.replace(/\s+/g, ' ').trim().length >= MIN_PDF_TEXT_CHARS ? text : null,
    };
  }

  const parts = [];
  for (const file of files) parts.push({ type: 'image', ...(await prepareImage(file)) });
  return { kind: 'image', names: files.map(f => f.name), parts, pageText: null };
}
