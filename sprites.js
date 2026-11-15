'use strict';

/* ===================== 调色板 ===================== */
const PAL = {
  ink: '#1b1420',
  skyTop: '#3f74cf', skyMid: '#7fb0e6', skyLow: '#c2dcf4',
  cloud: '#ffffff', cloudShade: '#c3d8ee', cloudEdge: '#e8f2fd',
  mountFar: '#a9c6ea', mountNear: '#8fb2dd',
  hill: '#4f9e52', hillLight: '#63b566', hillDark: '#33743a',
  grass: '#57b85a', grassLight: '#79d47c', grassDark: '#37803c', grassLine: '#275f2c',
  caveRock: '#3d4356', caveRockLight: '#4e5670', caveRockDark: '#2c3142',
  dirt: '#9a6437', dirtDark: '#6b4023', dirtLight: '#b8814f',
  brick: '#b8562a', brickDark: '#7c3213', brickLight: '#d97a45',
  qblock: '#e8a424', qDark: '#a06400', qLight: '#ffd869',
  used: '#8a5a2c', usedDark: '#5d3a17',
  hard: '#8d9099', hardDark: '#5f636c', hardLight: '#b6bac2',
  pipe: '#3aa83a', pipeDark: '#1f6b20', pipeLight: '#7fe07f',
  red: '#d63a3a', redDark: '#9c2222', redLight: '#f46a6a',
  blue: '#2f5bd0', blueDark: '#1b3488', blueLight: '#5b83f0',
  skin: '#ffd2a4', skinDark: '#d9a273',
  hair: '#5a2f12', white: '#ffffff', black: '#171320',
  gold: '#ffcf1f', goldDark: '#c08a00', goldLight: '#fff2a8',
  brown: '#8a5320', brownDark: '#5a3410',
  goomba: '#a75d24', goombaDark: '#6b3512', goombaLight: '#c97a3c',
  koopa: '#48b84a', koopaDark: '#227a26', koopaLight: '#8ee08e',
  shell: '#2f8c33', shellLight: '#9ae89a',
  fire: '#ff6a22', fireLight: '#ffd24a', fireRed: '#e8341e',
  star: '#ffe23c', spike: '#c8ccd8',
  blade: '#dfe6f2', bladeDark: '#9aa4b8'
};

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

/* ===================== 精灵缓存：离屏渲染 + 自动描边 ===================== */
const SPR = {};

function makeSprite(key, w, h, draw, ink) {
  if (SPR[key]) return SPR[key];
  const t = document.createElement('canvas');
  t.width = w; t.height = h;
  const tg = t.getContext('2d');
  tg.imageSmoothingEnabled = false;
  draw(tg);

  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sg = sil.getContext('2d');
  sg.drawImage(t, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = ink || PAL.ink;
  sg.fillRect(0, 0, w, h);

  const out = document.createElement('canvas');
  out.width = w + 2; out.height = h + 2;
  const og = out.getContext('2d');
  og.imageSmoothingEnabled = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      og.drawImage(sil, 1 + dx, 1 + dy);
    }
  }
  og.drawImage(t, 1, 1);
  SPR[key] = out;
  return out;
}

/* ===================== 主角 ===================== */
function playerColors(form, starT) {
  if (starT > 0) {
    const hues = [
      { shirt: PAL.red, pants: PAL.blue },
      { shirt: PAL.gold, pants: PAL.white },
      { shirt: PAL.koopa, pants: PAL.gold },
      { shirt: PAL.white, pants: PAL.red }
    ];
    return hues[Math.floor(starT * 12) % hues.length];
  }
  if (form === 'fire') return { shirt: PAL.white, pants: PAL.red };
  return { shirt: PAL.red, pants: PAL.blue };
}

function drawPlayerSmall(g, c, frame, air) {
  const hat = c.shirt, hatD = shade(c.shirt, -34), hatL = light(c.shirt, 22);
  const pantsD = shade(c.pants, -30), pantsL = light(c.pants, 26);
  // 帽子
  px(g, 6, 0, 16, 6, hat);
  px(g, 6, 0, 16, 2, hatL);
  px(g, 3, 5, 22, 3, hat);
  px(g, 3, 7, 22, 1, hatD);
  // 脸
  px(g, 7, 8, 13, 11, PAL.skin);
  px(g, 7, 8, 13, 2, light(PAL.skin, 16));
  px(g, 19, 11, 4, 6, PAL.skin);            // 鼻子
  px(g, 19, 15, 3, 2, PAL.skinDark);
  px(g, 7, 9, 3, 9, PAL.hair);              // 鬓角
  // 眼
  px(g, 13, 11, 5, 6, PAL.white);
  px(g, 14, 12, 2, 4, PAL.black);
  px(g, 14, 12, 1, 1, PAL.white);
  // 胡子
  px(g, 9, 16, 11, 3, PAL.hair);
  px(g, 8, 17, 2, 2, PAL.hair);
  // 下巴阴影
  px(g, 8, 18, 10, 1, PAL.skinDark);
  // 肩/上衣
  px(g, 6, 19, 16, 4, hat);
  px(g, 6, 19, 16, 1, hatL);
  // 手臂
  px(g, 2, 20, 4, 6, hat);
  px(g, 2, 26, 4, 3, PAL.skin);
  // 背带裤（宽，覆盖大部分躯干）
  px(g, 7, 22, 14, 9, c.pants);
  px(g, 7, 22, 14, 2, pantsL);
  px(g, 7, 22, 2, 9, pantsD);
  px(g, 9, 22, 2, 2, PAL.gold);
  px(g, 17, 22, 2, 2, PAL.gold);
  // 鞋
  if (air) {
    px(g, 4, 30, 8, 4, PAL.brown);
    px(g, 16, 28, 8, 4, PAL.brown);
  } else if (frame === 1) {
    px(g, 3, 30, 9, 4, PAL.brown);
    px(g, 16, 30, 9, 4, PAL.brown);
  } else {
    px(g, 5, 30, 8, 4, PAL.brown);
    px(g, 15, 30, 8, 4, PAL.brown);
  }
}

