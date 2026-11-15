'use strict';

/* ===================== 小工具：矩形是否空 ===================== */
function rectFree(L, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (solidAt(L, tx, ty)) return false;
  return true;
}

/* ===================== 粒子 / 飘字 ===================== */
class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.color = color; this.size = size || 3;
  }
  update(dt) {
    this.vy += 900 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
  }
}

class FloatText {
  constructor(text, x, y, color) {
    this.text = text; this.x = x; this.y = y; this.color = color || '#fff';
    this.life = 0.9; this.max = 0.9;
  }
  update(dt) { this.y -= 26 * dt; this.life -= dt; }
}

/* ===================== 主角 ===================== */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 12; this.h = 16;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.form = 'small';
    this.star = 0; this.invuln = 0;
    this.coins = 0; this.energy = 0;
    this.hp = 260; this.maxHp = 260;
    this.regenDelay = 0; this.hurtT = 0;
    this.score = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = 1;
    this.jumpsLeft = 2; this.jumpHold = 0; this.doubleT = 0;
    this.fireCd = 0;
    this.weapons = ['fist']; this.wi = 0;   /* 底部快捷栏，最多 5 把 */
    this.bagW = [];                          /* 背包里没装上的武器 */
    this.deaths = 0;
    this.skills = [];            /* 最多 3 个：[{id, n}] */
    this.nocdT = 0;              /* 无冷却剩余时间 */
    this.god = false; this.noclip = false;
    this.atkCd = 0; this.atkT = 0; this.atkHit = null;
    this.atkDir = 1; this.beamT = 0;
    this.coyote = 0; this.jumpBuf = 0;
    this.combo = 0; this.comboT = 0;
    this.dead = false; this.deadT = 0;
    this.ducking = false;
    this.prevY = 0;
    this.standingOn = null;
    this.animT = 0;
  }

  addScore(n) { this.score += n; }

  giveWeapon(id) {
    if (!WEAPONS[id]) return false;
    if (this.weapons.indexOf(id) >= 0 || this.bagW.indexOf(id) >= 0) return 'have';
    if (this.weapons.length < 5) {
      this.weapons.push(id);
      this.wi = this.weapons.length - 1;
      return 'add';
    }
    this.bagW.push(id);
    return 'bag';
  }

  /* 把背包里的第 bi 件装到快捷栏第 si 格 */
  equipFromBag(bi, si) {
    const id = this.bagW[bi];
    if (!id) return false;
    if (si >= 5) si = 4;
    const old = this.weapons[si];
    this.weapons[si] = id;
    this.bagW.splice(bi, 1);
    if (old && old !== 'fist') this.bagW.push(old);
    this.wi = si;
    return true;
  }

  /* 卸下快捷栏第 si 格（拳套不能卸） */
  unequipSlot(si) {
    const id = this.weapons[si];
    if (!id || id === 'fist') return false;
    this.weapons.splice(si, 1);
    this.bagW.push(id);
    if (this.wi >= this.weapons.length) this.wi = Math.max(0, this.weapons.length - 1);
    return true;
  }

  giveSkill(id) {
    if (!SKILLS[id]) return false;
    const got = this.skills.find(s => s.id === id);
    if (got) { got.n++; return 'stack'; }
    if (this.skills.length >= 3) {
      this.skills[2] = { id, n: 1 };
      return 'replace';
    }
    this.skills.push({ id, n: 1 });
    return 'add';
  }

  useSkill(i, G) {
    const s = this.skills[i];
    if (!s || s.n <= 0) return false;
    s.n--;
    if (s.n <= 0) this.skills.splice(i, 1);
    if (s.id === 'heal') {
      this.hp = Math.min(this.maxHp, this.hp + 80);
      G.float('+80', this.x, this.y - 10, '#7dff9a');
      Sfx.power && Sfx.power();
    } else if (s.id === 'nocd') {
      this.nocdT = 8;
      G.float('无冷却 8s', this.x, this.y - 10, '#ffd166');
      Sfx.power && Sfx.power();
    } else if (s.id === 'clear') {
      let n = 0;
      for (const e of G.enemies) {
        if (!e.dead) { e.hurtBy(G, 9999, this.facing); n++; }
      }
      G.enemies.length = 0;
      G.shake(5, 0.3);
      G.float('清场 x' + n, this.x, this.y - 10, '#ff8f8f');
    } else if (s.id === 'skip') {
      G.float('传送！', this.x, this.y - 10, '#b9aaff');
      G.startLevel(G.levelIndex + 1, this, false);
    }
    return true;
  }

  collectCoin(G) {
    this.coins++;
    this.addScore(10);
    if (this.coins % 10 === 0 && this.energy < 3) {
      this.energy++;
      G.float('能量 +1', this.x, this.y - 10, '#7ee0ff');
      Sfx.power();
    }
    if (this.coins % 100 === 0) {
      this.hp = Math.min(this.maxHp, this.hp + 30);
      Sfx.oneup();
      G.float('生命 +30', this.x, this.y - 20, '#7dff7d');
    }
  }

  grow(G) {
    this.heal(20);
    if (this.form === 'small') {
      this.form = 'super';
      this.h = 28;
      this.y -= 12;
      this.ducking = false;
      Sfx.power();
      G.float('变大', this.x, this.y - 10, '#ffd34a');
    }
  }

  becomeFire(G) {
    this.heal(20);
    if (this.form === 'small') { this.grow(G); return; }
    this.form = 'fire';
    Sfx.power();
    G.float('火焰', this.x, this.y - 10, '#ff8a3c');
  }

  shrink(G) {
    if (this.form === 'small') return;
    this.form = 'small';
    this.h = 16;
    this.y += 12;
    this.ducking = false;
    this.invuln = 2;
    Sfx.hurt();
  }

  hurt(G, dmg) {
    if (this.dead || this.god || this.star > 0 || this.invuln > 0) return;
    const d = dmg === undefined ? 10 : dmg;
    this.hp -= d;
    this.hurtT = 0.35;
    this.regenDelay = 2.4;
    this.invuln = 0.9;
    Sfx.hurt();
    G.float('-' + d, this.x, this.y - 8, '#ff6b6b');
    if (this.hp <= 0) { this.hp = 0; this.die(G); }
  }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp - before;
  }

  die(G) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 1.5;
    this.vy = -380;
    this.vx = 0;
    if (this.h > 16) { this.h = 16; this.y += 12; }
    this.form = 'small';
    Sfx.die();
  }

  update(dt, L, G) {
    const p = this;

    if (p.dead) {
      p.deadT -= dt;
      p.vy += GRAV_DOWN * dt;
      p.y += p.vy * dt;
      return;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.star = Math.max(0, p.star - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.regenDelay > 0) p.regenDelay -= dt;
    else if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 12 * dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.doubleT = Math.max(0, p.doubleT - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.atkT = Math.max(0, p.atkT - dt);
    p.comboT = Math.max(0, p.comboT - dt);
    if (p.comboT <= 0) p.combo = 0;

    /* ---- 蹲下 / 站起：每帧统一身高，避免跳起来还卡在蹲姿 ---- */
    const standH = p.form === 'small' ? 16 : 28;
    const wantDuck = Input.duck() && p.onGround && p.form !== 'small';
    const targetH = wantDuck ? 20 : standH;
    if (p.h !== targetH) {
      if (targetH > p.h) {
        const diff = targetH - p.h;
        if (rectFree(L, p.x, p.y - diff, p.w, targetH)) {
          p.y -= diff; p.h = targetH; p.ducking = wantDuck;
        }
      } else {
        p.y += (p.h - targetH);
        p.h = targetH;
        p.ducking = wantDuck;
      }
    } else {
      p.ducking = wantDuck;
    }

    /* ---- 左右移动 ---- */
    const dir = (Input.right() ? 1 : 0) - (Input.left() ? 1 : 0);
    const maxS = p.ducking ? 55 : (Input.run() ? RUN_V : WALK_V);

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * DASH_V;
      if (p.dashT <= 0) p.vx = p.dashDir * maxS;
    } else if (dir !== 0) {
      p.facing = dir;
      const a = p.onGround ? ACC : ACC * 0.6;
      p.vx = clamp(p.vx + dir * a * dt, -maxS, maxS);
    } else if (p.onGround) {
      if (p.vx > 0) p.vx = Math.max(0, p.vx - FRIC * dt);
      else p.vx = Math.min(0, p.vx + FRIC * dt);
    }

    /* ---- 冲刺 ---- */
    if (Input.hit('KeyL') && p.energy > 0 && p.dashCd <= 0 && p.dashT <= 0) {
      p.energy--;
      p.dashT = DASH_T;
      p.dashCd = DASH_CD;
      p.dashDir = p.facing;
      p.vx = p.dashDir * DASH_V;
      Sfx.dash();
    }

    /* ---- 跳跃 ---- */
    if (Input.jumpHit()) p.jumpBuf = JUMP_BUF;
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
    if (p.onGround) p.jumpsLeft = 2;

    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        /* 地面起跳 */
        p.vy = -JUMP_V;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.jumpsLeft = 1;
        p.jumpHold = JUMP_HOLD;
        Sfx.jump();
      } else if (p.jumpsLeft > 0 && p.dashT <= 0) {
        /* 二段跳 */
        p.vy = -JUMP_V2;
        p.jumpBuf = 0;
        p.jumpsLeft--;
        p.jumpHold = JUMP_HOLD2;
        p.doubleT = 0.25;
        Sfx.doubleJump ? Sfx.doubleJump() : Sfx.jump();
        if (G.puff) G.puff(p.x + p.w / 2, p.y + p.h, 5);
      }
    }
    /* 松手小跳：只有按住超过最短时间才允许截断，避免快速轻点变成原地蹭 */
    if (p.jumpHold > 0) {
      p.jumpHold -= dt;
    } else if (p.vy < 0 && !Input.jumpDown() && p.vy < -JUMP_CUT) {
      p.vy = -JUMP_CUT;
    }

    /* ---- 切换武器（1~5 / Q）---- */
    for (let i = 0; i < p.weapons.length && i < 5; i++) {
      if (Input.hit('Digit' + (i + 1))) { p.wi = i; G.float(WEAPONS[p.weapons[i]].name, p.x, p.y - 12, '#ffe066'); }
    }
    if (Input.hit('KeyQ')) { p.wi = (p.wi + 1) % p.weapons.length; }

    /* ---- 技能（Z / X / C / V）---- */
    const SKK = ['KeyZ', 'KeyX', 'KeyC', 'KeyV'];
    for (let i = 0; i < p.skills.length && i < 4; i++) {
      if (Input.hit(SKK[i])) p.useSkill(i, G);
    }

    /* ---- 无冷却计时 ---- */
    if (p.nocdT > 0) p.nocdT = Math.max(0, p.nocdT - dt);

    /* ---- 使用武器（J，按武器冷却）---- */
    if (Input.hit('KeyJ') && (p.atkCd <= 0 || p.nocdT > 0) && p.dashT <= 0) {
      const w = WEAPONS[p.weapons[p.wi]] || WEAPONS.fist;
      p.atkCd = p.nocdT > 0 ? 0.06 : w.cd;
      p.atkDir = p.facing;
      if (w.kind === 'melee') {
        p.atkT = w.smash ? 0.24 : 0.18;
        p.atkHit = [];
        Sfx.swing ? Sfx.swing() : Sfx.dash();
        if (w.smash) G.shake(2, 0.12);
      } else if (w.kind === 'shot') {
        if (G.fireballs.length < (w.limit || 3)) {
          const fx = p.facing > 0 ? p.x + p.w : p.x - 8;
          const fb = new Fireball(fx, p.y + p.h * 0.4, p.facing);
          fb.dmg = w.dmg; fb.speed = w.speed; fb.kind = 'fire';
          if (w.slow) fb.slow = true;
          G.fireballs.push(fb);
        }
        Sfx.fire();
      } else if (w.kind === 'spread') {
        for (let i = 0; i < w.pellets; i++) {
          const fb = new Fireball(p.x + p.w / 2, p.y + p.h * 0.4, p.facing);
          fb.dmg = w.dmg; fb.speed = w.speed; fb.kind = 'pellet';
          fb.vy = (i - 1) * 90;
          G.fireballs.push(fb);
        }
        Sfx.fire();
      } else if (w.kind === 'boom') {
        G.booms.push(new Boomerang(p.x + p.w / 2, p.y + p.h * 0.4, p.facing, w.dmg, w.speed));
        Sfx.fire();
      } else if (w.kind === 'lob') {
        const fb = new Fireball(p.x + p.w / 2, p.y + p.h * 0.35, p.facing);
        fb.vx = p.facing * w.speed * 0.85;
        fb.vy = -230;
        fb.dmg = w.dmg; fb.aoe = w.aoe; fb.kind = 'grenade';
        G.fireballs.push(fb);
        Sfx.fire();
      } else if (w.kind === 'chain') {
        const list = G.enemies
          .filter(e => !e.dead && Math.abs(e.x - p.x) < w.range && Math.abs(e.y - p.y) < 90)
          .sort((a, b2) => Math.abs(a.x - p.x) - Math.abs(b2.x - p.x))
          .slice(0, w.links || 3);
        const pts = [{ x: p.x + p.w / 2, y: p.y + p.h * 0.45 }];
        for (const e of list) {
          e.hurtBy(G, w.dmg, Math.sign(e.x - p.x) || 1);
          pts.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
        }
        G.chain = { pts, t: 0.24 };
        Sfx.fire();
        G.shake(1, 0.06);
      } else if (w.kind === 'beam') {
        G.beam = { x: p.x + p.w / 2, y: p.y + p.h * 0.45, dir: p.facing, t: 0.16, len: w.range, dmg: w.dmg };
        Sfx.fire();
        G.shake(2, 0.08);
      }
    }

    /* ---- 重力 + 位移 ---- */
    p.vy = Math.min(p.vy + (p.vy < 0 ? GRAV_UP : GRAV_DOWN) * dt, MAX_FALL);
    p.prevY = p.y;
    p.onGround = false;
    p.standingOn = null;

    /* 冲刺破砖 */
    if (p.dashT > 0) {
      const probeX = p.dashDir > 0 ? p.x + p.w + 4 : p.x - 4;
      const tx = Math.floor(probeX / TILE);
      const ty0 = Math.floor(p.y / TILE);
      const ty1 = Math.floor((p.y + p.h - 1) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (tileAt(L, tx, ty) === T.BRICK) G.breakBrick(tx, ty);
      }
    }

    if (p.noclip) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.onGround = true;
      const hit = null;
      if (hit && hit.ceil) p.headBump(hit.tx, hit.ty, G);
    } else {
    moveX(p, L, dt);
    const hit = moveY(p, L, dt);
    if (hit && hit.ceil) p.headBump(hit.tx, hit.ty, G);
    }

    /* ---- 移动平台 ---- */
    for (const plat of G.platforms) {
      if (p.vy >= 0 &&
          p.prevY + p.h <= plat.y + 6 &&
          p.y + p.h >= plat.y &&
          p.x + p.w > plat.x + 1 &&
          p.x < plat.x + plat.w - 1) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.standingOn = plat;
      }
    }
    if (p.standingOn) p.x += p.standingOn.vx * dt;

    if (p.onGround && Math.abs(p.vx) > 8) p.animT += dt;

    /* ---- 近战判定 ---- */
    if (p.atkT > 0 && p.atkHit) {
      const w = WEAPONS[p.weapons[p.wi]] || WEAPONS.fist;
      const reach = w.reach || 16;
      const bx = p.atkDir > 0 ? p.x + p.w - 2 : p.x - reach + 2;
      const box = { x: bx, y: p.y - 2, w: reach, h: p.h + 4 };
      for (const e of G.enemies) {
        if (e.dead || p.atkHit.indexOf(e) >= 0) continue;
        if (overlap(box, e)) {
          p.atkHit.push(e);
          e.hurtBy(G, w.dmg, Math.sign(e.x - p.x) || p.facing);
          if (w.smash) { e.vx = Math.sign(e.x - p.x) * 240; e.vy = -160; }
          if (w.smash) {
            const tx = Math.floor((p.atkDir > 0 ? box.x + box.w : box.x) / TILE);
            for (let ty = Math.floor(p.y / TILE); ty <= Math.floor((p.y + p.h) / TILE); ty++) {
              if (tileAt(L, tx, ty) === T.BRICK) G.breakBrick(tx, ty);
            }
          }
        }
      }
    }

    /* ---- 敌人碰撞 ---- */
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (!overlap(p, e)) continue;

      if (p.dashT > 0 && e.dashable) { e.kill(G, 'dash'); p.addScore(150); continue; }
      if (p.star > 0) { e.kill(G, 'star'); p.addScore(200); continue; }

      const stomp = p.vy > 0 && (p.y + p.h) - e.y < 14;
      if (stomp && e.stompable) {
        e.onStomp(p, G);
        p.vy = -320;
        p.combo++;
        p.comboT = 1.2;
        const gain = 100 * Math.pow(2, Math.min(p.combo - 1, 4));
        p.addScore(gain);
        G.float('+' + gain, e.x, e.y - 8, '#fff27a');
        Sfx.stomp();
      } else if (e.kind === 'shell' && Math.abs(e.vx) < 20) {
        e.vx = p.facing * 260;
        Sfx.kick();
      } else {
        p.hurt(G, Math.round(10 * (G.dmgScale || 1)));
      }
    }

    /* ---- 道具碰撞 ---- */
    for (const it of G.items) {
      if (it.dead) continue;
      if (overlap(p, it)) it.collect(p, G);
    }

    /* ---- 掉出世界 ---- */
    if (p.y > L.h * TILE + 32) p.die(G);
  }

  headBump(tx, ty, G) {
    const L = G.level;
    const t = L.tiles[ty] ? L.tiles[ty][tx] : T.EMPTY;
    G.bumpEnemiesAt(tx, ty);
    if (t === T.QCOIN) {
      L.tiles[ty][tx] = T.USED;
      this.collectCoin(G);
      this.addScore(200);
      G.coinPop(tx, ty);
      Sfx.coin();
    } else if (t === T.QPOWER) {
      L.tiles[ty][tx] = T.USED;
      const kind = this.form === 'small' ? 'mushroom' : 'flower';
      G.spawnItem(kind, tx * TILE, (ty - 1) * TILE);
      Sfx.bump();
    } else if (t === T.BRICK) {
      if (this.form !== 'small') {
        G.breakBrick(tx, ty);
        this.addScore(50);
        Sfx.brick();
      } else {
        Sfx.bump();
      }
    } else {
      Sfx.bump();
    }
  }
}

