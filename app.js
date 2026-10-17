// VesnaHome - Supabase-backed public listings
// Paste the SAME publishable key already used in your current app.js below.
const SUPABASE_URL = 'https://flhlxxlxncbuvtsfjrnv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qQ1sZKEic6q93X6yGoh6Vg_Uyfj-633';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let properties = [];
let activeListing = 'All';
let purpose = 'Buy';

const fmt = n => {
  n = Number(n || 0);
  return n >= 10000000
    ? '₹' + (n / 10000000).toFixed(n % 10000000 ? 1 : 0) + ' Cr'
    : n >= 100000
      ? '₹' + (n / 100000).toFixed(n % 100000 ? 1 : 0) + ' Lac'
      : '₹' + n.toLocaleString('en-IN') + (n < 100000 ? '/month' : '');
};

function normalizeProperty(p) {
  return {
    id: p.id,
    title: p.title || 'Property',
    location: p.locality || p.city || p.address || '',
    type: p.property_type || '',
    listing: String(p.purpose || '').toLowerCase() === 'rent' ? 'Rent' : 'Sale',
    price: Number(p.price || 0),
    bhk: p.bedrooms ?? '',
    area: p.area ?? '',
    areaUnit: p.area_unit || 'sqft',
    status: p.status || '',
    owner: p.owner_name || '',
    phone: p.phone || '',
    desc: p.description || '',
    youtubeUrl: p.youtube_url || '',
    img: '',
    photos: 0
  };
}

async function loadProperties() {
  const grid = document.getElementById('propertyGrid');
  const count = document.getElementById('resultCount');
  if (grid) grid.innerHTML = '<p>Loading properties...</p>';
  if (count) count.textContent = '';

  const { data, error } = await supabaseClient
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase load error:', error);
    if (grid) grid.innerHTML = '<p>Unable to load properties right now.</p>';
    toast('Unable to load properties');
    return;
  }

  properties = (data || []).map(normalizeProperty);
  render();
}

function render(list = properties) {
  const grid = document.getElementById('propertyGrid');
  const resultCount = document.getElementById('resultCount');
  if (!grid || !resultCount) return;

  resultCount.textContent = list.length + ' properties found';
  grid.innerHTML = list.map(p => `
    <article class="property">
      <div class="photo"${p.img ? ` style="background-image:url('${p.img}')"` : ''}>
        <span class="tag">FOR ${p.listing.toUpperCase()}</span>
        <button class="heart" onclick="favorite(event)">♡</button>
        ${p.photos ? `<span class="count">▧ ${p.photos} photos</span>` : ''}
      </div>
      <div class="property-body">
        <span class="location">⌖ ${p.location}</span>
        <h3>${p.title}</h3>
        <div class="features">
          ${p.bhk !== '' ? `<span>${p.bhk} BHK</span>` : ''}
          ${p.area !== '' ? `<span>${p.area} ${p.areaUnit}</span>` : ''}
        </div>
        <div class="price-row">
          <span class="price">${fmt(p.price)}</span>
          <button class="view" onclick="viewProperty(${p.id})">View details</button>
        </div>
      </div>
    </article>
  `).join('') || '<p>No active properties found.</p>';
}

function applyFilters() {
  const loc = document.getElementById('location').value;
  const type = document.getElementById('type').value;
  const budget = +document.getElementById('budget').value;
  const bhk = document.getElementById('bhk').value;
  const wanted = activeListing === 'All' ? (purpose === 'Rent' ? 'Rent' : 'Sale') : activeListing;

  render(properties.filter(p =>
    (!loc || p.location === loc) &&
    (!type || p.type === type) &&
    (!budget || p.price <= budget) &&
    (!bhk || p.bhk == bhk) &&
    (!wanted || p.listing === wanted)
  ));
  document.getElementById('properties').scrollIntoView();
}

function resetFilters() {
  ['location', 'type', 'budget', 'bhk', 'status'].forEach(x => {
    const el = document.getElementById(x);
    if (el) el.value = '';
  });
  activeListing = 'All';
  document.querySelectorAll('.filter-pills button').forEach((b, i) => b.classList.toggle('active', i === 0));
  render();
}

document.querySelectorAll('.purpose button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.purpose button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  purpose = b.dataset.purpose;
});

document.querySelectorAll('.filter-pills button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filter-pills button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  activeListing = b.dataset.filter;
  applyFilters();
});

function viewProperty(id) {
  const p = properties.find(x => x.id === id);
  if (!p) return;

  const safePhone = String(p.phone || '').replace(/[^0-9]/g, '');
  let video = '';
  if (p.youtubeUrl) {
    try {
      const u = new URL(p.youtubeUrl);
      let videoId = '';
      if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
      else videoId = u.searchParams.get('v') || '';
      if (videoId) video = `<iframe class="video" src="https://www.youtube.com/embed/${videoId}" title="Property video" allowfullscreen></iframe>`;
    } catch (_) {}
  }

  document.getElementById('detailsContent').innerHTML = `
    <div class="detail-top">
      ${p.img ? `<img class="detail-img" src="${p.img}" alt="${p.title}">` : ''}
      <div class="detail-info">
        <span class="eyebrow">FOR ${p.listing.toUpperCase()}</span>
        <h2>${p.title}</h2>
        <p>⌖ ${p.location}</p>
        <div class="detail-price">${fmt(p.price)}</div>
        <div class="detail-list">
          ${p.bhk !== '' ? `<div><b>${p.bhk} BHK</b><br><small>Configuration</small></div>` : ''}
          ${p.area !== '' ? `<div><b>${p.area} ${p.areaUnit}</b><br><small>Area</small></div>` : ''}
        </div>
        <p>${p.desc}</p>
        ${p.owner ? `<p><b>Owner:</b> ${p.owner}</p>` : ''}
        ${safePhone ? `<div class="contact-btns"><a href="tel:+${safePhone}">Call owner</a><a class="wa" href="https://wa.me/${safePhone}?text=I%20am%20interested%20in%20your%20property" target="_blank" rel="noopener">WhatsApp</a></div>` : ''}
      </div>
    </div>
    ${video}
  `;
  document.getElementById('detailsModal').classList.add('show');
}

function openPost() {
  toast('Login / Sign Up will be enabled in the next step before property submission.');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function favorite(e) {
  e.stopPropagation();
  e.target.textContent = e.target.textContent === '♡' ? '♥' : '♡';
  e.target.style.color = '#e8673d';
}

const postForm = document.getElementById('postForm');
if (postForm) {
  postForm.onsubmit = e => {
    e.preventDefault();
    toast('Please sign in before submitting a property.');
  };
}

function toast(t) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = t;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

window.onclick = e => {
  if (e.target.classList.contains('modal')) e.target.classList.remove('show');
};

loadProperties();
