const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const dataFile = path.join(__dirname, '..', 'data', 'restaurants.json');

function loadRestaurants() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const data = JSON.parse(raw);
    return data.filter((r) => (r.address || '').trim().length > 0);
  } catch {
    return [];
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/restaurants', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);

  const all = loadRestaurants();
  const searchTerm = q;
  const results = all.filter((r) => {
    const name = (r.name || '').toLowerCase();
    const cuisine = (r.cuisine || '').toLowerCase();
    const typesStr = (Array.isArray(r.types) ? r.types.join(' ') : (r.types || '')).toLowerCase();
    return name.includes(searchTerm) || cuisine.includes(searchTerm) || typesStr.includes(searchTerm);
  });

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Scran It API running at http://localhost:${PORT}`);
});