/* ===================== 敌人 ===================== */
class Enemy {
  constructor(kind, x, feetY) {
    this.kind = kind;
    this.dead = false;
    this.t = 0;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.dir = -1;
    this.squashed = 0;
    this.dashable = true;

    const sizes = {
      goomba: [16, 16], koopa: [16, 22], shell: [16, 12],
      flyer: [16, 14], piranha: [16, 24],
      spitter: [16, 22], charger: [18, 16], spike: [16, 16],
      bat: [18, 12], bomber: [16, 17],
      ghost: [16, 20], mole: [18, 14], turret: [18, 18]
    };
    const s = sizes[kind] || [16, 16];
    this.w = s[0]; this.h = s[1];
    this.x = x + (16 - this.w) / 2;
    this.y = feetY - this.h;
    this.baseY = this.y;
    this.x0 = this.x;

    if (kind === 'goomba') { this.vx = -40; this.stompable = true; }
    if (kind === 'koopa') { this.vx = -45; this.stompable = true; }
    if (kind === 'shell') { this.vx = 0; this.stompable = true; }
    if (kind === 'flyer') { this.vx = 0; this.stompable = false; this.passThrough = true; this.baseY = this.y; }
    if (kind === 'piranha') {
      this.stompable = false;
      this.dashable = false;
      this.base = feetY;       // 管道口 y
      this.out = 0;
      this.y = feetY + 2;
    }
    if (kind === 'spitter') { this.vx = -18; this.stompable = true; this.cd = 1.4; }
    if (kind === 'charger') { this.vx = -26; this.stompable = true; this.cd = 0; this.chargeT = 0; this.chargeDir = -1; }
    if (kind === 'spike') { this.vx = -20; this.stompable = false; this.dashable = false; }
    if (kind === 'bat') { this.vx = 0; this.stompable = false; this.passThrough = true; this.baseY = this.y; this.dir = -1; }
    if (kind === 'bomber') { this.vx = -22; this.stompable = true; this.cd = 1.6; this.throwT = 0; }
    if (kind === 'ghost') { this.vx = 0; this.stompable = false; this.passThrough = true; this.noGrav = true; this.dir = -1; }
    if (kind === 'mole') { this.vx = 0; this.stompable = true; this.cd = 1.2; this.hidden = true; this.vy = 0; this.noGrav = true; }
    if (kind === 'turret') { this.vx = 0; this.stompable = false; this.dashable = false; this.cd = 1.8; this.burst = 0; }

    const HP = {
      goomba: 34, koopa: 48, shell: 999, flyer: 26, piranha: 62,
      spitter: 46, charger: 86, spike: 110, bat: 30, bomber: 66
    };
    this.hp = HP[kind] || 20;
    this.maxHp = this.hp;
    this.flash = 0;
  }

