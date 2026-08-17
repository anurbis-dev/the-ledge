import { TALK_VOICES } from '../audio/talk.js';
import { treeIds, cloneTree, ensureDialog, nodeIds } from '../speech/trees.js';
import { touchOp } from './history.js';

var root = document.getElementById('edNpcTalk');
var titleEl = document.getElementById('edNpcTalkTitle');
var body = document.getElementById('edNpcTalkBody');
var current = null;
var nodeId = '';
var onChange = null;

var GRANTS = [
  { id: '', name: 'None' },
  { id: 'key', name: 'Key' },
  { id: 'coin', name: 'Coin' },
  { id: 'gem', name: 'Gem' },
  { id: 'shroom', name: 'Shroom' },
  { id: 'relic', name: 'Relic' },
  { id: 'tank', name: 'Tank' }
];
var POOLS = [
  { id: '', name: 'Fixed text' },
  { id: 'already', name: 'Already-talked pool' },
  { id: 'flee', name: 'Flee pool' },
  { id: 'safe', name: 'Safe pool' }
];

export function bindNpcTalk(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

function clampPopup(el, clientX, clientY){
  var mw = el.offsetWidth || 320, mh = el.offsetHeight || 200;
  el.style.left = Math.max(4, Math.min(clientX, innerWidth - mw - 4)) + 'px';
  el.style.top = Math.max(4, Math.min(clientY, innerHeight - mh - 4)) + 'px';
}

export function closeNpcTalk(){
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  nodeId = '';
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeNpcTalk();
}

export function openNpcTalk(npc, clientX, clientY){
  if (!root || !npc) return;
  current = npc;
  ensureDialog(npc);
  var ids = nodeIds(npc.dialog);
  nodeId = npc.dialog.start || ids[0] || '';
  if (titleEl) titleEl.textContent = (npc.tree || 'npc') + ' talk';
  fill();
  root.hidden = false;
  clampPopup(root, clientX != null ? clientX : 80, clientY != null ? clientY : 80);
  document.removeEventListener('pointerdown', onOutside, true);
  setTimeout(function(){ document.addEventListener('pointerdown', onOutside, true); }, 0);
}

function field(parent, label, el){
  var row = document.createElement('label');
  row.className = 'ed-field';
  var lab = document.createElement('span');
  lab.textContent = label;
  row.appendChild(lab);
  row.appendChild(el);
  parent.appendChild(row);
  return row;
}

function sel(opts, val){
  var s = document.createElement('select');
  for (var i = 0; i < opts.length; i++){
    var o = document.createElement('option');
    o.value = opts[i].id;
    o.textContent = opts[i].name;
    if (opts[i].id === val) o.selected = true;
    s.appendChild(o);
  }
  return s;
}

function inp(val, wide){
  var e = document.createElement('input');
  e.type = 'text';
  e.className = wide ? 'ed-talk-in' : 'ed-talk-in sm';
  e.value = val || '';
  e.spellcheck = false;
  return e;
}

function fill(){
  if (!body || !current) return;
  body.textContent = '';
  var npc = current;
  var tree = ensureDialog(npc);
  var ids = nodeIds(tree);
  if (!nodeId || !tree.nodes[nodeId]) nodeId = tree.start || ids[0] || '';

  var presets = treeIds().map(function(id){ return { id: id, name: id }; });
  var voiceOpts = Object.keys(TALK_VOICES).map(function(id){ return { id: id, name: id }; });
  var nodeOpts = ids.map(function(id){ return { id: id, name: id }; });
  nodeOpts.unshift({ id: '', name: '(none)' });

  var pre = sel(presets, npc.tree || 'hermit');
  pre.addEventListener('change', function(){
    touchOp();
    npc.tree = pre.value;
    npc.dialog = cloneTree(pre.value);
    nodeId = npc.dialog.start || '';
    notify();
    fill();
  });
  field(body, 'Preset', pre);

  var vo = sel(voiceOpts, tree.voice || npc.tree || 'npc');
  vo.addEventListener('change', function(){
    touchOp();
    ensureDialog(npc).voice = vo.value;
    notify();
  });
  field(body, 'Voice', vo);

  var st = sel(nodeOpts, tree.start || '');
  st.addEventListener('change', function(){
    touchOp();
    ensureDialog(npc).start = st.value || 'hello';
    notify();
  });
  field(body, 'First', st);

  var ag = sel(nodeOpts, tree.again || '');
  ag.addEventListener('change', function(){
    touchOp();
    ensureDialog(npc).again = ag.value || '';
    notify();
  });
  field(body, 'Met again', ag);

  var al = sel(nodeOpts, tree.already || '');
  al.addEventListener('change', function(){
    touchOp();
    ensureDialog(npc).already = al.value || '';
    notify();
  });
  field(body, 'Already told', al);

  var head = document.createElement('div');
  head.className = 'ed-intro-head';
  var h = document.createElement('h4');
  h.className = 'ed-pg-title';
  h.textContent = 'Nodes';
  head.appendChild(h);
  var acts = document.createElement('div');
  acts.className = 'ed-head-acts';
  var add = document.createElement('button');
  add.type = 'button'; add.className = 'edb'; add.textContent = '+';
  add.title = 'Add node';
  add.addEventListener('click', function(){
    touchOp();
    var t = ensureDialog(npc);
    var nid = freshId(t.nodes);
    t.nodes[nid] = { text: '…' };
    if (!t.start) t.start = nid;
    nodeId = nid;
    notify();
    fill();
  });
  var del = document.createElement('button');
  del.type = 'button'; del.className = 'edb'; del.textContent = '−';
  del.title = 'Delete node';
  del.disabled = ids.length <= 1;
  del.addEventListener('click', function(){
    if (ids.length <= 1) return;
    touchOp();
    var t = ensureDialog(npc);
    delete t.nodes[nodeId];
    if (t.start === nodeId) t.start = nodeIds(t)[0] || '';
    if (t.again === nodeId) t.again = '';
    if (t.already === nodeId) t.already = '';
    retarget(t, nodeId, '');
    nodeId = t.start || nodeIds(t)[0] || '';
    notify();
    fill();
  });
  acts.appendChild(add);
  acts.appendChild(del);
  head.appendChild(acts);
  body.appendChild(head);

  var chips = document.createElement('div');
  chips.className = 'ed-talk-nodes';
  for (var i = 0; i < ids.length; i++){
    (function(id){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'edb' + (id === nodeId ? ' on' : '');
      b.textContent = id;
      b.addEventListener('click', function(){ nodeId = id; fill(); });
      chips.appendChild(b);
    })(ids[i]);
  }
  body.appendChild(chips);

  var node = tree.nodes[nodeId];
  if (!node) return;

  var idIn = inp(nodeId, true);
  idIn.addEventListener('change', function(){
    var next = sanitizeId(idIn.value);
    if (!next || next === nodeId || tree.nodes[next]){ idIn.value = nodeId; return; }
    touchOp();
    var t = ensureDialog(npc);
    t.nodes[next] = t.nodes[nodeId];
    delete t.nodes[nodeId];
    if (t.start === nodeId) t.start = next;
    if (t.again === nodeId) t.again = next;
    if (t.already === nodeId) t.already = next;
    retarget(t, nodeId, next);
    nodeId = next;
    notify();
    fill();
  });
  field(body, 'Id', idIn);

  var pool = sel(POOLS, node.textPool || '');
  pool.addEventListener('change', function(){
    touchOp();
    var n = ensureDialog(npc).nodes[nodeId];
    if (!n) return;
    if (pool.value){ n.textPool = pool.value; }
    else delete n.textPool;
    notify();
    fill();
  });
  field(body, 'Text', pool);

  if (!node.textPool){
    var ta = document.createElement('textarea');
    ta.className = 'ed-talk-ta';
    ta.rows = 3;
    ta.value = node.text || '';
    ta.spellcheck = false;
    ta.addEventListener('input', function(){
      touchOp();
      var n = ensureDialog(npc).nodes[nodeId];
      if (n) n.text = ta.value;
      notify();
    });
    body.appendChild(ta);
  }

  var fl = inp(node.flag || '', true);
  fl.placeholder = 'flag';
  fl.addEventListener('change', function(){
    touchOp();
    var n = ensureDialog(npc).nodes[nodeId];
    if (!n) return;
    if (fl.value) n.flag = fl.value;
    else delete n.flag;
    notify();
  });
  field(body, 'Flag', fl);

  var gr = sel(GRANTS, node.grant || '');
  gr.addEventListener('change', function(){
    touchOp();
    var n = ensureDialog(npc).nodes[nodeId];
    if (!n) return;
    if (gr.value) n.grant = gr.value;
    else delete n.grant;
    notify();
  });
  field(body, 'Give', gr);

  var toldRow = document.createElement('label');
  toldRow.className = 'ed-check';
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!node.told;
  cb.addEventListener('change', function(){
    touchOp();
    var n = ensureDialog(npc).nodes[nodeId];
    if (!n) return;
    if (cb.checked) n.told = true;
    else delete n.told;
    notify();
  });
  toldRow.appendChild(cb);
  toldRow.appendChild(document.createTextNode('This is the info (do not repeat)'));
  body.appendChild(toldRow);

  var chHead = document.createElement('div');
  chHead.className = 'ed-intro-head';
  var chH = document.createElement('h4');
  chH.className = 'ed-pg-title';
  chH.textContent = 'Choices';
  chHead.appendChild(chH);
  var addCh = document.createElement('button');
  addCh.type = 'button'; addCh.className = 'edb'; addCh.textContent = '+';
  addCh.title = 'Add choice';
  addCh.addEventListener('click', function(){
    touchOp();
    var n = ensureDialog(npc).nodes[nodeId];
    if (!n) return;
    if (!n.choices) n.choices = [];
    n.choices.push({ text: '…', next: '' });
    notify();
    fill();
  });
  chHead.appendChild(addCh);
  body.appendChild(chHead);

  var choices = node.choices || [];
  for (var c = 0; c < choices.length; c++){
    (function(idx){
      var row = document.createElement('div');
      row.className = 'ed-choice-row';
      var t = inp(choices[idx].text || '', true);
      t.addEventListener('input', function(){
        touchOp();
        var n = ensureDialog(npc).nodes[nodeId];
        if (n && n.choices && n.choices[idx]) n.choices[idx].text = t.value;
        notify();
      });
      var nx = sel(nodeOpts, choices[idx].next || '');
      nx.addEventListener('change', function(){
        touchOp();
        var n = ensureDialog(npc).nodes[nodeId];
        if (n && n.choices && n.choices[idx]) n.choices[idx].next = nx.value || null;
        notify();
      });
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'edb'; rm.textContent = '×';
      rm.addEventListener('click', function(){
        touchOp();
        var n = ensureDialog(npc).nodes[nodeId];
        if (n && n.choices) n.choices.splice(idx, 1);
        notify();
        fill();
      });
      row.appendChild(t);
      row.appendChild(nx);
      row.appendChild(rm);
      body.appendChild(row);
    })(c);
  }

  var rst = document.createElement('button');
  rst.type = 'button';
  rst.className = 'edb wide';
  rst.textContent = 'Reset tree';
  rst.addEventListener('click', function(){
    touchOp();
    npc.dialog = cloneTree(npc.tree);
    nodeId = npc.dialog.start || '';
    notify();
    fill();
  });
  body.appendChild(rst);
}

function sanitizeId(s){
  return String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 16);
}

function freshId(nodes){
  var i = 1, id;
  do { id = 'n' + i++; } while (nodes[id]);
  return id;
}

function retarget(tree, from, to){
  var id, node, c;
  for (id in tree.nodes){
    node = tree.nodes[id];
    if (!node.choices) continue;
    for (c = 0; c < node.choices.length; c++)
      if (node.choices[c].next === from) node.choices[c].next = to || null;
  }
}

var closeBtn = document.getElementById('edNpcTalkX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeNpcTalk(); });
