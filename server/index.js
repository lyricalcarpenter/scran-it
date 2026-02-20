const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '..', 'data');
const restaurantsFile = path.join(dataDir, 'restaurants.json');
const chainsFile = path.join(dataDir, 'chain_restaurants.json');

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function loadRestaurants() {
  try {
    const raw = fs.readFileSync(restaurantsFile, 'utf8');
    const data = JSON.parse(raw);
    return data.filter((r) => (r.address || '').trim().length > 0);
  } catch {
    return [];
  }
}

function loadChains() {
  try {
    const raw = fs.readFileSync(chainsFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeForMatch(s) {
  return (s || '').trim().toLowerCase().replace(/[''`]/g, '');
}

function findChainByQuery(chains, query) {
  const nq = normalizeForMatch(query);
  if (!nq) return null;
  for (const chain of chains) {
    const nName = normalizeForMatch(chain.name);
    if (nName === nq || nName.includes(nq) || nq.includes(nName)) return chain;
  }
  return null;
}

function searchTermsFromChain(chain) {
  const terms = new Set();
  if (chain.cuisine) terms.add(normalizeForMatch(chain.cuisine));
  if (Array.isArray(chain.types)) chain.types.forEach((t) => terms.add(normalizeForMatch(t)));
  return [...terms].filter(Boolean);
}

function restaurantMatchesTerms(r, terms) {
  const cuisine = (r.cuisine || '').toLowerCase();
  const types = Array.isArray(r.types) ? r.types.map((t) => (t || '').toLowerCase()) : [];
  for (const term of terms) {
    if (cuisine.includes(term) || cuisine === term) return true;
    if (types.some((t) => t.includes(term) || t === term)) return true;
  }
  return false;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/restaurants', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const all = loadRestaurants();
  const chains = loadChains();
  const qLower = q.toLowerCase();

  const chain = findChainByQuery(chains, q);
  let results;

  if (chain) {
    const terms = searchTermsFromChain(chain);
    results = all.filter((r) => restaurantMatchesTerms(r, terms));
  } else {
    results = all.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const cuisine = (r.cuisine || '').toLowerCase();
      const typesStr = (Array.isArray(r.types) ? r.types.join(' ') : (r.types || '')).toLowerCase();
      return name.includes(qLower) || cuisine.includes(qLower) || typesStr.includes(qLower);
    });
  }

  res.json(results);
});

app.get('/api/restaurants/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const maxMiles = Math.min(Math.max(parseFloat(req.query.maxMiles) || 1, 0.1), 25);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 20);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const all = loadRestaurants();
  const withDistance = all
    .map((r) => ({
      ...r,
      distance: haversineMiles(lat, lng, r.lat, r.lng),
    }))
    .filter((r) => r.distance <= maxMiles)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  res.json(withDistance);
});

app.listen(PORT, () => {
  console.log(`Scran It API running at http://localhost:${PORT}`);
});
