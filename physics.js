'use strict';

/* ===================== 瓦片查询 ===================== */
function tileAt(L, tx, ty) {
  if (tx < 0) return T.GROUND;          // 左边界当墙
  if (tx >= L.w) return T.EMPTY;
  if (ty < 0 || ty >= L.h) return T.EMPTY;
  return L.tiles[ty][tx];
}
function solidAt(L, tx, ty) { return isSolid(tileAt(L, tx, ty)); }

/* ===================== 轴向移动与碰撞 ===================== */
function moveX(e, L, dt) {
  e.x += e.vx * dt;
  const y0 = Math.floor(e.y / TILE);
  const y1 = Math.floor((e.y + e.h - 0.01) / TILE);
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (solidAt(L, tx, ty)) { e.x = tx * TILE - e.w; e.vx = 0; return { wall: true, tx, ty }; }
    }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (solidAt(L, tx, ty)) { e.x = (tx + 1) * TILE; e.vx = 0; return { wall: true, tx, ty }; }
    }
  }
  return null;
}

function moveY(e, L, dt) {
  e.y += e.vy * dt;
  const x0 = Math.floor(e.x / TILE);
  const x1 = Math.floor((e.x + e.w - 0.01) / TILE);
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(L, tx, ty)) {
        e.y = ty * TILE - e.h;
        e.vy = 0;
        e.onGround = true;
        return { ground: true, tx, ty };
      }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / TILE);
    let hit = null;
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(L, tx, ty)) {
        e.y = (ty + 1) * TILE;
        e.vy = 0;
        hit = { ceil: true, tx, ty };
      }
    }
    return hit;
  }
  return null;
}

/* 脚下是否还有地面（给敌人做悬崖检测） */
function hasFloorAhead(L, e, dir) {
  const probeX = dir > 0 ? e.x + e.w + 2 : e.x - 2;
  const tx = Math.floor(probeX / TILE);
  const ty = Math.floor((e.y + e.h + 2) / TILE);
  return solidAt(L, tx, ty);
}
