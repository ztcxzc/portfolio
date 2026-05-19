import { useCallback, useEffect, useRef, useState } from 'react';

const TYPE_LABELS = { website: 'Website', mobile: 'Mobile app', mac: 'Mac app' };

const EMPTY_PROJECT = {
  id: '',
  name: '',
  type: 'website',
  category: 'Website',
  year: String(new Date().getFullYear()),
  strapline: '',
  summary: '',
  description: '',
  accent: '#22C55E',
  surface: '#DCFCE7',
  ink: '#14532D',
  stack: '',
  previewTitle: '',
  previewBadges: '',
  previewSeries: '70, 50, 80, 60',
  highlights: '',
  stats: [
    { label: '', value: '' },
    { label: '', value: '' },
    { label: '', value: '' },
  ],
};

function toForm(project) {
  return {
    ...project,
    stack:          Array.isArray(project.stack)         ? project.stack.join(', ')         : project.stack         ?? '',
    previewBadges:  Array.isArray(project.previewBadges) ? project.previewBadges.join(', ') : project.previewBadges ?? '',
    previewSeries:  Array.isArray(project.previewSeries) ? project.previewSeries.join(', ') : String(project.previewSeries ?? ''),
    highlights:     Array.isArray(project.highlights)    ? project.highlights.join('\n')     : project.highlights    ?? '',
    stats: [
      ...(project.stats || []),
      { label: '', value: '' },
      { label: '', value: '' },
      { label: '', value: '' },
    ].slice(0, 3),
  };
}

function fromForm(form) {
  const id = form.id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    ...form,
    id,
    category: TYPE_LABELS[form.type] ?? 'Website',
    stack:         form.stack.split(',').map((s) => s.trim()).filter(Boolean),
    previewBadges: form.previewBadges.split(',').map((s) => s.trim()).filter(Boolean),
    previewSeries: form.previewSeries.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)),
    highlights:    form.highlights.split('\n').map((s) => s.trim()).filter(Boolean),
    stats:         form.stats.filter((s) => s.label || s.value),
  };
}

/* ─── Icons ─────────────────────────────────────────── */
function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M3 5h14M8 5V3h4v2M6 5l1 11h6l1-11" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10l5 5 7-7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13V3M6 7l4-4 4 4" />
      <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
    </svg>
  );
}

