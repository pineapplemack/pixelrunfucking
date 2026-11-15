'use strict';

/* ===================== 关卡构建器 ===================== */
class LevelBuilder {
  constructor(w, h) {
    this.w = Math.max(w || 40, 40);
    this.h = h || VH;
    this.tiles = [];
    for (let y = 0; y < this.h; y++) this.tiles.push(new Array(this.w).fill(T.EMPTY));
    this.ents = [];
    this.spawn = { tx: 2, ty: GROUND_ROW };
    this.goal = null;
    this.name = '';
    this.index = 0;
  }

  ensure(w) {
    if (w <= this.w) return;
    for (let y = 0; y < this.h; y++) {
      while (this.tiles[y].length < w) this.tiles[y].push(T.EMPTY);
    }
    this.w = w;
  }

  set(x, y, t) {
    if (x < 0 || y < 0 || y >= this.h) return;
    this.ensure(x + 1);
    this.tiles[y][x] = t;
  }

  get(x, y) {
    if (x < 0 || y < 0 || y >= this.h || x >= this.w) return T.EMPTY;
    return this.tiles[y][x];
  }

  floor(x0, x1, top) {
    const tp = top === undefined ? GROUND_ROW : top;
    for (let x = x0; x <= x1; x++) {
      for (let y = tp; y < this.h; y++) this.set(x, y, T.GROUND);
    }
  }

  pit(x0, x1, top) {
    const tp = top === undefined ? GROUND_ROW : top;
    for (let x = x0; x <= x1; x++) {
      for (let y = tp; y < this.h; y++) this.set(x, y, T.EMPTY);
    }
  }

  row(x0, x1, y, t) {
    for (let x = x0; x <= x1; x++) this.set(x, y, t);
  }

  block(x, y, t) { this.set(x, y, t); }

  pipe(x, height, flower) {
    for (let i = 0; i < height; i++) {
      this.set(x, GROUND_ROW - 1 - i, T.PIPE);
      this.set(x + 1, GROUND_ROW - 1 - i, T.PIPE);
    }
    if (flower) this.ents.push({ kind: 'piranha', x: (x) * TILE + 1, y: (GROUND_ROW - height) * TILE, base: (GROUND_ROW - height) * TILE });
  }

  coins(x0, n, y) {
    for (let i = 0; i < n; i++) this.ents.push({ kind: 'coin', x: (x0 + i) * TILE, y: y * TILE });
  }

  coinArc(cx, n, y) {
    for (let i = 0; i < n; i++) {
      const dy = Math.round(Math.sin((i / (n - 1)) * Math.PI) * 2);
      this.ents.push({ kind: 'coin', x: (cx + i) * TILE, y: (y - dy) * TILE });
    }
  }

  stairs(x, n, dir) {
    for (let i = 0; i < n; i++) {
      const hgt = dir > 0 ? i + 1 : n - i;
      for (let k = 0; k < hgt; k++) this.set(x + i, GROUND_ROW - 1 - k, T.HARD);
    }
  }

  ent(kind, tx, ty) {
    this.ents.push({ kind, x: tx * TILE, y: (ty === undefined ? GROUND_ROW : ty) * TILE });
  }

  altar(tx, weapon) {
    this.ents.push({ kind: 'altar', weapon, x: tx * TILE + 8, y: GROUND_ROW * TILE });
  }

  weapon(tx, weapon, ty) {
    const row = typeof ty === 'number' ? ty : GROUND_ROW - 1;
    this.ents.push({ kind: 'weapon', weapon, x: tx * TILE + 8, y: row * TILE });
  }

  box(tx, type) {
    this.ents.push({ kind: 'box', box: type, x: tx * TILE, y: (GROUND_ROW - 1) * TILE });
  }

  spring(tx) {
    this.ents.push({ kind: 'spring', x: tx * TILE, y: (GROUND_ROW - 1) * TILE + 4 });
  }

  spawner(tx, kind, interval) {
    this.ents.push({ kind: 'spawner', spawnKind: kind || 'goomba', interval: interval || 2.6, x: tx * TILE, y: GROUND_ROW * TILE });
  }

  mplat(tx, ty, range, speed) {
    this.ents.push({ kind: 'mplat', x: tx * TILE, y: ty * TILE, range: range * TILE, speed: speed || 45 });
  }

