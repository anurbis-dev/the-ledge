import lanternKey from './lantern-key.json';
import mossSteps from './moss-steps.json';
import mistShelf from './mist-shelf.json';
import stillPool from './still-pool.json';
import emberRun from './ember-run.json';

export var CATALOG = [
  { id: 'lantern-key', title: lanternKey.title || 'Lantern Key', score: lanternKey },
  { id: 'moss-steps', title: mossSteps.title || 'Moss Steps', score: mossSteps },
  { id: 'mist-shelf', title: mistShelf.title || 'Mist Shelf', score: mistShelf },
  { id: 'still-pool', title: stillPool.title || 'Still Pool', score: stillPool },
  { id: 'ember-run', title: emberRun.title || 'Ember Run', score: emberRun }
];

export var DEFAULT_SCORE = 'moss-steps';

export function catalogEntry(id){
  for (var i = 0; i < CATALOG.length; i++){
    if (CATALOG[i].id === id) return CATALOG[i];
  }
  return CATALOG[0];
}
