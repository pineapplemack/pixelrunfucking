'use strict';

/* ===================== 无限关卡生成 ===================== */
/* 用「段（chunk）」拼接：每段自带地形与敌人，难度随关数上升 */

function weightedPick(rng, table) {
  let total = 0;
  for (const it of table) total += Math.max(0, it[1]);
  let r = rng() * total;
  for (const it of table) {
    r -= Math.max(0, it[1]);
    if (r <= 0) return it[0];
  }
  return table[table.length - 1][0];
}

function chunkTypeFor(diff, rng) {
  return weightedPick(rng, [
    ['flat', 2.2],
    ['gap', 2.4 + diff * 0.28],
    ['stairs', 1.5],
    ['islands', 1.1 + diff * 0.30],
    ['pipes', 1.3 + diff * 0.22],
    ['bricks', 2.0],
    ['enemies', 1.4 + diff * 0.34],
    ['flyers', 0.5 + diff * 0.26],
    ['tower', 0.8 + diff * 0.12]
  ]);
}

function buildChunk(b, x, type, diff, rng, first) {
  let w;
  switch (type) {
    case 'flat': {
      w = irnd(rng, 8, 12);
      b.floor(x, x + w - 1);
      if (!first && rng() < 0.6) {
        const n = irnd(rng, 1, 1 + Math.min(2, Math.floor(diff / 4)));
        for (let i = 0; i < n; i++) b.ent('goomba', x + irnd(rng, 2, w - 3), GROUND_ROW);
      }
      if (rng() < 0.5) b.coins(x + 2, irnd(rng, 2, 4), 14);
      break;
    }
    case 'gap': {
      w = irnd(rng, 10, 14);
      b.floor(x, x + w - 1);
      const gw = clamp(irnd(rng, 2, 3) + Math.floor(diff / 5), 2, 4);
      const gx = x + irnd(rng, 3, Math.max(3, w - gw - 3));
      b.pit(gx, gx + gw - 1);
      if (rng() < 0.45) b.coinArc(gx - 1, gw + 2, 12);
      if (rng() < 0.5) b.ent('goomba', x + w - 3, GROUND_ROW);
      break;
    }
    case 'stairs': {
      w = 13;
      b.floor(x, x + w - 1);
      const n = irnd(rng, 3, 4);
      b.stairs(x + 2, n, 1);
      const dx = x + 2 + n + 1;
      b.stairs(dx, n, -1);
      b.coins(x + 2 + n, 1, GROUND_ROW - n - 2);
      break;
    }
    case 'islands': {
      w = irnd(rng, 14, 17);
      b.floor(x, x + w - 1);
      const pitL = x + 3, pitR = x + w - 4;
      b.pit(pitL, pitR);
      let cx = pitL + 1, k = 0;
      while (cx + 2 <= pitR) {
        const py = GROUND_ROW - (3 + (k % 2));
        const pw = Math.min(irnd(rng, 2, 3), pitR - cx + 1);
        b.row(cx, cx + pw - 1, py, T.HARD);
        cx += pw + irnd(rng, 1, 2);
        k++;
      }
      b.coinArc(pitL, 4, 12);
      break;
    }
    case 'pipes': {
      w = irnd(rng, 11, 15);
      b.floor(x, x + w - 1);
      const p1 = x + 3;
      const h1 = irnd(rng, 2, 3);
      b.pipe(p1, h1, rng() < 0.25 + diff * 0.04);
      if (w > 12 && rng() < 0.6) {
        const p2 = x + 8;
        b.pipe(p2, irnd(rng, 2, 3), rng() < 0.3 + diff * 0.04);
      }
      b.coins(x + 1, 2, 14);
      break;
    }
    case 'bricks': {
      w = irnd(rng, 12, 16);
      b.floor(x, x + w - 1);
      const y = GROUND_ROW - irnd(rng, 4, 5);
      const len = irnd(rng, 5, 7);
      const bx = x + 2;
      b.row(bx, Math.min(x + w - 2, bx + len - 1), y, T.BRICK);
      b.block(bx + 2, y, T.QCOIN);
      if (rng() < 0.35) b.block(bx + 4, y, T.QPOWER);
      b.coins(bx + 1, 2, 12);
      if (rng() < 0.6) b.ent('goomba', x + w - 3, GROUND_ROW);
      break;
    }
    case 'enemies': {
      w = irnd(rng, 12, 16);
      b.floor(x, x + w - 1);
      const n = irnd(rng, 2, 3) + Math.floor(diff / 4);
      for (let i = 0; i < n; i++) {
        const kind = rng() < 0.55 ? 'goomba' : 'koopa';
        b.ent(kind, x + 2 + Math.floor((i * (w - 4)) / n), GROUND_ROW);
      }
      if (diff > 3 && rng() < 0.4) b.pit(x + Math.floor(w / 2), x + Math.floor(w / 2) + 1);
      break;
    }
    case 'flyers': {
      w = irnd(rng, 13, 17);
      b.floor(x, x + w - 1);
      const n = irnd(rng, 1, 2);
      for (let i = 0; i < n; i++) b.ent('flyer', x + 4 + i * 5, GROUND_ROW - irnd(rng, 5, 8));
      if (rng() < 0.5) b.coins(x + 3, 4, 13);
      b.ent('goomba', x + w - 3, GROUND_ROW);
      break;
    }
    case 'tower': {
      w = 12;
      b.floor(x, x + w - 1);
      const n = irnd(rng, 2, 3);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k <= i; k++) b.block(x + 6 + i, GROUND_ROW - 1 - k, T.HARD);
      }
      b.coins(x + 6, n, GROUND_ROW - n - 2);
      if (rng() < 0.5) b.ent('goomba', x + 3, GROUND_ROW);
      break;
    }
    default:
      w = 10;
      b.floor(x, x + w - 1);
  }
  return w;
}

