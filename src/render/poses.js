export const K = ['head','neck','hip','eF','hF','eB','hB','kF','fF','kB','fB'];
export function po(o){ return o; }
export const IDLE_A = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[7,11],hF:[7,15],eB:[3,11],hB:[3,15],kF:[6,18],fF:[6,22],kB:[4,18],fB:[4,22]});
export const IDLE_B = po({head:[5,5],neck:[5,9],hip:[5,15],eF:[7,12],hF:[7,16],eB:[3,12],hB:[3,16],kF:[6,19],fF:[6,22],kB:[4,19],fB:[4,22]});
export const RUN_0 = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[4,11],hF:[2,13],eB:[6,11],hB:[8,12],kF:[8,18],fF:[9,22],kB:[3,17],fB:[2,20]});
export const RUN_1 = po({head:[5,3],neck:[5,7],hip:[5,13],eF:[5,10],hF:[4,14],eB:[5,10],hB:[6,14],kF:[6,17],fF:[6,22],kB:[4,16],fB:[5,18]});
export function swapFB(a){ return {head:a.head,neck:a.neck,hip:a.hip,eF:a.eB,hF:a.hB,eB:a.eF,hB:a.hF,kF:a.kB,fF:a.fB,kB:a.kF,fB:a.fF}; }
export const RUN = [RUN_0, RUN_1, swapFB(RUN_0), swapFB(RUN_1)];
/* рывок через колено на уступ — низкий наклонный присед, не вставание в рост */
export const VAULT_B = po({head:[9,9],neck:[8,11],hip:[6,14],eF:[11,10],hF:[13,7],eB:[3,12],hB:[1,15],kF:[10,15],fF:[13,11],kB:[3,18],fB:[1,21]});
/* подбор предмета с земли — присед и рука вниз, к стопам */
export const PICK_B = po({head:[7,12],neck:[7,15],hip:[6,17],eF:[10,16],hF:[12,20],eB:[3,15],hB:[2,18],kF:[8,17],fF:[8,21],kB:[3,17],fB:[3,21]});
/* бросок факела — рука выброшена вперёд, корпус довёрнут за замахом */
export const THROW_B = po({head:[5,2],neck:[5,5],hip:[5,11],eF:[10,3],hF:[15,-1],eB:[2,10],hB:[0,14],kF:[7,15],fF:[9,19],kB:[3,16],fB:[1,20]});
/* упор в стену — ладони на уровне груди, чуть вверх по стене, локти прижаты к корпусу */
export const WALLPUSH = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[7,10],hF:[10,6],eB:[4,10],hB:[7,7],kF:[7,17],fF:[8,21],kB:[4,18],fB:[4,22]});
export const JUMPP = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[8,10],hF:[9,6],eB:[3,10],hB:[2,7],kF:[7,17],fF:[6,20],kB:[3,18],fB:[3,22]});
export const FALLP = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[9,11],hF:[10,8],eB:[1,11],hB:[0,8],kF:[8,18],fF:[8,22],kB:[2,18],fB:[2,22]});
export const LANDP = po({head:[5,7],neck:[5,10],hip:[5,16],eF:[8,14],hF:[8,17],eB:[2,14],hB:[2,17],kF:[8,19],fF:[7,22],kB:[2,19],fB:[3,22]});
export const SLIDEP = po({head:[5,5],neck:[5,9],hip:[5,15],eF:[8,8],hF:[10,4],eB:[3,12],hB:[2,15],kF:[7,17],fF:[7,21],kB:[3,18],fB:[3,22]});
export const STUNP = po({head:[5,10],neck:[5,13],hip:[5,17],eF:[8,16],hF:[9,20],eB:[2,16],hB:[2,20],kF:[7,20],fF:[8,22],kB:[3,20],fB:[2,22]});
/* руки прижаты, корпус скрючен — обвили водоросли */
export const SNAREP = po({head:[5,8],neck:[5,11],hip:[5,16],eF:[7,14],hF:[8,17],eB:[3,14],hB:[2,17],kF:[7,19],fF:[8,22],kB:[3,19],fB:[2,22]});
export const ROLLP = po({head:[5,7],neck:[5,9],hip:[5,13],eF:[8,10],hF:[7,13],eB:[2,10],hB:[3,13],kF:[8,13],fF:[6,16],kB:[2,13],fB:[4,16]});
export const LADP0 = po({head:[5,5],neck:[5,9],hip:[5,15],eF:[6,7],hF:[5,2],eB:[5,10],hB:[6,8],kF:[7,17],fF:[6,21],kB:[4,18],fB:[5,23]});
export const LADP1 = po({head:[5,5],neck:[5,9],hip:[5,15],eF:[5,10],hF:[6,7],eB:[6,6],hB:[5,2],kF:[6,18],fF:[5,23],kB:[5,17],fB:[6,21]});
export const LADF0 = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[8,8],hF:[8,2],eB:[2,8],hB:[2,6],kF:[7,17],fF:[7,21],kB:[3,18],fB:[3,22]});
export const LADF1 = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[8,8],hF:[8,6],eB:[2,8],hB:[2,2],kF:[7,18],fF:[7,22],kB:[3,17],fB:[3,20]});
export const ATK0 = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[3,10],hF:[2,5],eB:[6,11],hB:[7,14],kF:[7,18],fF:[8,22],kB:[3,18],fB:[2,22]});
export const ATK1 = po({head:[5,4],neck:[5,8],hip:[5,14],eF:[8,9],hF:[12,10],eB:[4,11],hB:[3,14],kF:[8,18],fF:[9,22],kB:[3,17],fB:[2,21]});
export const ATK2 = po({head:[5,5],neck:[5,9],hip:[5,15],eF:[8,12],hF:[11,16],eB:[3,12],hB:[2,15],kF:[7,18],fF:[8,22],kB:[3,18],fB:[2,22]});
export const CROUCH = po({head:[5,3],neck:[5,6],hip:[5,10],eF:[7,8],hF:[8,11],eB:[3,8],hB:[3,11],kF:[8,12],fF:[6,14],kB:[3,12],fB:[3,14]});
export const CROUCH_W = po({head:[5,3],neck:[5,6],hip:[5,10],eF:[7,8],hF:[6,12],eB:[3,8],hB:[4,11],kF:[8,11],fF:[8,14],kB:[3,12],fB:[2,14]});
export const PRONE0 = po({head:[14,2],neck:[12,3],hip:[6,5],eF:[14,5],hF:[17,6],eB:[11,6],hB:[14,7],kF:[3,6],fF:[0,7],kB:[3,7],fB:[1,8]});
export const PRONE1 = po({head:[14,2],neck:[12,3],hip:[6,5],eF:[15,6],hF:[17,7],eB:[10,5],hB:[13,6],kF:[3,5],fF:[0,6],kB:[3,7],fB:[1,8]});
export const BARS0 = po({head:[5,7],neck:[5,10],hip:[5,16],eF:[6,5],hF:[7,1],eB:[4,6],hB:[3,2],kF:[6,20],fF:[6,24],kB:[4,20],fB:[4,24]});
export const BARS1 = po({head:[5,7],neck:[5,10],hip:[5,16],eF:[7,4],hF:[9,1],eB:[3,6],hB:[2,2],kF:[7,20],fF:[8,23],kB:[4,20],fB:[3,24]});
export const LADD0 = po({head:[6,5],neck:[6,9],hip:[4,15],eF:[8,7],hF:[9,3],eB:[5,10],hB:[4,7],kF:[6,18],fF:[5,22],kB:[3,18],fB:[2,21]});
export const LADD1 = po({head:[6,5],neck:[6,9],hip:[4,15],eF:[7,10],hF:[8,6],eB:[6,6],hB:[7,2],kF:[5,18],fF:[3,21],kB:[4,18],fB:[5,23]});
export const SWIM0 = po({head:[13,5],neck:[11,6],hip:[5,8],eF:[13,8],hF:[16,9],eB:[10,9],hB:[13,11],kF:[2,9],fF:[-1,8],kB:[2,11],fB:[-1,12]});
export const SWIM1 = po({head:[13,5],neck:[11,6],hip:[5,8],eF:[9,9],hF:[6,11],eB:[12,7],hB:[15,6],kF:[2,10],fF:[-1,13],kB:[2,8],fB:[-1,7]});
export const DIVE0 = po({head:[5,19],neck:[5,15],hip:[5,9],eF:[7,17],hF:[8,21],eB:[3,17],hB:[2,21],
                kF:[6,5],fF:[6,0],kB:[4,5],fB:[4,0]});
