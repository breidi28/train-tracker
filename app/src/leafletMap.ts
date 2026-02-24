export interface MapStation {
  name: string;
}

import { STATION_COORDS } from './stationCoords';

/**
 * Builds a self-contained Leaflet HTML page for a train route.
 * Draws a straight line between pre-resolved stations (no online station search).
 */
export function buildLeafletHtml(stations: MapStation[]): string {
  const stationsJson = JSON.stringify(stations);

  const normTS = (n: string) =>
    n.toLowerCase()
      .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
      .replace(/ș/g, 's').replace(/ş/g, 's')
      .replace(/ț/g, 't').replace(/ţ/g, 't')
      .replace(/[-_]/g, ' ').trim();

  // Pre-resolve stations from the static lookup
  const preResolved: Record<string, { lat: number; lon: number }> = {};
  for (const s of stations) {
    const norm = normTS(s.name);
    if (STATION_COORDS[norm]) {
      preResolved[s.name] = STATION_COORDS[norm];
    } else {
      const stripped = norm.replace(/^(gara |halta |statia )/, '').replace(/ (hc|hm|gr\.?a|gr\.?b|gr a|gr b)$/i, '').trim();
      if (STATION_COORDS[stripped]) {
        preResolved[s.name] = STATION_COORDS[stripped];
      }
    }
  }
  const preResolvedJson = JSON.stringify(preResolved);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#e5e7eb}
  #map{width:100vw;height:100vh}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  var STATIONS = ${stationsJson};
  var map = L.map('map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 18
  }).addTo(map);
  map.setView([45.9, 24.9], 7);

  /* ── caches ── */
  var coordCache = ${preResolvedJson};

  /* ── layers ── */
  var routeLayer  = L.layerGroup().addTo(map);
  var markerLayer = L.layerGroup().addTo(map);
  var userMarker  = null;
  var markersDrawn = {};

  /* ── helpers ── */
  function renderPath(path, fit) {
    routeLayer.clearLayers();
    if (!path || path.length < 2) return;
    L.polyline(path, {color:'#0066CC', weight:5, opacity:0.85}).addTo(routeLayer);
    if (fit) {
      var b = L.latLngBounds(path);
      if (userMarker) b.extend(userMarker.getLatLng());
      map.fitBounds(b, {padding:[32,32]});
    }
  }

  function drawMarkers() {
    STATIONS.forEach(function(s, i) {
      if (!coordCache[s.name] || markersDrawn[s.name]) return;
      markersDrawn[s.name] = true;
      var term = i === 0 || i === STATIONS.length - 1;
      L.circleMarker([coordCache[s.name].lat, coordCache[s.name].lon], {
        radius: term ? 8 : 5,
        color:       term ? '#0066CC' : '#6b7280',
        fillColor:   term ? '#0066CC' : '#fff',
        fillOpacity: 1, weight: 2
      }).addTo(markerLayer).bindPopup('<b>' + s.name + '</b>');
    });
  }

  /* ── straight-line path (instant) ── */
  function buildStraightPath() {
    var resolved = STATIONS.filter(function(s){ return !!coordCache[s.name]; });
    if (resolved.length < 2) return;
    var path = resolved.map(function(s) {
      return [coordCache[s.name].lat, coordCache[s.name].lon];
    });
    renderPath(path, true);
  }

  /* ── initial draw ── */
  drawMarkers();
  buildStraightPath();

  /* ── GPS dot ── */
  window.setUserLocation = function(lat, lon) {
    if (userMarker) { userMarker.setLatLng([lat, lon]); return; }
    var icon = L.divIcon({
      html: '<div style="width:16px;height:16px;background:#007AFF;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,122,255,0.25)"></div>',
      iconSize:[16,16], iconAnchor:[8,8], className:''
    });
    userMarker = L.marker([lat,lon], {icon:icon, zIndexOffset:1000})
      .addTo(map).bindPopup('Tu esti aici');
  };
})();
</script>
</body>
</html>`;
}
