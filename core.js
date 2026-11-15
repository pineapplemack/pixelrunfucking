'use strict';

/* ===================== 全局常量 ===================== */
const TILE = 16;
const VW = 40, VH = 22;
const W = VW * TILE;      // 640
const H = VH * TILE;      // 352
const GROUND_ROW = 18;    // 地面顶部所在行

/* 渲染：世界画布 1280×704，每个美术像素 1.75 画布像素，每个世界像素 2 美术像素 */
const ART = 2;
const PPA = 1.75;
const CW = 1280, CH = 704;
const VIEW_W = CW / PPA / ART;   // 世界单位视野宽 ≈ 365.7
const VIEW_H = CH / PPA / ART;   // 世界单位视野高 ≈ 201.1：视野约 23×13 格

const T = { EMPTY: 0, GROUND: 1, BRICK: 2, QCOIN: 3, QPOWER: 4, HARD: 5, PIPE: 6, USED: 7 };

function isSolid(t) { return t > 0 && t < 8; }

/* 物理参数（与角色技能单保持一致） */
const GRAV_UP = 1500, GRAV_DOWN = 2100, MAX_FALL = 480;
const WALK_V = 120, RUN_V = 180, ACC = 900, FRIC = 1400;
const JUMP_V = 470, JUMP_CUT = 175, JUMP_HOLD = 0.085;
const JUMP_V2 = 395, JUMP_HOLD2 = 0.06;
const COYOTE = 0.10, JUMP_BUF = 0.15;
const SPRING_V = 760;
const DASH_V = 340, DASH_T = 0.16, DASH_CD = 1.0;

/* ===================== 小工具 ===================== */
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function irnd(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
