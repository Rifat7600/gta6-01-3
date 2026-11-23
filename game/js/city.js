// Dustline — city.js
// The city of Dustline: roads, buildings, parks, water and districts.
// Everything is generated from a fixed seed, so the same seed always
// builds the same city. No external assets: all art is drawn shapes.

window.DL = window.DL || {};

(function () {
  var WORLD_W = 3600;
  var WORLD_H = 2600;
  var ROAD_W = 96;
  var LANE = 24;

  // Small deterministic PRNG (mulberry32) so the city never changes.
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  var ROOF_COLORS = [
    '#c98f5f', '#b87a4e', '#d9a066', '#a8673f',
    '#e0b183', '#8f6b4a', '#d8c49a', '#7d8aa0'
  ];
  var WALL_COLORS = [
    '#e8d9b8', '#dcc49a', '#cbb28a', '#e3cfa8',
    '#d9b98c', '#cfa97e'
  ];

  function build(seed) {
    var rng = makeRng(seed || 7);
    var vRoads = [300, 900, 1500, 2100, 2700, 3300];
    var hRoads = [300, 800, 1300, 1800, 2300];
    var buildings = [];
    var parks = [];
    var trees = [];
    var labels = [
      { x: 600, y: 550, text: 'KESTREL FLATS' },
      { x: 1800, y: 550, text: 'OLD MILL ROW' },
      { x: 600, y: 1550, text: 'CACTUS GARDENS' },
      { x: 1800, y: 1550, text: 'THE YARDS' },
      { x: 3000, y: 1050, text: 'HARBORLIGHT' },
      { x: 2400, y: 2050, text: 'SOUTH DOCK' }
    ];

    // Water: a lake in the south-east corner and a small pond in a park.
    var water = [
      { x: 2920, y: 1920, w: 560, h: 560 },
      { x: 620, y: 1820, w: 180, h: 120 }
    ];

    // Parks occupy whole blocks so cars and buildings never sit on them.
    var parkBlocks = [
      { x: 948, y: 848, w: 504, h: 404 },
      { x: 2148, y: 348, w: 504, h: 404 },
      { x: 1548, y: 1848, w: 504, h: 404 }
    ];
    for (var p = 0; p < parkBlocks.length; p++) {
      var pb = parkBlocks[p];
      parks.push(pb);
      var treeCount = 14 + Math.floor(rng() * 8);
      for (var t = 0; t < treeCount; t++) {
        trees.push({
          x: pb.x + 30 + rng() * (pb.w - 60),
          y: pb.y + 30 + rng() * (pb.h - 60),
          r: 12 + rng() * 10
        });
      }
    }

    function inPark(x, y, w, h) {
      for (var i = 0; i < parkBlocks.length; i++) {
        var pb = parkBlocks[i];
        if (x < pb.x + pb.w && x + w > pb.x && y < pb.y + pb.h && y + h > pb.y) return true;
      }
      return false;
    }
    function inWater(x, y, w, h) {
      for (var i = 0; i < water.length; i++) {
        var wt = water[i];
        if (x < wt.x + wt.w && x + w > wt.x && y < wt.y + wt.h && y + h > wt.y) return true;
      }
      return false;
    }

    // Buildings fill the blocks between roads, leaving a sidewalk margin.
    for (var vi = 0; vi < vRoads.length - 1; vi++) {
      for (var hi = 0; hi < hRoads.length - 1; hi++) {
        var bx0 = vRoads[vi] + ROAD_W / 2 + 26;
        var by0 = hRoads[hi] + ROAD_W / 2 + 26;
        var bx1 = vRoads[vi + 1] - ROAD_W / 2 - 26;
        var by1 = hRoads[hi + 1] - ROAD_W / 2 - 26;
        var bw = bx1 - bx0;
        var bh = by1 - by0;
        if (bw < 120 || bh < 120) continue;
        // Skip the lake block.
        if (bx0 > 2850 && by0 > 1850) continue;
        var downtown = (vi === 2 && hi === 1) || (vi === 2 && hi === 2);
        var count = downtown ? 1 : 1 + Math.floor(rng() * 3);
        for (var b = 0; b < count; b++) {
          var w = 140 + rng() * Math.min(220, bw - 160);
          var h = 120 + rng() * Math.min(200, bh - 140);
          var x = bx0 + rng() * Math.max(1, bw - w);
          var y = by0 + rng() * Math.max(1, bh - h);
          if (inPark(x, y, w, h) || inWater(x, y, w, h)) continue;
          var floors = downtown ? 3 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
          buildings.push({
            x: x, y: y, w: w, h: h,
            roof: pick(rng, ROOF_COLORS),
            wall: pick(rng, WALL_COLORS),
            floors: floors,
            downtown: downtown,
            vents: Math.floor(rng() * 3)
          });
        }
      }
    }

    return {
      w: WORLD_W, h: WORLD_H,
      vRoads: vRoads, hRoads: hRoads,
      roadW: ROAD_W, lane: LANE,
      buildings: buildings, parks: parks, trees: trees,
      water: water, labels: labels,
      // Handy named places used by missions and scenes.
      places: {
        garage: { x: 600, y: 1300, label: 'Kestrel Garage' },
        market: { x: 900, y: 800, label: 'Old Mill Market' },
        dock: { x: 3150, y: 1300, label: 'Harborlight Dock' },
        safehouse: { x: 1200, y: 1800, label: 'Cactus Safehouse' },
        plaza: { x: 1500, y: 1300, label: 'Mill Plaza' }
      }
    };
  }

  // Push a circle out of every building and the world edge.
  function collideCircle(city, x, y, r) {
    if (x < r) x = r;
    if (y < r) y = r;
    if (x > city.w - r) x = city.w - r;
    if (y > city.h - r) y = city.h - r;
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var nx = Math.max(b.x, Math.min(x, b.x + b.w));
      var ny = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - nx, dy = y - ny;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) { x = b.x - r; continue; }
        var d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      }
    }
    return { x: x, y: y };
  }

  function hitsBuilding(city, x, y, r) {
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var nx = Math.max(b.x, Math.min(x, b.x + b.w));
      var ny = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - nx, dy = y - ny;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  function inWaterAt(city, x, y) {
    for (var i = 0; i < city.water.length; i++) {
      var w = city.water[i];
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
    }
    return false;
  }

  function nearestRoadPoint(city, x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < city.vRoads.length; i++) {
      var d = Math.abs(x - city.vRoads[i]);
      if (d < bestD) { bestD = d; best = { x: city.vRoads[i], y: y, axis: 'v' }; }
    }
    for (var j = 0; j < city.hRoads.length; j++) {
      var d2 = Math.abs(y - city.hRoads[j]);
      if (d2 < bestD) { bestD = d2; best = { x: x, y: city.hRoads[j], axis: 'h' }; }
    }
    return best;
  }

  function drawGround(ctx, city, cam, vw, vh) {
    var x0 = Math.max(0, cam.x - vw / 2 - 60);
    var y0 = Math.max(0, cam.y - vh / 2 - 60);
    var x1 = Math.min(city.w, cam.x + vw / 2 + 60);
    var y1 = Math.min(city.h, cam.y + vh / 2 + 60);

    // Dusty desert ground.
    ctx.fillStyle = '#d9b98a';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Faint sand texture: speckles.
    ctx.fillStyle = 'rgba(120, 90, 50, 0.10)';
    for (var s = 0; s < 120; s++) {
      var sx = x0 + ((s * 397) % Math.max(1, (x1 - x0)));
      var sy = y0 + ((s * 733) % Math.max(1, (y1 - y0)));
      ctx.fillRect(sx, sy, 3, 3);
    }

    // Parks.
    for (var p = 0; p < city.parks.length; p++) {
      var pk = city.parks[p];
      ctx.fillStyle = '#7da95c';
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = '#8fb96e';
      ctx.fillRect(pk.x + 8, pk.y + 8, pk.w - 16, pk.h - 16);
    }
    // Water.
    for (var w = 0; w < city.water.length; w++) {
      var wt = city.water[w];
      ctx.fillStyle = '#4f8fb5';
      ctx.fillRect(wt.x, wt.y, wt.w, wt.h);
      ctx.fillStyle = '#6fa8c8';
      ctx.fillRect(wt.x + 10, wt.y + 10, wt.w - 20, wt.h - 20);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wt.x + 20, wt.y + wt.h * 0.3);
      ctx.lineTo(wt.x + wt.w - 20, wt.y + wt.h * 0.3);
      ctx.moveTo(wt.x + 40, wt.y + wt.h * 0.6);
      ctx.lineTo(wt.x + wt.w - 60, wt.y + wt.h * 0.6);
      ctx.stroke();
    }

    // Roads: dark asphalt with pale sidewalks.
    var i, r;
    for (i = 0; i < city.vRoads.length; i++) {
      r = city.vRoads[i];
      ctx.fillStyle = '#b7a586';
      ctx.fillRect(r - city.roadW / 2 - 14, y0, city.roadW + 28, y1 - y0);
      ctx.fillStyle = '#3d3a38';
      ctx.fillRect(r - city.roadW / 2, y0, city.roadW, y1 - y0);
    }
    for (i = 0; i < city.hRoads.length; i++) {
      r = city.hRoads[i];
      ctx.fillStyle = '#b7a586';
      ctx.fillRect(x0, r - city.roadW / 2 - 14, x1 - x0, city.roadW + 28);
      ctx.fillStyle = '#3d3a38';
      ctx.fillRect(x0, r - city.roadW / 2, x1 - x0, city.roadW);
    }

    // Centre dashes.
    ctx.fillStyle = '#e8d878';
    for (i = 0; i < city.vRoads.length; i++) {
      r = city.vRoads[i];
      for (var y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        ctx.fillRect(r - 2, y, 4, 22);
      }
    }
    for (i = 0; i < city.hRoads.length; i++) {
      r = city.hRoads[i];
      for (var x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        ctx.fillRect(x, r - 2, 22, 4);
      }
    }

    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(240, 235, 220, 0.85)';
    for (i = 0; i < city.vRoads.length; i++) {
      for (var j = 0; j < city.hRoads.length; j++) {
        var cx = city.vRoads[i], cy = city.hRoads[j];
        for (var k = -2; k <= 2; k++) {
          ctx.fillRect(cx + k * 16 - 5, cy - city.roadW / 2 - 8, 10, 8);
          ctx.fillRect(cx + k * 16 - 5, cy + city.roadW / 2, 10, 8);
        }
      }
    }

    // Trees.
    for (var t = 0; t < city.trees.length; t++) {
      var tr = city.trees[t];
      ctx.fillStyle = '#5d7d43';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f9a52';
      ctx.beginPath();
      ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // District labels.
    ctx.fillStyle = 'rgba(90, 70, 45, 0.55)';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    for (var l = 0; l < city.labels.length; l++) {
      var lb = city.labels[l];
      ctx.fillText(lb.text, lb.x, lb.y);
    }
    ctx.textAlign = 'left';
  }

  function drawBuildings(ctx, city, cam, vw, vh) {
    var x0 = cam.x - vw / 2 - 120;
    var y0 = cam.y - vh / 2 - 120;
    var x1 = cam.x + vw / 2 + 120;
    var y1 = cam.y + vh / 2 + 120;
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      // Soft shadow.
      ctx.fillStyle = 'rgba(60, 40, 20, 0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      // Walls then roof.
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.strokeStyle = 'rgba(70, 50, 30, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Roof vents / AC units.
      ctx.fillStyle = 'rgba(90, 90, 95, 0.8)';
      for (var v = 0; v < b.vents; v++) {
        ctx.fillRect(b.x + 16 + v * 26, b.y + 16, 16, 12);
      }
      // Windows on taller downtown blocks.
      if (b.downtown) {
        ctx.fillStyle = 'rgba(40, 60, 90, 0.55)';
        for (var wy = b.y + 22; wy < b.y + b.h - 16; wy += 24) {
          for (var wx = b.x + 18; wx < b.x + b.w - 16; wx += 26) {
            ctx.fillRect(wx, wy, 12, 14);
          }
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText('DUSTLINE TOWER', b.x + 12, b.y + b.h - 10);
      }
    }
  }

  window.DL.city = {
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    makeRng: makeRng,
    build: build,
    collideCircle: collideCircle,
    hitsBuilding: hitsBuilding,
    inWaterAt: inWaterAt,
    nearestRoadPoint: nearestRoadPoint,
    drawGround: drawGround,
    drawBuildings: drawBuildings
  };
})();
