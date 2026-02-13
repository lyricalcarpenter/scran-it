/**
 * Remove from data/restaurants.json any entry without an address.
 * Run: node server/drop-no-address.js
 */

const path = require('path');
const fs = require('fs');

const dataFile = path.join(__dirname, '..', 'data', 'restaurants.json');

const raw = fs.readFileSync(dataFile, 'utf8');
const data = JSON.parse(raw);

const withAddress = data.filter((r) => (r.address || '').trim().length > 0);
const filtered = withAddress.map((r, i) => ({ ...r, id: i + 1 }));

fs.writeFileSync(dataFile, JSON.stringify(filtered, null, 2), 'utf8');
console.log(`Dropped entries without address. Before: ${data.length}, after: ${filtered.length}.`);
console.log(`Removed ${data.length - filtered.length} entries.`);
