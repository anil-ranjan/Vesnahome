// VesnaHome frontend - Supabase Auth + Properties + Storage
// IMPORTANT: paste your Supabase Publishable key (sb_publishable_...) below.
// Never put a Supabase secret/service_role key in this file.

const SUPABASE_URL = 'https://flhlxxlxncbuvtsfjrnv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qQ1sZKEic6q93X6yGoh6Vg_Uyfj-633';

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let properties = [];
let currentUser = null;
let activeListing = 'All';
let purpose = 'Buy';

const $ = id => document.getElementById(id);

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('show');
}

function fmt(value, listing = 'Sale') {
  const n = Number(value || 0);
  if (listing === 'Rent') return '₹' + n.toLocaleString('en-IN') + '/month';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(n % 10000000 ? 1 : 0) + ' Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(n % 100000 ? 1 : 0) + ' Lac';
  return '₹' + n.toLocaleString('en-IN');
}

function normalizeProperty(p) {
  return {
    id: p.id,
    ownerId: p.owner_id,
    title: p.title || 'Property',
    description: p.description || '',
    propertyType: p.property_type || '',
    listing: String(p.purpose || '').toLowerCase() === 'rent' ? 'Rent' : 'Sale',
    price: Number(p.price || 0),
    city: p.city || '',
    locality: p.locality || '',
    address: p.address || '',
    location: p.locality || p.city || p.address || '',
    bedrooms: p.bedrooms ?? '',
    bathrooms: p.bathrooms ?? '',
    area: p.area ?? '',
    areaUnit: p.area_unit || 'sq_ft',
    youtubeUrl: p.youtube_url || '',
    status: p.status || '',
    featured: !!p.featured,
    ownerName: p.owner_name || '',
    phone: p.phone || '',
    createdAt: p.created_at || '',
    images: p.images || [],
    imageUrl: p.imageUrl || ''
  };
}


async function loadPropertyImages(property) {
  if (!property.owner_id || !property.id) return [];
  const folder = `${property.owner_id}/${property.id}`;
  const { data: files, error } = await supabaseClient.storage
    .from('property-images').list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error) { console.warn(`Unable to load photos for property ${property.id}:`, error.message); return []; }
  return (files || []).filter(f => f.name && !f.name.startsWith('.')).map(f => {
    const { data } = supabaseClient.storage.from('property-images').getPublicUrl(`${folder}/${f.name}`);
    return data.publicUrl;
  }).filter(Boolean);
}

async function loadProperties() {
  const grid = $('propertyGrid');
  if (grid) grid.innerHTML = '<p>Loading properties...</p>';

  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Property load failed:', error);
    if (grid) grid.innerHTML = '<p>Unable to load properties right now.</p>';
    return;
  }

  const rows = await Promise.all((data || []).map(async row => {
    try {
      const images = await loadPropertyImages(row);
      return { ...row, images, imageUrl: images[0] || '' };
    } catch (error) {
      console.warn(`Photo loading skipped for property ${row.id}:`, error);
      return { ...row, images: [], imageUrl: '' };
    }
  }));
  properties = rows.map(normalizeProperty);
  render();
}

function getYoutubeVideoId(url) {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
    else if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.startsWith('/live/')) id = u.pathname.split('/')[2] || '';
    }
    return /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : '';
  } catch { return ''; }
}

function cardMedia(p) {
  const videoId = getYoutubeVideoId(p.youtubeUrl);
  if (videoId) {
    const thumbnail = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    return `<div class="listing-media video-preview" onclick="viewProperty(${p.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewProperty(${p.id});}" role="button" tabindex="0" aria-label="Open property video tour">
      <img src="${thumbnail}" alt="${escapeHtml(p.title)} video preview" loading="lazy">
      <span class="media-badge">VIDEO TOUR</span><span class="video-play" aria-hidden="true">▶</span><span class="media-open-label">Play on VesnaHome</span>
    </div>`;
  }
  if (p.imageUrl) return `<div class="listing-media property-photo" onclick="viewProperty(${p.id})" role="button" tabindex="0"><img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.title)}" loading="lazy"><span class="media-badge">${p.images.length} PHOTO${p.images.length===1?'':'S'}</span></div>`;
  return `<div class="listing-media no-media"><span>No property media available</span></div>`;
}