  hurtBy(G, dmg, dir) {
    if (this.dead) return;
    if (this.kind === 'shell') { return; }
    this.hp -= dmg;
    this.flash = 0.16;
    this.vx = (dir || 1) * 120;
    G.hitstop = Math.max(G.hitstop || 0, 0.045);
    for (let i = 0; i < 4; i++) {
      G.particles.push(new Particle(
        this.x + this.w / 2, this.y + this.h / 2,
        (Math.random() - 0.5) * 200, -Math.random() * 160,
        0.3, i % 2 ? PAL.white : PAL.goldLight, 2
      ));
    }
    if (this.hp <= 0) {
      this.kill(G, 'skill');
      G.addScore(150);
      G.float('+150', this.x, this.y - 8, '#fff27a');
      Sfx.stomp();
      if (Math.random() < 0.12) G.dropSkill(this.x + this.w / 2, this.y);
    }
  }

  kill(G, why) {
    if (this.dead) return;
    this.dead = true;
    const col = this.kind === 'koopa' ? PAL.koopa : (this.kind === 'flyer' ? PAL.white : PAL.goomba);
    for (let i = 0; i < 6; i++) {
      G.particles.push(new Particle(
        this.x + this.w / 2, this.y + this.h / 2,
        (Math.random() - 0.5) * 160, -Math.random() * 180 - 40,
        0.5, col, 3
      ));
    }
  }

