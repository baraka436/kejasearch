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
  function readFile(file, label) { return new Promise((resolve, reject) => { if (!file) { reject(new Error(`Please choose a ${label}.`)); return; } const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`The ${label} could not be read.`)); reader.readAsDataURL(file); }); }

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
      const account = { id: `landlord-${Date.now()}`, username, name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), password: values.password, role: values.role, verified: false, reviews: 0, enquiries: 0, rating: 0 };
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
    if (existingDeletionRequest && $('#deletion-request-status')) $('#deletion-request-status').textContent = 'Your account will be deleted in 24hrs ,ensure you have removed all properties listed';
    function render() {
      const owned = data.properties.filter((property) => property.ownerId === landlord.id); const activeListings = owned.filter((property) => property.status === 'Verified').length; const enquiries = owned.reduce((total, property) => total + Number(property.enquiries || 0), 0); const ratings = owned.flatMap((property) => Array.isArray(property.reviews) ? property.reviews : []); const rating = ratings.length ? (ratings.reduce((total, review) => total + Number(review.rating || 0), 0) / ratings.length).toFixed(1) : '0'; $('#listing-count').textContent = activeListings; $('#enquiries-count').textContent = enquiries; $('#rating-count').textContent = rating;
      $('#landlord-reviews').innerHTML = ratings.length ? ratings.map((review) => `<div class="review"><p class="stars" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p><p style="margin:.3em 0;"><strong>${escapeHtml(review.reviewerName || 'Tenant')}</strong></p><p>${escapeHtml(review.reviewText)}</p></div>`).join('') : '<p class="hint">No reviews yet.</p>';
      tableBody.innerHTML = owned.length ? owned.map((property) => `<tr><td>${escapeHtml(property.title)}</td><td><span class="badge${property.status === 'Verified' ? '' : ' badge-outline'}">${escapeHtml(property.status)}</span></td><td>KES ${property.price.toLocaleString()}</td><td>${property.enquiries}</td><td><button class="btn btn-danger-outline js-remove-property" type="button" data-id="${property.id}">Remove</button></td></tr>`).join('') : '<tr><td colspan="5">No properties yet. Add your first listing above.</td></tr>';
      $$('.js-remove-property', tableBody).forEach((button) => button.addEventListener('click', () => { data.properties = data.properties.filter((property) => property.id !== button.dataset.id); writeData(data); render(); }));
    }
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const values = Object.fromEntries(new FormData(form));
      try {
        const image = await readFile($('#property-image').files[0], 'property picture');
        const video = await readFile($('#property-video').files[0], 'whole-house video');
        data.properties.push({ id: `property-${Date.now()}`, ownerId: landlord.id, title: values.title.trim(), type: values.type, price: Number(values.price), rooms: Number(values.rooms), bathrooms: Number(values.bathrooms), phone: values.phone.trim(), kitchen: values.kitchen.trim(), power: values.power.trim(), water: values.water.trim(), parking: values.parking.trim(), description: values.description.trim(), image, video, status: 'Pending verification', enquiries: 0, reviews: [] });
        writeData(data); form.reset(); render(); showToast('Property added and queued for admin approval.');
      } catch (error) { showToast(error.message); }
    });
    $('#download-data-button')?.addEventListener('click', () => {
      const owned = data.properties.filter((property) => property.ownerId === landlord.id);
      const rows = owned.length ? owned.map((property) => `<tr><td>${escapeHtml(property.title)}</td><td>${escapeHtml(property.type)}</td><td>KES ${property.price.toLocaleString()}</td><td>${escapeHtml(property.status)}</td><td>${property.enquiries}</td></tr>`).join('') : '<tr><td colspan="5">No properties listed.</td></tr>';
      const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>KejaSearch landlord data - ${escapeHtml(landlord.name)}</title><style>body{font-family:Arial,sans-serif;color:#23201b;margin:40px}h1,h2{color:#1f3b2c}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#e5d9bf}@media print{button{display:none}}</style></head><body><h1>KejaSearch landlord dashboard</h1><p><strong>Landlord:</strong> ${escapeHtml(landlord.name)}</p><p><strong>Email:</strong> ${escapeHtml(landlord.email)}</p><p><strong>Username:</strong> ${escapeHtml(landlord.username)}</p><h2>Dashboard summary</h2><p><strong>Listings:</strong> ${owned.length}</p><h2>My properties</h2><table><thead><tr><th>Property</th><th>Type</th><th>Monthly price</th><th>Status</th><th>Enquiries</th></tr></thead><tbody>${rows}</tbody></table><p>Generated ${escapeHtml(new Date().toLocaleString())}</p><button type="button" onclick="window.print()">Print this dashboard</button></body></html>`;
      const blob = new Blob([documentHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `nyumba360-landlord-dashboard-${landlord.username}.doc`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      showToast('Your dashboard data has been downloaded as a Word document.');
    });
    $('#delete-account-button')?.addEventListener('click', () => {
      const existing = data.deletionRequests.find((request) => request.userId === landlord.id && request.status === 'Pending');
      if (!existing) {
        data.deletionRequests.push({ id: `deletion-${Date.now()}`, userId: landlord.id, landlordName: landlord.name, landlordEmail: landlord.email, adminEmail: ADMIN_EMAIL, status: 'Pending', requestedAt: new Date().toISOString() });
        writeData(data);
      }
      const message = 'Your account will be deleted in 24hrs ,ensure you have removed all properties listed';
      $('#deletion-request-status').textContent = message;
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
      usersBody.innerHTML = data.users.map((user) => { const verification = user.role === 'landlord' ? `<button class="btn btn-ghost js-verify" type="button" data-id="${user.id}">${user.verified ? 'Verified' : 'Verify landlord'}</button>` : '—'; const suspension = user.role === 'landlord' ? `<button class="btn btn-ghost js-suspend" type="button" data-id="${user.id}">${user.suspended ? 'Reinstate landlord' : 'Suspend landlord'}</button>` : ''; return `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.role)}</td><td>${verification}</td><td>${suspension}<button class="btn btn-danger-outline js-remove-user" type="button" data-id="${user.id}">Remove user</button></td></tr>`; }).join('');
      propertiesBody.innerHTML = data.properties.map((property) => { const owner = data.users.find((user) => user.id === property.ownerId); const approval = property.status === 'Verified' ? 'Approved' : `<button class="btn btn-ghost js-approve-property" type="button" data-id="${property.id}">Approve listing</button>`; return `<tr><td>${escapeHtml(property.title)}</td><td>${escapeHtml(owner?.name || 'Unknown')}</td><td>${escapeHtml(property.status)}</td><td>KES ${Math.max(500, property.enquiries * 100).toLocaleString()}</td><td>${approval}<button class="btn btn-danger-outline js-remove-property" type="button" data-id="${property.id}">Remove listing</button></td></tr>`; }).join('');
      if (requestsBody) requestsBody.innerHTML = data.deletionRequests.length ? data.deletionRequests.map((request) => `<tr><td>${escapeHtml(request.landlordName)}</td><td>${escapeHtml(request.landlordEmail)}</td><td>${escapeHtml(request.adminEmail)}</td><td>${escapeHtml(new Date(request.requestedAt).toLocaleString())}</td><td>${request.status === 'Pending' ? `<button class="btn btn-danger-outline js-approve-deletion" type="button" data-id="${request.id}">Approve deletion</button>` : escapeHtml(request.status)}</td></tr>`).join('') : '<tr><td colspan="5">No account deletion requests.</td></tr>';
      $$('.js-verify', usersBody).forEach((button) => button.addEventListener('click', () => { const user = data.users.find((item) => item.id === button.dataset.id); user.verified = true; data.properties.filter((property) => property.ownerId === user.id).forEach((property) => { if (property.status === 'Pending verification') property.status = 'Verified'; }); writeData(data); render(); }));
      $$('.js-suspend', usersBody).forEach((button) => button.addEventListener('click', () => { const user = data.users.find((item) => item.id === button.dataset.id); if (!user) return; user.suspended = !user.suspended; writeData(data); render(); }));
      $$('.js-remove-user', usersBody).forEach((button) => button.addEventListener('click', () => { const userId = button.dataset.id; data.users = data.users.filter((user) => user.id !== userId); data.properties = data.properties.filter((property) => property.ownerId !== userId); writeData(data); render(); }));
      $$('.js-approve-property', propertiesBody).forEach((button) => button.addEventListener('click', () => { const property = data.properties.find((item) => item.id === button.dataset.id); property.status = 'Verified'; writeData(data); render(); }));
      $$('.js-remove-property', propertiesBody).forEach((button) => button.addEventListener('click', () => { data.properties = data.properties.filter((property) => property.id !== button.dataset.id); writeData(data); render(); }));
      $$('.js-approve-deletion', requestsBody || document).forEach((button) => button.addEventListener('click', () => { const request = data.deletionRequests.find((item) => item.id === button.dataset.id); if (!request) return; data.users = data.users.filter((user) => user.id !== request.userId); data.properties = data.properties.filter((property) => property.ownerId !== request.userId); request.status = 'Approved'; writeData(data); render(); }));
    }
    $('#logout-button')?.addEventListener('click', () => { sessionStorage.removeItem(SESSION); window.location.href = 'index.html'; }); render();
  }

  function setupPublicListings() {
    const grids = $$('[data-public-listings]');
    if (!grids.length) return;
    const data = readData();
    const publicProperties = data.properties.filter((property) => property.status === 'Verified' && !data.users.find((user) => user.id === property.ownerId)?.suspended);
    const normalizeTitle = (title) => title.toLowerCase().replace(/bedroom/g, 'bed').replace(/[^a-z0-9]/g, '');
    grids.forEach((grid) => {
      const existingTitles = new Set($$('h3', grid).map((heading) => normalizeTitle(heading.textContent.trim())));
      $$('[data-listing]', grid).forEach((card) => {
        const title = $('h3', card)?.textContent.trim();
        const stored = data.properties.find((property) => normalizeTitle(property.title) === normalizeTitle(title));
        if (stored) {
          const owner = data.users.find((user) => user.id === stored.ownerId); const visible = stored.status === 'Verified' && !owner?.suspended;
          card.dataset.approved = String(visible);
          card.dataset.propertyId = stored.id;
          card.hidden = !visible;
          const badge = $('.badge', card);
          if (badge) { badge.textContent = visible ? '✓ Verified landlord' : 'Pending verification'; badge.classList.toggle('badge-outline', !visible); }
          const link = $('.card-actions a', card); if (link && visible) link.href = `property.html?id=${encodeURIComponent(stored.id)}`;
          const media = $('.card-media', card); if (media && stored.image) { media.style.backgroundImage = `url("${stored.image}")`; media.style.backgroundSize = 'cover'; media.style.backgroundPosition = 'center'; }
        }
      });
      publicProperties.filter((property) => !existingTitles.has(normalizeTitle(property.title))).forEach((property) => {
        const area = property.title.includes(',') ? property.title.split(',').pop().trim() : 'Nairobi';
        const card = document.createElement('article');
        card.className = 'card'; card.dataset.listing = ''; card.dataset.approved = 'true'; card.dataset.propertyId = property.id; card.dataset.area = area; card.dataset.type = property.type.toLowerCase(); card.dataset.price = property.price; card.dataset.beds = property.rooms;
        card.innerHTML = `<span class="card-tab">For rent · ${escapeHtml(property.type)}</span><div class="card-media" aria-hidden="true"></div><div class="card-body"><span class="badge" style="width:fit-content;">✓ Verified landlord</span><h3>${escapeHtml(property.title)}</h3><p class="card-meta">${property.rooms} room${property.rooms === 1 ? '' : 's'} · ${property.bathrooms} bathroom${property.bathrooms === 1 ? '' : 's'}</p><p class="card-price">KES ${property.price.toLocaleString()} <span style="font-size:.7em; color:#544d3f;">/month</span></p><div class="card-actions"><a class="btn btn-primary" href="property.html?id=${encodeURIComponent(property.id)}">View in 360°</a></div></div>`;
        if (property.image) { const media = $('.card-media', card); media.style.backgroundImage = `url("${property.image}")`; media.style.backgroundSize = 'cover'; media.style.backgroundPosition = 'center'; }
        grid.append(card);
      });
    });
  }

  function setupPropertyDetail() {
    const page = $('[data-property-detail]'); if (!page) return;
    const id = new URLSearchParams(window.location.search).get('id'); if (!id) return;
    const property = readData().properties.find((item) => item.id === id);
    const owner = property ? readData().users.find((user) => user.id === property.ownerId) : null;
    if (!property || property.status !== 'Verified' || owner?.suspended) { $('#property-detail-content').hidden = true; $('#property-not-available').hidden = false; return; }
    const rooms = Number(property.rooms ?? 0); const bathrooms = Number(property.bathrooms ?? 0); const phone = property.phone || (owner?.phone && owner.phone !== '+254 700 000 000' ? owner.phone : 'Phone not provided');
    document.title = `${property.title} — KejaSearch`;
    $('#property-title').textContent = property.title; $('#property-location').textContent = `${property.area || 'Nairobi'} · ${rooms} room${rooms === 1 ? '' : 's'} · ${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}`; $('#property-price').innerHTML = `KES ${property.price.toLocaleString()} <span style="font-size:.55em; color:#544d3f;">/month</span>`; $('#property-description').textContent = property.description || 'The landlord has not added a description yet.'; $('#property-rooms').textContent = `Rooms: ${rooms}`; $('#property-bathrooms').textContent = `Bathrooms: ${bathrooms}`; $('#property-kitchen').textContent = `Kitchen: ${property.kitchen || 'Details not provided'}`; $('#property-water').textContent = `Water: ${property.water || 'Details not provided'}`; $('#property-power').textContent = `Power: ${property.power || 'Details not provided'}`; $('#property-parking').textContent = `Parking: ${property.parking || 'Details not provided'}`; $('#property-landlord-name').textContent = owner?.name || 'Verified landlord'; $('#property-phone').textContent = phone; $('#property-phone').href = `tel:${phone.replace(/[^+\d]/g, '')}`; $('#property-whatsapp').href = `https://wa.me/${phone.replace(/\D/g, '')}`;
    const renderReviews = () => { const reviews = Array.isArray(property.reviews) ? property.reviews : []; $('#property-reviews').innerHTML = reviews.length ? reviews.map((review) => `<div class="review"><p class="stars" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p><p style="margin:.3em 0;"><strong>${escapeHtml(review.reviewerName || 'Tenant')}</strong></p><p>${escapeHtml(review.reviewText)}</p></div>`).join('') : '<p class="hint">No reviews yet.</p>'; };
    renderReviews(); window.addEventListener('reviewAdded', renderReviews);
    if (property.video) { const video = $('#property-video'); video.src = property.video; video.hidden = false; $('.view360-copy').hidden = true; }
    $('#property-detail-content').hidden = false;
  }

  function setupReviewForm() {
    const form = $('#review-form'); if (!form) return;
    const id = new URLSearchParams(window.location.search).get('id'); if (!id) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = readData(); const property = data.properties.find((item) => item.id === id && item.status === 'Verified'); if (!property) return;
      const values = Object.fromEntries(new FormData(form)); property.reviews = Array.isArray(property.reviews) ? property.reviews : []; property.reviews.push({ rating: Number(values.rating), reviewerName: values.reviewerName.trim(), reviewText: values.reviewText.trim(), submittedAt: new Date().toISOString() }); writeData(data); form.reset(); $('.form-status', form).textContent = 'Thank you. Your rating has been recorded.'; window.dispatchEvent(new Event('reviewAdded'));
    });
  }

  function setupListingFilters() {
    const form = $('#filter-form'); const cards = $$('[data-listing]'); const resultCount = $('#result-count'); const data = readData(); if (!form || !cards.length) return;
    const area = $('#f-area'); const type = $('#f-type'); const beds = $('#f-beds'); const price = $('#f-price'); const params = new URLSearchParams(window.location.search);
    if (params.has('area')) area.value = params.get('area'); if (params.has('type')) type.value = params.get('type'); if (params.has('maxPrice')) price.value = params.get('maxPrice');
    function update() { const areaValue = area.value.trim().toLowerCase(); const maxPrice = Number(price.value); const filtering = areaValue || type.value !== 'any' || beds.value !== 'any' || price.value; let visible = 0; cards.forEach((card) => { const matches = card.dataset.approved !== 'false' && (!areaValue || card.dataset.area.toLowerCase().includes(areaValue)) && (type.value === 'any' || card.dataset.type === type.value) && (beds.value === 'any' || (beds.value === '3' ? Number(card.dataset.beds) >= 3 : Number(card.dataset.beds) === Number(beds.value))) && (!price.value || Number(card.dataset.price) <= maxPrice); card.hidden = !matches; if (matches) visible += 1; }); const count = filtering ? visible : data.properties.length; if (resultCount) resultCount.textContent = `${count} ${count === 1 ? 'listing' : 'listings'} found`; }
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

  setupCookies(); setupLogin(); setupDashboard(); setupAdmin(); setupPublicListings(); setupPropertyDetail(); setupReviewForm(); setupListingFilters(); setupLoginTabs(); setupNavigation();
})();
