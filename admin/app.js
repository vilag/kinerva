'use strict';

/* ══════════════════════════════════════════════════════════ Utilities */

function fmtHour(h) {
  h = parseInt(h, 10);
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function statusBadge(s) {
  const map = {
    pendiente:  ['Pendiente',  'bs-pendiente'],
    confirmada: ['Confirmada', 'bs-confirmada'],
    completada: ['Completada', 'bs-completada'],
    cancelada:  ['Cancelada',  'bs-cancelada'],
  };
  const [lbl, cls] = map[s] || [s || 'pendiente', 'bs-pendiente'];
  return `<span class="bs ${cls}">${lbl}</span>`;
}

function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spin() {
  return '<div class="text-center py-5"><i class="fas fa-circle-notch fa-spin fa-2x text-muted"></i></div>';
}

function showToastGlobal(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `alert alert-${type} position-fixed shadow`;
  t.style.cssText = 'bottom:24px;right:24px;z-index:9999;min-width:280px;font-size:13px;font-weight:600;animation:fadeIn .2s';
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

/* ══════════════════════════════════════════════════════════ App */

const App = {
  token: localStorage.getItem('kinerva_token'),
  user:  localStorage.getItem('kinerva_user'),
  // per-view filter state
  apptFilters:   {},
  patientSearch: '',
  currentFolio:  'borrador',
  expedientesSearch: '',

  /* ── API client ──────────────────────────────────────────── */
  async api(method, path, body, query) {
    let url = '/api/admin' + path;
    if (query && Object.keys(query).length)
      url += '?' + new URLSearchParams(query);
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(App.token ? { Authorization: `Bearer ${App.token}` } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(url, opts);
      if (res.status === 401) { App.logout(); return null; }
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { console.error('API non-JSON response:', text.slice(0, 120)); return null; }
    } catch (e) {
      console.error('API error', e);
      return null;
    }
  },
  get:  (path, q)    => App.api('GET',   path, null, q),
  post: (path, body) => App.api('POST',  path, body),
  put:  (path, body) => App.api('PUT',   path, body),
  patch:(path, body) => App.api('PATCH', path, body),

  /* ── Auth helpers ────────────────────────────────────────── */
  setAuth(token, username) {
    App.token = token;
    App.user  = username;
    localStorage.setItem('kinerva_token', token);
    localStorage.setItem('kinerva_user',  username);
  },

  logout() {
    App.token = null;
    App.user  = null;
    localStorage.removeItem('kinerva_token');
    localStorage.removeItem('kinerva_user');
    App.showAuth();
  },

  isValid() {
    if (!App.token) return false;
    try {
      const payload = JSON.parse(atob(App.token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch { return false; }
  },

  /* ── Navigation ──────────────────────────────────────────── */
  go(hash) { window.location.hash = hash; },

  route() {
    const raw  = window.location.hash.slice(1) || 'dashboard';
    const parts = raw.split('/');
    const page  = parts[0];

    // Update sidebar active state
    document.querySelectorAll('.ak-nav a').forEach(a => {
      const h = a.getAttribute('href')?.slice(1);
      a.classList.toggle('active',
        h === page || (page === 'patient' && h === 'patients') || (page === 'prospectos' && h === 'prospectos'));
    });

    const content = document.getElementById('pageContent');
    const title   = document.getElementById('pageTitle');
    content.innerHTML = spin();

    switch (page) {
      case 'dashboard':
        title.textContent = 'Dashboard';
        Views.dashboard(content);
        break;
      case 'appointments':
        title.textContent = 'Citas';
        Views.appointments(content);
        break;
      case 'prospectos':
        title.textContent = 'Prospectos';
        Views.prospectos(content);
        break;
      case 'patients':
        title.textContent = 'Pacientes';
        Views.patients(content);
        break;
      case 'patient': {
        title.textContent = 'Expediente';
        const param = parts[1] === 'p'
          ? { phone: decodeURIComponent(parts[2] || '') }
          : { id: parts[1] };
        Views.patientDetail(content, param);
        break;
      }
      case 'expedientes':
        title.textContent = 'Expedientes Clínicos';
        Views.expedientes(content);
        break;
      case 'expediente': {
        const folio = parts[1] || 'borrador';
        title.textContent = 'Expediente Clínico';
        Views.expediente(content, folio);
        break;
      }
      case 'portal-pacientes':
        title.textContent = 'Pacientes del Portal';
        Views.portalPacientes(content);
        break;
      default:
        title.textContent = 'Dashboard';
        Views.dashboard(content);
    }
  },

  /* ── Screens ─────────────────────────────────────────────── */
  showAuth(mode = 'login') {
    document.getElementById('authScreen').style.display  = '';
    document.getElementById('adminPanel').style.display  = 'none';
    if (mode === 'setup') {
      document.getElementById('authScreen').innerHTML = Views.setupHtml();
      bindSetup();
    } else {
      document.getElementById('authScreen').innerHTML = Views.loginHtml();
      bindLogin();
    }
  },

  showPanel() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = '';
    document.getElementById('userLabel').textContent = App.user || '';
    document.getElementById('topDate').textContent =
      new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
    document.getElementById('logoutBtn').onclick = e => { e.preventDefault(); App.logout(); };

    // Sidebar SPA links
    document.querySelectorAll('.ak-nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        App.go(a.getAttribute('href').slice(1));
      });
    });

    App.route();
  },

  /* ── Init ────────────────────────────────────────────────── */
  async init() {
    if (App.isValid()) {
      App.showPanel();
    } else {
      App.token = null;
      localStorage.removeItem('kinerva_token');
      try {
        const data = await fetch('/api/admin/auth').then(r => r.json());
        App.showAuth(data.hasAdmins ? 'login' : 'setup');
      } catch {
        App.showAuth('login');
      }
    }
    window.addEventListener('hashchange', () => { if (App.isValid()) App.route(); });
  },
};

/* ══════════════════════════════════════════════════════════ Auth binders */

function bindLogin() {
  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Entrando…';
    const fd  = new FormData(form);
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action:'login', username: fd.get('username'), password: fd.get('password') }),
    }).then(r => r.json());
    if (res.success) {
      App.setAuth(res.token, res.username);
      App.showPanel();
    } else {
      const err = document.getElementById('loginError');
      err.textContent = res.message;
      err.style.display = '';
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt me-1"></i>Ingresar';
    }
  });
}

function bindSetup() {
  const form = document.getElementById('setupForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd  = new FormData(form);
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:   'setup',
        username: fd.get('username'),
        password: fd.get('password'),
        confirm:  fd.get('confirm'),
      }),
    }).then(r => r.json());
    const msg = document.getElementById('setupMsg');
    if (res.success) {
      msg.className = 'alert alert-success py-2 px-3';
      msg.innerHTML = '✓ Administrador creado. <a href="#" id="goLogin">Iniciar sesión →</a>';
      msg.style.display = '';
      document.getElementById('goLogin')?.addEventListener('click', e => {
        e.preventDefault(); App.showAuth('login');
      });
    } else {
      msg.className = 'alert alert-danger py-2 px-3';
      msg.textContent = res.message;
      msg.style.display = '';
    }
  });
}

/* ══════════════════════════════════════════════════════════ Views */