  onStomp(p, G) {
    if (this.kind === 'koopa') {
      this.kind = 'shell';
      this.h = 12;
      this.y += 10;
      this.vx = 0;
      this.stompable = true;
    } else if (this.kind === 'shell') {
      this.vx = 0;
    } else {
      this.kill(G, 'stomp');
    }
  }

  update(dt, L, G) {
    if (this.dead) return;
    this.t += dt;

    if (this.kind === 'piranha') {
      const cycle = 3.4;
      const p = (this.t % cycle) / cycle;
      let out = 0;
      if (p < 0.18) out = p / 0.18;
      else if (p < 0.62) out = 1;
      else if (p < 0.80) out = 1 - (p - 0.62) / 0.18;
      else out = 0;
      this.out = out;
      this.y = this.base + 2 - 28 * out;
      return;
    }

    if (this.kind === 'flyer') {
      this.x += this.dir * 26 * dt;
      if (this.x < this.x0 - 46) this.dir = 1;
      if (this.x > this.x0 + 46) this.dir = -1;
      this.y = this.baseY + Math.sin(this.t * 2.2) * 14;
      return;
    }

    if (this.flash > 0) this.flash -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    /* 蝙蝠：追着玩家飞 */
    if (this.kind === 'bat') {
      const pp = G.player;
      const tx = pp.x + pp.w / 2, ty = pp.y + pp.h / 2 - 10;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = tx - cx, dy = ty - cy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = this.slowT > 0 ? 34 : 62;
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      this.dir = Math.sign(dx) || this.dir;
      return;
    }

    /* 炸弹兵：边走边扔抛物线炸弹 */
    if (this.kind === 'bomber') {
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      this.cd -= dt;
      if (this.throwT > 0) this.throwT -= dt;
      if (this.cd <= 0 && Math.abs(dx) < 240) {
        this.cd = 2.4;
        this.throwT = 0.25;
        this.dir = Math.sign(dx) || 1;
        const b = new EBullet(this.x + this.w / 2, this.y - 2, this.dir * 120, -210);
        b.grav = 620; b.dmg = 14; b.bomb = true;
        G.ebullets.push(b);
      }
    }

    /* 喷吐怪：站定朝玩家吐弹 */
    if (this.kind === 'spitter') {
      this.cd -= dt;
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      const dy = (pp.y + pp.h / 2) - (this.y + this.h / 2);
      if (this.cd <= 0 && Math.abs(dx) < 250 && Math.abs(dy) < 40) {
        this.cd = 1.9;
        this.dir = Math.sign(dx) || 1;
        G.ebullets.push(new EBullet(this.x + this.w / 2 + this.dir * 8, this.y + 6,
          this.dir * 130, 0));
        Sfx.fire();
      }
    }

    /* 冲锋怪：进入直线视野后加速冲撞 */
    if (this.kind === 'charger') {
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      if (this.chargeT > 0) {
        this.chargeT -= dt;
        this.vx = this.chargeDir * 210;
      } else {
        this.cd = Math.max(0, this.cd - dt);
        if (this.cd <= 0 && Math.abs(dx) < 210 && Math.abs(pp.y - this.y) < 26) {
          this.chargeT = 0.85;
          this.chargeDir = Math.sign(dx) || 1;
          this.dir = this.chargeDir;
          this.cd = 2.4;
          Sfx.hurt();
        } else {
          this.vx = this.dir * 26;
        }
      }
    }

    /* 幽灵：穿墙直线追人，慢但甩不掉 */
    if (this.kind === 'ghost') {
      const pp = G.player;
      const tx = pp.x + pp.w / 2, ty = pp.y + pp.h / 2;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = tx - cx, dy = ty - cy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = (this.slowT > 0 ? 26 : 46);
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      this.dir = Math.sign(dx) || this.dir;
      return;
    }

    /* 地鼠：躲在土里，玩家靠近就跳出来 */
    if (this.kind === 'mole') {
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      this.cd -= dt;
      if (this.hidden) {
        this.y = this.baseY + this.h;
        if (Math.abs(dx) < 96 && this.cd <= 0) {
          this.hidden = false;
          this.vy = -310;
          this.vx = Math.sign(dx) * 60;
          this.cd = 2.2;
          Sfx.hurt();
        }
        return;
      }
      this.vy = Math.min(this.vy + GRAV_DOWN * dt, MAX_FALL);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > this.baseY + this.h) { this.y = this.baseY + this.h; this.vy = 0; this.vx = 0; this.hidden = true; }
      return;
    }

