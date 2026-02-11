import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import Document from '../models/Document.js';
import { ensureStoreDir, getStorePath } from '../config/store.js';
import { downloadPdfFromUrl } from '../services/downloadPdf.js';

const router = Router();
ensureStoreDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getStorePath()),
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname, '.pdf') || 'document';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const name = `${base}-${unique}.pdf`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (ok) cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

// List documents (with optional search and tag filter)
router.get('/', async (req, res) => {
  try {
    const { q, tagId, sort = '-addedAt' } = req.query;
    const filter = {};
    if (tagId) filter.tagIds = tagId;
    if (q && q.trim()) {
      filter.$text = { $search: q.trim() };
    }
    const query = (q && q.trim()) ? { ...filter, $text: { $search: q.trim() } } : filter;
    const docs = await Document.find(query).sort(sort).populate('tagIds').lean();
    res.json(docs);
  } catch (err) {
    if (err.name === 'MongoError' && err.code === 2) {
      const { q, tagId, sort = '-addedAt' } = req.query;
      const filter = {};
      if (tagId) filter.tagIds = tagId;
      if (q && q.trim()) {
        filter.$or = [
          { title: new RegExp(q.trim(), 'i') },
          { filename: new RegExp(q.trim(), 'i') },
          { notes: new RegExp(q.trim(), 'i') },
        ];
      }
      const docs = await Document.find(filter).sort(sort).populate('tagIds').lean();
      return res.json(docs);
    }
    res.status(500).json({ error: err.message });
  }
});

// Get one document
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate('tagIds').lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload PDF (multipart)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const title = req.body.title || path.basename(req.file.originalname, '.pdf');
    const doc = await Document.create({
      filename: req.file.originalname,
      title,
      filePath: req.file.filename,
      fileSize: req.file.size,
      notes: req.body.notes || '',
    });
    const populated = await Document.findById(doc._id).populate('tagIds').lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add PDF from URL
router.post('/from-url', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });
    const result = await downloadPdfFromUrl(url.trim(), title);
    const populated = await Document.findById(result._id).populate('tagIds').lean();
    res.status(201).json(populated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Download failed' });
  }
});

// Update document (title, notes, tagIds)
router.patch('/:id', async (req, res) => {
  try {
    const { title, notes, tagIds } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (notes !== undefined) update.notes = notes;
    if (tagIds !== undefined) update.tagIds = Array.isArray(tagIds) ? tagIds : [];
    const doc = await Document.findByIdAndUpdate(req.params.id, update, { new: true }).populate('tagIds').lean();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document (and file if requested)
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const deleteFile = req.query.deleteFile === 'true';
    if (deleteFile) {
      const storePath = getStorePath();
      const fullPath = path.join(storePath, doc.filePath);
      await fs.unlink(fullPath).catch(() => {});
    }
    await Document.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
