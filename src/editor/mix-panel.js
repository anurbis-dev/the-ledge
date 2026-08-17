import { initSliders } from './slider.js';
import {
  getMix, setMixMaster, setMixFade, setMixVoice, setMixSolo, resetMix,
  startMusic, hushMusic, musicPlaying, setScore
} from '../audio/music.js';
import { resumeAudio } from '../audio/context.js';

var host = null;
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
      if (!musicPlaying()) startMusic();
      renderMixPanel();
    });
    top.appendChild(sel);
  }
  top.appendChild(rangeRow('Volume', m.master, 0, 2, 0.01, function(v){ setMixMaster(v); }));
  top.appendChild(rangeRow('Fade in', m.fadeIn, 0.2, 8, 0.1, function(v){ setMixFade(v); }, 's'));
  var acts = document.createElement('div');
  acts.className = 'ed-mix-acts';
  var play = document.createElement('button');
  play.type = 'button';
  play.className = 'edb' + (musicPlaying() ? ' on' : '');
  play.textContent = musicPlaying() ? 'Playing' : 'Preview';
  play.addEventListener('click', function(){
    resumeAudio();
    if (musicPlaying()) hushMusic();
    else startMusic();
    renderMixPanel();
  });
  var rst = document.createElement('button');
  rst.type = 'button';
  rst.className = 'edb';
  rst.textContent = 'Reset';
  rst.addEventListener('click', function(){ resetMix(); renderMixPanel(); });
  acts.appendChild(play);
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
  requestAnimationFrame(function(){
    if (!host) return;
    var b = host.querySelector('.ed-mix-acts .edb');
    if (!b) return;
    var on = musicPlaying();
    b.textContent = on ? 'Playing' : 'Preview';
    b.classList.toggle('on', on);
  });
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