export const DIVE1 = po({head:[5,19],neck:[5,15],hip:[5,9],eF:[7,18],hF:[7,22],eB:[3,18],hB:[3,22],
                kF:[7,5],fF:[8,1],kB:[3,5],fB:[2,1]});
export const HANGL = po({head:[5,8],neck:[5,11],hip:[5,17],eF:[7,5],hF:[7,2],eB:[3,6],hB:[3,3],kF:[6,21],fF:[6,26],kB:[4,21],fB:[3,25]});
/* угловые позы (x — в сторону платформы) */
export const HANG_A = po({head:[-5,3],neck:[-5,7],hip:[-5,14],eF:[-2,3],hF:[0,0],eB:[-4,4],hB:[-2,1],kF:[-3,19],fF:[-4,24],kB:[-6,19],fB:[-7,23]});
export const HANG_B = po({head:[-5,4],neck:[-5,8],hip:[-5,15],eF:[-2,4],hF:[0,0],eB:[-4,5],hB:[-2,1],kF:[-3,20],fF:[-4,25],kB:[-6,20],fB:[-7,24]});
export const CL_K = [HANG_A,
  po({head:[-4,-2],neck:[-4,2],hip:[-4,9],eF:[0,-4],hF:[0,0],eB:[-4,-3],hB:[-2,1],kF:[-1,13],fF:[-3,17],kB:[-5,13],fB:[-7,16]}),
  po({head:[-1,-8],neck:[-1,-4],hip:[0,3],eF:[2,-6],hF:[3,-2],eB:[-3,-3],hB:[-2,0],kF:[4,0],fF:[1,4],kB:[-3,7],fB:[-5,11]}),
  po({head:[5,-13],neck:[5,-10],hip:[5,-4],eF:[8,-10],hF:[8,-6],eB:[2,-10],hB:[3,-7],kF:[8,-2],fF:[7,0],kB:[4,-2],fB:[4,0]}),
  po({head:[8,-18],neck:[8,-14],hip:[8,-8],eF:[10,-11],hF:[10,-7],eB:[6,-11],hB:[6,-7],kF:[9,-4],fF:[9,0],kB:[7,-4],fB:[7,0]})];
