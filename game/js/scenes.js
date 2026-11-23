// Dustline — scenes.js
// URL scene presets (?scene=cover|chase|mission|foot) so screenshots
// are deterministic: each one sets the exact player, car, wanted level,
// police and mission state for that shot.

window.DL = window.DL || {};

(function () {
  function fromURL() {
    var params = new URLSearchParams(window.location.search);
    return {
      scene: params.get('scene') || params.get('shot') || null,
      seed: parseInt(params.get('seed') || '7', 10) || 7
    };
  }

  function putInCar(state, x, y, angle, speed, color, kind) {
    var car = {
      x: x, y: y, angle: angle, speed: speed, maxSpeed: 480,
      color: color || '#c0392b', kind: kind || 'sport',
      hp: 3, stopped: false, parked: false,
      runner: false, police: false, turnCooldown: 0,
      axis: 'h', coord: y, dir: 1
    };
    state.cars.push(car);
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = x;
    state.player.y = y;
    state.player.angle = angle;
    state.player.speed = speed;
    return car;
  }

  function placeTrafficNear(state, cx, cy, count) {
    var rng = state.rng;
    var city = state.city;
    for (var i = 0; i < count; i++) {
      var car = window.DL.traffic.makeCar(city, rng);
      // Pull some cars near the camera focus.
      if (i < Math.min(count, 6)) {
        var rp = window.DL.city.nearestRoadPoint(city, cx + (rng() - 0.5) * 900, cy + (rng() - 0.5) * 500);
        car.x = rp.x;
        car.y = rp.y;
      }
      state.cars.push(car);
    }
  }

  function apply(state, name) {
    var city = state.city;
    var p = state.player;
    state.started = true;
    state.hintT = 0;
    state.timeMin = 720; // Midday.

    if (name === 'cover') {
      // Driving west down Mill Plaza road toward the garage, traffic around.
      putInCar(state, 1350, 1276, Math.PI, 210, '#c0392b', 'sport');
      placeTrafficNear(state, 1500, 1300, 10);
      window.DL.missions.startMission(state, 0);
      state.autoDrive = true;
      p.ammo = 24;
      p.money = 0;
    } else if (name === 'chase') {
      // Three-star pursuit: player speeding away, three PD cars on the tail.
      putInCar(state, 1500, 1324, 0, 360, '#2e6fb0', 'sport');
      placeTrafficNear(state, 1500, 1300, 6);
      window.DL.missions.startMission(state, 3);
      state.autoDrive = true;
      p.money = 450;
      p.ammo = 18;
      for (var i = 0; i < 3; i++) {
        var pc = {
          x: 1500 - 180 - i * 110, y: 1324 + (i % 2 === 0 ? 26 : -26),
          angle: 0, speed: 330 + i * 10, maxSpeed: 430,
          color: '#1c1c1c', kind: 'sedan', hp: 4,
          stopped: false, parked: false, runner: false, police: true,
          turnCooldown: 0, axis: 'h', coord: 1324, dir: 1
        };
        state.police.push(pc);
      }
    } else if (name === 'mission') {
      // On foot at Old Mill Market, package marker live, a parked car nearby.
      p.x = 830; p.y = 860; p.angle = Math.PI / 4;
      p.onFoot = true; p.car = null;
      p.ammo = 24; p.money = 150;
      window.DL.missions.startMission(state, 1);
      window.DL.traffic.spawnPeds(state, 6);
      state.cars.push(window.DL.traffic.makeParkedCar(city, state.rng, 924, 1276, Math.PI));
      placeTrafficNear(state, 900, 800, 4);
    } else if (name === 'foot') {
      // On-foot action on a sidewalk: pedestrians, parked cars, pistol ready.
      p.x = 1524; p.y = 856; p.angle = -Math.PI / 2;
      p.onFoot = true; p.car = null;
      p.ammo = 24; p.money = 0;
      window.DL.missions.startMission(state, 0);
      window.DL.traffic.spawnPeds(state, 10);
      state.cars.push(window.DL.traffic.makeParkedCar(city, state.rng, 1524, 760, 0));
      state.cars.push(window.DL.traffic.makeParkedCar(city, state.rng, 1476, 760, 0));
      placeTrafficNear(state, 1500, 800, 5);
    }
    // Camera snaps to the player at once for a stable first frame.
    state.cam.x = p.x;
    state.cam.y = p.y;
  }

  window.DL.scenes = {
    fromURL: fromURL,
    apply: apply
  };
})();
