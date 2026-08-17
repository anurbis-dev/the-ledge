import { initSliders } from './slider.js';
import {
  getMix, setMixMaster, setMixFade, setMixVoice, setMixSolo, resetMix,
  playMusic, pauseMusic, stopToStart, seekMusic, seekSection, seekBars,
  getTransport, musicPlaying, setScore
} from '../audio/music.js';
import { resumeAudio } from '../audio/context.js';

var host = null;
var raf = 0;
var seeking = false;
var LABELS = {
  bass: 'Bass',
  pad: 'Pad',
  arp: 'Arp',
  lead: 'Lead',
  harm: 'Harm',
  echo: 'Echo',
  drum: 'Drum'
};

export function bindMixPanel(){
  host = document.getElementById('edMix');
  if (bindMixPanel._up) return;
  bindMixPanel._up = true;
  addEventListener('pointerup', function(){ seeking = false; });
}

export function renderMixPanel(){
  if (!host) host = document.getElementById('edMix');
  if (!host) return;
  host.textContent = '';
  var m = getMix();

  var top = document.createElement('section');
  top.className = 'ed-pg';
  var th = document.createElement('h4');
  th.className = 'ed-pg-title';
  th.textContent = 'Master';
  top.appendChild(th);
  var meta = document.createElement('div');
  meta.className = 'ed-pg-empty';
  meta.textContent = formMeta(m);
  top.appendChild(meta);
  if (m.scores && m.scores.length){
    var sel = document.createElement('select');
    sel.className = 'ed-mix-song';
    for (var si = 0; si < m.scores.length; si++){
      var opt = document.createElement('option');
      opt.value = m.scores[si].id;
      opt.textContent = m.scores[si].title;
      if (m.scores[si].id === m.scoreId) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', function(){
      resumeAudio();
      setScore(sel.value);
      playMusic();
      renderMixPanel();
    });
    top.appendChild(sel);
  }
  top.appendChild(buildTransport(m));
  top.appendChild(rangeRow('Volume', m.master, 0, 2, 0.01, function(v){ setMixMaster(v); }));
  top.appendChild(rangeRow('Fade in', m.fadeIn, 0.2, 8, 0.1, function(v){ setMixFade(v); }, 's'));
  var acts = document.createElement('div');
  acts.className = 'ed-mix-acts';
  var rst = document.createElement('button');
  rst.type = 'button';
  rst.className = 'edb';
  rst.textContent = 'Reset mix';
  rst.addEventListener('click', function(){ resetMix(); renderMixPanel(); });
  acts.appendChild(rst);
  top.appendChild(acts);
  host.appendChild(top);

  var sec = document.createElement('section');
  sec.className = 'ed-pg';
  var sh = document.createElement('h4');
  sh.className = 'ed-pg-title';
  sh.textContent = 'Channels';
  sec.appendChild(sh);

  for (var i = 0; i < m.channels.length; i++){
    (function(name){
      var ov = m.voices[name] || {};
      var def = m.defaults[name] || {};
      var vol = ov.vol != null ? ov.vol : 1;
      var wave = ov.wave || def.wave || 'square';
      var muted = !!ov.mute;
      var solo = m.solo === name;
      var row = document.createElement('div');
      row.className = 'ed-mix-row';
      var lab = document.createElement('span');
      lab.className = 'ed-mix-name';
      lab.textContent = LABELS[name] || name;
      var mute = document.createElement('button');
      mute.type = 'button';
      mute.className = 'edb' + (muted ? ' on' : '');
      mute.textContent = 'M';
      mute.title = 'Mute';
      mute.addEventListener('click', function(){
        setMixVoice(name, { mute: !muted });
        renderMixPanel();
      });
      var sol = document.createElement('button');
      sol.type = 'button';
      sol.className = 'edb' + (solo ? ' on' : '');
      sol.textContent = 'S';
      sol.title = 'Solo';
      sol.addEventListener('click', function(){
        setMixSolo(solo ? '' : name);
        renderMixPanel();
      });
      row.appendChild(lab);
      row.appendChild(mute);
      row.appendChild(sol);
      if (name !== 'drum'){
        var sel = document.createElement('select');
        sel.className = 'ed-mix-wave';
        var waves = m.waves;
        for (var w = 0; w < waves.length; w++){
          var opt = document.createElement('option');
          opt.value = waves[w];
          opt.textContent = waves[w];
          if (waves[w] === wave) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('change', function(){
          setMixVoice(name, { wave: sel.value });
        });
        row.appendChild(sel);
      } else {
        var spacer = document.createElement('span');
        spacer.className = 'ed-mix-wave';
        spacer.textContent = 'noise';
        row.appendChild(spacer);
      }
      var sl = rangeRow('', vol, 0, 2, 0.01, function(v){ setMixVoice(name, { vol: v }); }, '%', true);
      sl.classList.add('ed-mix-vol');
      row.appendChild(sl);
      sec.appendChild(row);
    })(m.channels[i]);
  }
  host.appendChild(sec);
  initSliders(host);
  paintTransport();
  kickTransport();
}