  setGoal(tx) { this.goal = { x: tx * TILE, y: (GROUND_ROW - 6) * TILE }; }

  /* 地底关：加顶棚 + 主题 */
  caveCeil(thick) {
    this.theme = 'cave';
    const th = thick || 2;
    for (let y = 0; y < th; y++) this.row(0, this.w - 1, y, T.HARD);
    return this;
  }

  /* 结束在管道里（进入管道 = 过关） */
  pipeExit(tx) {
    for (let i = 0; i < 4; i++) {
      this.set(tx, GROUND_ROW - 1 - i, T.PIPE);
      this.set(tx + 1, GROUND_ROW - 1 - i, T.PIPE);
    }
    /* 后面的岩壁，避免玩家跳过管道跑出关卡 */
    for (let y = 6; y < GROUND_ROW; y++) {
      this.set(tx + 2, y, T.HARD);
      this.set(tx + 3, y, T.HARD);
    }
    this.goal = { x: tx * TILE, y: (GROUND_ROW - 4) * TILE, w: 2 * TILE, h: 4 * TILE, kind: 'pipe' };
  }
}

/* ===================== 五关手工关卡 ===================== */
/* 高度约定（跳跃最高约 70px ≈ 4.4 格）：
   可站立平台 → 第 14 行及以下；可顶砖块 → 第 13 行及以下；金币 → 第 12 行及以下 */

/* ============================================================
 *  正片关卡：把教程里的东西全部混起来，随着 n 变难
 *  n = 1..9
 * ============================================================ */
function mainStage(n, b) {
  const W = 148 + n * 10;
  b.floor(0, W);

  /* ---- 坑：3+n 个，越后越宽 ---- */
  const pits = 3 + n;
  const span = Math.floor((W - 46) / pits);
  const pitRanges = [];
  for (let i = 0; i < pits; i++) {
    const x = 20 + i * span + (i % 3);
    const pw = 3 + (n >= 6 ? 1 : 0);          /* 跨 3~4 格 */
    b.pit(x, x + pw - 1);
    pitRanges.push([x - 2, x + pw + 2]);
    /* 宽坑中间给一块落脚石，保证正常跳能过去 */
    if (pw >= 4) b.row(x, x + 2, GROUND_ROW - 2, T.HARD);
    if (n >= 4) b.mplat(x, GROUND_ROW - 4, 3, 52 + n * 5);
  }
  const onGround = (tx) => !pitRanges.some(([a, c]) => tx >= a && tx <= c);

  /* ---- 竖塔：2~5 座，最多 3 层 ---- */
  const towers = 1 + Math.floor(n / 2);
  const tSpan = Math.floor((W - 50) / towers);
  for (let i = 0; i < towers; i++) {
    let x = 32 + i * tSpan;
    /* 塔不能压在坑上，否则跳坑会撞头 */
    let guard = 0;
    while (pitRanges.some(([a, c]) => x + 7 >= a && x <= c) && guard++ < 24) x += 3;
    const h = Math.min(3, 1 + Math.floor((n + 1) / 3));
    for (let k = 0; k < h; k++) {
      b.row(x + k * 2, x + 7 + k * 2, GROUND_ROW - 4 - k * 3, T.HARD);
    }
    b.coins(x + 3, 3, GROUND_ROW - 5 - (h - 1) * 3);
  }

  /* ---- 敌人：数量随关数上升 ---- */
  const put = (kind, count, from, gap) => {
    let c = 0;
    for (let i = 0; i < count * 3 && c < count; i++) {
      const tx = from + i * gap;
      if (tx < W - 12 && onGround(tx)) { b.ent(kind, tx, GROUND_ROW); c++; }
    }
  };
  put('goomba', 2 + n, 14, 13);
  put('koopa', Math.min(4, n), 22, 17);
  put('spitter', Math.min(4, n - 1), 30, 19);
  put('charger', Math.min(4, n - 2), 40, 23);
  put('spike', Math.min(4, n - 3), 26, 21);
  put('bomber', Math.min(3, n - 3), 48, 24);
  for (let i = 0; i < Math.min(3, n - 2); i++) {
    b.ent('bat', 36 + i * 22, 6 + (i % 2) * 3);
  }
  for (let i = 0; i < Math.min(2, n - 2); i++) {
    b.ent('flyer', 44 + i * 27, 10);
  }

  /* ---- 刷怪笼：第 4 关起出现 ---- */
  const sp = Math.max(0, n - 3);
  for (let i = 0; i < sp; i++) {
    const tx = 30 + i * Math.floor((W - 50) / Math.max(1, sp));
    if (onGround(tx)) b.spawner(tx, i % 2 ? 'goomba' : 'spitter', Math.max(1.6, 3.4 - n * 0.18));
  }

  /* ---- 箱子 / 弹簧 ---- */
  b.box(16, 'weapon');
  b.box(Math.floor(W * 0.5), n >= 6 ? 'trap' : 'mystery');
  b.box(Math.floor(W * 0.78), 'mystery');
  if (n >= 3) b.box(Math.floor(W * 0.62), 'bomb');
  b.spring(Math.floor(W * 0.35));
  if (n >= 2) b.spring(Math.floor(W * 0.72));

  /* ---- 武器：越后面给得越少 ---- */
  if (n <= 2) b.altar(Math.floor(W * 0.22), 'sword');
  if (n <= 4) b.altar(Math.floor(W * 0.55), 'wand');
  if (n <= 3) b.weapon(Math.floor(W * 0.85), 'hammer');

  /* ---- 金币点缀 ---- */
  for (let i = 0; i < 4; i++) {
    const cx = 24 + i * Math.floor((W - 40) / 4);
    if (onGround(cx)) b.coinArc(cx, 5, GROUND_ROW - 4);
  }

  b.stairs(W - 18, 4, 1);
  if (n === 9) b.pipeExit(W - 7); else b.setGoal(W - 7);
  b.name = '第 ' + n + ' 关';
}