function render(list = properties) {
  const grid = $('propertyGrid');
  const resultCount = $('resultCount');
  if (!grid) return;
  if (resultCount) resultCount.textContent = `${list.length} properties found`;
  if (!list.length) { grid.innerHTML = '<p>No active properties found.</p>'; return; }

  grid.innerHTML = list.map(p => {
    const digits = String(p.phone || '').replace(/[^0-9]/g, '');
    const description = p.description && p.description.length > 210 ? p.description.substring(0, 210) + '...' : p.description;
    return `<article class="property listing-row">
      ${cardMedia(p)}
      <div class="listing-content">
        <span class="listing-purpose">FOR ${p.listing.toUpperCase()}</span>
        <h3>${escapeHtml(p.title)}</h3><span class="listing-location">⌖ ${escapeHtml(p.location)}</span>
        <div class="listing-specs">
          ${p.area !== '' ? `<div class="listing-spec"><small>AREA</small><strong>${p.area} ${escapeHtml(p.areaUnit)}</strong></div>` : ''}
          ${p.bedrooms !== '' ? `<div class="listing-spec"><small>CONFIGURATION</small><strong>${p.bedrooms} BHK</strong></div>` : ''}
          ${p.bathrooms !== '' ? `<div class="listing-spec"><small>BATHROOM</small><strong>${p.bathrooms}</strong></div>` : ''}
          ${p.propertyType ? `<div class="listing-spec"><small>PROPERTY TYPE</small><strong>${escapeHtml(p.propertyType)}</strong></div>` : ''}
        </div>
        ${description ? `<p class="listing-description">${escapeHtml(description)}</p>` : ''}
        <button class="listing-details" onclick="viewProperty(${p.id})">View full details</button>
      </div>
      <aside class="listing-contact">
        <div class="listing-price">${fmt(p.price, p.listing)}</div>
        ${digits ? `<a class="listing-contact-button" href="tel:${digits}">Call Owner</a><a class="listing-whatsapp" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${p.ownerName ? `<div class="listing-owner">Owner: <strong>${escapeHtml(p.ownerName)}</strong></div>` : ''}
      </aside>
    </article>`;
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function applyFilters() {
  const loc = $('location')?.value || '';
  const type = $('type')?.value || '';
  const budget = Number($('budget')?.value || 0);
  const bhk = $('bhk')?.value || '';
  const wantedListing = activeListing === 'All'
    ? (purpose === 'Rent' ? 'Rent' : 'Sale')
    : activeListing;

  const filtered = properties.filter(p =>
    (!loc || p.location === loc || p.city === loc || p.locality === loc) &&
    (!type || p.propertyType === type) &&
    (!budget || p.price <= budget) &&
    (!bhk || String(p.bedrooms) === String(bhk)) &&
    (!wantedListing || p.listing === wantedListing)
  );

  render(filtered);
  $('properties')?.scrollIntoView({ behavior: 'smooth' });
}

function resetFilters() {
  ['location', 'type', 'budget', 'bhk', 'status'].forEach(id => {
    if ($(id)) $(id).value = '';
  });
  activeListing = 'All';
  document.querySelectorAll('.filter-pills button').forEach((b, i) => b.classList.toggle('active', i === 0));
  render();
}

function favorite(event) {
  event.stopPropagation();
  event.target.textContent = event.target.textContent === '♡' ? '♥' : '♡';
  event.target.style.color = '#e8673d';
}

function youtubeEmbed(url) {
  const id = getYoutubeVideoId(url);
  if (!id) return '';
  return `<section class="property-video-section"><h3>Property video tour</h3><iframe class="video" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1" title="Property video walkthrough" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></section>`;
}

function viewProperty(id) {
  const p = properties.find(x => x.id === id);
  if (!p) return;

  const digits = String(p.phone || '').replace(/[^0-9]/g, '');
  $('detailsContent').innerHTML = `
    <div class="detail-top">
      <div class="detail-info">
        <span class="eyebrow">FOR ${p.listing.toUpperCase()}</span>
        <h2>${escapeHtml(p.title)}</h2>
        <p>⌖ ${escapeHtml(p.location)}</p>
        <div class="detail-price">${fmt(p.price, p.listing)}</div>
        <div class="detail-list">
          ${p.bedrooms !== '' ? `<div><b>${p.bedrooms} BHK</b><br><small>Configuration</small></div>` : ''}
          ${p.bathrooms !== '' ? `<div><b>${p.bathrooms}</b><br><small>Bathrooms</small></div>` : ''}
          ${p.area !== '' ? `<div><b>${p.area} ${escapeHtml(p.areaUnit)}</b><br><small>Area</small></div>` : ''}
        </div>
        <p>${escapeHtml(p.description)}</p>
        ${p.ownerName ? `<p><b>Owner:</b> ${escapeHtml(p.ownerName)}</p>` : ''}
        ${digits ? `<div class="contact-btns"><a href="tel:${digits}">Call owner</a><a class="wa" href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a></div>` : ''}
      </div>
    </div>
    ${youtubeEmbed(p.youtubeUrl)}
  `;
  $('detailsModal').classList.add('show');
}

// ---------- Authentication ----------

function openAuth() {
  $('authMessage').textContent = '';
  showLogin();
  $('authModal').classList.add('show');
}

function showLogin() {
  $('loginForm').style.display = 'flex';
  $('signupForm').style.display = 'none';
  $('loginTab').classList.add('active');
  $('signupTab').classList.remove('active');
  $('authMessage').textContent = '';
}

function showSignup() {
  $('loginForm').style.display = 'none';
  $('signupForm').style.display = 'flex';
  $('signupTab').classList.add('active');
  $('loginTab').classList.remove('active');
  $('authMessage').textContent = '';
}

async function updateAuthUI() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    $('guestActions').style.display = 'none';
    $('userActions').style.display = 'flex';
    $('userEmail').textContent = currentUser.email || 'Signed in';
  } else {
    $('guestActions').style.display = 'block';
    $('userActions').style.display = 'none';
    $('userEmail').textContent = '';
  }
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    toast(error.message);
    return;
  }
  currentUser = null;
  await updateAuthUI();
  toast('Logged out successfully.');
}

