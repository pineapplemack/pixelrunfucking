/* ============================================================
 *  weapons.js —— 手持武器表 + 图标绘制
 *  武器不是技能：拿在手上，有冷却，按 J 使用
 * ============================================================ */

const WEAPONS = {
  fist: {
    name: '铁拳套', short: '拳', cd: 0.34, dmg: 14, kind: 'melee', reach: 15,
    desc: '出生自带，戳一下。'
  },
  sword: {
    name: '星辉剑', short: '剑', cd: 0.44, dmg: 26, kind: 'melee', reach: 21, combo: true,
    desc: '三段连斩，出手快、范围长。'
  },
  hammer: {
    name: '裂岩锤', short: '锤', cd: 1.15, dmg: 46, kind: 'melee', reach: 24, smash: true,
    desc: '慢但很重，砸碎砖块并把周围敌人震飞。'
  },
  wand: {
    name: '火花杖', short: '杖', cd: 0.40, dmg: 18, kind: 'shot', speed: 330, limit: 3,
    desc: '直线火弹，同屏最多 3 发。'
  },
  shot: {
    name: '散弹筒', short: '散', cd: 1.00, dmg: 12, kind: 'spread', speed: 300, pellets: 3,
    desc: '一次三发扇形弹片，近距离很痛。'
  },
  boom: {
    name: '回旋镖', short: '镖', cd: 0.95, dmg: 20, kind: 'boom', speed: 320,
    desc: '飞出再飞回，路上来回都能打到。'
  },
  laser: {
    name: '光束枪', short: '光', cd: 1.35, dmg: 32, kind: 'beam', range: 210,
    desc: '穿透整条直线的光束，无视护甲。'
  },
  drill: {
    name: '熔岩钻头', short: '钻', cd: 0.70, dmg: 30, kind: 'melee', reach: 26, smash: true, drill: true,
    desc: '地底挖出来的钻头，一次穿透所有挡路的敌人，还能破砖。'
  },
  frost: {
    name: '霜冻法杖', short: '霜', cd: 0.55, dmg: 14, kind: 'shot', speed: 290, limit: 4, slow: true,
    desc: '命中的敌人会被冻慢，适合对付冲锋牛。'
  },
  grenade: {
    name: '榴弹炮', short: '榴', cd: 1.10, dmg: 34, kind: 'lob', speed: 240, aoe: 46,
    desc: '抛物线榴弹，落地炸开一片。'
  },
  chain: {
    name: '雷链杖', short: '雷', cd: 1.00, dmg: 22, kind: 'chain', range: 150, links: 3,
    desc: '瞬间电击最多 3 只离你最近的敌人。'
  }
};

const WEAPON_IDS = ['fist', 'sword', 'hammer', 'wand', 'shot', 'boom', 'laser', 'drill', 'frost', 'grenade', 'chain'];
const WEAPON_POOL = ['sword', 'hammer', 'wand', 'shot', 'boom', 'laser'];
const CAVE_POOL = ['drill', 'frost', 'grenade', 'chain'];