    /* 炮台：站桩，成对发射弹丸 */
    if (this.kind === 'turret') {
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      const dy = (pp.y + pp.h / 2) - (this.y + this.h / 2);
      this.dir = Math.sign(dx) || this.dir;
      this.cd -= dt;
      if (this.cd <= 0 && Math.abs(dx) < 300) {
        this.burst = 2;
        this.cd = 2.6;
      }
      if (this.burst > 0 && this.cd < 2.2) {
        this.burst--;
        const d = Math.hypot(dx, dy) || 1;
        G.ebullets.push(new EBullet(this.x + this.w / 2, this.y + 6,
          (dx / d) * 150, (dy / d) * 150));
        Sfx.fire();
      }
      return;
    }

    /* 走路类 */
    this.vy = Math.min(this.vy + GRAV_DOWN * dt, MAX_FALL);
    this.onGround = false;

    const oldVx = this.vx;
    if (this.slowT > 0) this.vx *= 0.45;
    const hitW = moveX(this, L, dt);
    if (hitW) this.vx = -oldVx;

    const hitY = moveY(this, L, dt);

    if (this.onGround && this.vx !== 0) {
      const dirSign = this.vx > 0 ? 1 : -1;
      if (!hasFloorAhead(L, this, dirSign)) this.vx = -this.vx;
    }

