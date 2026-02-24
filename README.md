# Scran.it

Scran.it is a aggregator of local restaurants in your area. Search by cuisine, dish, or restaurant name and see results on a map with distance and price filters.

## Prerequisites

- **Node.js** (v14 or later recommended). [Download Node.js](https://nodejs.org/) if you don’t have it.

## Running the application

1. **Clone or open the project** and go to the project folder:
   ```bash
   cd scran_it
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   Or use the dev script (same behavior):
   ```bash
   npm run dev
   ```

4. **Open in your browser:**  
   The app runs at **http://localhost:3001**.  
   Allow location access when prompted so the map and nearby results work.

To use a different port, set the `PORT` environment variable before starting, for example:
```bash
PORT=4000 npm start
```

## Optional: seeding data

The app reads from `data/restaurants.json` and `data/chain_restaurants.json`. If you need to (re)generate or update this data:

- **Seed restaurants:**  
  `npm run seed`

- **Seed chain data:**  
  `npm run seed-chains`

- **Add restaurant photos** (requires a Google Places API key):  
  Copy `.env.example` to `.env`, add your `GOOGLE_PLACES_API_KEY`, then run:
  ```bash
  npm run add-photos
  ```

## Project structure

- `index.html`, `app.js`, `styles.css` — frontend (map, search, filters)
- `server/index.js` — Express API serving the app and `/api/restaurants`, `/api/restaurants/nearby`
- `data/restaurants.json`, `data/chain_restaurants.json` — restaurant and chain data used by the API