$('loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  $('authMessage').textContent = 'Signing in...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    $('authMessage').textContent = error.message;
    return;
  }

  $('authMessage').textContent = '';
  closeModal('authModal');
  event.currentTarget.reset();
  await updateAuthUI();
  toast('Login successful.');
});

$('signupForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');

  if (password !== confirmPassword) {
    $('authMessage').textContent = 'Passwords do not match.';
    return;
  }

  $('authMessage').textContent = 'Creating account...';

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://vesnahome.in'
    }
  });

  if (error) {
    $('authMessage').textContent = error.message;
    return;
  }

  event.currentTarget.reset();
  if (data.session) {
    $('authMessage').textContent = 'Account created and signed in.';
    await updateAuthUI();
    setTimeout(() => closeModal('authModal'), 800);
  } else {
    $('authMessage').textContent = 'Account created. Check your email and confirm the account, then return here to log in.';
  }
});

supabaseClient.auth.onAuthStateChange(() => {
  updateAuthUI();
});

// ---------- Post property ----------

async function openPost() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  if (!currentUser) {
    toast('Please login or create an account before posting a property.');
    openAuth();
    return;
  }
  $('postModal').classList.add('show');
}

async function uploadPropertyPhotos(userId, propertyId, files) {
  const uploaded = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error(`Unsupported image type: ${file.name}`);
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`${file.name} is larger than 10 MB.`);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${propertyId}/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient.storage
      .from('property-images')
      .upload(path, file, { upsert: false });

    if (error) throw error;
    uploaded.push(path);
  }
  return uploaded;
}

$('postForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session?.user;
  if (!user) {
    closeModal('postModal');
    openAuth();
    return;
  }

  const formEl = event.currentTarget;
  const form = new FormData(formEl);
  const submitButton = formEl.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    const row = {
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim() || null,
      property_type: String(form.get('propertyType') || '').trim(),
      purpose: String(form.get('listingType') || '').toLowerCase(),
      price: Number(form.get('price')),
      locality: String(form.get('location') || '').trim(),
      bedrooms: Number(form.get('bhk')),
      area: Number(form.get('area')),
      area_unit: 'sq_ft',
      youtube_url: String(form.get('youtube') || '').trim() || null,
      owner_name: String(form.get('owner') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      owner_id: user.id,
      status: 'pending',
      featured: false
    };

    const { data: inserted, error: insertError } = await supabaseClient
      .from('properties')
      .insert(row)
      .select('id')
      .single();

    if (insertError) throw insertError;

    const files = Array.from($('propertyPhotos')?.files || []);
    if (files.length) {
      await uploadPropertyPhotos(user.id, inserted.id, files);
    }

    formEl.reset();
    closeModal('postModal');
    toast('Property submitted successfully and is pending review.');
  } catch (error) {
    console.error('Property submission failed:', error);
    toast(error.message || 'Property submission failed.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

// ---------- Page controls ----------

document.querySelectorAll('.purpose button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.purpose button').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    purpose = button.dataset.purpose;
  });
});

document.querySelectorAll('.filter-pills button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-pills button').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    activeListing = button.dataset.filter;
    const list = activeListing === 'All'
      ? properties
      : properties.filter(p => p.listing === activeListing);
    render(list);
  });
});

window.addEventListener('click', event => {
  if (event.target.classList?.contains('modal')) event.target.classList.remove('show');
});

async function init() {
  await updateAuthUI();
  await loadProperties();
}

init();
