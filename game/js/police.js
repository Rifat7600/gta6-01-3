// Dustline — police.js
// The wanted level and the Dustline PD: patrol cars spawn, chase the
// player, and lose the trail when the player stays out of sight.

window.DL = window.DL || {};

(function () {
  function commitCrime(state, stars) {
    var p = state.player;
    if (p.wanted >= 5) return;
    p.wanted = Math.min(5, p.wanted + stars);
    p.lastSeen = 0;
    p.decayT = 0;
    state.stats.crimes += 1;
  }

  function spawnPoliceCar(state) {
    var city = state.city;
    var rng = state.rng;
    var p = state.player;
    // Spawn on a road a little way off-screen, roughly toward the player.
    var angle = rng() * Math.PI * 2;
    var dist = 700 + rng() * 300;
    var x = p.x + Math.cos(angle) * dist;
    var y = p.y + Math.sin(angle) * dist;
    x = Math.max(60, Math.min(city.w - 60, x));
    y = Math.max(60, Math.min(city.h - 60, y));
    var rp = window.DL.city.nearestRoadPoint(city, x, y);
    var car = {
      x: rp.x, y: rp.y, angle: 0,
      speed: 0, maxSpeed: 430,
      color: '#1c1c1c', kind: 'sedan',
      hp: 4, stopped: false, parked: false,
      runner: false, police: true, turnCooldown: 0,
      axis: rp.axis, coord: rp.axis === 'v' ? rp.x : rp.y, dir: 1
    };
    state.police.push(car);
    return car;
  }

  function update(state, dt) {
    var p = state.player;
    var city = state.city;

    // Wanted count the police want on the street.
    var wantCount = p.wanted === 0 ? 0 : Math.min(p.wanted + 1, 5);
    while (state.police.length < wantCount) spawnPoliceCar(state);
    while (state.police.length > wantCount) state.police.pop();

    // Has any police car seen the player recently?
    var seen = false;
    for (var i = 0; i < state.police.length; i++) {
      var pc = state.police[i];
      var dx = p.x - pc.x, dy = p.y - pc.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 560) seen = true;
    }
    if (seen) {
      p.lastSeen = 0;
      p.decayT = 0;
    } else {
      p.lastSeen += dt;
      // Laying low near the safehouse clears heat faster.
      var safe = state.city.places.safehouse;
      var nearSafe = Math.sqrt((p.x - safe.x) * (p.x - safe.x) + (p.y - safe.y) * (p.y - safe.y)) < 220;
      p.decayT += dt * (nearSafe ? 2.5 : 1);
      if (p.wanted > 0 && p.decayT > 9) {
        p.wanted -= 1;
        p.decayT = 0;
        if (p.wanted === 0) state.police.length = 0;
      }
    }

    // Chase behaviour: steer toward the player, faster as heat rises.
    var topSpeed = 300 + p.wanted * 32;
    for (var j = 0; j < state.police.length; j++) {
      var car = state.police[j];
      if (car.stopped) continue;
      var tdx = p.x - car.x, tdy = p.y - car.y;
      var td = Math.sqrt(tdx * tdx + tdy * tdy);
      var targetAngle = Math.atan2(tdy, tdx);
      var diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      car.speed += (topSpeed - car.speed) * Math.min(1, dt * 1.2);
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!window.DL.city.hitsBuilding(city, nx, ny, 20)) {
        car.x = nx; car.y = ny;
      } else {
        // Bounce off the building and keep chasing.
        car.angle += Math.PI * 0.7;
        car.speed *= 0.5;
        var fixed = window.DL.city.collideCircle(city, car.x, car.y, 20);
        car.x = fixed.x; car.y = fixed.y;
      }

      // Ram the player.
      if (td < 46) {
        if (p.onFoot) {
          p.bustedT += dt;
          if (p.bustedT > 1.2 && p.wanted >= 1 && !state.over) {
            state.over = 'busted';
            state.audio.siren(false);
          }
        } else if (p.car) {
          var impact = Math.abs(car.speed - p.car.speed);
          if (impact > 90) {
            window.DL.player.damagePlayer(state, Math.min(16, impact / 28));
            p.car.speed *= 0.7;
            state.player.addParticle(state, p.car.x, p.car.y, 'hit');
            state.audio.crash();
            car.speed *= 0.6;
          }
          // Shove the player's car.
          p.car.x += (tdx / (td || 1)) * 6;
          p.car.y += (tdy / (td || 1)) * 6;
        }
      }
    }
    if (!seen && p.onFoot) p.bustedT = Math.max(0, p.bustedT - dt * 2);

    // Siren when the law is close.
    var near = false;
    for (var k = 0; k < state.police.length; k++) {
      var pc2 = state.police[k];
      var ddx = p.x - pc2.x, ddy = p.y - pc2.y;
      if (ddx * ddx + ddy * ddy < 700 * 700) { near = true; break; }
    }
    state.audio.siren(near && p.wanted > 0);
  }

  function draw(state, ctx) {
    for (var i = 0; i < state.police.length; i++) {
      window.DL.traffic.drawCar(ctx, state.police[i], false);
    }
  }

  window.DL.police = {
    commitCrime: commitCrime,
    update: update,
    draw: draw
  };
})();
