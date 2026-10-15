/*
 * Движок сюжета: состояние героя, переходы между сценами, условия, сохранения.
 * Ничего не знает про DOM — только данные. UI живёт в app.js.
 */
window.Engine = (() => {
  const SAVE_KEY = 'put-geroya:save:v2';

  let state = null;

  function newState() {
    return {
      v: 2,
      name: '',                     // вводится в диалоге с королевой
      gender: null,                 // 'm' | 'f' — выбирается после пролога
      scene: STORY.meta.start,
      flags: {},                    // флаги и счётчики: { difficulty: 'hard', gold: 10 }
      visited: {},                  // сколько раз была каждая сцена
      endings: loadEndings(),       // открытые концовки переживают «новую игру»
      startedAt: Date.now(),
    };
  }

  // --- Условия -------------------------------------------------------------------
  // if: { flag: 'key' }               — флаг истинный
  // if: { not: 'key' }                — флаг ложный/нет
  // if: { eq: ['difficulty', 'hard'] } — флаг равен значению
  // if: { gte: ['gold', 5] }          — счётчик >= числа
  // if: { gender: 'f' }               — только для героини
  // if: { visited: 'sceneId' }        — сцена уже была
  // if: [ {...}, {...} ]              — все условия сразу
  function check(cond) {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every(check);
    if ('flag' in cond) return !!state.flags[cond.flag];
    if ('not' in cond) return !state.flags[cond.not];
    if ('eq' in cond) return state.flags[cond.eq[0]] === cond.eq[1];
    if ('gte' in cond) return (state.flags[cond.gte[0]] || 0) >= cond.gte[1];
    if ('gender' in cond) return state.gender === cond.gender;
    if ('visited' in cond) return !!state.visited[cond.visited];
    return true;
  }

  // set: { key: value }   add: { gold: 2 }
  function apply(effects) {
    if (!effects) return;
    Object.assign(state.flags, effects.set || {});
    for (const [k, n] of Object.entries(effects.add || {})) {
      state.flags[k] = (state.flags[k] || 0) + n;
    }
  }

  function scene() {
    const s = STORY.scenes[state.scene];
    if (!s) throw new Error(`Нет сцены "${state.scene}" в story.js`);
    return s;
  }

  function enter(id) {
    if (!STORY.scenes[id]) throw new Error(`Нет сцены "${id}" в story.js`);
    state.scene = id;
    state.visited[id] = (state.visited[id] || 0) + 1;
    const s = scene();
    apply(s);                                   // эффекты при входе в сцену
    if (s.ending) {
      state.endings[s.ending] = true;
      saveEndings(state.endings);
    }
    save();
  }

  // Строки текста сцены с учётом условий (у строки может быть своё if)
  function lines() {
    return [].concat(scene().text || []).filter((l) => typeof l === 'string' || check(l.if));
  }

  function availableChoices() {
    return (scene().choices || []).filter((c) => check(c.if));
  }

  // Возвращает спец-цель ('@title'), если выбор ведёт не в сцену
  function choose(choice) {
    apply(choice);
    if (choice.to.startsWith('@')) return choice.to;
    enter(choice.to);
    return null;
  }

  function go(id, effects) {
    apply(effects);
    enter(id);
  }

  // --- Сохранения --------------------------------------------------------------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const s = raw && JSON.parse(raw);
      if (s && STORY.scenes[s.scene]) { state = s; return true; }
    } catch {}
    return false;
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }
  function wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    state = null;
  }

  function loadEndings() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY + ':endings')) || {}; } catch { return {}; }
  }
  function saveEndings(e) {
    try { localStorage.setItem(SAVE_KEY + ':endings', JSON.stringify(e)); } catch {}
  }

  // Код сохранения — чтобы перенести прогресс на другой телефон или отдать другу.
  function exportCode() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }
  function importCode(code) {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!s || !STORY.scenes[s.scene]) throw new Error('bad save');
    state = s;
    save();
  }

  return {
    get state() { return state; },
    start() { state = newState(); enter(state.scene); },
    setName(name) { state.name = name; save(); },
    setGender(g) { state.gender = g; save(); },
    load, hasSave, wipe, scene, lines, availableChoices, choose, go, exportCode, importCode,
  };
})();
