# PDF Manager

Web app to manage PDF documents: add from URL, upload files, search, tag, and open. Deployable as a service. Uses **MongoDB** for metadata and stores PDF files on disk.

## Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Storage**: PDF files in a configurable directory (e.g. `backend/data/pdf-store`)

## Quick start (local)

1. **MongoDB** must be running (e.g. local install or Docker: `docker run -d -p 27017:27017 mongo:7`).

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env   # set MONGODB_URI if needed
   npm install
   npm run dev
   ```
   API: http://localhost:4000

3. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   App: http://localhost:3000 (proxies `/api` and `/files` to the backend).

## Run with Docker Compose

Runs MongoDB, backend, and frontend together. Frontend is built and served by nginx; it proxies API and file requests to the backend.

```bash
docker compose up -d
```

- App: http://localhost:3000  
- API: http://localhost:4000  
- MongoDB: localhost:27017 (for external tools if needed)

PDFs are stored in a Docker volume `pdf_store`. MongoDB data in `mongodb_data`.

## Environment (backend)

| Variable         | Description                    | Default |
|------------------|--------------------------------|--------|
| `MONGODB_URI`    | MongoDB connection string      | `mongodb://localhost:27017/pdf_manager` |
| `PDF_STORE_PATH` | Directory for PDF files       | `./data/pdf-store` (relative to backend) |
| `PORT`           | Server port                    | `4000` |

Copy `backend/.env.example` to `backend/.env` and adjust.

## API overview

- `GET /api/documents` — List documents. Query: `q` (search), `tagId`, `sort`
- `GET /api/documents/:id` — One document
- `POST /api/documents/upload` — Upload PDF (multipart, field `file`)
- `POST /api/documents/from-url` — Add from URL (JSON: `url`, optional `title`)
- `PATCH /api/documents/:id` — Update (JSON: `title`, `notes`, `tagIds`)
- `DELETE /api/documents/:id` — Remove. Query: `deleteFile=true` to delete file from disk
- `GET /files/:filePath` — Serve stored PDF file
- `GET /api/tags` — List tags
- `POST /api/tags` — Create tag (JSON: `name`, optional `color`)
- `PATCH /api/tags/:id` — Update tag
- `DELETE /api/tags/:id` — Delete tag

## Deploying as a service

- Use **Docker Compose** on a VPS or any host with Docker.
- Set `MONGODB_URI` to your MongoDB instance (e.g. Atlas or a managed MongoDB). If using Atlas, ensure the app server’s IP is allowed.
- For production, put the app behind a reverse proxy (e.g. Nginx or Caddy) with HTTPS and optional HTTP auth if you want a simple single-user lock.

See [PROPOSAL.md](./PROPOSAL.md) for the full product and data model.