const TUTORIAL_N = 10;
const HANDMADE = [
  {
    name: '教程 1 · 走与跳',
    build(b) {
      b.floor(0, 123);
      b.pit(30, 32);
      b.pit(58, 60);
      b.pit(86, 88);
      b.coins(10, 3, 15);
      b.coinArc(40, 6, 14);
      b.coins(72, 4, 15);
      b.coins(66, 2, 15);
      b.block(20, 14, T.QCOIN);
      b.altar(24, 'sword');
      b.block(50, 14, T.QCOIN);
      b.weapon(76, 'hammer');
      b.box(34, 'coin');
      b.box(48, 'mystery');
      b.ent('goomba', 42, 18);
      b.ent('goomba', 70, 18);
      b.ent('goomba', 100, 18);
      b.setGoal(112);
      b.name = '教程 1 · 走与跳';
    }
  },
  {
    name: '教程 2 · 砖块与金币',
    build(b) {
      b.floor(0, 131);
      b.row(16, 22, 14, T.BRICK);
      b.block(19, 14, T.QPOWER);
      b.coins(17, 2, 12);
      b.coins(21, 2, 12);
      b.row(38, 45, 13, T.BRICK);
      b.block(41, 13, T.QCOIN);
      b.block(44, 13, T.QCOIN);
      b.coinArc(52, 6, 14);
      b.pit(62, 64);
      b.row(74, 82, 14, T.HARD);
      b.coins(75, 6, 12);
      b.altar(28, 'wand');
      b.box(14, 'weapon');
      b.box(46, 'mystery');
      b.spring(58);
      b.weapon(84, 'boom');
      b.ent('spitter', 34, 18);
      b.ent('goomba', 30, 18);
      b.ent('goomba', 70, 18);
      b.ent('koopa', 90, 18);
      b.pit(96, 97);
      b.ent('goomba', 108, 18);
      b.block(112, 14, T.QPOWER);
      b.row(114, 118, 14, T.BRICK);
      b.setGoal(122);
      b.name = '教程 2 · 砖块与金币';
    }
  },
  {
    name: '教程 3 · 敌人与踩踏',
    build(b) {
      b.floor(0, 135);
      b.ent('goomba', 14, 18);
      b.ent('goomba', 18, 18);
      b.ent('goomba', 22, 18);
      b.pit(30, 31);
      b.row(36, 44, 15, T.HARD);
      b.coins(37, 6, 13);
      b.ent('koopa', 50, 18);
      b.ent('koopa', 54, 18);
      b.pit(62, 64);
      b.ent('goomba', 70, 18);
      b.ent('goomba', 73, 18);
      b.ent('goomba', 76, 18);
      b.stairs(84, 4, 1);
      b.stairs(88, 4, -1);
      b.coinArc(96, 6, 14);
      b.ent('koopa', 104, 18);
      b.ent('goomba', 110, 18);
      b.altar(26, 'hammer');
      b.box(20, 'trap');
      b.box(58, 'bomb');
      b.spawner(100, 'goomba', 3.2);
      b.ent('charger', 44, 18);
      b.weapon(96, 'shot');
      b.ent('flyer', 116, 11);
      b.ent('spike', 118, 18);
      b.pit(120, 121);
      b.setGoal(126);
      b.name = '教程 3 · 敌人与踩踏';
    }
  },
  {
    name: '教程 4 · 沟壑与浮岛',
    build(b) {
      b.floor(0, 139);
      b.pit(18, 25);
      b.row(20, 22, 15, T.HARD);
      b.row(24, 25, 14, T.HARD);
      b.coins(20, 3, 13);
      b.pit(38, 46);
      b.row(40, 42, 15, T.HARD);
      b.row(44, 45, 14, T.HARD);
      b.coinArc(40, 4, 12);
      b.ent('flyer', 42, 10);
      b.pit(56, 62);
      b.row(58, 60, 15, T.HARD);
      b.ent('goomba', 70, 18);
      b.stairs(76, 4, 1);
      b.stairs(80, 2, -1);
      b.pit(88, 92);
      b.row(90, 92, 16, T.HARD);
      b.ent('koopa', 100, 18);
      b.ent('goomba', 104, 18);
      b.pit(110, 118);
      b.row(112, 114, 15, T.HARD);
      b.row(116, 117, 14, T.HARD);
      b.coinArc(112, 5, 12);
      b.ent('flyer', 114, 9);
      b.mplat(30, 13, 6, 55);
      b.mplat(64, 12, 5, 65);
      b.box(50, 'mystery');
      b.box(84, 'coin');
      b.ent('spitter', 74, 18);
      b.ent('charger', 98, 18);
      b.weapon(120, 'laser');
      b.setGoal(130);
      b.name = '教程 4 · 沟壑与浮岛';
    }
  },
  {
    name: '教程 5 · 综合',
    build(b) {
      b.floor(0, 151);
      b.pipe(14, 2);
      b.pipe(20, 3, true);
      b.ent('goomba', 26, 18);
      b.row(32, 38, 14, T.BRICK);
      b.block(35, 14, T.QPOWER);
      b.pit(44, 46);
      b.ent('koopa', 52, 18);
      b.stairs(56, 4, 1);
      b.stairs(60, 4, -1);
      b.pit(70, 72);
      b.ent('goomba', 76, 18);
      b.ent('flyer', 80, 10);
      b.pipe(84, 3, true);
      b.coinArc(92, 6, 14);
      b.pit(100, 103);
      b.row(101, 102, 16, T.HARD);
      b.ent('koopa', 108, 18);
      b.ent('goomba', 112, 18);
      b.ent('goomba', 115, 18);
      b.row(120, 126, 14, T.HARD);
      b.coins(121, 5, 12);
      b.box(40, 'bomb');
      b.spring(66);
      b.spawner(118, 'spitter', 3.0);
      b.ent('charger', 104, 18);
      b.ent('spitter', 124, 18);
      b.weapon(127, 'shot');
      b.ent('spike', 133, 18);
      b.pit(130, 132);
      b.stairs(136, 4, 1);
      b.setGoal(144);
      b.name = '教程 5 · 综合';
    }
  }
  ,
  {
    name: '教程 6 · 弹簧与平台',
    build(b) {
      b.floor(0, 149);
      b.pit(24, 27);
      b.pit(52, 56);
      b.pit(88, 93);
      b.pit(120, 124);
      b.mplat(25, 15, 4, 60);
      b.mplat(53, 14, 4, 70);
      b.mplat(89, 15, 5, 65);
      b.mplat(121, 14, 4, 55);
      b.spring(40);
      b.spring(76);
      b.spring(110);
      b.row(40, 43, 10, T.HARD);
      b.coins(41, 3, 9);
      b.row(76, 79, 10, T.HARD);
      b.coins(77, 3, 9);
      b.box(34, 'mystery');
      b.box(100, 'weapon');
      b.box(136, 'coin');
      b.ent('flyer', 62, 10);
      b.ent('goomba', 70, 18);
      b.ent('spitter', 106, 18);
      b.ent('koopa', 104, 18);
      /* 垂直塔 */
      b.row(28, 34, 14, T.HARD);
      b.row(30, 36, 11, T.HARD);
      b.coins(31, 3, 10);
      b.row(108, 114, 14, T.HARD);
      b.row(110, 116, 11, T.HARD);
      b.row(112, 118, 8, T.HARD);
      b.coins(113, 3, 7);
      b.ent('bat', 96, 8);
      b.setGoal(140);
      b.name = '教程 6 · 弹簧与平台';
    }
  },
  {
    name: '教程 7 · 刷怪笼',
    build(b) {
      b.floor(0, 159);
      b.pit(30, 33);
      b.pit(70, 74);
      b.pit(110, 114);
      b.pit(140, 143);
      b.spawner(20, 'goomba', 2.6);
      b.spawner(50, 'spitter', 3.2);
      b.spawner(96, 'charger', 4.2);
      b.spawner(130, 'goomba', 2.2);
      b.box(44, 'weapon');
      b.box(84, 'bomb');
      b.box(124, 'mystery');
      b.box(150, 'coin');
      b.altar(60, 'wand');
      b.ent('charger', 40, 18);
      b.ent('spike', 104, 18);
      /* 高层结构 + 空中怪 */
      b.row(74, 80, 13, T.HARD);
      b.row(76, 82, 10, T.HARD);
      b.coins(77, 3, 9);
      b.ent('bat', 70, 7);
      b.ent('bat', 118, 6);
      b.ent('bomber', 88, 18);
      b.row(116, 122, 14, T.HARD);
      b.coins(117, 4, 13);
      b.setGoal(152);
      b.name = '教程 7 · 刷怪笼';
    }
  },
  {
    name: '教程 8 · 箱子陷阱',
    build(b) {
      b.floor(0, 159);
      b.pit(26, 29);
      b.pit(64, 68);
      b.pit(100, 104);
      b.pit(134, 138);
      b.box(12, 'trap');
      b.box(18, 'mystery');
      b.box(24, 'coin');
      b.box(36, 'bomb');
      b.box(48, 'weapon');
      b.box(58, 'trap');
      b.box(72, 'mystery');
      b.box(80, 'coin');
      b.box(92, 'bomb');
      b.box(110, 'trap');
      b.box(118, 'weapon');
      b.box(128, 'mystery');
      b.box(144, 'coin');
      b.spring(52);
      b.spring(122);
      b.ent('spitter', 34, 18);
      b.ent('goomba', 74, 18);
      b.ent('charger', 108, 18);
      b.ent('flyer', 96, 11);
      /* 垂直井：三层平台 */
      b.row(54, 60, 14, T.HARD);
      b.row(56, 62, 11, T.HARD);
      b.row(54, 58, 8, T.HARD);
      b.coins(55, 3, 7);
      b.box(57, 'mystery');
      b.ent('bomber', 66, 18);
      b.row(124, 130, 13, T.HARD);
      b.coins(125, 4, 12);
      b.setGoal(150);
      b.name = '教程 8 · 箱子陷阱';
    }
  },
  {
    name: '教程 9 · 墓园之路',
    build(b) {
      b.floor(0, 169);
      b.pit(22, 26);
      b.pit(48, 52);
      b.pit(78, 82);
      b.pit(108, 112);
      b.pit(140, 145);
      b.spawner(30, 'charger', 4.4);
      b.spawner(66, 'spitter', 2.8);
      b.spawner(96, 'goomba', 2.0);
      b.spawner(126, 'charger', 3.6);
      b.spawner(156, 'spitter', 2.4);
      b.ent('spike', 42, 18);
      b.ent('spike', 88, 18);
      b.ent('spike', 130, 18);
      b.ent('flyer', 60, 10);
      b.ent('flyer', 118, 10);
      b.box(56, 'weapon');
      b.box(102, 'mystery');
      b.box(148, 'coin');
      b.spring(34);
      b.mplat(49, 14, 3, 55);
      b.mplat(109, 13, 3, 65);
      /* 墓园双塔 */
      b.row(56, 62, 14, T.HARD);
      b.row(58, 64, 11, T.HARD);
      b.row(60, 66, 8, T.HARD);
      b.coins(61, 3, 7);
      b.row(118, 124, 14, T.HARD);
      b.row(120, 126, 11, T.HARD);
      b.ent('bat', 64, 6);
      b.ent('bomber', 84, 18);
      b.ent('bomber', 136, 18);
      b.setGoal(160);
      b.name = '教程 9 · 墓园之路';
    }
  },
  {
    name: '教程 10 · 终局',
    build(b) {
      b.floor(0, 179);
      b.pit(18, 22);
      b.pit(44, 49);
      b.pit(74, 79);
      b.pit(105, 109);
      b.pit(137, 141);
      b.pit(160, 164);
      b.mplat(19, 15, 4, 70);
      b.mplat(45, 14, 4, 80);
      b.mplat(75, 15, 4, 75);
      b.mplat(105, 13, 5, 85);
      b.mplat(137, 15, 4, 70);
      b.spring(36);
      b.spring(66);
      b.spring(96);
      b.spring(128);
      b.spawner(14, 'goomba', 1.9);
      b.spawner(56, 'charger', 3.4);
      b.spawner(88, 'spitter', 2.2);
      b.spawner(122, 'charger', 3.0);
      b.spawner(152, 'spitter', 2.0);
      b.spawner(170, 'goomba', 1.8);
      b.box(30, 'weapon');
      b.box(62, 'mystery');
      b.box(92, 'bomb');
      b.box(118, 'trap');
      b.box(150, 'coin');
      b.box(174, 'mystery');
      b.ent('spike', 84, 18);
      b.ent('spike', 134, 18);
      b.ent('flyer', 70, 9);
      b.ent('flyer', 114, 9);
      /* 终局：垂直要塞 */
      b.row(24, 30, 14, T.HARD);
      b.row(26, 32, 11, T.HARD);
      b.row(24, 28, 8, T.HARD);
      b.coins(25, 3, 7);
      b.row(112, 120, 14, T.HARD);
      b.row(114, 122, 11, T.HARD);
      b.row(116, 124, 8, T.HARD);
      b.coins(117, 4, 7);
      b.ent('bat', 40, 6);
      b.ent('bat', 100, 5);
      b.ent('bomber', 64, 18);
      b.ent('bomber', 106, 18);
      b.ent('bomber', 146, 18);
      b.setGoal(172);
      b.name = '教程 10 · 终局';
    }
  }
  ,
  { name: '第 1 关', build(b) { mainStage(1, b); } },
  { name: '第 2 关', build(b) { mainStage(2, b); } },
  { name: '第 3 关', build(b) { mainStage(3, b); } },
  { name: '第 4 关', build(b) { mainStage(4, b); } },
  { name: '第 5 关', build(b) { mainStage(5, b); } },
  { name: '第 6 关', build(b) { mainStage(6, b); } },
  { name: '第 7 关', build(b) { mainStage(7, b); } },
  { name: '第 8 关', build(b) { mainStage(8, b); } },
  { name: '第 9 关', build(b) { mainStage(9, b); } },
  { name: '地下 1 · 入口', build(b) { mainCave(1, b); } },
  { name: '地下 2 · 矿脉', build(b) { mainCave(2, b); } },
  { name: '地下 3 · 巢穴', build(b) { mainCave(3, b); } },
  { name: '地下 4 · 熔流', build(b) { mainCave(4, b); } },
  { name: '地下 5 · 地心', build(b) { mainCave(5, b); } }
];


