/*
 * UI: экраны, отрисовка сцен (текст, диалоги, ввод имени, выбор пола, бой), меню, настройки.
 */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const OPTS_KEY = 'put-geroya:opts';
  const opts = Object.assign({ size: 18, typewriter: true }, readJson(OPTS_KEY));

  let current = 'title';
  let previous = 'title';
  let revealTimer = null;
  let fight = null;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
  }
  function saveOpts() {
    try { localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch {}
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // --- Экраны --------------------------------------------------------------------
  function show(name) {
    if (name === 'back') name = previous;
    if (name !== 'story') stopFight();
    previous = current;
    current = name;
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
    if (name === 'title') refreshTitle();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));

  // Кнопка «назад» на Android: не выходим из игры, а возвращаемся к прошлому экрану.
  history.replaceState({ root: true }, '');
  history.pushState({}, '');
  addEventListener('popstate', () => {
    if ($('#dlg-menu').open) $('#dlg-menu').close();
    else if (current === 'story') { renderBag(); $('#dlg-menu').showModal(); }
    else if (current !== 'title') show(current === 'settings' ? previous : 'title');
    history.pushState({}, '');
  });

  // --- Титул --------------------------------------------------------------------
  function refreshTitle() {
    $('#story-subtitle').textContent = STORY.meta.subtitle || '';
    $('#version').textContent = `версия ${STORY.meta.version}`;
    const has = Engine.hasSave() && Engine.load();
    $('#btn-continue').hidden = !has;
    if (has) $('#btn-continue').textContent = Engine.state.name ? `Продолжить — ${Engine.state.name}` : 'Продолжить';
  }
  $('#btn-continue').addEventListener('click', () => { Engine.load(); show('story'); renderScene(); });
  $('#btn-new').addEventListener('click', () => {
    if (Engine.hasSave() && !confirm('Начать заново? Текущий прогресс будет перезаписан.')) return;
    Engine.start();
    show('story');
    renderScene();
  });
  $('#btn-settings').addEventListener('click', () => show('settings'));
  $('#btn-share-game').addEventListener('click', async () => {
    const r = await Share.share({ title: 'Путь Героя', text: STORY.meta.shareText });
    if (r === 'copied') toast('Ссылка скопирована — отправь её другу');
  });

  // --- Сцена ------------------------------------------------------------------------
  function renderScene() {
    const st = Engine.state;
    const sc = Engine.scene();
    const screen = $('#screen-story');
    clearTimeout(revealTimer);
    stopFight();

    screen.dataset.bg = sc.bg || '';
    if (sc.fx === 'flash') flash();

    $('#chapter').textContent = sc.chapter ? Text.render(sc.chapter, st) : '';
    $('#hero-tag').textContent = st.name;

    const art = $('#scene-art');
    art.hidden = !sc.art;
    art.textContent = sc.art || '';

    if (sc.battle) return startFight(sc);

    const textEl = $('#story-text');
    textEl.innerHTML =
      (sc.ending ? `<div class="ending-badge">${Text.render(sc.endingTitle || sc.ending, st)}</div>` : '') +
      Engine.lines().map((l) => lineHtml(l, st)).join('');

    const choicesEl = $('#choices');
    choicesEl.innerHTML = '';
    if (sc.pick === 'gender') renderGenderPick(sc, choicesEl);
    else if (sc.input) renderNameInput(sc, choicesEl);
    else (sc.ending ? endingChoices(sc) : Engine.availableChoices()).forEach((c) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = Text.render(c.text, st);
      if (c.note) {
        const n = document.createElement('small');
        n.textContent = Text.render(c.note, st);
        b.appendChild(n);
      }
      b.addEventListener('click', () => (c.action ? c.action() : pick(c)));
      choicesEl.appendChild(b);
    });

    if (opts.typewriter) reveal(textEl, choicesEl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pick(choice) {
    const special = Engine.choose(choice);
    if (special === '@title') {
      Engine.wipe();
      show('title');
      toast('Может быть, в другой раз…');
      return;
    }
    renderScene();
  }

  // Строка текста: обычный абзац, крупный вопрос или реплика персонажа
  function lineHtml(l, st) {
    if (typeof l === 'string') return `<p>${Text.paragraph(l, st)}</p>`;
    if (l.q) return `<p class="question">${Text.paragraph(l.q, st)}</p>`;
    if (l.say) {
      const ch = STORY.characters[l.who] || { name: l.who, icon: '💬' };
      const name = Text.render(ch.name, st) || '…';
      return `<div class="line ${l.who === 'hero' ? 'hero' : ''}">
        <div class="portrait">${Text.render(ch.icon, st)}</div>
        <div class="bubble"><div class="who">${Text.paragraph(name, st)}</div>${Text.paragraph(l.say, st)}</div>
      </div>`;
    }
    return `<p>${Text.paragraph(l.text || '', st)}</p>`;
  }

  function renderGenderPick(sc, el) {
    el.innerHTML = `<div class="gender-pick">
      <button class="gender-card" data-gender="m"><span class="gender-icon">🧑</span><span>Герой</span></button>
      <button class="gender-card" data-gender="f"><span class="gender-icon">👩</span><span>Героиня</span></button>
    </div>`;
    el.querySelectorAll('.gender-card').forEach((b) => b.addEventListener('click', () => {
      Engine.setGender(b.dataset.gender);
      Engine.go(sc.next);
      renderScene();
    }));
  }

  function renderNameInput(sc, el) {
    el.innerHTML = `<form class="name-form">
      <input type="text" maxlength="20" autocomplete="off" placeholder="${sc.input.placeholder || 'Твоё имя'}">
      <button class="btn primary">Ответить</button>
    </form>`;
    const form = el.querySelector('form');
    const input = form.querySelector('input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.replace(/[{}<>|]/g, '').replace(/\s+/g, ' ').trim();
      if (name.length < 2) { toast('Имя — хотя бы две буквы'); input.focus(); return; }
      Engine.setName(name.charAt(0).toUpperCase() + name.slice(1));
      Engine.go(sc.input.to);
      renderScene();
    });
    setTimeout(() => input.focus(), 400);
  }

  function flash() {
    const f = $('#flash');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  // Абзацы появляются по очереди; тап по тексту — показать всё сразу.
  function reveal(textEl, choicesEl) {
    const items = [...textEl.children, ...choicesEl.children];
    items.forEach((el) => { el.style.opacity = 0; el.style.transition = 'opacity .5s'; });
    let i = 0;
    const step = () => {
      if (i >= items.length) return;
      items[i++].style.opacity = 1;
      revealTimer = setTimeout(step, i <= textEl.children.length ? 650 : 120);
    };
    textEl.onclick = () => { clearTimeout(revealTimer); items.forEach((el) => { el.style.opacity = 1; }); };
    step();
  }

  function endingChoices(sc) {
    const st = Engine.state;
    const found = Object.keys(st.endings).length;
    const total = new Set(Object.values(STORY.scenes).map((s) => s.ending).filter(Boolean)).size;
    return [
      {
        text: 'Поделиться',
        action: async () => {
          const text = Text.render(`Я {прошёл|прошла} «Путь Героя» как {name} и {дошёл|дошла} до главы «${sc.endingTitle || sc.ending}». Попробуй сам:`, st);
          const r = await Share.share({ title: 'Путь Героя', text });
          if (r === 'copied') toast('Скопировано — вставь в чат другу');
        },
      },
      { text: total > 1 ? `Начать заново (концовок: ${found}/${total})` : 'Начать заново', action: () => { Engine.start(); renderScene(); } },
      { text: 'В главное меню', action: () => show('title') },
    ];
  }

  // --- Бой --------------------------------------------------------------------------
  function startFight(sc) {
    const st = Engine.state;
    const screen = $('#screen-story');
    screen.classList.add('fighting');
    $('#battle').hidden = false;
    fight = Battle.start({
      canvas: $('#battle-canvas'),
      difficulty: st.flags.difficulty || 'normal',
      potions: st.flags.potion || 0,
      vessel: !st.flags.vessel ? 'none' : st.flags.vesselFull ? 'full' : 'empty',
      heroIcon: st.gender === 'f' ? '👩' : '🧑',
      onHud(h) {
        $('#hud-hp').style.width = (100 * h.hp) / h.maxHp + '%';
        $('#hud-hp-num').textContent = `${h.hp}/${h.maxHp} ОЗ`;
        $('#btn-vessel').hidden = h.vessel === 'none';
        $('#btn-vessel').classList.toggle('empty', h.vessel !== 'full');
        $('#hud-vessel').textContent = h.vessel === 'full' ? '50' : 'пуст';
        $('#hud-wolves').textContent = `🐺 ${h.left}/${h.total}`;
        $('#hud-potions').textContent = h.potions;
        $('#btn-potion').disabled = !h.potions;
      },
      onEnd(result, { potions, vessel }) {
        fight = null;
        const b = sc.battle;
        Engine.go(result === 'win' ? b.win : b.lose, result === 'win' ? { set: { potion: potions, vesselFull: vessel === 'full' } } : null);
        renderScene();
      },
    });
  }

  function stopFight() {
    if (fight) fight.stop();
    fight = null;
    $('#screen-story').classList.remove('fighting');
    $('#battle').hidden = true;
  }

  // Крестовина: держишь — бежишь. Работает и пальцем, и мышью.
  document.querySelectorAll('.dpad button').forEach((b) => {
    const set = (on) => (e) => {
      e.preventDefault();
      b.classList.toggle('on', on);
      fight && fight.move(b.dataset.dir, on);
    };
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); set(true)(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, set(false)));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  const press = (el, fn) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('on'); fn(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => el.classList.remove('on')));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  press($('#btn-attack'), () => fight && fight.attack());
  press($('#btn-potion'), () => fight && fight.potion());
  press($('#btn-vessel'), () => fight && fight.drink());

  // Клавиатура (для игры с компьютера): стрелки/WASD, пробел — удар, Q — зелье
  const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  addEventListener('keydown', (e) => {
    if (!fight) return;
    if (KEYS[e.code]) { fight.move(KEYS[e.code], true); e.preventDefault(); }
    else if (e.code === 'Space' || e.code === 'KeyJ') { if (!e.repeat) fight.attack(); e.preventDefault(); }
    else if (e.code === 'KeyQ') fight.potion();
    else if (e.code === 'KeyE') fight.drink();
  });
  addEventListener('keyup', (e) => { if (fight && KEYS[e.code]) fight.move(KEYS[e.code], false); });

  // --- Меню в игре ------------------------------------------------------------------
  $('#btn-menu').addEventListener('click', () => { renderBag(); $('#dlg-menu').showModal(); });

  // Сумка героя в меню
  function renderBag() {
    const f = (Engine.state && Engine.state.flags) || {};
    const items = [];
    if (f.gold) items.push(`💰 ${f.gold}`);
    if (f.potion) items.push(`🧪 ${f.potion}`);
    if (f.vessel) items.push(`🏺 Кровавый сосуд — ${f.vesselFull ? 'полон' : 'пуст'}`);
    $('#bag').textContent = '';
    items.forEach((t) => { const s = document.createElement('span'); s.textContent = t; $('#bag').appendChild(s); });
  }
  $('#dlg-menu [data-close]').addEventListener('click', () => $('#dlg-menu').close());
  $('#btn-to-title').addEventListener('click', () => { $('#dlg-menu').close(); show('title'); });
  $('#btn-menu-settings').addEventListener('click', () => { $('#dlg-menu').close(); show('settings'); });

  // --- Настройки --------------------------------------------------------------------
  function applyOpts() {
    document.documentElement.style.setProperty('--text-size', opts.size + 'px');
    $('#opt-size').value = opts.size;
    $('#opt-typewriter').checked = opts.typewriter;
  }
  $('#opt-size').addEventListener('input', (e) => { opts.size = +e.target.value; saveOpts(); applyOpts(); });
  $('#opt-typewriter').addEventListener('change', (e) => { opts.typewriter = e.target.checked; saveOpts(); });
  $('#btn-export').addEventListener('click', async () => {
    if (!Engine.state && !Engine.load()) return toast('Пока нечего сохранять');
    const code = Engine.exportCode();
    try { await navigator.clipboard.writeText(code); toast('Код сохранения скопирован'); }
    catch { prompt('Код сохранения:', code); }
  });
  $('#btn-import').addEventListener('click', () => {
    const code = prompt('Вставь код сохранения:');
    if (!code) return;
    try { Engine.importCode(code); toast('Сохранение загружено'); show('title'); }
    catch { toast('Код не подошёл'); }
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Точно удалить прогресс?')) return;
    Engine.wipe();
    toast('Прогресс удалён');
  });

  // --- Установка как приложение (Android Chrome) -------------------------------------
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    $('#btn-install').hidden = false;
  });
  $('#btn-install').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null;
    $('#btn-install').hidden = true;
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js');
  }

  applyOpts();
  show('title');
})();