function buildOnce(seed, index) {
  const s = (seed ^ Math.imul(index, 40503)) >>> 0;
  const rng = mulberry32(s || 1);
  const diff = clamp(index - 6, 0, 12);
  const b = new LevelBuilder(80);
  b.name = (index + 1) + ' · 无限';
  b.index = index;

  b.floor(0, 15);
  b.ents.push({ kind: 'coin', x: 6 * TILE, y: 14 * TILE });
  b.ents.push({ kind: 'coin', x: 7 * TILE, y: 14 * TILE });
  b.ents.push({ kind: 'coin', x: 8 * TILE, y: 14 * TILE });

  let x = 16;
  const count = 7 + Math.min(7, Math.floor(diff / 2)) + (index % 2);
  for (let i = 0; i < count; i++) {
    const type = chunkTypeFor(diff, rng);
    const w = buildChunk(b, x, type, diff, rng, i === 0);
    x += w;
  }

  b.floor(x, x + 10);
  b.setGoal(x + 6);
  b.w = Math.max(b.w, x + 12);
  return b;
}

function generateLevel(seed, index) {
  let b = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    b = buildOnce(seed + attempt * 7919, index);
    if (isReachable(b)) return b;
  }
  return b;
}

/* ===================== 可达性自检 ===================== */
/* 从出生点出发，能否走到旗子所在列（跳跃能力按 5 格横 / 4 格上） */
function isReachable(L) {
  if (!L.goal) return true;
  const W0 = L.w, H0 = L.h;
  const nx = [], ny = [], cols = [];
  for (let x = 0; x < W0; x++) cols.push([]);
  for (let x = 0; x < W0; x++) {
    for (let y = 0; y < H0; y++) {
      if (L.tiles[y][x] !== T.EMPTY && (y === 0 || L.tiles[y - 1][x] === T.EMPTY)) {
        nx.push(x); ny.push(y); cols[x].push(nx.length - 1);
      }
    }
  }
  let start = -1;
  for (const id of cols[L.spawn.tx] || []) if (ny[id] === L.spawn.ty) start = id;
  if (start < 0) return false;

  const goalCol = Math.floor(L.goal.x / TILE);
  const seen = new Uint8Array(nx.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const cur = stack.pop();
    const cx = nx[cur], cy = ny[cur];
    if (cx >= goalCol) return true;
    for (let dx = -7; dx <= 7; dx++) {
      const x2 = cx + dx;
      if (x2 < 0 || x2 >= W0) continue;
      for (const id of cols[x2]) {
        if (seen[id] || ny[id] < cy - 5) continue;
        seen[id] = 1;
        stack.push(id);
      }
    }
  }
  return false;
}
