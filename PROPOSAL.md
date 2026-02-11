# PDF Manager — Project Proposal

## 1. Overview

**PDF Manager** is an application to manage PDF documents that are downloaded from web URLs. It provides a single place to add, organize, search, and view PDFs obtained from the web, with optional metadata and tagging.

---

## 2. Goals

- **Ingest**: Add PDFs by URL (download and store locally) or by local file path.
- **Organize**: Categorize and tag PDFs (e.g. by topic, source, project).
- **Discover**: Search by filename, metadata, tags, and optionally full-text (if implemented).
- **Access**: Open/view PDFs quickly from the app or from the filesystem.
- **Maintain**: Update metadata, move/delete documents, and keep a clean library.

---

## 3. Core Features (Proposal)

| Feature | Description | Priority |
|--------|-------------|----------|
| **Add by URL** | Paste URL → fetch PDF → save to library with optional filename | Must-have |
| **Add local file** | Import existing PDF from disk | Must-have |
| **Metadata** | Title, source URL, added date, optional notes | Must-have |
| **Tags / categories** | User-defined tags or folders for grouping | Should-have |
| **Search** | By title, filename, tags, notes | Must-have |
| **List / grid view** | Browse all PDFs with sort and filter | Must-have |
| **Open PDF** | Open in system default viewer or in-app viewer | Must-have |
| **Delete / remove** | Remove from library (option: delete file or keep file) | Must-have |
| **Export / backup** | Export list or backup library path for portability | Nice-to-have |
| **Full-text search** | Index PDF text for content search | Nice-to-have |

---

## 4. User Workflows

1. **Add from web**  
   User pastes URL → app downloads PDF → saves to a configurable folder and creates a DB record with URL, date, optional title/notes/tags.

2. **Add from disk**  
   User selects file(s) → app copies/moves to library folder (optional) and registers in DB with metadata.

3. **Browse & search**  
   User sees list of PDFs, filters by tag/date, searches by text → clicks to open or edit metadata.

4. **Organize**  
   User edits tags, renames, adds notes, or moves to another category.

5. **Cleanup**  
   User deletes entries (with option to delete file or only remove from library).

---

## 5. Chosen Architecture: Deployable Web App + MongoDB

- **Frontend**: React + Vite — SPA with API client, deployable as static assets or behind same host.
- **Backend**: Node.js + Express — REST API, URL download, file upload, serves stored PDFs.
- **Database**: **MongoDB** — documents and tags; flexible schema, easy to scale and back up.
- **File storage**: Server-side directory (e.g. `./data/pdf-store` or volume mount); optional later: S3-compatible storage.
- **Deployment**: Run as a service (e.g. Docker Compose: app + MongoDB + optional reverse proxy). Single server or container platform (e.g. Railway, Render, VPS).

---

## 6. Data Model (MongoDB)

### Collection: `documents`

| Field       | Type     | Description |
|------------|----------|-------------|
| `_id`      | ObjectId | Default MongoDB id |
| `filename` | string   | Stored file name (unique per file) |
| `title`    | string   | Display title (defaults to filename) |
| `sourceUrl`| string?  | URL from which PDF was downloaded |
| `filePath` | string   | Relative path in storage (e.g. `abc123.pdf`) |
| `addedAt`  | Date     | When added |
| `notes`    | string?  | User notes |
| `fileSize` | number?  | Size in bytes |
| `pageCount`| number?  | Optional, if extracted |
| `tagIds`   | ObjectId[] | References to `tags._id` |

### Collection: `tags`

| Field  | Type   | Description |
|--------|--------|-------------|
| `_id`  | ObjectId | Default MongoDB id |
| `name` | string | Tag name (unique) |
| `color`| string?| Optional hex color for UI |

**File storage**: PDFs stored under a single root (e.g. `PDF_STORE_PATH`); `filePath` in DB is relative to that root (e.g. `{id}.pdf` or `{year}/{id}.pdf`).

---

## 7. Implementation Phases

| Phase | Scope | Outcome |
|-------|--------|---------|
| **1. Foundation** | Backend (Express + Mongoose), PDF store dir, frontend shell | Add/list PDFs (upload + list), open/delete via API and UI |
| **2. URL download** | Backend: fetch from URL, validate PDF, save to store + DB | Add by URL in UI |
| **3. Metadata & tags** | Tags API + document update; UI: edit title/notes, assign tags, filter | Organized library |
| **4. Search** | API: query by title, filename, tags, notes; UI: search bar + filters | Fast discovery |
| **5. Deploy & polish** | Docker Compose, env config, optional auth, in-app viewer | Service-ready |

---

## 8. Open Decisions

1. **Auth**: Single-user (no login) vs multi-user (e.g. JWT/sessions)? For single-user deploy, optional HTTP auth or reverse-proxy auth is enough.
2. **PDF storage**: Server disk only vs optional S3-compatible object storage for scale.
3. **Duplicate handling**: Same URL or same file hash — skip, replace, or add new version?
4. **Full-text search**: MongoDB text index on title/notes vs dedicated search (e.g. Atlas Search).

---

## 9. Next Steps

1. Implement **Phase 1**: backend API (upload, list, get, delete) + frontend (list, upload, add-by-URL placeholder).
2. Implement **Phase 2**: download-from-URL endpoint and UI.
3. Add tags and search (Phases 3–4), then Docker and deployment (Phase 5).
