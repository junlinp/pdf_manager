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

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>PDF Manager</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>Add from URL or upload, then browse and open.</p>
      </header>

      <section style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Add PDF</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <form onSubmit={handleAddByUrl} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: '1 1 320px' }}>
            <input
              type="url"
              placeholder="https://example.com/document.pdf"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{ flex: '1 1 200px', minWidth: 200 }}
            />
            <input
              type="text"
              placeholder="Optional title"
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
              style={{ width: 140 }}
            />
            <button type="submit" className="primary" disabled={urlLoading}>
              {urlLoading ? 'Downloading…' : 'Add from URL'}
            </button>
          </form>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              type="button"
              className="primary"
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
              style={{ display: 'none' }}
            />
          </span>
        </div>
        {urlError && <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontSize: '0.875rem' }}>{urlError}</p>}
        {uploadError && <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontSize: '0.875rem' }}>{uploadError}</p>}
        {duplicateMessage && (
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
            {duplicateMessage}
            <button type="button" onClick={() => setDuplicateMessage('')} style={{ marginLeft: 8, padding: '0 4px', fontSize: '0.75rem' }}>dismiss</button>
          </p>
        )}
      </section>

      <section style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search by title, filename, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320, flex: '1 1 200px' }}
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', minWidth: 140 }}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
      </section>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : list.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No PDFs yet. Add one from a URL or upload a file.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((doc) => (
            <li key={doc._id} className="doc-card">
              <div className="doc-card-inner">
                <div className="doc-info">
                  <a href={fileUrl(doc.filePath)} target="_blank" rel="noopener noreferrer" className="doc-title-link">
                    {(doc.title && doc.title.trim()) ? doc.title : doc.filename}
                  </a>
                  <div className="doc-meta-grid">
                    <div className="doc-meta-item" data-field="file">
                      <span className="doc-meta-label">File</span>
                      <span className="doc-meta-value" title={doc.filename}>{doc.filename}</span>
                    </div>
                    {doc.author && (
                      <div className="doc-meta-item" data-field="author">
                        <span className="doc-meta-label">Author</span>
                        <span className="doc-meta-value" title={doc.author}>{doc.author}</span>
                      </div>
                    )}
                    {doc.publishDate && (
                      <div className="doc-meta-item" data-field="published">
                        <span className="doc-meta-label">Published</span>
                        <span className="doc-meta-value">{doc.publishDate}</span>
                      </div>
                    )}
                    {doc.sourceUrl && (
                      <div className="doc-meta-item" data-field="source">
                        <span className="doc-meta-label">Source</span>
                        <span className="doc-meta-value">From URL</span>
                      </div>
                    )}
                    <div className="doc-meta-item" data-field="added">
                      <span className="doc-meta-label">Added</span>
                      <span className="doc-meta-value">{formatDate(doc.addedAt)}</span>
                    </div>
                  </div>
                  {doc.tagIds?.length > 0 && (
                    <div className="doc-tags">
                      {doc.tagIds.map((t) => (
                        <span key={t._id} className="doc-tag">{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="doc-actions">
                  <a href={fileUrl(doc.filePath)} target="_blank" rel="noopener noreferrer">
                    <button type="button">Open</button>
                  </a>
                  <button type="button" onClick={() => handleRefreshTitle(doc._id)} title="Extract title, author, and publish date from PDF">
                    Refresh metadata
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(doc._id, true)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