function buildTransport(m){
  var t = m.transport || getTransport();
  var box = document.createElement('div');
  box.className = 'ed-mix-tr';

  var acts = document.createElement('div');
  acts.className = 'ed-mix-acts';
  var play = document.createElement('button');
  play.type = 'button';
  play.className = 'edb ed-mix-play' + (t.playing ? ' on' : '');
  play.textContent = t.playing ? 'Pause' : 'Play';
  play.addEventListener('click', function(){
    resumeAudio();
    if (musicPlaying()) pauseMusic();
    else playMusic();
    paintTransport();
  });
  var stop = document.createElement('button');
  stop.type = 'button';
  stop.className = 'edb';
  stop.textContent = 'Stop';
  stop.addEventListener('click', function(){
    stopToStart();
    paintTransport();
  });
  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'edb';
  prev.textContent = '−bar';
  prev.title = 'Back 1 bar';
  prev.addEventListener('click', function(){ resumeAudio(); seekBars(-1); paintTransport(); });
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'edb';
  next.textContent = '+bar';
  next.title = 'Forward 1 bar';
  next.addEventListener('click', function(){ resumeAudio(); seekBars(1); paintTransport(); });
  acts.appendChild(play);
  acts.appendChild(stop);
  acts.appendChild(prev);
  acts.appendChild(next);
  box.appendChild(acts);

  var time = document.createElement('div');
  time.className = 'ed-mix-time';
  box.appendChild(time);

  var seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'ed-mix-seek';
  seek.min = '0';
  seek.max = String(Math.max(1, t.duration || 1));
  seek.step = '0.05';
  seek.value = String(t.pos || 0);
  seek.dataset.bnSkip = '1';
  seek.addEventListener('pointerdown', function(){ seeking = true; });
  seek.addEventListener('pointerup', function(){ seeking = false; });
  seek.addEventListener('change', function(){ seeking = false; });
  seek.addEventListener('input', function(){
    seeking = true;
    resumeAudio();
    seekMusic(+seek.value);
    paintTransport();
  });
  box.appendChild(seek);

  if (t.form && t.form.length){
    var marks = document.createElement('div');
    marks.className = 'ed-mix-marks';
    var dur = t.duration || 1;
    for (var i = 0; i < t.form.length; i++){
      var mk = document.createElement('span');
      mk.className = 'ed-mix-mark';
      mk.style.left = (100 * t.form[i].startSec / dur) + '%';
      mk.title = t.form[i].title;
      marks.appendChild(mk);
    }
    box.appendChild(marks);
    var form = document.createElement('div');
    form.className = 'ed-mix-form';
    for (var f = 0; f < t.form.length; f++){
      (function(sec){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'edb ed-mix-sec';
        b.dataset.sec = sec.id;
        b.textContent = sec.title;
        b.addEventListener('click', function(){
          resumeAudio();
          seekSection(sec.id);
          if (!musicPlaying()) playMusic();
          paintTransport();
        });
        form.appendChild(b);
      })(t.form[f]);
    }
    box.appendChild(form);
  }
  return box;
}

function fmtTime(sec){
  sec = Math.max(0, sec || 0);
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function paintTransport(){
  if (!host) return;
  var t = getTransport();
  var play = host.querySelector('.ed-mix-play');
  if (play){
    play.textContent = t.playing ? 'Pause' : 'Play';
    play.classList.toggle('on', t.playing);
  }
  var time = host.querySelector('.ed-mix-time');
  if (time){
    var bits = [fmtTime(t.pos) + ' / ' + fmtTime(t.duration)];
    if (t.section) bits.push(t.section);
    bits.push('bar ' + t.bar + '/' + t.bars);
    time.textContent = bits.join(' · ');
  }
  var seek = host.querySelector('.ed-mix-seek');
  if (seek && !seeking){
    seek.max = String(Math.max(1, t.duration || 1));
    seek.value = String(t.pos || 0);
  }
  var secs = host.querySelectorAll('.ed-mix-sec');
  for (var i = 0; i < secs.length; i++){
    secs[i].classList.toggle('on', secs[i].dataset.sec === t.sectionId);
  }
}

function kickTransport(){
  if (raf) return;
  function tick(){
    raf = 0;
    if (!host || host.hidden) return;
    paintTransport();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}

function formMeta(m){
  var bits = [];
  if (m.title) bits.push(m.title);
  if (m.key) bits.push(m.key);
  if (m.bpm) bits.push(m.bpm + ' BPM');
  if (m.introSec) bits.push('intro ' + m.introSec.toFixed(0) + 's');
  if (m.loopSec) bits.push('loop ' + m.loopSec.toFixed(0) + 's');
  if (m.form && m.form.length){
    bits.push(m.form.map(function(s){ return s.title || s.id; }).join(' → '));
  }
  return bits.join(' · ');
}

function rangeRow(label, value, min, max, step, onInput, suffix, asPct){
  var wrap = document.createElement('div');
  wrap.className = 'slider-wrap';
  var over = document.createElement('div');
  over.className = 'slider-label-overlay';
  var lab = document.createElement('span');
  lab.textContent = label;
  var val = document.createElement('span');
  over.appendChild(lab);
  over.appendChild(val);
  var inp = document.createElement('input');
  inp.type = 'range';
  inp.min = String(min);
  inp.max = String(max);
  inp.step = String(step);
  inp.value = String(value);
  inp.dataset.default = String(asPct ? 1 : (label === 'Fade in' ? 2.6 : 1));
  inp.addEventListener('input', function(){ onInput(+inp.value); });
  wrap.appendChild(over);
  wrap.appendChild(inp);
  if (asPct) wrap.title = Math.round(value * 100) + '%';
  else if (suffix) wrap.title = label + ' ' + value + suffix;
  return wrap;
}
