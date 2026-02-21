export interface MapStation {
  name: string;
}

/**
 * Builds a self-contained Leaflet HTML page for a train route.
 *
 * Pipeline:
 *  1. Geocode stations via Nominatim (1 req/s), cache in localStorage.
 *  2. Once all stations are known fetch Overpass railway=rail ways (full
 *     geometry) for the bounding box and build an adjacency graph.
 *  3. Run Dijkstra between each consecutive station pair along the graph
 *     to produce a connected route that follows the real track geometry.
 *  4. Cache the solved path (lat/lon array) in localStorage so the second
 *     open is instant.
 *
 * Exposes window.setUserLocation(lat, lon) for the GPS dot.
 */
export function buildLeafletHtml(stations: MapStation[]): string {
  const stationsJson = JSON.stringify(stations);

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
  #status{
    position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.72);color:#fff;padding:7px 16px;
    border-radius:20px;font-size:12px;font-family:-apple-system,sans-serif;
    white-space:nowrap;z-index:9999;display:none;pointer-events:none}
  #status.show{display:block}
</style>
</head>
<body>
<div id="map"></div>
<div id="status"></div>
<script>
(function(){
  var STATIONS = ${stationsJson};
  var map = L.map('map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 OpenStreetMap', maxZoom: 18
  }).addTo(map);
  map.setView([45.9, 24.9], 7);

  var statusEl = document.getElementById('status');
  function setStatus(t) {
    if (t) { statusEl.textContent = t; statusEl.className = 'show'; }
    else    { statusEl.className = ''; }
  }

  // ---------- localStorage caches ----------
  var coordCache = {};
  var ROUTE_FP   = 'rc_path_v4_' + STATIONS.map(function(s){return s.name;}).join('~');
  var solvedPath = null; // cached solved lat/lon path

  try {
    var rc = localStorage.getItem('rc_cfr_v5');
    if (rc) coordCache = JSON.parse(rc);
    var sp = localStorage.getItem(ROUTE_FP);
    if (sp) solvedPath = JSON.parse(sp);
  } catch(e) {}

  function saveCoords() { try { localStorage.setItem('rc_cfr_v5', JSON.stringify(coordCache)); } catch(e) {} }
  function savePath(p)  { try { localStorage.setItem(ROUTE_FP, JSON.stringify(p)); } catch(e) {} }

  // ---------- layers ----------
  var routeLayer  = L.layerGroup().addTo(map);
  var markerLayer = L.layerGroup().addTo(map);
  var userMarker  = null;
  var markersDrawn = {};
  var graphFetched = false;

  // ---------- helpers ----------
  function nk(n) { return n.lat.toFixed(6) + ',' + n.lon.toFixed(6); }

  function haversine(a, b) {
    var R = 6371000, rad = Math.PI/180;
    var dLat = (b.lat - a.lat)*rad, dLon = (b.lon - a.lon)*rad;
    var s = Math.sin(dLat/2), t = Math.sin(dLon/2);
    var aa = s*s + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*t*t;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  }

  function dist2(a, b) {
    var dlat = a.lat - b.lat, dlon = a.lon - b.lon;
    return dlat*dlat + dlon*dlon;
  }

  // ---------- draw the solved route polyline ----------
  function renderPath(path) {
    routeLayer.clearLayers();
    if (!path || path.length < 2) return;
    L.polyline(path, {color:'#0066CC', weight:5, opacity:0.85}).addTo(routeLayer);
    var b = L.latLngBounds(path);
    if (userMarker) b.extend(userMarker.getLatLng());
    map.fitBounds(b, {padding:[32,32]});
  }

  // ---------- draw station markers ----------
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

  // ---------- Dijkstra on the Overpass graph ----------
  function dijkstra(adj, nodes, startKey, endKey) {
    var dist = {}, prev = {}, visited = {};
    dist[startKey] = 0;
    // simple min-priority queue (good enough for ~10k nodes)
    var pq = [{k: startKey, d: 0}];
    while (pq.length) {
      pq.sort(function(a,b){ return a.d - b.d; });
      var cur = pq.shift();
      if (visited[cur.k]) continue;
      visited[cur.k] = true;
      if (cur.k === endKey) break;
      var nb = adj[cur.k] || [];
      for (var i = 0; i < nb.length; i++) {
        var nd = dist[cur.k] + nb[i].d;
        if (nd < (dist[nb[i].k] === undefined ? Infinity : dist[nb[i].k])) {
          dist[nb[i].k] = nd;
          prev[nb[i].k] = cur.k;
          pq.push({k: nb[i].k, d: nd});
        }
      }
    }
    var path = [], cur = endKey;
    while (cur) { path.unshift(cur); cur = prev[cur]; }
    return (path.length > 1 && path[0] === startKey) ? path : null;
  }

  // ---------- build graph + solve path from Overpass response ----------
  function solveFromOverpass(data) {
    setStatus('Se calculează ruta…');

    // Build adjacency graph from all railway ways
    var nodes = {}, adj = {};
    (data.elements || []).forEach(function(el) {
      if (el.type !== 'way' || !el.geometry) return;
      var geom = el.geometry;
      for (var i = 0; i < geom.length; i++) {
        var k = nk(geom[i]);
        if (!nodes[k]) { nodes[k] = {lat: geom[i].lat, lon: geom[i].lon}; adj[k] = []; }
        if (i > 0) {
          var pk = nk(geom[i-1]);
          var d  = haversine(geom[i], geom[i-1]);
          adj[pk].push({k: k,  d: d});
          adj[k ].push({k: pk, d: d});
        }
      }
    });

    var nodeList = Object.keys(nodes).map(function(k){ return nodes[k]; });

    // Find the nearest graph node to a given coord
    function nearest(lat, lon) {
      var best = null, bestD = Infinity;
      for (var i = 0; i < nodeList.length; i++) {
        var d = dist2(nodeList[i], {lat:lat, lon:lon});
        if (d < bestD) { bestD = d; best = nodeList[i]; }
      }
      return best ? nk(best) : null;
    }

    // Build the full path: Dijkstra between each adjacent station pair
    var resolved = STATIONS.filter(function(s){ return !!coordCache[s.name]; });
    var fullPath = [];

    for (var i = 0; i < resolved.length - 1; i++) {
      var a = nearest(coordCache[resolved[i  ].name].lat, coordCache[resolved[i  ].name].lon);
      var b = nearest(coordCache[resolved[i+1].name].lat, coordCache[resolved[i+1].name].lon);
      if (!a || !b) continue;
      var seg = dijkstra(adj, nodes, a, b);
      if (seg) {
        seg.forEach(function(k, idx) {
          // Avoid duplicate junction point between segments
          if (idx === 0 && fullPath.length > 0) return;
          fullPath.push([nodes[k].lat, nodes[k].lon]);
        });
      } else {
        // Fallback: straight line for this segment if graph is disconnected
        if (fullPath.length === 0 || fullPath[fullPath.length-1][0] !== coordCache[resolved[i].name].lat)
          fullPath.push([coordCache[resolved[i  ].name].lat, coordCache[resolved[i  ].name].lon]);
        fullPath.push([coordCache[resolved[i+1].name].lat, coordCache[resolved[i+1].name].lon]);
      }
    }

    savePath(fullPath);
    solvedPath = fullPath;
    renderPath(fullPath);
    setStatus(null);
  }

  // ---------- fetch Overpass + solve (once per session) ----------
  function fetchAndSolve() {
    if (graphFetched) return;
    var ready = STATIONS.filter(function(s){ return !!coordCache[s.name]; });
    if (ready.length < 2) return; // need at least origin + destination
    graphFetched = true;

    var lats = ready.map(function(s){ return coordCache[s.name].lat; });
    var lons = ready.map(function(s){ return coordCache[s.name].lon; });
    var PAD  = 0.12;
    var bbox = [Math.min.apply(null,lats)-PAD, Math.min.apply(null,lons)-PAD,
                Math.max.apply(null,lats)+PAD, Math.max.apply(null,lons)+PAD];

    setStatus('Se încarcă liniile CF…');
    var query = '[out:json][timeout:45][bbox:' + bbox.join(',') + '];'
              + 'way["railway"="rail"]["service"!~"siding|yard|spur"];'
              + 'out geom;';
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: {'Content-Type':'application/x-www-form-urlencoded'}
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ solveFromOverpass(d); })
    .catch(function(){ setStatus(null); });
  }

  // ---------- initial draw (from caches) ----------
  if (solvedPath) renderPath(solvedPath);
  drawMarkers();

  // ---------- name normaliser (remove diacritics, lowercase) ----------
  function normName(n) {
    return n.toLowerCase()
      .replace(/ă/g,'a').replace(/â/g,'a').replace(/î/g,'i')
      .replace(/ș/g,'s').replace(/ş/g,'s')
      .replace(/ț/g,'t').replace(/ţ/g,'t')
      .replace(/[-_]/g,' ').trim();
  }

  // ---------- Overpass railway station node lookup (name-targeted, fast) ----------
  function fetchStationNodes(uncached, callback) {
    setStatus('Se caută stațiile…');

    // Build a server-side regex so Overpass returns ONLY nodes whose name
    // matches one of our station names — tiny response vs fetching all Romania
    var escaped = uncached.map(function(s){
      return normName(s.name).replace(/[.*+?^\${}()|[\]\\]/g,'\\$&');
    });
    var namesRx = escaped.join('|');

    var query = '[out:json][timeout:20][bbox:43.5,20.0,48.3,30.5];'
              + '(node["railway"~"station|halt"]["name"~"' + namesRx + '",i];);out;';

    fetch('https://overpass-api.de/api/interpreter', {
      method:'POST', body:'data='+encodeURIComponent(query),
      headers:{'Content-Type':'application/x-www-form-urlencoded'}
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      // norm name → ALL matching nodes so we can pick the right duplicate
      var osmMap = {};
      (d.elements||[]).forEach(function(el){
        if (!el.tags || !el.tags.name) return;
        var key = normName(el.tags.name);
        if (!osmMap[key]) osmMap[key] = [];
        osmMap[key].push({lat:el.lat, lon:el.lon});
      });

      // Centroid of already-resolved stations — pick duplicate closest to route
      function refCentroid() {
        var pts = STATIONS.filter(function(s){ return !!coordCache[s.name]; })
                          .map(function(s){ return coordCache[s.name]; });
        if (!pts.length) return null;
        var lat=0, lon=0;
        pts.forEach(function(p){ lat+=p.lat; lon+=p.lon; });
        return {lat:lat/pts.length, lon:lon/pts.length};
      }

      function bestCandidate(candidates) {
        if (candidates.length === 1) return candidates[0];
        var ref = refCentroid();
        if (!ref) return candidates[0];
        var best = candidates[0], bestD = dist2(candidates[0], ref);
        for (var i=1; i<candidates.length; i++) {
          var d = dist2(candidates[i], ref);
          if (d < bestD) { bestD = d; best = candidates[i]; }
        }
        return best;
      }

      uncached.forEach(function(s){
        var norm = normName(s.name);
        // Only accept exact normalized name matches
        if (osmMap[norm]) {
          // Filter to only exact normalized name matches (in case regex matched more)
          var exactMatches = osmMap[norm].filter(function(candidate) {
            return normName(candidate.name || s.name) === norm;
          });
          if (exactMatches.length > 0) {
            coordCache[s.name] = bestCandidate(exactMatches);
            return;
          }
        }
        var stripped = norm.replace(/^(gara|halta|statia)\s+/, '');
        if (stripped !== norm && osmMap[stripped]) {
          var exactMatches2 = osmMap[stripped].filter(function(candidate) {
            return normName(candidate.name || s.name) === stripped;
          });
          if (exactMatches2.length > 0) {
            coordCache[s.name] = bestCandidate(exactMatches2);
          }
        }
      });
      saveCoords();
      callback();
    })
    .catch(function(){ saveCoords(); callback(); });
  }

  // ---------- Nominatim fallback (1 req/s) for anything still unresolved ----------
  var nQueue = [];
  var nQi   = 0;
  var NBASE = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ro&q=';

  function nominatimNext() {
    if (nQi >= nQueue.length) {
      saveCoords(); drawMarkers();
      if (!solvedPath) fetchAndSolve();
      else setStatus(null);
      return;
    }
    var s = nQueue[nQi++];
    setStatus('Localizare: ' + nQi + '/' + nQueue.length);

    function tryFetch(q) {
      return fetch(NBASE + encodeURIComponent(q), {headers:{'User-Agent':'TrainTracker/1.0'}})
             .then(function(r){ return r.json(); });
    }
    function pickBest(res) {
      if (!res || !res.length) return null;
      // Prefer actual railway class results
      var rw = res.filter(function(r){ return r.class === 'railway'; });
      return rw.length ? rw[0] : res[0];
    }

    tryFetch('gara ' + s.name + ' Romania')
      .then(function(res){
        var best = pickBest(res);
        if (best) return best;
        return tryFetch(s.name + ' Romania').then(pickBest);
      })
      .then(function(best){
        if (best) coordCache[s.name] = {lat:parseFloat(best.lat), lon:parseFloat(best.lon)};
        drawMarkers();
        setTimeout(nominatimNext, 1100);
      })
      .catch(function(){ setTimeout(nominatimNext, 1100); });
  }

  // ---------- kick off geocoding pipeline ----------
  function startGeocoding() {
    var uncached = STATIONS.filter(function(s){ return !coordCache[s.name]; });
    if (uncached.length === 0) {
      drawMarkers();
      if (!solvedPath) fetchAndSolve(); else setStatus(null);
      return;
    }
    // Stage 1: Overpass station nodes
    fetchStationNodes(uncached, function(){
      drawMarkers();
      // Stage 2: Nominatim for any still missing
      nQueue = STATIONS.filter(function(s){ return !coordCache[s.name]; });
      nQi = 0;
      if (nQueue.length > 0) nominatimNext();
      else if (!solvedPath) fetchAndSolve();
      else setStatus(null);
    });
  }

  startGeocoding();

  // ---------- GPS dot injected from React Native ----------
  window.setUserLocation = function(lat, lon) {
    if (userMarker) { userMarker.setLatLng([lat, lon]); return; }
    var icon = L.divIcon({
      html: '<div style="width:16px;height:16px;background:#007AFF;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,122,255,0.25)"></div>',
      iconSize:[16,16], iconAnchor:[8,8], className:''
    });
    userMarker = L.marker([lat,lon], {icon:icon, zIndexOffset:1000})
      .addTo(map).bindPopup('Tu ești aici');
  };
})();
</script>
</body>
</html>`;
}
