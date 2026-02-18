/**
 * Build chain_restaurants.json from OpenStreetMap (Overpass API).
 * Only includes restaurants that have locations in MORE THAN ONE CITY (widespread chains).
 * Opposite of restaurants.json: non-local, multi-city chains only. Output: name and food type, no location.
 *
 * Run: node server/seed-chains.js
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const outFile = path.join(dataDir, 'chain_restaurants.json');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Multiple metro areas: a chain must appear in at least 2 different cities to be included
const CITIES = [
  { name: 'Austin', bbox: [30.0985, -97.8964, 30.5169, -97.5634] },
  { name: 'Dallas', bbox: [32.68, -97.05, 33.0, -96.6] },
  { name: 'Houston', bbox: [29.6, -95.6, 29.9, -95.0] },
  { name: 'San Antonio', bbox: [29.32, -98.65, 29.58, -98.35] },
];

function getTag(el, key) {
  return el.tags && el.tags[key] ? String(el.tags[key]).trim() : null;
}

function inferCuisineAndTypes(el, amenity) {
  const tags = el.tags || {};
  const cuisine = tags['cuisine'] ? String(tags['cuisine']).trim() : null;
  const types = new Set();
  if (cuisine) {
    cuisine.split(/[;,&]/).forEach((c) => types.add(c.trim().toLowerCase()));
  }
  if (amenity === 'restaurant') types.add('restaurant');
  if (amenity === 'fast_food') types.add('fast food');
  if (amenity === 'cafe') types.add('cafe');
  const cuisineLabel = cuisine ? cuisine.split(/[;,&]/)[0].trim() : (amenity === 'cafe' ? 'Cafe' : 'Restaurant');
  return { cuisine: cuisineLabel, types: Array.from(types) };
}

function buildQuery(bbox) {
  return `
[out:json][timeout:60];
(
  node["amenity"~"restaurant|fast_food|cafe"](${bbox.join(',')});
  way["amenity"~"restaurant|fast_food|cafe"](${bbox.join(',')});
);
out body center;
`;
}

async function fetchOverpass(bbox) {
  const query = buildQuery(bbox);
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  return res.json();
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

async function run() {
  const byName = new Map();

  for (const city of CITIES) {
    console.log(`Fetching ${city.name}...`);
    const data = await fetchOverpass(city.bbox);
    const elements = data.elements || [];

    for (const el of elements) {
      const name = getTag(el, 'name');
      if (!name || name.length < 2) continue;
      const key = normalizeName(name);
      const amenity = getTag(el, 'amenity') || 'restaurant';
      const { cuisine, types } = inferCuisineAndTypes(el, amenity);

      if (!byName.has(key)) {
        byName.set(key, {
          name: name.substring(0, 255),
          cuisine: cuisine.substring(0, 100),
          types: new Set(types),
          cities: new Set(),
        });
      }
      const rec = byName.get(key);
      rec.cities.add(city.name);
      types.forEach((t) => rec.types.add(t));
    }
  }

  const chains = [];
  for (const rec of byName.values()) {
    if (rec.cities.size < 2) continue;
    chains.push({
      name: rec.name,
      cuisine: rec.cuisine,
      types: Array.from(rec.types).filter(Boolean).sort(),
    });
  }

  chains.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(chains, null, 2), 'utf8');
  console.log(`Wrote ${chains.length} widespread chain restaurants (2+ cities) to ${outFile}`);
}

run().catch((err) => {
  console.error('Seed chains failed:', err.message);
  process.exit(1);
});
