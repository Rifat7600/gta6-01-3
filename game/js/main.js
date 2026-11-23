// Dustline — main.js
// Game loop, input, camera, save/load and the state that ties every
// module together. Loaded last; boots the game.

window.DL = window.DL || {};

(function () {
  var SAVE_KEY = 'dustline-save-v1';
  var VW = 1280, VH = 720;

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return { money: s.money || 0, done: s.done || 0, muted: !!s.muted };
    } catch (e) {
      return null;
    }
  }

  function newState(seed) {
    var city = window.DL.city.build(seed);
    var rng = window.DL.city.makeRng(seed * 31 + 11);
    var save = loadSave();
    var state = {
      city: city,
      rng: rng,
      seed: seed,
      player: window.DL.player.create(1524, 1420),
      cars: [],
      peds: [],
      police: [],
      bullets: [],
      particles: [],
      pickups: [],
      mission: window.DL.missions.create(),
      cam: { x: 1524, y: 1420 },
      timeMin: 720,
      started: false,
      paused: false,
      over: null,
      autoDrive: false,
      hintT: 0,
      stats: { crimes: 0 },
      audio: window.DL.audio.create()
    };
    // Save helper: missions call state.save() when one completes.
    state.save = function () {
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify({
          money: state.player.money,
          done: state.mission.done,
          muted: state.audio.muted
        }));
      } catch (e) { /* storage unavailable */ }
    };
    // Ammo and health pickups around the city.
    var pickupSpots = [
      { x: 1560, y: 760, kind: 'ammo' },
      { x: 960, y: 1330, kind: 'ammo' },
      { x: 2160, y: 830, kind: 'health' },
      { x: 2760, y: 1830, kind: 'ammo' },
      { x: 330, y: 1830, kind: 'health' },
      { x: 2130, y: 2330, kind: 'ammo' }
    ];
    for (var i = 0; i < pickupSpots.length; i++) {
      state.pickups.push({
        x: pickupSpots[i].x, y: pickupSpots[i].y,
        kind: pickupSpots[i].kind, taken: false
      });
    }
    window.DL.traffic.spawnTraffic(state, 12);
    window.DL.traffic.spawnPeds(state, 14);
    if (save) {
      state.player.money = save.money;
      state.mission.done = save.done;
      state.mission.index = Math.min(save.done, 4);
      state.audio.muted = save.muted;
      if (save.done > 0 && save.done < 4) state.mission.nextT = 2;
    }
    return state;
  }

  function makeInput(canvas) {
    var input = {
      keys: {},
      pressedKeys: {},
      mouseX: VW / 2, mouseY: VH / 2,
      mouseWorldX: 0, mouseWorldY: 0,
      mousePressed: false,
      down: function (code) { return !!this.keys[code]; },
      pressed: function (code) {
        if (code === 'mouse') return this.mousePressed;
        return !!this.pressedKeys[code];
      },
      endFrame: function () {
        this.pressedKeys = {};
        this.mousePressed = false;
      }
    };
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      if (!e.repeat) input.pressedKeys[e.code] = true;
      input.keys[e.code] = true;
    });
    window.addEventListener('keyup', function (e) {
      input.keys[e.code] = false;
    });
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      input.mouseX = (e.clientX - rect.left) * (VW / rect.width);
      input.mouseY = (e.clientY - rect.top) * (VH / rect.height);
    });
    canvas.addEventListener('mousedown', function (e) {
      var rect = canvas.getBoundingClientRect();
      input.mouseX = (e.clientX - rect.left) * (VW / rect.width);
      input.mouseY = (e.clientY - rect.top) * (VH / rect.height);
      input.mousePressed = true;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return input;
  }

  function restartMission(state) {
    var m = state.mission;
    // Remove the runner's car if one is out.
    if (m.runner) {
      var idx = state.cars.indexOf(m.runner);
      if (idx >= 0) state.cars.splice(idx, 1);
    }
    m.step = 0;
    m.chaseT = 0;
    m.active = false;
    m.runner = null;
    m.nextT = 1;
    state.player.wanted = 0;
    state.player.bustedT = 0;
    state.player.health = 100;
    state.police.length = 0;
    state.over = null;
    if (state.player.car) {
      state.player.car.parked = true;
      state.player.car.speed = 0;
      state.player.car = null;
    }
    state.player.onFoot = true;
    var plaza = state.city.places.plaza;
    state.player.x = plaza.x;
    state.player.y = plaza.y + 60;
    state.player.angle = 0;
    state.player.speed = 0;
    state.cam.x = state.player.x;
    state.cam.y = state.player.y;
    state.audio.siren(false);
  }

  function updatePickups(state) {
    var p = state.player;
    for (var i = 0; i < state.pickups.length; i++) {
      var pk = state.pickups[i];
      if (pk.taken) continue;
      var dx = p.x - pk.x, dy = p.y - pk.y;
      if (dx * dx + dy * dy < 34 * 34) {
        pk.taken = true;
        if (pk.kind === 'ammo') {
          p.ammo += 12;
          window.DL.missions.showBanner(state, 'Ammo +12', 'Pistol restocked.');
        } else {
          p.health = Math.min(100, p.health + 40);
          window.DL.missions.showBanner(state, 'Health +40', 'Patched up and back in it.');
        }
        state.audio.blip(760);
      }
    }
  }

  function drawPickups(ctx, state) {
    for (var i = 0; i < state.pickups.length; i++) {
      var pk = state.pickups[i];
      if (pk.taken) continue;
      var bob = Math.sin(Date.now() / 300) * 2;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-12, 8, 24, 6);
      ctx.fillStyle = pk.kind === 'ammo' ? '#f39c12' : '#27ae60';
      ctx.fillRect(-12, -12, 24, 24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -12, 24, 24);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'ammo' ? 'AMMO' : 'MED', 0, 4);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function render(state, ctx, input) {
    var cam = state.cam;
    ctx.fillStyle = '#d9b98a';
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(VW / 2 - cam.x, VH / 2 - cam.y);
    window.DL.city.drawGround(ctx, state.city, cam, VW, VH);
    window.DL.city.drawBuildings(ctx, state.city, cam, VW, VH);
    drawPickups(ctx, state);
    window.DL.missions.drawWorld(state, ctx);
    // Traffic cars, then the player, then police, then pedestrians.
    for (var i = 0; i < state.cars.length; i++) {
      var c = state.cars[i];
      if (c === state.player.car) continue;
      window.DL.traffic.drawCar(ctx, c, false);
    }
    window.DL.player.draw(ctx, state);
    window.DL.police.draw(state, ctx);
    window.DL.traffic.drawPeds(ctx, state);
    window.DL.player.drawBullets(ctx, state);
    window.DL.player.drawParticles(ctx, state);
    ctx.restore();

    // HUD and overlays in screen space.
    if (state.started) {
      window.DL.hud.draw(ctx, state, VW, VH);
      if (state.paused) window.DL.hud.drawPause(ctx, VW, VH);
      if (state.over) window.DL.hud.drawOver(ctx, VW, VH, state.over);
    } else {
      window.DL.hud.drawTitle(ctx, VW, VH, state);
    }
  }

  function boot() {
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var url = window.DL.scenes.fromURL();
    var state = newState(url.seed);
    var input = makeInput(canvas);

    // Scene presets skip the title screen and set the shot up.
    if (url.scene) {
      window.DL.scenes.apply(state, url.scene);
    }

    canvas.addEventListener('mousedown', function () {
      window.DL.audio.init(state.audio);
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Enter' && !state.started) {
        state.started = true;
        state.hintT = 8;
        window.DL.audio.init(state.audio);
      }
    });

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Mouse position in world coordinates.
      input.mouseWorldX = input.mouseX + state.cam.x - VW / 2;
      input.mouseWorldY = input.mouseY + state.cam.y - VH / 2;

      if (!state.started) {
        // Slow drift over the city behind the title.
        state.cam.x += 26 * dt;
        if (state.cam.x > state.city.w - 700) state.cam.x = 700;
        state.cam.y = 1300;
        if (input.pressed('mouse') || input.pressed('Enter')) {
          state.started = true;
          state.hintT = 8;
          window.DL.audio.init(state.audio);
          if (!state.mission.active && state.mission.index < 4) {
            state.mission.nextT = 1.2;
          }
        }
      } else if (!state.paused && !state.over) {
        if (input.pressed('KeyP')) state.paused = true;
        if (input.pressed('KeyM')) window.DL.audio.toggleMute(state.audio);
        if (input.pressed('KeyR')) restartMission(state);
        if (state.hintT > 0) state.hintT -= dt;

        state.timeMin += dt * 0.5;
        if (state.timeMin >= 1440) state.timeMin -= 1440;

        window.DL.player.update(state, dt, input);
        window.DL.traffic.updateCars(state, dt);
        window.DL.traffic.updatePeds(state, dt);
        window.DL.police.update(state, dt);
        window.DL.missions.update(state, dt);
        updatePickups(state);

        // Camera follows the player smoothly.
        state.cam.x += (state.player.x - state.cam.x) * Math.min(1, dt * 4);
        state.cam.y += (state.player.y - state.cam.y) * Math.min(1, dt * 4);

        window.DL.audio.setEngine(state.audio, state.player.car ? state.player.car.speed : 0, !!state.player.car);
        window.DL.audio.sirenTick(state.audio, dt);
      } else if (state.paused) {
        if (input.pressed('KeyP')) state.paused = false;
        if (input.pressed('KeyM')) window.DL.audio.toggleMute(state.audio);
        if (input.pressed('KeyR')) { state.paused = false; restartMission(state); }
      } else if (state.over) {
        if (input.pressed('KeyR')) {
          state.save();
          state = newState(state.seed);
          if (url.scene) window.DL.scenes.apply(state, url.scene);
        }
      }

      render(state, ctx, input);
      input.endFrame();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