export const CL_T = [0, 0.32, 0.60, 0.82, 1.0];
export function lerpPose(a, b, t){
  var o = {}, i, k;
  for (i = 0; i < K.length; i++){ k = K[i];
    o[k] = [a[k][0] + (b[k][0]-a[k][0])*t, a[k][1] + (b[k][1]-a[k][1])*t]; }
  return o;
}
export function climbPose(t){
  if (t <= 0) return CL_K[0];
  if (t >= 1) return CL_K[4];
  for (var i = 1; i < CL_T.length; i++)
    if (t <= CL_T[i]) return lerpPose(CL_K[i-1], CL_K[i], (t-CL_T[i-1])/(CL_T[i]-CL_T[i-1]));
  return CL_K[4];
}
export function vaultPose(t){
  if (t <= 0) return RUN_0;
  if (t >= 1) return RUN_1;
  return t <= 0.5 ? lerpPose(RUN_0, VAULT_B, t/0.5) : lerpPose(VAULT_B, RUN_1, (t-0.5)/0.5);
}
export function pickPose(t){
  if (t <= 0) return IDLE_A;
  if (t >= 1) return IDLE_A;
  return t <= 0.45 ? lerpPose(IDLE_A, PICK_B, t/0.45) : lerpPose(PICK_B, IDLE_A, (t-0.45)/0.55);
}
export function throwPose(t){
  if (t <= 0) return IDLE_A;
  if (t >= 1) return IDLE_A;
  return t <= 0.4 ? lerpPose(IDLE_A, THROW_B, t/0.4) : lerpPose(THROW_B, IDLE_A, (t-0.4)/0.6);
}
/* подъём после высокого падения — из лёжки через присед на ноги */
export function getupPose(t){
  if (t <= 0) return PRONE0;
  if (t >= 1) return IDLE_A;
  return t <= 0.5 ? lerpPose(PRONE0, CROUCH, t/0.5) : lerpPose(CROUCH, IDLE_A, (t-0.5)/0.5);
}

/* лук — держится в дальней от камеры руке (eB/hB), поднят и вынесен вперёд,
   не двигается через весь цикл. Ближняя рука (eF/hF) в стойке опущена; на
   натяжении берёт тетиву по центру и тянет строго горизонтально назад. */
export const BOW_STANCE = po({head:[5,4],neck:[5,8],hip:[5,14], eF:[7,11],hF:[7,15], eB:[9,6],hB:[15,6], kF:[8,17],fF:[9,21],kB:[3,19],fB:[2,22]});
export const BOW_DRAW   = po({head:[5,4],neck:[5,8],hip:[5,14], eF:[3,6], hF:[-1,6],eB:[9,6],hB:[15,6], kF:[8,17],fF:[9,21],kB:[3,19],fB:[2,22]});
export const BOW_RELEASE= po({head:[5,3],neck:[5,7],hip:[5,14], eF:[2,4], hF:[-2,2],eB:[9,6],hB:[15,6], kF:[8,17],fF:[9,21],kB:[3,19],fB:[2,22]});
/* t — доля цикла выстрела (0..1): сразу поза полного натяга (без замаха) -> резкий спуск -> сброс в стойку */
export function bowPose(t){
  if (t <= 0 || t >= 1) return BOW_STANCE;
  if (t < 0.6) return BOW_DRAW;
  if (t < 0.72) return lerpPose(BOW_DRAW, BOW_RELEASE, (t-0.6)/0.12);
  return lerpPose(BOW_RELEASE, BOW_STANCE, (t-0.72)/0.28);
}
/* кисть на тетиве, пока держим полный натяг — вне этого окна тетива рисуется прямой */
export function bowHandOnString(t){ return t > 0 && t < 0.6; }
/* окно сразу после спуска — тетива уже прямая и независима от кисти */
export function bowReleaseFx(t){ return t >= 0.6 && t < 0.9; }

/* рука с крюком: 45° вперёд или строго вверх */
export const GRAPPLE_D = po({head:[5,3],neck:[5,7],hip:[5,14],eF:[9,6],hF:[13,2],eB:[4,10],hB:[3,13],kF:[7,17],fF:[8,21],kB:[3,18],fB:[3,22]});
export const GRAPPLE_U = po({head:[5,2],neck:[5,6],hip:[5,14],eF:[6,3],hF:[6,-2],eB:[4,10],hB:[3,14],kF:[7,17],fF:[7,21],kB:[3,18],fB:[3,22]});
