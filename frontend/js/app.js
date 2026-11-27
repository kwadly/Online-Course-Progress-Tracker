const API = window.API_URL;
const $ = (id) => document.getElementById(id);
const content = $('app');
const msg = $('msg');
const menu = $('menu');
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let trail = [];      // pages we can go back to
let current = null;  // the page being shown

// ---------- helpers ----------
function show(text, bad) { msg.textContent = text; msg.className = bad ? 'bad' : 'good'; }
function fail(e) { show(e.message, true); }
function setTitle(t) { $('title').textContent = t; }
function isRole(r) { return user && user.role === r; }

function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  kids.flat().forEach((k) => e.append(k));
  return e;
}

async function api(method, path, body) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  if (res.status !== 204) { try { data = await res.json(); } catch (e) { /* no body */ } }
  if (res.status === 401 && token) { logout(); throw new Error('Session expired, please log in again'); }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ')');
  return data;
}

// ---------- page navigation (back arrow) ----------
function run(fn) {
  current = fn;
  msg.textContent = '';
  content.replaceChildren();
  $('backBtn').disabled = trail.length === 0;
  fn();
}
function go(fn, ...a) { if (current) trail.push(current); run(() => fn(...a)); }   // open a page, back arrow returns here
function replace(fn, ...a) { run(() => fn(...a)); }                                 // redraw the same page
function root(fn) { trail = []; run(fn); }                                          // sidebar click
function back() { if (trail.length) run(trail.pop()); }
function refresh() { run(current); }
$('backBtn').onclick = back;
$('logoutBtn').onclick = () => logout();

// ---------- sidebar ----------
function setActive(key) {
  menu.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.id === 'nav-' + key));
}
function buildMenu() {
  menu.replaceChildren();
  const items = [['courses', 'Courses', coursesView]];
  if (isRole('student')) items.push(['learning', 'My learning', myLearningView]);
  if (isRole('student')) items.push(['upcoming', 'Upcoming', upcomingView]);
  if (isRole('instructor')) items.push(['mine', 'My courses', instructorView]);
  items.forEach(([key, label, fn]) => menu.append(el('button', {
    id: 'nav-' + key, className: 'nav-item', textContent: label,
    onclick: () => { setActive(key); root(fn); }
  })));
}

function enterApp() {
  $('auth').classList.add('hidden');
  $('shell').classList.remove('hidden');
  $('who').textContent = user.name + ' (' + user.role + ')';
  buildMenu();
  setActive('courses');
  root(coursesView);
}

function logout() {
  token = null; user = null; trail = []; current = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  $('shell').classList.add('hidden');
  $('auth').classList.remove('hidden');
  authView();
}

// ---------- login / register (first screen) ----------
function authView() {
  const box = $('auth');
  box.replaceChildren();
  let mode = 'login';
  let role = 'student';

  const out = el('p', { id: 'authMsg' });
  const name = el('input', { placeholder: 'Full name' });
  const email = el('input', { placeholder: 'Email', type: 'email' });
  const pass = el('input', { placeholder: 'Password', type: 'password' });
  const submit = el('button', { className: 'wide' });

  const tabLogin = el('button', { textContent: 'Log in' });
  const tabReg = el('button', { textContent: 'Register' });
  const roleStudent = el('button', { textContent: 'Student' });
  const roleInstructor = el('button', { textContent: 'Instructor' });

  function paint() {
    tabLogin.className = mode === 'login' ? 'active' : '';
    tabReg.className = mode === 'register' ? 'active' : '';
    roleStudent.className = role === 'student' ? 'active' : '';
    roleInstructor.className = role === 'instructor' ? 'active' : '';
    name.classList.toggle('hidden', mode === 'login');
    pass.placeholder = mode === 'login' ? 'Password' : 'Password (8+ characters)';
    submit.textContent = mode === 'login' ? 'Log in' : 'Create account';
    out.textContent = '';
  }
  tabLogin.onclick = () => { mode = 'login'; paint(); };
  tabReg.onclick = () => { mode = 'register'; paint(); };
  roleStudent.onclick = () => { role = 'student'; paint(); };
  roleInstructor.onclick = () => { role = 'instructor'; paint(); };

  submit.onclick = async () => {
    out.style.color = '#f87171';
    try {
      if (mode === 'login') {
        const d = await api('POST', '/api/auth/login', { email: email.value, password: pass.value });
        if (d.user.role !== role) {
          throw new Error('This is ' + (d.user.role === 'student' ? 'a student' : 'an instructor') + ' account. Switch the toggle above.');
        }
        token = d.token; user = d.user;
        localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
        enterApp();
      } else {
        await api('POST', '/api/auth/register', { name: name.value, email: email.value, password: pass.value, role });
        mode = 'login'; paint();
        out.style.color = '#34d399';
        out.textContent = 'Account created. Please log in.';
      }
    } catch (e) { out.textContent = e.message; }
  };

  box.append(el('div', { className: 'auth-card' },
    el('h1', { textContent: 'Course Progress Tracker' }),
    el('div', { className: 'seg' }, tabLogin, tabReg),
    el('div', { className: 'seg' }, roleStudent, roleInstructor),
    name, email, pass, submit, out));
  paint();
}

