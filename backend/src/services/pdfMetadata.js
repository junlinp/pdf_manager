import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');

/** Max characters to parse when deriving title from content (first pages). */
const TITLE_FROM_CONTENT_MAX_CHARS = 4000;

/** Min/max length for a line to be considered a valid title. */
const TITLE_LINE_MIN = 10;
const TITLE_LINE_MAX = 300;

/** Max chars to scan for author-from-content (first page). */
const AUTHOR_FROM_CONTENT_MAX_CHARS = 3500;

/**
 * Extract text content from PDF. Supports pdf-parse v1 and v2.
 * @param {Buffer} buffer - PDF file content
 * @param {{ firstPages?: number }} options - optional: limit to first N pages (v2 only)
 * @returns {Promise<string>} extracted text (may be empty)
 */
export async function getPdfText(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return '';
  try {
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        const first = options.firstPages ?? 0;
        const result = await parser.getText(first ? { first } : undefined);
        const text = result?.text ?? '';
        await parser.destroy?.();
        return typeof text === 'string' ? text : '';
      } finally {
        await parser.destroy?.();
      }
    } else {
      const data = await pdfParseModule(buffer);
      const text = data?.text ?? '';
      return typeof text === 'string' ? text : '';
    }
  } catch {
    return '';
  }
}

/**
 * Derive a title from the first meaningful line of PDF content (e.g. first heading).
 * Used when PDF has no metadata Title. Picks first non-empty line within length bounds.
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>}
 */
export async function getTitleFromContent(buffer) {
  const text = await getPdfText(buffer, { firstPages: 2 });
  const head = text.slice(0, TITLE_FROM_CONTENT_MAX_CHARS);
  const lines = head.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t.length >= TITLE_LINE_MIN && t.length <= TITLE_LINE_MAX) return t;
  }
  // Fallback: first line that's not too long
  for (const line of lines) {
    const t = line.trim();
    if (t.length > 0 && t.length <= TITLE_LINE_MAX) return t;
  }
  return null;
}

/**
 * Extract the document Title from PDF metadata. Returns null on failure or if no title.
 * Supports pdf-parse v1 (default function) and v2 (PDFParse class + getInfo).
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>}
 */
export async function getPdfTitle(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  try {
    let info = null;
    let metadata = null;

    // pdf-parse v2: PDFParse class with getInfo()
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        const result = await parser.getInfo();
        info = result?.info;
        metadata = result?.metadata;
      } finally {
        await parser.destroy?.();
      }
    } else {
      // pdf-parse v1: default function (buffer) => Promise<{ info, metadata }>
      const data = await pdfParseModule(buffer);
      info = data?.info;
      metadata = data?.metadata;
    }

    const infoObj = info || {};
    const title =
      infoObj.Title ??
      infoObj.title ??
      (typeof metadata?.get === 'function' ? metadata.get('Title') ?? metadata.get('title') : null) ??
      (metadata && typeof metadata === 'object' && !metadata.get ? metadata.Title ?? metadata.title : null);

    if (typeof title === 'string') {
      const t = title.trim();
      if (t) return t;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get best available title: metadata first, then first meaningful line from content, then null.
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>}
 */
export async function getPdfTitleOrFromContent(buffer) {
  const fromMeta = await getPdfTitle(buffer);
  if (fromMeta) return fromMeta;
  return getTitleFromContent(buffer);
}

/**
 * Get PDF metadata (info dict) with a single parse. Returns null on failure.
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<object|null>} { Author, Creator, Producer, CreationDate, ModDate, ... }
 */
async function getPdfInfoObject(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  try {
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        const result = await parser.getInfo();
        return result?.info ?? null;
      } finally {
        await parser.destroy?.();
      }
    } else {
      const data = await pdfParseModule(buffer);
      return data?.info ?? null;
    }
  } catch {
    return null;
  }
}

/**
 * Parse PDF date string (D:YYYYMMDDHHmmSS...) to ISO date string or null.
 * @param {string} pdfDate - e.g. "D:20210427120000+00'00'"
 * @returns {string|null} ISO date string YYYY-MM-DD or null
 */
function parsePdfDate(pdfDate) {
  if (typeof pdfDate !== 'string') return null;
  const m = pdfDate.trim().match(/D:(\d{4})(\d{2})?(\d{2})?/);
  if (!m) return null;
  const year = m[1];
  const month = (m[2] || '01').padStart(2, '0');
  const day = (m[3] || '01').padStart(2, '0');
  if (year.length !== 4) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Try to derive author from first page content when metadata Author is empty.
 * Looks for "Author(s):", "Authors:", "By "; or in papers, lines like "Name 1 , Name 2" (merge and strip refs).
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>}
 */
