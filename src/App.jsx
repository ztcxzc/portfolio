import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PROJECTS_DATA from './data/projects.json';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'website', label: 'Websites' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'mac', label: 'Mac' },
];

const PLATFORM_COPY = {
  website: {
    title: 'Website projects',
    description: 'Launch pages, editorial showcases, product marketing sites, and commerce experiences.',
  },
  mobile: {
    title: 'Mobile apps',
    description: 'Product flows that highlight onboarding, retention, tracking, and fast everyday interactions.',
  },
  mac: {
    title: 'Mac apps',
    description: 'Desktop tools designed around depth, clarity, and power-user workflows that deserve room to breathe.',
  },
};

const PROJECTS = PROJECTS_DATA;


function ArrowIcon() {
  return (
    <svg className="icon icon--arrow" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4.166 10h11.667m0 0-4.375-4.375M15.833 10l-4.375 4.375"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function PlatformIcon({ type }) {
  if (type === 'mobile') {
    return (
      <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="6.25" y="1.75" width="7.5" height="16.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8.5 4.25h3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
        <circle cx="10" cy="15.25" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (type === 'mac') {
    return (
      <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.25" y="3.5" width="15.5" height="10.25" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M7 16.25h6m-8.5 1.5h11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
      </svg>
    );
  }

  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.25" y="3.25" width="15.5" height="11.5" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6.25 16.75h7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}

function ProjectPreview({ project }) {
  const style = {
    '--preview-accent': project.accent,
    '--preview-surface': project.surface,
    '--preview-ink': project.ink,
  };

  const className = `preview-art preview-art--${project.type}`;

  if (project.type === 'mobile') {
    return (
      <div className={className} style={style} aria-hidden="true">
        <div className="phone-frame">
          <div className="phone-frame__notch" />
          <div className="phone-frame__screen">
            <div className="phone-frame__header">
              <span>{project.strapline}</span>
              <strong>{project.year}</strong>
            </div>
            <div className="phone-frame__hero">
              <span className="phone-frame__accent-bar" />
              <strong>{project.previewTitle}</strong>
              <div className="phone-frame__progress-list">
                {project.previewSeries.slice(0, 3).map((item, index) => (
                  <div className="phone-frame__progress" key={`${project.id}-${index}`}>
                    <span style={{ width: `${item}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="phone-frame__list">
              {project.previewBadges.map((badge) => (
                <div className="phone-frame__list-item" key={badge}>
                  <strong>{badge}</strong>
                  <span />
                </div>
              ))}
            </div>
            <div className="phone-frame__nav">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (project.type === 'mac') {
    return (
      <div className={className} style={style} aria-hidden="true">
        <div className="desktop-frame">
          <div className="desktop-frame__chrome">
            <div className="chrome-dots">
              <span />
              <span />
              <span />
            </div>
            <div className="desktop-frame__title">{project.strapline}</div>
          </div>
          <div className="desktop-frame__body">
            <div className="desktop-frame__sidebar">
              <span className="desktop-frame__nav-item desktop-frame__nav-item--active" />
              <span className="desktop-frame__nav-item" />
              <span className="desktop-frame__nav-item" />
              <span className="desktop-frame__nav-item" />
            </div>
            <div className="desktop-frame__panel">
              <div className="desktop-frame__chart-card">
                <strong>{project.previewTitle}</strong>
                <div className="desktop-frame__bars">
                  {project.previewSeries.map((item, index) => (
                    <span key={`${project.id}-${index}`} style={{ height: `${item}%` }} />
                  ))}
                </div>
              </div>
              <div className="desktop-frame__card-stack">
                {project.previewBadges.map((badge) => (
                  <div className="desktop-frame__mini-card" key={badge}>
                    <span>{badge}</span>
                    <strong>{project.highlights[project.previewBadges.indexOf(badge)] || project.strapline}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style} aria-hidden="true">
      <div className="browser-frame">
        <div className="browser-frame__chrome">
          <div className="chrome-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="browser-frame__address">{project.name.toLowerCase().replace(/\s+/g, '-')}.studio</div>
        </div>
        <div className="browser-frame__canvas">
          <div className="preview-badge-row">
            {project.previewBadges.map((badge) => (
              <span className="preview-badge" key={badge}>
                {badge}
              </span>
            ))}
          </div>
          <strong className="preview-title">{project.previewTitle}</strong>
          <span className="preview-line preview-line--short" />
          <span className="preview-line preview-line--mid" />
          <div className="browser-frame__grid">
            <div className="browser-frame__card browser-frame__card--feature">
              <span className="browser-frame__accent" />
              <div className="browser-frame__bars">
                {project.previewSeries.slice(0, 3).map((item, index) => (
                  <span key={`${project.id}-${index}`} style={{ height: `${item}%` }} />
                ))}
              </div>
            </div>
            <div className="browser-frame__stack">
              <div className="browser-frame__card">
                <span className="preview-line preview-line--mid" />
                <span className="preview-line preview-line--short" />
              </div>
              <div className="browser-frame__card">
                <span className="preview-line preview-line--short" />
                <span className="preview-line" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const listRef = useRef(null);

  const visibleProjects = useMemo(
    () => (filter === 'all' ? PROJECTS : PROJECTS.filter((p) => p.type === filter)),
    [filter]
  );

  const platformCards = useMemo(
    () =>
      Object.entries(PLATFORM_COPY).map(([id, details]) => ({
        id,
        ...details,
        count: PROJECTS.filter((p) => p.type === id).length,
      })),
    []
  );

  const handleFilterChange = useCallback(
    (id) => {
      setFilter(id);
      setOpenId(null);
    },
    []
  );

  const toggleRow = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.project-row');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -32px 0px' }
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleProjects]);

  return (
    <div className="site" id="top">
      {/* ── Nav ─────────────────────────────────── */}
      <nav className="nav" aria-label="Primary">
        <div className="container nav__inner">
          <a className="brand" href="#top">
            <span className="brand__dot" />
            Portfolio
          </a>
          <div className="nav__links">
            <a href="#work">Work</a>
            <a href="#platforms">Platforms</a>
            <a className="nav__cta" href="#contact">
              Contact <ArrowIcon />
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────── */}
      <header className="hero" id="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="container hero__inner">
          <p className="hero__eyebrow">Selected work · 2025–2026</p>
          <h1 className="hero__title">
            Websites,<br />
            <em>Mobile</em><br />
            &amp; Mac apps.
          </h1>
          <p className="hero__sub">
            Nine projects across three platforms — each built to solve a real problem
            with deliberate design and sharp engineering.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#work">
              Browse work <ArrowIcon />
            </a>
          </div>
        </div>
        <dl className="hero__stats container">
          <div>
            <dt>3</dt>
            <dd>Websites</dd>
          </div>
          <div>
            <dt>3</dt>
            <dd>Mobile apps</dd>
          </div>
          <div>
            <dt>3</dt>
            <dd>Mac apps</dd>
          </div>
        </dl>
      </header>

      {/* ── Work ─────────────────────────────────── */}
      <section className="section" id="work">
        <div className="container">
          <div className="section-head">
            <h2 className="section-head__title">All projects</h2>
            <nav className="filter-bar" aria-label="Filter projects">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-btn${filter === f.id ? ' is-active' : ''}`}
                  onClick={() => handleFilterChange(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                </button>
              ))}
            </nav>
          </div>

          <ol className="project-list" ref={listRef} key={filter}>
            {visibleProjects.map((project, i) => {
              const isOpen = openId === project.id;
              return (
                <li
                  key={project.id}
                  className={`project-row${isOpen ? ' is-open' : ''}`}
                  style={{ '--i': i }}
                >
                  <button
                    className="project-row__trigger"
                    type="button"
                    onClick={() => toggleRow(project.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="project-row__num">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="project-row__main">
                      <div className="project-row__title-line">
                        <h3 className="project-row__name">{project.name}</h3>
                        <div className="project-row__badges">
                          <span className="badge badge--platform">
                            <PlatformIcon type={project.type} />
                            {project.category}
                          </span>
                          <span className="badge badge--year">{project.year}</span>
                        </div>
                      </div>
                      <p className="project-row__summary">{project.summary}</p>
                      <ul className="tech-list" aria-label="Tech stack">
                        {project.stack.map((s) => (
                          <li key={s} className="tech-chip">{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="project-row__thumb" aria-hidden="true">
                      <ProjectPreview project={project} />
                    </div>
                    <span className="project-row__chevron" aria-hidden="true" />
                  </button>

                  {isOpen && (
                    <div className="project-row__detail">
                      <div className="detail__preview">
                        <ProjectPreview project={project} />
                      </div>
                      <div className="detail__body">
                        <p className="detail__desc">{project.description}</p>
                        <ul className="detail__highlights">
                          {project.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                        <dl className="detail__stats">
                          {project.stats.map((s) => (
                            <div key={s.label} className="detail__stat">
                              <dt>{s.label}</dt>
                              <dd>{s.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Platforms ────────────────────────────── */}
      <section className="section section--alt" id="platforms">
        <div className="container">
          <div className="section-head">
            <h2 className="section-head__title">Platform coverage</h2>
            <p className="section-head__sub">
              Three platforms, three distinct preview languages — browsers, phones, and
              desktop tools each rendered with their own visual identity.
            </p>
          </div>
          <div className="platform-grid">
            {platformCards.map((item) => (
              <article className="platform-card" key={item.id}>
                <div className="platform-card__icon">
                  <PlatformIcon type={item.id} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="platform-card__count">{item.count} projects</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────── */}
      <section className="cta-section" id="contact">
        <div className="container cta-section__inner">
          <p className="cta-section__label">Ready to add your work?</p>
          <h2 className="cta-section__title">This showcase is built to grow.</h2>
          <p className="cta-section__body">
            Swap the PROJECTS array with your own work — live demos, case study links, and
            real screenshots slot right in. No rebuild required.
          </p>
          <a className="btn btn--primary" href="#work">
            Browse projects <ArrowIcon />
          </a>
        </div>
      </section>
    </div>
  );
}
