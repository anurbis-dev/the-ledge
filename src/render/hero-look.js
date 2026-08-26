/* Данные Hero под общий риг (см. figure.js) — цвета взяты из palette.js P,
   форма (HEAD_ROWS/PARTS) — тот же набор, что и у Shirley (см. ./shirley/data.js):
   риг общий, персонажи различаются только перекраской + мелкими правками формы. */
export var PALETTE = {
  out: '#100c1c',
  skin: '#f6cda2', skinS: '#c98f66', skinL: '#ffe7c9',
  hair: '#e0563c', hairS: '#a13425', hairL: '#ff8a63',
  top: '#2fb6ab', topS: '#1b7a76', topL: '#69e6d8',
  waist: '#26618a', sash: '#bcd4e6',
  pants: '#443c73', pantsS: '#2b2550',
  boot: '#8a5228', bootS: '#57301a',
  glove: '#f6cda2', gloveS: '#c98f66',
  pack: '#8a5228', packD: '#57301a', packStrap: '#8a5228'
};

export var STYLE = { thigh: 4, shin: 3, upperArm: 3, forearm: 2, torso: 5, tail1: 3, tail2: 2 };

export var HEAD_ROWS = ['.hhhh.', 'hhhhhh', 'hhssss', 'hhsses', '.hssss', '.hsss.', '..ss..'];

export var PARTS = {
  hand: ['gggg', 'gggg', 'ssss'],
  boot: ['.bbb.', 'bbbbb', 'bbbbb', 'ppppp'],
  hip: ['tttttttt', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', 'ssssssss'],
  pack: ['pppp', 'pppp', 'dddd', 'dddd', 'dddd', 'dddd', 'dddd', 'dddd', 'dddd']
};