async function getAuthorFromContent(buffer) {
  const text = await getPdfText(buffer, { firstPages: 1 });
  const head = text.slice(0, AUTHOR_FROM_CONTENT_MAX_CHARS);
  const lines = head.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    let author = null;
    if (lower.startsWith('author(s):')) author = line.slice(10).trim();
    else if (lower.startsWith('authors:')) author = line.slice(9).trim();
    else if (lower.startsWith('author:')) author = line.slice(8).trim();
    else if (lower.startsWith('by ')) author = line.slice(3).trim();
    if (author && author.length >= 2 && author.length <= 400) return author;
  }
  const stopMarkers = /^(may\s+\d|arxiv|contents|preface|notation|\d+\s+introduction)/i;
  const isOnlyDigit = /^\d+$/;
  const looksLikeNameStart = /^[A-Z][a-z]+(\s+[A-Z]\.?)?\s+[A-Z][a-z]/;
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (stopMarkers.test(lines[i])) break;
    const line = lines[i];
    if (!looksLikeNameStart.test(line) || line.length < 10) continue;
    const hasCommaOrRef = line.includes(',') || /\s\d\s*$/.test(line) || (i + 1 < lines.length && isOnlyDigit.test(lines[i + 1]));
    if (hasCommaOrRef) {
      startIdx = i;
      break;
    }
  }
  if (startIdx >= 0) {
    const parts = [];
    for (let i = startIdx; i < Math.min(startIdx + 15, lines.length); i++) {
      const line = lines[i];
      if (stopMarkers.test(line)) break;
      if (isOnlyDigit.test(line)) continue;
      parts.push(line);
      if (line.includes('arXiv') || /^\d+\s+[A-Z]/.test(line)) break;
    }
    let merged = parts.join(' ').replace(/\s+\d+\s*,/g, ', ').replace(/\s+\d+$/g, '').trim();
    merged = merged.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/\s+,/g, ', ');
    if (merged.length >= 10 && merged.length <= 400) return merged;
  }
  for (const line of lines) {
    if (line.length < 15 || line.length > 400) continue;
    if (line.endsWith(',') && line.length < 40) continue;
    if (/\bet\s+al\.?$/i.test(line)) return line;
    if ((line.includes(',') || line.includes(' and ')) && /[A-Z][a-z]+/.test(line)) return line;
  }
  return null;
}

/**
 * Extract author from PDF metadata, with fallback to content (e.g. "Authors:" line).
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>}
 */
export async function getPdfAuthor(buffer) {
  const info = await getPdfInfoObject(buffer);
  if (info) {
    const author = info.Author ?? info.author ?? null;
    if (typeof author === 'string') {
      const t = author.trim();
      if (t) return t;
    }
  }
  return getAuthorFromContent(buffer);
}

/**
 * Extract creation or modification date from PDF metadata. Prefers CreationDate, then ModDate.
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<string|null>} ISO date string YYYY-MM-DD or null
 */
export async function getPdfPublishDate(buffer) {
  const info = await getPdfInfoObject(buffer);
  if (!info) return null;
  const raw =
    info.CreationDate ??
    info.ModDate ??
    info['CreationDate'] ??
    info['ModDate'] ??
    null;
  return parsePdfDate(raw);
}

/**
 * Extract title, author, and publish date in one pass (one getInfo; title may use content).
 * @param {Buffer} buffer - PDF file content
 * @returns {Promise<{ title: string|null, author: string|null, publishDate: string|null }>}
 */
export async function getPdfMetadata(buffer) {
  const info = await getPdfInfoObject(buffer);
  let title = null;
  let author = null;
  let publishDate = null;
  if (info) {
    const authorVal = info.Author ?? info.author;
    if (typeof authorVal === 'string' && authorVal.trim()) author = authorVal.trim();
    const rawDate = info.CreationDate ?? info.ModDate ?? info['CreationDate'] ?? info['ModDate'];
    publishDate = parsePdfDate(rawDate);
    const titleVal = info.Title ?? info.title;
    if (typeof titleVal === 'string' && titleVal.trim()) title = titleVal.trim();
  }
  if (!author) author = await getAuthorFromContent(buffer);
  if (!title) title = await getTitleFromContent(buffer);
  return { title, author, publishDate };
}
