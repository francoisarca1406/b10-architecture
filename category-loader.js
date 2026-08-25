/* B10 — Chargement dynamique des projets par catégorie
   Lit content/projets/ (CMS), filtre par la catégorie de la page,
   et n'affiche QUE les projets réellement présents dans le CMS.
   La catégorie est déduite du nom de fichier : bureaux.html -> "bureaux". */

(function () {
  const GITHUB_API =
    'https://api.github.com/repos/francoisarca1406/b10-architecture/contents/content/projets';

  // Slug de la page = nom du fichier sans extension
  const slug = (location.pathname.split('/').pop() || '')
    .replace(/\.html?$/i, '') || 'index';

  const grid = document.getElementById('cat-projects');
  const title = document.getElementById('cat-count-title');
  if (!grid) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Parse le frontmatter YAML d'un fichier .md du CMS
  function parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const data = {};
    m[1].split(/\r?\n/).forEach(line => {
      if (!line.trim() || line.trim().startsWith('#')) return;
      if (/^\s/.test(line)) return;            // ignore les lignes imbriquées
      const i = line.indexOf(':');
      if (i === -1) return;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (!val || val === '[]') return;
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (val === 'true') { val = true; }
      else if (val === 'false') { val = false; }
      else if (/^-?\d+$/.test(val)) { val = Number(val); }
      data[key] = val;
    });
    return data;
  }

  function setTitle(n) {
    if (!title) return;
    title.textContent = n === 0
      ? 'Aucun projet publié pour le moment'
      : (n === 1 ? '1 projet dans cette catégorie'
                 : n + ' projets dans cette catégorie');
  }

  function emptyState() {
    grid.style.display = 'block';
    grid.innerHTML =
      '<p style="font-family:var(--font-body);font-size:15px;font-weight:300;' +
      'color:rgba(242,240,235,0.55);padding:8px 0;">' +
      'Aucun projet n\u2019est encore publié dans cette catégorie. ' +
      'Les projets ajoutés depuis l\u2019espace d\u2019administration ' +
      'apparaîtront ici automatiquement.</p>';
  }

  function card(p) {
    const pslug = p.slug || (p.titre || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const loc = escapeHtml((p.lieu || '') + (p.annee ? ' \u00B7 ' + p.annee : ''));
    return '<a href="../projets/' + encodeURIComponent(pslug) + '.html" class="cat-project-card">' +
      '<div class="cat-project-img">' +
        '<img src="' + escapeHtml(p.photo || '') + '" alt="' + escapeHtml(p.titre) + '" ' +
          'loading="eager" onerror="this.style.background=\'linear-gradient(135deg,#1a1a0e,#2d2510)\';this.removeAttribute(\'src\')">' +
      '</div>' +
      '<div class="cat-project-body">' +
        '<div class="cat-project-title">' + escapeHtml(p.titre) + '</div>' +
        '<div class="cat-project-loc">' + loc + '</div>' +
      '</div>' +
      '<div class="cat-project-line"></div>' +
    '</a>';
  }

  function reveal() {
    grid.classList.add('visible');
    Array.from(grid.children).forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  async function load() {
    try {
      const res = await fetch(GITHUB_API, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) throw new Error('API indisponible (' + res.status + ')');
      const files = await res.json();
      const entries = files.filter(f =>
        f.type === 'file' && (f.name.endsWith('.json') || f.name.endsWith('.md')));

      const loaded = await Promise.all(entries.map(async f => {
        try {
          const r = await fetch(f.download_url);
          const text = await r.text();
          const data = f.name.endsWith('.json') ? JSON.parse(text) : parseFrontmatter(text);
          if (!data || !data.titre) return null;
          if (!data.slug) data.slug = f.name.replace(/\.(json|md)$/, '');
          return data;
        } catch (e) { return null; }
      }));

      const projects = loaded
        .filter(Boolean)
        .filter(p => p.categorie === slug)
        .sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (a.ordre || 99) - (b.ordre || 99);
        });

      setTitle(projects.length);
      if (projects.length === 0) { emptyState(); return; }

      grid.innerHTML = projects.map(card).join('');
      reveal();
    } catch (e) {
      // En cas d'échec réseau : message neutre plutôt qu'une grille cassée
      console.log('Projets catégorie non chargés :', e.message);
      setTitle(0);
      emptyState();
    }
  }

  load();
})();
