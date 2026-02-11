import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..'); // backend/
const defaultStore = path.join(root, 'data', 'pdf-store');

export function getStorePath() {
  const env = process.env.PDF_STORE_PATH;
  if (env) return path.isAbsolute(env) ? env : path.join(root, env);
  return defaultStore;
}

export function ensureStoreDir() {
  const dir = getStorePath();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