function drawPlayerBig(g, c, frame, air) {
  const hat = c.shirt, hatD = shade(c.shirt, -34), hatL = light(c.shirt, 22);
  const pantsD = shade(c.pants, -30), pantsL = light(c.pants, 26);
  // 帽子
  px(g, 6, 0, 16, 10, hat);
  px(g, 6, 0, 16, 3, hatL);
  px(g, 2, 9, 24, 5, hat);
  px(g, 2, 13, 24, 1, hatD);
  // 脸
  px(g, 7, 14, 13, 20, PAL.skin);
  px(g, 7, 14, 13, 3, light(PAL.skin, 16));
  px(g, 19, 21, 4, 10, PAL.skin);
  px(g, 19, 28, 3, 4, PAL.skinDark);
  px(g, 7, 15, 4, 16, PAL.hair);
  // 眼
  px(g, 13, 19, 5, 9, PAL.white);
  px(g, 14, 21, 2, 6, PAL.black);
  px(g, 14, 21, 1, 1, PAL.white);
  // 胡子
  px(g, 9, 30, 11, 4, PAL.hair);
  px(g, 8, 32, 2, 3, PAL.hair);
  // 肩/上衣
  px(g, 6, 34, 16, 7, hat);
  px(g, 6, 34, 16, 2, hatL);
  // 手臂
  px(g, 1, 36, 4, 12, hat);
  px(g, 1, 46, 4, 4, PAL.skin);
  // 背带裤
  px(g, 7, 39, 14, 17, c.pants);
  px(g, 7, 39, 14, 3, pantsL);
  px(g, 7, 39, 2, 17, pantsD);
  px(g, 9, 39, 2, 3, PAL.gold);
  px(g, 17, 39, 2, 3, PAL.gold);
  // 鞋
  if (air) {
    px(g, 3, 54, 9, 5, PAL.brown);
    px(g, 16, 52, 9, 5, PAL.brown);
  } else if (frame === 1) {
    px(g, 2, 54, 10, 5, PAL.brown);
    px(g, 16, 54, 10, 5, PAL.brown);
  } else {
    px(g, 4, 54, 9, 5, PAL.brown);
    px(g, 15, 54, 9, 5, PAL.brown);
  }
}

function getPlayerSprite(form, big, frame, air, starPhase) {
  const c = playerColors(form, starPhase ? 0.08 : 0);
  if (starPhase > 0) {
    // 星形态按时间轮换配色，缓存 4 个变体
    const k = Math.floor(starPhase * 12) % 4;
    const cols = [
      { shirt: PAL.red, pants: PAL.blue },
      { shirt: PAL.gold, pants: PAL.white },
      { shirt: PAL.koopa, pants: PAL.gold },
      { shirt: PAL.white, pants: PAL.red }
    ][k];
    const key = 'p' + (big ? 'B' : 'S') + 'f' + (air ? 2 : frame) + 'star' + k;
    return makeSprite(key, 28, big ? 60 : 34, (g) => big ? drawPlayerBig(g, cols, frame, air) : drawPlayerSmall(g, cols, frame, air));
  }
  const key = 'p' + (big ? 'B' : 'S') + form + 'f' + (air ? 2 : frame);
  return makeSprite(key, 28, big ? 60 : 34, (g) => big ? drawPlayerBig(g, c, frame, air) : drawPlayerSmall(g, c, frame, air));
}