/* ── Settings Modal ──────────────────────────────────── */
function SettingsModal({ onClose, onSaved }) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    await window.portfolioAPI.setToken(token.trim());
    setSaving(false);
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">GitHub Settings</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal__body">
          <p className="modal__desc">
            Enter a GitHub Personal Access Token with <strong>repo</strong> scope to publish directly to <code>ztcxzc/portfolio</code>.
          </p>
          <ol className="modal__steps">
            <li>Go to <strong>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</strong></li>
            <li>Click <strong>Generate new token</strong>, tick <strong>repo</strong> scope</li>
            <li>Copy and paste it below</li>
          </ol>
          <div className="field" style={{ marginTop: 16 }}>
            <label className="field__label">Personal Access Token</label>
            <input
              className="field__input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              autoFocus
            />
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            onClick={handleSave}
            disabled={saving || !token.trim()}
          >
            {saving ? 'Saving…' : 'Save Token'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast toast--${toast.type}`}>{toast.message}</div>;
}

/* ─── Main App ───────────────────────────────────────── */
export default function ManagerApp() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataPath, setDataPath] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /* Load on mount */
  useEffect(() => {
    if (!window.portfolioAPI) return;
    window.portfolioAPI.getProjects().then(setProjects);
    window.portfolioAPI.getDataPath().then(setDataPath);
    window.portfolioAPI.getToken().then((t) => setHasToken(!!t));
  }, []);

  /* Populate form when selection changes */
  useEffect(() => {
    if (selectedId) {
      const project = projects.find((p) => p.id === selectedId);
      if (project) {
        setForm(toForm(project));
        setIsDirty(false);
        setIsNew(false);
      }
    }
  }, [selectedId, projects]);

  const handleNewProject = useCallback(() => {
    setSelectedId(null);
    setForm({ ...EMPTY_PROJECT });
    setIsDirty(false);
    setIsNew(true);
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setIsNew(false);
  }, []);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const setType = useCallback((type) => {
    setForm((prev) => ({ ...prev, type, category: TYPE_LABELS[type] ?? 'Website' }));
    setIsDirty(true);
  }, []);

  const setStat = useCallback((idx, key, value) => {
    setForm((prev) => {
      const stats = [...prev.stats];
      stats[idx] = { ...stats[idx], [key]: value };
      return { ...prev, stats };
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      showToast('error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const project = fromForm(form);
      await window.portfolioAPI.saveProject(project);
      const updated = await window.portfolioAPI.getProjects();
      setProjects(updated);
      setSelectedId(project.id);
      setIsNew(false);
      setIsDirty(false);
      showToast('success', `"${project.name}" saved — website auto-refreshes`);
    } catch {
      showToast('error', 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, showToast]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    if (!window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    await window.portfolioAPI.deleteProject(selectedId);
    const updated = await window.portfolioAPI.getProjects();
    setProjects(updated);
    setSelectedId(null);
    setIsNew(false);
    setIsDirty(false);
    showToast('success', `"${form.name}" deleted`);
  }, [selectedId, form.name, showToast]);

  const handleExport = useCallback(async () => {
    const result = await window.portfolioAPI.exportProjects();
    if (result.success) showToast('success', `Exported → ${result.filePath.split('/').pop()}`);
  }, [showToast]);

  const handlePublish = useCallback(async () => {
    if (!hasToken) {
      setSettingsOpen(true);
      return;
    }
    setPublishing(true);
    try {
      const result = await window.portfolioAPI.publishToGitHub();
      if (result.success) {
        showToast('success', 'Published! Render will redeploy in ~2 min.');
      } else {
        showToast('error', result.error || 'Publish failed');
      }
    } catch (err) {
      showToast('error', err.message || 'Network error');
    } finally {
      setPublishing(false);
    }
  }, [hasToken, showToast]);

  const grouped = {
    website: projects.filter((p) => p.type === 'website'),
    mobile:  projects.filter((p) => p.type === 'mobile'),
    mac:     projects.filter((p) => p.type === 'mac'),
  };

  const showEditor = isNew || !!selectedId;
  const shortPath = dataPath ? dataPath.replace(/.*\/(src\/)/, '$1') : '';

  return (
    <div className="app">
      <Toast toast={toast} />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setHasToken(true);
            setSettingsOpen(false);
            showToast('success', 'Token saved — ready to publish');
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <h1 className="sidebar__title">Projects</h1>
          <div className="sidebar__header-actions">
            <button className="sidebar__icon-btn" onClick={() => setSettingsOpen(true)} title="GitHub settings" aria-label="Settings">
              <GearIcon />
            </button>
            <button className="sidebar__add-btn" onClick={handleNewProject} title="New project" aria-label="Add project">
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="sidebar__list">
          {isNew && (
            <div className="sidebar__group">
              <div className="sidebar__item sidebar__item--new is-active">
                <span className="sidebar__dot" />
                <span className="sidebar__name">{form.name || 'Untitled project'}</span>
                {isDirty && <span className="sidebar__unsaved" />}
              </div>
            </div>
          )}

          {Object.entries({ website: 'Websites', mobile: 'Mobile', mac: 'Mac' }).map(([type, label]) => {
            const items = grouped[type];
            if (!items.length) return null;
            return (
              <div key={type} className="sidebar__group">
                <div className="sidebar__group-label">{label}</div>
                {items.map((project) => (
                  <button
                    key={project.id}
                    className={`sidebar__item${selectedId === project.id ? ' is-active' : ''}`}
                    onClick={() => handleSelect(project.id)}
                  >
                    <span className="sidebar__dot" style={{ background: project.accent }} />
                    <span className="sidebar__name">{project.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {shortPath && (
          <div className="sidebar__footer">
            <span className="sidebar__footer-path">{shortPath}</span>
            <div className="sidebar__footer-actions">
              <button className="sidebar__export-btn" onClick={handleExport} title="Export projects.json to a custom location">
                Export
              </button>
              <button
                className={`sidebar__publish-btn${publishing ? ' btn--loading' : ''}${!hasToken ? ' sidebar__publish-btn--warn' : ''}`}
                onClick={handlePublish}
                disabled={publishing}
                title={hasToken ? 'Push all projects to ztcxzc/portfolio → triggers Render redeploy' : 'Set GitHub token first'}
              >
                <UploadIcon />
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Editor ──────────────────────────────── */}
      <main className="editor">
        {!showEditor ? (
          <div className="editor__empty">
            <div className="editor__empty-icon"><FolderIcon /></div>
            <h2>No project selected</h2>
            <p>Choose a project from the sidebar, or click <strong>+</strong> to add a new one.</p>
          </div>
        ) : (
          <>
            <div className="editor__header">
              <div>
                <h2 className="editor__title">{isNew ? 'New Project' : (form.name || 'Untitled')}</h2>
                {!isNew && <p className="editor__subtitle">{form.id}</p>}
              </div>
              {isDirty && <span className="editor__dirty">Unsaved changes</span>}
            </div>

            <div className="editor__body">

              {/* Identity */}
              <section className="form-section">
                <h3 className="form-section__title">Identity</h3>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label className="field__label">Name *</label>
                    <input className="field__input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="My Project" />
                  </div>
                  <div className="field">
                    <label className="field__label">Year</label>
                    <input className="field__input" value={form.year} onChange={(e) => setField('year', e.target.value)} placeholder="2026" maxLength={4} />
                  </div>
                </div>

                <div className="field">
                  <label className="field__label">Platform</label>
                  <div className="radio-group">
                    {Object.entries(TYPE_LABELS).map(([val, lbl]) => (
                      <label key={val} className={`radio-option${form.type === val ? ' is-active' : ''}`}>
                        <input type="radio" name="type" value={val} checked={form.type === val} onChange={() => setType(val)} />
                        {lbl}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label className="field__label">Strapline <span className="field__hint">short tagline</span></label>
                  <input className="field__input" value={form.strapline} onChange={(e) => setField('strapline', e.target.value)} placeholder="What the project is, in 5 words" />
                </div>
              </section>

              {/* Copy */}
              <section className="form-section">
                <h3 className="form-section__title">Copy</h3>
                <div className="field">
                  <label className="field__label">Summary <span className="field__hint">shown on project list row</span></label>
                  <textarea className="field__textarea" rows={2} value={form.summary} onChange={(e) => setField('summary', e.target.value)} placeholder="One or two sentences describing what you built and why." />
                </div>
                <div className="field">
                  <label className="field__label">Description <span className="field__hint">shown in expanded detail panel</span></label>
                  <textarea className="field__textarea" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Deeper context: your approach, technical decisions, and outcome." />
                </div>
              </section>

              {/* Preview Colors */}
              <section className="form-section">
                <h3 className="form-section__title">Preview Colors</h3>
                <div className="form-grid form-grid--3">
                  {['accent', 'surface', 'ink'].map((key) => (
                    <div key={key} className="field">
                      <label className="field__label">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                      <div className="color-input">
                        <input type="color" className="color-input__swatch" value={form[key]} onChange={(e) => setField(key, e.target.value)} />
                        <input className="field__input color-input__text" value={form[key]} onChange={(e) => setField(key, e.target.value)} maxLength={7} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Preview Content */}
              <section className="form-section">
                <h3 className="form-section__title">Preview Content</h3>
                <div className="field">
                  <label className="field__label">Preview Title <span className="field__hint">shown inside the preview frame</span></label>
                  <input className="field__input" value={form.previewTitle} onChange={(e) => setField('previewTitle', e.target.value)} placeholder="Headline shown in the browser / phone / desktop mockup" />
                </div>
                <div className="form-grid form-grid--2">
                  <div className="field">
                    <label className="field__label">Badges <span className="field__hint">comma-separated</span></label>
                    <input className="field__input" value={form.previewBadges} onChange={(e) => setField('previewBadges', e.target.value)} placeholder="Tag one, Tag two, Tag three" />
                  </div>
                  <div className="field">
                    <label className="field__label">Chart Data <span className="field__hint">4 values, 0–100</span></label>
                    <input className="field__input" value={form.previewSeries} onChange={(e) => setField('previewSeries', e.target.value)} placeholder="82, 56, 72, 44" />
                  </div>
                </div>
              </section>

              {/* Tech & Highlights */}
              <section className="form-section">
                <h3 className="form-section__title">Tech &amp; Highlights</h3>
                <div className="field">
                  <label className="field__label">Tech Stack <span className="field__hint">comma-separated</span></label>
                  <input className="field__input" value={form.stack} onChange={(e) => setField('stack', e.target.value)} placeholder="React, TypeScript, Tailwind CSS" />
                </div>
                <div className="field">
                  <label className="field__label">Highlights <span className="field__hint">one per line</span></label>
                  <textarea className="field__textarea" rows={3} value={form.highlights} onChange={(e) => setField('highlights', e.target.value)} placeholder={'Key feature or decision\nAnother highlight\nA third point'} />
                </div>
              </section>

              {/* Stats */}
              <section className="form-section">
                <h3 className="form-section__title">Stats</h3>
                <div className="stats-grid">
                  {form.stats.map((stat, i) => (
                    <div key={i} className="stats-row">
                      <span className="stats-row__num">{i + 1}</span>
                      <input className="field__input" placeholder="Label" value={stat.label} onChange={(e) => setStat(i, 'label', e.target.value)} />
                      <input className="field__input" placeholder="Value" value={stat.value} onChange={(e) => setStat(i, 'value', e.target.value)} />
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="editor__footer">
              {!isNew && (
                <button className="btn btn--danger" onClick={handleDelete}>
                  <TrashIcon />
                  Delete
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
                onClick={handleSave}
                disabled={saving}
              >
                {!saving && <CheckIcon />}
                {saving ? 'Saving…' : isNew ? 'Add to website' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
