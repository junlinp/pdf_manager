import { Router } from 'express';
import Tag from '../models/Tag.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find().sort('name').lean();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    const tag = await Tag.create({ name: name.trim(), color: color || null });
    res.status(201).json(tag);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Tag already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (color !== undefined) update.color = color;
    const tag = await Tag.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