/* 颜色明暗工具 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function light(hex, amt) { return shade(hex, Math.round(amt * 1.6)); }

/* ===================== 敌人 ===================== */
function enemySprite(kind, frame, extra) {
  switch (kind) {
    case 'goomba': {
      const key = 'goomba' + frame + (extra || '');
      return makeSprite(key, 32, 32, (g) => {
        if (extra === 'squash') {
          px(g, 2, 20, 28, 8, PAL.goomba);
          px(g, 2, 20, 28, 2, PAL.goombaLight);
          px(g, 4, 26, 9, 4, PAL.goombaDark);
          px(g, 19, 26, 9, 4, PAL.goombaDark);
          return;
        }
        // 圆顶
        px(g, 10, 2, 12, 3, PAL.goomba);
        px(g, 6, 4, 20, 3, PAL.goomba);
        px(g, 3, 7, 26, 12, PAL.goomba);
        px(g, 2, 19, 28, 5, PAL.goomba);
        px(g, 10, 2, 12, 2, PAL.goombaLight);
        px(g, 6, 4, 20, 2, PAL.goombaLight);
        px(g, 4, 8, 8, 3, PAL.goombaLight);
        // 眼睛
        px(g, 7, 11, 7, 9, PAL.white);
        px(g, 18, 11, 7, 9, PAL.white);
        px(g, 9, 13, 3, 5, PAL.black);
        px(g, 20, 13, 3, 5, PAL.black);
        // 怒眉
        px(g, 5, 9, 10, 2, PAL.goombaDark);
        px(g, 17, 9, 10, 2, PAL.goombaDark);
        // 嘴
        px(g, 12, 21, 8, 2, PAL.goombaDark);
        // 脚
        const off = frame === 1 ? 1 : 0;
        px(g, 1 + off, 25, 12, 6, PAL.goombaDark);
        px(g, 19 - off, 25, 12, 6, PAL.goombaDark);
        px(g, 2 + off, 25, 10, 2, PAL.goombaLight);
        px(g, 20 - off, 25, 10, 2, PAL.goombaLight);
      });
    }
    case 'koopa': {
      const key = 'koopa' + frame;
      return makeSprite(key, 32, 42, (g) => {
        // 壳
        px(g, 3, 12, 26, 24, PAL.koopaDark);
        px(g, 5, 14, 22, 20, PAL.koopa);
        px(g, 8, 17, 16, 14, PAL.koopaLight);
        px(g, 11, 20, 10, 8, PAL.koopa);
        // 头
        px(g, 6, 2, 18, 14, PAL.koopa);
        px(g, 6, 2, 18, 4, PAL.koopaLight);
        px(g, 12, 7, 4, 5, PAL.black);
        px(g, 20, 9, 5, 4, PAL.gold);
        // 脚
        px(g, 3, 36, 10, 6, PAL.koopaDark);
        px(g, 19, 36, 10, 6, PAL.koopaDark);
      });
    }
    case 'shell': {
      const key = 'shell' + (extra || 0);
      return makeSprite(key, 32, 22, (g) => {
        px(g, 2, 3, 28, 17, PAL.koopaDark);
        px(g, 4, 5, 24, 13, PAL.koopa);
        px(g, 8, 8, 16, 7, PAL.koopaLight);
        px(g, 12, 10, 8, 3, PAL.shell);
        if (extra === 'spin') { px(g, 24, 6, 4, 10, PAL.shellLight); }
      });
    }
    case 'flyer': {
      const key = 'flyer' + frame;
      return makeSprite(key, 36, 28, (g) => {
        const w = frame ? 4 : 0;
        px(g, 8, 6, 20, 16, PAL.white);
        px(g, 10, 8, 16, 12, PAL.blueLight);
        px(g, 12, 10, 6, 6, PAL.white);
        px(g, 2, 8 + w, 7, 10, PAL.cloud);
        px(g, 27, 8 + w, 7, 10, PAL.cloud);
        px(g, 12, 22, 12, 3, PAL.gold);
      });
    }
    case 'spitter': {
      const key = 'spitter' + frame;
      return makeSprite(key, 32, 40, (g) => {
        px(g, 13, 20, 6, 18, PAL.koopaDark);
        px(g, 14, 20, 3, 18, PAL.koopa);
        px(g, 4, 4, 24, 20, PAL.koopa);
        px(g, 4, 4, 24, 5, PAL.koopaLight);
        px(g, 8, 9, 6, 6, PAL.white);
        px(g, 18, 9, 6, 6, PAL.white);
        px(g, 9, 10, 4, 4, PAL.black);
        px(g, 19, 10, 4, 4, PAL.black);
        px(g, 8, 17, 16, 5, PAL.fireRed);
        px(g, 10, 17, 3, 5, PAL.white);
        px(g, 16, 17, 3, 5, PAL.white);
        if (frame) { px(g, 2, 16, 4, 6, PAL.koopaDark); px(g, 26, 16, 4, 6, PAL.koopaDark); }
      });
    }
    case 'charger': {
      const key = 'charger' + frame;
      return makeSprite(key, 36, 30, (g) => {
        px(g, 4, 9, 28, 15, PAL.brown);
        px(g, 4, 9, 28, 4, light(PAL.brown, 22));
        px(g, 6, 4, 24, 8, PAL.brownDark);
        px(g, 0, 6, 6, 5, PAL.bone || '#efe3c8');
        px(g, 30, 6, 6, 5, '#efe3c8');
        px(g, 9, 12, 6, 5, PAL.white);
        px(g, 21, 12, 6, 5, PAL.white);
        px(g, 10, 13, 3, 3, PAL.black);
        px(g, 22, 13, 3, 3, PAL.black);
        px(g, 12, 20, 12, 3, PAL.brownDark);
        px(g, 3, 23, 9, 5, PAL.brownDark);
        px(g, 24, 23, 9, 5, PAL.brownDark);
        if (frame) { px(g, 1, 8, 3, 8, PAL.red); px(g, 32, 8, 3, 8, PAL.red); }
      });
    }
    case 'spike': {
      const key = 'spike' + frame;
      return makeSprite(key, 32, 32, (g) => {
        px(g, 6, 6, 20, 20, '#5b3f8c');
        px(g, 8, 8, 16, 16, '#7a5cb0');
        px(g, 10, 10, 8, 8, light('#7a5cb0', 20));
        const sp = (x1, y1, x2, y2) => {
          g.fillStyle = PAL.spike;
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x1 + 4, y1 + 4); g.closePath(); g.fill();
        };
        px(g, 2, 2, 5, 5, PAL.spike);
        px(g, 14, 0, 5, 5, PAL.spike);
        px(g, 25, 2, 5, 5, PAL.spike);
        px(g, 2, 25, 5, 5, PAL.spike);
        px(g, 14, 27, 5, 5, PAL.spike);
        px(g, 25, 25, 5, 5, PAL.spike);
        px(g, 11, 13, 3, 5, PAL.white);
        px(g, 18, 13, 3, 5, PAL.white);
      });
    }
    case 'bat': {
      const key = 'bat' + frame;
      return makeSprite(key, 36, 24, (g) => {
        const w = frame === 0 ? 0 : 5;
        // 翅膀
        px(g, 0, 6 + w, 10, 5, '#4b2d6b');
        px(g, 0, 6 + w, 10, 2, '#6d4796');
        px(g, 26, 6 + w, 10, 5, '#4b2d6b');
        px(g, 26, 6 + w, 10, 2, '#6d4796');
        // 身体
        px(g, 12, 6, 12, 14, '#5b3a80');
        px(g, 12, 6, 12, 3, '#7d55a8');
        // 耳朵
        px(g, 12, 1, 4, 5, '#5b3a80');
        px(g, 20, 1, 4, 5, '#5b3a80');
        // 眼睛
        px(g, 14, 9, 3, 4, '#ffe066');
        px(g, 19, 9, 3, 4, '#ffe066');
        px(g, 15, 10, 1, 2, '#000');
        px(g, 20, 10, 1, 2, '#000');
        // 牙
        px(g, 15, 16, 2, 3, '#fff');
        px(g, 19, 16, 2, 3, '#fff');
      });
    }
    case 'ghost': {
      const key = 'ghost' + frame;
      return makeSprite(key, 32, 40, (g) => {
        const wob = frame ? 1 : 0;
        px(g, 6, 4, 20, 26, 'rgba(198,224,255,0.82)');
        px(g, 4, 10, 24, 18, 'rgba(198,224,255,0.82)');
        px(g, 8, 2, 16, 4, 'rgba(226,240,255,0.9)');
        // 下摆波浪
        px(g, 4, 28, 6, 6 + wob, 'rgba(198,224,255,0.82)');
        px(g, 13, 28, 6, 4 - wob, 'rgba(198,224,255,0.82)');
        px(g, 22, 28, 6, 6 + wob, 'rgba(198,224,255,0.82)');
        // 眼睛
        px(g, 9, 12, 5, 6, '#20304a');
        px(g, 18, 12, 5, 6, '#20304a');
        px(g, 10, 13, 2, 2, '#9fe8ff');
        px(g, 19, 13, 2, 2, '#9fe8ff');
        // 嘴
        px(g, 13, 22, 6, 3, '#20304a');
      });
    }
    case 'mole': {
      const key = 'mole' + frame;
      return makeSprite(key, 36, 28, (g) => {
        px(g, 4, 8, 28, 16, '#8a6a4a');
        px(g, 4, 8, 28, 4, '#a8875f');
        px(g, 8, 4, 20, 6, '#8a6a4a');
        // 肚皮
        px(g, 12, 14, 12, 8, '#d8bf9c');
        // 眼睛
        px(g, 9, 10, 4, 4, '#fff');
        px(g, 23, 10, 4, 4, '#fff');
        px(g, 10, 11, 2, 2, '#000');
        px(g, 24, 11, 2, 2, '#000');
        // 爪子
        px(g, 0, 18, 8, 5, '#c9a97e');
        px(g, 28, 18, 8, 5, '#c9a97e');
        px(g, 0, 18, 3, 5, '#8a6a4a');
        px(g, 33, 18, 3, 5, '#8a6a4a');
        // 鼻
        px(g, 17, 15, 3, 2, '#3a2a1e');
      });
    }
    case 'turret': {
      const key = 'turret' + frame;
      return makeSprite(key, 36, 36, (g) => {
        px(g, 4, 16, 28, 18, '#4d5866');
        px(g, 4, 16, 28, 3, '#78859a');
        px(g, 6, 20, 24, 10, '#3b444f');
        // 炮塔头
        px(g, 8, 6, 20, 14, '#6a7788');
        px(g, 8, 6, 20, 3, '#9aabbf');
        // 炮口
        px(g, 24, 10, 10, 6, '#333a44');
        px(g, 24, 10, 10, 2, '#59616e');
        // 红眼
        px(g, 12, 11, 6, 5, '#ff5a5a');
        px(g, 13, 12, 3, 3, '#ffd0d0');
        // 底座铆钉
        px(g, 6, 30, 3, 3, '#2a3138');
        px(g, 27, 30, 3, 3, '#2a3138');
      });
    }
    case 'bomber': {
      const key = 'bomber' + frame;
      return makeSprite(key, 32, 34, (g) => {
        // 身体
        px(g, 6, 8, 20, 20, '#5d6b52');
        px(g, 6, 8, 20, 4, '#7d8f6e');
        px(g, 4, 14, 3, 10, '#46523e');
        px(g, 25, 14, 3, 10, '#46523e');
        // 头盔
        px(g, 5, 3, 22, 7, '#8a9599');
        px(g, 5, 3, 22, 2, '#b9c3c7');
        // 眼睛
        px(g, 9, 13, 5, 5, '#ffe066');
        px(g, 18, 13, 5, 5, '#ffe066');
        px(g, 10, 14, 2, 3, '#000');
        px(g, 19, 14, 2, 3, '#000');
        // 嘴
        px(g, 12, 21, 8, 2, '#2b3128');
        // 脚
        px(g, 5, 28, 9, 6, '#3c4636');
        px(g, 18, 28, 9, 6, '#3c4636');
        // 手上的炸弹
        if (frame === 1) {
          px(g, 26, 18, 6, 6, '#2f2f3a');
          px(g, 28, 16, 2, 2, '#f2a03c');
        }
      });
    }
    case 'piranha': {
      return makeSprite('piranha' + frame, 32, 52, (g) => {
        px(g, 14, 20, 4, 32, PAL.koopaDark);
        px(g, 15, 20, 2, 32, PAL.koopa);
        px(g, 5, 2, 22, 22, PAL.fireRed);
        px(g, 5, 2, 22, 7, PAL.fire);
        px(g, 8, 8, 5, 5, PAL.white);
        px(g, 19, 8, 5, 5, PAL.white);
        px(g, 8, 16, 16, 5, PAL.white);
        px(g, 8, 16, 16, 5, PAL.white);
        px(g, 11, 16, 3, 5, PAL.fireRed);
        px(g, 18, 16, 3, 5, PAL.fireRed);
      });
    }
  }
  return null;
}

