import axios from 'axios';
import path from 'path';
import fs from 'fs/promises';
import Document from '../models/Document.js';
import { ensureStoreDir, getStorePath } from '../config/store.js';
import { getPdfMetadata } from './pdfMetadata.js';
import { sha256Hex } from '../utils/hash.js';

/**
 * Download PDF from URL, save to store, create Document.
 * If a document with the same file hash exists, returns { doc: existing, duplicate: true } without saving again.
 * Otherwise returns the new document.
 */
export async function downloadPdfFromUrl(url, title) {
  ensureStoreDir();
  const response = await axios({
    method: 'get',
    url,
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: 100 * 1024 * 1024,
    headers: { 'User-Agent': 'PDF-Manager/1.0' },
    validateStatus: (status) => status >= 200 && status < 300,
  }).catch((err) => {
    const status = err.response?.status;
    const message = err.response?.data ? 'Invalid response' : err.message || 'Download failed';
    const e = new Error(message);
    e.statusCode = status || 502;
    throw e;
  });

  const contentType = (response.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('pdf')) {
    const e = new Error('URL did not return a PDF (content-type: ' + contentType + ')');
    e.statusCode = 400;
    throw e;
  }

  const buffer = Buffer.from(response.data);
  const fileHash = sha256Hex(buffer);
  const existing = await Document.findOne({ fileHash });
  if (existing) {
    return { doc: existing, duplicate: true };
  }

  const suggestedName = title && title.trim() ? title.trim() : path.basename(new URL(url).pathname) || 'document';
  const base = suggestedName.replace(/\.pdf$/i, '');
  const filename = `${base}-${Date.now()}.pdf`;
  const storePath = getStorePath();
  const fullPath = path.join(storePath, filename);
  await fs.writeFile(fullPath, buffer);

  const doc = await Document.create({
    filename,
    title: base,
    sourceUrl: url,
    filePath: filename,
    fileSize: buffer.length,
    fileHash,
  });
  const meta = await getPdfMetadata(buffer);
  if (meta.title) doc.title = meta.title;
  if (meta.author) doc.author = meta.author;
  if (meta.publishDate) doc.publishDate = meta.publishDate;
  await doc.save();
  return { doc, duplicate: false };
}
