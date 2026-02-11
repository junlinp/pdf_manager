import { useState, useEffect, useCallback } from 'react';

const API = '/api';

function useDocuments(query, tagId) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (tagId) params.set('tagId', tagId);
      const res = await fetch(`${API}/documents?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setList(data);
    } catch (e) {
      setError(e.message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [query, tagId]);
  useEffect(() => { fetchList(); }, [fetchList]);
  return { list, loading, error, refresh: fetchList };
}

function useTags() {
  const [tags, setTags] = useState([]);
  useEffect(() => {
    fetch(`${API}/tags`)
      .then((r) => r.json())
      .then(setTags)
      .catch(() => setTags([]));
  }, []);
  return tags;
}

function fileUrl(filePath) {
  if (!filePath) return '#';
  return `/files/${encodeURIComponent(filePath)}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'short' });
}

export default function App() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [duplicateMessage, setDuplicateMessage] = useState('');

  const tags = useTags();
  const { list, loading, error, refresh } = useDocuments(search, tagFilter || undefined);

  const handleAddByUrl = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setUrlError('');
    setUrlLoading(true);
    try {
      const res = await fetch(`${API}/documents/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), title: urlTitle.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setUrlInput('');
      setUrlTitle('');
      if (data.duplicate) setDuplicateMessage('This PDF is already in the library.');
      refresh();
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/documents/upload`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.duplicate) setDuplicateMessage('This PDF is already in the library.');
      refresh();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id, deleteFile) => {
    if (!confirm('Remove this document from the library?')) return;
    try {
      const res = await fetch(`${API}/documents/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' });
      if (res.ok) refresh();
    } catch (_) {}
  };

  const handleRefreshTitle = async (id) => {
    try {
      const res = await fetch(`${API}/documents/${id}/refresh-title`, { method: 'PATCH' });
      if (res.ok) refresh();
    } catch (_) {}
  };

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar-inner">
          <div>
            <h1 className="app-title">PDF Manager</h1>
            <p className="app-subtitle">Add from URL or upload, then browse and open.</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="add-pdf">
          <h2 className="add-pdf-title">Add PDF</h2>
          <div className="add-pdf-row">
            <form onSubmit={handleAddByUrl} className="add-pdf-form">
              <input
                type="url"
                className="input add-pdf-input-url"
                placeholder="https://example.com/document.pdf"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <input
                type="text"
                className="input add-pdf-input-title"
                placeholder="Optional title"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={urlLoading}>
                {urlLoading ? 'Adding…' : 'Add from URL'}
              </button>
            </form>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => document.getElementById('file-input').click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
            <input
              id="file-input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleUpload}
              className="input-file"
            />
          </div>
          {urlError && <p className="message-error">{urlError}</p>}
          {uploadError && <p className="message-error">{uploadError}</p>}
          {duplicateMessage && (
            <p className="message-info">
              {duplicateMessage}
              <button type="button" className="btn btn-ghost" onClick={() => setDuplicateMessage('')}>
                Dismiss
              </button>
            </p>
          )}
        </section>

        <div className="toolbar">
          <div className="search-wrap">
            <input
              type="search"
              className="input"
              placeholder="Search by title, filename, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="message-error">{error}</p>}
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">No PDFs yet. Add one from a URL or upload a file.</div>
        ) : (
          <ul className="doc-grid">
            {list.map((doc) => (
              <li key={doc._id} className="doc-card">
                <div className="doc-card-header">
                  <div className="doc-card-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <h3 className="doc-card-title">
                    <a href={fileUrl(doc.filePath)} target="_blank" rel="noopener noreferrer" title={(doc.title && doc.title.trim()) ? doc.title : doc.filename}>
                      {(doc.title && doc.title.trim()) ? doc.title : doc.filename}
                    </a>
                  </h3>
                </div>
                <div className="doc-meta">
                  {doc.author && <span>{doc.author}</span>}
                  {doc.publishDate && <span>{doc.publishDate}</span>}
                  <span>{formatDate(doc.addedAt)}</span>
                  {doc.sourceUrl && <span>From URL</span>}
                </div>
                {doc.tagIds?.length > 0 && (
                  <div className="doc-tags-wrap">
                    {doc.tagIds.map((t) => (
                      <span key={t._id} className="doc-tag">{t.name}</span>
                    ))}
                  </div>
                )}
                <div className="doc-card-actions">
                  <a href={fileUrl(doc.filePath)} target="_blank" rel="noopener noreferrer">
                    <button type="button" className="btn btn-primary">Open</button>
                  </a>
                  <button type="button" className="btn btn-ghost" onClick={() => handleRefreshTitle(doc._id)} title="Extract title, author, and publish date from PDF">
                    Refresh metadata
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => handleDelete(doc._id, true)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