const Views = {

  loginHtml: () => `
    <div class="ak-login-wrap">
      <div class="ak-login-box">
        <div class="ak-login-logo"><i class="fas fa-heartbeat"></i> Kinerva</div>
        <p class="text-muted" style="font-size:13px;margin-bottom:24px">Panel de Administración</p>
        <div id="loginError" class="alert alert-danger py-2 px-3" style="display:none;font-size:13px"></div>
        <form id="loginForm">
          <div class="mb-3">
            <label class="form-label fw-semibold" style="font-size:13px">Usuario</label>
            <input type="text" name="username" class="form-control" required autofocus>
          </div>
          <div class="mb-4">
            <label class="form-label fw-semibold" style="font-size:13px">Contraseña</label>
            <input type="password" name="password" class="form-control" required>
          </div>
          <button type="submit" class="btn btn-ak w-100 fw-bold">
            <i class="fas fa-sign-in-alt me-1"></i> Ingresar
          </button>
        </form>
        <p class="text-center mt-3" style="font-size:12px;color:#bbb">
          ¿Primera vez? <a href="#" id="toSetup" style="color:var(--ak-teal)">Crear cuenta</a>
        </p>
      </div>
    </div>`,

  setupHtml: () => `
    <div class="ak-login-wrap">
      <div class="ak-login-box">
        <div class="ak-login-logo"><i class="fas fa-heartbeat"></i> Kinerva</div>
        <p class="text-muted" style="font-size:13px;margin-bottom:24px">Crear primer administrador</p>
        <div id="setupMsg" style="display:none"></div>
        <form id="setupForm">
          <div class="mb-3">
            <label class="form-label fw-semibold" style="font-size:13px">Usuario</label>
            <input type="text" name="username" class="form-control" required autofocus>
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold" style="font-size:13px">Contraseña</label>
            <input type="password" name="password" class="form-control" required>
          </div>
          <div class="mb-4">
            <label class="form-label fw-semibold" style="font-size:13px">Confirmar contraseña</label>
            <input type="password" name="confirm" class="form-control" required>
          </div>
          <button type="submit" class="btn btn-ak w-100 fw-bold">
            <i class="fas fa-user-plus me-1"></i> Crear administrador
          </button>
        </form>
      </div>
    </div>`,

  /* ── Dashboard ─────────────────────────────────────────── */
  async dashboard(el) {
    const data = await App.get('/dashboard');
    if (!data) { el.innerHTML = '<div class="alert alert-danger">Error cargando datos</div>'; return; }
    const { stats, todayAppts, upcoming } = data;

    el.innerHTML = `
    <div class="row g-3 mb-4">
      ${[['today','Citas hoy','fas fa-calendar-day','i-teal'],
         ['week','Esta semana','fas fa-calendar-week','i-navy'],
         ['month','Este mes','fas fa-calendar-alt','i-green'],
         ['patients','Pacientes','fas fa-users','i-orange'],
        ].map(([k,lbl,icon,cls]) => `
        <div class="col-6 col-xl-3">
          <div class="ak-stat">
            <div class="ak-stat-icon ${cls}"><i class="${icon}"></i></div>
            <div>
              <div class="ak-stat-val">${stats[k] ?? 0}</div>
              <div class="ak-stat-lbl">${lbl}</div>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <div class="row g-3">
      <div class="col-12 col-xl-7">
        <div class="ak-card">
          <div class="ak-card-head">
            <h6><i class="fas fa-clock me-2" style="color:var(--ak-teal)"></i>Citas de hoy</h6>
            <button class="btn btn-sm btn-ak" id="goAppts">Ver todas</button>
          </div>
          ${todayAppts.length === 0
            ? '<div class="ak-card-body text-center text-muted py-5"><i class="fas fa-calendar-times fa-2x d-block mb-3" style="opacity:.25"></i>Sin citas para hoy</div>'
            : `<div class="table-responsive"><table class="ak-tbl">
                <thead><tr><th>Hora</th><th>Paciente</th><th>Servicio</th><th>Dur.</th><th>Estado</th></tr></thead>
                <tbody>${todayAppts.map(a=>`
                  <tr>
                    <td><strong>${fmtHour(a.hour)}</strong></td>
                    <td><a href="#" class="text-decoration-none fw-semibold pt-link" data-phone="${esc(a.phone)}">${esc(a.name)}</a><br><small class="text-muted">${esc(a.phone)}</small></td>
                    <td>${esc(a.service||'Evaluación')}</td>
                    <td>${a.duration}h</td>
                    <td>${statusBadge(a.status)}</td>
                  </tr>`).join('')}
                </tbody></table></div>`}
        </div>
      </div>
      <div class="col-12 col-xl-5">
        <div class="ak-card">
          <div class="ak-card-head">
            <h6><i class="fas fa-forward me-2" style="color:var(--ak-teal)"></i>Próximos 7 días</h6>
          </div>
          ${upcoming.length === 0
            ? '<div class="ak-card-body text-center text-muted py-4" style="font-size:13px">Sin citas próximas</div>'
            : `<div class="table-responsive"><table class="ak-tbl">
                <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Estado</th></tr></thead>
                <tbody>${upcoming.map(a=>`
                  <tr>
                    <td>${fmtDate(a.date)}</td>
                    <td>${fmtHour(a.hour)}</td>
                    <td><a href="#" class="text-decoration-none pt-link" data-phone="${esc(a.phone)}">${esc(a.name)}</a></td>
                    <td>${statusBadge(a.status)}</td>
                  </tr>`).join('')}
                </tbody></table></div>`}
        </div>
      </div>
    </div>`;

    el.querySelector('#goAppts')?.addEventListener('click', () => App.go('appointments'));
    el.querySelectorAll('.pt-link').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); App.go(`patient/p/${encodeURIComponent(a.dataset.phone)}`); })
    );
  },

  /* ── Appointments ──────────────────────────────────────── */
  async appointments(el) {
    const f = App.apptFilters;
    const data = await App.get('/appointments', Object.keys(f).reduce((o,k)=>{ if(f[k]) o[k]=f[k]; return o; }, {}));
    if (!data) { el.innerHTML = '<div class="alert alert-danger">Error cargando citas</div>'; return; }
    const { appointments } = data;

    const statusOpts = ['pendiente','confirmada','completada','cancelada']
      .map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');

    el.innerHTML = `
    <div class="ak-card mb-3">
      <div class="ak-card-body">
        <form id="filterForm" class="row g-2 align-items-end">
          <div class="col-sm-4 col-md-3">
            <label class="form-label" style="font-size:12px;font-weight:600">Fecha</label>
            <input type="date" name="date" class="form-control form-control-sm" value="${esc(f.date||'')}">
          </div>
          <div class="col-sm-4 col-md-3">
            <label class="form-label" style="font-size:12px;font-weight:600">Estado</label>
            <select name="status" class="form-select form-select-sm">
              <option value="">Todos</option>${statusOpts}
            </select>
          </div>
          <div class="col-auto d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-ak"><i class="fas fa-filter me-1"></i>Filtrar</button>
            <button type="button" id="clearBtn" class="btn btn-sm btn-outline-secondary">Limpiar</button>
          </div>
        </form>
      </div>
    </div>
    <div class="ak-card">
      <div class="ak-card-head">
        <h6><i class="fas fa-calendar-check me-2" style="color:var(--ak-teal)"></i>${appointments.length} cita${appointments.length!==1?'s':''}</h6>
      </div>
      ${appointments.length === 0
        ? '<div class="ak-card-body text-center text-muted py-5"><i class="fas fa-search fa-2x d-block mb-3" style="opacity:.25"></i>Sin citas para estos filtros</div>'
        : `<div class="table-responsive"><table class="ak-tbl">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tel.</th><th>Servicio</th><th>Molestia / Duda</th><th>Dur.</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>${appointments.map(a=>`
              <tr data-id="${a.id}">
                <td>${fmtDate(a.date)}</td>
                <td><strong>${fmtHour(a.hour)}</strong></td>
                <td><a href="#" class="fw-semibold text-decoration-none pt-link" data-phone="${esc(a.phone)}">${esc(a.name)}</a></td>
                <td>${esc(a.phone)}</td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.service||'')}">${esc(a.service||'Evaluación')}</td>
                <td style="max-width:200px">${a.notes ? `<span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:#555" title="${esc(a.notes)}">${esc(a.notes)}</span>` : '<span style="color:#bbb;font-size:12px">—</span>'}</td>
                <td>${a.duration}h</td>
                <td class="st-cell">${statusBadge(a.status)}</td>
                <td>
                  <div class="d-flex gap-1">
                    <select class="form-select form-select-sm st-sel" style="width:126px;font-size:12px">
                      ${['pendiente','confirmada','completada','cancelada'].map(s=>
                        `<option value="${s}" ${(a.status||'pendiente')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
                      ).join('')}
                    </select>
                    <button class="btn btn-sm btn-ak save-st" title="Guardar"><i class="fas fa-check"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;

    el.querySelector('#filterForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      App.apptFilters = { date: fd.get('date')||'', status: fd.get('status')||'' };
      Views.appointments(el);
    });
    el.querySelector('#clearBtn')?.addEventListener('click', () => {
      App.apptFilters = {};
      Views.appointments(el);
    });
    el.querySelectorAll('.pt-link').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); App.go(`patient/p/${encodeURIComponent(a.dataset.phone)}`); })
    );
    el.querySelectorAll('.save-st').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row    = btn.closest('tr');
        const id     = parseInt(row.dataset.id, 10);
        const status = row.querySelector('.st-sel').value;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        const res = await App.patch('/appointments', { id, status });
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        if (res?.success) row.querySelector('.st-cell').innerHTML = statusBadge(status);
      });
    });
  },

  /* ── Prospectos ────────────────────────────────────────── */
  async prospectos(el) {
    const f = App.prospectosFilter || '';
    const query = f ? { status: f } : {};
    const data = await App.get('/prospects', query);
    if (!data) { el.innerHTML = '<div class="alert alert-danger">Error cargando prospectos</div>'; return; }
    const { prospects } = data;

    const STATUSES = ['nuevo','contactado','convertido','descartado'];
    const statusOpts = STATUSES.map(s =>
      `<option value="${s}" ${f===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
    ).join('');

    const prospectBadge = s => {
      const map = {
        nuevo:       ['Nuevo',       '#0d6efd','#e7f1ff'],
        contactado:  ['Contactado',  '#fd7e14','#fff3e0'],
        convertido:  ['Convertido',  '#198754','#e8f5e9'],
        descartado:  ['Descartado',  '#6c757d','#f0f0f0'],
      };
      const [lbl, color, bg] = map[s] || ['Nuevo','#0d6efd','#e7f1ff'];
      return `<span style="background:${bg};color:${color};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">${lbl}</span>`;
    };

    el.innerHTML = `
    <div class="ak-card mb-3">
      <div class="ak-card-body">
        <form id="prospFilterForm" class="row g-2 align-items-end">
          <div class="col-sm-4 col-md-3">
            <label class="form-label" style="font-size:12px;font-weight:600">Estado</label>
            <select name="status" class="form-select form-select-sm">
              <option value="">Todos</option>${statusOpts}
            </select>
          </div>
          <div class="col-auto d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-ak"><i class="fas fa-filter me-1"></i>Filtrar</button>
            <button type="button" id="prospClearBtn" class="btn btn-sm btn-outline-secondary">Limpiar</button>
          </div>
        </form>
      </div>
    </div>
    <div class="ak-card">
      <div class="ak-card-head">
        <h6><i class="fas fa-user-plus me-2" style="color:var(--ak-teal)"></i>${prospects.length} prospecto${prospects.length!==1?'s':''}</h6>
      </div>
      ${prospects.length === 0
        ? '<div class="ak-card-body text-center text-muted py-5"><i class="fas fa-inbox fa-2x d-block mb-3" style="opacity:.25"></i>Sin prospectos para estos filtros</div>'
        : `<div class="table-responsive"><table class="ak-tbl">
            <thead><tr><th>Fecha</th><th>Origen</th><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Servicio</th><th>Notas</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>${prospects.map(p=>`
              <tr data-id="${p.id}">
                <td style="white-space:nowrap;font-size:12px">${fmtDate(p.created_at)}</td>
                <td>${p.source ? `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600">${esc(p.source)}</span>` : '<span style="color:#bbb;font-size:12px">—</span>'}</td>
                <td class="fw-semibold">${esc(p.name||'—')}</td>
                <td><a href="tel:${esc(p.phone)}" style="text-decoration:none;color:inherit">${esc(p.phone)}</a></td>
                <td style="font-size:12px">${p.email ? `<a href="mailto:${esc(p.email)}" style="text-decoration:none;color:inherit">${esc(p.email)}</a>` : '<span style="color:#bbb">—</span>'}</td>
                <td style="font-size:12px">${esc(p.service||'—')}</td>
                <td style="max-width:180px">${p.notes ? `<span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:#555" title="${esc(p.notes)}">${esc(p.notes)}</span>` : '<span style="color:#bbb;font-size:12px">—</span>'}</td>
                <td class="pr-st-cell">${prospectBadge(p.status)}</td>
                <td>
                  <div class="d-flex gap-1">
                    <select class="form-select form-select-sm pr-sel" style="width:130px;font-size:12px">
                      ${STATUSES.map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                    </select>
                    <button class="btn btn-sm btn-ak save-pr" title="Guardar"><i class="fas fa-check"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;

    el.querySelector('#prospFilterForm')?.addEventListener('submit', e => {
      e.preventDefault();
      App.prospectosFilter = new FormData(e.target).get('status') || '';
      Views.prospectos(el);
    });
    el.querySelector('#prospClearBtn')?.addEventListener('click', () => {
      App.prospectosFilter = '';
      Views.prospectos(el);
    });
    el.querySelectorAll('.save-pr').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row    = btn.closest('tr');
        const id     = parseInt(row.dataset.id, 10);
        const status = row.querySelector('.pr-sel').value;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        const res = await App.patch('/prospects', { id, status });
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        if (res?.success) row.querySelector('.pr-st-cell').innerHTML = prospectBadge(status);
      });
    });
  },

  /* ── Patients ──────────────────────────────────────────── */
  async patients(el) {
    const q = App.patientSearch;
    const data = await App.get('/patients', q ? { q } : {});
    if (!data) { el.innerHTML = '<div class="alert alert-danger">Error cargando pacientes</div>'; return; }
    const { patients } = data;

    el.innerHTML = `
    <div class="ak-card mb-3">
      <div class="ak-card-body">
        <form id="searchForm" class="row g-2 align-items-end">
          <div class="col-sm-6 col-md-4">
            <label class="form-label" style="font-size:12px;font-weight:600">Buscar paciente</label>
            <input type="text" name="q" class="form-control form-control-sm"
                   placeholder="Nombre, teléfono o correo…" value="${esc(q)}">
          </div>
          <div class="col-auto d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-ak"><i class="fas fa-search me-1"></i>Buscar</button>
            ${q?'<button type="button" id="clearSearch" class="btn btn-sm btn-outline-secondary">Limpiar</button>':''}
          </div>
        </form>
      </div>
    </div>
    <div class="ak-card">
      <div class="ak-card-head">
        <h6><i class="fas fa-user-injured me-2" style="color:var(--ak-teal)"></i>${patients.length} paciente${patients.length!==1?'s':''}</h6>
      </div>
      ${patients.length === 0
        ? `<div class="ak-card-body text-center text-muted py-5"><i class="fas fa-users fa-2x d-block mb-3" style="opacity:.25"></i>${q?`Sin resultados para "${esc(q)}"` : 'Sin pacientes registrados'}</div>`
        : `<div class="table-responsive"><table class="ak-tbl">
            <thead><tr><th>Paciente</th><th>Teléfono</th><th>Correo</th><th>Citas</th><th>Última cita</th><th></th></tr></thead>
            <tbody>${patients.map(p=>`
              <tr>
                <td><a href="#" class="fw-semibold text-decoration-none pd-link" data-id="${p.id}">${esc(p.name)}</a></td>
                <td>${esc(p.phone)}</td>
                <td>${esc(p.email||'—')}</td>
                <td><span class="badge bg-secondary">${p.total_appts}</span></td>
                <td>${fmtDate(p.last_appt)}</td>
                <td><a href="#" class="btn btn-sm btn-outline-secondary pd-link" data-id="${p.id}"><i class="fas fa-folder-open"></i></a></td>
              </tr>`).join('')}
            </tbody></table></div>`}
    </div>`;

    el.querySelector('#searchForm')?.addEventListener('submit', e => {
      e.preventDefault();
      App.patientSearch = new FormData(e.target).get('q')||'';
      Views.patients(el);
    });
    el.querySelector('#clearSearch')?.addEventListener('click', () => {
      App.patientSearch = '';
      Views.patients(el);
    });
    el.querySelectorAll('.pd-link').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); App.go(`patient/${a.dataset.id}`); })
    );
  },

  /* ── Patient detail ────────────────────────────────────── */
  async patientDetail(el, param) {
    const data = await App.get('/patient', param);
    if (!data?.patient) {
      el.innerHTML = '<div class="alert alert-warning m-3">Paciente no encontrado.</div>';
      return;
    }
    const { patient, appointments, notes } = data;
    const pid = patient.id;

    const noteHtml = n => `
      <div class="note-item" data-nid="${n.id}">
        <p class="mb-1" style="font-size:13px;white-space:pre-wrap">${esc(n.content)}</p>
        <div class="note-meta d-flex justify-content-between align-items-center">
          <span><i class="fas fa-user me-1"></i>${esc(n.created_by||'admin')}
            &nbsp;·&nbsp;<i class="fas fa-clock me-1"></i>${String(n.created_at||'').slice(0,16).replace('T',' ')}</span>
          <button class="btn btn-sm btn-outline-danger py-0 px-2 del-note" data-nid="${n.id}" style="font-size:11px">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;

    el.innerHTML = `
    <div class="mb-3">
      <a href="#patients" id="backBtn" class="text-decoration-none text-muted" style="font-size:13px">
        <i class="fas fa-arrow-left me-1"></i>Volver a Pacientes
      </a>
    </div>
    <div class="row g-3">
      <div class="col-12 col-lg-4">
        <div class="ak-card mb-3">
          <div class="ak-card-head"><h6><i class="fas fa-user me-2" style="color:var(--ak-teal)"></i>Datos del Paciente</h6></div>
          <div class="ak-card-body">
            <form id="patForm">
              <div class="mb-2">
                <label class="form-label" style="font-size:12px;font-weight:600">Nombre</label>
                <input type="text" name="name" class="form-control form-control-sm" value="${esc(patient.name)}" required>
              </div>
              <div class="mb-2">
                <label class="form-label" style="font-size:12px;font-weight:600">Teléfono</label>
                <input class="form-control form-control-sm" value="${esc(patient.phone)}" readonly style="background:#f8f9fa">
              </div>
              <div class="mb-2">
                <label class="form-label" style="font-size:12px;font-weight:600">Correo</label>
                <input type="email" name="email" class="form-control form-control-sm" value="${esc(patient.email||'')}">
              </div>
              <div class="mb-3">
                <label class="form-label" style="font-size:12px;font-weight:600">Fecha de nacimiento</label>
                <input type="date" name="birth_date" class="form-control form-control-sm" value="${esc(patient.birth_date||'')}">
              </div>
              <div id="patSaveOk" class="alert alert-success py-1 px-2 mb-2" style="display:none;font-size:12px">Guardado ✓</div>
              <button type="submit" class="btn btn-sm btn-ak w-100"><i class="fas fa-save me-1"></i>Guardar</button>
            </form>
          </div>
        </div>
        <div class="ak-card">
          <div class="ak-card-head"><h6><i class="fas fa-notes-medical me-2" style="color:var(--ak-teal)"></i>Antecedentes</h6></div>
          <div class="ak-card-body">
            <form id="antForm">
              <textarea name="notes" class="form-control form-control-sm mb-2" rows="5"
                        placeholder="Alergias, condiciones, medicamentos…"
                        style="font-size:13px">${esc(patient.notes||'')}</textarea>
              <button type="submit" class="btn btn-sm btn-ak w-100"><i class="fas fa-save me-1"></i>Guardar</button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-8">
        <div class="ak-card mb-3">
          <div class="ak-card-head">
            <h6><i class="fas fa-history me-2" style="color:var(--ak-teal)"></i>Historial (${appointments.length})</h6>
          </div>
          ${appointments.length === 0
            ? '<div class="ak-card-body text-center text-muted py-4" style="font-size:13px">Sin citas registradas</div>'
            : `<div class="table-responsive"><table class="ak-tbl">
                <thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Dur.</th><th>Estado</th></tr></thead>
                <tbody>${appointments.map(a=>`
                  <tr>
                    <td>${fmtDate(a.date)}</td>
                    <td>${fmtHour(a.hour)}</td>
                    <td>${esc(a.service||'Evaluación')}</td>
                    <td>${a.duration}h</td>
                    <td>${statusBadge(a.status)}</td>
                  </tr>`).join('')}
                </tbody></table></div>`}
        </div>

        <div class="ak-card">
          <div class="ak-card-head">
            <h6 id="noteTitle"><i class="fas fa-clipboard-list me-2" style="color:var(--ak-teal)"></i>Notas Clínicas (${notes.length})</h6>
          </div>
          <div class="ak-card-body">
            <form id="addNoteForm" class="mb-4">
              <label class="form-label fw-semibold" style="font-size:13px">
                <i class="fas fa-plus-circle me-1" style="color:var(--ak-teal)"></i>Nueva nota
              </label>
              <textarea name="content" class="form-control form-control-sm mb-2" rows="3" required
                        placeholder="Evolución, diagnóstico, indicaciones…" style="font-size:13px"></textarea>
              <button type="submit" class="btn btn-sm btn-ak">
                <i class="fas fa-plus me-1"></i>Agregar
              </button>
            </form>
            <div id="notesList">
              ${notes.length === 0
                ? '<p class="text-muted text-center py-2" style="font-size:13px">Sin notas</p>'
                : notes.map(noteHtml).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

    // Back
    el.querySelector('#backBtn')?.addEventListener('click', e => { e.preventDefault(); App.go('patients'); });

    // Save patient info
    el.querySelector('#patForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await App.put('/patient', { id: pid, name: fd.get('name'), email: fd.get('email'), birth_date: fd.get('birth_date'), notes: patient.notes });
      if (res?.success) {
        const ok = el.querySelector('#patSaveOk');
        ok.style.display = ''; setTimeout(() => ok.style.display = 'none', 2000);
      }
    });

    // Save antecedentes
    el.querySelector('#antForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await App.put('/patient', { id: pid, name: patient.name, email: patient.email, birth_date: patient.birth_date, notes: fd.get('notes') });
    });

    // Add note
    el.querySelector('#addNoteForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd      = new FormData(e.target);
      const content = fd.get('content').trim();
      if (!content) return;
      const res = await App.post('/patient', { action:'add_note', patient_id: pid, content });
      if (res?.success) {
        e.target.reset();
        const list = el.querySelector('#notesList');
        const now  = new Date().toISOString().slice(0,16).replace('T',' ');
        if (list.querySelector('p.text-muted')) list.innerHTML = '';
        list.insertAdjacentHTML('afterbegin', noteHtml({ id: res.note_id, content, created_by: App.user, created_at: now }));
        const title = el.querySelector('#noteTitle');
        const cnt   = list.querySelectorAll('.note-item').length;
        title.innerHTML = `<i class="fas fa-clipboard-list me-2" style="color:var(--ak-teal)"></i>Notas Clínicas (${cnt})`;
      }
    });

    // Delete note (delegated)
    el.querySelector('#notesList')?.addEventListener('click', async e => {
      const btn = e.target.closest('.del-note');
      if (!btn || !confirm('¿Eliminar esta nota?')) return;
      const nid = parseInt(btn.dataset.nid, 10);
      const res = await App.post('/patient', { action:'delete_note', note_id: nid, patient_id: pid });
      if (res?.success) {
        btn.closest('.note-item').remove();
        const list  = el.querySelector('#notesList');
        const cnt   = list.querySelectorAll('.note-item').length;
        const title = el.querySelector('#noteTitle');
        title.innerHTML = `<i class="fas fa-clipboard-list me-2" style="color:var(--ak-teal)"></i>Notas Clínicas (${cnt})`;
        if (cnt === 0) list.innerHTML = '<p class="text-muted text-center py-2" style="font-size:13px">Sin notas</p>';
      }
    });
  },
  /* ── Lista de expedientes ───────────────────────────── */
  async expedientes(el) {
    el.innerHTML = spin();
    const res = await App.get('/expedientes');
    if (!res || res.error) {
      const msg = res?.error || 'Error de conexión';
      const esTabla = msg.toLowerCase().includes("doesn't exist") || msg.toLowerCase().includes("exist");
      el.innerHTML = `<div class="alert alert-danger m-4">
        <b><i class="fas fa-exclamation-triangle me-2"></i>Error:</b> ${esc(msg)}<br>
        ${esTabla ? '<small class="mt-1 d-block">La tabla <code>expediente_config</code> no existe. Ejecuta <code>setup_expediente.sql</code> en phpMyAdmin de Hostinger.</small>' : ''}
      </div>`;
      return;
    }
    const list = res.expedientes || [];

    const renderTable = q => {
      const q2 = (q || '').toLowerCase();
      const filtered = list.filter(e =>
        !q2 ||
        e.folio.toLowerCase().includes(q2) ||
        e.nombre_paciente.toLowerCase().includes(q2) ||
        (e.motivo_consulta || '').toLowerCase().includes(q2)
      );
      const rows = filtered.length === 0
        ? `<tr><td colspan="6" class="text-center text-muted py-5">
             <i class="fas fa-search fa-2x mb-2 d-block"></i>
             ${q2 ? 'Sin resultados para &ldquo;' + esc(q) + '&rdquo;' : 'No hay expedientes guardados. Crea el primero con "Nuevo expediente".'}
           </td></tr>`
        : filtered.map(e => {
            const isBorrador = e.folio === 'borrador';
            const folioTag = isBorrador
              ? `<span class="exp-folio-tag exp-folio-draft"><i class="fas fa-pencil-alt me-1" style="font-size:9px"></i>Borrador</span>`
              : `<span class="exp-folio-tag">${esc(e.folio)}</span>`;
            const nombre = esc(e.nombre_paciente) || '<span class="text-muted fst-italic">Sin nombre</span>';
            const fecha  = e.fecha_valoracion ? fmtDate(e.fecha_valoracion) : '<span class="text-muted">—</span>';
            const mod    = e.updated_at ? fmtDate(String(e.updated_at)) : '—';
            return `<tr class="exp-list-row" data-folio="${esc(e.folio)}">
              <td>${folioTag}</td>
              <td><b style="font-weight:600">${nombre}</b></td>
              <td class="text-muted small">${esc(e.motivo_consulta||'—')}</td>
              <td>${fecha}</td>
              <td class="text-muted small">${mod}</td>
              <td style="text-align:center">
                <button class="exp-del-btn" data-folio="${esc(e.folio)}" title="Eliminar expediente">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </td>
            </tr>`;
          }).join('');
      const tbody = el.querySelector('#expTableBody');
      if (tbody) tbody.innerHTML = rows;
      const cnt = el.querySelector('#expCount');
      if (cnt) cnt.textContent = filtered.length;
    };

    el.innerHTML = `
      <div class="exp-list-card">
        <div class="exp-list-header">
          <div>
            <h5 class="exp-list-title"><i class="fas fa-folder-open me-2" style="color:var(--ak-teal)"></i>Expedientes Clínicos</h5>
            <span class="text-muted small"><span id="expCount">${list.length}</span> registros</span>
          </div>
          <div class="exp-list-actions">
            <div class="exp-search-wrap">
              <i class="fas fa-search exp-search-icon"></i>
              <input type="text" id="expSearch" class="exp-search-input"
                     placeholder="Buscar por folio, paciente…" autocomplete="off">
            </div>
            <button id="btnNuevoExp" class="exp-btn-nuevo">
              <i class="fas fa-plus me-1"></i>Nuevo expediente
            </button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="exp-list-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Paciente</th>
                <th>Motivo de consulta</th>
                <th>Fecha valoración</th>
                <th>Modificado</th>
                <th style="width:50px"></th>
              </tr>
            </thead>
            <tbody id="expTableBody"></tbody>
          </table>
        </div>
      </div>`;

    renderTable('');

    el.querySelector('#expSearch')?.addEventListener('input', e => renderTable(e.target.value));

    el.addEventListener('click', async e => {
      const delBtn = e.target.closest('.exp-del-btn');
      if (delBtn) {
        e.stopPropagation();
        const folio = delBtn.dataset.folio;
        const entry = list.find(x => x.folio === folio);
        const nombre = entry?.nombre_paciente ? `"${entry.nombre_paciente}"` : `folio ${folio}`;
        if (!confirm(`¿Eliminar el expediente ${nombre}?\n\nSe guardará un registro de auditoría antes de eliminar. Esta acción no se puede deshacer.`)) return;
        delBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        delBtn.disabled = true;
        const r = await App.api('DELETE', '/expedientes', null, { folio });
        if (r?.success) {
          const idx = list.findIndex(x => x.folio === folio);
          if (idx !== -1) list.splice(idx, 1);
          renderTable(el.querySelector('#expSearch')?.value || '');
          showToastGlobal(`Expediente ${folio} eliminado. Registro de auditoría guardado.`, 'success');
        } else {
          delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
          delBtn.disabled = false;
          showToastGlobal(r?.error || 'Error al eliminar', 'danger');
        }
        return;
      }
      const row = e.target.closest('.exp-list-row');
      if (row && !e.target.closest('button')) App.go('expediente/' + row.dataset.folio);
    });

    el.querySelector('#btnNuevoExp')?.addEventListener('click', async () => {
      const btn = el.querySelector('#btnNuevoExp');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Generando…';
      const r = await App.get('/expediente', { section: 'folio_next' });
      if (r?.folio) { App.go('expediente/' + r.folio); }
      else { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus me-1"></i>Nuevo expediente'; }
    });
  },

  /* ── Expediente Clínico ────────────────────────────── */
  async expediente(el, folio) {
    App.currentFolio = folio || 'borrador';
    const [resPro, resPac, resAnam, resEstilo, resDolor, resVit, resExplo, resEscalas, resDiag, resPlan, resFotos, resConsent] = await Promise.all([
      App.get('/expediente', { section: 'profesional', folio: '_global' }),
      App.get('/expediente', { section: 'paciente',    folio: App.currentFolio }),
      App.get('/expediente', { section: 'anamnesis',   folio: App.currentFolio }),
      App.get('/expediente', { section: 'estilo',      folio: App.currentFolio }),
      App.get('/expediente', { section: 'dolor',       folio: App.currentFolio }),
      App.get('/expediente', { section: 'vitales',     folio: App.currentFolio }),
      App.get('/expediente', { section: 'exploracion', folio: App.currentFolio }),
      App.get('/expediente', { section: 'escalas',     folio: App.currentFolio }),
      App.get('/expediente', { section: 'diagnostico', folio: App.currentFolio }),
      App.get('/expediente', { section: 'plan',        folio: App.currentFolio }),
      App.get('/expediente', { section: 'fotos',       folio: App.currentFolio }),
      App.get('/expediente', { section: 'consentimiento', folio: App.currentFolio }),
    ]);
    if (!resPro || resPro.error) {
      const msg = resPro?.error || 'Error de conexión';
      const esTabla = msg.toLowerCase().includes("doesn't exist") || msg.toLowerCase().includes("exist");
      el.innerHTML = `<div class="alert alert-danger m-4">
        <b><i class="fas fa-exclamation-triangle me-2"></i>Error cargando expediente:</b> ${esc(msg)}<br>
        ${esTabla ? '<small class="mt-1 d-block">La tabla <code>expediente_config</code> no existe. Ejecuta <code>setup_expediente.sql</code> en phpMyAdmin de Hostinger.</small>' : ''}
      </div>`;
      return;
    }
    const pro     = resPro.data || {};
    const pac     = resPac?.data    || {};
    const anam    = resAnam?.data   || {};
    const estilo  = resEstilo?.data || {};
    const dolor   = resDolor?.data  || {};
    const vitales = resVit?.data    || {};
    const explo   = resExplo?.data  || {};
    const escalas = resEscalas?.data || {};
    const diag    = resDiag?.data   || {};
    const plan    = resPlan?.data   || {};
    const fotos   = resFotos?.data  || {};
    const consent = resConsent?.data || {};


    const antsList = [
      ['diabetes',      'Diabetes'],
      ['hipertension',  'Hipertensión'],
      ['cardiopatia',   'Cardiopatía'],
      ['reumatica',     'Reumática'],
      ['osteoporosis',  'Osteoporosis'],
      ['neurologica',   'Neurológica'],
      ['respiratoria',  'Respiratoria'],
      ['cirugia_rec',   'Cirugía reciente'],
      ['fractura_prev', 'Fractura previa'],
      ['protesis',      'Prótesis / implantes'],
      ['dolor_cronico', 'Dolor crónico'],
      ['embarazo',      'Embarazo'],
      ['alergias_ant',  'Alergias'],
      ['ninguno',       'Ninguno referido'],
    ];
    const antActivos = anam.antecedentes || [];
    const antsHtml   = antsList.map(([k, l]) => {
      const on = antActivos.includes(k);
      return `<button type="button" class="ant-toggle${on ? ' active' : ''}" data-key="${k}">${l} <span class="ant-dot"></span></button>`;
    }).join('');

    // ── Dolor helpers ──────────────────────────────────
    const evaClassify = n => {
      n = parseInt(n, 10);
      if (n <= 3) return ['LEVE',     '#27ae60'];
      if (n <= 6) return ['MODERADO', '#f39c12'];
      if (n <= 9) return ['INTENSO',  '#e74c3c'];
      return            ['SEVERO',    '#c0392b'];
    };
    const tipoDolorList = [
      ['pd_punzante','Punzante'],  ['pd_ardiente','Ardiente'],
      ['pd_electrico','Eléctrico'],['pd_sordo','Sordo / pesado'],
      ['pd_opresivo','Opresivo'],  ['pd_quemante','Quemante'],
      ['pd_hormigueo','Hormigueo'],['pd_calambre','Calambre'],
    ];
    const ritmoList = [
      ['rd_mecanico','Mecánico'],['rd_inflamatorio','Inflamatorio'],
      ['rd_neuropatico','Neuropático'],['rd_mixto','Mixto'],
    ];
    const comportList = [
      ['cd_reposo','Dolor en reposo'],  ['cd_movimiento','Dolor al movimiento'],
      ['cd_nocturno','Dolor nocturno'], ['cd_continuo','Dolor continuo'],
      ['cd_intermitente','Dolor intermitente'],['cd_progresivo','Dolor progresivo'],
    ];
    const mkToggles = (list, activos, grp) => list.map(([k, l]) =>
      `<button type="button" class="ant-toggle${activos.includes(k)?' active':''}" data-group="${grp}" data-key="${k}">${l} <span class="ant-dot"></span></button>`
    ).join('');
    const tipoDolorHtml = mkToggles(tipoDolorList, dolor.tipo_dolor     || [], 'tipo');
    const ritmoHtml     = mkToggles(ritmoList,     dolor.ritmo_dolor    || [], 'ritmo');
    const comportHtml   = mkToggles(comportList,   dolor.comportamiento || [], 'comport');

    const evaA = dolor.eva_actual ?? 5;
    const evaM = dolor.eva_maximo ?? 6;
    const evaN = dolor.eva_minimo ?? 3;
    const evaP = Math.round((+evaA + +evaM + +evaN) / 3);

    const mkEvaSlider = (id, label, val) => `
      <div class="col-12 col-sm-4">
        <div class="eva-slider-wrap">
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="eva-label">${label}</span>
            <span class="estres-badge" id="badge_${id}">${val}</span>
            <span class="eva-denom">/10</span>
          </div>
          <input type="range" name="${id}" id="slider_${id}"
                 class="form-range estres-slider" min="0" max="10" step="1" value="${val}">
        </div>
      </div>`;

    // ── Vitales helpers ────────────────────────────────
    const imcCompute = (p, t) => {
      p = parseFloat(p); t = parseFloat(t);
      if (!p || !t) return { val: '—', cls: '', clr: '#aaa' };
      const tm = t > 3 ? t / 100 : t;
      const imc = p / (tm * tm);
      const v = imc.toFixed(1);
      if (imc < 18.5) return { val: v, cls: 'BAJO PESO',   clr: '#3498db' };
      if (imc < 25)   return { val: v, cls: 'NORMAL',       clr: '#27ae60' };
      if (imc < 30)   return { val: v, cls: 'SOBREPESO',    clr: '#f39c12' };
      if (imc < 35)   return { val: v, cls: 'OBESIDAD I',   clr: '#e67e22' };
      if (imc < 40)   return { val: v, cls: 'OBESIDAD II',  clr: '#e74c3c' };
      return            { val: v, cls: 'OBESIDAD III', clr: '#c0392b' };
    };
    const imcInit = imcCompute(vitales.peso, vitales.talla);

    // ── Exploración helpers ─────────────────────────────
    const posturaList = [
      ['pt_cabeza',        'Cabeza adelantada'],
      ['pt_hombros',       'Hombros protraídos'],
      ['pt_hipercifosis',  'Hipercifosis'],
      ['pt_hiperlordosis', 'Hiperlordosis'],
      ['pt_escoliosis',    'Escoliosis'],
      ['pt_asim_pelv',     'Asimetría pélvica'],
      ['pt_rod_valga',     'Rodilla valga'],
      ['pt_rod_vara',      'Rodilla vara'],
      ['pt_pie_plano',     'Pie plano'],
      ['pt_pie_cavo',      'Pie cavo'],
      ['pt_sin_alt',       'Sin alteraciones'],
    ];
    const posturaHtml = mkToggles(posturaList, explo.postura || [], 'postura');
    const balEst      = explo.balance_estatico ?? 5;
    const balDin      = explo.balance_dinamico ?? 5;

    const mkEvaCard = (id, label, val, dark) => {
      const [cls, clr] = evaClassify(val);
      return `
      <div class="col-6 col-sm-3">
        <div class="eva-card${dark ? ' eva-card-dark' : ''}">
          <div class="eva-card-label">${label}</div>
          <div class="eva-card-val" id="cardval_${id}">${val}/10</div>
          <span class="eva-cls-tag" id="cardcls_${id}" style="color:${clr}">${cls}</span>
        </div>
      </div>`;
    };

    // ── Escalas helpers ─────────────────────────────────
    const ifgClassify = n => {
      n = parseInt(n, 10);
      if (n <= 25) return ['FUNCIONALIDAD GRAVE',    '#c0392b'];
      if (n <= 50) return ['FUNCIONALIDAD MODERADA', '#f39c12'];
      if (n <= 75) return ['FUNCIONALIDAD LEVE',     '#e67e22'];
      return             ['FUNCIONALIDAD BUENA',     '#27ae60'];
    };
    const indepClassify = n => {
      n = parseInt(n, 10);
      if (n <= 3) return ['DEPENDENCIA TOTAL',   '#c0392b'];
      if (n <= 6) return ['ASISTENCIA PARCIAL',  '#f39c12'];
      if (n <= 8) return ['ASISTENCIA MÍNIMA',   '#e67e22'];
      return             ['INDEPENDIENTE',        '#27ae60'];
    };
    const tolerClassify = n => {
      n = parseInt(n, 10);
      if (n <= 3) return ['TOLERANCIA BAJA',     '#c0392b'];
      if (n <= 6) return ['TOLERANCIA MODERADA', '#f39c12'];
      if (n <= 8) return ['TOLERANCIA ALTA',     '#e67e22'];
      return             ['TOLERANCIA MÁXIMA',   '#27ae60'];
    };
    const movilClassify = n => {
      n = parseInt(n, 10);
      if (n <= 3) return ['MOVILIDAD GRAVE',    '#c0392b'];
      if (n <= 6) return ['MOVILIDAD LIMITADA', '#f39c12'];
      if (n <= 8) return ['MOVILIDAD MODERADA', '#e67e22'];
      return             ['MOVILIDAD FUNCIONAL','#27ae60'];
    };
    const escIfg   = escalas.ifg   ?? 50;
    const escIndep = escalas.indep ?? 5;
    const escTol   = escalas.tol   ?? 5;
    const escMovil = escalas.movil ?? 5;
    const [evaTotCls, evaTotClr] = evaClassify(evaP);
    const [ifgCls,   ifgClr]    = ifgClassify(escIfg);
    const [indepCls, indepClr]  = indepClassify(escIndep);
    const [tolCls,   tolClr]    = tolerClassify(escTol);
    const [movilCls, movilClr]  = movilClassify(escMovil);
    const mkScaleCard = (id, icon, title, val, max, classifyFn) => {
      const [cls, clr] = classifyFn(val);
      return `
        <div class="col-12 col-md-6">
          <div class="scale-card">
            <div class="scale-card-header">
              <span class="scale-card-icon"><i class="fas fa-${icon}"></i></span>
              <div class="flex-fill"><div class="scale-card-title">${title}</div></div>
              <span class="scale-card-badge" id="scbadge_${id}">${val}/${max}</span>
            </div>
            <div class="scale-cls-badge mt-2" id="sccls_${id}" style="color:${clr}">${cls}</div>
            <div class="scale-slider-wrap mt-3">
              <input type="range" name="${id}" id="slider_${id}"
                     class="form-range estres-slider" min="0" max="${max}" step="1" value="${val}">
            </div>
          </div>
        </div>`;
    };

    // ── Plan helpers ─────────────────────────────────
    const modalidadesList = [
      ['mod_terapia_manual',    'Terapia manual'],
      ['mod_ejercicio_ter',     'Ejercicio terapéutico'],
      ['mod_estiramientos',     'Estiramientos'],
      ['mod_fortalecimiento',   'Fortalecimiento'],
      ['mod_reeducacion_post',  'Reeducación postural'],
      ['mod_entren_marcha',     'Entrenamiento marcha'],
      ['mod_propiocepcion',     'Propiocepción'],
      ['mod_electroterapia',    'Electroterapia'],
      ['mod_termoterapia',      'Termoterapia'],
      ['mod_crioterapia',       'Crioterapia'],
      ['mod_ultrasonido',       'Ultrasonido'],
      ['mod_vendaje_neuro',     'Vendaje neuromuscular'],
      ['mod_lib_miofascial',    'Liberación miofascial'],
      ['mod_mov_articular',     'Mov. articular'],
      ['mod_educacion',         'Educación'],
      ['mod_prog_domiciliario', 'Programa domiciliario'],
      ['mod_seguimiento_func',  'Seguimiento funcional'],
    ];
    const modalidadesHtml = mkToggles(modalidadesList, plan.modalidades || [], 'modal');

    // ── Fotos helpers ─────────────────────────────────
    const fotoSlotsConfig = [
      ['postura_inicial', 'POSTURA INICIAL'],
      ['zona_afectada',   'ZONA AFECTADA'],
      ['rom_prueba',      'ROM / PRUEBA'],
      ['evolucion',       'EVOLUCIÓN'],
    ];
    const mkFotoSlot = (k, lbl, img) => {
      const has = !!img;
      return '<div class="col-6 col-sm-3">' +
        '<div class="foto-slot' + (has ? ' has-img' : '') + '" id="slot_' + k + '" data-key="' + k + '">' +
        (has ? '<img src="' + img + '" alt="' + lbl + '">' : '') +
        '<div class="foto-placeholder"' + (has ? ' style="display:none"' : '') + '>' +
        '<i class="fas fa-camera fa-2x mb-1"></i><span>' + lbl + '</span></div>' +
        '<div class="foto-slot-label">' + lbl + '</div>' +
        (has ? '<button type="button" class="foto-remove" data-key="' + k + '"><i class="fas fa-times"></i></button>' +
               '<span class="foto-check"><i class="fas fa-check"></i></span>' : '') +
        '<input type="file" class="foto-input d-none" accept="image/*" data-key="' + k + '">' +
        '</div></div>';
    };
    const fotosHtml = fotoSlotsConfig.map(([k, lbl]) => mkFotoSlot(k, lbl, fotos[k] || '')).join('');

    el.innerHTML = `
    <div class="ak-card">
      <div class="ak-card-head" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h6 style="margin:0 0 2px">
            <i class="fas fa-file-medical-alt me-2" style="color:var(--ak-teal)"></i>Expediente Clínico
          </h6>
          ${pac.nombre_paciente && App.currentFolio !== 'borrador'
            ? `<div style="font-size:12px;color:#666;font-weight:400;padding-left:2px"><i class="fas fa-user me-1" style="font-size:10px"></i>${esc(pac.nombre_paciente)}</div>`
            : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${App.currentFolio !== 'borrador'
            ? `<span class="exp-folio-tag">${esc(App.currentFolio)}</span>`
            : `<span class="exp-folio-tag exp-folio-draft"><i class="fas fa-pencil-alt me-1" style="font-size:9px"></i>Borrador</span>`}
          <a href="#expedientes" class="btn btn-sm btn-outline-secondary" style="font-size:11px;padding:3px 10px">
            <i class="fas fa-list me-1"></i>Ver todos
          </a>
        </div>
      </div>

      <ul class="nav nav-tabs px-4 pt-3" id="expTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" data-bs-toggle="tab"
                  data-bs-target="#tab-pro" type="button" role="tab">
            <i class="fas fa-user-md me-1"></i>PROFESIONAL
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-pac" type="button" role="tab">
            <i class="fas fa-id-card me-1"></i>PACIENTE
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-anam" type="button" role="tab">
            <i class="fas fa-clipboard-list me-1"></i>ANAMNESIS
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-estilo" type="button" role="tab">
            <i class="fas fa-running me-1"></i>ESTILO
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-dolor" type="button" role="tab">
            <i class="fas fa-bolt me-1"></i>DOLOR
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-vitales" type="button" role="tab">
            <i class="fas fa-heartbeat me-1"></i>VITALES
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-explo" type="button" role="tab">
            <i class="fas fa-stethoscope me-1"></i>EXPLORACIÓN
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-escalas" type="button" role="tab">
            <i class="fas fa-chart-bar me-1"></i>ESCALAS
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-diag" type="button" role="tab">
            <i class="fas fa-diagnoses me-1"></i>DIAGNÓSTICO
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-plan" type="button" role="tab">
            <i class="fas fa-tasks me-1"></i>PLAN
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-fotos" type="button" role="tab">
            <i class="fas fa-camera me-1"></i>FOTOS
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" data-bs-toggle="tab"
                  data-bs-target="#tab-consent" type="button" role="tab">
            <i class="fas fa-file-signature me-1"></i>CONSENTIMIENTO
          </button>
        </li>
      </ul>

      <div class="tab-content" id="expTabContent">

        <!-- ── PROFESIONAL ──────────────────────── -->
        <div class="tab-pane fade show active p-4" id="tab-pro" role="tabpanel">
          <form id="proForm">
            <div class="row">
              <div class="col-12 col-md-8">
                <div class="exp-section-header mb-4">
                  <i class="fas fa-id-badge me-2" style="color:var(--ak-teal)"></i>
                  Datos del fisioterapeuta
                </div>

                <div class="mb-3">
                  <label class="exp-label">Nombre del fisioterapeuta</label>
                  <input type="text" name="nombre" class="form-control"
                         value="${esc(pro.nombre||'')}"
                         placeholder="Nombre completo del profesional">
                </div>

                <div class="row mb-3">
                  <div class="col-12 col-sm-6">
                    <label class="exp-label">Especialidad / área de atención</label>
                    <input type="text" name="especialidad" class="form-control"
                           value="${esc(pro.especialidad||'')}"
                           placeholder="Ej. Fisioterapia ortopédica">
                  </div>
                  <div class="col-12 col-sm-6">
                    <label class="exp-label">Cédula / licencia / registro profesional</label>
                    <input type="text" name="cedula" class="form-control"
                           value="${esc(pro.cedula||'')}"
                           placeholder="Ced. Prof. 0000000">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="exp-label">Clínica / centro de rehabilitación</label>
                  <input type="text" name="clinica" class="form-control"
                         value="${esc(pro.clinica||'')}"
                         placeholder="Nombre de la clínica u hospital">
                </div>

                <div class="row mb-3">
                  <div class="col-12 col-sm-6">
                    <label class="exp-label">Dirección</label>
                    <input type="text" name="direccion" class="form-control"
                           value="${esc(pro.direccion||'')}"
                           placeholder="Calle, número, colonia, ciudad">
                  </div>
                  <div class="col-12 col-sm-6">
                    <label class="exp-label">Teléfono</label>
                    <input type="tel" name="telefono" class="form-control"
                           value="${esc(pro.telefono||'')}"
                           placeholder="33 0000 0000">
                  </div>
                </div>

                <div class="mb-4">
                  <label class="exp-label">Correo electrónico</label>
                  <input type="email" name="email" class="form-control"
                         value="${esc(pro.email||'')}"
                         placeholder="contacto@clinica.mx">
                </div>

                <div class="d-flex align-items-center gap-3">
                  <button type="submit" class="btn btn-ak px-4">
                    <i class="fas fa-save me-1"></i>Guardar sección
                  </button>
                  <span id="proSaveOk" class="text-success fw-semibold"
                        style="display:none;font-size:13px">
                    <i class="fas fa-check-circle me-1"></i>Guardado correctamente
                  </span>
                </div>
              </div>

              <!-- Logo -->
              <div class="col-12 col-md-4 d-flex flex-column align-items-center pt-3 pt-md-4 ps-md-4">
                <div class="exp-logo-wrap" id="logoWrap">
                  ${pro.logo
                    ? `<img src="${esc(pro.logo)}" alt="Logo de la clínica">`
                    : `<div class="exp-logo-placeholder">
                        <i class="fas fa-image fa-3x mb-2"></i>
                        <span>Logo de la clínica</span>
                      </div>`}
                </div>
                <label class="btn btn-sm btn-outline-secondary mt-2" for="logoInput"
                       style="cursor:pointer">
                  <i class="fas fa-upload me-1"></i>Cambiar logo
                </label>
                <input type="file" id="logoInput" accept="image/*" class="d-none">
              </div>
            </div>
          </form>
        </div>

        <!-- ── PACIENTE ──────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-pac" role="tabpanel">
          <form id="pacForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-id-card me-2" style="color:var(--ak-teal)"></i>
              Identificación del paciente
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-7">
                <label class="exp-label">Nombre completo del paciente</label>
                <input type="text" name="nombre_paciente" class="form-control"
                       value="${esc(pac.nombre_paciente||'')}"
                       placeholder="Apellidos y nombre(s)">
              </div>
              <div class="col-12 col-sm-5">
                <label class="exp-label">Folio clínico / expediente</label>
                <div class="input-group">
                  <input type="text" name="folio" id="folioInput" class="form-control"
                         value="${esc(App.currentFolio !== 'borrador' ? App.currentFolio : pac.folio||'')}"
                         placeholder="FISIO-0001">
                  <button class="btn btn-outline-secondary" type="button" id="genFolioBtn"
                          title="Generar folio automático">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-6 col-sm-3">
                <label class="exp-label">Edad</label>
                <input type="text" id="edadField" class="form-control"
                       value="${esc(pac.edad||'')}" readonly
                       style="background:#f8f9fa" placeholder="— años">
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Fecha de nacimiento</label>
                <input type="date" name="fecha_nac" id="fechaNacField" class="form-control"
                       value="${esc(pac.fecha_nac||'')}">
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Sexo</label>
                <select name="sexo" class="form-select">
                  ${['Masculino','Femenino','Otro'].map(o =>
                    `<option${pac.sexo===o?' selected':''}>${o}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Lateralidad</label>
                <select name="lateralidad" class="form-select">
                  ${['Diestro','Zurdo','Ambidiestro'].map(o =>
                    `<option${pac.lateralidad===o?' selected':''}>${o}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-4">
                <label class="exp-label">Teléfono</label>
                <input type="tel" name="telefono_pac" class="form-control"
                       value="${esc(pac.telefono_pac||'')}" placeholder="33 0000 0000">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Ocupación</label>
                <input type="text" name="ocupacion" class="form-control"
                       value="${esc(pac.ocupacion||'')}" placeholder="Profesión u oficio">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Fecha de valoración</label>
                <input type="date" name="fecha_valoracion" class="form-control"
                       value="${esc(pac.fecha_valoracion||'')}">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-4">
                <label class="exp-label">Responsable / familiar acompañante</label>
                <input type="text" name="responsable" class="form-control"
                       value="${esc(pac.responsable||'')}" placeholder="Nombre completo">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Parentesco</label>
                <input type="text" name="parentesco" class="form-control"
                       value="${esc(pac.parentesco||'')}" placeholder="Ej. Esposa, Hijo…">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Teléfono del responsable</label>
                <input type="tel" name="tel_responsable" class="form-control"
                       value="${esc(pac.tel_responsable||'')}" placeholder="33 0000 0000">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Motivo principal de consulta (resumen)</label>
                <input type="text" name="motivo_consulta" class="form-control"
                       value="${esc(pac.motivo_consulta||'')}"
                       placeholder="Descripción breve del motivo">
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Diagnóstico médico referido</label>
                <input type="text" name="diagnostico_referido" class="form-control"
                       value="${esc(pac.diagnostico_referido||'')}"
                       placeholder="Diagnóstico del médico remitente">
              </div>
            </div>

            <div class="row mb-4">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Médico tratante / referencia</label>
                <input type="text" name="medico_tratante" class="form-control"
                       value="${esc(pac.medico_tratante||'')}"
                       placeholder="Nombre y especialidad">
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">
                  <i class="fas fa-exclamation-triangle text-danger me-1"></i>
                  Banderas rojas / contraindicaciones
                </label>
                <input type="text" name="banderas_rojas" class="form-control exp-banderas"
                       value="${esc(pac.banderas_rojas||'')}"
                       placeholder="Síntomas de alarma o contraindicaciones">
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="pacSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── ANAMNESIS ──────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-anam" role="tabpanel">
          <form id="anamForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-clipboard-list me-2" style="color:var(--ak-teal)"></i>
              Anamnesis fisioterapéutica
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Motivo de consulta</label>
                <textarea name="motivo_consulta" class="form-control" rows="4"
                          placeholder="Descripción detallada del motivo…">${esc(anam.motivo_consulta||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Historia del padecimiento actual</label>
                <textarea name="historia_padecimiento" class="form-control" rows="4"
                          placeholder="Evolución temporal del padecimiento…">${esc(anam.historia_padecimiento||'')}</textarea>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-6 col-sm-3">
                <label class="exp-label">Fecha de inicio</label>
                <input type="date" name="fecha_inicio" class="form-control"
                       value="${esc(anam.fecha_inicio||'')}">
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Mecanismo de lesión</label>
                <select name="mecanismo_lesion" class="form-select">
                  ${['','Laboral','Deportivo','Accidental','Doméstico','Congénito','Traumático','Otro'].map(o =>
                    `<option value="${o}"${anam.mecanismo_lesion===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Evolución</label>
                <select name="evolucion" class="form-select">
                  ${['','Aguda','Subaguda','Crónica','Recurrente'].map(o =>
                    `<option value="${o}"${anam.evolucion===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Tiempo de evolución</label>
                <input type="text" name="tiempo_evolucion" class="form-control"
                       value="${esc(anam.tiempo_evolucion||'')}" placeholder="Ej. 3 Meses">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Factores que agravan</label>
                <input type="text" name="factores_agravan" class="form-control"
                       value="${esc(anam.factores_agravan||'')}"
                       placeholder="Actividades o situaciones que empeoran">
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Factores que alivian</label>
                <input type="text" name="factores_alivian" class="form-control"
                       value="${esc(anam.factores_alivian||'')}"
                       placeholder="Actividades o situaciones que mejoran">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Tratamientos previos</label>
                <textarea name="tratamientos_previos" class="form-control" rows="4"
                          placeholder="Tratamientos anteriores recibidos…">${esc(anam.tratamientos_previos||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Medicamentos actuales</label>
                <textarea name="medicamentos_actuales" class="form-control" rows="4"
                          placeholder="Medicamentos que toma actualmente…">${esc(anam.medicamentos_actuales||'')}</textarea>
              </div>
            </div>

            <div class="row mb-4">
              <div class="col-12 col-sm-4">
                <label class="exp-label">Cirugías previas</label>
                <input type="text" name="cirugias_previas" class="form-control"
                       value="${esc(anam.cirugias_previas||'')}" placeholder="Ninguna / descripción">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Fracturas / luxaciones previas</label>
                <input type="text" name="fracturas_previas" class="form-control"
                       value="${esc(anam.fracturas_previas||'')}" placeholder="Ninguna / descripción">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Alergias</label>
                <input type="text" name="alergias_info" class="form-control"
                       value="${esc(anam.alergias_info||'')}" placeholder="Ninguna conocida / descripción">
              </div>
            </div>

            <!-- ANTECEDENTES RELEVANTES -->
            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-history me-2"></i>ANTECEDENTES RELEVANTES
              </div>
              <div class="ant-grid">
                ${antsHtml}
              </div>
            </div>

            <div class="mb-4">
              <label class="exp-label">Observaciones clínicas adicionales</label>
              <textarea name="observaciones_clinicas" class="form-control" rows="4"
                        placeholder="Observaciones relevantes del profesional…">${esc(anam.observaciones_clinicas||'')}</textarea>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="anamSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── ESTILO DE VIDA ─────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-estilo" role="tabpanel">
          <form id="estiloForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-heartbeat me-2" style="color:var(--ak-teal)"></i>
              Estilo de vida y contexto funcional
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-4">
                <label class="exp-label">Nivel de actividad física</label>
                <select name="nivel_actividad" class="form-select">
                  ${['','Sedentario','Levemente activo','Moderadamente activo','Activo','Muy activo'].map(o =>
                    `<option value="${o}"${estilo.nivel_actividad===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Actividad laboral</label>
                <input type="text" name="actividad_laboral" class="form-control"
                       value="${esc(estilo.actividad_laboral||'')}"
                       placeholder="Descripción del trabajo">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Exigencia física laboral</label>
                <select name="exigencia_laboral" class="form-select">
                  ${['','Baja','Moderada','Alta','Muy alta'].map(o =>
                    `<option value="${o}"${estilo.exigencia_laboral===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-6 col-sm-3">
                <label class="exp-label">Horas de sueño promedio</label>
                <input type="number" name="horas_sueno" class="form-control"
                       min="0" max="24" step="0.5"
                       value="${esc(estilo.horas_sueno||'')}" placeholder="Ej. 7">
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Tabaquismo</label>
                <select name="tabaquismo" class="form-select">
                  ${['','Negado','Ocasional','Moderado','Intenso','Ex fumador'].map(o =>
                    `<option value="${o}"${estilo.tabaquismo===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Alcohol</label>
                <select name="alcohol" class="form-select">
                  ${['','Negado','Ocasional','Moderado','Frecuente'].map(o =>
                    `<option value="${o}"${estilo.alcohol===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
              <div class="col-6 col-sm-3">
                <label class="exp-label">Deporte practicado</label>
                <input type="text" name="deporte" class="form-control"
                       value="${esc(estilo.deporte||'')}" placeholder="Ninguno / descripción">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <div class="estres-wrap">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="exp-label mb-0" style="font-weight:800;text-transform:uppercase;letter-spacing:.5px">
                      Nivel de estrés
                    </span>
                    <span class="estres-badge" id="estresBadge">${estilo.nivel_estres ?? 5}</span>
                  </div>
                  <input type="range" name="nivel_estres" id="estresSlider"
                         class="form-range estres-slider" min="0" max="10" step="1"
                         value="${estilo.nivel_estres ?? 5}">
                  <div class="d-flex justify-content-between" style="font-size:10px;color:#aaa;margin-top:2px">
                    <span>0</span><span>5</span><span>10</span>
                  </div>
                </div>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Limitaciones en actividades de la vida diaria (AVD)</label>
                <input type="text" name="limitaciones_avd" class="form-control"
                       value="${esc(estilo.limitaciones_avd||'')}"
                       placeholder="Dificultades en actividades cotidianas"
                       style="margin-top:4px">
              </div>
            </div>

            <div class="mb-4">
              <label class="exp-label">Objetivo principal del paciente</label>
              <input type="text" name="objetivo_paciente" class="form-control"
                     value="${esc(estilo.objetivo_paciente||'')}"
                     placeholder="Meta funcional del paciente para este tratamiento">
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="estiloSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── DOLOR ─────────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-dolor" role="tabpanel">
          <form id="dolorForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-bolt me-2" style="color:var(--ak-teal)"></i>
              Evaluación del dolor
            </div>

            <div class="row mb-4">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Localización del dolor</label>
                <input type="text" name="localizacion_dolor" class="form-control"
                       value="${esc(dolor.localizacion_dolor||'')}"
                       placeholder="Área anatómica principal afectada">
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Irradiación</label>
                <input type="text" name="irradiacion" class="form-control"
                       value="${esc(dolor.irradiacion||'')}"
                       placeholder="Zonas hacia donde irradia el dolor">
              </div>
            </div>

            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-bolt me-2"></i>TIPO DE DOLOR
              </div>
              <div class="ant-grid">${tipoDolorHtml}</div>
            </div>

            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-wave-square me-2"></i>RITMO DEL DOLOR
              </div>
              <div class="ant-grid">${ritmoHtml}</div>
            </div>

            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-chart-line me-2"></i>ESCALA VISUAL ANALÓGICA (EVA)
              </div>
              <div class="row mb-3">
                ${mkEvaSlider('eva_actual', 'EVA ACTUAL', evaA)}
                ${mkEvaSlider('eva_maximo', 'EVA MÁXIMO', evaM)}
                ${mkEvaSlider('eva_minimo', 'EVA MÍNIMO', evaN)}
              </div>
              <div class="row g-2">
                ${mkEvaCard('eva_actual', 'EVA ACTUAL', evaA, false)}
                ${mkEvaCard('eva_maximo', 'EVA MÁXIMO', evaM, false)}
                ${mkEvaCard('eva_minimo', 'EVA MÍNIMO', evaN, false)}
                ${mkEvaCard('promedio',   'PROMEDIO',   evaP, true)}
              </div>
            </div>

            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-clock me-2"></i>COMPORTAMIENTO DEL DOLOR
              </div>
              <div class="ant-grid">${comportHtml}</div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="dolorSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── VITALES ───────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-vitales" role="tabpanel">
          <form id="vitalesForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-heartbeat me-2" style="color:var(--ak-teal)"></i>
              Signos vitales y somatometría
            </div>

            <div class="vitales-grid mb-3">
              <div>
                <label class="exp-label">Peso (kg)</label>
                <input type="number" name="peso" id="vitPeso" class="form-control"
                       min="0" max="300" step="0.1"
                       value="${esc(vitales.peso||'')}" placeholder="82">
              </div>
              <div>
                <label class="exp-label">Talla (cm o m)</label>
                <input type="number" name="talla" id="vitTalla" class="form-control"
                       min="0" max="300" step="0.1"
                       value="${esc(vitales.talla||'')}" placeholder="176">
              </div>
              <div>
                <label class="exp-label">TA (mmHg)</label>
                <input type="text" name="ta" class="form-control"
                       value="${esc(vitales.ta||'')}" placeholder="120/80">
              </div>
              <div class="imc-card" id="imcCard">
                <div class="imc-label">IMC</div>
                <div class="imc-val" id="imcVal">${imcInit.val}</div>
                <div class="imc-cls" id="imcCls" style="color:${imcInit.clr}">${imcInit.cls}</div>
              </div>
            </div>

            <div class="vitales-grid mb-4">
              <div>
                <label class="exp-label">Temperatura (°C)</label>
                <input type="number" name="temperatura" class="form-control"
                       min="30" max="45" step="0.1"
                       value="${esc(vitales.temperatura||'')}" placeholder="36.5">
              </div>
              <div>
                <label class="exp-label">FC (lpm)</label>
                <input type="number" name="fc" class="form-control"
                       min="0" max="250" step="1"
                       value="${esc(vitales.fc||'')}" placeholder="70">
              </div>
              <div>
                <label class="exp-label">FR (rpm)</label>
                <input type="number" name="fr" class="form-control"
                       min="0" max="60" step="1"
                       value="${esc(vitales.fr||'')}" placeholder="16">
              </div>
              <div>
                <label class="exp-label">SatO₂ (%)</label>
                <input type="number" name="sato2" class="form-control"
                       min="0" max="100" step="1"
                       value="${esc(vitales.sato2||'')}" placeholder="98">
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="vitSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── EXPLORACIÓN ───────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-explo" role="tabpanel">
          <form id="exploForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-stethoscope me-2" style="color:var(--ak-teal)"></i>
              Exploración física y funcional
            </div>

            <!-- POSTURA Y ALINEACIÓN -->
            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-male me-2"></i>POSTURA Y ALINEACIÓN
              </div>
              <div class="ant-grid mb-3">${posturaHtml}</div>
              <div>
                <label class="exp-label">Observaciones posturales</label>
                <textarea name="obs_posturales" class="form-control" rows="3"
                          placeholder="Descripción de alteraciones posturales observadas…">${esc(explo.obs_posturales||'')}</textarea>
              </div>
            </div>

            <!-- MARCHA Y MOVILIDAD -->
            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-walking me-2"></i>MARCHA Y MOVILIDAD
              </div>
              <div class="row mb-3">
                <div class="col-12 col-sm-4">
                  <label class="exp-label">Patrón de marcha</label>
                  <select name="patron_marcha" class="form-select">
                    ${['','Normal','Antálgica','Espástica','Atáxica','Claudicante','Steppage','Otro'].map(o =>
                      `<option value="${o}"${explo.patron_marcha===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                  </select>
                </div>
                <div class="col-12 col-sm-4">
                  <label class="exp-label">Ayuda técnica</label>
                  <select name="ayuda_tecnica" class="form-select">
                    ${['','Ninguna','Bastón','Muletas axilares','Muletas canadienses','Andadera','Silla de ruedas','Otro'].map(o =>
                      `<option value="${o}"${explo.ayuda_tecnica===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                  </select>
                </div>
                <div class="col-12 col-sm-4">
                  <label class="exp-label">Transferencias</label>
                  <select name="transferencias" class="form-select">
                    ${['','Independiente','Supervisión','Asistencia parcial','Asistencia total','Dependiente'].map(o =>
                      `<option value="${o}"${explo.transferencias===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="row">
                <div class="col-12 col-sm-6">
                  <label class="exp-label">Tolerancia a la marcha</label>
                  <input type="text" name="tolerancia_marcha" class="form-control"
                         value="${esc(explo.tolerancia_marcha||'')}"
                         placeholder="Ej. 20 minutos de caminata continua">
                </div>
                <div class="col-12 col-sm-6">
                  <label class="exp-label">Observaciones de marcha</label>
                  <input type="text" name="obs_marcha" class="form-control"
                         value="${esc(explo.obs_marcha||'')}"
                         placeholder="Descripción del patrón observado">
                </div>
              </div>
            </div>

            <!-- BALANCE Y COORDINACIÓN -->
            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-balance-scale me-2"></i>BALANCE Y COORDINACIÓN
              </div>
              <div class="row">
                ${mkEvaSlider('bal_estatico', 'EQUILIBRIO ESTÁTICO', balEst)}
                ${mkEvaSlider('bal_dinamico', 'EQUILIBRIO DINÁMICO', balDin)}
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="exploSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── ESCALAS ──────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-escalas" role="tabpanel">
          <form id="escalasForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-chart-bar me-2" style="color:var(--ak-teal)"></i>
              Escalas funcionales
            </div>
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <div class="scale-card">
                  <div class="scale-card-header">
                    <span class="scale-card-icon"><i class="fas fa-thermometer-half"></i></span>
                    <div class="flex-fill">
                      <div class="scale-card-title">EVA TOTAL</div>
                      <div class="scale-card-sub">Promedio de escala de dolor</div>
                    </div>
                    <span class="scale-card-badge">${evaP}/10</span>
                  </div>
                  <div class="scale-cls-badge mt-2" style="color:${evaTotClr}">${evaTotCls}</div>
                  <div class="scale-slider-wrap mt-3">
                    <input type="range" class="form-range" min="0" max="10" value="${evaP}" disabled>
                  </div>
                </div>
              </div>
              ${mkScaleCard('ifg',   'chart-line',        'ÍNDICE FUNCIONAL GLOBAL', escIfg,   100, ifgClassify)}
              ${mkScaleCard('indep', 'user-check',        'INDEPENDENCIA FUNCIONAL', escIndep, 10,  indepClassify)}
              ${mkScaleCard('tol',   'running',           'TOLERANCIA AL ESFUERZO',  escTol,   10,  tolerClassify)}
              ${mkScaleCard('movil', 'expand-arrows-alt', 'MOVILIDAD FUNCIONAL',     escMovil, 10,  movilClassify)}
              <div class="col-12 col-md-6">
                <div class="scale-card">
                  <div class="scale-card-header">
                    <span class="scale-card-icon"><i class="fas fa-exclamation-triangle"></i></span>
                    <div class="flex-fill">
                      <div class="scale-card-title">SEVERIDAD DE LIMITACIÓN</div>
                    </div>
                  </div>
                  <div class="mt-3">
                    <select name="severidad_limitacion" class="form-select">
                      ${['','Leve','Moderada','Severa','Muy severa','Completa'].map(o =>
                        `<option value="${o}"${escalas.severidad_limitacion===o?' selected':''}>${o||'Seleccione'}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-3 mt-4">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="escalasSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── DIAGNÓSTICO ──────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-diag" role="tabpanel">
          <form id="diagForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-diagnoses me-2" style="color:var(--ak-teal)"></i>
              Diagnóstico funcional
            </div>

            <div class="mb-3">
              <label class="exp-label">Diagnóstico fisioterapéutico</label>
              <textarea name="diagnostico_fisio" class="form-control" rows="4"
                        style="font-weight:600"
                        placeholder="Descripción completa del diagnóstico fisioterapéutico…">${esc(diag.diagnostico_fisio||'')}</textarea>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Estructuras / regiones comprometidas</label>
                <textarea name="estructuras" class="form-control" rows="4"
                          placeholder="Regiones anatómicas comprometidas…">${esc(diag.estructuras||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Deficiencias principales</label>
                <textarea name="deficiencias" class="form-control" rows="4"
                          placeholder="Principales deficiencias identificadas…">${esc(diag.deficiencias||'')}</textarea>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Limitaciones funcionales</label>
                <textarea name="limitaciones_func" class="form-control" rows="4"
                          placeholder="Limitaciones en actividades funcionales…">${esc(diag.limitaciones_func||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Restricciones en participación</label>
                <textarea name="restricciones_part" class="form-control" rows="4"
                          placeholder="Restricciones en la participación social/laboral…">${esc(diag.restricciones_part||'')}</textarea>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Hipótesis clínica</label>
                <textarea name="hipotesis_clinica" class="form-control" rows="4"
                          placeholder="Hipótesis sobre la causa y mecanismo del cuadro…">${esc(diag.hipotesis_clinica||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Pronóstico funcional</label>
                <select name="pronostico_funcional" class="form-select mt-1">
                  ${['','Malo','Regular','Bueno','Muy bueno','Excelente'].map(o =>
                    `<option value="${o}"${diag.pronostico_funcional===o?' selected':''}>${o||'— Seleccionar —'}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="mb-3">
              <label class="exp-label">Objetivo general de tratamiento</label>
              <textarea name="objetivo_general" class="form-control" rows="3"
                        placeholder="Meta principal del tratamiento fisioterapéutico…">${esc(diag.objetivo_general||'')}</textarea>
            </div>

            <div class="mb-4">
              <label class="exp-label">Objetivos específicos</label>
              <textarea name="objetivos_especificos" class="form-control" rows="4"
                        placeholder="• Reducir dolor de 8/10 a 3/10 en 4 semanas&#10;• Recuperar 90% del ROM…">${esc(diag.objetivos_especificos||'')}</textarea>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="diagSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── PLAN ──────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-plan" role="tabpanel">
          <form id="planForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-tasks me-2" style="color:var(--ak-teal)"></i>
              Plan de tratamiento
            </div>

            <div class="ant-section mb-4">
              <div class="ant-section-header mb-3">
                <i class="fas fa-list-check me-2"></i>MODALIDADES TERAPÉUTICAS
              </div>
              <div class="ant-grid">
                ${modalidadesHtml}
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-4">
                <label class="exp-label">Frecuencia sugerida</label>
                <input type="text" name="frecuencia" class="form-control"
                       value="${esc(plan.frecuencia||'')}"
                       placeholder="Ej. 3 veces por semana">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Duración estimada del plan</label>
                <input type="text" name="duracion_plan" class="form-control"
                       value="${esc(plan.duracion_plan||'')}"
                       placeholder="Ej. 6 semanas">
              </div>
              <div class="col-12 col-sm-4">
                <label class="exp-label">Número de sesiones sugeridas</label>
                <input type="text" name="num_sesiones" class="form-control"
                       value="${esc(plan.num_sesiones||'')}"
                       placeholder="Ej. 12">
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Indicaciones domiciliarias</label>
                <textarea name="indicaciones_domiciliarias" class="form-control" rows="4"
                          placeholder="Ejercicios y cuidados en casa…">${esc(plan.indicaciones_domiciliarias||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Precauciones</label>
                <textarea name="precauciones" class="form-control" rows="4"
                          placeholder="Actividades a evitar o limitar…">${esc(plan.precauciones||'')}</textarea>
              </div>
            </div>

            <div class="row mb-4">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Criterios de alta</label>
                <textarea name="criterios_alta" class="form-control" rows="4"
                          placeholder="Criterios para dar de alta al paciente…">${esc(plan.criterios_alta||'')}</textarea>
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Recomendaciones finales</label>
                <textarea name="recomendaciones_finales" class="form-control" rows="4"
                          placeholder="Recomendaciones al término del tratamiento…">${esc(plan.recomendaciones_finales||'')}</textarea>
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar sección
              </button>
              <span id="planSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── FOTOS ──────────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-fotos" role="tabpanel">
          <form id="fotosForm">
            <div class="exp-section-header mb-3">
              <i class="fas fa-camera me-2" style="color:var(--ak-teal)"></i>
              Documentación fotográfica clínica
            </div>
            <p class="text-muted mb-4" style="font-size:13px">
              Adjunte hasta 4 imágenes para complementar la valoración.
              Las fotos cargadas se incluirán en el reporte PDF.
            </p>
            <div class="row g-3 mb-4">
              ${fotosHtml}
            </div>
            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar fotos
              </button>
              <span id="fotosSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

        <!-- ── CONSENTIMIENTO ──────────────────────── -->
        <div class="tab-pane fade p-4" id="tab-consent" role="tabpanel">
          <form id="consentForm">
            <div class="exp-section-header mb-4">
              <i class="fas fa-file-signature me-2" style="color:var(--ak-teal)"></i>
              Consentimiento informado
            </div>

            <div class="consent-text mb-4">
              Yo, <strong>el paciente o responsable legal</strong>, declaro que he sido informado(a)
              de manera clara y suficiente sobre el procedimiento de
              <strong>valoración fisioterapéutica</strong> y el
              <strong>plan de tratamiento</strong> propuesto, así como de sus objetivos,
              posibles beneficios, riesgos, alternativas y precauciones. He tenido la oportunidad
              de aclarar mis dudas y entiendo que puedo retirar este consentimiento en cualquier
              momento. Autorizo al fisioterapeuta tratante a llevar a cabo las técnicas y
              modalidades terapéuticas necesarias para mi rehabilitación funcional, así como el
              registro fotográfico clínico cuando sea pertinente,
              <u>bajo confidencialidad</u>.
            </div>

            <div class="consent-check-wrap mb-4">
              <input type="checkbox" id="consentAcepta" name="acepta" class="form-check-input me-2"
                     ${consent.acepta ? 'checked' : ''}>
              <label for="consentAcepta" class="fw-bold" style="font-size:14px">
                El paciente acepta la valoración y tratamiento fisioterapéutico descrito.
              </label>
            </div>

            <div class="row mb-4">
              <div class="col-12 col-sm-6">
                <label class="exp-label">Nombre del paciente o responsable</label>
                <input type="text" name="nombre_responsable" class="form-control"
                       value="${esc(consent.nombre_responsable||'')}"
                       placeholder="Nombre completo">
              </div>
              <div class="col-12 col-sm-6">
                <label class="exp-label">Fecha de firma</label>
                <input type="date" name="fecha_firma" class="form-control"
                       value="${consent.fecha_firma || new Date().toISOString().slice(0,10)}">
              </div>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-12 col-md-6">
                <div class="firma-wrap">
                  <div class="firma-title mb-2">
                    <i class="fas fa-pen me-1"></i>FIRMA DEL PACIENTE / RESPONSABLE
                  </div>
                  <canvas id="canvasPaciente" class="firma-pad" width="800" height="200"></canvas>
                  <a href="#" id="borrarFirmaPaciente" class="firma-clear-link mt-2 d-inline-block">
                    <i class="fas fa-eraser me-1"></i>Borrar firma
                  </a>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="firma-wrap">
                  <div class="firma-title mb-2">
                    <i class="fas fa-user-md me-1"></i>FIRMA DEL FISIOTERAPEUTA
                  </div>
                  <canvas id="canvasFisio" class="firma-pad" width="800" height="200"></canvas>
                  <a href="#" id="borrarFirmaFisio" class="firma-clear-link mt-2 d-inline-block">
                    <i class="fas fa-eraser me-1"></i>Borrar firma
                  </a>
                </div>
              </div>
            </div>

            <div class="d-flex align-items-center gap-3">
              <button type="submit" class="btn btn-ak px-4">
                <i class="fas fa-save me-1"></i>Guardar consentimiento
              </button>
              <span id="consentSaveOk" class="text-success fw-semibold"
                    style="display:none;font-size:13px">
                <i class="fas fa-check-circle me-1"></i>Guardado correctamente
              </span>
            </div>
          </form>
        </div>

      </div><!-- /tab-content -->

      <!-- ── Barra de acciones ─────────────────────── -->
      <div class="exp-actions-bar">
        <button type="button" class="exp-action-btn exp-action-navy" id="btnPdfReporte">
          <span class="exp-action-icon"><i class="fas fa-file-medical-alt"></i></span>
          <div>
            <div class="exp-action-title">Reporte clínico</div>
            <div class="exp-action-sub">Generar PDF del expediente completo</div>
          </div>
        </button>
        <button type="button" class="exp-action-btn exp-action-navy" id="btnPdfPlan">
          <span class="exp-action-icon"><i class="fas fa-clipboard-list"></i></span>
          <div>
            <div class="exp-action-title">Plan terapéutico</div>
            <div class="exp-action-sub">Generar PDF del plan de tratamiento</div>
          </div>
        </button>
        ${App.currentFolio === 'borrador' ? `
        <button type="button" class="exp-action-btn exp-action-amber" id="btnLimpiarPro">
          <span class="exp-action-icon"><i class="fas fa-user-edit"></i></span>
          <div>
            <div class="exp-action-title">Limpiar datos del profesional</div>
            <div class="exp-action-sub">Restablecer información del fisioterapeuta</div>
          </div>
        </button>
        <button type="button" class="exp-action-btn exp-action-teal" id="btnNuevoRegistro">
          <span class="exp-action-icon"><i class="fas fa-plus-circle"></i></span>
          <div>
            <div class="exp-action-title">Nuevo expediente</div>
            <div class="exp-action-sub">Generar folio para nuevo paciente</div>
          </div>
        </button>
        ` : ''}
      </div>
    </div>`;

    el.querySelector('#logoInput')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        el.querySelector('#logoWrap').innerHTML =
          `<img src="${ev.target.result}" alt="Logo de la clínica">`;
        el.querySelector('#proForm').dataset.logo = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    el.querySelector('#proForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        nombre:       fd.get('nombre'),
        especialidad: fd.get('especialidad'),
        cedula:       fd.get('cedula'),
        clinica:      fd.get('clinica'),
        direccion:    fd.get('direccion'),
        telefono:     fd.get('telefono'),
        email:        fd.get('email'),
        logo:         e.target.dataset.logo || pro.logo || '',
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'profesional', data, folio: '_global' });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#proSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── PACIENTE handlers ─────────────────────────────── */
    const calcEdad = () => {
      const val = el.querySelector('#fechaNacField')?.value;
      if (!val) { const f = el.querySelector('#edadField'); if (f) f.value = ''; return; }
      const [y, m, d] = val.split('-').map(Number);
      const today = new Date();
      let age = today.getFullYear() - y;
      if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
      const f = el.querySelector('#edadField');
      if (f) f.value = `${age} años`;
    };
    el.querySelector('#fechaNacField')?.addEventListener('change', calcEdad);
    el.querySelector('#fechaNacField')?.addEventListener('input',  calcEdad);

    el.querySelector('#genFolioBtn')?.addEventListener('click', async () => {
      const btn = el.querySelector('#genFolioBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
      const res = await App.get('/expediente', { section: 'folio_next' });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i>';
      if (res?.folio) {
        App.currentFolio = res.folio;
        history.replaceState(null, '', '#expediente/' + res.folio);
        el.querySelector('#folioInput').value = res.folio;
      }
    });

    el.querySelector('#pacForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        nombre_paciente:     fd.get('nombre_paciente'),
        folio:               fd.get('folio'),
        edad:                el.querySelector('#edadField').value,
        fecha_nac:           fd.get('fecha_nac'),
        sexo:                fd.get('sexo'),
        lateralidad:         fd.get('lateralidad'),
        telefono_pac:        fd.get('telefono_pac'),
        ocupacion:           fd.get('ocupacion'),
        fecha_valoracion:    fd.get('fecha_valoracion'),
        responsable:         fd.get('responsable'),
        parentesco:          fd.get('parentesco'),
        tel_responsable:     fd.get('tel_responsable'),
        motivo_consulta:     fd.get('motivo_consulta'),
        diagnostico_referido:fd.get('diagnostico_referido'),
        medico_tratante:     fd.get('medico_tratante'),
        banderas_rojas:      fd.get('banderas_rojas'),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'paciente', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#pacSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── ANAMNESIS handlers ────────────────────────────── */
    el.querySelectorAll('#tab-anam .ant-toggle').forEach(btn =>
      btn.addEventListener('click', () => btn.classList.toggle('active'))
    );

    el.querySelector('#anamForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const antecedentes = [...el.querySelectorAll('#tab-anam .ant-toggle.active')]
        .map(b => b.dataset.key);
      const data = {
        motivo_consulta:       fd.get('motivo_consulta'),
        historia_padecimiento: fd.get('historia_padecimiento'),
        fecha_inicio:          fd.get('fecha_inicio'),
        mecanismo_lesion:      fd.get('mecanismo_lesion'),
        evolucion:             fd.get('evolucion'),
        tiempo_evolucion:      fd.get('tiempo_evolucion'),
        factores_agravan:      fd.get('factores_agravan'),
        factores_alivian:      fd.get('factores_alivian'),
        tratamientos_previos:  fd.get('tratamientos_previos'),
        medicamentos_actuales: fd.get('medicamentos_actuales'),
        cirugias_previas:      fd.get('cirugias_previas'),
        fracturas_previas:     fd.get('fracturas_previas'),
        alergias_info:         fd.get('alergias_info'),
        observaciones_clinicas:fd.get('observaciones_clinicas'),
        antecedentes,
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'anamnesis', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#anamSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── ESTILO handlers ───────────────────────────────── */
    el.querySelector('#estresSlider')?.addEventListener('input', e => {
      el.querySelector('#estresBadge').textContent = e.target.value;
    });

    el.querySelector('#estiloForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        nivel_actividad:   fd.get('nivel_actividad'),
        actividad_laboral: fd.get('actividad_laboral'),
        exigencia_laboral: fd.get('exigencia_laboral'),
        horas_sueno:       fd.get('horas_sueno'),
        tabaquismo:        fd.get('tabaquismo'),
        alcohol:           fd.get('alcohol'),
        deporte:           fd.get('deporte'),
        nivel_estres:      parseInt(fd.get('nivel_estres'), 10),
        limitaciones_avd:  fd.get('limitaciones_avd'),
        objetivo_paciente: fd.get('objetivo_paciente'),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'estilo', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#estiloSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── DOLOR handlers ────────────────────────────────── */
    el.querySelectorAll('#tab-dolor .ant-toggle').forEach(btn =>
      btn.addEventListener('click', () => btn.classList.toggle('active'))
    );

    const updateEva = () => {
      const vals = ['eva_actual','eva_maximo','eva_minimo'].map(k => {
        const v = parseInt(el.querySelector(`#slider_${k}`)?.value || '0', 10);
        el.querySelector(`#badge_${k}`).textContent = v;
        el.querySelector(`#cardval_${k}`).textContent = `${v}/10`;
        const [cls, clr] = evaClassify(v);
        const tag = el.querySelector(`#cardcls_${k}`);
        tag.textContent = cls; tag.style.color = clr;
        return v;
      });
      const prom = Math.round(vals.reduce((a, b) => a + b, 0) / 3);
      el.querySelector('#cardval_promedio').textContent = `${prom}/10`;
      const [pcls, pclr] = evaClassify(prom);
      const pt = el.querySelector('#cardcls_promedio');
      pt.textContent = pcls; pt.style.color = pclr;
    };
    ['eva_actual','eva_maximo','eva_minimo'].forEach(k =>
      el.querySelector(`#slider_${k}`)?.addEventListener('input', updateEva)
    );

    el.querySelector('#dolorForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        localizacion_dolor: fd.get('localizacion_dolor'),
        irradiacion:        fd.get('irradiacion'),
        eva_actual:         parseInt(fd.get('eva_actual'), 10),
        eva_maximo:         parseInt(fd.get('eva_maximo'), 10),
        eva_minimo:         parseInt(fd.get('eva_minimo'), 10),
        tipo_dolor:     [...el.querySelectorAll('#tab-dolor [data-group="tipo"].active')].map(b => b.dataset.key),
        ritmo_dolor:    [...el.querySelectorAll('#tab-dolor [data-group="ritmo"].active')].map(b => b.dataset.key),
        comportamiento: [...el.querySelectorAll('#tab-dolor [data-group="comport"].active')].map(b => b.dataset.key),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'dolor', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#dolorSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── VITALES handlers ──────────────────────────────── */
    const updateIMC = () => {
      const p = el.querySelector('#vitPeso')?.value;
      const t = el.querySelector('#vitTalla')?.value;
      const r = imcCompute(p, t);
      el.querySelector('#imcVal').textContent  = r.val;
      el.querySelector('#imcCls').textContent  = r.cls;
      el.querySelector('#imcCls').style.color  = r.clr;
    };
    el.querySelector('#vitPeso')?.addEventListener('input', updateIMC);
    el.querySelector('#vitTalla')?.addEventListener('input', updateIMC);

    el.querySelector('#vitalesForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd  = new FormData(e.target);
      const imc = imcCompute(fd.get('peso'), fd.get('talla'));
      const data = {
        peso:        fd.get('peso'),
        talla:       fd.get('talla'),
        ta:          fd.get('ta'),
        temperatura: fd.get('temperatura'),
        fc:          fd.get('fc'),
        fr:          fd.get('fr'),
        sato2:       fd.get('sato2'),
        imc_val:     imc.val,
        imc_cls:     imc.cls,
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'vitales', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#vitSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── EXPLORACIÓN handlers ──────────────────────────── */
    el.querySelectorAll('#tab-explo .ant-toggle').forEach(btn =>
      btn.addEventListener('click', () => btn.classList.toggle('active'))
    );
    ['bal_estatico','bal_dinamico'].forEach(k =>
      el.querySelector(`#slider_${k}`)?.addEventListener('input', e =>
        el.querySelector(`#badge_${k}`).textContent = e.target.value
      )
    );

    el.querySelector('#exploForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        postura:           [...el.querySelectorAll('#tab-explo .ant-toggle.active')].map(b => b.dataset.key),
        obs_posturales:    fd.get('obs_posturales'),
        patron_marcha:     fd.get('patron_marcha'),
        ayuda_tecnica:     fd.get('ayuda_tecnica'),
        transferencias:    fd.get('transferencias'),
        tolerancia_marcha: fd.get('tolerancia_marcha'),
        obs_marcha:        fd.get('obs_marcha'),
        balance_estatico:  parseInt(fd.get('bal_estatico'), 10),
        balance_dinamico:  parseInt(fd.get('bal_dinamico'), 10),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'exploracion', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#exploSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── ESCALAS handlers ─────────────────────────────── */
    const escalasClassifiers = { ifg: ifgClassify, indep: indepClassify, tol: tolerClassify, movil: movilClassify };
    const escalasMax = { ifg: 100, indep: 10, tol: 10, movil: 10 };
    Object.keys(escalasClassifiers).forEach(k => {
      el.querySelector(`#slider_${k}`)?.addEventListener('input', e => {
        const v = parseInt(e.target.value, 10);
        el.querySelector(`#scbadge_${k}`).textContent = `${v}/${escalasMax[k]}`;
        const [cls, clr] = escalasClassifiers[k](v);
        const tag = el.querySelector(`#sccls_${k}`);
        tag.textContent = cls; tag.style.color = clr;
      });
    });

    el.querySelector('#escalasForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        ifg:                  parseInt(fd.get('ifg'),   10),
        indep:                parseInt(fd.get('indep'), 10),
        tol:                  parseInt(fd.get('tol'),   10),
        movil:                parseInt(fd.get('movil'), 10),
        severidad_limitacion: fd.get('severidad_limitacion'),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'escalas', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#escalasSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── DIAGNÓSTICO handlers ─────────────────────────── */
    el.querySelector('#diagForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        diagnostico_fisio:    fd.get('diagnostico_fisio'),
        estructuras:          fd.get('estructuras'),
        deficiencias:         fd.get('deficiencias'),
        limitaciones_func:    fd.get('limitaciones_func'),
        restricciones_part:   fd.get('restricciones_part'),
        hipotesis_clinica:    fd.get('hipotesis_clinica'),
        pronostico_funcional: fd.get('pronostico_funcional'),
        objetivo_general:     fd.get('objetivo_general'),
        objetivos_especificos:fd.get('objetivos_especificos'),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'diagnostico', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#diagSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── PLAN handlers ─────────────────────────────── */
    el.querySelectorAll('#tab-plan .ant-toggle').forEach(btn =>
      btn.addEventListener('click', () => btn.classList.toggle('active'))
    );

    el.querySelector('#planForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd   = new FormData(e.target);
      const data = {
        modalidades:              [...el.querySelectorAll('#tab-plan .ant-toggle.active')].map(b => b.dataset.key),
        frecuencia:               fd.get('frecuencia'),
        duracion_plan:            fd.get('duracion_plan'),
        num_sesiones:             fd.get('num_sesiones'),
        indicaciones_domiciliarias: fd.get('indicaciones_domiciliarias'),
        precauciones:             fd.get('precauciones'),
        criterios_alta:           fd.get('criterios_alta'),
        recomendaciones_finales:  fd.get('recomendaciones_finales'),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'plan', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#planSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── FOTOS handlers ─────────────────────────────── */
    const resizeToDataUrl = (file, maxPx, quality) => new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const ratio  = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = url;
    });

    const refreshFotoSlot = (k, imgSrc) => {
      const lbl  = fotoSlotsConfig.find(([key]) => key === k)?.[1] || k;
      const slot = el.querySelector(`#slot_${k}`);
      if (!slot) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = mkFotoSlot(k, lbl, imgSrc);
      const newSlot = tmp.querySelector('.foto-slot');
      if (newSlot) { slot.className = newSlot.className; slot.innerHTML = newSlot.innerHTML; }
    };

    el.querySelector('#tab-fotos')?.addEventListener('click', e => {
      const removeBtn = e.target.closest('.foto-remove');
      if (removeBtn) { refreshFotoSlot(removeBtn.dataset.key, ''); return; }
      const slot = e.target.closest('.foto-slot');
      if (slot) slot.querySelector('.foto-input')?.click();
    });

    el.querySelector('#tab-fotos')?.addEventListener('change', async e => {
      const input = e.target.closest('.foto-input');
      if (!input || !input.files[0]) return;
      const imgSrc = await resizeToDataUrl(input.files[0], 1200, 0.85);
      refreshFotoSlot(input.dataset.key, imgSrc);
    });

    el.querySelector('#fotosForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {};
      fotoSlotsConfig.forEach(([k]) => {
        const imgEl = el.querySelector(`#slot_${k} img`);
        data[k] = imgEl?.src?.startsWith('data:') ? imgEl.src : '';
      });
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'fotos', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar fotos';
      if (res?.success) {
        const ok = el.querySelector('#fotosSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── CONSENTIMIENTO handlers ──────────────────────── */
    const initPad = id => {
      const canvas = el.querySelector('#' + id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1E2D3D'; ctx.lineWidth = 2.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      let drawing = false;
      const pos = e => {
        const r = canvas.getBoundingClientRect();
        const t = e.touches?.[0] || e;
        return [(t.clientX - r.left) * (canvas.width  / r.width),
                (t.clientY - r.top)  * (canvas.height / r.height)];
      };
      canvas.addEventListener('mousedown',  e => { drawing = true;  const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); });
      canvas.addEventListener('mousemove',  e => { if (!drawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); });
      canvas.addEventListener('mouseup',    () => drawing = false);
      canvas.addEventListener('mouseleave', () => drawing = false);
      canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true;  const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y); }, {passive:false});
      canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!drawing) return; const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }, {passive:false});
      canvas.addEventListener('touchend',   () => drawing = false);
    };

    const loadSig = (id, dataUrl) => {
      if (!dataUrl) return;
      const canvas = el.querySelector('#' + id);
      if (!canvas) return;
      const img = new Image();
      img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = dataUrl;
    };

    const isCanvasEmpty = canvas => {
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return !d.some(v => v !== 0);
    };

    initPad('canvasPaciente');
    initPad('canvasFisio');
    loadSig('canvasPaciente', consent.firma_paciente || '');
    loadSig('canvasFisio',    consent.firma_fisio    || '');

    el.querySelector('#borrarFirmaPaciente')?.addEventListener('click', e => {
      e.preventDefault();
      const c = el.querySelector('#canvasPaciente');
      c?.getContext('2d').clearRect(0, 0, c.width, c.height);
    });
    el.querySelector('#borrarFirmaFisio')?.addEventListener('click', e => {
      e.preventDefault();
      const c = el.querySelector('#canvasFisio');
      c?.getContext('2d').clearRect(0, 0, c.width, c.height);
    });

    el.querySelector('#consentForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd     = new FormData(e.target);
      const cPac   = el.querySelector('#canvasPaciente');
      const cFisio = el.querySelector('#canvasFisio');
      const data   = {
        acepta:              !!fd.get('acepta'),
        nombre_responsable:  fd.get('nombre_responsable'),
        fecha_firma:         fd.get('fecha_firma'),
        firma_paciente:      cPac  && !isCanvasEmpty(cPac)   ? cPac.toDataURL('image/png')   : (consent.firma_paciente || ''),
        firma_fisio:         cFisio && !isCanvasEmpty(cFisio) ? cFisio.toDataURL('image/png') : (consent.firma_fisio    || ''),
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Guardando…';
      const res = await App.put('/expediente', { section: 'consentimiento', data, folio: App.currentFolio });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar consentimiento';
      if (res?.success) {
        const ok = el.querySelector('#consentSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── Acciones globales ─────────────────────────── */
    const showToast = (msg, type = 'info') => {
      const t = document.createElement('div');
      t.className = `alert alert-${type} position-fixed shadow`;
      t.style.cssText = 'bottom:24px;right:24px;z-index:9999;min-width:280px;font-size:13px;font-weight:600';
      t.innerHTML = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    };

    const pdfStyles = `
      *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#222;margin:0;padding:20px 24px}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1E2D3D;padding-bottom:12px;margin-bottom:14px}
      .doc-title{font-size:18px;font-weight:800;color:#1E2D3D}.doc-sub{font-size:11px;color:#666;margin-top:2px}
      .folio-tag{background:#1E2D3D;color:#fff;padding:3px 12px;border-radius:5px;font-size:11px;font-weight:700}
      h3{font-size:11px;font-weight:700;background:#1E2D3D;color:#fff;padding:5px 10px;margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px}
      .g2{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 12px}
      .fld{margin-bottom:3px}.fld b{font-size:9.5px;text-transform:uppercase;color:#666;display:block;margin-bottom:1px}
      .fld span{display:block;font-size:11.5px}textarea-val{white-space:pre-wrap}
      .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
      .tag{background:#e8f5f5;color:#00796b;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:600}
      .sig-block{display:flex;gap:40px;margin-top:20px;padding-top:14px;border-top:1px solid #ddd}
      .sig-line{flex:1;text-align:center}.sig-line hr{border:none;border-bottom:1.5px solid #333;margin:40px 0 4px}
      .sig-line small{font-size:9px;color:#666}
      .print-btn{display:block;margin:18px auto 0;background:#1E2D3D;color:#fff;border:none;padding:9px 28px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600}
      @media print{.print-btn{display:none}body{padding:10px 14px}}`;

    const pdfField = (label, val) =>
      `<div class="fld"><b>${label}</b><span>${val || '<span style="color:#bbb">—</span>'}</span></div>`;

    const pdfTags = arr =>
      arr && arr.length
        ? `<div class="tags">${arr.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
        : '<span style="color:#bbb">—</span>';

    el.querySelector('#btnPdfReporte')?.addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=920,height=750,scrollbars=yes');
      w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Reporte Clínico — ${esc(App.currentFolio)}</title>
        <style>${pdfStyles}</style></head><body>
        <div class="doc-header">
          <div>
            <div class="doc-title"><i>⚕</i> ${esc(pro.clinica||'Kinerva Fisioterapia')}</div>
            <div class="doc-sub">${esc(pro.nombre||'')}${pro.especialidad?' — '+esc(pro.especialidad):''}</div>
            <div class="doc-sub">${[pro.cedula&&'Céd. '+pro.cedula, pro.telefono, pro.email].filter(Boolean).join(' | ')}</div>
          </div>
          <div style="text-align:right">
            <div class="folio-tag">${esc(App.currentFolio)}</div>
            <div style="font-size:9px;color:#999;margin-top:4px">Impreso: ${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
        </div>

        <h3>Datos del Paciente</h3>
        <div class="g2">
          ${pdfField('Nombre completo', esc(pac.nombre_paciente))}
          ${pdfField('Folio', esc(pac.folio||App.currentFolio))}
          ${pdfField('Fecha de nacimiento', pac.fecha_nac?fmtDate(pac.fecha_nac):'')}
          ${pdfField('Edad', esc(pac.edad))}
          ${pdfField('Sexo', esc(pac.sexo))}
          ${pdfField('Lateralidad', esc(pac.lateralidad))}
          ${pdfField('Teléfono', esc(pac.telefono_pac))}
          ${pdfField('Ocupación', esc(pac.ocupacion))}
          ${pdfField('Fecha de valoración', pac.fecha_valoracion?fmtDate(pac.fecha_valoracion):'')}
          ${pdfField('Médico tratante', esc(pac.medico_tratante))}
          ${pdfField('Motivo de consulta', esc(pac.motivo_consulta))}
          ${pdfField('Diagnóstico referido', esc(pac.diagnostico_referido))}
        </div>

        <h3>Anamnesis</h3>
        <div class="g2">
          ${pdfField('Historia del padecimiento', esc(anam.historia_padecimiento))}
          ${pdfField('Mecanismo de lesión', esc(anam.mecanismo_lesion))}
          ${pdfField('Fecha de inicio', anam.fecha_inicio?fmtDate(anam.fecha_inicio):'')}
          ${pdfField('Tiempo de evolución', esc(anam.tiempo_evolucion))}
          ${pdfField('Factores que agravan', esc(anam.factores_agravan))}
          ${pdfField('Factores que alivian', esc(anam.factores_alivian))}
          ${pdfField('Tratamientos previos', esc(anam.tratamientos_previos))}
          ${pdfField('Medicamentos actuales', esc(anam.medicamentos_actuales))}
        </div>
        <div class="fld" style="margin-top:6px"><b>Antecedentes</b>${pdfTags(anam.antecedentes)}</div>

        <h3>Dolor</h3>
        <div class="g3">
          ${pdfField('Localización', esc(dolor.localizacion_dolor))}
          ${pdfField('EVA actual / máx / mín', [dolor.eva_actual,dolor.eva_maximo,dolor.eva_minimo].join(' / '))}
          ${pdfField('Irradiación', esc(dolor.irradiacion))}
        </div>
        <div class="g2" style="margin-top:4px">
          <div class="fld"><b>Tipo de dolor</b>${pdfTags(dolor.tipo_dolor)}</div>
          <div class="fld"><b>Comportamiento</b>${pdfTags(dolor.comportamiento)}</div>
        </div>

        <h3>Signos Vitales</h3>
        <div class="g3">
          ${pdfField('Peso', vitales.peso?vitales.peso+' kg':'')}
          ${pdfField('Talla', vitales.talla?vitales.talla+' cm':'')}
          ${pdfField('IMC', vitales.imc_val?(vitales.imc_val+' — '+vitales.imc_cls):'')}
          ${pdfField('T.A.', esc(vitales.ta))}
          ${pdfField('Temperatura', vitales.temperatura?vitales.temperatura+' °C':'')}
          ${pdfField('Frec. Cardíaca', vitales.fc?vitales.fc+' lpm':'')}
        </div>

        <h3>Escalas Funcionales</h3>
        <div class="g2">
          ${pdfField('IFG (0-100)', escalas.ifg!=null?String(escalas.ifg):'')}
          ${pdfField('Independencia (0-10)', escalas.indep!=null?String(escalas.indep):'')}
          ${pdfField('Tolerancia (0-10)', escalas.tol!=null?String(escalas.tol):'')}
          ${pdfField('Movilidad (0-10)', escalas.movil!=null?String(escalas.movil):'')}
          ${pdfField('Severidad de la limitación', esc(escalas.severidad_limitacion))}
        </div>

        <h3>Diagnóstico Fisioterapéutico</h3>
        <div class="g2">
          ${pdfField('Diagnóstico fisioterapéutico', esc(diag.diagnostico_fisio))}
          ${pdfField('Estructuras involucradas', esc(diag.estructuras))}
          ${pdfField('Deficiencias', esc(diag.deficiencias))}
          ${pdfField('Limitaciones funcionales', esc(diag.limitaciones_func))}
          ${pdfField('Pronóstico funcional', esc(diag.pronostico_funcional))}
          ${pdfField('Objetivo general', esc(diag.objetivo_general))}
        </div>
        ${diag.objetivos_especificos?`<div class="fld"><b>Objetivos específicos</b><span>${esc(diag.objetivos_especificos)}</span></div>`:''}

        <div class="sig-block">
          <div class="sig-line"><hr><small>Firma del fisioterapeuta — ${esc(pro.nombre||'')}</small></div>
          <div class="sig-line"><hr><small>Firma del paciente — ${esc(pac.nombre_paciente||'')}</small></div>
        </div>

        <button class="print-btn" onclick="window.print()">🖨&nbsp; Imprimir / Guardar PDF</button>
      </body></html>`);
      w.document.close(); w.focus();
    });

    el.querySelector('#btnPdfPlan')?.addEventListener('click', () => {
      const w = window.open('', '_blank', 'width=800,height=650,scrollbars=yes');
      const modalidadesLabels = {
        termoterapia:'Termoterapia', crioterapia:'Crioterapia', tens:'TENS / Electroterapia',
        ultrasonido:'Ultrasonido', laser:'Láser', magnetoterapia:'Magnetoterapia',
        terapia_manual:'Terapia manual', movilizacion:'Movilización articular',
        estiramientos:'Estiramientos', fortalecimiento:'Fortalecimiento muscular',
        propiocepcion:'Propiocepción', reeducacion:'Reeducación postural',
        hidroterapia:'Hidroterapia', vendaje:'Vendaje neuromuscular',
        acupuntura:'Acupuntura / Punción seca', ejercicio:'Ejercicio terapéutico',
        educacion:'Educación al paciente',
      };
      const modNombres = (plan.modalidades||[]).map(k => modalidadesLabels[k]||k);
      w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Plan Terapéutico — ${esc(App.currentFolio)}</title>
        <style>${pdfStyles}</style></head><body>
        <div class="doc-header">
          <div>
            <div class="doc-title">Plan Terapéutico</div>
            <div class="doc-sub">${esc(pro.clinica||'Kinerva Fisioterapia')} — ${esc(pro.nombre||'')}</div>
          </div>
          <div style="text-align:right">
            <div class="folio-tag">${esc(App.currentFolio)}</div>
            <div style="font-size:9px;color:#999;margin-top:4px">${new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
        </div>

        <h3>Datos del Paciente</h3>
        <div class="g2">
          ${pdfField('Nombre', esc(pac.nombre_paciente))}
          ${pdfField('Fecha de valoración', pac.fecha_valoracion?fmtDate(pac.fecha_valoracion):'')}
          ${pdfField('Diagnóstico', esc(diag.diagnostico_fisio||pac.diagnostico_referido))}
          ${pdfField('Objetivo general', esc(diag.objetivo_general))}
        </div>

        <h3>Plan de Tratamiento</h3>
        <div class="g3">
          ${pdfField('Frecuencia', esc(plan.frecuencia))}
          ${pdfField('Duración del plan', esc(plan.duracion_plan))}
          ${pdfField('Número de sesiones', esc(plan.num_sesiones))}
        </div>
        <div class="fld" style="margin-top:8px"><b>Modalidades terapéuticas</b>${pdfTags(modNombres)}</div>

        ${plan.indicaciones_domiciliarias?`
        <h3>Indicaciones Domiciliarias</h3>
        <div style="white-space:pre-wrap;line-height:1.6;padding:6px 10px;background:#f8f9fa;border-radius:5px">${esc(plan.indicaciones_domiciliarias)}</div>`:''}

        ${plan.precauciones?`
        <h3>Precauciones</h3>
        <div style="white-space:pre-wrap;line-height:1.6;padding:6px 10px;background:#fff8e1;border-radius:5px">${esc(plan.precauciones)}</div>`:''}

        ${plan.criterios_alta?`<div class="fld" style="margin-top:8px"><b>Criterios de alta</b><span>${esc(plan.criterios_alta)}</span></div>`:''}
        ${plan.recomendaciones_finales?`<div class="fld"><b>Recomendaciones finales</b><span>${esc(plan.recomendaciones_finales)}</span></div>`:''}

        <div class="sig-block">
          <div class="sig-line"><hr><small>Firma del fisioterapeuta — ${esc(pro.nombre||'')}</small></div>
          <div class="sig-line"><hr><small>Firma del paciente — ${esc(pac.nombre_paciente||'')}</small></div>
        </div>
        <button class="print-btn" onclick="window.print()">🖨&nbsp; Imprimir / Guardar PDF</button>
      </body></html>`);
      w.document.close(); w.focus();
    });

    el.querySelector('#btnLimpiarPro')?.addEventListener('click', async () => {
      if (!confirm('¿Limpiar los datos del profesional? Esta acción no se puede deshacer.')) return;
      const btn = el.querySelector('#btnLimpiarPro');
      btn.disabled = true;
      await App.put('/expediente', { section: 'profesional', data: {}, folio: '_global' });
      btn.disabled = false;
      showToast('<i class="fas fa-check-circle me-2"></i>Datos del profesional eliminados.', 'success');
      Views.expediente(el, App.currentFolio);
    });

    el.querySelector('#btnNuevoRegistro')?.addEventListener('click', async () => {
      if (!confirm('¿Iniciar un nuevo expediente? Se generará un nuevo folio. El expediente actual permanecerá guardado.')) return;
      const btn = el.querySelector('#btnNuevoRegistro');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-2"></i>Generando…';
      const r = await App.get('/expediente', { section: 'folio_next' });
      btn.disabled = false;
      if (r?.folio) App.go('expediente/' + r.folio);
      else btn.innerHTML = '<i class="fas fa-user-plus me-2"></i>Nuevo registro';
    });
  },

  /* ══ Portal Pacientes ══════════════════════════════════════════ */
  async portalPacientes(content) {
    content.innerHTML = spin();
    const data = await App.get('/patient-users');
    if (!data?.success) { content.innerHTML = '<div class="alert alert-danger">Error al cargar pacientes del portal.</div>'; return; }
    const users = data.users || [];

    content.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted">${users.length} paciente${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''} en el portal</span>
        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#createPatientModal">
            <i class="fas fa-user-plus me-1"></i>Crear Paciente
          </button>
          <a href="/portal" target="_blank" class="btn btn-sm btn-outline-secondary">
            <i class="fas fa-external-link-alt me-1"></i>Ver portal
          </a>
        </div>
      </div>

      ${users.length === 0 ? `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-user-shield fa-3x mb-3 d-block" style="color:#dee2e6"></i>
          <h5>Sin pacientes registrados</h5>
          <p class="small">Usa el botón "Crear Paciente" para dar de alta al primer paciente del portal.</p>
        </div>` : `
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Paciente</th>
                <th>Usuario</th>
                <th>Teléfono</th>
                <th>Rutinas</th>
                <th>Último acceso</th>
                <th>Alta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div style="width:36px;height:36px;border-radius:50%;background:#00BDB4;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;flex-shrink:0">
                        ${(u.name||'?').split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')}
                      </div>
                      <div class="fw-semibold">${esc(u.name || '—')}</div>
                    </div>
                  </td>
                  <td><span class="text-muted small">@${esc(u.username)}</span></td>
                  <td>${u.phone ? `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : '<span class="text-muted">—</span>'}</td>
                  <td><span class="badge bg-primary rounded-pill">${u.routine_count}</span></td>
                  <td class="small text-muted">${u.last_login ? fmtDate(u.last_login) : 'Nunca'}</td>
                  <td class="small text-muted">${fmtDate(u.created_at)}</td>
                  <td>
                    <div class="d-flex gap-1">
                      <button class="btn btn-sm btn-outline-primary" onclick="Views.openRoutineManager(${u.id}, '${esc(u.name)}')">
                        <i class="fas fa-dumbbell"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-danger" onclick="Views.deletePatient(${u.id}, '${esc(u.name)}')">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}

      <!-- Create Patient Modal -->
      <div class="modal fade" id="createPatientModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="fas fa-user-plus me-2 text-primary"></i>Nuevo Paciente del Portal</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small mb-3">Crea las credenciales de acceso que le darás al paciente para que ingrese al portal.</p>
              <div id="createPatientError" class="alert alert-danger d-none"></div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Nombre completo <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="cpName" placeholder="Ej. María González López">
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Usuario <span class="text-danger">*</span></label>
                <div class="input-group">
                  <span class="input-group-text">@</span>
                  <input type="text" class="form-control" id="cpUsername" placeholder="maria.gonzalez" autocomplete="off">
                </div>
                <div class="form-text">Solo letras, números y puntos. Se convierte a minúsculas.</div>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Contraseña <span class="text-danger">*</span></label>
                <input type="password" class="form-control" id="cpPassword" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Confirmar contraseña <span class="text-danger">*</span></label>
                <input type="password" class="form-control" id="cpPassword2" placeholder="Repite la contraseña">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="cpSaveBtn" onclick="Views.createPatient()">
                <i class="fas fa-save me-1"></i>Crear paciente
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Routine Manager Modal -->
      <div class="modal fade" id="routineModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="routineModalTitle">Rutinas</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="routineModalBody">
              <div class="text-center py-4"><i class="fas fa-circle-notch fa-spin fa-2x text-muted"></i></div>
            </div>
          </div>
        </div>
      </div>`;
  },

  async createPatient() {
    const name  = document.getElementById('cpName').value.trim();
    const uname = document.getElementById('cpUsername').value.trim().toLowerCase();
    const pass  = document.getElementById('cpPassword').value;
    const pass2 = document.getElementById('cpPassword2').value;
    const errEl = document.getElementById('createPatientError');
    errEl.classList.add('d-none');

    if (!name || !uname || !pass) { errEl.textContent = 'Completa todos los campos.'; errEl.classList.remove('d-none'); return; }
    if (pass.length < 6)          { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; errEl.classList.remove('d-none'); return; }
    if (pass !== pass2)           { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.classList.remove('d-none'); return; }

    const btn = document.getElementById('cpSaveBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin me-1"></i>Creando…';

    const r = await App.api('POST', '/patient-users', { name, username: uname, password: pass });
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-1"></i>Crear paciente';

    if (r?.success) {
      bootstrap.Modal.getInstance(document.getElementById('createPatientModal'))?.hide();
      showToastGlobal(`Paciente "${name}" creado correctamente`, 'success');
      ['cpName','cpUsername','cpPassword','cpPassword2'].forEach(id => document.getElementById(id).value = '');
      Views.portalPacientes(document.getElementById('pageContent'));
    } else {
      errEl.textContent = r?.message || 'Error al crear el paciente.';
      errEl.classList.remove('d-none');
    }
  },

  async deletePatient(id, name) {
    if (!confirm(`¿Eliminar al paciente "${name}" y todas sus rutinas?`)) return;
    const r = await App.api('DELETE', '/patient-users', null, { id });
    if (r?.success) {
      showToastGlobal('Paciente eliminado', 'success');
      Views.portalPacientes(document.getElementById('pageContent'));
    } else {
      showToastGlobal('Error al eliminar', 'danger');
    }
  },

  async openRoutineManager(patientId, patientName) {
    document.getElementById('routineModalTitle').textContent = `Rutinas de ${patientName}`;
    const modal = new bootstrap.Modal(document.getElementById('routineModal'));
    modal.show();
    await Views.loadRoutineManager(patientId);
  },

  async loadRoutineManager(patientId) {
    const body = document.getElementById('routineModalBody');
    body.innerHTML = '<div class="text-center py-4"><i class="fas fa-circle-notch fa-spin fa-2x text-muted"></i></div>';

    const data = await App.api('GET', '/patient-routines', null, { patient_id: patientId });
    const routines = data?.routines || [];

    const statusOpts = ['activa','pausada','completada'].map(s =>
      `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
    ).join('');

    body.innerHTML = `
      <!-- Create routine form -->
      <div class="card mb-4 border-primary border-opacity-25">
        <div class="card-body">
          <h6 class="fw-bold mb-3"><i class="fas fa-plus-circle text-primary me-2"></i>Nueva Rutina</h6>
          <div class="row g-2">
            <div class="col-md-5">
              <input class="form-control form-control-sm" id="newRoutineTitle" placeholder="Título de la rutina *">
            </div>
            <div class="col-md-5">
              <input class="form-control form-control-sm" id="newRoutineDesc" placeholder="Descripción (opcional)">
            </div>
            <div class="col-md-2">
              <button class="btn btn-primary btn-sm w-100" onclick="Views.createRoutine(${patientId})">
                <i class="fas fa-save me-1"></i>Crear
              </button>
            </div>
          </div>
        </div>
      </div>

      ${routines.length === 0 ? `
        <div class="text-center py-4 text-muted">
          <i class="fas fa-clipboard-list fa-2x mb-2 d-block"></i>
          Sin rutinas asignadas todavía.
        </div>` :
        routines.map(r => `
          <div class="card mb-3" id="routine-${r.id}">
            <div class="card-header d-flex align-items-center justify-content-between gap-2 py-2">
              <div class="d-flex align-items-center gap-2 flex-grow-1">
                <i class="fas fa-clipboard-list text-primary"></i>
                <strong>${esc(r.title)}</strong>
                ${r.description ? `<small class="text-muted">— ${esc(r.description)}</small>` : ''}
              </div>
              <div class="d-flex align-items-center gap-2">
                <select class="form-select form-select-sm" style="width:130px"
                  onchange="Views.updateRoutineStatus(${r.id}, this.value, ${patientId})">
                  ${['activa','pausada','completada'].map(s =>
                    `<option value="${s}" ${r.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
                  ).join('')}
                </select>
                <button class="btn btn-sm btn-outline-danger" onclick="Views.deleteRoutine(${r.id}, ${patientId})">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="card-body p-3">
              <!-- Exercises list -->
              <div id="exList-${r.id}">
                ${(r.exercises || []).length === 0
                  ? '<p class="text-muted small mb-2">Sin ejercicios aún.</p>'
                  : r.exercises.map(ex => Views.renderExerciseRow(ex, r.id, patientId)).join('')}
              </div>

              <!-- Add exercise form -->
              <div class="border-top pt-3 mt-2">
                <p class="small fw-semibold text-muted mb-2"><i class="fas fa-plus me-1"></i>Agregar ejercicio</p>
                <div class="row g-2 align-items-end" id="exForm-${r.id}">
                  <div class="col-md-3">
                    <input class="form-control form-control-sm" placeholder="Nombre *" id="exName-${r.id}">
                  </div>
                  <div class="col-md-4">
                    <input class="form-control form-control-sm" placeholder="Descripción" id="exDesc-${r.id}">
                  </div>
                  <div class="col-md-1">
                    <input type="number" class="form-control form-control-sm" placeholder="Series" id="exSets-${r.id}" min="1">
                  </div>
                  <div class="col-md-1">
                    <input type="number" class="form-control form-control-sm" placeholder="Reps" id="exReps-${r.id}" min="1">
                  </div>
                  <div class="col-md-1">
                    <input type="number" class="form-control form-control-sm" placeholder="Seg" id="exDur-${r.id}" min="1">
                  </div>
                  <div class="col-md-2">
                    <input class="form-control form-control-sm" placeholder="URL Video" id="exVid-${r.id}">
                  </div>
                  <div class="col-md-12 mt-1">
                    <button class="btn btn-success btn-sm" onclick="Views.addExercise(${r.id}, ${patientId})">
                      <i class="fas fa-plus me-1"></i>Agregar ejercicio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>`).join('')}`;
  },

  renderExerciseRow(ex, routineId, patientId) {
    const meta = [];
    if (ex.sets && ex.reps) meta.push(`${ex.sets}×${ex.reps}`);
    else if (ex.sets) meta.push(`${ex.sets} series`);
    if (ex.duration_seconds) meta.push(`${ex.duration_seconds}s`);

    return `
      <div class="d-flex align-items-start gap-2 mb-2 p-2 bg-light rounded" id="ex-${ex.id}">
        <i class="fas fa-dumbbell text-primary mt-1"></i>
        <div class="flex-grow-1">
          <span class="fw-semibold small">${esc(ex.name)}</span>
          ${meta.length ? `<span class="badge bg-primary bg-opacity-10 text-primary ms-2 small">${meta.join(' · ')}</span>` : ''}
          ${ex.description ? `<div class="text-muted" style="font-size:12px">${esc(ex.description)}</div>` : ''}
          ${ex.video_url ? `<a href="${esc(ex.video_url)}" target="_blank" class="small text-primary"><i class="fas fa-play-circle me-1"></i>Ver video</a>` : ''}
        </div>
        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="Views.deleteExercise(${ex.id}, ${routineId}, ${patientId})">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  },

  async createRoutine(patientId) {
    const title = document.getElementById('newRoutineTitle').value.trim();
    const desc  = document.getElementById('newRoutineDesc').value.trim();
    if (!title) { showToastGlobal('El título es obligatorio', 'warning'); return; }
    const r = await App.api('POST', '/patient-routines', { title, description: desc || null }, { patient_id: patientId });
    if (r?.success) {
      showToastGlobal('Rutina creada', 'success');
      await Views.loadRoutineManager(patientId);
    } else {
      showToastGlobal('Error al crear rutina', 'danger');
    }
  },

  async updateRoutineStatus(routineId, status, patientId) {
    await App.api('PATCH', '/patient-routines', { status }, { routine_id: routineId });
    showToastGlobal('Estado actualizado', 'success');
  },

  async deleteRoutine(routineId, patientId) {
    if (!confirm('¿Eliminar esta rutina y todos sus ejercicios?')) return;
    await App.api('DELETE', '/patient-routines', null, { routine_id: routineId });
    await Views.loadRoutineManager(patientId);
    showToastGlobal('Rutina eliminada', 'success');
  },

  async addExercise(routineId, patientId) {
    const name = document.getElementById(`exName-${routineId}`).value.trim();
    if (!name) { showToastGlobal('El nombre del ejercicio es obligatorio', 'warning'); return; }

    const body = {
      name,
      description:      document.getElementById(`exDesc-${routineId}`).value.trim() || null,
      sets:             parseInt(document.getElementById(`exSets-${routineId}`).value) || null,
      reps:             parseInt(document.getElementById(`exReps-${routineId}`).value) || null,
      duration_seconds: parseInt(document.getElementById(`exDur-${routineId}`).value)  || null,
      video_url:        document.getElementById(`exVid-${routineId}`).value.trim()    || null,
    };

    const r = await App.api('POST', '/patient-routines', body, { action: 'add-exercise', routine_id: routineId });
    if (r?.success) {
      showToastGlobal('Ejercicio agregado', 'success');
      await Views.loadRoutineManager(patientId);
    } else {
      showToastGlobal('Error al agregar ejercicio', 'danger');
    }
  },

  async deleteExercise(exerciseId, routineId, patientId) {
    await App.api('DELETE', '/patient-routines', null, { action: 'exercise', exercise_id: exerciseId });
    await Views.loadRoutineManager(patientId);
    showToastGlobal('Ejercicio eliminado', 'success');
  },

};

/* ══════════════════════════════════════════════════════════ Boot */
document.addEventListener('DOMContentLoaded', () => {
  // "toSetup" link in login (may not exist yet, bind via delegation)
  document.addEventListener('click', e => {
    if (e.target.id === 'toSetup') { e.preventDefault(); App.showAuth('setup'); }
  });
  App.init();
});
