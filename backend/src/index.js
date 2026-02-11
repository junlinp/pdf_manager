import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDb } from './config/db.js';
import { getStorePath } from './config/store.js';
import documentsRouter from './routes/documents.js';
import tagsRouter from './routes/tags.js';

await connectDb();

const app = express();
app.use(cors());
app.use(express.json());

const storePath = getStorePath();
app.use('/files', express.static(storePath));

app.use('/api/documents', documentsRouter);
app.use('/api/tags', tagsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`PDF Manager API listening on http://localhost:${PORT}`);
  console.log(`PDF store: ${path.resolve(storePath)}`);
});