    /* 龟壳撞人 */
    if (this.kind === 'shell' && Math.abs(this.vx) > 30) {
      for (const e of G.enemies) {
        if (e === this || e.dead) continue;
        if (overlap(this, e)) {
          e.kill(G, 'shell');
          G.addScore(200);
          G.float('+200', e.x, e.y - 6, '#fff27a');
          Sfx.stomp();
        }
      }
      for (const b of G.blocks) {
        if (overlap(this, b)) {
          G.breakBrick(b.tx, b.ty);
          this.vx = -this.vx;
          break;
        }
      }
    }

    if (this.y > L.h * TILE + 40) this.dead = true;
  }
}

/* ===================== 敌方弹幕 ===================== */
class EBullet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.w = 8; this.h = 8;
    this.vx = vx; this.vy = vy || 0;
    this.dead = false; this.t = 0;
    this.grav = 0; this.dmg = 10; this.bomb = false;
  }
  update(dt, L, G) {
    if (this.dead) return;
    this.t += dt;
    if (this.grav) this.vy += this.grav * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const tx = Math.floor((this.x + 4) / TILE), ty = Math.floor((this.y + 4) / TILE);
    if (solidAt(L, tx, ty)) {
      this.dead = true;
      if (this.bomb && G.explode) G.explode(this.x, this.y, 30, 16);
      return;
    }
    const p = G.player;
    if (p && !p.dead && overlap(this, p)) {
      p.hurt(G, Math.round(this.dmg * (G.dmgScale || 1)));
      this.dead = true;
      return;
    }
    if (this.t > 6 || this.y > L.h * TILE) this.dead = true;
  }
}

