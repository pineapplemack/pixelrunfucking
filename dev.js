/* ============================================================
 *  dev.js —— 开发者控制台（作弊码）
 *  按 ` 或 F2 打开，回车执行，Esc 关闭
 * ============================================================ */

const Dev = {
  el: null, input: null, log: null, open: false, hist: [], hi: -1,

  init() {
    this.el = document.getElementById('dev');
    this.input = document.getElementById('devinput');
    this.log = document.getElementById('devlog');
    const btn = document.getElementById('btnDev');
    if (btn) btn.addEventListener('click', () => this.toggle());
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { this.run(this.input.value); this.input.value = ''; }
        else if (e.key === 'Escape') { this.toggle(false); }
        else if (e.key === 'ArrowUp') {
          if (this.hi < this.hist.length - 1) this.hi++;
          this.input.value = this.hist[this.hi] || '';
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          this.hi = Math.max(-1, this.hi - 1);
          this.input.value = this.hi < 0 ? '' : this.hist[this.hi];
          e.preventDefault();
        }
      });
    }
    if (location.hash.indexOf('dev') >= 0) setTimeout(() => this.toggle(true), 400);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.key === '`' || e.key === 'F2') {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  toggle(force) {
    if (!this.el) return;
    this.open = force === undefined ? !this.open : force;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open && this.input) {
      this.input.value = '';
      this.input.focus();
    } else if (this.input) {
      this.input.blur();
    }
  },

  print(msg) {
    if (!this.log) return;
    this.log.textContent += '\n' + msg;
    this.log.scrollTop = this.log.scrollHeight;
  },

  run(raw) {
    const line = (raw || '').trim();
    if (!line) return;
    this.hist.unshift(line);
    this.hi = -1;
    this.print('> ' + line);
    const [cmd, ...args] = line.split(/\s+/);
    const a0 = args[0];
    const G = (typeof Game !== 'undefined') ? Game : null;
    const p = G && G.player;

    switch (cmd.toLowerCase()) {
      case 'help':
        this.print([
          '可用指令：',
          '  lvl <1-10>      跳到第 N 关',
          '  god             无敌开/关',
          '  hp <n>          设置血量上限并回满',
          '  heal            回满血',
          '  coins <n>       设置金币数',
          '  score <n>       设置分数',
          '  weapon <id|all|list|clear> 武器：all=装满 5 把  list=列表  clear=只留拳套',
          '  killall         清空当前敌人',
          '  spawn <kind>    在玩家前面生成一只怪',
          '  noclip          穿墙开/关',
          '  seed <n>        设置本局种子',
          '  restart         从第 1 关重开'
        ].join('\n'));
        break;

      case 'lvl': {
        const n = parseInt(a0, 10);
        if (!(n >= 1 && n <= HANDMADE.length)) return this.print('关卡范围 1~' + HANDMADE.length);
        G.startLevel(n - 1, p, false);
        G.state = 'play';
        this.print('→ 第 ' + n + ' 关');
        break;
      }

      case 'god':
        if (!p) return;
        p.god = !p.god;
        this.print('无敌：' + (p.god ? '开' : '关'));
        break;

      case 'hp': {
        const n = parseInt(a0, 10);
        if (!p || !(n > 0)) return this.print('用法：hp 200');
        p.maxHp = n; p.hp = n;
        this.print('血量上限 ' + n);
        break;
      }

      case 'heal':
        if (!p) return;
        p.hp = p.maxHp;
        this.print('已回满');
        break;

      case 'coins':
        if (!p) return;
        p.coins = parseInt(a0, 10) || 0;
        this.print('金币 ' + p.coins);
        break;

      case 'score':
        if (!p) return;
        p.score = parseInt(a0, 10) || 0;
        this.print('分数 ' + p.score);
        break;

      case 'weapon': {
        if (!p) return;
        const ALLW = Object.keys(WEAPONS).filter(id => id !== 'fist');
        if (a0 === 'all' || a0 === 'ALL') {
          p.weapons = ['fist'];
          let slot = 0;
          for (const id of ALLW) {
            if (p.weapons.length >= 5) { p.weapons[slot % 5] = id; slot++; }
            else p.giveWeapon(id);
          }
          if (p.weapons.length > 5) p.weapons.length = 5;
          p.wi = 0;
          this.print('武器已装满 5 把：' + p.weapons.map(id => WEAPONS[id].short).join(' / '));
        } else if (a0 === 'list') {
          this.print(ALLW.map((id, i) => (i + 1) + '.' + WEAPONS[id].short + '(' + WEAPONS[id].cd + 's/' + WEAPONS[id].dmg + ')').join('  '));
        } else if (a0 === 'clear') {
          p.weapons = ['fist']; p.wi = 0;
          this.print('武器已清空，只剩铁拳套');
        } else if (WEAPONS[a0]) {
          const idx = p.weapons.indexOf(a0);
          if (idx >= 0) { p.wi = idx; this.print('已切换到 ' + WEAPONS[a0].name); }
          else {
            const r = p.giveWeapon(a0);
            this.print('获得 ' + WEAPONS[a0].name + (r === 'replace' ? '（替换了当前武器）' : ''));
          }
        } else {
          this.print('武器：' + WEAPON_POOL.join(' / '));
        }
        break;
      }

      case 'killall':
        if (G) { G.enemies.length = 0; this.print('清场'); }
        break;

      case 'spawn': {
        if (!G || !p) return;
        const kind = a0 || 'goomba';
        const e = new Enemy(kind, p.x + p.w / 2 + p.facing * 60, p.y + p.h);
        G.enemies.push(e);
        this.print('生成 ' + kind);
        break;
      }

      case 'noclip':
        if (!p) return;
        p.noclip = !p.noclip;
        this.print('穿墙：' + (p.noclip ? '开' : '关'));
        break;

      case 'seed':
        if (!G) return;
        G.seed = parseInt(a0, 10) || G.seed;
        this.print('种子 ' + G.seed);
        break;

      case 'restart':
        if (!G) return;
        G.startLevel(0, null, false);
        G.state = 'play';
        this.print('重新开始');
        break;

      default:
        this.print('未知指令：' + cmd + '（help 查看）');
    }
  }
};

