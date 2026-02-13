/**
 * Seed the restaurant data from OpenStreetMap (Overpass API).
 * Run: npm run seed
 *
 * Fetches restaurants, fast_food, and cafes in the Austin, TX area
 * and writes data/restaurants.json for the API to serve.
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'restaurants.json');

const AUSTIN_BBOX = [30.0985, -97.8964, 30.5169, -97.5634]; // south, west, north, east
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const overpassQuery = `
[out:json][timeout:90];
(
  node["amenity"~"restaurant|fast_food|cafe"](${AUSTIN_BBOX.join(',')});
  way["amenity"~"restaurant|fast_food|cafe"](${AUSTIN_BBOX.join(',')});
);
out body center;
`;

function getTag(el, key) {
  return el.tags && el.tags[key] ? String(el.tags[key]).trim() : null;
}

function getLatLng(el) {
  if (el.type === 'node') {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.type === 'way' && el.center) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function buildAddress(tags) {
  if (!tags) return null;
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:unit'],
  ].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  return tags['addr:full'] || null;
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
  return { cuisine: cuisineLabel, types: Array.from(types).join(', ') };
}

function pickPrice() {
  const rand = Math.random();
  if (rand < 0.4) return '$';
  if (rand < 0.85) return '$$';
  return '$$$';
}

async function fetchOverpass() {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(overpassQuery),
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  return res.json();
}

async function run() {
  console.log('Fetching restaurants from OpenStreetMap (Austin area)...');
  const data = await fetchOverpass();
  const elements = data.elements || [];
  const seen = new Set();
  const rows = [];
  let id = 1;

  for (const el of elements) {
    const name = getTag(el, 'name');
    if (!name || name.length < 2) continue;
    const coords = getLatLng(el);
    if (!coords) continue;
    const key = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}-${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const amenity = getTag(el, 'amenity') || 'restaurant';
    const { cuisine, types } = inferCuisineAndTypes(el, amenity);
    const address = buildAddress(el.tags);
    rows.push({
      id: id++,
      name: name.substring(0, 255),
      cuisine: cuisine.substring(0, 100),
      types: types ? types.split(', ').filter(Boolean) : [],
      lat: coords.lat,
      lng: coords.lng,
      price: pickPrice(),
      address: address ? address.substring(0, 255) : '',
    });
  }

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`Seeded ${rows.length} restaurants to ${dataFile}`);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
