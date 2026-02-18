const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '..', 'data');
const restaurantsFile = path.join(dataDir, 'restaurants.json');
const chainsFile = path.join(dataDir, 'chain_restaurants.json');

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

app.listen(PORT, () => {
  console.log(`Scran It API running at http://localhost:${PORT}`);
});