window.addEventListener('load', () => Dev.init());

/* ---------- 测试期：右上角跳关面板 ---------- */
(function initJumpPanel() {
  function boot() {
    const btn = document.getElementById('btnJump');
    const panel = document.getElementById('jumpPanel');
    if (!btn || !panel) return;

    function build() {
      const total = HANDMADE.length;
      const groups = [
        { title: '教程（按 T 可跳过）', from: 0, to: TUTORIAL_N },
        { title: '正片', from: TUTORIAL_N, to: TUTORIAL_N + 9 },
        { title: '地底', from: TUTORIAL_N + 9, to: total }
      ];
      let html = '<div class="jp-head"><span>跳到关卡</span><span>' + total + ' 关</span></div>';
      for (const g of groups) {
        if (g.from >= g.to) continue;
        html += '<div class="jp-sec">' + g.title + '</div>';
        for (let i = g.from; i < g.to; i++) {
          const nm = (HANDMADE[i] && HANDMADE[i].name) || ('第 ' + (i + 1) + ' 关');
          const cur = Game.levelIndex === i ? ' style="background:rgba(255,170,60,.18)"' : '';
          html += '<button data-i="' + i + '"' + cur + '><b>' + (i + 1) + '</b>' + nm + '</button>';
        }
      }
      panel.innerHTML = html;
    }

    function open() {
      build();
      panel.classList.remove('hidden');
      btn.textContent = '▴ 跳关';
    }
    function close() {
      panel.classList.add('hidden');
      btn.textContent = '▾ 跳关';
    }

    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (panel.classList.contains('hidden')) open(); else close();
    });
    panel.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-i]');
      if (!b) return;
      const idx = parseInt(b.dataset.i, 10);
      if (Game && Game.startLevel) {
        Game.startLevel(idx, Game.player, false);
        Game.state = 'play';
        Game.hintT = 2.4;
      }
      close();
    });
    document.addEventListener('click', function (ev) {
      if (panel.classList.contains('hidden')) return;
      if (ev.target === btn || panel.contains(ev.target)) return;
      close();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') close();
    });
    if (/jump/.test(location.hash)) setTimeout(open, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
