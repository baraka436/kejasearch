(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const SESSION = 'nyumba360-session';
  // The admin address is stored as a one-way SHA-256 hash instead of plain text so
  // it isn't readable directly in this file's source. This only hides the address —
  // it grants no access by itself; the real permission check happens server-side in
  // Supabase via the is_admin() function (see supabase-schema.sql), which is what
  // actually protects admin-only data no matter what this file contains.
  const ADMIN_EMAIL_HASH = 'b3bb459089fdcac570a1d450d4d98e0b182cf1bf4deca4cefe2847b49c1a6988';
  async function isAdminEmail(email) {
    if (!email) return false;
    const bytes = new TextEncoder().encode(email.trim().toLowerCase());
    const digestBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return hex === ADMIN_EMAIL_HASH;
  }
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

  function setupContactForm() {
    const form = $('form[action*="formspree.io"]');
    if (!form) return;
    const button = $('button[type="submit"]', form);
    const status = $('.form-status', form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const originalLabel = button.textContent;
      button.disabled = true; button.textContent = 'Sending...';
      const payload = new FormData(form); payload.set('_replyto', payload.get('email'));
      try {
        const response = await fetch(form.action, { method: form.method || 'POST', body: payload, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Formspree could not accept the message. Please try again.');
        form.reset(); if (status) status.textContent = form.dataset.successMessage || 'Thanks — your message has been sent.';
      } catch (error) {
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false; button.textContent = originalLabel;
      }
    });
  }

  function setupLogin() {
    const loginForm = $('#login-form');
    const signupForm = $('#signup-form');
    const supabase = window.kejaSupabase;
    if (!supabase || (!loginForm && !signupForm)) return;

    const setStatus = (form, message) => { const status = $('.form-status', form); if (status) status.textContent = message; };
    const redirectForRole = (role) => { window.location.href = role === 'admin' ? 'admin.html' : role === 'landlord' ? 'dashboard.html' : 'index.html'; };
    const loadProfileAndRedirect = async (user) => {
      const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
      const isAdmin = await isAdminEmail(user.email);
      if (profile || isAdmin) {
        const role = isAdmin ? 'admin' : profile.role;
        setSession({ role, userId: user.id, username: profile?.username || user.email });
        redirectForRole(role);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.pathname.endsWith('/login.html')) loadProfileAndRedirect(data.session.user);
    });

    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(loginForm));
      const { data, error } = await supabase.auth.signInWithPassword({ email: values.identity.trim(), password: values.password });
      if (error) {
        if (error.code === 'email_not_confirmed') {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: values.identity.trim(), options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } });
          setStatus(loginForm, resendError ? `Your email is not confirmed, and the confirmation email could not be sent: ${resendError.message}` : 'Confirm your email first. A new confirmation link has been sent.');
        } else setStatus(loginForm, error.message);
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', data.user.id).single();
      const role = (await isAdminEmail(data.user.email)) ? 'admin' : profile?.role || 'tenant';
      setSession({ role, userId: data.user.id, username: profile?.username || data.user.email });
      redirectForRole(role);
    });
    signupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!signupForm.checkValidity()) { signupForm.reportValidity(); return; }
      const values = Object.fromEntries(new FormData(signupForm));
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          data: { username: values.username.trim().toLowerCase(), full_name: values.name.trim(), phone: values.phone.trim(), role: values.role, marketing_consent: Boolean(values.consentMarketing) }
        }
      });
      if (error) {
        const errorMessage = String(error.message || '').toLowerCase();
        const message = error.code === 'over_email_send_rate_limit'
          ? 'Email sending is temporarily rate-limited. Check your SMTP provider settings or try again later.'
          : errorMessage.includes('confirmation email')
            ? 'The account request reached Supabase, but the confirmation email could not be sent. Check Resend SMTP host, port, username, password, and verified sender settings in Supabase.'
            : error.message;
        setStatus(signupForm, message);
        return;
      }
      if (!data.session) { setStatus(signupForm, 'Account created. Check your email and click the confirmation link before logging in.'); return; }
      const role = (await isAdminEmail(data.user.email)) ? 'admin' : values.role;
      setSession({ role, userId: data.user.id, username: values.username.trim().toLowerCase() }); redirectForRole(role);
    });
  }

  function requireRole(role) {
    const session = getSession();
    if (!session || session.role !== role) { window.location.href = 'login.html'; return null; }
    return session;
  }

  async function setupDashboard() {
    if (!$('[data-landlord-dashboard]')) return;
    const session = requireRole('landlord'); if (!session) return;
    const supabase = window.kejaSupabase;
    const { data: authData } = await supabase.auth.getUser();
    const { data: landlord, error: profileError } = await supabase.from('profiles').select('id, username, full_name, phone, role, phone_verified').eq('id', session.userId).single();
    if (profileError || !authData.user || landlord?.role !== 'landlord') { sessionStorage.removeItem(SESSION); window.location.href = 'login.html'; return; }
    const tableBody = $('#landlord-properties'); const form = $('#property-form');
    $('#landlord-name').textContent = landlord.full_name; $('#verification-status').textContent = landlord.phone_verified ? 'Verified landlord' : 'Pending verification';
    let properties = [];
    async function loadProperties() {
      const { data, error } = await supabase.from('properties').select('*').eq('owner_id', landlord.id).order('created_at', { ascending: false });
      if (error) throw error;
      properties = data || [];
    }
    async function render() {
      await loadProperties();
      const activeListings = properties.filter((property) => property.status === 'Verified').length;
      $('#listing-count').textContent = activeListings; $('#enquiries-count').textContent = '0'; $('#rating-count').textContent = '0';
      $('#landlord-reviews').innerHTML = '<p class="hint">Reviews are stored in Supabase and will appear here after moderation.</p>';
      tableBody.innerHTML = properties.length ? properties.map((property) => `<tr><td>${escapeHtml(property.title)}</td><td><span class="badge${property.status === 'Verified' ? '' : ' badge-outline'}">${escapeHtml(property.status)}</span></td><td>KES ${property.price.toLocaleString()}</td><td>0</td><td><button class="btn btn-danger-outline js-remove-property" type="button" data-id="${property.id}">Remove</button></td></tr>`).join('') : '<tr><td colspan="5">No properties yet. Add your first listing above.</td></tr>';
      $$('.js-remove-property', tableBody).forEach((button) => button.addEventListener('click', async () => {
        const { error } = await supabase.from('properties').delete().eq('id', button.dataset.id).eq('owner_id', landlord.id);
        if (error) { showToast(error.message); return; }
        await render();
      }));
    }
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const values = Object.fromEntries(new FormData(form));
      try {
        const imageFile = $('#property-image').files[0]; const videoFile = $('#property-video').files[0]; const timestamp = Date.now();
        const imagePath = `${landlord.id}/${timestamp}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: imageError } = await supabase.storage.from('property-images').upload(imagePath, imageFile, { upsert: false, contentType: imageFile.type });
        if (imageError) throw imageError;
        const videoPath = `${landlord.id}/${timestamp}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: videoError } = await supabase.storage.from('property-videos').upload(videoPath, videoFile, { upsert: false, contentType: videoFile.type });
        if (videoError) throw videoError;
        const { data: imageData } = supabase.storage.from('property-images').getPublicUrl(imagePath); const { data: videoData } = supabase.storage.from('property-videos').getPublicUrl(videoPath);
        const { error } = await supabase.from('properties').insert({ owner_id: landlord.id, title: values.title.trim(), type: values.type, price: Number(values.price), rooms: Number(values.rooms), bathrooms: Number(values.bathrooms), phone: values.phone.trim(), kitchen: values.kitchen.trim(), power: values.power.trim(), water: values.water.trim(), parking: values.parking.trim(), description: values.description.trim(), image_url: imageData.publicUrl, video_url: videoData.publicUrl });
        if (error) throw error;
        form.reset(); await render(); showToast('Property added and queued for admin approval.');
      } catch (error) { showToast(error.message); }
    });
    $('#download-data-button')?.addEventListener('click', () => {
      const rows = properties.length ? properties.map((property) => `<tr><td>${escapeHtml(property.title)}</td><td>${escapeHtml(property.type)}</td><td>KES ${property.price.toLocaleString()}</td><td>${escapeHtml(property.status)}</td></tr>`).join('') : '<tr><td colspan="4">No properties listed.</td></tr>';
      const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>KejaSearch landlord data - ${escapeHtml(landlord.full_name)}</title><style>body{font-family:Arial,sans-serif;color:#23201b;margin:40px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#e5d9bf}</style></head><body><h1>KejaSearch landlord dashboard</h1><p><strong>Landlord:</strong> ${escapeHtml(landlord.full_name)}</p><p><strong>Email:</strong> ${escapeHtml(authData.user.email)}</p><p><strong>Username:</strong> ${escapeHtml(landlord.username)}</p><table><thead><tr><th>Property</th><th>Type</th><th>Monthly price</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      const url = URL.createObjectURL(new Blob([documentHtml], { type: 'application/msword' })); const link = document.createElement('a'); link.href = url; link.download = `keja-search-${landlord.username}.doc`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    });
    $('#delete-account-button')?.addEventListener('click', async () => {
      const { error } = await supabase.from('deletion_requests').insert({ user_id: landlord.id });
      const message = error ? error.message : 'Your account deletion request has been submitted for review.';
      $('#deletion-request-status').textContent = message; showToast(message);
    });
    $('#logout-button')?.addEventListener('click', async () => { await supabase.auth.signOut(); sessionStorage.removeItem(SESSION); window.location.href = 'index.html'; });
    try { await render(); } catch (error) { showToast(error.message); }
  }

  async function setupAdmin() {
    if (!$('[data-admin-dashboard]')) return;
    if (!requireRole('admin')) return;
    const supabase = window.kejaSupabase; const usersBody = $('#admin-users'); const propertiesBody = $('#admin-properties'); const requestsBody = $('#admin-deletion-requests');
    async function render() {
      const [{ data: users, error: usersError }, { data: properties, error: propertiesError }, { data: requests, error: requestsError }] = await Promise.all([
        supabase.from('profiles').select('id, username, full_name, role, phone_verified, email_confirmed').eq('email_confirmed', true).order('created_at', { ascending: false }),
        supabase.from('properties').select('*').order('created_at', { ascending: false }),
        supabase.from('deletion_requests').select('id, user_id, status, requested_at, profiles(username, full_name)').order('requested_at', { ascending: false })
      ]);
      if (usersError || propertiesError || requestsError) throw usersError || propertiesError || requestsError;
      const landlords = users.filter((user) => user.role === 'landlord'); $('#admin-user-count').textContent = users.length; $('#admin-landlord-count').textContent = landlords.length; $('#admin-property-count').textContent = properties.length;
      usersBody.innerHTML = users.map((user) => `<tr><td>${escapeHtml(user.full_name)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.role)}</td><td>${user.role === 'landlord' ? `<button class="btn btn-ghost js-verify" type="button" data-id="${user.id}">${user.phone_verified ? 'Verified' : 'Verify landlord'}</button>` : '—'}</td><td>${user.role === 'landlord' ? `<button class="btn btn-ghost js-suspend" type="button" data-id="${user.id}">Suspend / reinstate</button>` : ''}<button class="btn btn-danger-outline js-remove-user" type="button" data-id="${user.id}">Remove user</button></td></tr>`).join('');
      propertiesBody.innerHTML = properties.map((property) => { const owner = users.find((user) => user.id === property.owner_id); const approval = property.status === 'Verified' ? 'Approved' : `<button class="btn btn-ghost js-approve-property" type="button" data-id="${property.id}">Approve listing</button>`; return `<tr><td>${escapeHtml(property.title)}</td><td>${escapeHtml(owner?.full_name || 'Unknown')}</td><td>${escapeHtml(property.status)}</td><td>KES 500 minimum</td><td>${approval}<button class="btn btn-danger-outline js-remove-property" type="button" data-id="${property.id}">Remove listing</button></td></tr>`; }).join('');
      requestsBody.innerHTML = requests.length ? requests.map((request) => `<tr><td>${escapeHtml(request.profiles?.full_name || 'Unknown')}</td><td>${escapeHtml(request.profiles?.username || '')}</td><td>${escapeHtml(request.status)}</td><td>${escapeHtml(new Date(request.requested_at).toLocaleString())}</td><td>${request.status === 'Pending' ? `<button class="btn btn-danger-outline js-approve-deletion" type="button" data-id="${request.id}">Approve deletion</button>` : 'Reviewed'}</td></tr>`).join('') : '<tr><td colspan="5">No account deletion requests.</td></tr>';
      $$('.js-verify', usersBody).forEach((button) => button.addEventListener('click', async () => { const { error } = await supabase.from('profiles').update({ phone_verified: true }).eq('id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
      $$('.js-suspend', usersBody).forEach((button) => button.addEventListener('click', async () => { const { data: owned } = await supabase.from('properties').select('id, suspended').eq('owner_id', button.dataset.id); const next = !(owned?.[0]?.suspended); const { error } = await supabase.from('properties').update({ suspended: next }).eq('owner_id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
      $$('.js-remove-user', usersBody).forEach((button) => button.addEventListener('click', async () => { const { error } = await supabase.from('profiles').delete().eq('id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
      $$('.js-approve-property', propertiesBody).forEach((button) => button.addEventListener('click', async () => { const { error } = await supabase.from('properties').update({ status: 'Verified' }).eq('id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
      $$('.js-remove-property', propertiesBody).forEach((button) => button.addEventListener('click', async () => { const { error } = await supabase.from('properties').delete().eq('id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
      $$('.js-approve-deletion', requestsBody).forEach((button) => button.addEventListener('click', async () => { const { error } = await supabase.from('deletion_requests').update({ status: 'Approved', reviewed_at: new Date().toISOString() }).eq('id', button.dataset.id); if (error) showToast(error.message); else await render(); }));
    }
    $('#logout-button')?.addEventListener('click', async () => { await supabase.auth.signOut(); sessionStorage.removeItem(SESSION); window.location.href = 'index.html'; });
    try { await render(); } catch (error) { showToast(error.message); }
  }

  async function setupPublicListings() {
    const grids = $$('[data-public-listings]');
    if (!grids.length) return;
    const supabase = window.kejaSupabase;
    if (!supabase) return;
    const { data: rows, error } = await supabase.from('properties').select('*, profiles!properties_owner_id_fkey(id, username, full_name, phone)').eq('status', 'Verified').eq('suspended', false).order('created_at', { ascending: false });
    if (error) {
      $$('[data-listing]').forEach((card) => { card.hidden = true; });
      if ($('#result-count')) $('#result-count').textContent = 'Listings are temporarily unavailable.';
      showToast('Supabase tables are not ready. Run supabase-schema.sql in the Supabase SQL Editor.');
      return;
    }
    const data = { properties: (rows || []).map((property) => ({ ...property, ownerId: property.owner_id, image: property.image_url, video: property.video_url, enquiries: 0, reviews: [] })), users: (rows || []).map((property) => ({ id: property.profiles?.id, name: property.profiles?.full_name, phone: property.profiles?.phone, suspended: false })) };
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
        } else { card.dataset.approved = 'false'; card.hidden = true; }
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
    window.dispatchEvent(new Event('listingsLoaded'));
  }

  async function setupPropertyDetail() {
    const page = $('[data-property-detail]'); if (!page) return;
    const id = new URLSearchParams(window.location.search).get('id'); if (!id) return;
    const supabase = window.kejaSupabase;
    const { data: property, error } = await supabase.from('properties').select('*, profiles!properties_owner_id_fkey(id, username, full_name, phone), reviews(id, reviewer_name, rating, review_text, created_at)').eq('id', id).eq('status', 'Verified').eq('suspended', false).maybeSingle();
    const owner = property?.profiles ? { ...property.profiles, name: property.profiles.full_name } : null;
    if (error || !property || !owner) { $('#property-detail-content').hidden = true; $('#property-not-available').hidden = false; return; }
    const rooms = Number(property.rooms ?? 0); const bathrooms = Number(property.bathrooms ?? 0); const phone = property.phone || owner.phone || 'Phone not provided';
    document.title = `${property.title} — KejaSearch`;
    $('#property-title').textContent = property.title; $('#property-location').textContent = `${property.area || 'Nairobi'} · ${rooms} room${rooms === 1 ? '' : 's'} · ${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}`; $('#property-price').innerHTML = `KES ${property.price.toLocaleString()} <span style="font-size:.55em; color:#544d3f;">/month</span>`; $('#property-description').textContent = property.description || 'The landlord has not added a description yet.'; $('#property-rooms').textContent = `Rooms: ${rooms}`; $('#property-bathrooms').textContent = `Bathrooms: ${bathrooms}`; $('#property-kitchen').textContent = `Kitchen: ${property.kitchen || 'Details not provided'}`; $('#property-water').textContent = `Water: ${property.water || 'Details not provided'}`; $('#property-power').textContent = `Power: ${property.power || 'Details not provided'}`; $('#property-parking').textContent = `Parking: ${property.parking || 'Details not provided'}`; $('#property-landlord-name').textContent = owner?.name || 'Verified landlord'; $('#property-phone').textContent = phone; $('#property-phone').href = `tel:${phone.replace(/[^+\d]/g, '')}`; $('#property-whatsapp').href = `https://wa.me/${phone.replace(/\D/g, '')}`;
    const renderReviews = () => { const reviews = property.reviews || []; $('#property-reviews').innerHTML = reviews.length ? reviews.map((review) => `<div class="review"><p class="stars" aria-label="${review.rating} out of 5 stars">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p><p style="margin:.3em 0;"><strong>${escapeHtml(review.reviewer_name || 'Tenant')}</strong></p><p>${escapeHtml(review.review_text)}</p></div>`).join('') : '<p class="hint">No reviews yet.</p>'; };
    renderReviews(); window.addEventListener('reviewAdded', renderReviews);
    if (property.video_url) { const video = $('#property-video'); video.src = property.video_url; video.hidden = false; $('.view360-copy').hidden = true; }
    $('#property-detail-content').hidden = false;
  }

  async function setupReviewForm() {
    const form = $('#review-form'); if (!form) return;
    const id = new URLSearchParams(window.location.search).get('id'); if (!id) return;
    const supabase = window.kejaSupabase;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) { $('.form-status', form).textContent = 'Please log in before submitting a review.'; return; }
      const values = Object.fromEntries(new FormData(form));
      const { error } = await supabase.from('reviews').insert({ property_id: id, reviewer_id: authData.user.id, reviewer_name: values.reviewerName.trim(), rating: Number(values.rating), review_text: values.reviewText.trim(), confirmed_tenancy: values.confirmTenancy === 'on' });
      if (error) { $('.form-status', form).textContent = error.message; return; }
      form.reset(); $('.form-status', form).textContent = 'Thank you. Your rating has been recorded.';
    });
  }

  function setupListingFilters() {
    const form = $('#filter-form'); const resultCount = $('#result-count'); if (!form) return;
    const area = $('#f-area'); const type = $('#f-type'); const beds = $('#f-beds'); const price = $('#f-price'); const params = new URLSearchParams(window.location.search);
    if (params.has('area')) area.value = params.get('area'); if (params.has('type')) type.value = params.get('type'); if (params.has('maxPrice')) price.value = params.get('maxPrice');
    function update() { const cards = $$('[data-listing]'); const areaValue = area.value.trim().toLowerCase(); const maxPrice = Number(price.value); let visible = 0; cards.forEach((card) => { const matches = card.dataset.approved !== 'false' && (!areaValue || card.dataset.area.toLowerCase().includes(areaValue)) && (type.value === 'any' || card.dataset.type === type.value) && (beds.value === 'any' || (beds.value === '3' ? Number(card.dataset.beds) >= 3 : Number(card.dataset.beds) === Number(beds.value))) && (!price.value || Number(card.dataset.price) <= maxPrice); card.hidden = !matches; if (matches) visible += 1; }); if (resultCount) resultCount.textContent = `${visible} ${visible === 1 ? 'listing' : 'listings'} found`; }
    form.addEventListener('input', update); form.addEventListener('change', update); window.addEventListener('listingsLoaded', update); update();
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

  setupCookies(); setupContactForm(); setupLogin(); setupDashboard(); setupAdmin(); setupPublicListings(); setupPropertyDetail(); setupReviewForm(); setupListingFilters(); setupLoginTabs(); setupNavigation();
})();
