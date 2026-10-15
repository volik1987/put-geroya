/*
 * Подстановки в тексте сюжета.
 *
 *   {name}            — имя героя
 *   {Name}            — имя с заглавной (на случай, если ввели строчными)
 *   {м|ж}             — выбор формы по полу: «ты {пошёл|пошла}»
 *   {flag:ключ}       — значение флага/счётчика из состояния
 *
 * Пример: "{name}, ты {устал|устала}, но {сам|сама} выбрал{|а} эту дорогу."
 */
window.Text = (() => {
  function render(str, state) {
    return String(str).replace(/\{([^{}]*)\}/g, (whole, body) => {
      if (body === 'name') return state.name;
      if (body === 'Name') return state.name.charAt(0).toUpperCase() + state.name.slice(1);
      if (body.startsWith('flag:')) return String(state.flags[body.slice(5)] ?? 0);
      if (body.includes('|')) {
        const [m, f] = body.split('|');
        return state.gender === 'f' ? f : m;
      }
      return whole;
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Абзац → HTML. Реплики в «ёлочках» подсвечиваются.
  function paragraph(str, state) {
    const safe = escapeHtml(render(str, state));
    return safe.replace(/«[^»]*»/g, (q) => `<span class="speech">${q}</span>`);
  }

  return { render, paragraph };
})();
