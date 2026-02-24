# Scran.it: Local Restaurants in Your Area

## Summary

Scran.it is an aggregator of local restaurants in your area.  Search by cuisine, dish, or restaurant name and get results on a map with distance and price filters.

## Background

When I moved to Austin from Phoenix, I had always heard it was a "foodie" city.  But through the turmoil of adjusting to independent life in college, I ended up always eating at the same big-name places I had in Phoenix.  One day, I realized what the issue was:

**I wanted to eat at local restaurants, instead of chains, but I didn't know where they were or what kind of food they served.**

This is the problem that Scran.it was designed to solve.

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

The app reads from `data/restaurants.json` and `data/chain_restaurants.json`. If you need to regenerate, update, or fetch this data for a different location:

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


## Notes for Phil

- As you mentioned, I may have screwed myself over by getting a **.it** URL.  The GoDaddy-Railway connection does not work and is flagged as being extremely suspicious, despite your and Cursor's best advice.  I will try to continue debugging this (GoDaddy might require a delay since our edits this morning), but at the time of submission I have not implemented the domain correctly.

- Getting thumbnail images for each restaurant requires a Google Cloud API key, which was out of budget, so it's currently pulling images from the Picsum stock photo library.  I included them to give an idea of what the end-game UI layout would look like.
