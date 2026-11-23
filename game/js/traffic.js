// Dustline — traffic.js
// Traffic cars that follow the road grid, pedestrians on the sidewalks,
// parked cars, and all car rendering.

window.DL = window.DL || {};

(function () {
  var CAR_COLORS = [
    '#c0392b', '#2e6fb0', '#e0a030', '#7a8a99', '#3f8f5f',
    '#8e44ad', '#dfe3e6', '#2b2b2b', '#c96a2e', '#4a7d8c'
  ];

  function lanePos(city, axis, coord, dir) {
    // Right-hand traffic: offset to the right of the direction of travel.
    if (axis === 'v') return { x: coord + (dir > 0 ? city.lane : -city.lane), y: 0 };
    return { x: 0, y: coord + (dir > 0 ? city.lane : -city.lane) };
  }

  function makeCar(city, rng, opts) {
    opts = opts || {};
    var axis = opts.axis || (rng() < 0.5 ? 'v' : 'h');
    var coord, dir = rng() < 0.5 ? 1 : -1;
    var pos;
    if (axis === 'v') {
      coord = city.vRoads[Math.floor(rng() * city.vRoads.length)];
      pos = { x: coord + (dir > 0 ? city.lane : -city.lane), y: rng() * city.h };
    } else {
      coord = city.hRoads[Math.floor(rng() * city.hRoads.length)];
      pos = { x: rng() * city.w, y: coord + (dir > 0 ? city.lane : -city.lane) };
    }
    return {
      x: opts.x !== undefined ? opts.x : pos.x,
      y: opts.y !== undefined ? opts.y : pos.y,
      angle: axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: opts.speed !== undefined ? opts.speed : 60 + rng() * 55,
      maxSpeed: opts.maxSpeed || 115,
      axis: axis, coord: coord, dir: dir,
      color: opts.color || CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      kind: opts.kind || 'sedan',
      hp: opts.hp || 3,
      stopped: !!opts.stopped,
      runner: !!opts.runner,
      police: false,
      turnCooldown: 0
    };
  }

  function makeParkedCar(city, rng, x, y, angle) {
    return {
      x: x, y: y, angle: angle,
      speed: 0, maxSpeed: 0, axis: 'h', coord: 0, dir: 1,
      color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
      kind: rng() < 0.2 ? 'taxi' : 'sedan',
      hp: 3, stopped: true, parked: true, runner: false, police: false,
      turnCooldown: 0
    };
  }

  function spawnTraffic(state, count) {
    var rng = state.rng;
    var city = state.city;
    for (var i = 0; i < count; i++) {
      state.cars.push(makeCar(city, rng));
    }
    // A few parked cars along the roads for the player to steal.
    var spots = [
      { x: 1524, y: 760, a: 0 }, { x: 924, y: 1276, a: Math.PI },
      { x: 2124, y: 1776, a: 0 }, { x: 276, y: 1824, a: Math.PI / 2 },
      { x: 3324, y: 824, a: -Math.PI / 2 }, { x: 876, y: 2324, a: 0 }
    ];
    for (var s = 0; s < spots.length; s++) {
      state.cars.push(makeParkedCar(city, rng, spots[s].x, spots[s].y, spots[s].a));
    }
  }

  function spawnPeds(state, count) {
    var rng = state.rng;
    var city = state.city;
    for (var i = 0; i < count; i++) {
      var rp = window.DL.city.nearestRoadPoint(city, rng() * city.w, rng() * city.h);
      state.peds.push({
        x: rp.x + (rng() - 0.5) * 160,
        y: rp.y + (rng() - 0.5) * 160,
        tx: rp.x, ty: rp.y,
        speed: 28 + rng() * 22,
        color: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'][Math.floor(rng() * 6)],
        angle: rng() * Math.PI * 2,
        down: false, downT: 0
      });
    }
  }

  function carAhead(state, car, dist) {
    var best = null, bestD = dist;
    for (var i = 0; i < state.cars.length; i++) {
      var o = state.cars[i];
      if (o === car || o === state.player.car) continue;
      var dx = o.x - car.x, dy = o.y - car.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        var dot = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / (d || 1);
        if (dot > 0.6) { best = o; bestD = d; }
      }
    }
    return best;
  }

  function updateCars(state, dt) {
    var city = state.city;
    var rng = state.rng;
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      if (c === state.player.car) continue;
      if (c.parked || c.stopped) continue;
      c.turnCooldown -= dt;
      // Slow down for the car ahead.
      var ahead = carAhead(state, c, 70);
      var target = ahead ? 0 : c.maxSpeed;
      if (c.runner) target = 165;
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);

      // At an intersection, sometimes turn onto the cross road.
      var nearCross = null;
      if (c.axis === 'v') {
        for (var h = 0; h < city.hRoads.length; h++) {
          if (Math.abs(c.y - city.hRoads[h]) < 26) { nearCross = city.hRoads[h]; break; }
        }
      } else {
        for (var v = 0; v < city.vRoads.length; v++) {
          if (Math.abs(c.x - city.vRoads[v]) < 26) { nearCross = city.vRoads[v]; break; }
        }
      }
      if (nearCross !== null && c.turnCooldown <= 0 && rng() < 0.35) {
        if (c.runner) {
          // The runner turns away from the player.
          var px = state.player.x, py = state.player.y;
          if (c.axis === 'v') {
            c.axis = 'h'; c.coord = nearCross;
            c.dir = (py > c.y) ? -1 : 1;
            c.y = nearCross + (c.dir > 0 ? city.lane : -city.lane);
          } else {
            c.axis = 'v'; c.coord = nearCross;
            c.dir = (px > c.x) ? -1 : 1;
            c.x = nearCross + (c.dir > 0 ? city.lane : -city.lane);
          }
        } else if (rng() < 0.5) {
          if (c.axis === 'v') {
            c.axis = 'h'; c.coord = nearCross;
            c.dir = rng() < 0.5 ? 1 : -1;
            c.y = nearCross + (c.dir > 0 ? city.lane : -city.lane);
          } else {
            c.axis = 'v'; c.coord = nearCross;
            c.dir = rng() < 0.5 ? 1 : -1;
            c.x = nearCross + (c.dir > 0 ? city.lane : -city.lane);
          }
        }
        c.turnCooldown = 2;
        c.angle = c.axis === 'v'
          ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (c.dir > 0 ? 0 : Math.PI);
      }

      // Drive along the current road.
      if (c.axis === 'v') {
        c.y += c.dir * c.speed * dt;
        c.x += (c.coord + (c.dir > 0 ? city.lane : -city.lane) - c.x) * Math.min(1, dt * 3);
        if (c.y < 40) { c.y = 40; c.dir = 1; c.angle = Math.PI / 2; }
        if (c.y > city.h - 40) { c.y = city.h - 40; c.dir = -1; c.angle = -Math.PI / 2; }
      } else {
        c.x += c.dir * c.speed * dt;
        c.y += (c.coord + (c.dir > 0 ? city.lane : -city.lane) - c.y) * Math.min(1, dt * 3);
        if (c.x < 40) { c.x = 40; c.dir = 1; c.angle = 0; }
        if (c.x > city.w - 40) { c.x = city.w - 40; c.dir = -1; c.angle = Math.PI; }
      }
    }

    // Gentle separation between traffic cars.
    for (var a = 0; a < state.cars.length; a++) {
      for (var b = a + 1; b < state.cars.length; b++) {
        var ca = state.cars[a], cb = state.cars[b];
        var dx = cb.x - ca.x, dy = cb.y - ca.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 38 * 38 && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var push = (38 - d) / 2;
          var ux = dx / d, uy = dy / d;
          if (ca !== state.player.car) { ca.x -= ux * push; ca.y -= uy * push; }
          if (cb !== state.player.car) { cb.x += ux * push; cb.y += uy * push; }
        }
      }
    }
  }

  function updatePeds(state, dt) {
    var city = state.city;
    var rng = state.rng;
    var px = state.player.x, py = state.player.y;
    var playerCar = state.player.car;
    for (var i = 0; i < state.peds.length; i++) {
      var p = state.peds[i];
      if (p.down) {
        p.downT -= dt;
        if (p.downT <= 0) { p.down = false; }
        continue;
      }
      var dx = p.tx - p.x, dy = p.ty - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      // Flee a speeding car nearby.
      var threat = null;
      if (playerCar && Math.abs(playerCar.speed) > 60) threat = playerCar;
      if (threat) {
        var tdx = p.x - threat.x, tdy = p.y - threat.y;
        var td = Math.sqrt(tdx * tdx + tdy * tdy);
        if (td < 110) {
          p.tx = p.x + (tdx / (td || 1)) * 220;
          p.ty = p.y + (tdy / (td || 1)) * 220;
          dx = p.tx - p.x; dy = p.ty - p.y; d = Math.sqrt(dx * dx + dy * dy);
        }
      }
      if (d < 12) {
        var rp = window.DL.city.nearestRoadPoint(city, p.x + (rng() - 0.5) * 500, p.y + (rng() - 0.5) * 500);
        p.tx = rp.x + (rng() - 0.5) * 200;
        p.ty = rp.y + (rng() - 0.5) * 200;
      } else {
        p.angle = Math.atan2(dy, dx);
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        var fixed = window.DL.city.collideCircle(city, p.x, p.y, 8);
        p.x = fixed.x; p.y = fixed.y;
      }
    }
  }

  function drawCar(ctx, c, highlight) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-22, -11, 44, 24);
    // Body.
    var len = c.kind === 'truck' ? 52 : 42;
    var wid = c.kind === 'truck' ? 22 : 20;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
    ctx.fill();
    // Roof / cabin.
    ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-len / 2 + 10, -wid / 2 + 4, len / 2 - 6, wid - 8, 4);
    ctx.fill();
    if (c.kind === 'taxi') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(-4, -wid / 2, 8, wid);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -wid / 2 - 4);
      ctx.textAlign = 'left';
    }
    if (c.kind === 'truck') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, 10, wid - 4);
    }
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
    ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
    // Police light bar.
    if (c.police) {
      var t = Date.now() / 180;
      ctx.fillStyle = (Math.floor(t) % 2 === 0) ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-6, -wid / 2 - 3, 12, 5);
      ctx.fillStyle = (Math.floor(t) % 2 === 0) ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-6, wid / 2 - 2, 12, 5);
      ctx.fillStyle = '#f4f4f4';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      ctx.textAlign = 'left';
    }
    if (c.runner) {
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8);
    }
    if (highlight) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-len / 2 - 6, -wid / 2 - 6, len + 12, wid + 12);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawPeds(ctx, state) {
    for (var i = 0; i < state.peds.length; i++) {
      var p = state.peds[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.down) {
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-9, -4, 18, 8);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(2, 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8b98a';
        ctx.beginPath();
        ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function nearestCar(state, x, y, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      if (c.police) continue;
      var dx = c.x - x, dy = c.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  window.DL.traffic = {
    makeCar: makeCar,
    makeParkedCar: makeParkedCar,
    spawnTraffic: spawnTraffic,
    spawnPeds: spawnPeds,
    updateCars: updateCars,
    updatePeds: updatePeds,
    drawCar: drawCar,
    drawPeds: drawPeds,
    nearestCar: nearestCar,
    lanePos: lanePos
  };
})();
