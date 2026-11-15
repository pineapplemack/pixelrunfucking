'use strict';


const SKILL_KEY = { melee: 'J', ranged: 'K', pound: '↓J' };
const UI_FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';

const Game = {
  canvas: null,
  ctx: null,
  uiCanvas: null,
  uctx: null,
  uiScale: 1,
  dpr: 1,
  state: 'play',          // play | paused | clear | win
  level: null,
  levelIndex: 0,
  player: null,
  enemies: [],
  items: [],
  fireballs: [],
  ebullets: [],
  altars: [],
  booms: [],
  beam: null,
  pickups: [],
  orbs: [],
  bag: false,
  boxes: [],
  springs: [],
  spawners: [],
  tombstone: null,
  prompt: null,
  toastMsg: '',
  toastT: 0,
  dmgScale: 1,
  hitstop: 0,
  particles: [],
  floats: [],
  platforms: [],
  blocks: [],
  cam: { x: 0, y: 0 },
  time: 0,
  seed: 0,
  best: 0,
  clearT: 0,
  hintT: 0,
  muted: false,
  volume: 0.6,
  checkpointX: 0,
  checkpointIdx: -1,
  checkpointY: 0,
  respawnT: 0,
  shakeT: 0,
  shakeMag: 0,

  /* ===================== 初始化 ===================== */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.uiCanvas = document.getElementById('ui');
    this.uctx = this.uiCanvas ? this.uiCanvas.getContext('2d') : null;

    this.loadSave();

    const hash = location.hash || '';
    const m = /seed=(\d+)/.exec(hash);
    this.seed = m ? parseInt(m[1], 10) : (Math.floor(Math.random() * 9000) + 1000);
    const lm = /lvl=(\d+)/.exec(hash);
    const tm = /tx=(\d+)/.exec(hash);
    this.debugLvl = lm ? parseInt(lm[1], 10) : 0;
    this.debugTx = tm ? parseInt(tm[1], 10) : 0;

    this.bindUI();
    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.startLevel(this.debugLvl || 0, null);
    if (/bag/.test(location.hash)) {
      this.bag = true;
      ['sword', 'wand', 'hammer', 'boom', 'shot', 'laser', 'drill'].forEach((id) => this.player.giveWeapon(id));
      this.player.giveSkill('heal');
      this.player.giveSkill('nocd');
      this.player.giveSkill('skip');
    }
    if (/onpipe/.test(location.hash) && this.level.goal && this.level.goal.kind === 'pipe') {
      this.player.x = this.level.goal.x + 6;
      this.player.y = this.level.goal.y - this.player.h - 1;
      this.cam.x = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, this.level.w * TILE - VIEW_W));
    }
    if (this.debugTx) {
      this.player.x = this.debugTx * TILE;
      this.cam.x = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, this.level.w * TILE - VIEW_W));
    }
    this.state = 'title';
    this.titleT = 0;
    if (/play/.test(location.hash)) this.state = 'play';
    this.hintT = 3.2;
    const pb = document.getElementById('btnPlay');
    if (pb) pb.textContent = '❚❚';
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  },

  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem('pixelrun.save') || '{}');
      this.best = s.best || 0;
      this.muted = !!s.muted;
      this.volume = s.volume === undefined ? 0.6 : s.volume;
    } catch (e) { /* 忽略 */ }
    Sfx.setVolume(this.volume);
    Sfx.setMuted(this.muted);
    const b = document.getElementById('bestLabel');
    if (b) b.textContent = this.best;
    const mute = document.getElementById('btnMute');
    if (mute) { mute.textContent = this.muted ? '🔇' : '🔊'; mute.classList.toggle('off', this.muted); }
  },

  save() {
    try {
      localStorage.setItem('pixelrun.save', JSON.stringify({
        best: this.best, muted: this.muted, volume: this.volume
      }));
    } catch (e) { /* 忽略 */ }
  },

  resize() {
    const stage = document.getElementById('stage');
    const frame = document.getElementById('frame');
    if (!stage || !frame) return;
    const r = stage.getBoundingClientRect();
    let s = Math.min(r.width / W, r.height / H);
    if (!(s > 0)) s = 1;
    const fw = Math.round(W * s), fh = Math.round(H * s);
    frame.style.width = fw + 'px';
    frame.style.height = fh + 'px';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.uiScale = fw / W;
    if (!this.uiCanvas) return;
    this.uiCanvas.width = Math.round(fw * dpr);
    this.uiCanvas.height = Math.round(fh * dpr);
    this.uiCanvas.style.width = fw + 'px';
    this.uiCanvas.style.height = fh + 'px';
  },

  /* ===================== 关卡 ===================== */
  /* 兜底：把过宽的坑中间填成地面，只留两端各一格真坑 */
  safetyPits(L) {
    const gr = GROUND_ROW;
    let x = 1;
    while (x < L.w - 1) {
      if (L.tiles[gr][x] !== 0) { x++; continue; }
      let s = x;
      while (x < L.w && L.tiles[gr][x] === 0) x++;
      const e = x, pw = e - s;
      if (pw < 3) continue;
      /* 中间填实：两端各留一格坑，宽度永远不会超过 2 格 */
      for (let bx = s + 1; bx <= e - 2; bx++) {
        for (let cy = gr; cy < L.h; cy++) L.tiles[cy][bx] = T.GROUND;
        for (let cy = gr - 6; cy < gr; cy++) {
          const t = L.tiles[cy][bx];
          if (t === T.HARD || t === T.BRICK) L.tiles[cy][bx] = 0;
        }
      }
    }
  },

  startLevel(index, keep, atCheckpoint) {
    this.levelIndex = index;

    if (index >= HANDMADE.length) {
      this.state = 'win';
      this.player.addScore(5000);
      return;
    }

    const b = new LevelBuilder(160);
    HANDMADE[index].build(b);
    b.name = HANDMADE[index].name;
    b.index = index;
    const goalCol = b.goal ? Math.floor(b.goal.x / TILE) : b.w - 1;
    b.w = Math.min(b.w, goalCol + 9);
    this.safetyPits(b);
    this.addCheckpoints(b, goalCol);
    this.level = b;

    this.enemies = [];
    this.items = [];
    this.fireballs = [];
    this.ebullets = [];
    this.altars = [];
    this.booms = [];
    this.chain = null;
    this.beam = null;
    this.pickups = [];
    this.orbs = [];
    this.boxes = [];
    this.springs = [];
    this.spawners = [];
    this.hitstop = 0;
    if (!atCheckpoint) this.tombstone = null;
    this.particles = [];
    this.floats = [];
    this.platforms = [];
    this.blocks = [];
    this.clearT = 0;
    this.pipeT = 0;

    for (const e of b.ents) {
      if (e.kind === 'checkpoint') continue;
      if (e.kind === 'altar' || e.kind === 'weapon') {
        this.altars.push({ weapon: e.weapon || e.skill || 'sword', x: e.x, y: e.y, used: false });
        continue;
      }
      if (e.kind === 'box') { this.boxes.push(new Box(e.box, e.x, e.y)); continue; }
      if (e.kind === 'spring') { this.springs.push(new Spring(e.x, e.y)); continue; }
      if (e.kind === 'spawner') { this.spawners.push(new Spawner(e.spawnKind || 'goomba', e.x, e.y, e.interval)); continue; }
      if (e.kind === 'mplat') { this.platforms.push(new MovingPlatform(e.x, e.y, e.w || 48, e.range, e.speed)); continue; }
      if (e.kind === 'coin' || e.kind === 'mushroom' || e.kind === 'flower' || e.kind === 'star') {
        this.items.push(new Item(e.kind, e.x, e.y));
      } else if (e.kind === 'piranha') {
        this.enemies.push(new Enemy('piranha', e.x, e.base));
      } else if (ENEMY_KINDS[e.kind]) {
        this.enemies.push(new Enemy(e.kind, e.x, e.y));
      }
    }

    const spawnX = b.spawn.tx * TILE;
    const spawnY = b.spawn.ty * TILE - 16;
    if (!atCheckpoint) {
      this.checkpointIdx = index;
      this.checkpointX = spawnX;
      this.checkpointY = spawnY;
    }

    const old = keep || this.player;
    const useX = atCheckpoint && this.checkpointIdx === index ? this.checkpointX : spawnX;
    const useY = atCheckpoint && this.checkpointIdx === index ? (this.checkpointY || spawnY) : spawnY;
    const p = new Player(useX, useY);
    if (old) {
      p.score = old.score;
      p.coins = old.coins;
      p.energy = old.energy;
      p.maxHp = old.maxHp;
      if (!atCheckpoint && old.weapons) { p.weapons = old.weapons.slice(); p.wi = old.wi; }
    }
    this.dmgScale = Math.min(2.2, 1 + index * 0.09);
    this.theme = b.theme || 'overworld';
    p.invuln = 1.2;
    this.player = p;

    const viewH = VIEW_H;
    this.cam.y = Math.max(0, Math.min(b.h * TILE - viewH, (GROUND_ROW + 2) * TILE - viewH));
    this.cam.x = clamp(p.x - VIEW_W / 2, 0, Math.max(0, b.w * TILE - VIEW_W));
    this.hintT = 2.2;
    this.state = 'play';
    this.updateSeedLabel();
  },

  /* 沿关卡自动布置存档点：约 45% 与 80% 处，落在实心地面顶上 */
  addCheckpoints(b, goalCol) {
    for (const f of [0.45, 0.8]) {
      const base = Math.round(goalCol * f);
      let tx = -1;
      /* 只放在真正的地面上（有 ground、上方两格空），不放浮空石台 */
      for (let d = 0; d < 10 && tx < 0; d++) {
        for (const cand of [base + d, base - d]) {
          if (cand < 3 || cand > b.w - 4) continue;
          if (b.get(cand, GROUND_ROW) !== T.EMPTY &&
              b.get(cand, GROUND_ROW - 1) === T.EMPTY &&
              b.get(cand, GROUND_ROW - 2) === T.EMPTY) { tx = cand; break; }
        }
      }
      if (tx < 0) continue;
      b.ents.push({ kind: 'checkpoint', x: tx * TILE, y: GROUND_ROW * TILE });
    }
  },

  updateSeedLabel() {
    const el = document.getElementById('seedLabel');
    if (el) el.textContent = this.seed;
  },

  /* ===================== 主循环 ===================== */
  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;

    this.acc = (this.acc || 0) + dt;
    const STEP = 1 / 60;
    let guard = 0;
    while (this.acc >= STEP && guard < 5) {
      this.update(STEP);
      this.acc -= STEP;
      guard++;
    }
    if (guard >= 5) this.acc = 0;

    this.render();
    Input.clearHits();
  },

  update(dt) {
    if (Input.hit('Tab')) { this.bag = !this.bag; Sfx.click && Sfx.click(); }
    if (this.bag) {
      if (Input.hit('Escape')) { this.bag = false; return; }
      const p0 = this.player;
      if (p0) {
        if (!this.selSlot) this.selSlot = 0;
        if (Input.hit('ArrowUp') || Input.hit('KeyW')) {
          if (this.selCol === 'hot') this.selSlot = Math.max(0, this.selSlot - 1);
          else this.selBag = Math.max(0, (this.selBag || 0) - 1);
          Sfx.click && Sfx.click();
        }
        if (Input.hit('ArrowDown') || Input.hit('KeyS')) {
          if (this.selCol === 'hot') this.selSlot = Math.min(4, this.selSlot + 1);
          else this.selBag = Math.min(Math.max(0, p0.bagW.length - 1), (this.selBag || 0) + 1);
          Sfx.click && Sfx.click();
        }
        if (Input.hit('ArrowLeft') || Input.hit('KeyA')) this.selCol = 'hot';
        if (Input.hit('ArrowRight') || Input.hit('KeyD')) { this.selCol = 'bag'; this.selBag = Math.min(this.selBag || 0, Math.max(0, p0.bagW.length - 1)); }
        if (Input.hit('Enter')) {
          if (this.selCol === 'bag') {
            if (p0.equipFromBag(this.selBag || 0, this.selSlot)) {
              const id = p0.weapons[this.selSlot];
              this.float(WEAPONS[id].name + ' 已装备', p0.x, p0.y - 16, '#a8e0ff');
              Sfx.power && Sfx.power();
            }
          } else if (p0.unequipSlot(this.selSlot)) {
            this.float('已卸下', p0.x, p0.y - 16, '#ffd0a0');
            Sfx.click && Sfx.click();
          }
        }
      }
      return;
    }
    this.time += dt;
    if (this.hintT > 0) this.hintT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.respawnT > 0) this.respawnT -= dt;
    if (this.toastT > 0) this.toastT -= dt;

    if (this.state === 'paused') return;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }

    const L = this.level;
    const p = this.player;
    if (!L || !p) return;

    if (this.state === 'title') {
      this.titleT = (this.titleT || 0) + dt;
      if (Input.hit('Enter') || Input.hit('Space')) {
        this.state = 'play';
        Sfx.power && Sfx.power();
      }
      return;
    }
    if (this.state === 'play') {
      p.update(dt, L, this);

      for (const e of this.enemies) e.update(dt, L, this);
      for (const it of this.items) it.update(dt, L, this);
      for (const f of this.fireballs) f.update(dt, L, this);
      for (const b of this.ebullets) b.update(dt, L, this);
      if (this.chain) { this.chain.t -= dt; if (this.chain.t <= 0) this.chain = null; }
      for (const bm of this.booms) bm.update(dt, L, this);
      if (this.beam) {
        this.beam.t -= dt;
        if (this.beam.t <= 0) this.beam = null;
      }
      for (const pl of this.platforms) pl.update(dt);
      for (const b of this.boxes) b.update(dt);
      for (const sp of this.springs) sp.update(dt);
      for (const sp of this.spawners) sp.update(dt, L, this);
      if (this.tombstone) this.tombstone.update(dt);

      this.enemies = this.enemies.filter((e) => !e.dead);
      this.items = this.items.filter((i) => !i.dead);
      this.fireballs = this.fireballs.filter((f) => !f.dead);
      this.ebullets = this.ebullets.filter((b) => !b.dead);
      this.booms = this.booms.filter((b) => !b.dead);
      if (this.beam && !this.beam.t0) {
        this.beam.t0 = true;
        const bx = this.beam.x, by = this.beam.y, dir = this.beam.dir, len = this.beam.len;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
          if (Math.abs(ecy - by) < 14 && (ecx - bx) * dir > 0 && Math.abs(ecx - bx) < len) {
            e.hurtBy(this, this.beam.dmg, dir);
          }
        }
      }
      for (const sp of this.spawners) if (sp.dead) sp.dead = true;

      this.prompt = null;
      this.updateProps(p, dt);
      this.updateOrbs(dt);

      /* 技能祭坛 */
      this.nearAltar = null;
      for (const a of this.altars) {
        if (a.used) continue;
        if (Math.abs(a.x - (p.x + p.w / 2)) < 26 && Math.abs(a.y - (p.y + p.h)) < 40) {
          this.nearAltar = a;
          break;
        }
      }
      if (this.nearAltar) this.prompt = '按 E 拾取 · ' + WEAPONS[this.nearAltar.weapon].name;
      if (this.nearAltar && Input.hit('KeyE')) {
        const a = this.nearAltar;
        a.used = true;
        const gr = p.giveWeapon(a.weapon);
        this.float(WEAPONS[a.weapon].name + (gr === 'replace' ? '（替换当前武器）' : ' 到手'), a.x, a.y - 30, '#9df0a0');
        for (let i = 0; i < 18; i++) {
          this.particles.push(new Particle(a.x, a.y - 16,
            (Math.random() - 0.5) * 180, -Math.random() * 220,
            0.8, i % 2 ? PAL.gold : PAL.white, 2));
        }
        Sfx.power();
        this.shake(2, 0.2);
      }

      /* 存档点 */
      for (const e of L.ents) {
        if (e.kind !== 'checkpoint') continue;
        if (!e.reached && p.x + p.w > e.x) {
          e.reached = true;
          this.checkpointX = e.x;
          this.checkpointY = e.y - 16;
          this.checkpointIdx = this.levelIndex;
          this.float('存档点', e.x, e.y - 20, '#79d47c');
          Sfx.power();
        }
      }

      /* 过关 */
      let goalHit = false;
      if (L.goal && L.goal.kind === 'pipe') {
        const gw = L.goal.w || 32;
        const onTop = p.x + p.w > L.goal.x + 3 && p.x < L.goal.x + gw - 3
          && Math.abs((p.y + p.h) - L.goal.y) < 8;
        if (onTop) {
          this.prompt = '按 E 进入管道';
          this.pipeNear = true;
          if (Input.hit('KeyE') || Input.hit('ArrowDown') || Input.hit('KeyS')) {
            goalHit = true;
            this.pipeT = 0.5;
            this.pipeSink = { x: p.x, y: p.y };
            Sfx.clear();
          }
        }
      } else if (L.goal) {
        goalHit = p.x + p.w > L.goal.x + 6;
      }
      if (goalHit) {
        this.state = 'clear';
        this.clearT = 2.4;
        p.addScore(2000 + this.levelIndex * 300);
        this.float('+过关奖励', p.x, p.y - 16, '#7dff7d');
        Sfx.clear();
      }

      /* 跳过教程（T） */
      if (this.levelIndex < TUTORIAL_N && Input.hit('KeyT')) {
        this.startLevel(TUTORIAL_N, p, false);
        this.respawnT = 1.2;
        this.state = 'play';
      }

      /* 死亡 → 回存档点 */
      if (p.dead && p.deadT <= 0) {
        /* 死亡：背包里的武器按 0.4 → 0.05 衰减的概率丢失，丢的留在墓碑里 */
        p.deaths = (p.deaths || 0) + 1;
        const chance = Math.max(0.05, 0.4 * Math.pow(0.78, p.deaths - 1));
        const lost = [];
        for (const id of p.bagW.slice()) {
          if (Math.random() < chance) lost.push(id);
        }
        if (lost.length) {
          p.bagW = p.bagW.filter((id) => lost.indexOf(id) < 0);
          let tx = Math.floor((p.x + p.w / 2) / TILE);
          tx = Math.max(1, Math.min(this.level.w - 2, tx));
          let ty = p.y + p.h - 22;
          if (ty > (GROUND_ROW - 1) * TILE) ty = (GROUND_ROW - 1) * TILE;
          this.tombstone = new Tombstone(tx * TILE + 4, ty, lost);
          this.float('背包丢了 ' + lost.length + ' 件', p.x, p.y - 20, '#ffb3b3');
        }
        if (p.score > this.best) { this.best = p.score; this.save(); }
        const bl = document.getElementById('bestLabel');
        if (bl) bl.textContent = this.best;
        this.startLevel(this.levelIndex, p, true);
        this.player.hp = this.player.maxHp;
        this.respawnT = 1.6;
      }
    } else if (this.state === 'clear') {
      this.clearT -= dt;
      if (this.clearT <= 0) this.startLevel(this.levelIndex + 1, this.player);
    }

    /* 特效与镜头 */
    for (const pt of this.particles) pt.update(dt);
    for (const f of this.floats) f.update(dt);
    this.particles = this.particles.filter((x) => x.life > 0);
    this.floats = this.floats.filter((x) => x.life > 0);

    const viewW = VIEW_W, viewH = VIEW_H;
    const tx = clamp(this.player.x + this.player.w / 2 - viewW / 2, 0, Math.max(0, this.level.w * TILE - viewW));
    const camYMax = Math.max(0, Math.min(this.level.h * TILE - viewH, (GROUND_ROW + 2) * TILE - viewH));
    const ty = clamp(this.player.y + this.player.h / 2 - viewH / 2, 0, camYMax);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 9);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 9);
    if (this.level.w * TILE < viewW) this.cam.x = 0;
  },

  /* ===================== 关卡 JSON 导入导出 ===================== */
  levelToJSON() {
    const L = this.level;
    if (!L) return null;
    return {
      v: 1,
      name: L.name,
      w: L.w,
      h: L.h,
      spawn: [L.spawn.tx, L.spawn.ty],
      goal: L.goal ? [Math.round(L.goal.x / TILE), Math.round(L.goal.y / TILE)] : null,
      rows: L.tiles.map((r) => r.join('')),
      ents: L.ents.map((e) => Object.assign({}, e))
    };
  },

  exportLevel() {
    const data = this.levelToJSON();
    if (!data) return;
    const text = JSON.stringify(data, null, 1);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pixelrun-' + (this.levelIndex + 1) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      this.toast('已导出 JSON');
    } catch (e) {
      this.toast('导出失败');
    }
  },

  importLevelJSON(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { this.toast('JSON 解析失败'); return; }
    if (!d || !d.rows || !d.w || !d.h) { this.toast('不是有效的关卡文件'); return; }
    const def = {
      name: d.name || '自定义关卡',
      build(b) {
        b.h = d.h;
        b.ensure(d.w);
        for (let y = 0; y < d.h; y++) {
          const row = String(d.rows[y] || '');
          for (let x = 0; x < d.w; x++) b.tiles[y][x] = (parseInt(row[x], 10) || 0);
        }
        b.w = d.w;
        b.ents = (d.ents || []).map((e) => Object.assign({}, e));
        if (d.spawn) b.spawn = { tx: d.spawn[0], ty: d.spawn[1] };
        if (d.goal) b.goal = { x: d.goal[0] * TILE, y: d.goal[1] * TILE };
      }
    };
    HANDMADE.push(def);
    this.startLevel(HANDMADE.length - 1, this.player);
    this.hintT = 2.2;
    this.toast('已载入：' + def.name);
  },

  toast(msg) {
    this.toastMsg = msg;
    this.toastT = 2.2;
  },

  /* ===================== 场上道具：箱子 / 弹簧 / 刷怪笼 / 墓碑 ===================== */
  updateProps(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;

    for (const b of this.boxes) {
      if (b.dead) continue;
      const hit = p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y;
      if (!hit) continue;
      if (p.vy > 30 || p.atkT > 0 || p.dashT > 0) this.openBox(b);
    }

    for (const sp of this.springs) {
      if (p.vy >= 0 && p.x + p.w > sp.x + 1 && p.x < sp.x + sp.w - 1 &&
          p.y + p.h > sp.y - 2 && p.y + p.h < sp.y + 15) {
        p.vy = -SPRING_V;
        p.jumpsLeft = 2;
        p.jumpHold = 0.14;
        p.onGround = false;
        sp.squash = 0.22;
        Sfx.spring ? Sfx.spring() : Sfx.jump();
        this.puff(cx, sp.y + 2, 7);
      }
    }

    for (const sp of this.spawners) {
      if (sp.dead) continue;
      const dx = Math.abs(sp.x + 10 - cx), dy = Math.abs(sp.y + 12 - cy);
      if (p.atkT > 0 && dx < 34 && dy < 34) sp.hurtBy(this, 24);
      else if (p.dashT > 0 && dx < 26 && dy < 26) sp.hurtBy(this, 45);
    }

    const t = this.tombstone;
    if (t && !t.dead) {
      if (Math.abs(t.x + 9 - cx) < 30 && Math.abs(t.y + 11 - cy) < 36) {
        this.prompt = t.hasAny() ? '按 E 取回武器' : '按 E 祭奠';
        if (Input.hit('KeyE')) {
          if (t.hasAny()) {
            for (const wid of t.weapons) p.giveWeapon(wid);
            this.float('武器已取回', t.x + 9, t.y - 12, '#9df0a0');
            Sfx.power();
          }
          for (let i = 0; i < 14; i++) {
            this.particles.push(new Particle(t.x + 9, t.y + 6,
              (Math.random() - 0.5) * 150, -Math.random() * 170,
              0.7, i % 2 ? '#c9d2e0' : '#8b93a3', 2));
          }
          t.dead = true;
          this.tombstone = null;
        }
      }
    }
  },

  dropSkill(x, y, forceId) {
    const id = forceId || SKILL_IDS[Math.floor(Math.random() * SKILL_IDS.length)];
    this.orbs.push({ x, y, id, vy: -150, t: 0 });
  },

  updateOrbs(dt) {
    const p = this.player;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      o.vy = Math.min(400, o.vy + 900 * dt);
      o.y += o.vy * dt;
      const ty = Math.floor((o.y + 10) / TILE), tx = Math.floor(o.x / TILE);
      if (solidAt(this.level, tx, ty)) { o.y = ty * TILE - 10; o.vy = 0; }
      if (o.t > 22) { this.orbs.splice(i, 1); continue; }
      if (Math.abs(o.x - (p.x + p.w / 2)) < 18 && Math.abs(o.y - (p.y + p.h / 2)) < 22) {
        const r = p.giveSkill(o.id);
        this.float(SKILLS[o.id].name + (r === 'replace' ? '（替换了最旧技能）' : ''), o.x, o.y - 14, SKILLS[o.id].color);
        Sfx.power && Sfx.power();
        this.orbs.splice(i, 1);
      }
    }
  },

  openBox(b) {
    if (b.dead) return;
    b.dead = true;
    const cx = b.x + 8, cy = b.y + 8;
    Sfx.hitBlock ? Sfx.hitBlock() : Sfx.stomp();
    this.shake(2, 0.12);
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(cx, cy,
        (Math.random() - 0.5) * 240, -Math.random() * 220,
        0.55, i % 2 ? '#c9a26b' : '#8b6f4e', 3));
    }

    let type = b.type;
    if (type === 'mystery') {
      const r = Math.random();
      type = r < 0.3 ? 'weapon' : r < 0.62 ? 'coin' : r < 0.82 ? 'heal' : r < 0.93 ? 'trap' : 'bomb';
    }

    if (type === 'weapon') {
      const full = this.theme === 'cave' ? WEAPON_POOL.concat(CAVE_POOL) : WEAPON_POOL;
      const pool = full.filter((k) => this.player.weapons.indexOf(k) < 0);
      const k = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (k) {
        const r = this.player.giveWeapon(k);
        this.float(WEAPONS[k].name + (r === 'replace' ? '（替换当前武器）' : ''), cx, cy - 14, '#ffd34a');
        if (Math.random() < 0.22) this.dropSkill(cx, cy - 20);
      } else {
        this.player.heal(20);
        this.float('生命 +20', cx, cy - 14, '#7dff7d');
      }
      Sfx.power();
    } else if (type === 'coin') {
      for (let i = 0; i < 6; i++) this.player.collectCoin(this);
      this.float('+金币', cx, cy - 14, '#ffd34a');
    } else if (type === 'heal') {
      const got = this.player.heal(25);
      this.float('生命 +' + Math.round(got || 25), cx, cy - 14, '#7dff7d');
      Sfx.power();
    } else if (type === 'trap') {
      this.explode(cx, cy, 34, 26, 14, '#8be07a');
      this.float('毒气！', cx, cy - 16, '#9be86a');
    } else if (type === 'bomb') {
      this.explode(cx, cy, 74, 58, 12, '#ff8a3c');
      this.shake(6, 0.32);
      for (let i = -3; i <= 3; i++) {
        const tx = Math.floor(cx / TILE) + i;
        const ty = Math.floor(cy / TILE) + 1;
        if (this.level.tiles[ty] && this.level.tiles[ty][tx] === T.BRICK) this.breakBrick(tx, ty);
      }
    }
  },

  explode(cx, cy, radius, dmg, selfDmg, color) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.particles.push(new Particle(cx + Math.cos(a) * r, cy + Math.sin(a) * r,
        Math.cos(a) * 120, Math.sin(a) * 120 - 60, 0.6, i % 3 ? color : '#fff2c2', 3));
    }
    this.shake(4, 0.25);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
      if (d < radius) e.hurtBy(this, dmg, e.x < cx ? -1 : 1);
    }
    for (const sp of this.spawners) {
      if (sp.dead) continue;
      if (Math.hypot(sp.x + 10 - cx, sp.y + 12 - cy) < radius) sp.hurtBy(this, dmg);
    }
    const p = this.player;
    if (p) {
      const d = Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy);
      if (d < radius * 0.8) p.hurt(this, selfDmg);
    }
  },

  puff(x, y, n) {
    for (let i = 0; i < (n || 6); i++) {
      this.particles.push(new Particle(x + (Math.random() - 0.5) * 10, y,
        (Math.random() - 0.5) * 110, -Math.random() * 60 + 30,
        0.35, i % 2 ? '#ffffff' : '#d8e6ff', 2));
    }
  },

  /* ===================== 绘制：场上道具 ===================== */
  drawProps(ctx) {
    for (const sp of this.springs) {
      const x = sp.x * ART, y = sp.y * ART;
      const sq = sp.squash > 0 ? 0.6 : 1;
      px(ctx, x + 2, y + 12 * sq, 28, 6, '#8b1a1a');
      px(ctx, x + 2, y + 12 * sq, 28, 2, '#d94a4a');
      for (let i = 0; i < 3; i++) {
        px(ctx, x + 7 + i * 7, y + 4 * sq + i * 2, 3, 5, '#d9dde6');
      }
      px(ctx, x, y + 2 * sq, 32, 5, '#e6eaf2');
      px(ctx, x, y + 2 * sq, 32, 2, '#ffffff');
    }

    for (const b of this.boxes) {
      if (b.dead) continue;
      const x = b.x * ART, y = b.y * ART;
      const body = b.type === 'trap' ? '#7a4b2a' : b.type === 'bomb' ? '#4a4f5c' : '#b07b3f';
      const edge = b.type === 'trap' ? '#4a2c17' : b.type === 'bomb' ? '#2c303a' : '#7a5227';
      px(ctx, x, y, 32, 32, edge);
      px(ctx, x + 2, y + 2, 28, 28, body);
      px(ctx, x + 2, y + 2, 28, 3, light(body, 18));
      px(ctx, x + 2, y + 27, 28, 3, edge);
      px(ctx, x + 13, y + 2, 6, 28, edge);
      if (b.type === 'mystery') {
        ctx.fillStyle = '#ffe27a';
        ctx.font = 'bold 20px ' + UI_FONT;
        ctx.textAlign = 'center';
        ctx.fillText('?', x + 16, y + 24);
        ctx.textAlign = 'left';
      } else if (b.type === 'bomb') {
        ellipse(ctx, x + 16, y + 18, 8, 8, '#1e222b');
        px(ctx, x + 14, y + 8, 4, 5, '#c9a26b');
        ctx.fillStyle = '#ffb03a';
        ctx.beginPath(); ctx.arc(x + 17, y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (b.type === 'trap') {
        ctx.fillStyle = '#e8e0c8';
        ctx.font = 'bold 16px ' + UI_FONT;
        ctx.textAlign = 'center';
        ctx.fillText('×', x + 16, y + 23);
        ctx.textAlign = 'left';
      } else if (b.type === 'coin') {
        ellipse(ctx, x + 16, y + 16, 7, 7, PAL.gold);
        ellipse(ctx, x + 16, y + 16, 4, 4, PAL.goldLight);
      } else {
        drawWeaponIcon(ctx, WEAPON_POOL[Math.floor(Math.abs(b.x)) % WEAPON_POOL.length], x + 4, y + 6, 1.5);
      }
    }

    for (const sp of this.spawners) {
      if (sp.dead) continue;
      const x = sp.x * ART, y = sp.y * ART;
      px(ctx, x, y, 40, 48, '#3a3f4c');
      px(ctx, x + 2, y + 2, 36, 44, '#23262f');
      for (let i = 0; i < 4; i++) px(ctx, x + 3 + i * 10, y + 2, 3, 44, '#6c7484');
      px(ctx, x, y, 40, 4, '#6c7484');
      px(ctx, x, y + 44, 40, 4, '#6c7484');
      const gl = 0.5 + 0.5 * Math.sin(this.time * 6);
      ctx.globalAlpha = 0.5 + 0.4 * gl;
      px(ctx, x + 14, y + 20, 12, 12, '#ff6b4a');
      ctx.globalAlpha = 1;
      /* 血条 */
      const hw = 36 * (sp.hp / sp.maxHp);
      px(ctx, x + 2, y - 7, 36, 4, '#2a2e38');
      px(ctx, x + 2, y - 7, Math.max(0, hw), 4, '#ff6b4a');
    }

    const t = this.tombstone;
    if (t && !t.dead) {
      const x = t.x * ART, y = t.y * ART;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x + 9, y + 23, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
      px(ctx, x + 1, y + 2, 34, 40, '#5a6172');
      px(ctx, x + 3, y + 4, 30, 36, '#8c94a6');
      px(ctx, x + 3, y + 4, 30, 3, '#b6bdcb');
      px(ctx, x + 13, y + 8, 8, 18, '#5a6172');
      px(ctx, x + 8, y + 13, 18, 7, '#5a6172');
      if (t.hasAny()) {
        const bob = Math.sin(t.t * 3) * 2;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t.t * 4);
        ellipse(ctx, x + 18, y - 12 + bob, 16, 16, '#ffe98a');
        ctx.globalAlpha = 1;
        drawWeaponIcon(ctx, t.weapons[1] || t.weapons[0] || 'sword', x + 12, y - 18 + bob, 0.9);
      }
    }
  },

  /* ===================== 场景操作 ===================== */
  addScore(n) { if (this.player) this.player.addScore(n); },

  float(text, x, y, color) { this.floats.push(new FloatText(text, x, y, color)); },

  shake(mag, dur) {
    this.shakeMag = mag;
    this.shakeT = dur || 0.25;
  },

  coinPop(tx, ty) {
    this.float('+200', tx * TILE + 4, ty * TILE - 12, '#ffd34a');
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(
        tx * TILE + 8, ty * TILE - 4,
        (Math.random() - 0.5) * 90, -Math.random() * 150 - 30,
        0.45, i % 2 ? PAL.gold : PAL.goldLight, 2
      ));
    }
  },

  breakBrick(tx, ty) {
    if (this.level.tiles[ty]) this.level.tiles[ty][tx] = T.EMPTY;
    for (let i = 0; i < 8; i++) {
      this.particles.push(new Particle(
        tx * TILE + 8, ty * TILE + 8,
        (Math.random() - 0.5) * 260, -Math.random() * 260 - 40,
        0.6, i % 2 ? PAL.brick : PAL.brickLight, 2
      ));
    }
    this.shake(2, 0.12);
  },

  bumpEnemiesAt(tx, ty) {
    const top = ty * TILE;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const bx = e.x + e.w / 2;
      const by = e.y + e.h;
      if (bx >= tx * TILE - 4 && bx <= (tx + 1) * TILE + 4 &&
          Math.abs(by - top) < 6) {
        e.kill(this, 'bump');
        this.addScore(100);
      }
    }
  },

  spawnItem(kind, x, y) {
    const it = new Item(kind, x, y);
    it.vy = -120;
    this.items.push(it);
  },

  /* ===================== 渲染：世界 ===================== */
  render() {
    this.renderWorld();
    if (this.state !== 'title') this.renderUI();
    else if (this.uctx) {
      const c = this.uctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    }
    if (this.state === 'title' && this.uctx) {
      const k = this.dpr * this.uiScale;
      this.uctx.setTransform(k, 0, 0, k, 0, 0);
      this.drawTitle(this.uctx, 640, 352);
    }
    if (this.bag && this.uctx) {
      const k = this.dpr * this.uiScale;
      this.uctx.setTransform(k, 0, 0, k, 0, 0);
      this.drawBag(this.uctx, 640, 352);
    }
  },

  renderWorld() {
    const ctx = this.ctx;
    const L = this.level;
    if (!L) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    let ox = 0, oy = 0;
    if (this.shakeT > 0) {
      ox = (Math.random() - 0.5) * this.shakeMag * 4;
      oy = (Math.random() - 0.5) * this.shakeMag * 4;
    }

    drawBackground(ctx, this.cam.x + ox, this.cam.y + oy, this.time, CW, CH, this.theme);

    ctx.setTransform(PPA, 0, 0, PPA,
      -Math.round(this.cam.x * ART) * PPA + ox,
      -Math.round(this.cam.y * ART) * PPA + oy);

    /* 地形 */
    const c0 = Math.floor(this.cam.x / TILE) - 1;
    const c1 = Math.floor((this.cam.x + VIEW_W) / TILE) + 2;
    for (let ty = 0; ty < L.h; ty++) {
      for (let tx = Math.max(0, c0); tx <= Math.min(L.w - 1, c1); tx++) {
        const t = L.tiles[ty][tx];
        if (t) drawTile(ctx, t, tx * 32, ty * 32, L, tx, ty, this.time);
      }
    }

    /* 存档点 */
    for (const e of L.ents) {
      if (e.kind === 'checkpoint') this.drawCheckpoint(ctx, e);
    }

    /* 旗子 */
    if (L.goal && L.goal.kind === 'pipe') {
      const gx = L.goal.x * ART, gy = L.goal.y * ART;
      const gw = (L.goal.w || 32) * ART, gh = (L.goal.h || 48) * ART;
      px(ctx, gx, gy, gw, gh, '#2f8a3f');
      px(ctx, gx + 2, gy + 2, gw - 4, gh - 4, '#3fae52');
      px(ctx, gx + 3, gy + 3, 4, gh - 6, '#63cf74');
      px(ctx, gx - 3, gy, gw + 6, 8, '#2f8a3f');
      px(ctx, gx - 2, gy + 1, gw + 4, 5, '#4cc061');
      const gl = 0.5 + 0.5 * Math.sin(this.time * 5);
      px(ctx, gx + 3, gy + 6, gw - 6, 3, 'rgba(180,255,200,' + (0.25 + 0.3 * gl) + ')');
    } else if (L.goal) {
      drawFlag(ctx, L.goal.x + 6, L.goal.y, this.time);
    }

    /* 移动平台 */
    for (const pl of this.platforms) {
      px(ctx, pl.x * ART, pl.y * ART, pl.w * ART, pl.h * ART, PAL.hard);
      px(ctx, pl.x * ART, pl.y * ART, pl.w * ART, 3, PAL.hardLight);
      px(ctx, pl.x * ART, (pl.y + pl.h) * ART - 3, pl.w * ART, 3, PAL.hardDark);
    }

    /* 技能祭坛 */
    for (const a of this.altars) this.drawAltar(ctx, a);

    /* 箱子 / 弹簧 / 刷怪笼 / 墓碑 */
    this.drawProps(ctx);

    /* 道具 */
    for (const it of this.items) drawItem(ctx, it, this.time);

    /* 技能球 */
    for (const o of this.orbs) {
      const bob = Math.sin((this.time || 0) * 4 + o.x) * 2;
      const cx = o.x * ART, cy = (o.y + bob) * ART;
      const col = SKILLS[o.id].color;
      ctx.globalAlpha = 0.25;
      ellipse(ctx, cx, cy, 13, 13, col);
      ctx.globalAlpha = 1;
      ellipse(ctx, cx, cy, 8, 8, 'rgba(12,10,24,0.9)');
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
      drawSkillGlyph(ctx, o.id, cx, cy, 0.55);
    }

    /* 敌方弹幕 */
    for (const b of this.ebullets) {
      const cx = (b.x + 4) * ART, cy = (b.y + 4) * ART;
      ellipse(ctx, cx, cy, 8, 8, '#ff8a3c');
      ellipse(ctx, cx, cy, 5, 5, '#ffd24a');
      ellipse(ctx, cx, cy, 2.5, 2.5, '#fff6d0');
    }

    /* 敌人 */
    for (const e of this.enemies) {
      if (e.kind === 'piranha' && e.out < 0.2) continue;
      drawEnemy(ctx, e, this.time);
      if (!e.dead && e.kind !== 'shell') {
        const bw = Math.max(20, e.w * ART * 0.9), bh = 3;
        const bx = (e.x + e.w / 2) * ART - bw / 2;
        const by = e.y * ART - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const r = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = r > 0.55 ? '#5ddc6a' : r > 0.28 ? '#ffd34a' : '#ff5b5b';
        ctx.fillRect(bx, by, bw * r, bh);
      }
    }

    /* 火球 */
    for (const f of this.fireballs) {
      const cx = (f.x + 4) * ART, cy = (f.y + 4) * ART;
      ellipse(ctx, cx, cy, 9, 9, PAL.fireRed);
      ellipse(ctx, cx, cy, 7, 7, PAL.fire);
      ellipse(ctx, cx, cy, 4, 4, PAL.fireLight);
    }

    /* 回旋镖 */
    if (this.chain) {
      const pts = this.chain.pts;
      const a = Math.min(1, this.chain.t / 0.24);
      ctx.strokeStyle = 'rgba(170,235,255,' + (0.55 + 0.45 * a) + ')';
      ctx.lineWidth = 3 * ART;
      ctx.beginPath();
      for (let i = 0; i < pts.length - 1; i++) {
        const x1 = pts[i].x * ART, y1 = pts[i].y * ART;
        const x2 = pts[i + 1].x * ART, y2 = pts[i + 1].y * ART;
        ctx.moveTo(x1, y1);
        const segs = 5;
        for (let k = 1; k <= segs; k++) {
          const tt = k / segs;
          const jx = (k === segs) ? 0 : (Math.sin(k * 7.3 + this.time * 40) * 6);
          const jy = (k === segs) ? 0 : (Math.cos(k * 5.1 + this.time * 33) * 6);
          ctx.lineTo(x1 + (x2 - x1) * tt + jx, y1 + (y2 - y1) * tt + jy);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.4 * ART;
      ctx.stroke();
    }

    for (const bm of this.booms) {
      const cx = (bm.x + 5) * ART, cy = (bm.y + 5) * ART;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bm.t * 18);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-9, -3, 18, 6);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(-9, -3, 18, 2);
      ctx.restore();
    }

    /* 光束 */
    if (this.beam) {
      const b = this.beam;
      const x0 = b.x * ART, y0 = b.y * ART, x1 = (b.x + b.dir * b.len) * ART;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#a8e4ff';
      ctx.fillRect(Math.min(x0, x1), y0 - 10, Math.abs(x1 - x0), 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.min(x0, x1), y0 - 4, Math.abs(x1 - x0), 8);
      ctx.globalAlpha = 1;
    }

    /* 主角 */
    if (this.player) drawPlayer(ctx, this.player, this.time);

    /* 粒子 */
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      px(ctx, Math.round(pt.x * ART), Math.round(pt.y * ART),
        Math.max(2, Math.round(pt.size * ART)), Math.max(2, Math.round(pt.size * ART)), pt.color);
    }
    ctx.globalAlpha = 1;

    /* 飘字 */
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px ' + UI_FONT;
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.6));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(f.text, Math.round(f.x * ART) + 2, Math.round(f.y * ART) + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x * ART), Math.round(f.y * ART));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  drawAltar(ctx, a) {
    const x = a.x * ART, y = a.y * ART;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, x - 15, y - 11, 30, 11, PAL.hardDark);
    px(ctx, x - 15, y - 13, 30, 3, PAL.hardLight);
    px(ctx, x - 6, y - 34, 12, 22, PAL.hard);
    px(ctx, x - 6, y - 34, 12, 2, PAL.hardLight);
    px(ctx, x + 2, y - 34, 4, 22, PAL.hardDark);

    if (a.used) {
      px(ctx, x - 4, y - 44, 8, 3, PAL.koopa);
      px(ctx, x - 1, y - 47, 3, 6, PAL.koopa);
      return;
    }
    const bob = Math.sin(this.time * 2.6) * 2;
    ctx.globalAlpha = 0.22 + 0.12 * Math.sin(this.time * 3);
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath();
    ctx.ellipse(x, y - 50 + bob, 20, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawWeaponIcon(ctx, a.weapon, x - 15 * ART * 0.5, y - 56 + bob, ART * 0.95);
  },

  drawSkillIcon(ctx, x, y, skill, tier, s, glow) {
    const g = s / 2;
    ctx.save();
    ctx.translate(x, y);
    if (skill === 'melee') {
      ctx.fillStyle = glow ? PAL.white : '#c9d2e0';
      ctx.beginPath();
      ctx.moveTo(-9 * g, 8 * g); ctx.lineTo(7 * g, -9 * g);
      ctx.lineTo(11 * g, -5 * g); ctx.lineTo(-5 * g, 11 * g);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(-9 * g, 4 * g, 7 * g, 3 * g);
      ctx.fillRect(-11 * g, 7 * g, 4 * g, 3 * g);
    } else if (skill === 'ranged') {
      ctx.fillStyle = glow ? PAL.goldLight : '#ffd34a';
      ctx.beginPath();
      ctx.arc(0, 0, 7 * g, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath(); ctx.arc(-1 * g, -1 * g, 3 * g, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(7 * g, -2 * g, 5 * g, 4 * g);
    } else {
      ctx.fillStyle = glow ? PAL.white : '#c9d2e0';
      ctx.beginPath();
      ctx.moveTo(0, 9 * g); ctx.lineTo(-8 * g, -2 * g); ctx.lineTo(-3 * g, -2 * g);
      ctx.lineTo(-3 * g, -9 * g); ctx.lineTo(3 * g, -9 * g); ctx.lineTo(3 * g, -2 * g);
      ctx.lineTo(8 * g, -2 * g); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(-11 * g, 9 * g, 22 * g, 3 * g);
    }
    ctx.restore();
  },

  drawCheckpoint(ctx, e) {
    const x = e.x * ART, y = e.y * ART;
    px(ctx, x, y - 44, 5, 48, '#8d9099');
    px(ctx, x + 1, y - 44, 2, 48, '#b6bac2');
    const on = e.reached;
    const g = on ? PAL.koopa : PAL.hard;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + 5, y - 44);
    ctx.lineTo(x + 30, y - 36);
    ctx.lineTo(x + 5, y - 26);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.time * 5);
      px(ctx, x - 6, y - 50, 18, 60, 'rgba(120,255,140,0.35)');
      ctx.globalAlpha = 1;
    }
  },

  /* ===================== 渲染：UI（清晰文字） ===================== */
  drawTitle(c, W, H) {
    const t = this.titleT || 0;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(6,9,20,0.92)');
    g.addColorStop(0.55, 'rgba(8,12,26,0.86)');
    g.addColorStop(1, 'rgba(6,9,20,0.95)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    /* 标题 */
    c.font = '900 40px ' + UI_FONT;
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillText('PIXEL FUCKING RUN 1', W / 2 + 3, 78);
    const tg = c.createLinearGradient(0, 40, 0, 84);
    tg.addColorStop(0, '#ffe9a8');
    tg.addColorStop(1, '#ffb13c');
    c.fillStyle = tg;
    c.fillText('PIXEL FUCKING RUN 1', W / 2, 75);
    c.font = '700 13px ' + UI_FONT;
    c.fillStyle = 'rgba(180,198,232,0.75)';
    c.fillText('beta · 24 关 · 无限小跑酷', W / 2, 96);

    /* 制作信息 */
    c.font = '600 10px ui-monospace, Menlo, monospace';
    c.fillStyle = 'rgba(150,170,205,0.85)';
    c.fillText('MACK 制作  ·  DeepSeek 编码  ·  Claude 交叉验证', W / 2, 118);

    /* 左：玩法 */
    c.textAlign = 'left';
    const lx = 46;
    c.fillStyle = '#9fd8ff';
    c.font = '700 11px ' + UI_FONT;
    c.fillText('怎么玩', lx, 146);
    c.font = '600 10px ' + UI_FONT;
    c.fillStyle = 'rgba(214,226,248,0.9)';
    const lines = [
      '← → 移动    空格 跳跃（空中再按一次 = 二段跳）',
      'J 使用手上的武器  1-5 换武器  L 冲刺',
      'Tab 打开背包（装/卸武器）  Z X C V 用技能  E 交互',
      '血条会自动回复，死了从最近的存档点重来，分数保留'
    ];
    lines.forEach((s2, i) => c.fillText(s2, lx, 164 + i * 15));

    c.fillStyle = '#ffd166';
    c.font = '700 11px ' + UI_FONT;
    c.fillText('前 10 关是新手教程，按 T 可以随时跳过', lx, 236);

    /* 右：武器伤害 */
    c.textAlign = 'left';
    const rx = 330;
    c.fillStyle = '#ffd166';
    c.font = '700 11px ' + UI_FONT;
    c.fillText('武器 · 伤害 / 冷却', rx, 146);
    const ids = ['fist', 'sword', 'hammer', 'wand', 'shot', 'boom', 'laser', 'drill', 'frost', 'grenade', 'chain'];
    c.font = '600 9px ' + UI_FONT;
    ids.forEach((id, i) => {
      const w = WEAPONS[id];
      if (!w) return;
      const y = 163 + i * 12.5;
      drawWeaponIcon(c, id, rx + 6, y - 6, 0.5);
      c.fillStyle = 'rgba(214,226,248,0.9)';
      c.fillText(w.name, rx + 18, y);
      c.fillStyle = 'rgba(255,209,102,0.95)';
      c.fillText(String(w.dmg) + (w.pellets ? '×' + w.pellets : ''), rx + 106, y);
      c.fillStyle = 'rgba(160,180,214,0.7)';
      c.fillText(w.cd.toFixed(2) + 's', rx + 140, y);
    });

    c.fillStyle = 'rgba(150,175,215,0.65)';
    c.font = '600 9px ' + UI_FONT;
    c.fillText('快捷栏最多装 5 把，其余放背包；死了背包里的武器可能掉，墓碑能取回', rx, 310);

    /* 开始提示 */
    c.textAlign = 'center';
    const a = 0.55 + 0.45 * Math.sin(t * 3);
    c.globalAlpha = a;
    c.fillStyle = '#ffffff';
    c.font = '700 13px ' + UI_FONT;
    c.fillText('按 Enter 或 空格 开始', W / 2, 322);
    c.globalAlpha = 1;
    c.textAlign = 'left';
  },

  drawBag(c, W, H) {
    const p = this.player;
    c.fillStyle = 'rgba(4,7,15,0.68)';
    c.fillRect(0, 0, W, H);
    const pw = 452, ph = 236, px = (W - pw) / 2, py = (H - ph) / 2 - 10;
    roundRect(c, px, py, pw, ph, 12);
    c.fillStyle = 'rgba(13,18,34,0.97)';
    c.fill();
    c.strokeStyle = 'rgba(120,150,220,0.5)';
    c.lineWidth = 1.4; c.stroke();

    c.textAlign = 'left';
    c.fillStyle = '#eaf1ff';
    c.font = '800 14px ' + UI_FONT;
    c.fillText('背包', px + 18, py + 26);
    c.fillStyle = 'rgba(180,198,232,0.55)';
    c.font = '600 9px ' + UI_FONT;
    c.fillText('←→ 换栏 · ↑↓ 选择 · Enter 装备/卸下 · Tab 关闭', px + 62, py + 25);

    /* 左：5 个快捷栏 */
    c.fillStyle = 'rgba(255,214,90,0.9)';
    c.font = '700 10px ' + UI_FONT;
    c.fillText('快捷栏（1-5）', px + 18, py + 48);
    for (let i = 0; i < 5; i++) {
      const wid = p.weapons[i];
      const y = py + 56 + i * 30;
      const foc = this.selCol === 'hot' && this.selSlot === i;
      roundRect(c, px + 18, y, 190, 26, 6);
      c.fillStyle = foc ? 'rgba(58,80,132,0.95)' : (wid ? 'rgba(24,32,54,0.8)' : 'rgba(20,26,44,0.6)');
      c.fill();
      c.strokeStyle = foc ? 'rgba(255,214,90,0.95)' : (i === p.wi && wid ? 'rgba(255,214,90,0.45)' : 'rgba(255,255,255,0.08)');
      c.lineWidth = foc ? 1.6 : 1; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.font = '700 9px ' + UI_FONT;
      c.fillText(String(i + 1), px + 26, y + 17);
      if (wid) {
        drawWeaponIcon(c, wid, px + 40, y + 5, 0.95);
        c.fillStyle = (i === p.wi) ? '#ffe9a8' : 'rgba(226,235,255,0.92)';
        c.font = '600 10px ' + UI_FONT;
        c.fillText(WEAPONS[wid].name, px + 60, y + 17);
        c.fillStyle = 'rgba(180,198,232,0.45)';
        c.font = '600 8px ' + UI_FONT;
        c.fillText(WEAPONS[wid].cd.toFixed(2) + 's', px + 172, y + 17);
      } else {
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.font = '600 10px ' + UI_FONT;
        c.fillText('空', px + 40, y + 17);
      }
    }

    /* 右：背包里的武器 */
    const bx = px + 222;
    c.fillStyle = 'rgba(140,220,255,0.9)';
    c.font = '700 10px ' + UI_FONT;
    c.fillText('背包 ' + p.bagW.length + ' 件', bx, py + 48);
    if (!p.bagW.length) {
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.font = '600 10px ' + UI_FONT;
      c.fillText('（空）多开箱子、打祭坛', bx, py + 74);
    }
    for (let i = 0; i < p.bagW.length && i < 5; i++) {
      const wid = p.bagW[i];
      const y = py + 56 + i * 30;
      const foc = this.selCol === 'bag' && (this.selBag || 0) === i;
      roundRect(c, bx, y, 196, 26, 6);
      c.fillStyle = foc ? 'rgba(30,64,88,0.95)' : 'rgba(24,32,54,0.8)';
      c.fill();
      c.strokeStyle = foc ? 'rgba(140,220,255,0.95)' : 'rgba(255,255,255,0.08)';
      c.lineWidth = foc ? 1.6 : 1; c.stroke();
      drawWeaponIcon(c, wid, bx + 8, y + 5, 0.95);
      c.fillStyle = 'rgba(226,235,255,0.92)';
      c.font = '600 10px ' + UI_FONT;
      c.fillText(WEAPONS[wid].name, bx + 28, y + 17);
      c.fillStyle = 'rgba(180,198,232,0.45)';
      c.font = '600 8px ' + UI_FONT;
      c.fillText(WEAPONS[wid].cd.toFixed(2) + 's', bx + 176, y + 17);
    }
    if (p.bagW.length > 5) {
      c.fillStyle = 'rgba(180,198,232,0.5)';
      c.font = '600 8px ' + UI_FONT;
      c.fillText('… 还有 ' + (p.bagW.length - 5) + ' 件', bx, py + 218);
    }

    /* 技能 */
    c.fillStyle = 'rgba(170,150,255,0.9)';
    c.font = '700 10px ' + UI_FONT;
    c.fillText('技能 Z/X/C/V', bx, py + 168);
    for (let i = 0; i < 3; i++) {
      const sk = p.skills[i];
      const x = bx + i * 66, y = py + 176;
      roundRect(c, x, y, 62, 30, 6);
      c.fillStyle = sk ? 'rgba(38,28,62,0.9)' : 'rgba(24,32,54,0.7)';
      c.fill();
      c.strokeStyle = sk ? 'rgba(170,150,255,0.6)' : 'rgba(255,255,255,0.08)';
      c.lineWidth = 1; c.stroke();
      if (sk) {
        drawSkillGlyph(c, sk.id, x + 14, y + 15, 0.62);
        c.fillStyle = '#e8e2ff';
        c.font = '600 8px ' + UI_FONT;
        c.fillText(SKILLS[sk.id].short, x + 26, y + 14);
        c.fillStyle = SKILLS[sk.id].color;
        c.font = '700 8px ' + UI_FONT;
        c.fillText('x' + sk.n, x + 26, y + 25);
      } else {
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.font = '600 10px ' + UI_FONT;
        c.textAlign = 'center';
        c.fillText('空', x + 31, y + 19);
        c.textAlign = 'left';
      }
    }

    c.fillStyle = 'rgba(255,255,255,0.32)';
    c.font = '600 8px ' + UI_FONT;
    c.fillText('死亡后背包里的武器有 5%~40% 概率丢失，丢的会留在墓碑里，跑回去按 E 取回', px + 18, py + 224);
  },

  renderUI() {
    const c = this.uctx;
    if (!c) return;
    const k = this.dpr * this.uiScale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    c.setTransform(k, 0, 0, k, 0, 0);

    const p = this.player;
    if (!p) return;

    /* 顶部条 */
    c.fillStyle = 'rgba(10,14,28,0.42)';
    c.fillRect(0, 0, W, 34);

    /* 血条 */
    const bx = 42, by = 9, bw = 132, bh = 10;
    roundRect(c, bx, by, bw, bh, 5);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fill();
    const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    const grad = c.createLinearGradient(bx, 0, bx + bw, 0);
    if (ratio > 0.5) { grad.addColorStop(0, '#4ade80'); grad.addColorStop(1, '#22c55e'); }
    else if (ratio > 0.25) { grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, '#f59e0b'); }
    else { grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#dc2626'); }
    if (ratio > 0) {
      roundRect(c, bx + 1, by + 1, Math.max(0, (bw - 2) * ratio), bh - 2, 4);
      c.fillStyle = grad;
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(c, bx + 1, by + 1, Math.max(0, (bw - 2) * ratio), (bh - 2) / 2, 4);
      c.fill();
    }
    if (p.regenDelay > 0) {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.font = '600 9px ' + UI_FONT;
      c.textAlign = 'right';
      c.fillText('恢复中…', bx + bw, by + 21);
    } else if (p.hp < p.maxHp) {
      c.fillStyle = 'rgba(160,255,190,0.75)';
      c.font = '600 9px ' + UI_FONT;
      c.textAlign = 'right';
      c.fillText('回复中', bx + bw, by + 21);
    }
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.font = '600 9px ' + UI_FONT;
    c.textAlign = 'center';
    c.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, bx + bw / 2, by + 8.2);
    c.textAlign = 'left';
    /* 心形图标 */
    c.fillStyle = PAL.red;
    heart(c, 24, 16, 5);

    /* 能量格 */
    for (let i = 0; i < 3; i++) {
      const x = bx + i * 17, y = by + 14;
      roundRect(c, x, y, 13, 6, 3);
      c.fillStyle = i < p.energy ? '#49d0ff' : 'rgba(255,255,255,0.14)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.lineWidth = 0.8;
      c.stroke();
    }

    /* 金币 / 分数 */
    c.fillStyle = PAL.gold;
    c.beginPath(); c.arc(196, 14, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.goldLight;
    c.beginPath(); c.arc(195, 13, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.font = '700 13px ' + UI_FONT;
    c.fillText('× ' + p.coins, 205, 19);

    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '600 9px ' + UI_FONT;
    c.fillText('得分', 196, 30);
    c.fillStyle = '#e8eeff';
    c.font = '700 13px ' + UI_FONT;
    c.fillText(String(p.score).padStart(6, '0'), 220, 30);

    /* 关卡名 */
    c.textAlign = 'right';
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = '700 13px ' + UI_FONT;
    c.fillText(this.level.name, W - 14, 18);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.font = '600 9px ' + UI_FONT;
    c.fillText(this.stageSub(), W - 14, 30);
    c.textAlign = 'left';

    /* 武器槽（固定 5 格） */
    const MAXW = 5, swid = 30, sgap = swid + 5;
    for (let i = 0; i < MAXW; i++) {
      const wid = p.weapons[i];
      const cur = i === p.wi && !!wid;
      const x = 14 + i * sgap, y = H - 46;
      roundRect(c, x, y, swid, swid, 7);
      c.fillStyle = cur ? 'rgba(30,44,80,0.9)' : 'rgba(14,20,38,0.5)';
      c.fill();
      c.strokeStyle = cur ? 'rgba(255,214,90,0.95)' : 'rgba(255,255,255,0.14)';
      c.lineWidth = cur ? 1.6 : 1;
      c.stroke();
      if (wid) {
        drawWeaponIcon(c, wid, x + (swid - 16) / 2, y + (swid - 16) / 2, 1);
        if (cur) {
          const cd = p.atkCd > 0 ? 1 - p.atkCd / WEAPONS[wid].cd : 1;
          const in2 = swid - 4;
          c.fillStyle = 'rgba(0,0,0,0.55)';
          c.fillRect(x + 2, y + 2 + in2 * cd, in2, in2 * (1 - cd));
          c.fillStyle = 'rgba(255,214,90,0.95)';
          c.fillRect(x + 2, y + swid - 3, in2 * Math.max(0, cd), 2);
        }
      } else {
        c.fillStyle = 'rgba(255,255,255,0.16)';
        c.font = '700 13px ' + UI_FONT;
        c.textAlign = 'center';
        c.fillText('·', x + swid / 2, y + swid / 2 + 5);
        c.textAlign = 'left';
      }
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.font = '600 8px ' + UI_FONT;
      c.textAlign = 'center';
      c.fillText(String(i + 1), x + swid / 2, y + swid + 9);
      c.textAlign = 'left';
    }

    /* 技能槽（固定 3 格，Z / X / C） */
    const SKK = ['Z', 'X', 'C'];
    const sx0 = 14 + MAXW * sgap + 9;
    for (let i = 0; i < 3; i++) {
      const sk = p.skills[i];
      const x = sx0 + i * 33, y = H - 44;
      roundRect(c, x, y, 28, 28, 6);
      c.fillStyle = sk ? 'rgba(28,20,46,0.88)' : 'rgba(14,20,38,0.5)';
      c.fill();
      c.strokeStyle = sk ? 'rgba(170,150,255,0.85)' : 'rgba(255,255,255,0.12)';
      c.lineWidth = 1.2;
      c.stroke();
      if (sk) {
        drawSkillGlyph(c, sk.id, x + 14, y + 13, 0.8);
        if (sk.n > 1) {
          c.fillStyle = 'rgba(0,0,0,0.7)';
          roundRect(c, x + 17, y + 17, 12, 10, 3);
          c.fill();
          c.fillStyle = '#fff';
          c.font = '700 8px ' + UI_FONT;
          c.textAlign = 'center';
          c.fillText('x' + sk.n, x + 23, y + 25);
          c.textAlign = 'left';
        }
      }
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.font = '600 8px ' + UI_FONT;
      c.textAlign = 'center';
      c.fillText(SKK[i], x + 14, y + 36);
      c.textAlign = 'left';
    }

    /* 当前武器名 */
    if (p.weapons[p.wi]) {
      const w = WEAPONS[p.weapons[p.wi]];
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.font = '600 9px ' + UI_FONT;
      c.fillText(w.name, 14, H - 52);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.font = '600 8px ' + UI_FONT;
      c.fillText('Tab 背包 · Z/X/C 技能', sx0 + 101, H - 52);
    }

    /* 交互提示 */
    if (this.prompt) {
      const txt = this.prompt;
      c.font = '700 12px ' + UI_FONT;
      const tw = c.measureText(txt).width + 26;
      roundRect(c, W / 2 - tw / 2, H - 118, tw, 26, 13);
      c.fillStyle = 'rgba(10,16,32,0.82)';
      c.fill();
      c.strokeStyle = 'rgba(255,215,90,0.7)';
      c.lineWidth = 1.2;
      c.stroke();
      c.textAlign = 'center';
      c.fillStyle = '#ffe27a';
      c.fillText(txt, W / 2, H - 100);
      c.textAlign = 'left';
    }

    /* toast */
    if (this.toastT > 0) {
      c.globalAlpha = Math.min(1, this.toastT * 1.4);
      c.font = '700 12px ' + UI_FONT;
      const tw2 = c.measureText(this.toastMsg).width + 28;
      roundRect(c, W / 2 - tw2 / 2, 52, tw2, 26, 13);
      c.fillStyle = 'rgba(10,16,32,0.85)';
      c.fill();
      c.textAlign = 'center';
      c.fillStyle = '#9df0a0';
      c.fillText(this.toastMsg, W / 2, 69);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    /* 开局提示条 */
    if (this.hintT > 0) {
      const a = Math.min(1, this.hintT * 1.2);
      const tip = this.levelIndex < TUTORIAL_N
        ? '← → 移动  空格 跳跃  J 攻击  E 交互   ·   按 T 跳过教程'
        : '← → 移动   空格 跳跃   J 攻击   1-5 换武器  Z/X/C 技能   L 冲刺   E 交互';
      c.globalAlpha = a;
      c.font = '600 11px ' + UI_FONT;
      const tipW = c.measureText(tip).width + 28;
      roundRect(c, W / 2 - tipW / 2, H - 90, tipW, 22, 7);
      c.fillStyle = 'rgba(8,12,26,0.68)';
      c.fill();
      c.textAlign = 'center';
      c.fillStyle = '#dfe8ff';
      c.fillText(tip, W / 2, H - 75);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    /* 大字提示 */
    if (this.hintT > 1.2) {
      const a = Math.min(1, (this.hintT - 1.2) * 1.6);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.font = '800 30px ' + UI_FONT;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillText(this.level.name, W / 2 + 2, 90);
      c.fillStyle = '#ffffff';
      c.fillText(this.level.name, W / 2, 88);
      c.fillStyle = 'rgba(255,255,255,0.65)';
      c.font = '600 11px ' + UI_FONT;
      c.fillText(this.stageSub(), W / 2, 106);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    /* 回到存档点 */
    if (this.respawnT > 0) {
      const a = Math.min(1, this.respawnT * 1.5);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.font = '700 15px ' + UI_FONT;
      c.fillText('回到存档点', W / 2, H / 2 - 30);
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }

    if (this.state === 'paused') this.overlay('已暂停', '按 P 继续　·　R 重开本关');
    if (this.state === 'clear') this.overlay('过关！', '奖励 +' + (2000 + this.levelIndex * 300));
    if (this.state === 'win') {
      this.overlay('恭喜通关', '全部 ' + (HANDMADE.length - TUTORIAL_N) + ' 关通关　得分 ' + this.player.score + '　按 R 重新开始');
    }
  },

  overlay(title, sub) {
    const c = this.uctx;
    c.fillStyle = 'rgba(6,8,18,0.66)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.font = '800 26px ' + UI_FONT;
    c.fillText(title, W / 2, H / 2 - 6);
    c.fillStyle = 'rgba(200,210,235,0.85)';
    c.font = '600 12px ' + UI_FONT;
    c.fillText(sub, W / 2, H / 2 + 20);
    c.textAlign = 'left';
  },

  stageSub() {
    const i = this.levelIndex;
    if (i < TUTORIAL_N) return '教程 ' + (i + 1) + ' / ' + TUTORIAL_N;
    return '共 ' + (HANDMADE.length - TUTORIAL_N) + ' 关';
  },

  /* ===================== 界面按钮 ===================== */
  bindUI() {
    const play = document.getElementById('btnPlay');
    if (!play) return;           // 无壳运行（测试页）直接跳过
    play.addEventListener('click', () => { this.togglePause(); play.blur(); });

    const mute = document.getElementById('btnMute');
    if (mute) mute.addEventListener('click', () => {
      this.muted = !this.muted;
      Sfx.setMuted(this.muted);
      mute.textContent = this.muted ? '🔇' : '🔊';
      mute.classList.toggle('off', this.muted);
      this.save();
      mute.blur();
    });

    const seedBtn = document.getElementById('btnSeed');
    if (seedBtn) seedBtn.addEventListener('click', (e) => {
      const txt = String(this.seed);
      if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = old; }, 900);
    });

    const set = document.getElementById('btnSet');
    const pop = document.getElementById('popover');
    if (set) set.addEventListener('click', (e) => {
      pop.classList.toggle('hidden');
      e.stopPropagation();
      set.blur();
    });
    document.addEventListener('click', (e) => {
      if (!pop.contains(e.target) && e.target !== set) pop.classList.add('hidden');
    });

    const vol = document.getElementById('vol');
    if (!vol) return;
    vol.value = String(Math.round(this.volume * 100));
    vol.addEventListener('input', () => {
      this.volume = parseInt(vol.value, 10) / 100;
      Sfx.setVolume(this.volume);
      this.save();
    });

    const be = document.getElementById('btnExport');
    if (be) be.addEventListener('click', () => this.exportLevel());
    const fi = document.getElementById('fileImport');
    const bi = document.getElementById('btnImport');
    if (bi && fi) {
      bi.addEventListener('click', () => fi.click());
      fi.addEventListener('change', () => {
        const f = fi.files && fi.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { this.importLevelJSON(String(rd.result)); fi.value = ''; };
        rd.readAsText(f);
      });
    }

    const resetBtn = document.getElementById('btnReset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      this.best = 0;
      this.save();
      document.getElementById('bestLabel').textContent = '0';
    });

    const fullBtn = document.getElementById('btnFull');
    if (fullBtn) fullBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') { const mb = document.getElementById('btnMute'); if (mb) mb.click(); }
      if (e.code === 'KeyR') {
        if (this.state === 'win') this.restartRun();
        else if (this.state === 'play') this.startLevel(this.levelIndex, this.player, true);
      }
    });
  },

  restartRun() {
    const p = new Player(0, 0);
    p.score = 0; p.coins = 0; p.energy = 0;
    this.checkpointX = 0;
    this.checkpointIdx = -1;
    this.startLevel(0, p);
    const pb = document.getElementById('btnPlay');
    if (pb) pb.textContent = '❚❚';
  },

  togglePause() {
    if (this.state === 'play') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'play';
    const b = document.getElementById('btnPlay');
    b.textContent = this.state === 'paused' ? '▶' : '❚❚';
  }
};

/* ===================== UI 绘制小工具 ===================== */
function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}


function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function heart(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.72);
  c.bezierCurveTo(x - s * 1.25, y - s * 0.2, x - s * 0.45, y - s * 1.05, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.25, y - s * 0.2, x, y + s * 0.72);
  c.closePath();
}

window.addEventListener('load', () => {
  Input.init();
  Input.initTouch();
  Game.init();
});