/* ===================== 道具 ===================== */
function itemSprite(kind, frame) {
  switch (kind) {
    case 'mushroom':
      return makeSprite('mushroom', 32, 32, (g) => {
        px(g, 2, 6, 28, 16, PAL.red);
        px(g, 2, 6, 28, 6, PAL.redLight);
        px(g, 6, 10, 8, 7, PAL.white);
        px(g, 19, 12, 7, 6, PAL.white);
        px(g, 7, 22, 18, 8, PAL.skin);
        px(g, 7, 22, 18, 2, light(PAL.skin, 12));
        px(g, 11, 24, 3, 4, PAL.black);
        px(g, 18, 24, 3, 4, PAL.black);
      });
    case 'flower':
      return makeSprite('flower' + (frame ? 1 : 0), 32, 32, (g) => {
        px(g, 14, 18, 4, 14, PAL.koopa);
        px(g, 4, 20, 8, 4, PAL.koopa);
        px(g, 20, 20, 8, 4, PAL.koopa);
        px(g, 6, 2, 20, 16, PAL.fire);
        px(g, 10, 0, 12, 20, PAL.fire);
        px(g, 9, 5, 14, 10, PAL.fireLight);
        px(g, 13, 6, 6, 8, PAL.white);
        px(g, 14, 12, 4, 3, PAL.gold);
      });
    case 'star':
      return makeSprite('star' + (frame || 0), 32, 32, (g) => {
        px(g, 13, 2, 6, 8, PAL.star);
        px(g, 6, 10, 20, 8, PAL.star);
        px(g, 2, 14, 6, 6, PAL.star);
        px(g, 24, 14, 6, 6, PAL.star);
        px(g, 9, 18, 6, 8, PAL.star);
        px(g, 18, 18, 6, 8, PAL.star);
        px(g, 12, 6, 8, 12, PAL.goldLight);
        px(g, 14, 12, 3, 4, PAL.black);
      });
    case 'coin':
      return makeSprite('coin', 24, 24, (g) => {
        px(g, 6, 1, 12, 22, PAL.goldDark);
        px(g, 8, 2, 8, 20, PAL.gold);
        px(g, 10, 4, 4, 16, PAL.goldLight);
      });
  }
  return null;
}

