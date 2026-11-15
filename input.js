'use strict';

const Input = {
  keys: {},
  hits: {},

  init() {
    const block = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
      'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF',
      'KeyJ', 'KeyK', 'KeyP', 'KeyR', 'KeyM', 'KeyZ', 'KeyX', 'KeyC', 'KeyV',
      'Tab', 'Enter', 'Escape', 'KeyE', 'KeyQ', 'KeyT'
    ]);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this.hits[e.code] = true;
      this.keys[e.code] = true;
      if (Sfx && Sfx.unlock) Sfx.unlock();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.hits = {}; });
  },

  /* 触屏/程序化按键：按下时同时写 hits，和真实键盘完全一样 */
  setKey(code, on) {
    if (on) {
      if (!this.keys[code]) this.hits[code] = true;
      this.keys[code] = true;
    } else {
      this.keys[code] = false;
    }
  },

  initTouch() {
    const box = document.getElementById('touch');
    if (!box) return;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!coarse && !isTouch && !/touch/.test(location.hash)) return;
    box.classList.add('on');

    /* 任意点按先解锁音频 + 从首页开始 */
    window.addEventListener('touchstart', () => {
      if (Sfx && Sfx.unlock) Sfx.unlock();
      if (window.Game && Game.state === 'title') { Game.state = 'play'; }
    }, { passive: true });

    /* 摇杆 */
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let baseX = 0, baseY = 0, id = null;
    const R = 46;
    const move = (x, y) => {
      let dx = x - baseX, dy = y - baseY;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const nx = dx / R, ny = dy / R;
      this.setKey('ArrowLeft', nx < -0.28);
      this.setKey('ArrowRight', nx > 0.28);
      this.setKey('ArrowDown', ny > 0.62);
    };
    const reset = () => {
      knob.style.transform = '';
      this.setKey('ArrowLeft', false);
      this.setKey('ArrowRight', false);
      this.setKey('ArrowDown', false);
    };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = stick.getBoundingClientRect();
      baseX = r.left + r.width / 2;
      baseY = r.top + r.height / 2;
      move(t.clientX, t.clientY);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) move(t.clientX, t.clientY);
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      reset();
      id = null;
    };
    stick.addEventListener('touchend', end, { passive: false });
    stick.addEventListener('touchcancel', end, { passive: false });

    /* 按钮 */
    for (const btn of document.querySelectorAll('.tpad')) {
      const code = btn.getAttribute('data-key');
      const on = (e) => { e.preventDefault(); btn.classList.add('down'); this.setKey(code, true); };
      const off = (e) => { e.preventDefault(); btn.classList.remove('down'); this.setKey(code, false); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
    }
  },

  down(c) { return !!this.keys[c]; },
  hit(c) { return !!this.hits[c]; },
  clearHits() { this.hits = {}; },

  left() { return this.down('ArrowLeft') || this.down('KeyA'); },
  right() { return this.down('ArrowRight') || this.down('KeyD'); },
  jumpDown() { return this.down('Space') || this.down('ArrowUp') || this.down('KeyW'); },
  jumpHit() { return this.hit('Space') || this.hit('ArrowUp') || this.hit('KeyW'); },
  run() { return this.down('ShiftLeft') || this.down('ShiftRight') || this.down('KeyF'); },
  duck() { return this.down('ArrowDown') || this.down('KeyS'); }
};
