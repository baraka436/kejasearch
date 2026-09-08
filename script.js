(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE = 'nyumba360-data';
  const SESSION = 'nyumba360-session';
  const ADMIN = { username: 'admin', password: 'adminnyumba360@dashboard' };
  const ADMIN_EMAIL = 'barakakelly0209@gmail.com';
  const seed = {
    users: [
      { id: 'landlord-james', username: 'james', name: 'James Mwangi', email: 'james@example.com', phone: '+254 700 000 000', password: 'password123', role: 'landlord', verified: true },
      { id: 'tenant-faith', username: 'faith', name: 'Faith W.', email: 'faith@example.com', password: 'password123', role: 'tenant', verified: false }
    ],
    properties: [
      { id: 'property-kilimani', ownerId: 'landlord-james', title: '2-bed apartment, Kilimani', type: 'House', price: 65000, status: 'Verified', enquiries: 7 },
      { id: 'property-kasarani', ownerId: 'landlord-james', title: '1-bed flat, Kasarani', type: 'House', price: 28000, status: 'Verified', enquiries: 4 },
      { id: 'property-ruaka', ownerId: 'landlord-james', title: 'Bedsitter, Ruaka', type: 'House', price: 18000, status: 'Pending verification', enquiries: 1 }
    ]
  };

  function readData() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE));
      if (stored && Array.isArray(stored.users) && Array.isArray(stored.properties)) {
        stored.deletionRequests = Array.isArray(stored.deletionRequests) ? stored.deletionRequests : [];
        return stored;
      }
    } catch (error) { /* Use seed data if storage is unavailable or corrupt. */ }
    const data = JSON.parse(JSON.stringify(seed));
    data.deletionRequests = [];
    return data;
  }

  function writeData(data) { localStorage.setItem(STORAGE, JSON.stringify(data)); }
  function getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch (error) { return null; } }
  function setSession(session) { sessionStorage.setItem(SESSION, JSON.stringify(session)); }

  function showToast(message) {
    let toast = $('.site-toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'site-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); document.body.append(toast); }
    toast.textContent = message; toast.classList.add('is-visible');
    window.clearTimeout(toast.dismissTimer); toast.dismissTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4500);
  }

  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

  function setupCookies() {
    const banner = $('#cookie-banner');
    if (!banner) return;
    if (!localStorage.getItem('nyumba-cookie-consent')) banner.classList.add('show');
    ['cookie-accept', 'cookie-reject'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => {
      localStorage.setItem('nyumba-cookie-consent', id === 'cookie-accept' ? 'all' : 'essential'); banner.classList.remove('show');
    }));
  }

  function setupLogin() {
    const loginForm = $('#login-form');
    const signupForm = $('#signup-form');
    loginForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(loginForm));
      const identity = values.identity.trim().toLowerCase();
      if (identity === ADMIN.username && values.password === ADMIN.password) { setSession({ role: 'admin', username: ADMIN.username }); window.location.href = 'admin.html'; return; }
      const account = readData().users.find((user) => (user.username.toLowerCase() === identity || user.email.toLowerCase() === identity) && user.password === values.password);
      if (!account) { $('.form-status', loginForm).textContent = 'Invalid username/email or password.'; return; }
      setSession({ role: account.role, userId: account.id, username: account.username }); window.location.href = account.role === 'landlord' ? 'dashboard.html' : 'index.html';
    });
    signupForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!signupForm.checkValidity()) { signupForm.reportValidity(); return; }
      const values = Object.fromEntries(new FormData(signupForm));
      const data = readData(); const username = values.username.trim().toLowerCase();
      if (data.users.some((user) => user.username.toLowerCase() === username || user.email.toLowerCase() === values.email.toLowerCase())) { $('.form-status', signupForm).textContent = 'That username or email is already registered.'; return; }
      const account = { id: `landlord-${Date.now()}`, username, name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), password: values.password, role: values.role, verified: false };
      data.users.push(account); writeData(data); setSession({ role: account.role, userId: account.id, username: account.username }); window.location.href = account.role === 'landlord' ? 'dashboard.html' : 'index.html';
    });
  }

  function requireRole(role) {
    const session = getSession();
    if (!session || session.role !== role) { window.location.href = 'login.html'; return null; }
    return session;
  }

  function setupDashboard() {
    if (!$('[data-landlord-dashboard]')) return;
    const session = requireRole('landlord'); if (!session) return;
    const data = readData(); const landlord = data.users.find((user) => user.id === session.userId);
    if (!landlord) { sessionStorage.removeItem(SESSION); window.location.href = 'login.html'; return; }
    const tableBody = $('#landlord-properties'); const form = $('#property-form');
    $('#landlord-name').textContent = landlord.name; $('#verification-status').textContent = landlord.verified ? 'Verified landlord' : 'Pending verification';
    const existingDeletionRequest = data.deletionRequests.find((request) => request.userId === landlord.id && request.status === 'Pending');
    if (existingDeletionRequest && $('#deletion-request-status')) $('#deletion-request-status').textContent = `Account will be deleted in the next 24 hours. Request sent to ${ADMIN_EMAIL} for admin approval.`;
    function render() {
      const owned = data.properties.filter((property) => property.ownerId === landlord.id); $('#listing-count').textContent = owned.length;
      tableBody.innerHTML = owned.length ? owned.map((property) => `<tr><td>${escapeHtml(property.title)}</td><td><span class="badge${property.status === 'Verified' ? '' : ' badge-outline'}">${escapeHtml(property.status)}</span></td><td>KES ${property.price.toLocaleString()}</td><td>${property.enquiries}</td><td><button class="btn btn-danger-outline js-remove-property" type="button" data-id="${property.id}">Remove</button></td></tr>`).join('') : '<tr><td colspan="5">No properties yet. Add your first listing above.</td></tr>';
      $$('.js-remove-property', tableBody).forEach((button) => button.addEventListener('click', () => { data.properties = data.properties.filter((property) => property.id !== button.dataset.id); writeData(data); render(); }));
    }
    form?.addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); data.properties.push({ id: `property-${Date.now()}`, ownerId: landlord.id, title: values.title.trim(), type: values.type, price: Number(values.price), status: 'Pending verification', enquiries: 0 }); writeData(data); form.reset(); render(); showToast('Property added and queued for verification.'); });
    $('#delete-account-button')?.addEventListener('click', () => {
      const existing = data.deletionRequests.find((request) => request.userId === landlord.id && request.status === 'Pending');
      if (!existing) {
        data.deletionRequests.push({ id: `deletion-${Date.now()}`, userId: landlord.id, landlordName: landlord.name, landlordEmail: landlord.email, adminEmail: ADMIN_EMAIL, status: 'Pending', requestedAt: new Date().toISOString() });
        writeData(data);
      }
      const message = 'Account will be deleted in the next 24 hours';
      $('#deletion-request-status').textContent = `${message}. Request sent to ${ADMIN_EMAIL} for admin approval.`;
      showToast(message);
    });
    $('#logout-button')?.addEventListener('click', () => { sessionStorage.removeItem(SESSION); window.location.href = 'index.html'; }); render();
  }

  function setupAdmin() {
    if (!$('[data-admin-dashboard]')) return;
    if (!requireRole('admin')) return;
    const data = readData(); const usersBody = $('#admin-users'); const propertiesBody = $('#admin-properties'); const requestsBody = $('#admin-deletion-requests');
    function render() {
      const landlords = data.users.filter((user) => user.role === 'landlord'); $('#admin-user-count').textContent = data.users.length; $('#admin-landlord-count').textContent = landlords.length; $('#admin-property-count').textContent = data.properties.length;
      usersBody.innerHTML = data.users.map((user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.role)}</td><td>${user.role === 'landlord' ? `<button class="btn btn-ghost js-verify" type="button" data-id="${user.id}">${user.verified ? 'Verified' : 'Verify landlord'}</button>` : '—'}</td></tr>`).join('');
      propertiesBody.innerHTML = data.properties.map((property) => { const owner = data.users.find((user) => user.id === property.ownerId); const action = property.status === 'Verified' ? 'Approved' : `<button class="btn btn-ghost js-approve-property" type="button" data-id="${property.id}">Approve listing</button>`; return `<tr><td>${escapeHtml(property.title)}</td><td>${escapeHtml(owner?.name || 'Unknown')}</td><td>${escapeHtml(property.status)}</td><td>KES ${Math.max(500, property.enquiries * 100).toLocaleString()}</td><td>${action}</td></tr>`; }).join('');
      if (requestsBody) requestsBody.innerHTML = data.deletionRequests.length ? data.deletionRequests.map((request) => `<tr><td>${escapeHtml(request.landlordName)}</td><td>${escapeHtml(request.landlordEmail)}</td><td>${escapeHtml(request.adminEmail)}</td><td>${escapeHtml(new Date(request.requestedAt).toLocaleString())}</td><td>${request.status === 'Pending' ? `<button class="btn btn-danger-outline js-approve-deletion" type="button" data-id="${request.id}">Approve deletion</button>` : escapeHtml(request.status)}</td></tr>`).join('') : '<tr><td colspan="5">No account deletion requests.</td></tr>';
      $$('.js-verify', usersBody).forEach((button) => button.addEventListener('click', () => { const user = data.users.find((item) => item.id === button.dataset.id); user.verified = true; data.properties.filter((property) => property.ownerId === user.id).forEach((property) => { if (property.status === 'Pending verification') property.status = 'Verified'; }); writeData(data); render(); }));
      $$('.js-approve-property', propertiesBody).forEach((button) => button.addEventListener('click', () => { const property = data.properties.find((item) => item.id === button.dataset.id); property.status = 'Verified'; writeData(data); render(); }));
      $$('.js-approve-deletion', requestsBody || document).forEach((button) => button.addEventListener('click', () => { const request = data.deletionRequests.find((item) => item.id === button.dataset.id); if (!request) return; data.users = data.users.filter((user) => user.id !== request.userId); data.properties = data.properties.filter((property) => property.ownerId !== request.userId); request.status = 'Approved'; writeData(data); render(); }));
    }
    $('#logout-button')?.addEventListener('click', () => { sessionStorage.removeItem(SESSION); window.location.href = 'index.html'; }); render();
  }

  function setupPublicListings() {
    const grids = $$('[data-public-listings]');
    if (!grids.length) return;
    const data = readData();
    const approved = data.properties.filter((property) => property.status === 'Verified');
    const normalizeTitle = (title) => title.toLowerCase().replace(/bedroom/g, 'bed').replace(/[^a-z0-9]/g, '');
    grids.forEach((grid) => {
      const existingTitles = new Set($$('h3', grid).map((heading) => normalizeTitle(heading.textContent.trim())));
      $$('[data-listing]', grid).forEach((card) => {
        const title = $('h3', card)?.textContent.trim();
        const stored = approved.find((property) => property.title === title) || data.properties.find((property) => property.title === title);
        if (stored) {
          card.dataset.approved = String(stored.status === 'Verified');
          card.hidden = stored.status !== 'Verified';
          const badge = $('.badge', card);
          if (stored.status === 'Verified' && badge) { badge.textContent = '✓ Verified landlord'; badge.classList.remove('badge-outline'); }
        }
      });
      approved.filter((property) => !existingTitles.has(normalizeTitle(property.title))).forEach((property) => {
        const area = property.title.includes(',') ? property.title.split(',').pop().trim() : 'Nairobi';
        const card = document.createElement('article');
        card.className = 'card'; card.dataset.listing = ''; card.dataset.approved = 'true'; card.dataset.area = area; card.dataset.type = property.type.toLowerCase(); card.dataset.price = property.price; card.dataset.beds = '0';
        card.innerHTML = `<span class="card-tab">For rent · ${escapeHtml(property.type)}</span><div class="card-media" aria-hidden="true"></div><div class="card-body"><span class="badge" style="width:fit-content;">✓ Verified landlord</span><h3>${escapeHtml(property.title)}</h3><p class="card-meta">Verified listing · Direct landlord contact</p><p class="card-price">KES ${property.price.toLocaleString()} <span style="font-size:.7em; color:#544d3f;">/month</span></p><div class="card-actions"><a class="btn btn-primary" href="property.html">View in 360°</a></div></div>`;
        grid.append(card);
      });
    });
  }

  function setupListingFilters() {
    const form = $('#filter-form'); const cards = $$('[data-listing]'); const resultCount = $('#result-count'); if (!form || !cards.length) return;
    const area = $('#f-area'); const type = $('#f-type'); const beds = $('#f-beds'); const price = $('#f-price'); const params = new URLSearchParams(window.location.search);
    if (params.has('area')) area.value = params.get('area'); if (params.has('type')) type.value = params.get('type'); if (params.has('maxPrice')) price.value = params.get('maxPrice');
    function update() { const areaValue = area.value.trim().toLowerCase(); const maxPrice = Number(price.value); let visible = 0; cards.forEach((card) => { const matches = card.dataset.approved !== 'false' && (!areaValue || card.dataset.area.toLowerCase().includes(areaValue)) && (type.value === 'any' || card.dataset.type === type.value) && (beds.value === 'any' || (beds.value === '3' ? Number(card.dataset.beds) >= 3 : Number(card.dataset.beds) === Number(beds.value))) && (!price.value || Number(card.dataset.price) <= maxPrice); card.hidden = !matches; if (matches) visible += 1; }); if (resultCount) resultCount.textContent = `${visible} ${visible === 1 ? 'listing' : 'listings'} found`; }
    form.addEventListener('input', update); form.addEventListener('change', update); update();
  }

  function setupLoginTabs() { const tabs = $$('[role="tab"]'); tabs.forEach((tab) => tab.addEventListener('click', () => tabs.forEach((item) => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); document.getElementById(item.getAttribute('aria-controls')).hidden = !selected; }))); }

  function setupNavigation() {
    const session = getSession();
    $$('a[href="dashboard.html"]').forEach((link) => { link.closest('li')?.toggleAttribute('hidden', session?.role !== 'landlord'); });
    if (session?.role === 'admin' && !document.querySelector('a[href="admin.html"]')) {
      const nav = $('.nav-links');
      if (nav) nav.insertAdjacentHTML('beforeend', '<li><a href="admin.html">Admin dashboard</a></li>');
    }
  }

  setupCookies(); setupLogin(); setupDashboard(); setupAdmin(); setupPublicListings(); setupListingFilters(); setupLoginTabs(); setupNavigation();
})();
