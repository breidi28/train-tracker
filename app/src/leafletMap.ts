export interface MapStation {
  name: string;
}

import { STATION_COORDS } from './stationCoords';

/**
 * Builds a self-contained Leaflet HTML page for a train route.
 *
 * Pipeline (progressive):
 *  1. Pre-resolve stations from embedded lookup (instant).
 *  2. Render straight-line path immediately so user sees the map.
 *  3. In background: fetch Overpass railway geometry, run Dijkstra,
 *     then upgrade the polyline to follow real rail curves.
 *  4. Cache the solved curved path so revisits are instant.
 *
 * Exposes window.setUserLocation(lat, lon) for the GPS dot.
 */
export function buildLeafletHtml(stations: MapStation[], cachedRailPath?: number[][] | null): string {
  const stationsJson = JSON.stringify(stations);
  const injectedPathJson = JSON.stringify(cachedRailPath ?? null);

  const normTS = (n: string) =>
    n.toLowerCase()
      .replace(/ă/g, 'a').replace(/â/g, 'a').replace(/î/g, 'i')
      .replace(/ș/g, 's').replace(/ş/g, 's')
      .replace(/ț/g, 't').replace(/ţ/g, 't')
      .replace(/[-_]/g, ' ').trim();

  // Pre-resolve stations from the static lookup
  const preResolved: Record<string, { lat: number; lon: number }> = {};
  const unresolvedForRegex: string[] = [];
  for (const s of stations) {
    const norm = normTS(s.name);
    if (STATION_COORDS[norm]) {
      preResolved[s.name] = STATION_COORDS[norm];
    } else {
      const stripped = norm.replace(/^(gara |halta |statia )/, '').replace(/ (hc|hm|gr\.?a|gr\.?b|gr a|gr b)$/i, '').trim();
      if (STATION_COORDS[stripped]) {
        preResolved[s.name] = STATION_COORDS[stripped];
      } else {
        unresolvedForRegex.push(normTS(s.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
    }
  }
  const preResolvedJson = JSON.stringify(preResolved);
  const namesRegex = unresolvedForRegex.join('|');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
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
  var NAMES_RX = ${JSON.stringify(namesRegex)};

  var map = L.map('map', {zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 18
  }).addTo(map);
  map.setView([45.9, 24.9], 7);

  var statusEl = document.getElementById('status');
  function setStatus(t) {
    if (t) { statusEl.textContent = t; statusEl.className = 'show'; }
    else    { statusEl.className = ''; }
  }

  /* ── caches ── */
  var coordCache = {};
  var _pre = ${preResolvedJson};
  for (var _k in _pre) { coordCache[_k] = _pre[_k]; }

  var ROUTE_FP = 'rc_path_v6_' + STATIONS.map(function(s){return s.name;}).join('~');
  var solvedPath = null;
  var railSolved = false;

  // Inject AsyncStorage-cached rail path if available (instant on revisit)
  var _injected = ${injectedPathJson};
  if (_injected && _injected.length > 1) {
    solvedPath = _injected;
    railSolved = true;
  }

  try {
    var rc = localStorage.getItem('rc_cfr_v5');
    if (rc) { var parsed = JSON.parse(rc); for (var ck in parsed) { if (!coordCache[ck]) coordCache[ck] = parsed[ck]; } }
    var sp = localStorage.getItem(ROUTE_FP);
    if (sp) { solvedPath = JSON.parse(sp); railSolved = true; }
  } catch(e) {}

  function saveCoords() { try { localStorage.setItem('rc_cfr_v5', JSON.stringify(coordCache)); } catch(e) {} }
  function savePath(p)  { try { localStorage.setItem(ROUTE_FP, JSON.stringify(p)); } catch(e) {} }

  /* ── layers ── */
  var routeLayer  = L.layerGroup().addTo(map);
  var markerLayer = L.layerGroup().addTo(map);
  var userMarker  = null;
  var markersDrawn = {};

  /* ── helpers ── */
  function nk(n) { return n.lat.toFixed(6) + ',' + n.lon.toFixed(6); }

  function haversine(a, b) {
    var R = 6371000, rad = Math.PI/180;
    var dLat = (b.lat - a.lat)*rad, dLon = (b.lon - a.lon)*rad;
    var s1 = Math.sin(dLat/2), s2 = Math.sin(dLon/2);
    var aa = s1*s1 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*s2*s2;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  }

  function dist2(a, b) {
    var dlat = a.lat - b.lat, dlon = a.lon - b.lon;
    return dlat*dlat + dlon*dlon;
  }

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
    solvedPath = path;
    renderPath(path, true);
  }

  /* ── Dijkstra on rail graph ── */
  function dijkstra(adj, nodes, startKey, endKey) {
    var dist = {}, prev = {}, visited = {};
    dist[startKey] = 0;
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
    var path = [], c = endKey;
    while (c) { path.unshift(c); c = prev[c]; }
    return (path.length > 1 && path[0] === startKey) ? path : null;
  }

  /* ── build graph from Overpass elements ── */
  function buildGraph(elements) {
    var nodes = {}, adj = {};
    elements.forEach(function(el) {
      if (el.type !== 'way' || !el.geometry) return;
      var geom = el.geometry;
      for (var i = 0; i < geom.length; i++) {
        var k = nk(geom[i]);
        if (!nodes[k]) { nodes[k] = {lat: geom[i].lat, lon: geom[i].lon}; adj[k] = []; }
        if (i > 0) {
          var pk = nk(geom[i-1]);
          var d = haversine(geom[i], geom[i-1]);
          adj[pk].push({k: k, d: d});
          adj[k].push({k: pk, d: d});
        }
      }
    });
    return {nodes: nodes, adj: adj,
            list: Object.values ? Object.values(nodes) : Object.keys(nodes).map(function(k){ return nodes[k]; })};
  }

  function nearestInGraph(graph, lat, lon) {
    var best = null, bestD = Infinity;
    var list = graph.list;
    for (var i = 0; i < list.length; i++) {
      var d = dist2(list[i], {lat:lat, lon:lon});
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best ? nk(best) : null;
  }

  /* ── per-segment rail geometry fetch + Dijkstra ── */
  var segmentResults = [];   // array of path arrays, one per gap between resolved stations
  var segmentFetching = false;

  function fetchRailGeometry() {
    if (segmentFetching) return;
    var resolved = STATIONS.filter(function(s){ return !!coordCache[s.name]; });
    if (resolved.length < 2) return;
    segmentFetching = true;
    segmentResults = new Array(resolved.length - 1);
    var pending = resolved.length - 1;

    function onSegmentDone(index, pathArr) {
      segmentResults[index] = pathArr;
      pending--;
      // Update polyline incrementally — splice in completed segments
      var fullPath = [];
      for (var si = 0; si < segmentResults.length; si++) {
        var seg = segmentResults[si];
        if (!seg) {
          // Not done yet — fall back to straight line for this gap
          var fromPt = [coordCache[resolved[si].name].lat, coordCache[resolved[si].name].lon];
          var toPt   = [coordCache[resolved[si+1].name].lat, coordCache[resolved[si+1].name].lon];
          if (fullPath.length === 0 || fullPath[fullPath.length-1][0] !== fromPt[0]) fullPath.push(fromPt);
          fullPath.push(toPt);
        } else {
          seg.forEach(function(pt, idx) {
            if (idx === 0 && fullPath.length > 0) return;
            fullPath.push(pt);
          });
        }
      }
      renderPath(fullPath, false);
      if (pending === 0) {
        savePath(fullPath);
        solvedPath = fullPath;
        railSolved = true;
        setStatus(null);
        // Notify React Native to persist the solved path to AsyncStorage
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'railPath',path:fullPath}));
        }
      }
    }

    for (var i = 0; i < resolved.length - 1; i++) {
      (function(idx) {
        var aName = resolved[idx].name;
        var bName = resolved[idx+1].name;
        var aCoord = coordCache[aName];
        var bCoord = coordCache[bName];
        var PAD = 0.08;
        var minLat = Math.min(aCoord.lat, bCoord.lat) - PAD;
        var maxLat = Math.max(aCoord.lat, bCoord.lat) + PAD;
        var minLon = Math.min(aCoord.lon, bCoord.lon) - PAD;
        var maxLon = Math.max(aCoord.lon, bCoord.lon) + PAD;
        var bbox = [minLat, minLon, maxLat, maxLon].join(',');
        var query = '[out:json][timeout:25][bbox:' + bbox + '];'
                  + 'way["railway"="rail"]["service"!~"siding|yard|spur"];'
                  + 'out geom;';
        fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var graph = buildGraph(d.elements || []);
          if (!graph.list.length) {
            onSegmentDone(idx, [[aCoord.lat, aCoord.lon], [bCoord.lat, bCoord.lon]]);
            return;
          }
          var startKey = nearestInGraph(graph, aCoord.lat, aCoord.lon);
          var endKey   = nearestInGraph(graph, bCoord.lat, bCoord.lon);
          var segPath = dijkstra(graph.adj, graph.nodes, startKey, endKey);
          if (segPath && segPath.length > 1) {
            var pts = segPath.map(function(k) { return [graph.nodes[k].lat, graph.nodes[k].lon]; });
            onSegmentDone(idx, pts);
          } else {
            onSegmentDone(idx, [[aCoord.lat, aCoord.lon], [bCoord.lat, bCoord.lon]]);
          }
        })
        .catch(function() {
          onSegmentDone(idx, [[aCoord.lat, aCoord.lon], [bCoord.lat, bCoord.lon]]);
        });
      })(i);
    }
    setStatus('Se incarca liniile CF...');
  }


  /* ── initial draw ── */
  if (solvedPath) {
    renderPath(solvedPath, true);
  }
  drawMarkers();

  /* ── name normaliser (for runtime Overpass matching) ── */
  function normName(n) {
    return n.toLowerCase()
      .replace(/\\u0103/g,'a').replace(/\\u00e2/g,'a').replace(/\\u00ee/g,'i')
      .replace(/\\u0219/g,'s').replace(/\\u015f/g,'s')
      .replace(/\\u021b/g,'t').replace(/\\u0163/g,'t')
      .replace(/[-_]/g,' ').trim();
  }

  /* ── Overpass station node lookup (for unresolved only) ── */
  function fetchStationNodes(uncached, callback) {
    if (!NAMES_RX) { callback(); return; }
    setStatus('Se cauta statiile...');

    var query = '[out:json][timeout:20][bbox:43.5,20.0,48.3,30.5];'
              + '(node["railway"~"station|halt"]["name"~"' + NAMES_RX + '",i];);out;';

    fetch('https://overpass-api.de/api/interpreter', {
      method:'POST', body:'data='+encodeURIComponent(query),
      headers:{'Content-Type':'application/x-www-form-urlencoded'}
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      var osmNodes = [];
      (d.elements||[]).forEach(function(el){
        if (!el.tags || !el.tags.name) return;
        osmNodes.push({ lat: el.lat, lon: el.lon, name: el.tags.name, norm: normName(el.tags.name) });
      });

      uncached.forEach(function(s){
        var sIdx = STATIONS.indexOf(s);
        var sNorm = normName(s.name).replace(/^(gara|halta|statia) /, '').replace(/ (hc|hm|gr a|gr b)/g, '').trim();
        var sTokens = sNorm.split(' ').filter(function(x){ return x.length > 2 || x === sNorm; });

        // Find nearest resolved neighbors in the route to compute expected position
        var prevResolved = null, nextResolved = null;
        for (var pi = sIdx - 1; pi >= 0; pi--) {
          if (coordCache[STATIONS[pi].name]) { prevResolved = coordCache[STATIONS[pi].name]; break; }
        }
        for (var ni = sIdx + 1; ni < STATIONS.length; ni++) {
          if (coordCache[STATIONS[ni].name]) { nextResolved = coordCache[STATIONS[ni].name]; break; }
        }

        // Expected position: midpoint of neighbors (or whichever is available)
        var refLat, refLon;
        if (prevResolved && nextResolved) {
          refLat = (prevResolved.lat + nextResolved.lat) / 2;
          refLon = (prevResolved.lon + nextResolved.lon) / 2;
        } else if (prevResolved) {
          refLat = prevResolved.lat; refLon = prevResolved.lon;
        } else if (nextResolved) {
          refLat = nextResolved.lat; refLon = nextResolved.lon;
        } else {
          refLat = 45.9; refLon = 24.9; // Romania centroid fallback
        }

        var best = null, bestScore = -Infinity;
        osmNodes.forEach(function(node) {
          var nNorm = node.norm.replace(/^(gara|halta|statia) /, '').trim();
          var nameScore = 0;
          if (nNorm === sNorm) { nameScore = 100; }
          else {
            for (var ti = 0; ti < sTokens.length; ti++) {
              if (nNorm.indexOf(sTokens[ti]) !== -1) nameScore += 10;
            }
            nameScore -= Math.abs(nNorm.length - sNorm.length) * 0.5;
          }
          if (nameScore < 10) return; // Must match name first

          // Proximity score: prefer candidates close to expected route position
          // Use degrees-squared distance (smaller = better), scale to 0-50 bonus
          var dLat = node.lat - refLat, dLon = node.lon - refLon;
          var d2 = dLat*dLat + dLon*dLon; // degrees²
          // 1 degree ≈ 111km; d2 of 0.01 means ~11km off-route
          var proximityBonus = Math.max(0, 50 - d2 * 2000);
          var score = nameScore + proximityBonus;

          if (score > bestScore) { bestScore = score; best = node; }
        });
        if (best && bestScore >= 10) {
          coordCache[s.name] = { lat: best.lat, lon: best.lon };
        }
      });
      saveCoords();
      callback();
    })
    .catch(function(){ saveCoords(); callback(); });
  }

  /* ── Nominatim fallback ── */
  var nQueue = [], nQi = 0;
  var NBASE = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ro&q=';

  function nominatimNext() {
    if (nQi >= nQueue.length) {
      saveCoords(); drawMarkers();
      if (!solvedPath) buildStraightPath();
      if (!railSolved) fetchRailGeometry();
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

  /* ── main pipeline ── */
  function startGeocoding() {
    var uncached = STATIONS.filter(function(s){ return !coordCache[s.name]; });

    // Phase 1: Immediately render what we have
    drawMarkers();
    if (!solvedPath) buildStraightPath();

    // Phase 2: If all cached AND rail already solved, we're done
    if (uncached.length === 0 && railSolved) {
      setStatus(null);
      return;
    }

    // Phase 3: Resolve any uncached stations
    if (uncached.length > 0) {
      fetchStationNodes(uncached, function(){
        drawMarkers();
        nQueue = STATIONS.filter(function(s){ return !coordCache[s.name]; });
        nQi = 0;
        if (nQueue.length > 0) {
          nominatimNext();
        } else {
          // All resolved now — rebuild straight path & fetch rail geometry
          buildStraightPath();
          if (!railSolved) fetchRailGeometry();
        }
      });
    } else if (!railSolved) {
      // All coords known but rail not solved yet
      fetchRailGeometry();
    }
  }

  startGeocoding();

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
<\/script>
</body>
</html>`;
}
