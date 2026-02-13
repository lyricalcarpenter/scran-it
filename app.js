(function () {
  'use strict';

  // Default center (used until we have user location) — Austin, TX
  const DEFAULT_CENTER = [30.2672, -97.7431];
  const DEFAULT_ZOOM = 13;

  let userLocation = null;
  let map = null;
  let userMarker = null;
  let markers = [];
  let currentResults = [];

  const PRICE_COLORS = { '$': '#8fa87e', '$$': '#d4a574', '$$$': '#a89f94' };

  const userLocationIcon = L.divIcon({
    className: 'map-pin map-pin-user',
    html: '<span class="map-pin-user-dot"></span>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  function getRestaurantIcon(price) {
    const color = PRICE_COLORS[price] || PRICE_COLORS['$$'];
    return L.divIcon({
      className: 'map-pin map-pin-restaurant',
      html: `<span class="map-pin-restaurant-dot" style="background-color:${color};border-color:${color}"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

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

  function applyResults(results) {
    const withDistance = results
      .map(r => ({ ...r, distance: distanceToMiles(r) }))
      .sort((a, b) => a.distance - b.distance);
    currentResults = withDistance;
    renderList(withDistance);
    updateMapMarkers(withDistance);
    $emptyState.classList.add('hidden');
    $resultsMeta.textContent = withDistance.length
      ? `${withDistance.length} locally owned restaurant${withDistance.length !== 1 ? 's' : ''}`
      : 'No matches. Try another cuisine or dish.';
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
    const center = getCenter();
    const apiUrl = `/api/restaurants?q=${encodeURIComponent(query)}&lat=${center[0]}&lng=${center[1]}`;
    fetch(apiUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('API error'))))
      .then((list) => applyResults(list))
      .catch(() => {
        currentResults = [];
        renderList([]);
        updateMapMarkers([]);
        $emptyState.classList.remove('hidden');
        $emptyState.innerHTML = '<p>Start the server to search restaurants: <code>npm start</code>, then open <a href="http://localhost:3001">http://localhost:3001</a>.</p>';
        $resultsMeta.textContent = '';
      });
  }

  function formatDistance(miles) {
    if (miles < 0.1) return '< 0.1 mi';
    if (miles < 1) return `${miles.toFixed(1)} mi`;
    return `${miles.toFixed(1)} mi`;
  }

  function renderList(results) {
    $restaurantList.innerHTML = '';
    $emptyState.innerHTML = '<p>Search for a type of food to see locally owned spots near you.</p>';
    results.forEach((r, index) => {
      const li = document.createElement('li');
      li.className = 'restaurant-card';
      li.dataset.id = r.id;
      const address = (r.address || '').trim();
      li.innerHTML = `
        <h3 class="restaurant-name">${escapeHtml(r.name)}</h3>
        <p class="restaurant-meta">
          <span>${escapeHtml(r.price)}</span>
          <span>${formatDistance(r.distance)}</span>
        </p>
        ${address ? `<p class="restaurant-address">${escapeHtml(address)}</p>` : ''}
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
      const address = (r.address || '').trim();
      const marker = L.marker([r.lat, r.lng], { icon: getRestaurantIcon(r.price) })
        .addTo(map)
        .bindPopup(`
          <div class="popup-name">${escapeHtml(r.name)}</div>
          ${address ? `<p class="popup-address">${escapeHtml(address)}</p>` : ''}
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

  function updateUserMarker() {
    if (!map || !userLocation) return;
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userLocationIcon })
      .addTo(map)
      .bindPopup('You are here');
  }

  function initMap() {
    const center = getCenter();
    map = L.map('map').setView(center, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    if (userLocation) updateUserMarker();
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
      updateUserMarker();
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
