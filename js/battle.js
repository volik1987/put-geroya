/*
 * Бой в реальном времени на canvas.
 * Вид сверху: герой с мечом, волки бегут к нему, приседают (красный «!») и прыгают.
 * Уклоняйся крестовиной, бей кнопкой 🗡️ (меч сам доворачивает к ближнему волку).
 *
 *   const fight = Battle.start({ canvas, difficulty, potions, vessel, heroIcon, onEnd, onHud });
 *   vessel: 'none' | 'empty' | 'full' — Кровавый сосуд
 *   fight.move('left', true|false); fight.attack(); fight.potion(); fight.drink(); fight.stop();
 */
window.Battle = (() => {
  // Сложность задаётся ответом королеве
  const DIFF = {
    easy:   { count: 2, hp: 2, speed: 0.8, dmg: 10, windup: 0.8,  heroHp: 100 },
    normal: { count: 3, hp: 3, speed: 1.0, dmg: 14, windup: 0.6,  heroHp: 100 },
    hard:   { count: 4, hp: 4, speed: 1.2, dmg: 18, windup: 0.45, heroHp: 100 },
  };

  const HERO_SPEED = 170;      // px/с
  const SWING_TIME = 0.22;     // длительность взмаха
  const SWING_CD = 0.36;       // пауза между ударами
  const REACH = 66;            // длина удара
  const ARC = (75 * Math.PI) / 180;
  const POTION_HEAL = 40;
  const VESSEL_HEAL = 50;

  function start({ canvas, difficulty, potions, vessel = 'none', heroIcon, onEnd, onHud }) {
    const g = canvas.getContext('2d');
    const d = DIFF[difficulty] || DIFF.normal;
    let W = 0, H = 0, raf = 0, last = 0, ended = false, time = 0, endTimer = -1, result = null;

    const input = { up: false, down: false, left: false, right: false };
    const hero = {
      x: 0, y: 0, r: 16, hp: d.heroHp, maxHp: d.heroHp, potions, vessel,
      face: { x: 0, y: -1 }, swing: 0, cd: 0, inv: 0, hitIds: new Set(), kx: 0, ky: 0,
    };
    let wolves = [];
    const fx = [];            // всплывающие цифры и облачка
    let deco = [];            // деревья по краям

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const first = !W;
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (first) setup();
      makeDeco();
    }

    function setup() {
      hero.x = W / 2; hero.y = H * 0.72;
      wolves = [];
      for (let i = 0; i < d.count; i++) {
        const t = (i + 1) / (d.count + 1);
        wolves.push({
          id: i, x: W * t, y: H * 0.22 + (i % 2) * 24, r: 17,
          hp: d.hp, maxHp: d.hp, state: 'idle', t: 1 + i * 0.35,
          vx: 0, vy: 0, lx: 0, ly: 0, flash: 0, dead: false, alpha: 1, flip: 1,
        });
      }
      hud();
    }

    function makeDeco() {
      let seed = 7;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      deco = [];
      for (let i = 0; i < 26; i++) {
        const side = i % 4;
        const along = rnd();
        const inset = 8 + rnd() * 26;
        const x = side === 0 ? inset : side === 1 ? W - inset : along * W;
        const y = side === 2 ? H - inset : side === 3 ? 34 + inset : along * H;
        deco.push({ x, y, e: rnd() < 0.6 ? '🌲' : '🍁', s: 22 + rnd() * 14 });
      }
    }

    function hud() {
      onHud && onHud({
        hp: hero.hp, maxHp: hero.maxHp, potions: hero.potions, vessel: hero.vessel,
        left: wolves.filter((w) => !w.dead).length, total: wolves.length,
      });
    }

    // --- Логика ------------------------------------------------------------------
    function update(dt) {
      time += dt;

      // Герой: движение
      let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (mx || my) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        if (hero.swing <= 0) hero.face = { x: mx, y: my };
      }
      hero.x += (mx * HERO_SPEED + hero.kx) * dt;
      hero.y += (my * HERO_SPEED + hero.ky) * dt;
      hero.kx *= 0.85; hero.ky *= 0.85;
      hero.x = clamp(hero.x, 24, W - 24);
      hero.y = clamp(hero.y, 56, H - 22);
      hero.cd -= dt; hero.inv -= dt;

      // Удар мечом
      if (hero.swing > 0) {
        hero.swing -= dt;
        for (const w of wolves) {
          if (w.dead || hero.hitIds.has(w.id)) continue;
          const dx = w.x - hero.x, dy = w.y - hero.y;
          const dist = Math.hypot(dx, dy);
          if (dist > REACH + w.r) continue;
          const ang = Math.abs(angleDiff(Math.atan2(dy, dx), Math.atan2(hero.face.y, hero.face.x)));
          if (ang > ARC && dist > w.r + hero.r) continue;
          hero.hitIds.add(w.id);
          w.hp -= 1;
          w.flash = 0.18;
          w.state = 'hurt'; w.t = 0.35;
          const k = 260 / (dist || 1);
          w.vx = dx * k; w.vy = dy * k;
          fx.push({ x: w.x, y: w.y - 22, text: '−1', t: 0.7, color: '#ffe2a0' });
          vibrate(25);
          if (w.hp <= 0) {
            w.dead = true;
            fx.push({ x: w.x, y: w.y, text: '💨', t: 0.6, big: true });
            hud();
          }
        }
      }

      // Волки
      for (const w of wolves) {
        if (w.dead) { w.alpha = Math.max(0, w.alpha - dt * 3); continue; }
        w.flash -= dt;
        w.t -= dt;
        const dx = hero.x - w.x, dy = hero.y - w.y;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = 80 * d.speed;

        if (w.state === 'idle') {
          if (w.t <= 0) w.state = 'chase';
        } else if (w.state === 'chase') {
          w.vx = (dx / dist) * sp; w.vy = (dy / dist) * sp;
          if (dist < 120 && w.t <= 0) { w.state = 'windup'; w.t = d.windup; w.lx = dx / dist; w.ly = dy / dist; }
        } else if (w.state === 'windup') {
          w.vx *= 0.8; w.vy *= 0.8;
          w.lx = dx / dist; w.ly = dy / dist;          // целится до последнего
          if (w.t <= 0) { w.state = 'lunge'; w.t = 0.32; w.vx = w.lx * 430 * d.speed; w.vy = w.ly * 430 * d.speed; }
        } else if (w.state === 'lunge') {
          if (dist < w.r + hero.r && hero.inv <= 0) {
            hero.hp = Math.max(0, hero.hp - d.dmg);
            hero.inv = 0.9;
            hero.kx = w.vx * 0.6; hero.ky = w.vy * 0.6;
            fx.push({ x: hero.x, y: hero.y - 26, text: `−${d.dmg}`, t: 0.8, color: '#ff7a6a' });
            vibrate(90);
            hud();
            w.state = 'rest'; w.t = 0.8;
          }
          if (w.t <= 0) { w.state = 'rest'; w.t = 0.7 + Math.random() * 0.5; }
        } else if (w.state === 'rest' || w.state === 'hurt') {
          w.vx *= 0.88; w.vy *= 0.88;
          if (w.t <= 0) { w.state = 'chase'; w.t = 0.4 + Math.random() * 0.6; }
        }

        // Волки не слипаются
        for (const o of wolves) {
          if (o === w || o.dead) continue;
          const ox = w.x - o.x, oy = w.y - o.y, od = Math.hypot(ox, oy);
          if (od > 0 && od < 40) { w.x += (ox / od) * (40 - od) * 0.5; w.y += (oy / od) * (40 - od) * 0.5; }
        }

        w.x = clamp(w.x + w.vx * dt, 20, W - 20);
        w.y = clamp(w.y + w.vy * dt, 50, H - 20);
        if (Math.abs(w.vx) > 5) w.flip = w.vx > 0 ? -1 : 1;
      }

      for (let i = fx.length - 1; i >= 0; i--) {
        fx[i].t -= dt; fx[i].y -= dt * 30;
        if (fx[i].t <= 0) fx.splice(i, 1);
      }

      // Итог боя
      if (!result) {
        if (hero.hp <= 0) { result = 'lose'; endTimer = 1.2; }
        else if (wolves.every((w) => w.dead)) { result = 'win'; endTimer = 1.2; }
      } else {
        endTimer -= dt;
        if (endTimer <= 0 && !ended) { ended = true; stop(); onEnd(result, { potions: hero.potions, vessel: hero.vessel }); }
      }
    }

    // --- Рисование ------------------------------------------------------------------
    function draw() {
      // Земля красного леса
      const bg = g.createRadialGradient(W / 2, H * 0.6, 20, W / 2, H * 0.6, Math.max(W, H));
      bg.addColorStop(0, '#5a2a1c');
      bg.addColorStop(0.6, '#3a1712');
      bg.addColorStop(1, '#1c0b09');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      // Священный ручей сверху
      g.fillStyle = '#2b5f7a';
      g.beginPath();
      g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, 30 + Math.sin(x / 26 + time * 2) * 4);
      g.lineTo(W, 0);
      g.fill();
      g.strokeStyle = 'rgba(190,230,255,.5)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= W; x += 10) g.lineTo(x, 22 + Math.sin(x / 18 - time * 3) * 2);
      g.stroke();

      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const t of deco) { g.font = `${t.s}px serif`; g.fillText(t.e, t.x, t.y); }

      // Волки
      for (const w of wolves) {
        if (w.alpha <= 0) continue;
        g.save();
        g.globalAlpha = w.alpha;
        shadow(w.x, w.y + 14, 16);
        if (w.state === 'windup') {
          const p = 1 - w.t / d.windup;
          g.fillStyle = `rgba(255,60,40,${0.25 + p * 0.35})`;
          g.beginPath(); g.arc(w.x, w.y, w.r + 6 + p * 6, 0, Math.PI * 2); g.fill();
          g.font = 'bold 20px sans-serif';
          g.fillStyle = '#ff5a40';
          g.fillText('!', w.x, w.y - 32);
        }
        if (w.state === 'lunge') {
          g.globalAlpha = w.alpha * 0.3;
          drawEmoji('🐺', w.x - w.vx * 0.04, w.y - w.vy * 0.04, 34, w.flip);
          g.globalAlpha = w.alpha;
        }
        if (w.flash > 0) g.filter = 'brightness(3)';
        drawEmoji('🐺', w.x, w.y, 34, w.flip);
        g.filter = 'none';
        // здоровье
        for (let i = 0; i < w.maxHp; i++) {
          g.fillStyle = i < w.hp ? '#e04a3a' : 'rgba(0,0,0,.45)';
          g.fillRect(w.x - w.maxHp * 5 + i * 10, w.y - 26, 8, 4);
        }
        g.restore();
      }

      // Герой
      const blink = hero.inv > 0 && Math.floor(time * 16) % 2 === 0;
      shadow(hero.x, hero.y + 14, 15);
      if (!blink) {
        drawSword();
        drawEmoji(heroIcon, hero.x, hero.y, 32, 1);
      }

      for (const f of fx) {
        g.globalAlpha = Math.min(1, f.t * 2);
        g.font = f.big ? '28px serif' : 'bold 16px sans-serif';
        g.fillStyle = f.color || '#fff';
        g.fillText(f.text, f.x, f.y);
        g.globalAlpha = 1;
      }

      if (time < 1.2) banner('Бой!', 1 - time / 1.2);
      if (result && endTimer > 0) banner(result === 'win' ? 'Победа!' : 'Поражение…', 1);
    }

    function drawSword() {
      const base = Math.atan2(hero.face.y, hero.face.x);
      let ang = base + 0.9;                            // меч в покое — чуть сбоку
      if (hero.swing > 0) {
        const p = 1 - hero.swing / SWING_TIME;         // взмах от +ARC к −ARC
        ang = base + ARC - p * ARC * 2;
        g.strokeStyle = 'rgba(255,245,220,.35)';
        g.lineWidth = 10;
        g.beginPath();
        g.arc(hero.x, hero.y, REACH - 10, base + ARC, ang, true);
        g.stroke();
      }
      g.save();
      g.translate(hero.x, hero.y);
      g.rotate(ang);
      g.fillStyle = '#c9a24a';                          // рукоять и гарда
      g.fillRect(10, -2.5, 10, 5);
      g.fillRect(19, -7, 4, 14);
      g.fillStyle = '#e8edf2';                          // клинок
      g.beginPath();
      g.moveTo(23, -3.5); g.lineTo(REACH - 6, -2); g.lineTo(REACH, 0); g.lineTo(REACH - 6, 2); g.lineTo(23, 3.5);
      g.fill();
      g.restore();
    }

    function drawEmoji(e, x, y, size, flip) {
      g.save();
      g.translate(x, y);
      g.scale(flip, 1);
      g.font = `${size}px serif`;
      g.fillText(e, 0, 0);
      g.restore();
    }

    function shadow(x, y, rx) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2); g.fill();
    }

    function banner(text, alpha) {
      g.globalAlpha = alpha;
      g.font = 'bold 34px Georgia, serif';
      g.fillStyle = '#f4dca0';
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.lineWidth = 5;
      g.strokeText(text, W / 2, H / 2);
      g.fillText(text, W / 2, H / 2);
      g.globalAlpha = 1;
    }

    // --- Цикл -----------------------------------------------------------------------
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      update(dt);
      draw();
      if (!ended) raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    }

    addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame((t) => { last = t; frame(t); });

    return {
      move(dir, on) { input[dir] = on; },
      attack() {
        if (hero.cd > 0 || result) return;
        // автонаводка на ближнего волка
        let best = null, bd = 140;
        for (const w of wolves) {
          if (w.dead) continue;
          const dist = Math.hypot(w.x - hero.x, w.y - hero.y);
          if (dist < bd) { bd = dist; best = w; }
        }
        if (best) hero.face = { x: (best.x - hero.x) / bd, y: (best.y - hero.y) / bd };
        hero.swing = SWING_TIME;
        hero.cd = SWING_CD;
        hero.hitIds.clear();
      },
      potion() {
        if (hero.potions <= 0 || hero.hp >= hero.maxHp || result) return;
        hero.potions -= 1;
        hero.hp = Math.min(hero.maxHp, hero.hp + POTION_HEAL);
        fx.push({ x: hero.x, y: hero.y - 26, text: `+${POTION_HEAL}`, t: 0.9, color: '#8fe39a' });
        hud();
      },
      drink() {
        if (hero.vessel !== 'full' || hero.hp >= hero.maxHp || result) return;
        hero.vessel = 'empty';
        hero.hp = Math.min(hero.maxHp, hero.hp + VESSEL_HEAL);
        fx.push({ x: hero.x, y: hero.y - 26, text: `+${VESSEL_HEAL}`, t: 0.9, color: '#ff8a9a' });
        hud();
      },
      stop() { ended = true; stop(); },
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

  return { start, DIFF };
})();
