// Dustline — player.js
// The player on foot and behind the wheel: movement, driving physics,
// stealing cars, punching and shooting, bullets and damage.

window.DL = window.DL || {};

(function () {
  function create(x, y) {
    return {
      x: x, y: y, angle: 0,
      speed: 0, onFoot: true, car: null,
      health: 100, money: 0, ammo: 24,
      wanted: 0, lastSeen: 0, decayT: 0,
      bustedT: 0, hurtT: 0,
      walkFrame: 0
    };
  }

  function nearestPed(state, x, y, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < state.peds.length; i++) {
      var p = state.peds[i];
      if (p.down) continue;
      var dx = p.x - x, dy = p.y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function fireBullet(state, fromX, fromY, angle) {
    state.bullets.push({
      x: fromX + Math.cos(angle) * 22,
      y: fromY + Math.sin(angle) * 22,
      angle: angle, speed: 900, life: 0.7
    });
    state.audio.shot();
    state.player.ammo--;
    addParticle(state, fromX + Math.cos(angle) * 26, fromY + Math.sin(angle) * 26, 'muzzle');
  }

  function punch(state) {
    var p = state.player;
    var range = 46;
    var hit = false;
    for (var i = 0; i < state.peds.length; i++) {
      var ped = state.peds[i];
      if (ped.down) continue;
      var dx = ped.x - p.x, dy = ped.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var angDiff = Math.abs(((Math.atan2(dy, dx) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < range && angDiff < 1.2) {
        ped.down = true; ped.downT = 6;
        addParticle(state, ped.x, ped.y, 'hit');
        hit = true;
      }
    }
    for (var j = 0; j < state.cars.length; j++) {
      var c = state.cars[j];
      var cdx = c.x - p.x, cdy = c.y - p.y;
      if (Math.sqrt(cdx * cdx + cdy * cdy) < range + 14) {
        c.hp -= 1;
        addParticle(state, c.x, c.y, 'hit');
        if (c.hp <= 0) { c.stopped = true; addParticle(state, c.x, c.y, 'smoke'); }
        hit = true;
      }
    }
    if (hit) state.audio.blip(180);
  }

  function addParticle(state, x, y, kind) {
    for (var i = 0; i < 10; i++) {
      var a = state.rng() * Math.PI * 2;
      var sp = 40 + state.rng() * 120;
      state.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + state.rng() * 0.4, max: 0.8,
        kind: kind,
        size: 2 + state.rng() * 3
      });
    }
  }

  function updateBullets(state, dt) {
    for (var i = state.bullets.length - 1; i >= 0; i--) {
      var b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      var dead = b.life <= 0;
      if (!dead) {
        // Hit a pedestrian.
        for (var p = 0; p < state.peds.length; p++) {
          var ped = state.peds[p];
          if (ped.down) continue;
          var dx = ped.x - b.x, dy = ped.y - b.y;
          if (dx * dx + dy * dy < 12 * 12) {
            ped.down = true; ped.downT = 8;
            addParticle(state, ped.x, ped.y, 'hit');
            window.DL.police.commitCrime(state, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        // Hit a car (traffic or police).
        var all = state.cars.concat(state.police);
        for (var c = 0; c < all.length; c++) {
          var car = all[c];
          var cdx = car.x - b.x, cdy = car.y - b.y;
          if (cdx * cdx + cdy * cdy < 22 * 22) {
            car.hp -= 1;
            addParticle(state, b.x, b.y, 'hit');
            if (car.police) window.DL.police.commitCrime(state, 1);
            if (car.hp <= 0) {
              car.stopped = true;
              addParticle(state, car.x, car.y, 'smoke');
              if (car.runner) window.DL.missions.onRunnerDisabled(state);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead && window.DL.city.hitsBuilding(state.city, b.x, b.y, 2)) {
        addParticle(state, b.x, b.y, 'hit');
        dead = true;
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updateParticles(state, dt) {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= (1 - 2 * dt);
      pt.vy *= (1 - 2 * dt);
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function enterCar(state, car) {
    var p = state.player;
    p.car = car;
    p.onFoot = false;
    car.parked = false;
    car.stopped = false;
    car.speed = 0;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    state.audio.blip(520);
    // Stealing a car is a crime.
    state.police.commitCrime(state, 1);
  }

  function exitCar(state) {
    var p = state.player;
    var car = p.car;
    if (!car) return;
    var sideX = car.x - Math.sin(car.angle) * 30;
    var sideY = car.y + Math.cos(car.angle) * 30;
    var fixed = window.DL.city.collideCircle(state.city, sideX, sideY, 12);
    p.x = fixed.x; p.y = fixed.y;
    p.angle = car.angle;
    p.speed = 0;
    p.onFoot = true;
    car.parked = true;
    car.speed = 0;
    p.car = null;
    state.audio.blip(420);
  }

  function update(state, dt, input) {
    var p = state.player;
    var city = state.city;
    p.hurtT = Math.max(0, p.hurtT - dt);

    // Enter / exit car on a fresh E press.
    if (input.pressed('KeyE')) {
      if (p.onFoot) {
        var car = window.DL.traffic.nearestCar(state, p.x, p.y, 60);
        if (car) enterCar(state, car);
      } else {
        exitCar(state);
      }
    }

    if (p.onFoot) {
      var mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) -
               (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      var my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) -
               (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        var len = Math.sqrt(mx * mx + my * my);
        mx /= len; my /= len;
        p.angle = Math.atan2(my, mx);
        p.x += mx * 210 * dt;
        p.y += my * 210 * dt;
        p.walkFrame += dt * 10;
        var fixed = window.DL.city.collideCircle(city, p.x, p.y, 12);
        p.x = fixed.x; p.y = fixed.y;
      }
      // Punch or shoot toward the mouse.
      if (input.pressed('mouse') || input.pressed('KeyF')) {
        var aim = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
        p.angle = aim;
        if (p.ammo > 0) fireBullet(state, p.x, p.y, aim);
        else punch(state);
      }
      // Walking into a pedestrian at speed is rude but not a crime.
    } else if (p.car) {
      var car = p.car;
      var fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) -
                (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      // Scene presets can cruise on their own so screenshots show motion.
      if (state.autoDrive && fwd === 0) fwd = 1;
      var steer = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) -
                  (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      var handbrake = input.down('Space');
      var topSpeed = car.kind === 'sport' ? 480 : car.kind === 'truck' ? 330 : 420;
      if (fwd > 0) car.speed += 300 * dt;
      else if (fwd < 0) car.speed -= (car.speed > 0 ? 420 : 200) * dt;
      else car.speed -= car.speed * 0.9 * dt;
      if (handbrake) {
        car.speed -= car.speed * 2.4 * dt;
      }
      if (car.speed > topSpeed) car.speed = topSpeed;
      if (car.speed < -90) car.speed = -90;
      var grip = handbrake ? 1.7 : 1;
      car.angle += steer * grip * (car.speed / 130) * dt * (car.speed < 0 ? -1 : 1);
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Building collision: slide and lose speed.
      if (window.DL.city.hitsBuilding(city, nx, ny, 20)) {
        var hitSpeed = Math.abs(car.speed);
        car.speed *= 0.35;
        if (hitSpeed > 140) {
          addParticle(state, nx, ny, 'hit');
          state.audio.crash();
          damagePlayer(state, Math.min(18, hitSpeed / 25));
        }
        var fx = window.DL.city.collideCircle(city, nx, ny, 20);
        nx = fx.x; ny = fx.y;
      }
      car.x = nx; car.y = ny;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;

      // Run over pedestrians.
      for (var i = 0; i < state.peds.length; i++) {
        var ped = state.peds[i];
        if (ped.down) continue;
        var dx = ped.x - car.x, dy = ped.y - car.y;
        if (dx * dx + dy * dy < 24 * 24 && Math.abs(car.speed) > 40) {
          ped.down = true; ped.downT = 8;
          addParticle(state, ped.x, ped.y, 'hit');
          window.DL.police.commitCrime(state, 1);
          state.audio.crash();
        }
      }
      // Bump traffic cars.
      for (var j = 0; j < state.cars.length; j++) {
        var other = state.cars[j];
        if (other === car) continue;
        var odx = other.x - car.x, ody = other.y - car.y;
        var od = Math.sqrt(odx * odx + ody * ody);
        if (od < 42 && od > 0.01) {
          var rel = Math.abs(car.speed - other.speed);
          var ux = odx / od, uy = ody / od;
          car.x -= ux * (42 - od) * 0.5;
          car.y -= uy * (42 - od) * 0.5;
          other.x += ux * (42 - od) * 0.5;
          other.y += uy * (42 - od) * 0.5;
          if (rel > 120) {
            car.speed *= 0.6;
            other.speed = car.speed * 0.4;
            other.hp -= 1;
            addParticle(state, other.x, other.y, 'hit');
            state.audio.crash();
            damagePlayer(state, Math.min(12, rel / 30));
          }
        }
      }
      // Shoot from the car window.
      if ((input.pressed('mouse') || input.pressed('KeyF')) && p.ammo > 0) {
        var aim2 = Math.atan2(input.mouseWorldY - car.y, input.mouseWorldX - car.x);
        fireBullet(state, car.x, car.y, aim2);
      }
    }

    // Health regen when calm.
    if (p.wanted === 0 && p.health < 100 && p.hurtT <= 0) {
      p.health = Math.min(100, p.health + 4 * dt);
    }
    if (p.health <= 0 && !state.over) {
      state.over = 'wasted';
      state.audio.siren(false);
    }

    updateBullets(state, dt);
    updateParticles(state, dt);
  }

  function damagePlayer(state, amount) {
    var p = state.player;
    if (p.hurtT > 0) return;
    p.health -= amount;
    p.hurtT = 0.6;
    if (p.health < 0) p.health = 0;
  }

  function draw(ctx, state) {
    var p = state.player;
    if (p.onFoot) {
      ctx.save();
      ctx.translate(p.x, p.y);
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(2, 3, 11, 0, Math.PI * 2);
      ctx.fill();
      // Body.
      ctx.fillStyle = '#2e86c1';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      // Facing wedge.
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 5, 0, Math.PI * 2);
      ctx.fill();
      // Pistol in hand.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
      ctx.lineTo(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18);
      ctx.stroke();
      if (p.hurtT > 0) {
        ctx.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (p.car) {
      window.DL.traffic.drawCar(ctx, p.car, true);
    }
  }

  function drawBullets(ctx, state) {
    for (var i = 0; i < state.bullets.length; i++) {
      var b = state.bullets[i];
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawParticles(ctx, state) {
    for (var i = 0; i < state.particles.length; i++) {
      var pt = state.particles[i];
      var a = Math.max(0, pt.life / pt.max);
      if (pt.kind === 'smoke') ctx.fillStyle = 'rgba(80,80,80,' + (a * 0.7) + ')';
      else if (pt.kind === 'muzzle') ctx.fillStyle = 'rgba(255,220,120,' + a + ')';
      else ctx.fillStyle = 'rgba(255,200,60,' + a + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1 + (1 - a)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  window.DL.player = {
    create: create,
    update: update,
    draw: draw,
    drawBullets: drawBullets,
    drawParticles: drawParticles,
    damagePlayer: damagePlayer,
    addParticle: addParticle,
    nearestPed: nearestPed
  };
})();