/* ===================== 瓦片（32×32 美术像素） ===================== */
function drawTile(ctx, type, ax, ay, L, tx, ty, t) {
  switch (type) {
    case T.GROUND: {
      if (L && L.theme === 'cave') {
        px(ctx, ax, ay, 32, 32, PAL.caveRock);
        px(ctx, ax, ay, 32, 4, PAL.caveRockLight);
        px(ctx, ax + 4, ay + 8, 6, 4, PAL.caveRockDark);
        px(ctx, ax + 18, ay + 16, 8, 5, PAL.caveRockDark);
        px(ctx, ax + 10, ay + 22, 5, 4, PAL.caveRockDark);
        break;
      }
      const above = tileAt(L, tx, ty - 1);
      if (!isSolid(above)) {
        px(ctx, ax, ay, 32, 32, PAL.dirt);
        px(ctx, ax, ay + 10, 32, 22, PAL.dirt);
        // 草地
        px(ctx, ax, ay, 32, 10, PAL.grass);
        px(ctx, ax, ay, 32, 4, PAL.grassLight);
        px(ctx, ax, ay + 9, 32, 2, PAL.grassLine);
        px(ctx, ax + 6, ay + 4, 5, 4, PAL.grassDark);
        px(ctx, ax + 21, ay + 5, 4, 3, PAL.grassDark);
        // 土
        px(ctx, ax + 4, ay + 16, 7, 5, PAL.dirtDark);
        px(ctx, ax + 20, ay + 22, 8, 4, PAL.dirtDark);
        px(ctx, ax + 12, ay + 26, 5, 3, PAL.dirtLight);
        px(ctx, ax, ay + 31, 32, 1, PAL.dirtDark);
      } else if (above === T.PIPE || above === T.HARD) {
        px(ctx, ax, ay, 32, 32, PAL.dirt);
        px(ctx, ax, ay, 32, 2, PAL.dirtLight);
        px(ctx, ax + 6, ay + 12, 6, 4, PAL.dirtDark);
        px(ctx, ax + 20, ay + 22, 7, 4, PAL.dirtDark);
      } else {
        px(ctx, ax, ay, 32, 32, PAL.dirtDark);
        px(ctx, ax, ay, 32, 1, 'rgba(0,0,0,0.16)');
        if ((tx + ty) % 2 === 0) {
          px(ctx, ax + 6, ay + 8, 10, 6, '#583213');
          px(ctx, ax + 20, ay + 22, 8, 5, '#583213');
        } else {
          px(ctx, ax + 18, ay + 14, 10, 6, '#583213');
          px(ctx, ax + 4, ay + 24, 8, 5, '#583213');
        }
      }
      break;
    }
    case T.BRICK: {
      px(ctx, ax, ay, 32, 32, PAL.brick);
      px(ctx, ax, ay, 32, 3, PAL.brickLight);
      // 砖缝
      px(ctx, ax, ay + 15, 32, 2, PAL.brickDark);
      px(ctx, ax, ay + 31, 32, 1, PAL.brickDark);
      px(ctx, ax + 15, ay, 2, 15, PAL.brickDark);
      px(ctx, ax + 7, ay + 17, 2, 14, PAL.brickDark);
      px(ctx, ax + 23, ay + 17, 2, 14, PAL.brickDark);
      px(ctx, ax + 3, ay + 4, 8, 2, light(PAL.brick, 14));
      break;
    }
    case T.QCOIN:
    case T.QPOWER: {
      const pulse = (Math.sin(t * 5 + (tx + ty) * 0.9) + 1) / 2;
      px(ctx, ax, ay, 32, 32, PAL.qblock);
      px(ctx, ax, ay, 32, 3, PAL.qLight);
      px(ctx, ax, ay + 29, 32, 3, PAL.qDark);
      px(ctx, ax, ay, 3, 32, PAL.qLight);
      px(ctx, ax + 29, ay, 3, 32, PAL.qDark);
      // 铆钉
      px(ctx, ax + 4, ay + 4, 3, 3, PAL.qDark);
      px(ctx, ax + 25, ay + 4, 3, 3, PAL.qDark);
      px(ctx, ax + 4, ay + 25, 3, 3, PAL.qDark);
      px(ctx, ax + 25, ay + 25, 3, 3, PAL.qDark);
      // 问号
      ctx.globalAlpha = 0.55 + pulse * 0.45;
      const q = PAL.qDark;
      px(ctx, ax + 11, ay + 8, 10, 4, q);
      px(ctx, ax + 19, ay + 10, 4, 6, q);
      px(ctx, ax + 15, ay + 14, 6, 4, q);
      px(ctx, ax + 15, ay + 18, 4, 3, q);
      px(ctx, ax + 15, ay + 24, 4, 4, q);
      ctx.globalAlpha = 1;
      break;
    }
    case T.USED: {
      px(ctx, ax, ay, 32, 32, PAL.used);
      px(ctx, ax, ay, 32, 4, PAL.usedDark);
      px(ctx, ax, ay, 4, 32, PAL.usedDark);
      px(ctx, ax + 28, ay, 4, 32, PAL.usedDark);
      px(ctx, ax, ay + 28, 32, 4, PAL.usedDark);
      px(ctx, ax + 6, ay + 6, 20, 2, light(PAL.used, 18));
      break;
    }
    case T.HARD: {
      px(ctx, ax, ay, 32, 32, PAL.hard);
      px(ctx, ax, ay, 32, 4, PAL.hardLight);
      px(ctx, ax, ay, 4, 32, PAL.hardLight);
      px(ctx, ax, ay + 28, 32, 4, PAL.hardDark);
      px(ctx, ax + 28, ay, 4, 32, PAL.hardDark);
      px(ctx, ax + 6, ay + 10, 8, 6, shade(PAL.hard, -12));
      px(ctx, ax + 18, ay + 18, 8, 6, shade(PAL.hard, -12));
      break;
    }
    case T.PIPE: {
      px(ctx, ax, ay, 32, 32, PAL.pipe);
      px(ctx, ax, ay, 6, 32, PAL.pipeLight);
      px(ctx, ax + 6, ay, 4, 32, shade(PAL.pipe, 22));
      px(ctx, ax + 22, ay, 6, 32, PAL.pipeDark);
      px(ctx, ax + 27, ay, 5, 32, shade(PAL.pipeDark, -12));
      if (tileAt(L, tx, ty - 1) !== T.PIPE) {
        px(ctx, ax - 4, ay, 40, 14, PAL.pipe);
        px(ctx, ax - 4, ay, 40, 4, PAL.pipeLight);
        px(ctx, ax - 4, ay + 10, 40, 4, PAL.pipeDark);
        px(ctx, ax + 26, ay, 10, 14, PAL.pipeDark);
      }
      break;
    }
  }
}