/* ============================================================
 *  地底关卡：第 9 关末尾的管道通到这里
 *  n = 1..5，只有地底武器（钻头/霜杖/榴弹/雷链）与新怪物
 * ============================================================ */
function mainCave(n, b) {
  const W = 128 + n * 14;
  b.floor(0, W);
  b.caveCeil(2);
  b.name = '地下 ' + n;

  /* ---- 深沟：2+n 条，越后越宽 ---- */
  const pits = 2 + n;
  const span = Math.floor((W - 40) / pits);
  const pitRanges = [];
  for (let i = 0; i < pits; i++) {
    const x = 18 + i * span + (i % 2);
    const pw = 3 + (n >= 3 ? 1 : 0);          /* 跨 3~4 格 */
    b.pit(x, x + pw - 1);
    pitRanges.push([x - 2, x + pw + 2]);
    /* 坑中间一块落脚石（比地面高 2 格，普通跳就能上） */
    const mid = Math.max(x, x + Math.floor(pw / 2) - 1);
    b.row(mid, mid + 2, GROUND_ROW - 2, T.HARD);
  }
  const onGround = (tx) => !pitRanges.some(([a, c]) => tx >= a && tx <= c);

  /* ---- 竖井：从地面通到顶棚的石柱平台 ---- */
  const shafts = 2 + Math.floor(n / 2);
  const sSpan = Math.floor((W - 44) / shafts);
  for (let i = 0; i < shafts; i++) {
    let x = 26 + i * sSpan;
    let guard = 0;
    while (pitRanges.some(([a, c]) => x + 6 >= a && x <= c) && guard++ < 24) x += 3;
    b.row(x, x + 4, GROUND_ROW - 4, T.HARD);
    b.row(x + 2, x + 6, GROUND_ROW - 7, T.HARD);
    b.row(x + 1, x + 4, GROUND_ROW - 10, T.HARD);
    b.coins(x + 2, 3, GROUND_ROW - 11);
  }

  /* ---- 坑里的石头与箱子 ---- */
  for (let i = 0; i < 6 + n; i++) {
    const tx = 12 + Math.floor((W - 30) * (i / (6 + n)));
    if (!onGround(tx)) continue;
    const r = (i * 7) % 10;
    if (r < 3) b.box(tx, 'mystery');
    else if (r < 5) b.box(tx, 'weapon');
    else if (r < 7) b.box(tx, 'coin');
    else if (r < 8) b.box(tx, 'bomb');
    else b.spring(tx);
  }

  /* ---- 武器祭坛：四把地底武器 ---- */
  const give = [['drill', 22], ['frost', 46], ['grenade', 68], ['chain', 90]];
  for (let i = 0; i < Math.min(n, 4); i++) {
    b.altar(give[i][1] + n * 3, give[i][0]);
  }
  if (n >= 2) b.weapon(56 + n * 4, 'drill');
  if (n >= 4) b.weapon(104 + n * 2, 'grenade');

  /* ---- 敌人 ---- */
  const put = (kind, count, x0, gap) => {
    for (let i = 0; i < count; i++) {
      const tx = x0 + i * gap;
      if (onGround(tx) && tx < W - 10) b.ent(kind, tx, GROUND_ROW);
    }
  };
  put('goomba', 2 + n, 16, 11);
  put('mole', 1 + Math.floor(n / 2), 30, 17);
  put('ghost', 1 + Math.floor(n / 2), 40, 19);
  put('turret', Math.min(4, 1 + n), 52, 21);
  put('bat', Math.min(4, n), 60, 23);
  put('spitter', Math.min(4, 1 + n), 70, 25);
  put('bomber', Math.min(3, n - 1), 84, 27);
  put('spike', Math.min(4, n - 1), 96, 29);
  put('bomber', Math.min(4, n), 110, 33);

  /* ---- 刷怪笼 ---- */
  for (let i = 0; i < n; i++) {
    const tx = 34 + i * Math.floor((W - 60) / Math.max(1, n));
    if (onGround(tx)) b.spawner(tx, i % 2 ? 'turret' : 'mole', 3.2);
  }

  /* ---- 移动平台 ---- */
  if (n >= 2) b.mplat(Math.floor(W * 0.45), GROUND_ROW - 4, 4, 60 + n * 6);
  if (n >= 4) b.mplat(Math.floor(W * 0.72), GROUND_ROW - 3, 5, 70 + n * 6);

  /* ---- 结尾：楼梯 + 管道 ---- */
  b.stairs(W - 22, 4, 1);
  b.row(W - 12, W - 9, GROUND_ROW - 1, T.HARD);
  b.pipeExit(W - 7);
  b.name = '地下 ' + n + ' · ' + ['入口', '矿脉', '巢穴', '熔流', '地心'][n - 1];
}