/* 按 id 画一个 16×16 的武器图标（s = 缩放） */
function drawWeaponIcon(ctx, id, x, y, s) {
  s = s || 1;
  const p = (ax, ay, aw, ah, c) => { ctx.fillStyle = c; ctx.fillRect(x + ax * s, y + ay * s, aw * s, ah * s); };
  ctx.save();
  if (id === 'fist') {
    p(4, 6, 8, 8, '#d9a066'); p(4, 6, 8, 2, '#f0c090');
    p(1, 8, 4, 5, '#c08040'); p(5, 4, 2, 3, '#f0c090'); p(8, 4, 2, 3, '#f0c090');
  } else if (id === 'sword') {
    p(7, 1, 3, 9, '#dfe9f5'); p(7, 1, 1, 9, '#ffffff');
    p(4, 10, 9, 2, '#f2c14e'); p(8, 12, 2, 3, '#8b5a2b');
  } else if (id === 'hammer') {
    p(2, 2, 12, 6, '#9aa7b8'); p(2, 2, 12, 2, '#c9d4e2');
    p(7, 8, 3, 7, '#8b5a2b');
  } else if (id === 'wand') {
    p(3, 11, 2, 4, '#8b5a2b'); p(4, 6, 8, 6, '#c86bd8');
    p(6, 8, 4, 2, '#f0d0f8'); p(3, 3, 3, 3, '#ffe066'); p(11, 2, 2, 2, '#ffe066');
  } else if (id === 'shot') {
    p(1, 6, 12, 5, '#59616e'); p(1, 6, 12, 2, '#8c94a3');
    p(11, 4, 4, 9, '#3f4652'); p(2, 11, 4, 4, '#8b5a2b');
  } else if (id === 'boom') {
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x + 8 * s, y + 8 * s, 5 * s, 0.6, 4.9); ctx.stroke();
    p(11, 3, 3, 3, '#ffffff');
  } else if (id === 'laser') {
    p(1, 6, 14, 4, '#3fb8ff'); p(1, 6, 14, 2, '#a8e4ff');
    p(5, 10, 3, 4, '#33404d'); p(2, 4, 2, 3, '#33404d');
  } else if (id === 'drill') {
    p(2, 7, 8, 4, '#8a9599'); p(2, 7, 8, 2, '#c2ccd2');
    p(9, 4, 3, 10, '#f2a03c'); p(11, 5, 2, 3, '#ffe0a0'); p(11, 10, 2, 3, '#ffe0a0');
    p(1, 6, 2, 6, '#5d6b52');
  } else if (id === 'frost') {
    p(7, 2, 3, 10, '#bfeaff'); p(3, 5, 11, 3, '#bfeaff');
    p(5, 3, 2, 2, '#ffffff'); p(11, 9, 2, 2, '#ffffff');
    p(7, 12, 3, 3, '#5a7fa8');
  } else if (id === 'grenade') {
    p(2, 8, 9, 4, '#4a5560'); p(2, 8, 9, 2, '#7b8794');
    p(10, 5, 4, 7, '#3a424c'); p(4, 11, 4, 3, '#8b5a2b');
    p(11, 2, 3, 3, '#3f8a3f');
  } else if (id === 'chain') {
    p(7, 1, 2, 5, '#ffe066'); p(6, 5, 4, 3, '#f2c14e');
    p(5, 8, 6, 2, '#ffe066'); p(4, 10, 3, 3, '#a8e4ff');
    p(7, 12, 2, 3, '#f2c14e');
  }
  ctx.restore();
}

/* 玩家手上拿着的一小截武器（画在世界坐标） */
function drawHeldWeapon(ctx, id, px, py, size) {
  ctx.save();
  ctx.scale(size, size);
  drawWeaponIcon(ctx, id, 0, 0, 1);
  ctx.restore();
}

/* ===================== 技能（一次性道具，最多 3 个） ===================== */
const SKILLS = {
  heal: {
    id: 'heal', name: '治疗药水', short: '治疗',
    desc: '立刻回复 80 点血', color: '#63e08a', key: 'Z'
  },
  nocd: {
    id: 'nocd', name: '过载核心', short: '无冷却',
    desc: '8 秒内武器无冷却', color: '#ffc94a', key: 'X'
  },
  clear: {
    id: 'clear', name: '净化炸弹', short: '清场',
    desc: '干掉当前全部敌人', color: '#ff7070', key: 'C'
  },
  skip: {
    id: 'skip', name: '传送卷轴', short: '跳关',
    desc: '直接传送到下一关', color: '#9b8cff', key: 'V'
  }
};
const SKILL_IDS = Object.keys(SKILLS);

function drawSkillGlyph(c, id, x, y, s) {
  const col = (SKILLS[id] || SKILLS.heal).color;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (id === 'heal') {
    c.fillStyle = col;
    c.fillRect(-2, -8, 4, 16);
    c.fillRect(-8, -2, 16, 4);
  } else if (id === 'nocd') {
    c.fillStyle = col;
    c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#20182a';
    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(6, -5); c.stroke();
  } else if (id === 'clear') {
    c.fillStyle = col;
    c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#20182a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-4, -4); c.lineTo(4, 4); c.moveTo(4, -4); c.lineTo(-4, 4); c.stroke();
  } else {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, -8); c.lineTo(7, 0); c.lineTo(0, 8); c.lineTo(-7, 0);
    c.closePath(); c.fill();
    c.fillStyle = '#20182a';
    c.beginPath(); c.arc(0, 0, 2.4, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
