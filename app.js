(function () {
  'use strict';

  // Default center (used until we have user location)
  const DEFAULT_CENTER = [37.7749, -122.4194]; // San Francisco
  const DEFAULT_ZOOM = 13;

  // Mock locally owned restaurants – varied cuisines and locations near default center
  const RESTAURANTS = [
    { id: 1, name: "Mama Rosa's", cuisine: "Italian", types: ["italian", "pasta", "pizza"], lat: 37.778, lng: -122.412, price: "$$" },
    { id: 2, name: "El Mercado", cuisine: "Mexican", types: ["mexican", "tacos", "burritos"], lat: 37.771, lng: -122.425, price: "$" },
    { id: 3, name: "The Local Burger Co.", cuisine: "American", types: ["american", "burgers", "burgers"], lat: 37.776, lng: -122.408, price: "$$" },
    { id: 4, name: "Sakura Kitchen", cuisine: "Japanese", types: ["japanese", "sushi", "ramen"], lat: 37.782, lng: -122.418, price: "$$$" },
    { id: 5, name: "Spice Route", cuisine: "Indian", types: ["indian", "curry", "naan"], lat: 37.769, lng: -122.415, price: "$$" },
    { id: 6, name: "Pho & Co", cuisine: "Vietnamese", types: ["vietnamese", "pho", "noodles"], lat: 37.773, lng: -122.422, price: "$" },
    { id: 7, name: "Bella Trattoria", cuisine: "Italian", types: ["italian", "pasta", "wine"], lat: 37.768, lng: -122.428, price: "$$$" },
    { id: 8, name: "Taqueria Verde", cuisine: "Mexican", types: ["mexican", "tacos", "tacos"], lat: 37.780, lng: -122.430, price: "$" },
    { id: 9, name: "Garden Grill", cuisine: "American", types: ["american", "burgers", "salads"], lat: 37.775, lng: -122.435, price: "$$" },
    { id: 10, name: "Dragon Bowl", cuisine: "Chinese", types: ["chinese", "noodles", "rice"], lat: 37.770, lng: -122.410, price: "$$" },
    { id: 11, name: "Thai Orchid", cuisine: "Thai", types: ["thai", "curry", "pad thai"], lat: 37.777, lng: -122.415, price: "$$" },
    { id: 12, name: "Le Petit Bistro", cuisine: "French", types: ["french", "bistro", "wine"], lat: 37.781, lng: -122.424, price: "$$$" },
  ];

  let userLocation = null;
  let map = null;
  let markers = [];
  let currentResults = [];

  const $search = document.getElementById('search');
  const $searchBtn = document.getElementById('search-btn');
  const $locationStatus = document.getElementById('location-status');
  const $restaurantList = document.getElementById('restaurant-list');
  const $resultsMeta = document.getElementById('results-meta');
  const $emptyState = document.getElementById('empty-state');

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function getCenter() {
    return userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER;
  }

  function distanceToMiles(restaurant) {
    const center = getCenter();
    return haversineDistance(center[0], center[1], restaurant.lat, restaurant.lng);
  }

  function matchQuery(restaurant, query) {
    if (!query || !query.trim()) return false;
    const q = query.trim().toLowerCase();
    const searchable = [
      restaurant.name,
      restaurant.cuisine,
      ...restaurant.types
    ].join(' ').toLowerCase();
    return searchable.includes(q) || restaurant.types.some(t => t.includes(q));
  }

  function runSearch() {
    const query = $search.value.trim();
    if (!query) {
      currentResults = [];
      renderList([]);
      updateMapMarkers([]);
      $emptyState.classList.remove('hidden');
      $resultsMeta.textContent = '';
      return;
    }
    const results = RESTAURANTS
      .filter(r => matchQuery(r, query))
      .map(r => ({ ...r, distance: distanceToMiles(r) }))
      .sort((a, b) => a.distance - b.distance);
    currentResults = results;
    renderList(results);
    updateMapMarkers(results);
    $emptyState.classList.add('hidden');
    $resultsMeta.textContent = results.length
      ? `${results.length} locally owned restaurant${results.length !== 1 ? 's' : ''}`
      : 'No matches. Try another cuisine or dish.';
  }

  function formatDistance(miles) {
    if (miles < 0.1) return '< 0.1 mi';
    if (miles < 1) return `${miles.toFixed(1)} mi`;
    return `${miles.toFixed(1)} mi`;
  }

  function renderList(results) {
    $restaurantList.innerHTML = '';
    results.forEach((r, index) => {
      const li = document.createElement('li');
      li.className = 'restaurant-card';
      li.dataset.id = r.id;
      li.innerHTML = `
        <h3 class="restaurant-name">${escapeHtml(r.name)}</h3>
        <p class="restaurant-meta">
          <span>${escapeHtml(r.price)}</span>
          <span>${formatDistance(r.distance)}</span>
        </p>
        <p class="restaurant-cuisine">${escapeHtml(r.cuisine)}</p>
      `;
      li.addEventListener('click', () => focusRestaurant(r, index));
      $restaurantList.appendChild(li);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function focusRestaurant(restaurant, listIndex) {
    document.querySelectorAll('.restaurant-card').forEach((el, i) => {
      el.classList.toggle('active', i === listIndex);
    });
    map.setView([restaurant.lat, restaurant.lng], 16);
    const marker = markers[listIndex];
    if (marker) marker.openPopup();
  }

  function updateMapMarkers(results) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (!map) return;
    results.forEach((r, index) => {
      const marker = L.marker([r.lat, r.lng])
        .addTo(map)
        .bindPopup(`
          <div class="popup-name">${escapeHtml(r.name)}</div>
          <p class="popup-meta">${escapeHtml(r.cuisine)} · ${escapeHtml(r.price)} · ${formatDistance(r.distance)}</p>
        `);
      marker.on('click', () => {
        document.querySelectorAll('.restaurant-card').forEach((el, i) => {
          el.classList.toggle('active', i === index);
        });
      });
      markers.push(marker);
    });
    if (results.length > 1) {
      const group = L.featureGroup(markers.map(m => m));
      map.fitBounds(group.getBounds().pad(0.15));
    } else if (results.length === 1) {
      map.setView([results[0].lat, results[0].lng], 15);
    }
  }

  function initMap() {
    const center = getCenter();
    map = L.map('map').setView(center, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng])
        .addTo(map)
        .bindPopup('You are here')
        .openPopup();
    }
  }

  function onGeolocationSuccess(position) {
    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };
    $locationStatus.textContent = 'Location found. Search for a type of food.';
    $locationStatus.classList.add('success');
    if (map) {
      map.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM);
      L.marker([userLocation.lat, userLocation.lng])
        .addTo(map)
        .bindPopup('You are here');
    }
    if (currentResults.length) {
      currentResults = currentResults.map(r => ({
        ...r,
        distance: distanceToMiles(r)
      })).sort((a, b) => a.distance - b.distance);
      renderList(currentResults);
    }
  }

  function onGeolocationError() {
    $locationStatus.textContent = 'Using default area. Enable location for results near you.';
    $locationStatus.classList.add('error');
  }

  function init() {
    initMap();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onGeolocationSuccess, onGeolocationError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    } else {
      $locationStatus.textContent = 'Location not supported. Showing default area.';
      $locationStatus.classList.add('error');
    }
    $searchBtn.addEventListener('click', runSearch);
    $search.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
  }

  init();
})();
