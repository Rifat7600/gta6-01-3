// Dustline — hud.js
// Everything on screen: health, money, ammo, wanted stars, the minimap,
// the mission objective, speed, the clock, banners and the menu screens.

window.DL = window.DL || {};

(function () {
  function fmtTime(mins) {
    var h = Math.floor(mins / 60) % 24;
    var m = Math.floor(mins % 60);
    var hh = h < 10 ? '0' + h : '' + h;
    var mm = m < 10 ? '0' + m : '' + m;
    return hh + ':' + mm;
  }

  function drawStars(ctx, x, y, wanted) {
    ctx.font = '26px Arial, sans-serif';
    ctx.textAlign = 'left';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < wanted ? '#ffd640' : 'rgba(255,255,255,0.35)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      var sx = x + i * 30;
      ctx.beginPath();
      // Five-point star.
      for (var k = 0; k < 10; k++) {
        var r = (k % 2 === 0) ? 12 : 5;
        var a = -Math.PI / 2 + k * Math.PI / 5;
        var px = sx + Math.cos(a) * r;
        var py = y + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.textAlign = 'left';
  }

  function drawMinimap(ctx, state, x, y, w, h) {
    var city = state.city;
    var sx = w / city.w, sy = h / city.h;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 18, 14, 0.78)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // Water.
    ctx.fillStyle = '#4f8fb5';
    for (var wi = 0; wi < city.water.length; wi++) {
      var wt = city.water[wi];
      ctx.fillRect(x + wt.x * sx, y + wt.y * sy, wt.w * sx, wt.h * sy);
    }
    // Roads.
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = 3;
    for (var i = 0; i < city.vRoads.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x + city.vRoads[i] * sx, y);
      ctx.lineTo(x + city.vRoads[i] * sx, y + h);
      ctx.stroke();
    }
    for (var j = 0; j < city.hRoads.length; j++) {
      ctx.beginPath();
      ctx.moveTo(x, y + city.hRoads[j] * sy);
      ctx.lineTo(x + w, y + city.hRoads[j] * sy);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = 'rgba(220, 200, 160, 0.8)';
    for (var b = 0; b < city.buildings.length; b++) {
      var bd = city.buildings[b];
      ctx.fillRect(x + bd.x * sx, y + bd.y * sy, Math.max(1, bd.w * sx), Math.max(1, bd.h * sy));
    }
    // Mission target.
    var t = window.DL.missions.targetPos(state);
    if (t && state.mission.active) {
      var pulse = 3 + Math.sin(Date.now() / 250) * 1.5;
      ctx.fillStyle = '#ffd640';
      ctx.beginPath();
      ctx.arc(x + t.x * sx, y + t.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#ff4040';
    for (var pi = 0; pi < state.police.length; pi++) {
      ctx.beginPath();
      ctx.arc(x + state.police[pi].x * sx, y + state.police[pi].y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    var p = state.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawObjectiveArrow(ctx, state, vw, vh) {
    var t = window.DL.missions.targetPos(state);
    if (!t || !state.mission.active) return;
    var p = state.player;
    var dx = t.x - p.x, dy = t.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 240) return; // The beacon is visible on screen already.
    var ang = Math.atan2(dy, dx);
    var cx = vw / 2 + Math.cos(ang) * 150;
    var cy = vh / 2 + Math.sin(ang) * 150 - 40;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd640';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(d) + 'm', cx, cy + 30);
    ctx.textAlign = 'left';
  }

  function draw(ctx, state, vw, vh) {
    var p = state.player;
    var m = state.mission;

    // Top-left: health, money, ammo.
    ctx.fillStyle = 'rgba(20, 18, 14, 0.65)';
    ctx.fillRect(14, 14, 250, 92);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(14, 14, 250, 92);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.fillText('RAE  •  DUSTLINE', 24, 36);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 46, 150, 12);
    ctx.fillStyle = p.health > 40 ? '#58c96b' : '#e74c3c';
    ctx.fillRect(24, 46, 150 * Math.max(0, p.health) / 100, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(Math.round(p.health) + ' HP', 180, 56);
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillStyle = '#7be382';
    ctx.fillText('$' + p.money, 24, 82);
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('Ammo ' + p.ammo, 120, 82);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('Missions done: ' + m.done + ' / 4', 24, 99);

    // Top-right: wanted stars and minimap.
    drawStars(ctx, vw - 170, 34, p.wanted);
    drawMinimap(ctx, state, vw - 224, 58, 210, 152);

    // Bottom-left: current objective.
    var step = window.DL.missions.stepOf(m);
    if (m.active && step) {
      var mission = window.DL.missions.current(m);
      ctx.fillStyle = 'rgba(20, 18, 14, 0.65)';
      ctx.fillRect(14, vh - 78, 430, 64);
      ctx.strokeStyle = 'rgba(255, 214, 64, 0.6)';
      ctx.strokeRect(14, vh - 78, 430, 64);
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillText('MISSION: ' + mission.title, 24, vh - 56);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText(step.text, 24, vh - 36);
      if (m.chaseT > 0) {
        ctx.fillStyle = '#7be382';
        ctx.fillText('Stay close: ' + m.chaseT.toFixed(1) + 's / 3s', 24, vh - 20);
      }
    } else if (!m.active && m.index < 4) {
      ctx.fillStyle = 'rgba(20, 18, 14, 0.65)';
      ctx.fillRect(14, vh - 52, 330, 38);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Arial, sans-serif';
      ctx.fillText('Next mission starting…', 24, vh - 28);
    } else if (m.index >= 4) {
      ctx.fillStyle = 'rgba(20, 18, 14, 0.65)';
      ctx.fillRect(14, vh - 52, 380, 38);
      ctx.fillStyle = '#7be382';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillText('All missions done — Dustline is yours.', 24, vh - 28);
    }

    // Bottom-right: speed and clock.
    ctx.fillStyle = 'rgba(20, 18, 14, 0.65)';
    ctx.fillRect(vw - 190, vh - 64, 176, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial, sans-serif';
    var speed = p.onFoot ? 0 : Math.round(Math.abs(p.speed) * 0.55);
    ctx.fillText(speed + ' km/h', vw - 178, vh - 40);
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(fmtTime(state.timeMin) + '  •  ' + (p.onFoot ? 'ON FOOT' : 'DRIVING'), vw - 178, vh - 22);

    drawObjectiveArrow(ctx, state, vw, vh);

    // Mission banner.
    if (m.bannerT > 0) {
      var a = Math.min(1, m.bannerT);
      ctx.fillStyle = 'rgba(20, 18, 14,' + (0.8 * a) + ')';
      ctx.fillRect(vw / 2 - 300, 70, 600, 76);
      ctx.strokeStyle = 'rgba(255, 214, 64,' + a + ')';
      ctx.strokeRect(vw / 2 - 300, 70, 600, 76);
      ctx.fillStyle = '#ffd640';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.bannerText, vw / 2, 100);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText(m.bannerSub, vw / 2, 126);
      ctx.textAlign = 'left';
    }

    // Controls hint, fading after the first seconds.
    if (state.hintT > 0) {
      ctx.fillStyle = 'rgba(20, 18, 14,' + Math.min(0.7, state.hintT / 4) + ')';
      ctx.fillRect(vw / 2 - 260, vh - 44, 520, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WASD move / drive   •   E steal or exit car   •   Click / F shoot   •   Space handbrake   •   P pause   •   M mute', vw / 2, vh - 24);
      ctx.textAlign = 'left';
    }
  }

  function drawTitle(ctx, vw, vh, state) {
    ctx.fillStyle = 'rgba(20, 14, 8, 0.55)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 84px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DUSTLINE', vw / 2, vh / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('An open-world crime game in a dusty desert city', vw / 2, vh / 2 - 72);
    ctx.font = '15px Arial, sans-serif';
    ctx.fillStyle = '#e8ddc4';
    var lines = [
      'You are Rae, a wheelwoman fresh out of the county lockup.',
      'Steal cars, outrun the Dustline PD, and work four jobs',
      'for the fixer who owns this town — before the heat owns you.'
    ];
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], vw / 2, vh / 2 - 34 + i * 22);
    }
    ctx.fillStyle = '#ffd640';
    ctx.font = 'bold 18px Arial, sans-serif';
    var blink = (Math.floor(Date.now() / 500) % 2 === 0);
    if (blink) ctx.fillText('Click or press Enter to start', vw / 2, vh / 2 + 62);
    ctx.fillStyle = '#cfc4a8';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('WASD / arrows — move and drive   •   E — steal / exit car   •   Click or F — shoot   •   Space — handbrake   •   P — pause   •   M — mute', vw / 2, vh / 2 + 100);
    ctx.fillText('Progress (money and missions) saves in this browser.', vw / 2, vh / 2 + 124);
    ctx.textAlign = 'left';
  }

  function drawPause(ctx, vw, vh) {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('P — resume      R — restart mission      M — mute', vw / 2, vh / 2 + 28);
    ctx.textAlign = 'left';
  }

  function drawOver(ctx, vw, vh, kind) {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = kind === 'busted' ? '#5aa0ff' : '#ff5040';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', vw / 2, vh / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(kind === 'busted'
      ? 'The Dustline PD caught up with you.'
      : 'Rae is down. The desert keeps what it takes.', vw / 2, vh / 2 + 26);
    ctx.fillText('Press R to try again — your money and finished missions are saved.', vw / 2, vh / 2 + 52);
    ctx.textAlign = 'left';
  }

  window.DL.hud = {
    draw: draw,
    drawTitle: drawTitle,
    drawPause: drawPause,
    drawOver: drawOver,
    fmtTime: fmtTime
  };
})();
