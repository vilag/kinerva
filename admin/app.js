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

/* ══════════════════════════════════════════════════════════ App */

const App = {
  token: localStorage.getItem('kinerva_token'),
  user:  localStorage.getItem('kinerva_user'),
  // per-view filter state
  apptFilters:   {},
  patientSearch: '',

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
      const res = await fetch(url, opts);
      if (res.status === 401) { App.logout(); return null; }
      return res.json();
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
        h === page || (page === 'patient' && h === 'patients'));
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
      case 'expediente':
        title.textContent = 'Expediente Clínico';
        Views.expediente(content);
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
            <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tel.</th><th>Servicio</th><th>Dur.</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>${appointments.map(a=>`
              <tr data-id="${a.id}">
                <td>${fmtDate(a.date)}</td>
                <td><strong>${fmtHour(a.hour)}</strong></td>
                <td><a href="#" class="fw-semibold text-decoration-none pt-link" data-phone="${esc(a.phone)}">${esc(a.name)}</a></td>
                <td>${esc(a.phone)}</td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.service||'')}">${esc(a.service||'Evaluación')}</td>
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
  /* ── Expediente Clínico ────────────────────────────── */
  async expediente(el) {
    const [resPro, resPac] = await Promise.all([
      App.get('/expediente', { section: 'profesional' }),
      App.get('/expediente', { section: 'paciente' }),
    ]);
    if (!resPro) { el.innerHTML = '<div class="alert alert-danger m-3">Error cargando datos</div>'; return; }
    const pro = resPro.data || {};
    const pac = resPac?.data || {};

    el.innerHTML = `
    <div class="ak-card">
      <div class="ak-card-head">
        <h6><i class="fas fa-file-medical-alt me-2" style="color:var(--ak-teal)"></i>Expediente Clínico</h6>
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
                         value="${esc(pac.folio||'')}" placeholder="FISIO-0001">
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
      const res = await App.put('/expediente', { section: 'profesional', data });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#proSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });

    /* ── PACIENTE handlers ─────────────────────────────── */
    el.querySelector('#fechaNacField')?.addEventListener('change', e => {
      const val = e.target.value;
      if (!val) { el.querySelector('#edadField').value = ''; return; }
      const birth = new Date(val);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      el.querySelector('#edadField').value = `${age} años`;
    });

    el.querySelector('#genFolioBtn')?.addEventListener('click', async () => {
      const btn = el.querySelector('#genFolioBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
      const res = await App.get('/expediente', { section: 'folio_next' });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-plus"></i>';
      if (res?.folio) el.querySelector('#folioInput').value = res.folio;
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
      const res = await App.put('/expediente', { section: 'paciente', data });
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar sección';
      if (res?.success) {
        const ok = el.querySelector('#pacSaveOk');
        ok.style.display = '';
        setTimeout(() => ok.style.display = 'none', 3000);
      }
    });
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