/* ===================== 道具 ===================== */
class Item {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.w = 16; this.h = 16;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.t = Math.random() * 3;
    this.baseY = y;
    this.onGround = false;

    if (kind === 'mushroom') this.vx = 50;
    if (kind === 'star') this.vx = 60;
  }

  collect(p, G) {
    if (this.dead) return;
    this.dead = true;
    if (this.kind === 'coin') {
      p.collectCoin(G);
      Sfx.coin();
      G.float('+10', this.x, this.y - 4, '#ffd34a');
    } else if (this.kind === 'mushroom') {
      p.grow(G);
      p.addScore(1000);
      G.float('+1000', this.x, this.y - 4, '#ffd34a');
    } else if (this.kind === 'flower') {
      p.becomeFire(G);
      p.addScore(1000);
      G.float('+1000', this.x, this.y - 4, '#ffd34a');
    } else if (this.kind === 'star') {
      p.star = 8;
      p.addScore(1000);
      G.float('无敌 8 秒', this.x, this.y - 4, '#ffe23c');
      Sfx.power();
    }
  }

  update(dt, L, G) {
    if (this.dead) return;
    this.t += dt;

    if (this.kind === 'coin' || this.kind === 'flower') return; // 静止

    this.vy = Math.min(this.vy + GRAV_DOWN * dt, MAX_FALL);
    const oldVx = this.vx;
    if (this.slowT > 0) this.vx *= 0.45;
    const hitW = moveX(this, L, dt);
    if (hitW) this.vx = -oldVx;
    this.onGround = false;
    moveY(this, L, dt);

    if (this.kind === 'star' && this.onGround) this.vy = -420;
    if (this.onGround && this.vx !== 0) {
      const s = this.vx > 0 ? 1 : -1;
      if (!hasFloorAhead(L, this, s)) this.vx = -this.vx;
    }
    if (this.y > L.h * TILE + 32) this.dead = true;
  }
}

/* ===================== 火球 ===================== */
class Fireball {
  constructor(x, y, dir) {
    this.x = x; this.y = y; this.w = 8; this.h = 8;
    this.vx = dir * 260; this.vy = 120;
    this.dead = false; this.t = 0;
    this.wall = false;
  }

  update(dt, L, G) {
    if (this.dead) return;
    this.t += dt;
    this.vy = Math.min(this.vy + 900 * dt, 420);

    this.vx = Math.abs(this.vx) * Math.sign(this.vx);
    const hitW = moveX(this, L, dt);
    if (hitW) { this.explode(G); return; }

    const hitY = moveY(this, L, dt);
    if (hitY && hitY.ground) this.vy = -300;
    if (hitY && hitY.ceil) this.vy = 60;

    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.kind === 'piranha' && e.out < 0.3) continue;
      if (overlap(this, e)) {
        e.hurtBy(G, this.dmg || 20, Math.sign(this.vx) || 1);
        if (this.slow) e.slowT = 1.8;
        this.explode(G);
        return;
      }
    }
    if (this.t > 5 || this.y > L.h * TILE + 20) this.explode(G);
  }

  explode(G) {
    this.dead = true;
    if (this.aoe) G.explode(this.x, this.y, this.aoe, Math.round((this.dmg || 20) * 0.7), 0, '#ffb14a');
    for (let i = 0; i < 5; i++) {
      G.particles.push(new Particle(
        this.x, this.y,
        (Math.random() - 0.5) * 140, -Math.random() * 120,
        0.3, i % 2 ? PAL.fire : PAL.fireLight, 2
      ));
    }
  }
}

/* ===================== 移动平台 ===================== */
/* ===================== 回旋镖 ===================== */
class Boomerang {
  constructor(x, y, dir, dmg, speed) {
    this.x = x; this.y = y; this.w = 10; this.h = 10;
    this.vx = dir * (speed || 320); this.vy = -60;
    this.dir = dir; this.dmg = dmg || 20; this.speed = speed || 320;
    this.t = 0; this.phase = 'out'; this.dead = false;
    this.hits = [];
  }

  update(dt, L, G) {
    if (this.dead) return;
    this.t += dt;
    if (this.phase === 'out') {
      this.x += this.vx * dt;
      this.vy += 260 * dt;
      this.y += this.vy * dt;
      if (this.t > 0.55 || solidAt(L, Math.floor(this.x / TILE), Math.floor(this.y / TILE))) {
        this.phase = 'back';
      }
    } else {
      const p = G.player;
      if (!p) { this.dead = true; return; }
      const dx = (p.x + p.w / 2) - (this.x + 5);
      const dy = (p.y + p.h / 2) - (this.y + 5);
      const d = Math.hypot(dx, dy) || 1;
      const sp = this.speed * 1.25;
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      if (d < 12) { this.dead = true; return; }
    }
    for (const e of G.enemies) {
      if (e.dead || this.hits.indexOf(e) >= 0) continue;
      if (overlap(this, e)) {
        this.hits.push(e);
        e.hurtBy(G, this.dmg, Math.sign(this.vx) || 1);
      }
    }
    if (this.t > 3.2) this.dead = true;
  }
}

