// Dustline — audio.js
// Synthesized sound with WebAudio: engine hum, police sirens, pickup
// blips, gunshots and crashes. No audio files, no network.

window.DL = window.DL || {};

(function () {
  function create() {
    var a = {
      ctx: null,
      master: null,
      engineOsc: null,
      engineOsc2: null,
      engineGain: null,
      sirenOsc: null,
      sirenGain: null,
      sirenOn: false,
      sirenStep: 0,
      muted: false,
      started: false
    };
    // Convenience methods so game code can call state.audio.shot() etc.
    a.init = function () { init(a); };
    a.setEngine = function (speed, driving) { setEngine(a, speed, driving); };
    a.siren = function (on) { siren(a, on); };
    a.sirenTick = function (dt) { sirenTick(a, dt); };
    a.blip = function (freq) { blip(a, freq); };
    a.shot = function () { shot(a); };
    a.crash = function () { crash(a); };
    a.toggleMute = function () { return toggleMute(a); };
    return a;
  }

  function init(a) {
    if (a.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      a.ctx = new AC();
      a.master = a.ctx.createGain();
      a.master.gain.value = a.muted ? 0 : 0.5;
      a.master.connect(a.ctx.destination);
      // Engine: two detuned sawtooth oscillators through a lowpass.
      a.engineOsc = a.ctx.createOscillator();
      a.engineOsc.type = 'sawtooth';
      a.engineOsc.frequency.value = 50;
      a.engineOsc2 = a.ctx.createOscillator();
      a.engineOsc2.type = 'square';
      a.engineOsc2.frequency.value = 25;
      var filter = a.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      a.engineGain = a.ctx.createGain();
      a.engineGain.gain.value = 0;
      a.engineOsc.connect(filter);
      a.engineOsc2.connect(filter);
      filter.connect(a.engineGain);
      a.engineGain.connect(a.master);
      a.engineOsc.start();
      a.engineOsc2.start();
      // Siren: a sine that alternates between two tones.
      a.sirenOsc = a.ctx.createOscillator();
      a.sirenOsc.type = 'sine';
      a.sirenOsc.frequency.value = 700;
      a.sirenGain = a.ctx.createGain();
      a.sirenGain.gain.value = 0;
      a.sirenOsc.connect(a.sirenGain);
      a.sirenGain.connect(a.master);
      a.sirenOsc.start();
      a.started = true;
    } catch (e) {
      // Sound is optional: the game plays fine without it.
      a.started = false;
    }
  }

  function setEngine(a, speed, driving) {
    if (!a.started || !a.engineOsc) return;
    var t = a.ctx.currentTime;
    var target = driving ? 0.05 + Math.min(0.16, Math.abs(speed) / 3200) : 0;
    a.engineGain.gain.setTargetAtTime(target, t, 0.1);
    var freq = 48 + Math.abs(speed) * 0.35;
    a.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
    a.engineOsc2.frequency.setTargetAtTime(freq / 2, t, 0.08);
  }

  function siren(a, on) {
    if (!a.started || !a.sirenOsc) return;
    a.sirenOn = on;
    var t = a.ctx.currentTime;
    a.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.2);
  }

  function sirenTick(a, dt) {
    if (!a.started || !a.sirenOn || !a.sirenOsc) return;
    a.sirenStep += dt;
    if (a.sirenStep > 0.45) {
      a.sirenStep = 0;
      var t = a.ctx.currentTime;
      var next = a.sirenOsc.frequency.value > 750 ? 650 : 880;
      a.sirenOsc.frequency.setTargetAtTime(next, t, 0.05);
    }
  }

  function blip(a, freq) {
    if (!a.started) return;
    try {
      var t = a.ctx.currentTime;
      var o = a.ctx.createOscillator();
      var g = a.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq || 660;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      g.connect(a.master);
      o.start(t);
      o.stop(t + 0.2);
    } catch (e) { /* ignore */ }
  }

  function shot(a) {
    if (!a.started) return;
    try {
      var t = a.ctx.currentTime;
      var len = Math.floor(a.ctx.sampleRate * 0.12);
      var buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      var src = a.ctx.createBufferSource();
      src.buffer = buf;
      var g = a.ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(g);
      g.connect(a.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  function crash(a) {
    if (!a.started) return;
    try {
      var t = a.ctx.currentTime;
      var len = Math.floor(a.ctx.sampleRate * 0.2);
      var buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.7;
      }
      var src = a.ctx.createBufferSource();
      src.buffer = buf;
      var filter = a.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      var g = a.ctx.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      src.connect(filter);
      filter.connect(g);
      g.connect(a.master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  function toggleMute(a) {
    a.muted = !a.muted;
    if (a.master) {
      a.master.gain.value = a.muted ? 0 : 0.5;
    }
    return a.muted;
  }

  window.DL.audio = {
    create: create,
    init: init,
    setEngine: setEngine,
    siren: siren,
    sirenTick: sirenTick,
    blip: blip,
    shot: shot,
    crash: crash,
    toggleMute: toggleMute
  };
})();