/* ===================== 背景 ===================== */
function drawBackground(ctx, camX, camY, t, cw, ch, theme) {
  if (theme === 'cave') { drawCaveBackground(ctx, camX, camY, t, cw, ch); return; }
  const HZ = ch * 0.84;                     // 地平线（与地面顶边大致对齐）
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#3f74cf');
  g.addColorStop(0.52, '#6ba4e4');
  g.addColorStop(0.84, '#9cc6ec');
  g.addColorStop(1, '#b9d9f2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  const dy = (camY || 0) * 0.08;

  // 远山（两层）
  const m1 = ((-camX * 0.05) % 460 + 460) % 460;
  for (let i = -1; i < 5; i++) {
    const x = m1 + i * 460;
    ctx.fillStyle = '#8fb4dd';
    ctx.beginPath();
    ctx.moveTo(x - 30, HZ);
    ctx.lineTo(x + 140, HZ - 168 + dy);
    ctx.lineTo(x + 320, HZ);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(x + 140, HZ - 168 + dy);
    ctx.lineTo(x + 196, HZ - 96 + dy);
    ctx.lineTo(x + 140, HZ - 96 + dy);
    ctx.closePath();
    ctx.fill();
  }
  const m2 = ((-camX * 0.11) % 360 + 360) % 360;
  for (let i = -1; i < 6; i++) {
    const x = m2 + i * 360;
    ctx.fillStyle = '#7aa2cf';
    ctx.beginPath();
    ctx.moveTo(x - 20, HZ);
    ctx.lineTo(x + 110, HZ - 112 + dy);
    ctx.lineTo(x + 250, HZ);
    ctx.closePath();
    ctx.fill();
  }

  // 云
  const c1 = ((-camX * 0.04) % 560 + 560) % 560;
  for (let i = 0; i < 4; i++) drawCloud(ctx, c1 + i * 560 - 90, ch * 0.13 + ((i * 53) % 54), 1.35, 0.55);
  const c2 = ((-camX * 0.09) % 430 + 430) % 430;
  for (let i = 0; i < 5; i++) drawCloud(ctx, c2 + i * 430 - 70, ch * 0.29 + ((i * 67) % 80), 0.95, 0.9);

  // 近处山丘
  const h = ((-camX * 0.2) % 570 + 570) % 570;
  for (let i = -1; i < 4; i++) {
    const x = h + i * 570;
    ctx.fillStyle = '#33763a';
    ctx.beginPath();
    ctx.ellipse(x + 130, HZ + 40, 128, 92, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#4f9e52';
    ctx.beginPath();
    ctx.ellipse(x + 130, HZ + 46, 112, 82, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#63b566';
    ctx.beginPath();
    ctx.ellipse(x + 88, HZ + 40, 38, 30, 0, Math.PI, 0);
    ctx.fill();
  }
}

function drawCloud(ctx, x, y, s, alpha) {
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = PAL.cloudShade;
  ctx.beginPath();
  ctx.arc(x, y + 7 * s, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 22 * s, y + 2 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 46 * s, y + 8 * s, 18 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.cloud;
  ctx.beginPath();
  ctx.arc(x, y, 17 * s, 0, Math.PI * 2);
  ctx.arc(x + 22 * s, y - 6 * s, 21 * s, 0, Math.PI * 2);
  ctx.arc(x + 46 * s, y + 1 * s, 17 * s, 0, Math.PI * 2);
  ctx.arc(x + 23 * s, y + 7 * s, 18 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ===================== 绘制入口 ===================== */
function drawPlayer(ctx, p, t) {
  const big = p.form !== 'small';
  const air = !p.onGround && !p.dead;
  const frame = Math.abs(p.vx) > 8 ? (Math.floor(p.animT * 10) % 2) : 0;
  const spr = getPlayerSprite(p.form, big, frame, air, p.star);
  const w = spr.width, h = spr.height;
  const ax = p.x * ART + (p.w * ART - w) / 2;
  const ay = p.y * ART + p.h * ART - h + 2;

  if (p.invuln > 0 && p.invuln < 1.0 && Math.floor(t * 24) % 2 === 0) return;

  ctx.save();
  if (p.facing < 0) {
    ctx.translate(Math.round(ax) + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(Math.round(ax) + w / 2), 0);
  }
  ctx.drawImage(spr, Math.round(ax), Math.round(ay));
  ctx.restore();
}

function drawEnemy(ctx, e, t) {
  const x = Math.round(e.x * ART);
  const y = Math.round(e.y * ART);
  let spr = null;
  if (e.kind === 'goomba') spr = enemySprite('goomba', Math.floor(t * 6 + e.x * 0.01) % 2, e.dead ? 'squash' : '');
  else if (e.kind === 'koopa') spr = enemySprite('koopa', Math.floor(t * 6) % 2);
  else if (e.kind === 'shell') spr = enemySprite('shell', 0, Math.abs(e.vx) > 30 ? 'spin' : 0);
  else if (e.kind === 'flyer') spr = enemySprite('flyer', Math.floor(t * 10) % 2);
  else if (e.kind === 'piranha') spr = enemySprite('piranha', 0);
  else if (e.kind === 'spitter') spr = enemySprite('spitter', Math.floor(t * 4) % 2);
  else if (e.kind === 'charger') spr = enemySprite('charger', e.chargeT > 0 ? 1 : Math.floor(t * 8) % 2);
  else if (e.kind === 'spike') spr = enemySprite('spike', 0);
  else if (e.kind === 'bat') spr = enemySprite('bat', Math.floor(t * 12) % 2);
  else if (e.kind === 'bomber') spr = enemySprite('bomber', e.throwT > 0 ? 1 : 0);
  else if (e.kind === 'ghost') spr = enemySprite('ghost', Math.floor(t * 4) % 2);
  else if (e.kind === 'mole') spr = enemySprite('mole', Math.floor(t * 6) % 2);
  else if (e.kind === 'turret') spr = enemySprite('turret', e.cd < 0.3 ? 1 : 0);
  if (!spr) { px(ctx, x, y, e.w * ART, e.h * ART, '#ff00ff'); return; }

  ctx.save();
  if (e.kind === 'piranha') {
    ctx.beginPath();
    ctx.rect(x - 80, -4000, 200, e.base * ART + 4000);
    ctx.clip();
  }
  if (e.dir > 0 && e.kind !== 'piranha') {
    ctx.translate(x + spr.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + spr.width / 2), 0);
  }
  ctx.drawImage(spr, x, y + e.h * ART - spr.height + 2);
  ctx.restore();
}

function drawItem(ctx, it, t) {
  const x = Math.round(it.x * ART), y = Math.round(it.y * ART);
  if (it.kind === 'coin') {
    const sq = 0.34 + 0.66 * Math.abs(Math.cos(t * 5 + it.x * 0.05));
    const w = Math.max(3, Math.round(24 * sq));
    const g = itemSprite('coin');
    ctx.drawImage(g, 0, 0, 24, 24, Math.round(x + 12 - w / 2), y + 4, w, 24);
    return;
  }
  const spr = itemSprite(it.kind, Math.floor(t * 6) % 2);
  if (spr) ctx.drawImage(spr, x - 1, y - 1);
}

function drawFlag(ctx, gx, gy, t) {
  const x = Math.round(gx * ART), y = Math.round(gy * ART);
  px(ctx, x, y, 4, 192, '#c9ccd8');
  px(ctx, x, y, 2, 192, '#f2f4fa');
  px(ctx, x - 16, y - 12, 36, 8, PAL.gold);
  px(ctx, x - 16, y - 12, 36, 3, PAL.goldLight);
  const wav = Math.sin(t * 4) * 4;
  ctx.fillStyle = PAL.koopa;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 4);
  ctx.lineTo(x + 56 + wav, y + 22);
  ctx.lineTo(x + 4, y + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.white;
  px(ctx, x + 12, y + 16, 16, 12, PAL.white);
}

/* ---------- 地底主题背景 ---------- */
function drawCaveBackground(ctx, camX, camY, t, cw, ch) {
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#070b14');
  g.addColorStop(0.45, '#101a2c');
  g.addColorStop(0.78, '#16233a');
  g.addColorStop(1, '#0a111c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  /* 远处岩壁：两层缓慢视差 */
  const layers = [
    { k: 0.04, col: '#0d1626', h: 0.30, step: 190, amp: 46 },
    { k: 0.09, col: '#13203a', h: 0.20, step: 130, amp: 30 }
  ];
  for (const L of layers) {
    const off = ((-camX * L.k) % L.step + L.step) % L.step;
    ctx.fillStyle = L.col;
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let x = -L.step; x < cw + L.step; x += 34) {
      const sx = x + off;
      const yy = ch * (1 - L.h) + Math.sin((sx / L.step) * Math.PI * 2) * L.amp;
      ctx.lineTo(sx, yy);
    }
    ctx.lineTo(cw + L.step, ch);
    ctx.closePath();
    ctx.fill();
  }

  /* 发光水晶 */
  for (let i = 0; i < 9; i++) {
    const seedX = (i * 733) % 1600;
    const sx = ((seedX - camX * 0.16) % 1600 + 1600) % 1600 - 200;
    if (sx < -60 || sx > cw + 60) continue;
    const sy = ch * (0.36 + ((i * 37) % 40) / 100);
    const pulse = 0.55 + 0.45 * Math.sin(t * 1.6 + i);
    ctx.fillStyle = 'rgba(90,200,255,' + (0.10 * pulse) + ')';
    ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(140,225,255,' + (0.55 + 0.25 * pulse) + ')';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 16); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx, sy + 14);
    ctx.lineTo(sx - 7, sy); ctx.closePath(); ctx.fill();
  }

  /* 顶部钟乳石 */
  const sOff = ((-camX * 0.22) % 84 + 84) % 84;
  ctx.fillStyle = '#0b1220';
  for (let x = -84; x < cw + 84; x += 84) {
    const sx = x + sOff;
    const dh = 34 + ((x / 84 | 0) % 3 + 3) % 3 * 18;
    ctx.beginPath();
    ctx.moveTo(sx, 0); ctx.lineTo(sx + 26, 0); ctx.lineTo(sx + 13, dh);
    ctx.closePath(); ctx.fill();
  }

  /* 飘落的尘点 */
  ctx.fillStyle = 'rgba(150,200,255,0.18)';
  for (let i = 0; i < 26; i++) {
    const px0 = ((i * 271) % 1200) - ((camX * 0.3) % 1200);
    const x = ((px0 % 1200) + 1200) % 1200;
    const y = ((t * 18 + i * 53) % (ch + 40)) - 20;
    if (x > cw + 10) continue;
    ctx.fillRect(x, y, 2, 2);
  }
}
