import { talkBlip, resolveVoice } from '../audio/talk.js';
import { pickLine } from './lines.js';
import { treeOf } from './trees.js';

var SEEN_KEY = 'ledge.dev.seenKinds';

function loadSeen(){
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch (e){ return {}; }
}
function saveSeen(o){
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e){}
}

export function resetSeenKinds(){
  try { localStorage.removeItem(SEEN_KEY); } catch (e){}
}

function wrapText(str, maxChars){
  var words = String(str || '').toUpperCase().split(/\s+/);
  var lines = [], cur = '';
  for (var i = 0; i < words.length; i++){
    var w = words[i];
    if (!w) continue;
    var next = cur ? cur + ' ' + w : w;
    if (next.length > maxChars && cur){ lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function speakerPos(S, who, id){
  if (who === 'hero'){
    var p = S.p;
    return { x: p.x + p.w / 2, y: p.y, face: p.facing };
  }
  var list = S.npcs || [];
  for (var i = 0; i < list.length; i++){
    if (list[i].id === id){
      var n = list[i];
      return { x: n.x + n.w / 2, y: n.y, face: n.facing || 1 };
    }
  }
  return { x: S.p.x, y: S.p.y, face: 1 };
}

function mkBubble(S, opt){
  var text = String(opt.text || '');
  var lines = wrapText(text, opt.maxChars || 18);
  return {
    who: opt.who || 'hero',
    speakerId: opt.speakerId,
    voice: opt.voice || (opt.who === 'hero' ? 'hero' : 'npc'),
    text: text,
    lines: lines,
    shown: 0,
    total: text.replace(/\s+/g, ' ').length,
    t: 0,
    hold: opt.hold != null ? opt.hold : 1.35,
    rate: opt.rate || resolveVoice(opt.voice || (opt.who === 'hero' ? 'hero' : 'npc')).rate,
    blocking: !!opt.blocking,
    choices: opt.choices || null,
    choice: 0,
    done: false,
    closed: false
  };
}

function dropHeroMutters(S){
  S.bubbles = (S.bubbles || []).filter(function(b){
    return b.blocking || b.who !== 'hero';
  });
}

export function mutter(S, text, who, speakerId, voice){
  if (!S.bubbles) S.bubbles = [];
  if ((who || 'hero') === 'hero') dropHeroMutters(S);
  S.bubbles.push(mkBubble(S, {
    text: text, who: who || 'hero', speakerId: speakerId, voice: voice
  }));
}

export function mutterHero(S, pool){
  var line = pickLine(pool);
  if (line) mutter(S, line, 'hero', null, 'hero');
}

export function noteFirstItem(S, kind){
  if (!kind) return false;
  var seen = loadSeen();
  if (seen[kind]) return false;
  seen[kind] = 1;
  saveSeen(seen);
  mutterHero(S, 'first');
  return true;
}

export function speechBlocks(S){
  var t = S.talk;
  return !!(t && t.blocking && !t.closed);
}

function applyFlag(S, flag){
  if (!flag) return;
  if (!S.flags) S.flags = {};
  S.flags[flag] = true;
}

export function metKey(npc){
  return (npc && npc.tree ? npc.tree : 'hermit') + '.met';
}
export function toldKey(npc){
  return (npc && npc.tree ? npc.tree : 'hermit') + '.told';
}

function findNpc(S, id){
  var list = S.npcs || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function nodeOf(tree, id){
  return tree.nodes[id] || null;
}

function nodeText(node){
  if (node.textPool) return pickLine(node.textPool);
  return node.text || '';
}

function openNode(S, npc, tree, nodeId){
  var node = nodeOf(tree, nodeId);
  if (!node){
    S.talk = null;
    return;
  }
  applyFlag(S, node.flag);
  if (node.told) applyFlag(S, toldKey(npc));
  if (node.grant === 'key') S.keys = (S.keys || 0) + 1;
  else if (node.grant && S.bag && S.bag[node.grant] != null) S.bag[node.grant]++;
  var choices = node.choices && node.choices.length ? node.choices : null;
  var b = mkBubble(S, {
    text: nodeText(node),
    who: 'npc',
    speakerId: npc.id,
    voice: tree.voice || npc.tree || 'npc',
    blocking: true,
    choices: choices,
    hold: choices ? 0.15 : 1.6,
    maxChars: 20
  });
  S.talk = b;
  S.bubbles = (S.bubbles || []).filter(function(x){ return x.who !== 'npc' || x.speakerId !== npc.id; });
  S.bubbles.push(b);
}

export function startTalk(S, npc){
  if (!npc || npc.inside || npc.st === 'flee' || npc.st === 'hide') return false;
  var tree = treeOf(npc);
  var told = S.flags && S.flags[toldKey(npc)];
  var met = S.flags && S.flags[metKey(npc)];
  var startId;
  if (told && tree.already) startId = tree.already;
  else if (met && tree.again) startId = tree.again;
  else startId = tree.start || 'hello';
  applyFlag(S, metKey(npc));
  if (typeof startId === 'function') startId = startId(S, npc);
  openNode(S, npc, tree, startId);
  S.p.events.push('talk:' + (npc.tree || 'npc'));
  return true;
}

export function endTalk(S){
  if (S.talk) S.talk.closed = true;
  S.talk = null;
  S.bubbles = (S.bubbles || []).filter(function(b){ return !b.blocking; });
}

export function breakTalk(S, why){
  if (!speechBlocks(S)) return false;
  var npc = S.talk ? findNpc(S, S.talk.speakerId) : null;
  endTalk(S);
  if (npc && (why === 'flee' || why === 'hit'))
    mutter(S, pickLine('flee'), 'npc', npc.id, npc.tree || 'npc');
  if (S.p && S.p.events) S.p.events.push('talkbreak:' + (why || 'x'));
  return true;
}

function advanceShown(b, dt){
  if (b.shown >= b.text.length) return false;
  b.t += dt;
  var gained = false;
  while (b.shown < b.text.length && b.t >= b.rate){
    b.t -= b.rate;
    var ch = b.text.charAt(b.shown);
    b.shown++;
    if (ch === ' ') continue;
    if ('.,!?;:'.indexOf(ch) >= 0){ b.t -= b.rate * 2; continue; }
    talkBlip(ch, b.voice || b.who);
    gained = true;
  }
  return gained;
}

export function stepSpeech(S, dt, inp){
  if (!S.bubbles) S.bubbles = [];
  var talking = speechBlocks(S);
  var i, b;

  if (talking && S.talk){
    b = S.talk;
    if (b.shown < b.text.length){
      if (inp && inp.actPressed){
        while (b.shown < b.text.length){
          var ch = b.text.charAt(b.shown);
          b.shown++;
          if (ch !== ' ' && '.,!?;:'.indexOf(ch) < 0) talkBlip(ch, b.voice || b.who);
        }
        b.t = 0;
        if (inp) inp.actPressed = false;
      } else {
        advanceShown(b, dt);
      }
    } else {
      if (b.choices && b.choices.length){
        if (inp && inp.upPressed){ b.choice = (b.choice + b.choices.length - 1) % b.choices.length; }
        if (inp && inp.downPressed){ b.choice = (b.choice + 1) % b.choices.length; }
        if (inp && inp.actPressed){
          var pick = b.choices[b.choice];
          var npc = null, list = S.npcs || [];
          for (i = 0; i < list.length; i++) if (list[i].id === b.speakerId) npc = list[i];
          if (inp) inp.actPressed = false;
          if (!npc || !pick || pick.next == null) endTalk(S);
          else openNode(S, npc, treeOf(npc), pick.next);
        }
      } else {
        b.hold -= dt;
        if (b.hold <= 0 || (inp && inp.actPressed)){
          if (inp) inp.actPressed = false;
          endTalk(S);
        }
      }
    }
  }

  for (i = S.bubbles.length - 1; i >= 0; i--){
    b = S.bubbles[i];
    if (b.blocking) continue;
    if (b.shown < b.text.length) advanceShown(b, dt);
    else {
      b.hold -= dt;
      if (b.hold <= 0) S.bubbles.splice(i, 1);
    }
  }

  return speechBlocks(S);
}

export function bubbleAnchor(S, b){
  return speakerPos(S, b.who, b.speakerId);
}
