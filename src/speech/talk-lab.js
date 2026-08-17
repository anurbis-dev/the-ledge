import {
  TALK_VARIANTS, TALK_VOICES, talkBlip, resolveVoice,
  loadTalkPrefs, saveTalkPrefs, findVariant
} from '../audio/talk.js';
import { resumeAudio } from '../audio/context.js';

var prefs = loadTalkPrefs();
var phraseEl, liveEl, volEl, volNum, whoEl;
var playing = 0;

var SAMPLES = {
  hero: "oh wow. this'll help.",
  npc: 'Lost, traveler? Watch the ledges.'
};

function $(id){ return document.getElementById(id); }

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

async function speak(text, who, token, variant){
  resumeAudio();
  var voice = resolveVoice(who);
  if (variant) voice.variant = variant;
  var spec = findVariant(voice.variant);
  liveEl.innerHTML = '';
  for (var i = 0; i < text.length; i++){
    if (token !== playing) return;
    var ch = text.charAt(i);
    liveEl.appendChild(document.createTextNode(ch));
    talkBlip(ch, voice);
    var wait = (spec.fast ? 22 : voice.rate * 1000);
    if ('.,!?;:'.indexOf(ch) >= 0) wait *= 3;
    if (ch === ' ') wait *= 0.6;
    await sleep(wait);
  }
}

function currentWho(){
  return whoEl.value === 'npc' ? 'hermit' : 'hero';
}

function playPhrase(who, variant){
  resumeAudio();
  var text = (phraseEl.value || '').trim() || SAMPLES[who === 'hero' ? 'hero' : 'npc'];
  playing++;
  speak(text, who === 'hero' ? 'hero' : 'hermit', playing, variant);
}

function markSelected(){
  var cards = document.querySelectorAll('.card');
  for (var i = 0; i < cards.length; i++){
    var id = cards[i].dataset.id;
    var role = cards[i].dataset.role;
    var on = (role === 'hero' && prefs.hero === id) || (role === 'npc' && prefs.npc === id);
    cards[i].classList.toggle('sel', on);
  }
}

function card(spec, role){
  var el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = spec.id;
  el.dataset.role = role;
  el.innerHTML =
    '<h3>' + spec.name + '</h3>' +
    '<p>' + spec.desc + '</p>' +
    '<div class="acts">' +
      '<button type="button" data-act="play">Play</button>' +
      '<button type="button" data-act="use">Use for ' + (role === 'hero' ? 'heroine' : 'NPC') + '</button>' +
    '</div>';
  el.querySelector('[data-act=play]').addEventListener('click', function(){
    playPhrase(role, spec.id);
  });
  el.querySelector('[data-act=use]').addEventListener('click', function(){
    if (role === 'hero') saveTalkPrefs({ hero: spec.id });
    else saveTalkPrefs({ npc: spec.id });
    prefs = loadTalkPrefs();
    markSelected();
    playPhrase(role);
  });
  return el;
}

function fillGrid(id, role){
  var root = $(id);
  for (var i = 0; i < TALK_VARIANTS.length; i++)
    root.appendChild(card(TALK_VARIANTS[i], role));
}

function bind(){
  phraseEl = $('phrase');
  liveEl = $('live');
  volEl = $('vol');
  volNum = $('volNum');
  whoEl = $('who');
  phraseEl.value = SAMPLES.hero;
  volEl.value = String(Math.round((prefs.vol || 1) * 100));
  volNum.textContent = volEl.value + '%';
  fillGrid('heroGrid', 'hero');
  fillGrid('npcGrid', 'npc');
  markSelected();

  volEl.addEventListener('input', function(){
    volNum.textContent = volEl.value + '%';
    saveTalkPrefs({ vol: (+volEl.value) / 100 });
    prefs = loadTalkPrefs();
  });
  $('play').addEventListener('click', function(){
    playPhrase(whoEl.value === 'npc' ? 'npc' : 'hero');
  });
  $('playBoth').addEventListener('click', async function(){
    playPhrase('hero');
    await sleep(1400);
    playPhrase('npc');
  });
  whoEl.addEventListener('change', function(){
    if (!phraseEl.value || phraseEl.value === SAMPLES.hero || phraseEl.value === SAMPLES.npc)
      phraseEl.value = SAMPLES[whoEl.value === 'npc' ? 'npc' : 'hero'];
  });
}

bind();
void TALK_VOICES;