// ---------- courses (everyone) ----------
async function coursesView(search = '', page = 1) {
  setTitle('Courses');
  const box = el('input', { placeholder: 'Search by title', value: search });
  app_append(el('div', { className: 'row' },
    el('div', {}, box, ' ', el('button', { textContent: 'Search', onclick: () => replace(coursesView, box.value, 1) }))));
  try {
    const d = await api('GET', '/api/courses?search=' + encodeURIComponent(search) + '&page=' + page + '&limit=5');
    if (d.courses.length === 0) app_append(el('p', { className: 'muted', textContent: 'No courses found.' }));
    d.courses.forEach((c) => app_append(el('div', { className: 'card row' },
      el('div', {}, el('b', { textContent: c.title }), el('br'), el('small', { textContent: c.description || '' })),
      el('button', { textContent: 'View', onclick: () => go(courseView, c.id) }))));
    const pages = Math.max(1, Math.ceil(d.total / d.limit));
    app_append(el('div', { className: 'row' },
      el('button', { className: 'ghost', textContent: 'Previous', disabled: page <= 1, onclick: () => replace(coursesView, search, page - 1) }),
      el('span', { className: 'muted', textContent: 'Page ' + page + ' of ' + pages + ' (' + d.total + ' courses)' }),
      el('button', { className: 'ghost', textContent: 'Next', disabled: page >= pages, onclick: () => replace(coursesView, search, page + 1) })));
  } catch (e) { fail(e); }
}
function app_append(...nodes) { content.append(...nodes); }

// ---------- one course ----------
async function courseView(id) {
  setTitle('Course');
  try {
    const c = await api('GET', '/api/courses/' + id);
    setTitle(c.title);
    const card = el('div', { className: 'card' },
      el('p', { textContent: c.description || '' }), el('h3', { textContent: 'Modules' }));
    (c.modules || []).forEach((m) => card.append(el('div', { textContent: m.position + '. ' + m.title + (m.due_date ? '  (due ' + m.due_date + ')' : '') })));
    if (isRole('student')) {
      card.append(el('br'), el('button', {
        textContent: 'Enroll',
        onclick: async () => { try { await api('POST', '/api/courses/' + id + '/enroll'); show('Enrolled! Open My learning to start.'); } catch (e) { fail(e); } }
      }));
    }
    app_append(card);
  } catch (e) { fail(e); }
}

// ---------- student: my learning ----------
// Accepts either field name, so the page works whatever the API calls the id.
const enrollmentId = (e) => e.enrollment_id !== undefined ? e.enrollment_id : e.id;
const moduleId = (m) => m.module_id !== undefined ? m.module_id : m.id;

