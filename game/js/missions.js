// Dustline — missions.js
// The story of Dustline: four missions with objectives, markers and
// payouts. Missions run in order; finishing one pays out and saves.

window.DL = window.DL || {};

(function () {
  var MISSIONS = [
    {
      id: 'hot-start',
      title: 'Hot Start',
      story: 'Rae needs wheels. Steal any car and bring it to the Kestrel Garage.',
      reward: 150,
      steps: [
        { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
        { kind: 'goto', text: 'Drive to the Kestrel Garage', place: 'garage', radius: 90 }
      ]
    },
    {
      id: 'courier',
      title: 'The Courier',
      story: 'A package is waiting at Old Mill Market. Pick it up on foot, then deliver it to Harborlight Dock.',
      reward: 300,
      steps: [
        { kind: 'pickup', text: 'Pick up the package at Old Mill Market', place: 'market', radius: 70 },
        { kind: 'goto', text: 'Deliver the package to Harborlight Dock', place: 'dock', radius: 90 }
      ]
    },
    {
      id: 'runner',
      title: 'Tail the Runner',
      story: 'A runner is carrying Rae\'s money across town. Chase his car down — stay close for 3 seconds, or shoot out his engine.',
      reward: 450,
      steps: [
        { kind: 'chase', text: 'Chase the runner\'s car — stay close or disable it' }
      ]
    },
    {
      id: 'heat',
      title: 'Heat Escape',
      story: 'The job went loud. Reach the Cactus Safehouse and lay low until the heat dies.',
      reward: 600,
      steps: [
        { kind: 'escape', text: 'Reach the Cactus Safehouse, then lose the wanted level', place: 'safehouse', radius: 110 }
      ]
    }
  ];

  function create() {
    return {
      index: 0,
      step: 0,
      active: false,
      chaseT: 0,
      runner: null,
      done: 0,
      bannerT: 0,
      bannerText: '',
      bannerSub: ''
    };
  }

  function current(m) {
    return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
  }

  function stepOf(m) {
    var mission = current(m);
    if (!mission) return null;
    return mission.steps[Math.min(m.step, mission.steps.length - 1)];
  }

  function targetPos(state) {
    var m = state.mission;
    var step = stepOf(m);
    if (!step) return null;
    if (step.kind === 'chase') {
      if (m.runner) return { x: m.runner.x, y: m.runner.y, label: 'Runner' };
      return null;
    }
    var place = state.city.places[step.place];
    if (!place) return null;
    return { x: place.x, y: place.y, label: place.label };
  }

  function startMission(state, index) {
    var m = state.mission;
    m.index = index;
    m.step = 0;
    m.chaseT = 0;
    m.active = true;
    m.runner = null;
    var mission = current(m);
    if (!mission) return;
    if (mission.id === 'runner') {
      // Spawn the runner's car ahead of the player on a road.
      var city = state.city;
      var rp = window.DL.city.nearestRoadPoint(city, state.player.x + 500, state.player.y);
      var car = window.DL.traffic.makeCar(city, state.rng, {
        x: rp.x, y: rp.y, color: '#e0a030', kind: 'sport', hp: 3, runner: true
      });
      car.speed = 120;
      m.runner = car;
      state.cars.push(car);
    }
    if (mission.id === 'heat') {
      window.DL.police.commitCrime(state, 3);
    }
    showBanner(state, mission.title, mission.story);
  }

  function showBanner(state, text, sub) {
    var m = state.mission;
    m.bannerText = text;
    m.bannerSub = sub || '';
    m.bannerT = 4.5;
  }

  function completeMission(state) {
    var m = state.mission;
    var mission = current(m);
    if (!mission) return;
    state.player.money += mission.reward;
    m.done += 1;
    m.index += 1;
    m.step = 0;
    m.active = false;
    m.runner = null;
    showBanner(state, 'Mission complete: ' + mission.title, 'Paid $' + mission.reward);
    state.audio.blip(880);
    state.save();
    // Start the next mission after a short breather.
    m.nextT = 3;
  }

  function onRunnerDisabled(state) {
    var m = state.mission;
    var mission = current(m);
    if (!mission || mission.id !== 'runner' || !m.active) return;
    completeMission(state);
  }

  function update(state, dt) {
    var m = state.mission;
    if (m.bannerT > 0) m.bannerT -= dt;
    if (!m.active) {
      if (m.nextT !== undefined && m.nextT > 0) {
        m.nextT -= dt;
        if (m.nextT <= 0) {
          m.nextT = undefined;
          if (current(m)) startMission(state, m.index);
        }
      }
      return;
    }
    var mission = current(m);
    if (!mission) return;
    var step = stepOf(m);
    var p = state.player;

    if (step.kind === 'steal') {
      if (!p.onFoot) {
        m.step += 1;
        showBanner(state, 'Got wheels', 'Now drive to the garage.');
      }
      return;
    }
    if (step.kind === 'pickup') {
      if (p.onFoot) {
        var t = targetPos(state);
        if (t) {
          var dx = p.x - t.x, dy = p.y - t.y;
          if (dx * dx + dy * dy < step.radius * step.radius) {
            m.step += 1;
            showBanner(state, 'Package picked up', 'Now deliver it to the dock.');
            state.audio.blip(660);
          }
        }
      }
      return;
    }
    if (step.kind === 'goto') {
      var t2 = targetPos(state);
      if (t2) {
        var dx2 = p.x - t2.x, dy2 = p.y - t2.y;
        if (dx2 * dx2 + dy2 * dy2 < step.radius * step.radius) {
          if (m.step + 1 >= mission.steps.length) completeMission(state);
          else m.step += 1;
        }
      }
      return;
    }
    if (step.kind === 'chase') {
      if (!m.runner) return;
      var rdx = p.x - m.runner.x, rdy = p.y - m.runner.y;
      var rd = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rd < 90) {
        m.chaseT += dt;
        if (m.chaseT >= 3) completeMission(state);
      } else {
        m.chaseT = Math.max(0, m.chaseT - dt);
      }
      return;
    }
    if (step.kind === 'escape') {
      var t3 = targetPos(state);
      if (t3) {
        var dx3 = p.x - t3.x, dy3 = p.y - t3.y;
        if (dx3 * dx3 + dy3 * dy3 < step.radius * step.radius && p.wanted === 0) {
          completeMission(state);
        }
      }
      return;
    }
  }

  function drawWorld(state, ctx) {
    var m = state.mission;
    if (!m.active) return;
    var t = targetPos(state);
    if (!t) return;
    var pulse = 1 + Math.sin(Date.now() / 300) * 0.15;
    // Beacon column.
    var grad = ctx.createLinearGradient(t.x, t.y - 260, t.x, t.y);
    grad.addColorStop(0, 'rgba(255, 214, 64, 0)');
    grad.addColorStop(1, 'rgba(255, 214, 64, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(t.x - 14, t.y - 260, 28, 260);
    // Pulsing ring on the ground.
    ctx.strokeStyle = '#ffd640';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 214, 64, 0.25)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Label.
    ctx.fillStyle = '#201808';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.label, t.x, t.y - 58);
    ctx.textAlign = 'left';
  }

  window.DL.missions = {
    MISSIONS: MISSIONS,
    create: create,
    current: current,
    stepOf: stepOf,
    targetPos: targetPos,
    startMission: startMission,
    completeMission: completeMission,
    onRunnerDisabled: onRunnerDisabled,
    update: update,
    drawWorld: drawWorld,
    showBanner: showBanner
  };
})();
