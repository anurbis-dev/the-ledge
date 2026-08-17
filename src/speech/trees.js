/* деревья диалогов NPC: start / again + nodes с choices[].next */
export var TREES = {
  hermit: {
    voice: 'hermit',
    start: 'hello',
    again: 'again',
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
        flag: 'hermit.met',
        next: null
      },
      bye: {
        text: 'Then keep walking.',
        flag: 'hermit.met',
        next: null
      },
      again: {
        text: 'Still here?',
        choices: [
          { text: 'Need a hint.', next: 'tip2' },
          { text: 'I am fine.', next: 'later' }
        ]
      },
      tip2: {
        text: 'Doors want a key. Chests too.',
        next: null
      },
      later: {
        text: 'The stone waits.',
        next: null
      }
    }
  },
  wanderer: {
    voice: 'wanderer',
    start: 'hi',
    again: 'back',
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
        flag: 'wanderer.met',
        next: null
      },
      tip: {
        text: 'If it looks empty, someone beat you to it.',
        flag: 'wanderer.met',
        next: null
      },
      bye: {
        text: 'Watch your step.',
        flag: 'wanderer.met',
        next: null
      },
      back: {
        text: 'You again. Still in one piece?',
        choices: [
          { text: 'So far.', next: 'ok' },
          { text: 'Need a hint.', next: 'key' }
        ]
      },
      ok: {
        text: 'Keep it that way.',
        next: null
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