async function myLearningView() {
  setTitle('My learning');
  try {
    const list = await api('GET', '/api/enrollments/me');
    if (list.length === 0) app_append(el('p', { className: 'muted', textContent: 'You are not enrolled in any course yet.' }));
    list.forEach((e) => {
      const eid = enrollmentId(e);
      app_append(el('div', { className: 'card' },
        el('div', { className: 'row' },
          el('b', { textContent: e.title || e.course_title || ('Course ' + e.course_id) }),
          el('span', { className: 'tag', textContent: e.status })),
        el('div', { className: 'bar' }, el('div', { style: 'width:' + e.percent + '%' })),
        el('small', { textContent: e.completed_modules + ' of ' + e.total_modules + ' modules (' + e.percent + '%)' }),
        el('div', { className: 'row' }, el('span'),
          el('div', {},
            el('button', { textContent: 'Open modules', onclick: () => go(progressView, eid, e.course_id) }), ' ',
            el('button', { className: 'red', textContent: 'Drop', onclick: async () => {
              try { await api('PATCH', '/api/enrollments/' + eid + '/drop'); refresh(); } catch (er) { fail(er); }
            } })))));
    });
  } catch (e) { fail(e); }
}

async function progressView(eid, courseId) {
  setTitle('Modules');
  try {
    const c = await api('GET', '/api/courses/' + courseId);
    setTitle(c.title);
    const d = await api('GET', '/api/enrollments/' + eid + '/completed');
    const done = new Set(d.module_ids);
    const out = el('p', { style: 'font-weight:bold' });
    (c.modules || []).forEach((m) => {
      const card = el('div', { className: 'card row' + (done.has(moduleId(m)) ? ' done' : '') });
      const act = async (method) => {
        try {
          const p = await api(method, '/api/enrollments/' + eid + '/modules/' + moduleId(m) + '/complete');
          card.classList.toggle('done', method === 'POST');
          out.textContent = 'Progress: ' + p.completed_modules + ' of ' + p.total_modules + ' (' + p.percent + '%)';
          show('');
        } catch (er) {
          if (er.message.includes('already marked')) card.classList.add('done');
          if (er.message.includes('not marked')) card.classList.remove('done');
          fail(er);
        }
      };
      card.append(
        el('span', { textContent: m.position + '. ' + m.title + (m.due_date ? '  (due ' + m.due_date + ')' : '') }),
        el('div', {},
          el('button', { textContent: 'Done', onclick: () => act('POST') }), ' ',
          el('button', { className: 'ghost', textContent: 'Undo', onclick: () => act('DELETE') })));
      app_append(card);
    });
    app_append(out);
  } catch (er) { fail(er); }
}

async function upcomingView(days = 14) {
  setTitle('Upcoming deadlines');
  const sel = el('select', {}, ...[7, 14, 30, 90].map((n) =>
    el('option', { value: n, textContent: 'Next ' + n + ' days', selected: n === days })));
  sel.onchange = () => replace(upcomingView, Number(sel.value));
  app_append(sel);
  try {
    const d = await api('GET', '/api/modules/upcoming?days=' + days);
    const list = Array.isArray(d) ? d : (d.modules || []);
    if (list.length === 0) app_append(el('p', { className: 'muted', textContent: 'Nothing due in the next ' + days + ' days.' }));
    list.forEach((m) => app_append(el('div', { className: 'card row' },
      el('div', {}, el('b', { textContent: m.title }), el('br'),
        el('small', { textContent: m.course_title || m.course || ('Course ' + m.course_id) })),
      el('span', { className: 'tag', textContent: 'due ' + m.due_date }))));
  } catch (e) { fail(e); }
}

// ---------- instructor ----------
async function instructorView() {
  setTitle('My courses');
  const title = el('input', { placeholder: 'Course title' });
  const desc = el('input', { placeholder: 'Description' });
  app_append(el('div', { className: 'card' }, el('h3', { textContent: 'New course' }), title, ' ', desc, ' ',
    el('button', { textContent: 'Create', onclick: async () => {
      try { await api('POST', '/api/courses', { title: title.value, description: desc.value }); refresh(); } catch (e) { fail(e); }
    } })));
  try {
    const list = await api('GET', '/api/courses/mine');
    list.forEach((c) => app_append(el('div', { className: 'card row' },
      el('span', {}, el('b', { textContent: c.title }), '  ', el('span', { className: 'tag', textContent: c.status })),
      el('button', { textContent: 'Manage', onclick: () => go(manageView, c.id) }))));
  } catch (e) { fail(e); }
}

