/**
 * Remove chain restaurants from data/restaurants.json.
 * Any name that appears at more than one location is considered a chain;
 * all locations with that name are removed.
 *
 * Run: node server/filter-chains.js
 */

const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'restaurants.json');

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

const raw = fs.readFileSync(dataFile, 'utf8');
const data = JSON.parse(raw);

const nameCounts = new Map();
for (const r of data) {
  const key = normalizeName(r.name);
  nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
}

const chainNames = new Set([...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name));

const filtered = data
  .filter((r) => !chainNames.has(normalizeName(r.name)))
  .map((r, i) => ({ ...r, id: i + 1 }));

fs.writeFileSync(dataFile, JSON.stringify(filtered, null, 2), 'utf8');
console.log(`Removed chains. Before: ${data.length}, after: ${filtered.length} (removed ${data.length - filtered.length} locations).`);
