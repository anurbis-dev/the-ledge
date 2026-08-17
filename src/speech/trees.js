/* деревья диалогов NPC: start / again / already + nodes с choices[].next */
export var TREES = {
  hermit: {
    voice: 'hermit',
    start: 'hello',
    again: 'again',
    already: 'already',
    nodes: {
      hello: {
        text: 'Lost, traveler?',
        choices: [
          { text: 'A little.', next: 'help' },
          { text: 'Just passing.', next: 'bye' }
        ]
      },
      help: {
        text: 'Watch the ledges. They bite.',
        choices: [
          { text: 'Thanks.', next: 'tip' },
          { text: 'I know.', next: 'bye' }
        ]
      },
      tip: {
        text: 'Keys hide in chests. Usually.',
        told: true
      },
      bye: {
        text: 'Then keep walking.'
      },
      again: {
        text: 'Still here?',
        choices: [
          { text: 'Need a hint.', next: 'tip' },
          { text: 'I am fine.', next: 'later' }
        ]
      },
      already: {
        textPool: 'already',
        choices: [
          { text: 'Tell me again.', next: 'tip' },
          { text: 'Never mind.', next: 'later' }
        ]
      },
      later: {
        text: 'The stone waits.'
      }
    }
  },
  wanderer: {
    voice: 'wanderer',
    start: 'hi',
    again: 'back',
    already: 'already',
    nodes: {
      hi: {
        text: 'Oh! A living soul.',
        choices: [
          { text: 'Hello.', next: 'chat' },
          { text: 'Who are you?', next: 'who' }
        ]
      },
      chat: {
        text: 'I got turned around. These caves fold.',
        choices: [
          { text: 'Seen a key?', next: 'key' },
          { text: 'Stay safe.', next: 'bye' }
        ]
      },
      who: {
        text: 'Just a wanderer. Same as you, I guess.',
        choices: [
          { text: 'Any advice?', next: 'tip' },
          { text: 'Good luck.', next: 'bye' }
        ]
      },
      key: {
        text: 'Not lately. Try the chests, not the doors.',
        told: true
      },
      tip: {
        text: 'If it looks empty, someone beat you to it.',
        told: true
      },
      bye: {
        text: 'Watch your step.'
      },
      back: {
        text: 'You again. Still in one piece?',
        choices: [
          { text: 'So far.', next: 'ok' },
          { text: 'Need a hint.', next: 'key' }
        ]
      },
      already: {
        textPool: 'already',
        choices: [
          { text: 'Tell me again.', next: 'key' },
          { text: 'Never mind.', next: 'ok' }
        ]
      },
      ok: {
        text: 'Keep it that way.'
      }
    }
  }
};

export function treeIds(){
  return Object.keys(TREES);
}

export function getTree(id){
  return TREES[id] || TREES.hermit;
}

export function cloneTree(id){
  return JSON.parse(JSON.stringify(getTree(id)));
}

export function treeOf(npc){
  if (npc && npc.dialog && npc.dialog.nodes) return npc.dialog;
  return getTree(npc && npc.tree);
}

export function ensureDialog(npc){
  if (!npc.dialog || !npc.dialog.nodes) npc.dialog = cloneTree(npc.tree);
  if (!npc.dialog.nodes) npc.dialog.nodes = {};
  return npc.dialog;
}

export function nodeIds(tree){
  return tree && tree.nodes ? Object.keys(tree.nodes) : [];
}