const ENEMY_KINDS = {
  goomba: 1, koopa: 1, shell: 1, flyer: 1, piranha: 1,
  spitter: 1, charger: 1, spike: 1, bat: 1, bomber: 1,
  ghost: 1, mole: 1, turret: 1
};

class MovingPlatform {
  constructor(x, y, w, range, speed) {
    this.x = x; this.y = y; this.w = w; this.h = 10;
    this.x0 = x; this.range = range;
    this.vx = speed; this.dir = 1;
  }
  update(dt) {
    this.x += this.vx * dt;
    if (this.x < this.x0) { this.x = this.x0; this.vx = Math.abs(this.vx); }
    if (this.x > this.x0 + this.range) { this.x = this.x0 + this.range; this.vx = -Math.abs(this.vx); }
  }
}

/* ===================== 箱子（武器 / 金币 / 陷阱 / 炸弹 / 未知） ===================== */
const BOX_TYPES = ['weapon', 'coin', 'trap', 'bomb', 'mystery'];

class Box {
  constructor(type, x, y) {
    this.type = type || 'mystery';
    this.x = x; this.y = y;
    this.w = 16; this.h = 16;
    this.dead = false;
    this.bump = 0;
    this.hp = this.type === 'bomb' ? 1 : 1;
  }
  update(dt) {
    if (this.bump > 0) this.bump -= dt;
  }
}

/* ===================== 弹簧 ===================== */
class Spring {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 16; this.h = 12;
    this.squash = 0;
  }
  update(dt) { if (this.squash > 0) this.squash -= dt; }
}

/* ===================== 刷怪笼 ===================== */
class Spawner {
  constructor(kind, x, feetY, interval) {
    this.spawnKind = kind;
    this.x = x; this.y = feetY - 24;
    this.w = 20; this.h = 24;
    this.hp = 70; this.maxHp = 70;
    this.cd = 1.2;
    this.interval = interval || 2.6;
    this.dead = false;
    this.flash = 0;
    this.born = 0;
  }
  hurtBy(G, dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.15;
    G.hitstop = Math.max(G.hitstop || 0, 0.04);
    if (this.hp <= 0) {
      this.dead = true;
      G.addScore(250);
      G.float('刷怪笼破坏', this.x, this.y - 10, '#ffd34a');
      for (let i = 0; i < 14; i++) {
        G.particles.push(new Particle(this.x + 10, this.y + 12,
          (Math.random() - 0.5) * 260, -Math.random() * 240,
          0.7, i % 2 ? '#8b6f4e' : '#c9a26b', 3));
      }
      G.shake(3, 0.25);
      if (Sfx.crash) Sfx.crash();
    }
  }
  update(dt, L, G) {
    if (this.dead) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    /* 蝙蝠：追着玩家飞 */
    if (this.kind === 'bat') {
      const pp = G.player;
      const tx = pp.x + pp.w / 2, ty = pp.y + pp.h / 2 - 10;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const dx = tx - cx, dy = ty - cy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = this.slowT > 0 ? 34 : 62;
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      this.dir = Math.sign(dx) || this.dir;
      return;
    }

    /* 炸弹兵：边走边扔抛物线炸弹 */
    if (this.kind === 'bomber') {
      const pp = G.player;
      const dx = (pp.x + pp.w / 2) - (this.x + this.w / 2);
      this.cd -= dt;
      if (this.throwT > 0) this.throwT -= dt;
      if (this.cd <= 0 && Math.abs(dx) < 240) {
        this.cd = 2.4;
        this.throwT = 0.25;
        this.dir = Math.sign(dx) || 1;
        const b = new EBullet(this.x + this.w / 2, this.y - 2, this.dir * 120, -210);
        b.grav = 620; b.dmg = 14; b.bomb = true;
        G.ebullets.push(b);
      }
    }
    const p = G.player;
    if (!p) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d > 340) return;
    this.cd -= dt;
    if (this.cd <= 0) {
      this.cd = this.interval;
      const live = G.enemies.filter((e) => !e.dead && e.fromSpawner).length;
      if (live < 3) {
        const e = new Enemy(this.spawnKind, this.x, this.y + this.h);
        e.fromSpawner = true;
        G.enemies.push(e);
        G.float('!', this.x + 8, this.y - 6, '#ff8a3c');
      }
    }
  }
}

/* ===================== 墓碑（回收武器） ===================== */
class Tombstone {
  constructor(x, y, weapons) {
    this.x = x; this.y = y;
    this.weapons = (weapons || []).slice();
    this.w = 18; this.h = 22;
    this.dead = false;
    this.t = 0;
  }
  update(dt) { this.t += dt; }
  hasAny() { return this.weapons.some((w) => w !== 'fist'); }
}
