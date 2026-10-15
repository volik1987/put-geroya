/*
 * «Поделиться с друзьями».
 * На телефоне — системное меню (Telegram, WhatsApp, VK…) через Web Share API.
 * Где его нет (десктоп) — копируем текст со ссылкой в буфер.
 */
window.Share = (() => {
  function gameUrl() {
    // Ссылка на саму игру без хвостов (#, ?)
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }

  async function share({ title, text }) {
    const url = gameUrl();
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return 'shared'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return 'copied';
    } catch {
      prompt('Скопируй ссылку:', url);
      return 'shown';
    }
  }

  return { share, gameUrl };
})();
