/**
 * Add photo URLs to each restaurant in data/restaurants.json using Google Places API.
 * Requires: GOOGLE_PLACES_API_KEY in the environment.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node server/add-restaurant-photos.js
 *   GOOGLE_PLACES_API_KEY=your_key node server/add-restaurant-photos.js --limit 20
 *   GOOGLE_PLACES_API_KEY=your_key node server/add-restaurant-photos.js --dry-run
 *
 * Options:
 *   --limit N    Process only the first N restaurants (default: all)
 *   --dry-run    Fetch photos but do not write restaurants.json
 *   --delay N    Milliseconds between API calls (default: 200)
 */

const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'restaurants.json');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DELAY_MS = parseInt(process.env.DELAY_MS || '200', 10);

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let delayMs = DELAY_MS;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1] != null) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--delay' && args[i + 1] != null) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { limit, dryRun, delayMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPlace(query, lat, lng, key) {
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,photos',
    locationbias: `circle:300@${lat},${lng}`,
    key,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`
  );
  if (!res.ok) throw new Error(`Find Place HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || data.status);
  }
  const candidate = data.candidates && data.candidates[0];
  return candidate || null;
}

async function getPlaceDetails(placeId, key) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'photos',
    key,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  );
  if (!res.ok) throw new Error(`Place Details HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(data.error_message || data.status);
  return (data.result && data.result.photos && data.result.photos[0]) || null;
}

async function getPhotoUrl(photoReference, key) {
  const params = new URLSearchParams({
    maxwidth: '400',
    photo_reference: photoReference,
    key,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/photo?${params}`,
    { redirect: 'manual' }
  );
  const location = res.headers.get('location');
  if (res.status === 302 && location) return location;
  return null;
}

async function fetchPhotoUrlForRestaurant(r, key, delayMs) {
  const query = [r.name, r.address, 'Austin, TX'].filter(Boolean).join(', ');
  const place = await findPlace(query, r.lat, r.lng, key);
  await sleep(delayMs);

  let photoRef = null;
  if (place && place.photos && place.photos[0]) {
    photoRef = place.photos[0].photo_reference;
  } else if (place && place.place_id) {
    const photo = await getPlaceDetails(place.place_id, key);
    await sleep(delayMs);
    if (photo) photoRef = photo.photo_reference;
  }

  if (!photoRef) return null;
  const url = await getPhotoUrl(photoRef, key);
  await sleep(delayMs);
  return url;
}

async function run() {
  const { limit, dryRun, delayMs } = parseArgs();

  if (!API_KEY || API_KEY === '') {
    console.error('Set GOOGLE_PLACES_API_KEY in the environment.');
    console.error('Get a key: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
  }

  const raw = fs.readFileSync(dataFile, 'utf8');
  const restaurants = JSON.parse(raw);
  const toProcess = restaurants.slice(0, limit);
  console.log(`Processing ${toProcess.length} restaurants (delay ${delayMs}ms)...`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const r = toProcess[i];
    try {
      const url = await fetchPhotoUrlForRestaurant(r, API_KEY, delayMs);
      if (url) {
        r.photo = url;
        updated++;
        if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${toProcess.length} (${updated} photos)`);
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      if (err.message && !err.message.includes('ZERO_RESULTS')) {
        console.warn(`  [${r.name}] ${err.message}`);
      }
    }
  }

  console.log(`Done. Photos added: ${updated}, no photo: ${failed}`);

  if (!dryRun && updated > 0) {
    fs.writeFileSync(dataFile, JSON.stringify(restaurants, null, 2), 'utf8');
    console.log(`Wrote ${dataFile}`);
  } else if (dryRun) {
    console.log('Dry run — not writing file.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
