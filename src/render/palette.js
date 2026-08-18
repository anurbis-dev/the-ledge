import GAME from '../core/game.js';

export const P = {
  out:'#100c1c', outS:'#1c1630',
  skin:'#f6cda2', skinS:'#c98f66', skinL:'#ffe7c9',
  hair:'#e0563c', hairS:'#a13425', hairL:'#ff8a63',
  shirt:'#2fb6ab', shirtS:'#1b7a76', shirtL:'#69e6d8',
  skirt:'#26618a', skirtS:'#17415e',
  pants:'#443c73', pantsS:'#2b2550',
  boot:'#8a5228', bootS:'#57301a',
  rim:'#ffd9a0',
  rock:'#635c8c', rockD:'#464069', rockL:'#8f86b8', rockX:'#2e2949',
  moss:'#6aa86f', mossD:'#437a51',
  edge:'#e8b53a', edgeL:'#ffe08a', edgeD:'#9c7318',
  crum:'#96705a', crumD:'#5d4437', crumL:'#bb8f70',
  wood:'#bd8347', woodD:'#7d5029', woodL:'#e0ac68', string:'#eee6d4',
  arrowTip:'#f2efe4', arrowFletch:'#d4402f',
  gem:'#6de8ff', gemD:'#2189ad', shroom:'#ff8f5e', shroomD:'#a8482c', stem:'#ffe9c9',
  coin:'#ffd75e', coinD:'#b98420', relic:'#e2c6ff', relicD:'#8a63c4',
  amb:'#b6aed6', torch:'#ffb060', hp:'#ff5b74', hpD:'#4a2036',
  door:'#9a6a3c', doorD:'#5e3f22', doorL:'#c99a63', doorIn:'#1b1226',
  lockC:'#f0cb52', lockD:'#8a6f1c',
  foeA:'#8f5fb0', foeB:'#5f3d7a', foeEye:'#ffe066',
  key:'#ffd75e', keyD:'#a87c1c', stickC:'#c3bccf', stickD:'#8a8399',
  liftA:'#7d7fa8', liftB:'#4c4e6e', liftC:'#a8aacc',
  chest:'#a8763f', chestD:'#6b4823', chestL:'#d4a068', band:'#c9c3d6', bandD:'#7d768f',
  helm:'#b8c4d8', helmD:'#6f7d94', shld:'#c98a3f', shldD:'#8a5a20',
  gearCol: { stick:['#c3bccf','#8a8399'], sword:['#d8dde8','#8f97a8'], blade:['#cfe6ff','#7fa8cc'],
             wshield:['#a9743f','#6d4423'], ishield:['#b8c0cc','#6f7885'], gshield:['#e0b452','#96751f'],
             lhelm:['#a9743f','#6d4423'], ihelm:['#b8c4d8','#6f7d94'], ghelm:['#e6c357','#9a7c1e'],
             scuba:['#5a8fae','#365a70'], flippers:['#e0813f','#96521f'], harpoon:['#8a94a0','#586570'],
             bow:['#bd8347','#7d5029'], spear:['#c3bccf','#7d5029'] }
};

export const PALS = {
  stone: { rock:'#635c8c', rockD:'#464069', rockL:'#8f86b8', moss:'#6aa86f', mossD:'#437a51',
           deepA:'#55507e', deepB:'#3b3660', deepC:'#7f78ab',
           ruinA:'#6b5f74', ruinB:'#4a4055', ruinC:'#94879c', sky:['#141033','#3a2a63','#7d4a72'] },
  clay:  { rock:'#8a6448', rockD:'#5e4430', rockL:'#b98a63', moss:'#9a8a44', mossD:'#6d6130',
           deepA:'#6f4f3c', deepB:'#4a352a', deepC:'#a07a5e',
           ruinA:'#7d6650', ruinB:'#544434', ruinC:'#a8907a', sky:['#1a1026','#4a2438','#8a4a44'] },
  ice:   { rock:'#5a7ea0', rockD:'#3d5a76', rockL:'#8fb6d4', moss:'#6fb0b8', mossD:'#417f8a',
           deepA:'#48688c', deepB:'#31496a', deepC:'#7ea0c4',
           ruinA:'#63809c', ruinB:'#425a72', ruinC:'#9ab4cc', sky:['#0e1830','#25456e','#4a7fa0'] },
  moss:  { rock:'#4f7a58', rockD:'#365640', rockL:'#79a878', moss:'#7cc46a', mossD:'#4d8a4a',
           deepA:'#3f6a54', deepB:'#2b4a3c', deepC:'#6f9c7e',
           ruinA:'#5c7a5c', ruinB:'#3e553f', ruinC:'#8aa88a', sky:['#0f1c1a','#264a34','#4a7a52'] },
  ember: { rock:'#7a4a58', rockD:'#54313c', rockL:'#a8707e', moss:'#a8683f', mossD:'#7a4628',
           deepA:'#633a48', deepB:'#432730', deepC:'#8f5c68',
           ruinA:'#6e4a4a', ruinB:'#4a3030', ruinC:'#9a7070', sky:['#1c0c14','#4e1a26','#8a3a30'] }
};

export let TINT = PALS.stone;
export let palRev = 0;

export function applyPal(){
  var lv = GAME.levelSpec();
  TINT = PALS[lv && lv.pal] || PALS.stone;
  P.rock = TINT.rock; P.rockD = TINT.rockD; P.rockL = TINT.rockL;
  P.moss = TINT.moss; P.mossD = TINT.mossD;
  palRev++;
}