const EVENT_TEXT = {
  student_enrolled: 'enrolled',
  student_dropped: 'dropped the course',
  module_completed: 'completed a module',
  course_completed: 'finished the course'
};

async function manageView(id) {
  setTitle('Manage course');
  try {
    const c = await api('GET', '/api/courses/' + id);
    setTitle(c.title);
    const modules = c.modules || [];

    const title = el('input', { value: c.title });
    const desc = el('input', { value: c.description || '' });
    const setStatus = (s) => async () => {
      try { await api('PATCH', '/api/courses/' + id + '/status', { status: s }); refresh(); } catch (e) { fail(e); }
    };
    app_append(el('div', { className: 'card' },
      el('h3', {}, 'Course ', el('span', { className: 'tag', textContent: c.status })), title, ' ', desc,
      el('div', { style: 'margin-top:8px' },
        el('button', { textContent: 'Save', onclick: async () => {
          try { await api('PUT', '/api/courses/' + id, { title: title.value, description: desc.value }); show('Saved'); } catch (e) { fail(e); }
        } }), ' ',
        el('button', { textContent: 'Publish', onclick: setStatus('published') }), ' ',
        el('button', { className: 'ghost', textContent: 'Archive', onclick: setStatus('archived') }))));

    const modCard = el('div', { className: 'card' }, el('h3', { textContent: 'Modules' }));
    modules.forEach((m) => {
      const t = el('input', { value: m.title });
      const p = el('input', { type: 'number', min: 1, value: m.position, style: 'width:70px' });
      const dd = el('input', { type: 'date', value: m.due_date || '' });
      modCard.append(el('div', { className: 'row', style: 'margin:8px 0' },
        el('div', {}, t, ' ', p, ' ', dd),
        el('div', {},
          el('button', { textContent: 'Save', onclick: async () => {
            try {
              await api('PUT', '/api/modules/' + moduleId(m), { title: t.value, position: Number(p.value), due_date: dd.value || undefined });
              refresh(); show('Module saved');
            } catch (e) { fail(e); }
          } }), ' ',
          el('button', { className: 'red', textContent: 'Delete', onclick: async () => {
            if (!confirm('Delete this module?')) return;
            try { await api('DELETE', '/api/modules/' + moduleId(m)); refresh(); } catch (e) { fail(e); }
          } }))));
    });

    const mTitle = el('input', { placeholder: 'Module title' });
    const mPos = el('input', { type: 'number', min: 1, value: modules.length + 1, style: 'width:80px' });
    const mDue = el('input', { type: 'date' });
    modCard.append(el('br'), el('b', { textContent: 'Add a module' }), el('br'), mTitle, ' ', mPos, ' ', mDue, ' ',
      el('button', { textContent: 'Add module', onclick: async () => {
        try {
          await api('POST', '/api/courses/' + id + '/modules', { title: mTitle.value, position: Number(mPos.value), due_date: mDue.value || undefined });
          refresh();
        } catch (e) { fail(e); }
      } }));
    app_append(modCard);

    const s = await api('GET', '/api/courses/' + id + '/stats');
    app_append(el('div', { className: 'card' }, el('h3', { textContent: 'Stats' }),
      el('div', { textContent: 'Enrolled: ' + s.enrolled + ', completed: ' + s.completed + ', dropped: ' + s.dropped }),
      el('div', { textContent: 'Average progress: ' + s.average_progress_percent + '%' })));

    const a = await api('GET', '/api/courses/' + id + '/activity');
    const feed = el('div', { className: 'card' }, el('h3', { textContent: 'Activity' }));
    if (a.events.length === 0) feed.append(el('small', { textContent: 'No activity yet.' }));
    a.events.forEach((ev) => feed.append(el('div', { textContent: ev.student_name + ' ' + (EVENT_TEXT[ev.event_type] || ev.event_type) + (ev.percent != null ? ' (' + ev.percent + '%)' : '') + ' - ' + new Date(ev.occurred_at).toLocaleString() })));
    app_append(feed);
  } catch (e) { fail(e); }
}

// ---------- start ----------
if (token && user) enterApp(); else authView();