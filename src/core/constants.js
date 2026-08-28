export const T = 16;
export const E = 0, ROCK = 1, CRUMB = 2, LADW = 3, LADF = 4, LADR = 5, LADL = 6, HTOP = 7, BAR = 8;
/* скосы: пол поднимается вправо (SLR*) или влево (SLL*); RND* — скруглённые углы (только вид) */
export const SLR = 9, SLL = 10, RNDA = 11, RNDB = 12, WATER = 13, FALL = 14;
/* 2:1 — полтайла за тайл; 4:1 — четверть; *C* — квадратичная дуга */
export const SLR2 = 15, SLR3 = 16, SLL2 = 17, SLL3 = 18;
export const SLR4A = 19, SLR4B = 20, SLR4C = 21, SLR4D = 22;
export const SLL4A = 23, SLL4B = 24, SLL4C = 25, SLL4D = 26;
export const SLRCA = 27, SLRCB = 28, SLLCB = 29, SLLCA = 30;
/* PLANK — деревянный настил (сгорает от факела навсегда); GIVE — пружинящий блок (проседает под ногами) */
export const PLANK = 31, GIVE = 32;

export const C = {
  W: 10, H: 22, RH: 12, CRH: 14, PRH: 8, PRW: 17,
  GRAV: 700, MAXFALL: 340, RUN: 92, ACC: 950, FRIC: 1200,
  SLOPE_ALONG: 0.9,                                    // вдоль скоса чуть тише бега (не гипотенуза)
  STEP_UP: 3,                                           // авто-подъём ноги на ступеньку при ходьбе (px, moveX)
  JUMP: -236, CUT: 0.45, COYOTE: 0.09, BUF: 0.12,
  HAND: 3, TOL_UP: 3, TOL_DN: 6, GRAB_VY: -130, GRAB_CD: 0.2,
  /* plat grab: |handX−lip| и |handY−deck|; отдельно от tile TOL_UP/DN */
  PLAT_GRAB: 12, PLAT_GRAB_Y: 9,
  CLIMB_UP: 0.5, CLIMB_DN: 0.46, TO_LAD: 0.3, VAULT_T: 0.24,
  CLIMB_WALL_TILES: 3,                                 // упор+вверх с земли лезет на стену высотой до стольки тайлов (как обычный прыжок+хват)
  STAND_OFF: 8,
  SLIDE_V: 62, WJ_X: 118, WJ_Y: -178, WJ_LOCK: 0.19, WJ_SAME_Y: -126, WJ_SAME_X: 74,
  WALK_V: 42, THROW_X: 155, THROW_Y: -135, ACT_R: 26, PUSH_V: 14,
  ATK_T: 0.3, ATK_R: 26, ATK_CD: 0.16, HURT_CD: 1.0, PICK_T: 0.32, THROW_T: 0.2, STANCE_T: 0.13,
  DIG_T: 0.36, DIG_CD: 0.12, DIG_SHAKE_T: 0.18,
  EDGE_HOLD: 0.2,
  LAD_SNAP: 0.14, AIR_MAX: 11, STAM_MAX: 2.2, DASH_V: 128, SWIM_V: 62, SWIM_UP: -90, SWIM_DN: 40, SWIM_JUMP: -236, CROUCH_V: 40, PRONE_V: 26, BAR_V: 52, LIFT_V: 42, LIFT_DWELL: 1.6, WARP_T: 0.62,
  SCUBA_AIR: 40, FLIP_MUL: 1.35, HARPOON_V: 220,
  HARPOON_LEN: T * 9, HARPOON_PULL: 250, HARPOON_DETACH: 24, HARPOON_CD: 0.22,
  ARROW_V: 190, ARROW_FLAT: T*6, ARROW_GRAV: 620, BOW_ANIM_T: 0.4, BOW_CD: 0.5,
  TEND_REACH: 88, TEND_HOLD: 2.6,
  /* верёвки: Verlet, climb, swing */
  ROPE_SEGS: 8, ROPE_ELAST: 0.25, ROPE_SWING: 200, ROPE_DAMP: 0.98,
  ROPE_WIND: 2.2, ROPE_CLIMB: 52, ROPE_GRAB: 14, ROPE_ITERS: 6, ROPE_CD: 0.28,
  ROPE_SWING_CD: 0.22,
  /* отступ ноды от solid после выталкивания */
  ROPE_COL_EPS: 0.75,
  ROLL_V: 152, ROLL_T: 0.42, ROLL_CD: 0.14,
  LAD_V: 58, LAD_TOL: 6, LAD_XTOL: 11,
  SAFE: 46, HURT: 104, HITSTOP: 0.055,
  /* rollland: при fall > ROLL_HURT всё ещё 1 урон (раньше HURT*1.6) */
  ROLL_HURT: 166, ROLL_HURT_T: 0.35,
  FALL_CROUCH_T: 0.55, FALL_PRONE_T: 1.2, GETUP_T: 0.5,
  CRUMB_T: 1.05,
  PLANK_BURN: 1.6,
  ROOM_FADE: 0.55,
  /* камера: мёртвая зона, резинка, взгляд вперёд / вверх-вниз */
  CAM_DZ_X: 10, CAM_DZ_Y: 8,
  CAM_FOLLOW: 6.5, CAM_SNAP: 1, CAM_SUBPX: 1,
  CAM_LEAD: 20, CAM_LEAD_IDLE: 0.35, CAM_LEAD_V: 30, CAM_LEAD_K: 3.2,
  CAM_LOOK_DN: 44, CAM_LOOK_UP: -30, CAM_LOOK_V: 10, CAM_LOOK_K: 2.2
};
