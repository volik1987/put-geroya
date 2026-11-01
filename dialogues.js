/*
 * ВСЕ ДИАЛОГИ ИГРЫ. Правь текст здесь — код трогать не нужно.
 *
 * CHARACTERS — кто говорит: имя и портрет 256×256.
 *   В портрете {g} заменяется на пол героя (m/f).
 *
 * DIALOGUES — ключ сцены → список реплик:
 *   { who: 'lumina', text: 'Реплика' }
 *   { who: 'lumina', text: '…', set: { flag: true } }          — флаги при показе реплики
 *   { who: 'voice', text: '…', toast: 'Получено: …' }          — всплывающее уведомление
 *   { who: 'voice', text: '…', fx: 'flash' }                   — белая вспышка экрана
 *   { who: …, text: '…', next: 'ключ' }                         — после этой реплики перейти к другому диалогу
 *   { if: { flag: 'x' }, who: …, text: … }                     — реплика только при условии
 *   { who: …, text: 'Вопрос?', choices: [
 *       { text: 'Ответ', set: {…}, add: {…}, next: 'ключ' },   — перейти к другому диалогу
 *       { text: 'Идти', scene: 'map_id', at: [x, y], fx: 'flash' },  — в другую локацию (fx: белая вспышка)
 *       { text: 'Только если…', if: { gte: ['gold', 5] }, … },
 *   ] }
 *
 * Подстановки: {name} — имя героя, {Великий Герой|Великая Героиня}, {он|она} — по флагу hero_gender.
 * Условия: { flag }, { not }, { eq: ['k', 'v'] }, { gte: ['k', n] }, { in: ['k', ['v1', 'v2']] }.
 *
 * Флаги (единые имена): path_hope, path_power, path_hate, dolita_dead, note_1_taken, note_2_taken,
 * hate_first_clear, dolita_knows, lumina_letter_read, game_locked, hero_gender, bribe_cost,
 * а также reluctant_hero, light_element, prologue_done,
 * этап 2: wolf_quest, wolves_dead, elder_rewarded, got_flask, has_water_flask, gold.
 * этап 3: gate_met, gate_fight, gate_cleared, gate_bribed, gate_persuaded, gate_passed, north_gate_open,
 *   knight_seen, red_diamond; path_* растут на 1 за каждую развилку.
 * этап 4: city_seen, theft_done, thief_escaped, thief_caught, stolen_gold, lore_gods.
 * этап 5: temple_path (hope|power|hate — ведущий путь), temple_seen, temple_done, priest_fight, priest_beaten,
 *   priest_fled, organ_seen, organ_fight, organ_broken, dolita_beaten, dolita_spared, dolita_dead, lumina_letter_read.
 * этап 6: capital_seen, dolita_led, dolita_knows, bad_past (было плохое прохождение — из памяти pg2_meta), palace_password,
 *   knight_fight, knight_halt, knight_stopped, aedel_met, palace_open, throne_seen, ambassador, lumina_exposed, hero_king, wedding.
 *   Ключи реплики: mini: 'stones' — мини-игра; scene: 'map', at, dir — после диалога в локацию; ending: 'hope' — экран концовки.
 * этап 9: aedel_angry. Ключ реплики achieve: 'id' — выдать достижение (список — ACHIEVEMENTS).
 * этап 8: void_seen, void_raise, game_locked (игра заблокирована, хранится и в pg2_meta). Ключи реплики: crack: true — экран
 *   трескается; lock: true — после диалога «Ошибка 888».
 * этап 7: hgate_seen, hknight_fight, helm_broken, aedel_beaten, gidan_gone, maze_caught, hate_first_clear (переживает новую игру),
 *   revenge_path.
 * прокачка (патч): xp, level, mana_points (очки маны — тратятся у Полианны). Маги: duel_light/duel_dark — идёт бой,
 *   mages_light_beaten, mages_dark_beaten. В бою: рывок Shift, у лука 6 стрел, у посоха мана (не флаги).
 * лабиринт (патч): madness_level (0–100), madness_active, gidan_taunt_count, maze_exit_seen (покои после лабиринта),
 *   room_dolita_visited, room_aedel_visited, room_gidan_visited, rooms_visited (0–3), labyrinth_exit_unlocked.
 * сумка и прокачка (патч): inv_<предмет> — сколько штук (ITEMS), potato_today — картошки за визит (сброс при входе на карту),
 *   skill_power / skill_agility / skill_spirit (0–3) — ступени дерева Полианны, polianna_met, darian_met,
 *   bless_blood, bless_mind, bless_feelings, bless_spirit — благословения (работают, только если temple_path не hate),
 *   curse_spirit, curse_blood, curse_mind, curse_feelings — проклятия пути Ненависти.
 *   Ключ реплики ui: 'shop' | 'skills' | 'bag' — после диалога открыть окно лавки / дерева / сумки.
 * этап E (патч): order_seen, order_ghosts_clear, dane_met, dane_fight, dane_defeated (+ bless_spirit).
 *   Ключи реплики: zoom: [x, y, k] — камера плавно (2 с) наезжает на клетку x,y в k раз, после диалога — обратно;
 *   fx: 'red' — красная вспышка и затемнение экрана (Долита пьёт).
 * этап F (патч): power_scene (hostage|deal|wedding|lumina|gidan|aedel|dolita — шаг кат-сцен Пути Власти),
 *   power_wedding, power_lumina_jailed, power_gidan_dead, power_aedel_executed, power_dolita_dead, ending_power,
 *   ending_forgiveness; inv_glove (Перчатка вызова), duel_ret (куда вернуться после вызова), duel_<id>_won — сколько раз побеждён.
 *   Условия: { lt: ['k', n] } — меньше n; { any: [условия] } — хотя бы одно; { not: {условие} } — отрицание условия.
 *   Ключ реплики duelEnd: true — после диалога вернуться с арены туда, откуда вызвал{|а}.
 * Особые ключи реплики: pickPath: true — выбрать ведущий путь по path_*; heal: true — полностью восстановить ОЗ;
 *   thief: true — воровка появляется рядом с героем; chase: true — после диалога начинается погоня.
 *   В set/add значение '$флаг' берётся из флага: add: { gold: '$bribe_cost' }.
 * {$флаг} — подставить значение флага, например {$bribe_cost}.
 */
window.CHARACTERS = {
  hero:        { name: '{name}', portrait: 'assets/portraits/hero_{g}.png' },
  lumina:      { name: 'Королева Люмина', portrait: 'assets/portraits/lumina.png' },
  dolita:      { name: 'Долита Тенебрис', portrait: 'assets/portraits/dolita.png' },
  stranger:    { name: 'Незнакомка', portrait: 'assets/portraits/stranger.png' },
  dark_knight: { name: 'Тёмный рыцарь', portrait: 'assets/portraits/dark_knight.png' },
  aedel:       { name: 'Аэдел Анима', portrait: 'assets/portraits/aedel.png' },
  gidan:       { name: 'Император Гидан', portrait: 'assets/portraits/gidan.png' },
  voice:       { name: '', portrait: '' },
  stone:       { name: 'Белый камень', portrait: '' },
  elder:       { name: 'Староста Борислав', portrait: 'assets/portraits/elder.png' },
  note:        { name: 'Записка', portrait: '' },
  captain:     { name: 'Капитан Варг', portrait: 'assets/portraits/captain.png' },
  guard:       { name: 'Стражник', portrait: '' },
  merchant:    { name: 'Торговец Пим', portrait: 'assets/portraits/merchant.png' },
  keeper:      { name: 'Хранительница Ирма', portrait: 'assets/portraits/keeper.png' },
  plaque:      { name: 'Табличка', portrait: '' },
  priest:      { name: 'Первосвященник Кассиан', portrait: 'assets/portraits/priest.png' },
  letter:      { name: 'Письмо', portrait: '' },
  citizen:     { name: 'Горожанин', portrait: '' },
  mage_light:  { name: 'Маг Света', portrait: '' },
  mage_dark:   { name: 'Маг Тьмы', portrait: '' },
  dane:        { name: 'Дэйн Филит', portrait: '' },
  stone_knight:{ name: 'Каменный рыцарь', portrait: '' },
  polianna:    { name: 'Полианна', portrait: 'assets/portraits/polianna.png' },
  darian:      { name: 'Дариан', portrait: 'assets/portraits/darian.png' },
  ambassador:  { name: 'Посол Люминоса', portrait: '' },
  coachman:    { name: 'Кучер', portrait: '' },
  thief:       { name: 'Воровка', portrait: '' },
  bandit:      { name: 'Разбойник', portrait: '' },
  patrol:      { name: 'Патрульный Люминоса', portrait: '' },
  cultist:     { name: 'Служитель Марии', portrait: '' },
  order_warrior: { name: 'Воин Ордена', portrait: '' },
  mirror:      { name: '{name}?', portrait: 'assets/portraits/hero_{g}.png' },   // Гидан с лицом героя
};


/*
 * СУМКА (I / Tab, кнопка в паузе). Предметы — флаги inv_<id> (сколько штук).
 *   heal — сколько ОЗ лечит, buff — бафф: { dmg | speed: доля, time: секунд }, price — цена у Дариан,
 *   limit — сколько за один визит (картошка), gift — подарок Долиты (пассивный, нельзя использовать).
 *   Сосуд жизни — отдельно: got_flask / has_water_flask.
 */
window.ITEMS = {
  flask:       { icon: '🧪', name: 'Сосуд жизни', gift: true,
                 desc: 'Подарок Д.Т. у ручья. Вода в нём красная. +50 ОЗ. В каждом бою наполняется сам — один раз. Клавиша Q.' },
  dagger:      { icon: '🗡️', name: 'Священный кинжал', gift: true,
                 desc: 'Освящён в храме Марии. В бою не нужен: просто лежит в сумке, и Первосвященник бьёт тебя на 40% слабее.' },
  ribbon:      { icon: '🎀', name: 'Красная лента', gift: true,
                 desc: 'Лента Долиты, зачарованная как броня. Весь урон по тебе −15%.' },
  bowl:        { icon: '🥣', name: 'Бездонная Пиала', gift: true,
                 desc: '«Пиала, которая не пустеет» — та самая, из её дневника. Любое лечение +25%.' },
  amulet:      { icon: '🩸', name: 'Кровавый амулет', gift: true,
                 desc: 'Тёплый, будто живой. Благословение Крови даёт +35% урона вместо +20%.' },
  glove:       { icon: '🥊', name: 'Перчатка вызова', duel: true,
                 desc: 'Подарок Полианны. Брось её — и любой, кого ты встречал{|а}, выйдет с тобой на арену. Опыт и мана, сюжет не меняется.' },
  potion_s:    { icon: '🍷', name: 'Малое зелье', heal: 20, price: 10, desc: '+20 ОЗ. Q пьёт его, если Сосуд пуст.' },
  potion_m:    { icon: '⚗️', name: 'Среднее зелье', heal: 40, price: 20, desc: '+40 ОЗ. Q пьёт его, если нет малых.' },
  pie:         { icon: '🥧', name: 'Пирожок с мясом', buff: { dmg: 0.2, time: 30 }, price: 15, desc: '+20% урона на 30 секунд.' },
  gingerbread: { icon: '🍪', name: 'Медовый пряник', buff: { speed: 0.2, time: 30 }, price: 15, desc: '+20% скорости на 30 секунд.' },
  potato:      { icon: '🥔', name: 'Печёная картошка', heal: 80, price: 40, limit: 2,
                 desc: '+80 ОЗ. Самое сильное лечение в игре. Дариан печёт не больше двух за визит.' },
};

// Лавка Дариан: что продаёт и её реплики в окне лавки
window.SHOP = {
  items: ['potion_s', 'potion_m', 'pie', 'gingerbread', 'potato'],
  title: 'Корзинка Дариан',
  hello: 'Картошечка? Только из печи. Такую нигде не найдёшь.',
  bought: ['Кушай на здоровье!', 'Голодный герой — мёртвый герой.', 'Печёная картошка — она и раны лечит, и душу греет.'],
  noGold: 'Ой, монеток не хватает. Ничего, заходи ещё.',
  noPotato: 'Картошка кончилась — печь одна, а ты не один. Приходи в другой раз.',
};

// Дерево способностей Полианны: 3 ветки по 3 ступени, флаги skill_<ветка> (0–3), цена ступени — очки маны
window.SKILLS = {
  title: 'Дерево способностей',
  cost: [1, 2, 3],
  noMana: 'Мана — не деньги. Её не сэкономишь… и не займёшь. Сходи к магам.',
  learned: ['Неплохо. …Зевать стало меньше хотеться.', 'Чувствуешь? Вот. Теперь не трать зря.', 'Ну всё. Иди. Мне надо поспать.'],
  branches: {
    power:   { icon: '⚔️', name: 'Сила', tiers: [
      { name: 'Тяжёлая рука', desc: '+15% урона любым оружием.' },
      { name: 'Злость в ударе', desc: 'Ещё +15% урона.' },
      { name: 'Пробой', desc: 'Стрелы и магия пробивают половину сопротивления боссов.' } ] },
    agility: { icon: '💨', name: 'Ловкость', tiers: [
      { name: 'Лёгкий шаг', desc: 'Перезарядка рывка −0.15 с.' },
      { name: 'Тень', desc: 'Неуязвимость при рывке 0.45 с вместо 0.3, скорость +10%.' },
      { name: 'Уворот', desc: '15% шанс увернуться от любого удара.' } ] },
    spirit:  { icon: '✨', name: 'Дух', tiers: [
      { name: 'Голос богов', desc: 'Благословения сильнее на 25%.' },
      { name: 'Глубокий вдох', desc: '+30 к запасу маны посоха и +2 стрелы в колчане.' },
      { name: 'Избранник', desc: 'Благословения сильнее в 1.5 раза (вместо 1.25).' } ] },
  },
};

// Благословения богов (флаги bless_*): работают только на путях Власти и Надежды
window.BLESSINGS = {
  blood:    { icon: '🩸', name: 'Благословение Крови', desc: '+20% урона. Дала Мария за подношение у алтаря храма.' },
  mind:     { icon: '🔮', name: 'Благословение Разума', desc: 'Мана посоха копится на 50% быстрее, каст на 30% короче. Дал Гилион.' },
  feelings: { icon: '💚', name: 'Благословение Чувств', desc: '+20 к максимуму ОЗ, лечение +30%. Дала Эола.' },
  spirit:   { icon: '❄️', name: 'Благословение Духа', desc: 'Скорость +10%, рывок перезаряжается быстрее. Даёт Диллад в Ордене Духа.' },
  off: 'Боги отвернулись: на пути Ненависти благословения молчат.',
};
// Проклятия (флаги curse_*): только путь Ненависти
window.CURSES = {
  spirit:   { icon: '🥶', name: 'Проклятие Духа', desc: 'Рывок перезаряжается на 0.3 с дольше. Последний взгляд Аэдела.' },
  blood:    { icon: '💔', name: 'Проклятие Крови', desc: '−15% урона. Кровь Аэдела на твоих руках тяжелеет.' },
  mind:     { icon: '🌀', name: 'Проклятие Разума', desc: 'Запас маны −40%. Голос Гидана так и не замолк.' },
  feelings: { icon: '🖤', name: 'Проклятие Чувств', desc: 'Лечение −30%. Ничто больше не радует.' },
};

// Подписи в бою (этап E)
window.FIGHT_TEXT = {
  dodge: 'Уворот!',
  doorsLocked: 'Двери заперты, пока идёт бой',
  ghostThrough: 'Призраки проходят сквозь стены — бей светом и магией',
};

// Индикатор пути в углу экрана: ведущий счётчик path_* (после храма — выбранный temple_path)
window.PATHS = {
  none:  { icon: '◌', name: 'Путь не выбран', color: '#9a8f80' },
  hope:  { icon: '☀', name: 'Надежда', color: '#ffd86a' },
  power: { icon: '♛', name: 'Власть', color: '#b07aff' },
  hate:  { icon: '✖', name: 'Ненависть', color: '#e0303a' },
};

/*
 * ПЕРЧАТКА ВЫЗОВА (этап F): вызвать на бой любого, кого встречал. Сюжет не меняется, за победу — опыт и +1 очко маны.
 *   if — кого уже встречал, ready — готов ли драться (иначе refuse), enemies — кто выходит на арену (kind, x, y в клетках арены).
 */
window.DUELS = {
  title: 'Перчатка вызова',
  hello: 'Брось перчатку — и тот, кого ты встречал{|а}, выйдет на арену. Сюжет не изменится.',
  won: 'Победа на арене! +1 ✦ маны',
  busy: 'Сейчас не до вызовов — сначала закончи то, что начал{|а}.',
  empty: 'Ты ещё ни с кем не встречал{|ась} в бою.',
  list: {
    wolves:  { icon: '🐺', name: 'Стая волков', if: { flag: 'wolves_dead' }, enemies: [['wolf', 5, 4], ['wolf', 10, 4], ['wolf', 7.5, 3]] },
    gate:    { icon: '🛡️', name: 'Капитан Варг и стража', if: { flag: 'gate_met' }, enemies: [['captain', 7.5, 3], ['guard', 5, 4], ['guard', 10, 4]] },
    mages_l: { icon: '☀', name: 'Маги Света', if: { flag: 'mages_light_beaten' }, enemies: [['mage_light', 4, 3], ['mage_light', 11, 3]] },
    mages_d: { icon: '🌑', name: 'Маги Тьмы', if: { flag: 'mages_dark_beaten' }, enemies: [['mage_dark', 4, 3], ['mage_dark', 11, 3]] },
    priest:  { icon: '🩸', name: 'Первосвященник Кассиан', if: { flag: 'temple_seen' }, enemies: [['priest', 7.5, 3]] },
    dolita:  { icon: '🎀', name: 'Долита Тенебрис', if: { any: [{ flag: 'organ_seen' }, { flag: 'capital_seen' }] }, enemies: [['dolita_boss', 7.5, 3]] },
    knight:  { icon: '⚔️', name: 'Тёмный рыцарь', if: { flag: 'knight_seen' }, enemies: [['knight_fire', 7.5, 3]] },
    dane:    { icon: '❄️', name: 'Дэйн Филит', if: { flag: 'dane_met' }, enemies: [['dane', 7.5, 3]] },
    aedel:   { icon: '🗡️', name: 'Аэдел Анима', if: { any: [{ flag: 'aedel_met' }, { flag: 'helm_broken' }, { flag: 'knight_stopped' }, { flag: 'power_scene' }] },
               ready: { any: [{ flag: 'aedel_beaten' }, { flag: 'ending_hope' }, { flag: 'ending_power' }] },
               refuse: '«Не сейчас. Мой меч — для другого боя». Аэдел примет вызов, когда ваша история с ним закончится.',
               enemies: [['aedel3', 7.5, 3]] },
    gidan:   { icon: '👑', name: 'Император Гидан', if: { flag: 'throne_seen' },
               ready: { any: [{ flag: 'ending_hope' }, { flag: 'ending_hate' }, { flag: 'ending_power' }, { flag: 'hate_first_clear' }] },
               refuse: '«Император не дерётся с гостями. Пока что». Гидан примет вызов только после одной из концовок.',
               enemies: [['gidan_duel', 7.5, 3]] },
  },
};

// Подписи окна сумки
window.BAG_TEXT = {
  title: 'Сумка', gold: 'Золото', mana: 'Очки маны', empty: 'В сумке пусто. Только крошки.',
  use: 'Использовать', gifts: 'Подарки Д.Т.', items: 'Припасы', bless: 'Благословения', curses: 'Проклятия',
  full: 'ОЗ и так полные', flaskEmpty: 'Сосуд пуст — наполнится в следующем бою или у ручья',
  close: 'Закрыть',
};

/*
 * МИНИ-ИГРЫ САДА (этап 6). Запуск — ключ mini в реплике или выборе: { text: '…', mini: 'stones' }.
 *   timing — нажать, когда стрелка в зелёной зоне: tries бросков, score [идеально, неплохо, мимо], need — сколько набрать.
 *   memory — повторить порядок цветов: rounds — длина цепочки в каждом круге, lives — сколько можно ошибиться + 1.
 *   catch  — поймать светлячков: count в саду, need поймать, time секунд, speed/dart — скорость (спокойно/испуг), shy — дистанция испуга.
 *   win / fail — ключ диалога по итогу.
 */
window.MINIGAMES = {
  stones:    { type: 'timing', title: 'Камушки по озеру', hint: 'Пробел / клик — бросок, когда белая стрелка в зелёной зоне',
               tries: 3, score: [5, 3, 1], need: 9, unit: 'Прыжков', win: 'stones_win', fail: 'mini_fail' },
  lantern:   { type: 'timing', lantern: true, title: 'Фонарики на воде', hint: 'Отпускай фонарик, когда стрелка в зелёной зоне — ветер стихнет',
               tries: 3, score: [3, 2, 0], need: 6, unit: 'Огоньков', win: 'lantern_win', fail: 'mini_fail' },
  wreath:    { type: 'memory', title: 'Венок', hint: 'Запомни порядок цветов и повтори: клавиши 1–4 или клик',
               rounds: [3, 4, 5], lives: 2, win: 'wreath_win', fail: 'mini_fail' },
  bouquet:   { type: 'memory', title: 'Букет для Долиты', hint: 'Запомни, какие цветы она назвала, и собери в том же порядке: 1–4 или клик',
               rounds: [3, 4, 5], lives: 2, win: 'bouquet_win', fail: 'mini_fail' },
  fireflies: { type: 'catch', title: 'Светлячки', count: 14, need: 10, time: 30, speed: 55, dart: 150, shy: 110,
               win: 'fireflies_win', fail: 'fireflies_fail' },
};

// ЛАБИРИНТ СОЗНАНИЯ (этап 7): шёпот, когда тает морок; фраза, когда Гидан ускользает; путаница управления.
// ПИСЬМА НА ВЕСЬ ЭКРАН (патч v2.5). Реплика { letter: 'id' } открывает письмо после диалога.
//   ink — чернила: gold | red | purple; sign — подпись; buttons — кнопки (как варианты ответа: set, add, d — следующий диалог);
//   без buttons — одна кнопка LETTER_CLOSE, после неё диалог close.
window.LETTER_CLOSE = 'Сложить письмо';
window.LETTERS = {
  lumina: {
    ink: 'gold',
    text: 'Здравствуй, {name}.\n\nЯ — Светлейшая Королева Люмина Гелиос, единственная правительница королевства Люминос.\n\nПриглашаю новоизбранного Героя Света в свой дворец.',
    buttons: [
      { text: 'Принять', set: { invited: true }, d: 'letter_accept' },
      { text: 'Нет', set: { intro_letter_refused: true }, d: 'letter_refuse' },
    ],
  },
  dt_note: { ink: 'red', text: 'Спасибо, что {разобрался|разобралась} с этими ужасными псами, вот тебе подарочек <3', sign: 'Д.Т.', close: 'note_1_after' },
  tree: {
    ink: 'purple',
    text: 'Прощай, Элли. Ты — лучшее, что случилось со мной в жизни. Я сохраню нашу дочь и нашу страну, обещаю.',
    sign: 'Г.Т.', close: 'tree_letter_after',
  },
};

// Горожане на площади Люминоса шепчутся (над головами по очереди)
window.CROWD_TEXT = {
  whispers: ['…это он?..', '…камень засветился…', '…шу-шу-шу…', '…Герой Света…', '…говорят, из деревни…', '…тише, посол смотрит…', '…а вдруг ошибка?..'],
};

window.HUNT_TEXT = {
  pit: 'пропасть',
  pitTaunt: '«Под ногами — тоже я.»',
  whispers: [
    '«Она называла тебя другом.»',
    '«Сколько раз ты {нажал|нажала} „атаковать“, не думая?»',
    '«Я — не я. И ты — не ты.»',
    '«Аэдел учил меня держать меч. Ты {научил|научила} его падать.»',
    '«Перезапусти. Всё равно ведь перезапустишь.»',
    '«Здесь нет врагов. Только отражения.»',
  ],
  slip: '«Не так быстро.»',
  confuse: 'Гидан путает твои мысли!',
  // издёвки Гидана: раз в 8–15 с, подряд не повторяются; зона — где стоит герой
  taunts: {
    any: [
      'Ты ведь уже {проходил|проходила} это, да? И в прошлый раз ты {выбрал|выбрала} иначе…',
      'Ты с нами играешь. А мы — играем в тебя. Смешно, да?',
    ],
    dolita: [                                      // у портрета Долиты
      'Смотри, как она улыбается на портрете. Ты ведь её {убил|убила}. Или убьёшь. Какая разница, правда?',
      'Она любила тебя. Нет, не тебя. Героя. А ты — просто Игрок.',
    ],
    empire: [                                      // у письма — кабинет в моей голове
      'Империя? Империя — это декорация. Ты сам её построил, сам и сжёг.',
      'Мой трон пуст. Садись. Ах да — ты же не умеешь сидеть. Только нажимать.',
    ],
    fate: [                                        // в тупике
      'Судьба? Судьба — это то, что ты перематываешь, когда проигрываешь.',
      'Тупик. Как в прошлый раз. И в позапрошлый.',
    ],
  },
  laugh: 'Ха-ха-ха-ха!',
  block: 'Гидан закрывает проход!',
  unblock: 'Проход открылся.',
  stun: '«Не умирай раньше времени. Мне ещё скучно.» Ха-ха-ха!',
  // якоря возвращают рассудок
  anchors: {
    portrait: 'Портрет Долиты. Она улыбается — по-настоящему. Мысли проясняются.',
    mirror: 'Зеркало. В нём — ты, и только ты. Голова светлеет.',
    letter: 'Письмо, написанное не Гиданом. Настоящие слова. Рассудок возвращается.',
    ribbon: 'Чёрная лента Долиты. Шёлк холодный и настоящий. Безумие отступает.',
  },
  anchorTired: 'Якорь ещё не набрался сил.',
};

// ПОКОИ ПОСЛЕ ЛАБИРИНТА: подсказки, если герой бродит без толку
window.ROOMS_TEXT = {
  lost: '«Заблудился? Комнаты моего дворца всё ещё там. Ищи.»',
  markers: 'Гидан смеётся — и в покоях вспыхивают метки.',
  open: 'Дверь в конце коридора открылась.',
  names: { dolita: 'Комната Долиты', aedel: 'Комната Аэдела', gidan: 'Кабинет Гидана' },
};

// «ОШИБКА 888» (этап 8). steps — подписи под полосой переустановки.
window.LOCK_SCREEN = {
  head: 'Путь Героя',
  title: 'Ошибка номер 888 "Расплата".',
  text: 'К сожалению, вы больше не сможете запустить игру.',
  code: '0x00000378 · RETRIBUTION · process terminated by: Gidan, Dolita, Aedel',
  button: 'Переустановить игру',
  steps: ['Удаление сохранений…', 'Удаление воспоминаний…', 'Распаковка Люминоса…', 'Распаковка Нокта…', 'Установка… готово'],
};

// ДОСТИЖЕНИЯ (этап 9). Хранятся в памяти между прохождениями (pg2_meta), стираются только переустановкой.
//   when — условие по флагам, проверяется при каждом сохранении; или реплика с achieve: 'id'.
//   hidden: true — пока не получено, название и описание скрыты.
window.ACHIEVEMENTS = {
  ice_crack:   { icon: '🧊', title: 'Трещина во льду', desc: 'Вы заставили лёд треснуть, но бойтесь, ведь из трещины неудержимым потоком польётся ледяная вода.' },
  wolf_hunter: { icon: '🐺', title: 'Гроза волков', desc: 'Очистить Живительный ручей от волков.', when: { flag: 'wolves_dead' } },
  clean_hands: { icon: '🕊', title: 'Чистые руки', desc: 'Пройти северные ворота Нокта, никого не ранив.', when: [{ flag: 'gate_passed' }, { not: 'gate_fight' }] },
  quick_feet:  { icon: '👟', title: 'Не ради денег', desc: 'Заступиться за воровку в Берте.', when: { flag: 'thief_saved' } },
  pack_leader: { icon: '🩸', title: 'Вожак повержен', desc: 'Одолеть Вожака Стаи у Живительного ручья.', when: { flag: 'wolves_dead' } },
  old_letters: { icon: '💜', title: 'Чужие письма', desc: 'Прочитать письмо из дупла Древа Чувств.', when: { flag: 'tree_letter_read' } },
  warm_ice:    { icon: '❄️', title: 'Тёплый лёд', desc: 'Пощадить главу Ордена Диллада.', when: { flag: 'dane_spared' } },
  mary_seal:   { icon: '🩸', title: 'Кровь не водица', desc: 'Получить печать Марии от Первосвященника.', when: { flag: 'mary_seal' } },
  organ:       { icon: '🎹', title: 'Тишина в органном зале', desc: 'Разрушить меха органа Кровавой Марии.', when: { flag: 'organ_broken' } },
  mercy:       { icon: '🌹', title: 'Милосердие', desc: 'Оставить Долиту в живых.', when: { flag: 'dolita_spared' } },
  no_mercy:    { icon: '🗡', title: 'Ни капли жалости', desc: 'Добить Долиту в органном зале.', when: { flag: 'dolita_dead' }, hidden: true },
  she_knows:   { icon: '👁', title: 'Она помнит', desc: 'Вернуться к Долите после плохого прохождения.', when: { flag: 'dolita_knows' }, hidden: true },
  moon_salt:   { icon: '🌙', title: 'Лунная соль', desc: 'Развлечь Долиту в Лунном саду и узнать пароль.', when: { flag: 'palace_password' } },
  end_hope:    { icon: '👑', title: 'Путь Надежды', desc: 'Стать правителем Люминоса и погулять на свадьбе.', when: { flag: 'ending_hope' } },
  end_hate:    { icon: '🪞', title: 'Путь Ненависти', desc: 'Поймать Гидана в лабиринте его сознания.', when: { flag: 'ending_hate' }, hidden: true },
};

// ЭКРАНЫ КОНЦОВОК. Запуск — ключ ending в реплике: { …, ending: 'hope' }
window.ENDINGS = {
  hope: {
    title: 'Путь Надежды',
    bg: 'end_hope',
    npcs: [{ sprite: 'hero' }, { sprite: 'dolita' }, { sprite: 'aedel' }, { sprite: 'gidan' }, { sprite: 'elder' }, { sprite: 'keeper' }],
    text: '{name} — {король|королева} Люминоса. Впервые за сто лет Свет и Тьма сели за один стол, и никто не принёс к нему меча.\n\nКонец Пути Надежды. Но это не единственный путь…',
  },
  power: {
    title: 'Ты удовлетворён?',
    bg: 'end_power',
    npcs: [{ sprite: 'nokt_guard' }, { sprite: 'hero' }, { sprite: 'dark_knight' }],
    text: '{name} правит Ноктом и Люминосом. Трон тёплый. Дворец пуст.\n\nКонец Пути Власти.',
  },
  // Прощение: экран гаснет, зелёные буквы, без титров (style: 'green')
  forgiveness: { title: 'Ты сдался?', text: '', style: 'green' },
  hate: {
    title: 'Путь Ненависти',
    bg: 'end_hate',
    npcs: [{ sprite: 'hero' }],
    text: 'Нокт остался без императора, без рыцаря и без смеха в Лунном саду. {name} возвращается в Люминос и не может вспомнить, зачем {пришёл|пришла}.\n\nКонец Пути Ненависти. Но тот, кто по ту сторону стекла, уже знает, что ты вернёшься…',
  },
};

window.DIALOGUES = {
  // ============================================================ ЭТАП 1. Пролог — Люминос

  // Первый вход на площадь
  intro: [
    { who: 'voice', text: 'Люминос. Королевство Света.' },
    { who: 'voice', text: 'Белые башни, звон колоколов, запах тёплого хлеба. Здесь никто не помнит, когда в последний раз было тихо на границе.' },
    { who: 'voice', text: 'В центре площади — белый камень истины. Вокруг толпа: все ждут, кого он выберет. Руны мерцают — будто зовут именно тебя.', set: { intro_seen: true } },
  ],

  // Белый камень
  stone_touch: [
    { who: 'voice', text: 'Ты {коснулся|коснулась} камня истины. Руны вспыхивают так ярко, что мир становится белым.', fx: 'flash' },
    { who: 'stone', text: 'Свет выбрал. {Герой|Героиня} Света — {name}.', set: { stone_chosen: true } },
    { who: 'voice', text: 'Толпа ахает и тут же переходит на шёпот. От ворот дворца к камню идёт человек в белом с золотом.' },
    { who: 'ambassador', text: 'Посол её величества. Позвольте вручить вам письмо — лично в руки.', letter: 'lumina' },
  ],
  stone_later: [
    { who: 'voice', text: 'Свет гаснет, но руны продолжают мерцать. Камень подождёт. Недолго.' },
  ],
  stone_silent: [
    { who: 'voice', text: 'Камень тёплый и молчит. Своё он уже сказал.' },
  ],

  // Ворота на юг — закрыты, пока не поговоришь с королевой
  square_locked: [
    { who: 'voice', text: 'Ворота закрыты. Стража не выпускает никого без воли королевы.' },
  ],

  // Тронный зал: разговор с королевой
  queen_intro: [
    { who: 'lumina', text: 'Так вот кого привёл ко мне камень. Подойди. Не бойся — я не кусаюсь… пока.' },
    { who: 'lumina', text: 'Когда-то магия была едина. Потом она раскололась — на Свет и Тьму. И маги, что были братьями, взялись за мечи.' },
    { who: 'lumina', text: 'Так родились два государства. Наш Люминос — королевство Света. И империя Нокт — их проклятая Тьма за северными горами.' },
    { who: 'lumina', text: 'Война длится дольше, чем живут люди. Но в пророчестве сказано: однажды родится воин, который вберёт в себя всю магию — и Свет, и Тьму.' },
    { who: 'lumina', text: 'Камень не ошибается. Он выбрал тебя, {name}.' },
    { who: 'lumina', text: 'Ты станешь этим Героем?', choices: [
      { text: 'Да', next: 'queen_yes' },
      { text: 'Нет', set: { reluctant_hero: true }, next: 'queen_press_1' },
    ] },
  ],

  // «Нет» — королева давит
  queen_press_1: [
    { who: 'lumina', text: 'Нет? Как… интересно.' },
    { who: 'lumina', text: 'Ты думаешь, у тебя есть выбор? Пока ты {стоял|стояла} на площади, на границе сгорела ещё одна деревня.' },
    { who: 'lumina', text: 'Спрошу ещё раз. Ты станешь Героем?', choices: [
      { text: '…Хорошо. Я {согласен|согласна}.', next: 'queen_yes_reluctant' },
      { text: 'Нет. Это не моя война.', next: 'queen_press_2' },
    ] },
  ],
  queen_press_2: [
    { who: 'lumina', text: 'Не твоя? Камень светится для тебя. Пророчество написано о тебе. Нокт уже знает твоё имя.' },
    { who: 'lumina', text: 'Ты можешь отказаться. А потом смотреть, как Тьма приходит в каждый дом, где тебя когда-то кормили.' },
    { who: 'lumina', text: 'Итак?', choices: [
      { text: '…Я стану Героем.', next: 'queen_yes_reluctant' },
    ] },
  ],

  queen_yes: [
    { who: 'hero', text: 'Да. Я стану Героем.' },
    { who: 'lumina', text: 'Без колебаний. Мне это нравится. Из таких получаются отличные… герои.' },
    { who: 'lumina', text: 'А теперь — главное.', next: 'queen_element' },
  ],
  queen_yes_reluctant: [
    { who: 'lumina', text: 'Вот видишь. Не так уж и сложно было сказать «да».' },
    { who: 'lumina', text: 'Я запомню, что ты {колебался|колебалась}. Не заставляй меня пожалеть о своём выборе.' },
    { who: 'lumina', text: 'А теперь — главное.', next: 'queen_element' },
  ],

  // Выбор стихии Светлой магии
  queen_element: [
    { who: 'lumina', text: 'Свет живёт в тебе, но он ещё спит. Закрой глаза. Какая из его стихий откликается первой?', choices: [
      { text: '🔥 Солнечное пламя — жар и ярость', set: { light_element: 'sun' }, next: 'queen_elem_sun' },
      { text: '⚡ Небесная молния — скорость и гроза', set: { light_element: 'storm' }, next: 'queen_elem_storm' },
      { text: '✨ Святое сияние — защита и исцеление', set: { light_element: 'radiance' }, next: 'queen_elem_radiance' },
    ] },
  ],
  queen_elem_sun: [
    { who: 'voice', text: 'Ладони обжигает жаром. Твоё оружие на миг вспыхивает золотым огнём.', toast: '🔥 Солнечное пламя: удары поджигают врагов (+1 к урону)' },
    { who: 'lumina', text: 'Пламя. Конечно. Только не сожги себя раньше, чем врагов.', next: 'queen_farewell' },
  ],
  queen_elem_storm: [
    { who: 'voice', text: 'По коже пробегают искры. Воздух вокруг тебя тихо гудит.', toast: '⚡ Небесная молния: оружие бьёт быстрее (−25% перезарядки)' },
    { who: 'lumina', text: 'Молния. Быстро бьёт и никогда не бьёт дважды в одно место. Посмотрим, так ли это.', next: 'queen_farewell' },
  ],
  queen_elem_radiance: [
    { who: 'voice', text: 'Тебя окутывает мягкий тёплый свет. Усталость уходит, как будто её и не было.', toast: '✨ Святое сияние: +25 к максимуму ОЗ и медленное лечение' },
    { who: 'lumina', text: 'Сияние. Свет, который лечит… Как трогательно. Надеюсь, ты умеешь им и бить.', next: 'queen_farewell' },
  ],

  queen_farewell: [
    { who: 'lumina', text: 'Во дворе ждёт повозка — она отвезёт тебя в деревню у Живительного ручья. Там твой путь начнётся по-настоящему.' },
    { if: { flag: 'reluctant_hero' }, who: 'lumina', text: 'И помни: я слежу за тобой, {name}. Даже когда тебе кажется, что ты {один|одна}.' },
    { if: { not: 'reluctant_hero' }, who: 'lumina', text: 'Люминос верит в тебя, {name}. Не подведи меня.' },
    { who: 'voice', text: 'Королева отворачивается. Аудиенция окончена. Слуги провожают тебя во двор дворца.', set: { prologue_done: true }, scene: 'royal_palace', at: [8, 5], dir: 'down' },
  ],

  queen_after: [
    { who: 'lumina', text: 'Ты всё ещё здесь? Повозка ждёт во дворе. Деревня у Живительного ручья сама себя не спасёт.' },
  ],

  // ============================================================ ЭТАП 2. Деревня у Живительного ручья

  village_intro: [
    { who: 'voice', text: 'Повозка останавливается на краю долины. Соломенные крыши, дым из труб, запах сена.' },
    { who: 'voice', text: 'Только тихо здесь как-то слишком. Ставни закрыты, детей на улице не видно.', set: { village_seen: true } },
  ],
  village_sign: [
    { who: 'voice', text: 'Крестьянин машет рукой: «На восток — лес и ручей. На север — горы и Северные врата. Чужакам у нас рады, волкам — нет».' },
  ],
  north_locked: [
    { who: 'voice', text: 'Тропа на север уходит в горы. Староста просил сначала помочь деревне — да и без припасов туда соваться глупо.' },
  ],

  // Староста
  elder_quest: [
    { who: 'elder', text: 'Ох… Неужто из самого Люминоса? Камень, говорят, Героя выбрал. Это ты, что ли?' },
    { who: 'hero', text: 'Я. Королева велела начать с вашей деревни.' },
    { who: 'elder', text: 'Вовремя, ох вовремя. В восточном лесу завелась стая тёмных волков. Глаза красные, шерсть — как дым. А у ручья — их вожак.' },
    { who: 'elder', text: 'Из ручья вся деревня воду берёт. Вода там целебная — раны затягивает. А теперь к нему и подойти страшно.' },
    { who: 'elder', text: 'Прогони их, а? Мы в долгу не останемся.', choices: [
      { text: 'Я разберусь с волками.', set: { wolf_quest: true }, next: 'elder_quest_yes' },
      { text: 'Мне сейчас не до волков.', next: 'elder_later' },
    ] },
  ],
  elder_quest_yes: [
    { who: 'elder', text: 'Спасибо, {сынок|дочка}! Лес — по дороге на восток, ручей — за ним.' },
    { who: 'elder', text: 'И слушай старика: волк перед прыжком приседает. Увидишь — отходи в сторону, а потом бей.', toast: 'Задание: прогнать волков из леса и вожака у ручья (на восток)' },
  ],
  elder_later: [
    { who: 'elder', text: 'Не до волков… Ну да, у героев дела поважнее. А у нас дети воды неделю не пили.' },
    { who: 'elder', text: 'Передумаешь — я тут.' },
  ],
  elder_wait: [
    { who: 'elder', text: 'Волки всё ещё в лесу. Это на восток по дороге. Береги себя — нам мёртвый герой ни к чему.' },
  ],
  elder_done: [
    { if: { flag: 'wolf_quest' }, who: 'elder', text: 'Тихо у ручья… Неужто правда? Ты их прогнал{|а}!' },
    { if: { not: 'wolf_quest' }, who: 'elder', text: 'Мужики говорят, у ручья волков больше нет. Я тебя ни о чём и попросить не успел, а ты уже…' },
    { who: 'elder', text: 'Держи. Немного, но от всей деревни.', add: { gold: 30 }, set: { elder_rewarded: true }, toast: '💰 +30 золота' },
    { who: 'elder', text: 'Дальше твой путь на север, через горы к Северным вратам Нокта. Наши туда не ходят. Говорят, стража там злая, а за стеной — сплошная Тьма.' },
    { who: 'elder', text: 'Тропа на север — за домами, в горы. Берегись разбойников на перевале. И да хранит тебя Свет.', toast: 'Путь на север открыт' },
  ],
  elder_after: [
    { who: 'elder', text: 'Северная тропа — за домами, в горы. А если ранен{|а} — сходи к ручью, вода там лечит.' },
  ],

  // Ручей
  stream_wolves: [
    { who: 'voice', text: 'Над ручьём стелется красноватый туман. На камне у воды стоит волк — вдвое больше остальных, шерсть цвета запёкшейся крови.', set: { stream_seen: true } },
    { who: 'voice', text: 'Вожак Стаи. Он тебя ждал.', toast: 'Босс: Вожак Стаи' },
  ],
  wolves_cleared: [
    { who: 'voice', text: 'Последний волк рассыпается чёрным дымом. Туман над ручьём тает.' },
    { who: 'voice', text: 'У самой воды, под плоским камнем, что-то белеет.' },
  ],
  note_1: [
    { who: 'voice', text: 'Под камнем — сложенная записка. Её прижимает пустой хрустальный сосуд с пробкой.', letter: 'dt_note' },
  ],
  spring_fill: [
    { who: 'voice', text: 'Ты {опустил|опустила} сосуд в Живительный ручей. Вода в нём краснеет, как вино, и светится изнутри.' },
    { who: 'voice', text: 'Пара глотков прямо из ладоней — и раны затягиваются.', heal: true, set: { has_water_flask: true }, toast: '🧪 Сосуд жизни полон: +50 ОЗ (клавиша Q). В бою наполняется сам — раз за бой' },
  ],
  spring_full: [
    { who: 'voice', text: 'Сосуд и так полон. Ты {сделал|сделала} пару глотков прямо из ручья — раны затягиваются.', heal: true },
  ],
  spring_drink: [
    { who: 'voice', text: 'Вода ледяная и чуть светится. Пара глотков — и раны затягиваются. Жаль, набрать её не во что.', heal: true },
  ],

  // Герой пал в бою
  hero_down: [
    { who: 'voice', text: 'Темнота… Чьи-то руки тащат тебя по траве.' },
    { who: 'elder', text: 'Живой! Тебя мужики у дороги подобрали. Отлежал{ся|ась}?' },
    { who: 'elder', text: 'Не лезь к волкам напролом. Присел — значит, сейчас прыгнет. Отойди и бей сбоку.' },
  ],

  // ============================================================ ЭТАП 3. Северные врата Нокт

  gate_intro: [
    { who: 'voice', text: 'Тропа поднимается в горы. Воздух холодеет, трава сменяется камнем.', set: { gate_seen: true } },
    { who: 'voice', text: 'Впереди — чёрная стена с фиолетовыми прожилками. Северные врата Нокта. У решётки — стража, а наверху, на стене, — фигура в тёмных доспехах.' },
  ],

  hero_down_gate: [
    { who: 'voice', text: 'Удар древком — и мир гаснет. Ты {очнулся|очнулась} внизу, на тропе.' },
    { who: 'voice', text: 'Сверху доносится хохот стражи. Они ждут.' },
  ],

  // Капитан стражи
  captain_intro: [
    { who: 'captain', text: 'Стой. Ещё шаг — и на тебе будет больше дыр, чем в старом сыре.', set: { gate_met: true } },
    { who: 'captain', text: 'Золотые волосы, светлые латы… Из Люминоса. Светлым в Нокт дороги нет.' },
    { who: 'hero', text: 'Мне нужно пройти.' },
    { who: 'captain', text: 'Всем нужно. Правда, некоторым нужнее. Скажем… тридцать золотых нужнее.', set: { bribe_cost: 30 } },
    { who: 'captain', text: 'Ну? Чего стоишь?', next: 'captain_choices' },
  ],
  captain_again: [
    { who: 'captain', text: 'Опять ты. Надумал{|а}?', next: 'captain_choices' },
  ],
  captain_choices: [
    { who: 'captain', text: 'Решай, светл{ый|ая}.', choices: [
      { text: '⚔ Прорваться силой', next: 'captain_fight' },
      { text: '💰 Заплатить {$bribe_cost} золотых', if: { gte: ['gold', 30] }, next: 'captain_bribe' },
      { text: '🕊 Попробовать договориться', next: 'captain_talk1' },
      { text: 'Уйти', next: 'captain_leave' },
    ] },
  ],
  captain_leave: [
    { who: 'captain', text: 'Вот и правильно. Горы большие — найдёшь, где замёрзнуть.' },
  ],

  // Путь Ненависти: бой
  captain_fight: [
    { who: 'hero', text: 'Я пройду. С вашего разрешения или без.' },
    { who: 'captain', text: 'Ха! Светлая мразь показала зубы. Парни — взять {его|её}!', set: { gate_fight: true }, toast: 'Бой: капитан и трое стражников' },
  ],
  gate_cleared: [
    { who: 'voice', text: 'Тишина. Только ветер свистит в решётке. Капитан лежит лицом в камни.' },
    { who: 'voice', text: 'Ворота со скрипом поддаются. Путь в Нокт открыт.', toast: 'Северные врата открыты' },
  ],

  // Путь Власти: подкуп
  captain_bribe: [
    { who: 'hero', text: 'Держи. {$bribe_cost} золотых.' },
    { who: 'captain', text: 'Тяжёленький кошель. Люблю, когда светлые понимают, как устроен мир.', add: { gold: -30, path_power: 1 } },
    { who: 'captain', text: 'Открыть ворота! У нас… дипломатическая миссия.', set: { gate_bribed: true, gate_passed: true, north_gate_open: true }, toast: '💰 −{$bribe_cost} золота. Ворота открыты' },
  ],
  captain_after_power: [
    { who: 'captain', text: 'Ты меня не видел{|а}, я тебя не видел. Проходи, пока я добрый.' },
  ],

  // Путь Надежды: уговорить
  captain_talk1: [
    { who: 'captain', text: 'Договориться? Ну, попробуй. Зачем светлому в Нокт?', choices: [
      { text: 'Королева велела разведать ваши земли.', next: 'captain_talk_fail' },
      { text: 'Я хочу понять, почему магия раскололась. Я иду не воевать.', next: 'captain_talk2' },
      { text: 'Не твоё дело.', next: 'captain_talk_fail' },
    ] },
  ],
  captain_talk2: [
    { who: 'captain', text: '…Не воевать. Красиво. А мне с того что? Пропущу тебя — меня самого повесят.', choices: [
      { text: 'Сколько лет ты не видел дом? Эта война кончится, только если кто-то начнёт говорить.', next: 'captain_talk_ok' },
      { text: 'Скажешь, что я {проскочил|проскочила}. Кто проверит?', next: 'captain_talk_fail' },
      { text: 'Тогда придётся пройти по вашим телам.', next: 'captain_fight' },
    ] },
  ],
  captain_talk_fail: [
    { who: 'captain', text: 'Так я и думал. Ещё раз начнёшь сказки рассказывать — пожалеешь.', next: 'captain_choices' },
  ],
  captain_talk_ok: [
    { who: 'captain', text: '…Девять лет. Дочке было три, когда я ушёл на эту стену.' },
    { who: 'captain', text: 'Ладно, светл{ый|ая}. Иди. Но если ты соврал{|а} — я тебя сам найду.', add: { path_hope: 1 } },
    { who: 'captain', text: 'Открыть ворота!', set: { gate_persuaded: true, gate_passed: true, north_gate_open: true }, toast: 'Ворота открыты' },
  ],
  captain_after_hope: [
    { who: 'captain', text: 'Иди уже. И… если встретишь в Нокте тех, кто хочет мира, — скажи, что на стене их тоже ждут.' },
  ],

  // Записка Д.Т. №2 и красный бриллиант
  note_2: [
    { who: 'voice', text: 'Сразу за воротами, на плоском камне — записка. Её прижимает что-то алое и блестящее.' },
    { if: { flag: 'gate_bribed' }, who: 'note', text: '«Купить можно почти всё, правда? Не трать всё сразу — вот, возвращаю должок <3»\n\n— Д.Т.' },
    { if: { flag: 'gate_persuaded' }, who: 'note', text: '«Ты умеешь говорить с людьми. Редкость в наших краях. Держи на дорогу <3»\n\n— Д.Т.' },
    { who: 'hero', text: 'Опять Д.Т. Этот кто-то идёт за мной от самого ручья?' },
    { who: 'voice', text: 'Под запиской — красный бриллиант размером с ноготь. Внутри будто медленно переливается кровь.',
      set: { note_2_taken: true, red_diamond: true }, toast: 'Получено: красный бриллиант (торговец даст за него {$bribe_cost} золотых)' },
    { who: 'voice', text: 'Рядом, завёрнутый в красный платок, — узкий кинжал. На рукояти выцарапано: «От Кассиана. Пригодится».',
      set: { inv_dagger: 1 }, toast: 'Получено: Священный кинжал (Первосвященник бьёт на 40% слабее)' },
  ],

  // ============================================================ ЭТАП 4. Торговый город

  city_intro: [
    { who: 'voice', text: 'Дорога спускается в долину. Берт — торговый город Нокта: чёрный камень, фиолетовая черепица, огни в окнах.', set: { city_seen: true } },
    { who: 'voice', text: 'Ты ждал{|а} мрака и ужаса. А тут пахнет жареными каштанами, и торговцы спорят о ценах на перец.' },
  ],

  // Кража
  theft: [
    { who: 'thief', text: 'Ой! Простите-простите, я такая неуклюжая!' },
    { who: 'voice', text: 'Девчонка в лохмотьях врезается в тебя плечом. Серые глаза, спутанные каштановые волосы — и пальцы быстрее твоих мыслей.' },
    { if: { gte: ['gold', 1] }, who: 'voice', text: 'Рука сама тянется к поясу. Кошеля нет! А в нём было {$gold} золотых!', set: { stolen_gold: '$gold' } },
    { if: { not: 'gold' }, who: 'voice', text: 'Рука сама тянется к поясу. Кошеля нет! Пустого, правда… но это всё равно твой кошель!', set: { stolen_gold: 0 } },
    { who: 'hero', text: 'Эй! Стой! Воровка!', set: { gold: 0, theft_run: true }, toast: 'Воровка удирает направо — за ней!' },
  ],
  thief_caught: [
    { who: 'voice', text: 'Ты хватаешь её за край плаща. Она оборачивается — и смеётся.' },
    { who: 'stranger', text: 'Ах! Поймал{|а}… Быстр{ый|ая}. Мне нравится.' },
    { who: 'stranger', text: 'Но кошель я тебе не отдам. Поиграем ещё? Ищи меня там, где молятся крови.' },
    { who: 'voice', text: 'Хлопок, облако красного дыма — и её нет. Пахнет железом… и розами.',
      set: { thief_caught: true, thief_escaped: true, theft_done: true }, toast: 'Воровка скрылась на востоке — в сторону храма' },
  ],
  thief_escaped: [
    { who: 'voice', text: 'Незнакомка ныряет в переулок на востоке и растворяется в толпе. Тебе остаётся только её смех.' },
    { who: 'hero', text: 'Проклятье… Куда ведёт эта улица?' },
    { who: 'voice', text: 'Над переулком — указатель с алой каплей: «К Храму Кровавой Марии».',
      set: { thief_escaped: true, theft_done: true }, toast: 'Воровка скрылась на востоке — в сторону храма' },
  ],

  city_east_locked: [
    { who: 'voice', text: 'Переулок на восток уходит к храмам. Сначала стоит осмотреться в городе.' },
  ],
  // ---------- Орден Духа (этап E): западный переулок Берта, параллельно храму
  order_locked: [
    { who: 'voice', text: 'Западный переулок затянут инеем. Сначала стоит осмотреться в городе.' },
  ],
  order_intro: [
    { who: 'voice', text: 'Орден Диллада. Длинная галерея, на стенах — фрески: лёд, звёзды и рыцарь, который ждёт весну.', set: { order_seen: true } },
    { who: 'voice', text: 'Воины в доспехах с голубыми вставками стоят вдоль стен. Смотрят, но не мешают.' },
  ],
  order_ghosts_clear: [
    { who: 'voice', text: 'Последний призрак рассыпается инеем. В глубине зала кто-то медленно хлопает.' },
    { who: 'dane', text: 'Неплохо для живого. Подойди. Я не кусаюсь… уже лет двести.' },
  ],
  dane: [
    { if: { not: 'dane_met' }, who: 'dane', text: 'Дэйн Филит, глава Ордена Диллада. Был. Есть. Буду — как повезёт.', set: { dane_met: true } },
    { if: { eq: ['temple_path', 'hate'] }, who: 'dane', text: 'От тебя пахнет горячей кровью. Диллад не любит горячее. Но лёд не выбирает, кого испытывать.' },
    { if: { not: { eq: ['temple_path', 'hate'] } }, who: 'dane', text: 'Ищешь благословение Диллада? Его не просят. Его выдерживают.' },
    { who: 'dane', text: 'Выдержишь меня — Диллад даст тебе лёгкий шаг и холодную голову. Ну?', choices: [
      { text: 'Сразиться.', next: 'dane_go' },
      { text: 'Позже.', next: 'dane_later' },
    ] },
  ],
  dane_go: [
    { who: 'dane', text: 'Не верь глазам. Я там, где холоднее.', set: { dane_fight: true }, toast: 'Босс: Дэйн Филит. Копии, телепорт, волны духа' },
  ],
  dane_later: [{ who: 'dane', text: 'Лёд подождёт. Он умеет.' }],
  dane_beaten: [
    { who: 'voice', text: 'Копии тают одна за другой. Дэйн опускается на колено, и иней на его плаще светится голубым.' },
    { who: 'dane', text: 'Хм. Весна всё-таки бывает.' },
    { who: 'voice', text: 'Холод проходит сквозь тебя — и не обжигает. Шаг становится лёгким, мысли — ясными.', fx: 'flash',
      set: { bless_spirit: true }, toast: '❄️ Благословение Духа: скорость +10%, рывок быстрее' },
    { if: { eq: ['temple_path', 'hate'] }, who: 'dane', text: 'Только знай: на том пути, по которому ты идёшь, боги замолкают. Даже Диллад.' },
  ],
  dane_after: [{ who: 'dane', text: 'Иди. Лёд запомнил тебя. Это больше, чем кажется.' }],
  hero_down_order: [{ who: 'dane', text: 'Встань. Мёртвые тут и так в избытке.' }],


  // Хранительница — лор четырёх богов
  keeper: [
    { who: 'keeper', text: 'Светлое дитя у статуй Нокта… Давно я такого не видела. Не бойся, я не кусаюсь. В отличие от некоторых наших богов.' },
    { who: 'keeper', text: 'В Люминосе говорят: «У Тьмы нет лица». Глупости. У Тьмы их четыре.', choices: [
      { text: 'Расскажи о них.', next: 'keeper_gods' },
      { text: 'Мне некогда.', next: 'keeper_bye' },
    ] },
  ],
  keeper_gods: [
    { who: 'keeper', text: 'Гилион — Разум. Его свет фиолетовый, как сумерки. Он дарит ясность… и холод. Его чтут учёные и императоры.' },
    { who: 'keeper', text: 'Мария — Кровь. Жизнь, родство, жертва. Её храм на востоке. Её служители умеют лечить — и умеют брать плату.' },
    { who: 'keeper', text: 'Эола — Чувства. Зелёная, как молодая листва. Любовь, страх, радость — всё её. Самая добрая и самая опасная.' },
    { who: 'keeper', text: 'Диллад — Дух. Голубой, как лёд на горных озёрах. Он хранит тех, кто не сдаётся. И тех, кто уже не может вернуться.' },
    { who: 'keeper', text: 'Тьма — не зло, дитя. Это просто другая половина той же магии. Как ночь — половина суток.', set: { lore_gods: true }, toast: 'Лор: четыре бога Нокта' },
  ],
  keeper_bye: [
    { who: 'keeper', text: 'Все торопятся. А потом жалеют, что не слушали стариков.' },
  ],
  keeper_after: [
    { if: { flag: 'thief_saved' }, who: 'keeper', text: 'Слышала, ты {заступился|заступилась} за ту девчонку. В Берте так не делают. Может, зря.' },
    { if: { not: 'thief_saved' }, who: 'keeper', text: 'Обокрали? В Берте и не такое бывает. Хорошо хоть кошель вернулся.' },
    { who: 'keeper', text: 'Через арку наверху — ворота на Демин, город двух богов. Будь осторож{ен|на} в Храме Крови.', choices: [
      { text: 'Расскажи о богах Нокта.', next: 'keeper_gods' },
      { text: 'Спасибо, я пойду.' },
    ] },
  ],

  // Статуи
  statue_gilion: [
    { who: 'voice', text: 'Гилион, бог Разума. Говорят, кто видит ясно, тот не боится темноты. У основания статуи мерцает фиолетовый камень.' },
    { if: { not: 'bless_mind' }, who: 'voice', text: 'В каменной чаше у ног Гилиона — монеты. Говорят, за подношение он проясняет мысли.', choices: [
      { text: 'Помолиться Гилиону (10 💰)', if: { gte: ['gold', 10] }, add: { gold: -10 }, next: 'bless_mind_get' },
      { text: 'Не сейчас.' },
    ] },
  ],
  bless_mind_get: [
    { who: 'voice', text: 'Камень вспыхивает фиолетовым. В голове становится тихо и ясно, будто кто-то открыл окно.', fx: 'flash',
      set: { bless_mind: true }, toast: '🔮 Благословение Разума: мана быстрее, каст короче' },
  ],
  statue_maria: [
    { who: 'voice', text: 'Мария, богиня Крови. Всё живое платит, всё живое получает. Камень в груди статуи тёмно-красный и тёплый на ощупь.' },
    { if: { not: 'bless_blood' }, who: 'voice', text: 'Говорят, Мария принимает подношения только у своего алтаря — в Храме Крови.' },
  ],
  statue_eola: [
    { who: 'voice', text: 'Эола, богиня Чувств. Сердце знает дорогу раньше ног. Вокруг статуи растёт зелёный плющ, хотя земли тут нет.' },
    { if: { not: 'bless_feelings' }, who: 'voice', text: 'Плющ тянется к твоей руке. Эола не просит монет — только чтобы ты сказал{|а} правду.', choices: [
      { text: '«Мне страшно. Но я иду дальше».', next: 'bless_feelings_get' },
      { text: 'Промолчать.' },
    ] },
  ],
  bless_feelings_get: [
    { who: 'voice', text: 'Плющ обвивает запястье и тает зелёными искрами. В груди становится теплее.', fx: 'flash',
      set: { bless_feelings: true }, toast: '💚 Благословение Чувств: +20 ОЗ, лечение сильнее' },
  ],
  statue_dillad: [
    { who: 'voice', text: 'Диллад, бог Духа. Лёд не ломается — он ждёт весны. От голубого камня тянет холодом.' },
    { if: { not: 'bless_spirit' }, who: 'voice', text: 'Диллад не принимает молитв на рынке. Его благословение хранит Орден Духа.' },
  ],
  // Алтарь Марии в храме: подношение кровью
  altar_offer: [
    { if: { flag: 'bless_blood' }, who: 'voice', text: 'Камень алтаря ещё тёплый от твоей крови. Мария помнит.' },
    { if: { not: 'bless_blood' }, who: 'voice', text: 'На алтаре — чаша и тонкий нож. Подношение Марии — немного своей крови.', choices: [
      { text: 'Сделать подношение (−20 ОЗ)', next: 'bless_blood_get' },
      { text: 'Отойти.' },
    ] },
  ],
  bless_blood_get: [
    { who: 'voice', text: 'Капля, другая. Чаша вспыхивает алым, и рука вдруг становится тяжёлой и сильной.', fx: 'flash',
      set: { bless_blood: true }, hurt: 20, toast: '🩸 Благословение Крови: +20% урона' },
  ],

  // Торговец
  merchant: [
    { if: { not: 'theft_done' }, who: 'merchant', text: 'О-о-о, светлый гость! Пим всё купит, Пим всё продаст! Ну, почти всё.' },
    { if: { flag: 'theft_done' }, who: 'merchant', text: 'Обчистили? Сочувствую! В Берте кошель на поясе носят только туристы. Но Пим поможет!' },
    { who: 'merchant', text: 'Чем могу служить?', choices: [
      { text: 'Продать красный бриллиант ({$bribe_cost} 💰)', if: { flag: 'red_diamond' }, next: 'merchant_sell' },
      { text: 'Наполнить Сосуд жизни (10 💰)', if: [{ flag: 'got_flask' }, { not: 'has_water_flask' }, { gte: ['gold', 10] }], next: 'merchant_flask' },
      { text: 'Что за город?', next: 'merchant_city' },
      { text: 'Ничего, спасибо.' },
    ] },
  ],
  merchant_sell: [
    { who: 'merchant', text: 'Ого… Кровавый бриллиант. Такие рождаются только у храма Марии. Откуда он у светлого?' },
    { who: 'merchant', text: 'Не говори, не говори! Пим не спрашивает. Пим платит. Ровно {$bribe_cost}, ни монетой больше.',
      add: { gold: '$bribe_cost' }, set: { red_diamond: false, diamond_sold: true }, toast: '💰 +{$bribe_cost} золота' },
  ],
  merchant_flask: [
    { who: 'merchant', text: 'Водичка из лечебных источников Марии! Ну, почти из источников. Ну, почти лечебная. Шучу! Работает.',
      add: { gold: -10 }, set: { has_water_flask: true }, toast: '🧪 Сосуд жизни наполнен (+50 ОЗ, клавиша Q)' },
  ],
  merchant_city: [
    { who: 'merchant', text: 'Берт! Ворота Нокта, лучший рынок по эту сторону гор. Здесь продают всё, кроме совести.' },
    { who: 'merchant', text: 'Наверху — Император Гидан, в столице. А тут правят четыре бога и цены. Спроси хранительницу у статуй, она про богов любит поболтать.' },
  ],

  // ============================================================ ЭТАП 5. Храм Кровавой Марии

  temple_intro: [
    { who: 'voice', text: 'Молебенный зал. Алый купол, витражи Марии, тяжёлые скамьи.', set: { temple_seen: true }, pickPath: true },
    { who: 'voice', text: 'У алтаря — Первосвященник. Где-то наверху тихо вздыхает орган, хотя за ним никого не видно.' },
  ],
  // северная дверь нефа: Надежда уходит в столицу (карта), остальные пути — сюда
  temple_back: [
    { if: { not: 'temple_done' }, who: 'voice', text: 'За алтарём — дверь в глубину храма. Жрецы не пустят, пока ты не закончишь здесь свои дела.' },
    { if: { flag: 'temple_done' }, who: 'voice', text: 'Дверь за алтарём поддаётся.', next: 'stage5_end' },
  ],
  temple_back_locked: [
    { who: 'voice', text: 'За алтарём — дверь в глубину храма. Жрецы не пустят, пока ты не закончишь здесь свои дела.' },
  ],
  door_locked: [
    { who: 'voice', text: 'Дверь заперта.' },
  ],
  hero_down_temple: [
    { who: 'voice', text: 'Ты {очнулся|очнулась} у входа. Кто-то вытер кровь с твоего лица — аккуратно, почти нежно.' },
  ],

  // Намёк на Путь Мести
  mirror_hint: [
    { who: 'voice', text: 'Старое зеркало в золотой раме, по стеклу — трещина. В нём твоё отражение.' },
    { who: 'voice', text: 'На миг за твоей спиной — три фигуры: девушка в красном, мужчина в серебряной короне, беловолосый рыцарь в очках. Они смотрят не на тебя. Они смотрят сквозь экран.' },
    { if: { flag: 'dolita_dead' }, who: 'voice', text: 'Девушка в отражении не улыбается.' },
    { who: 'voice', text: 'Ты оборачиваешься. Никого.' },
  ],

  // ---------- Путь Надежды: договориться
  priest_hope: [
    { who: 'priest', text: 'Светл{ый|ая} в доме Марии. Говорят, ты идёшь с миром.' },
    { who: 'priest', text: 'Мария не верит словам. Мария верит крови и силе. Покажи, что у тебя есть сила, — и что ты умеешь её остановить.', choices: [
      { text: 'Покажу.', set: { priest_hope_fight: true }, next: 'priest_hope_go' },
      { text: 'Позже.' },
    ] },
  ],
  priest_hope2: [
    { who: 'priest', text: 'О мире. Люминос присылает к нам убийц триста лет. А теперь — переговорщика?', choices: [
      { text: 'Я не знаю, зачем королева меня послала. Но я {пришёл|пришла} сам{|а} и иду сам{|а}.', next: 'priest_hope3' },
      { text: 'Королева хочет мира.', next: 'priest_hope_fail' },
    ] },
  ],
  priest_hope3: [
    { who: 'priest', text: 'Хм. Мария учит: кровь не лжёт. Дай мне каплю — и я узнаю, правду ли ты говоришь.', choices: [
      { text: 'Протянуть руку.', next: 'priest_hope_ok' },
      { text: 'Нет. Моя кровь — не плата.', next: 'priest_hope_fail' },
    ] },
  ],
  priest_hope_fail: [
    { who: 'priest', text: 'Неверно. Подумай ещё, светл{ый|ая}. Мария терпелива, я — не очень.' },
  ],
  priest_hope_ok: [
    { who: 'voice', text: 'Холодная игла, одна алая капля в золотой чаше. Первосвященник долго смотрит в неё.' },
    { who: 'priest', text: 'Странно. В тебе есть и Свет, и Тьма. Как в пророчестве.' },
    { who: 'priest', text: 'Держи печать Марии. С ней тебя пустят в столицу. И вот ещё — сестра Долита просила вернуть.', add: { gold: '$stolen_gold' },
      set: { temple_done: true, mary_seal: true }, toast: 'Получено: печать Марии и твой кошель' },
    { who: 'hero', text: 'Долита? Кто это?' },
    { who: 'priest', text: 'Узнаешь. Она тебя уже знает.' },
  ],
  priest_after_hope: [
    { who: 'priest', text: 'Путь на север из Демина открыт. Иди, пока Мария к тебе благосклонна.' },
  ],

  // ---------- Путь Власти: бой с Первосвященником
  priest_power: [
    { who: 'priest', text: 'А, тот, кто купил северные ворота. Слухи у нас летят быстрее птиц.' },
    { who: 'priest', text: 'Хочешь купить и храм? Мария не берёт золотом. Мария берёт кровью.', choices: [
      { text: 'Тогда возьму кровью я.', set: { priest_fight: true }, next: 'priest_fight_start' },
      { text: 'Уйти.' },
    ] },
  ],
  priest_fight_start: [
    { who: 'priest', text: 'Как пожелаешь. Стража! Мария голодна.', toast: 'Босс: Первосвященник Кассиан. Уклоняйся от кровавых сгустков!' },
  ],
  priest_beaten: [
    { who: 'voice', text: 'Первосвященник падает на ступени алтаря. Посох с алым кристаллом катится к твоим ногам.' },
    { who: 'voice', text: 'С балкона за органом кто-то тихо хлопает в ладоши. Ты поднимаешь глаза — там никого.' },
    { who: 'voice', text: 'На алтаре, где только что стоял Кассиан, лежит амулет с каплей крови внутри. И записка: «Ты заслужил{|а}. — Д.Т.»',
      set: { inv_amulet: 1 }, toast: 'Получено: Кровавый амулет (Благословение Крови сильнее)' },
  ],

  // ---------- Путь Ненависти: Долита
  priest_hate: [
    { who: 'priest', text: 'Ты… С северных ворот. Кровь стражи ещё на тебе. Мария это чует.' },
    { who: 'priest', text: 'Я не буду с тобой драться. Сестра Долита хотела посмотреть тебе в глаза. Она ждёт в органном зале.' },
    { who: 'voice', text: 'Первосвященник уходит в тень, не оборачиваясь. Восточная дверь со скрипом отворяется.', set: { priest_fled: true }, toast: 'Восточная дверь открыта' },
  ],
  dolita_organ: [
    { who: 'voice', text: 'Высокий зал. Взгляд поднимается выше, к балкону: там, спиной к тебе, за огромным органом сидит девушка в красном.', set: { organ_seen: true, dolita_phase: 1 }, zoom: [8.5, 2.6, 1.4], letterbox: true },
    { who: 'voice', text: 'Она не оборачивается. Только пальцы скользят по клавишам.', zoom: [8.5, 2.2, 1.7] },
    { who: 'dolita', text: 'Узнаёшь почерк? Записки у ручья и у врат — мои.' },
    { who: 'dolita', text: 'У ручья ты {был|была} героем. Я даже оставила тебе подарочек. А у ворот…' },
    { who: 'dolita', text: 'У стражника на воротах была дочь. Ей двенадцать. Ей кто-нибудь расскажет, как красиво ты махал{|а} мечом.' },
    { who: 'voice', text: 'Она поднимает кубок с густой красной жидкостью и пьёт до дна.', fx: 'red' },
    { who: 'dolita', text: 'За Марию. Посмотрим, как ты плаваешь.', set: { organ_fight: true }, toast: 'Фаза 1: пол заливает кровью, по ней тяжело бежать. Рывок (Shift) спасает' },
  ],
  organ_no_escape: [
    { who: 'voice', text: 'Дверь держит красная пелена. Долита не отпустит тебя.' },
  ],
  hero_down_organ: [
    { who: 'dolita', text: 'Вставай. Я ещё не наигралась.' },
  ],
  dolita_jumps: [
    { who: 'voice', text: 'Последний мех лопается. Орган хрипит, трубы стонут — и замолкают.' },
    { who: 'voice', text: 'Долита спрыгивает с балкона прямо в красную лужу и вытирает губы.' },
    { who: 'dolita', text: 'Ты сломал{|а} мой орган. Ладно. Тогда я сама.', toast: 'Фаза 3: Долита спрыгнула — кровавые стрелы и кинжалы' },
  ],
  dolita_defeated: [
    { who: 'voice', text: 'Долита падает на колени. Красная жидкость уходит в щели пола.' },
    { who: 'dolita', text: 'Ну… давай. Сделай то, что у тебя получается лучше всего.', choices: [
      { text: 'Добить.', set: { dolita_dead: true, temple_done: true }, add: { path_hate: 1 }, next: 'dolita_killed' },
      { text: 'Оставить её в живых.', set: { dolita_spared: true, temple_done: true }, next: 'dolita_spared' },
    ] },
  ],
  dolita_killed: [
    { who: 'voice', text: 'Удар. Тишина. Только капает с трубы органа.' },
    { who: 'voice', text: 'Где-то далеко, в столице, беловолосый рыцарь вдруг роняет книгу.', toast: 'Д.Т. больше никогда тебе не напишет' },
    { who: 'voice', text: 'Красная пелена у дверей зала опадает. Путь назад открыт.' },
  ],
  dolita_spared: [
    { who: 'dolita', text: '…Почему?' },
    { who: 'hero', text: 'Не знаю.' },
    { who: 'dolita', text: 'И это тоже. Красная лента. Чтобы в следующий раз тебя не так легко было поцарапать.', set: { inv_ribbon: 1 }, toast: 'Получено: Красная лента (урон по тебе −15%)' },
    { who: 'voice', text: 'Хлопок, облако красного дыма — и её нет. Красная пелена у дверей зала опадает.' },
  ],

  // Покои императора и письмо Люмины
  study_intro: [
    { who: 'voice', text: 'Покои императора Гидана — он останавливается здесь, когда приезжает молиться Марии. Пахнет воском и чернилами.', set: { study_seen: true } },
  ],
  lumina_letter: [
    { who: 'voice', text: 'На столе среди бумаг — письмо на светлой бумаге. Золотая печать Люминоса сломана.' },
    { who: 'letter', text: '«Ты заплатишь за то, что не признал меня истинной повелительницей! {Он|Она} уже идёт за тобой!»\n\n— Люмина', set: { lumina_letter_read: true } },
    { who: 'hero', text: 'Это почерк королевы. «{Он|Она} уже идёт»… Это обо мне?' },
    { who: 'voice', text: 'Королева отправила тебя не спасать мир. Она отправила тебя к императору. С мечом.', toast: 'Прочитано: письмо Люмины' },
  ],
  desk_again: [
    { who: 'voice', text: 'Письмо Люмины лежит там же, где ты его {оставил|оставила}. Слова не изменились.' },
  ],

  // Дверь за алтарём — конец этапа 5
  stage5_end: [
    { if: { eq: ['temple_path', 'power'] }, who: 'voice', text: 'За алтарём — узкая лестница наверх. На ступенях сидит девушка в красном, будто ждала.', next: 'power_hostage' },
  ],

  // ============================================================ ЭТАП F. Путь Власти: кат-сцены по флагу power_scene
  power_hostage: [
    { who: 'dolita', text: 'Ты {победил|победила} Кассиана. Красиво. Я Долита. Дочь императора, если тебе это о чём-то говорит.', set: { power_scene: 'hostage' }, letterbox: true },
    { who: 'hero', text: 'Говорит. Дочь императора пойдёт со мной.' },
    { who: 'dolita', text: 'Что? Эй! Руки!' },
    { who: 'voice', text: 'Цепь от кадила Кассиана оказывается удивительно прочной. Император дорожит дочерью — это знает весь Нокт. Теперь это знаешь и ты.' },
    { who: 'voice', text: 'Дорога до столицы занимает ночь. Долита молчит всю дорогу.',
      set: { power_scene: 'deal', rain_on: true }, scene: 'palace_throne', at: [10, 7.4], dir: 'up' },
  ],
  power_deal: [
    { who: 'gidan', text: 'Ты {вошёл|вошла} в мой дом с моей дочерью на цепи.', set: { throne_seen: true, palace_seen: true }, letterbox: true },
    { who: 'aedel', text: 'Ваше величество, одно слово — и…' },
    { who: 'gidan', text: 'Нет, Аэдел. {Он|Она} знает, что делает. Чего ты хочешь?' },
    { who: 'hero', text: 'Нокт. Мир на моих условиях. И трон, когда тебя не станет.' },
    { who: 'gidan', text: 'Трон… Мне не жаль трона. Мне жаль её. Я не подпишу.', next: 'power_deal_choice' },
  ],
  power_deal_choice: [
    { who: 'voice', text: 'Долита смотрит в пол. Аэдел сжимает рукоять меча. Все ждут тебя.', choices: [
      { text: 'Натянуть цепь. «Подпишешь».', add: { path_power: 1 }, next: 'power_deal_sign' },
      { text: 'Отступить.', next: 'retreat_power' },
    ] },
  ],
  power_deal_sign: [
    { who: 'voice', text: 'Долита вскрикивает. Гидан закрывает глаза.' },
    { who: 'gidan', text: 'Хватит! …Хорошо. Но по закону Нокта трон наследует только семья. Ты женишься на ней. Так она хотя бы останется дома.' },
    { who: 'dolita', text: '…' },
    { who: 'voice', text: 'Через неделю — свадьба.', set: { power_scene: 'wedding', power_wedding: true }, scene: 'nokt_garden', at: [17, 5], dir: 'up' },
  ],
  power_wedding: [
    { who: 'voice', text: 'Арка из белых роз. Гостей мало, и никто не улыбается.', letterbox: true },
    { who: 'voice', text: 'Долита стоит рядом с тобой. Платье ей велико — будто шили для кого-то счастливого.' },
    { who: 'dolita', text: 'Да.' },
    { who: 'voice', text: 'Она говорит это в пол. Гидан смотрит на озеро. Аэдел — на Долиту. Только на неё.' },
    { who: 'aedel', text: '…Поздравляю, ваше будущее величество.' },
    { who: 'voice', text: 'Через месяц из Люминоса приходит гонец: королева Люмина требует вернуть «{своего героя|свою героиню}».',
      set: { power_scene: 'lumina' }, scene: 'luminos_throne', at: [10, 6.6], dir: 'up' },
  ],
  power_lumina: [
    { who: 'lumina', text: 'Ты! Ты {должен был|должна была} убить его, а не жениться на его дочери!', letterbox: true },
    { if: { flag: 'lumina_letter_read' }, who: 'hero', text: '«{Он|Она} уже идёт за тобой». Я {читал|читала} твоё письмо, Люмина. Ты отправила меня убивать.' },
    { if: { not: 'lumina_letter_read' }, who: 'hero', text: 'Ты отправила меня убивать. Я просто {выбрал|выбрала}, кого.' },
    { who: 'voice', text: 'Стража Нокта входит в тронный зал Люминоса. Никто из светлых не встаёт на защиту королевы.' },
    { who: 'lumina', text: 'Вы не посмеете! Я — Свет!' },
    { who: 'voice', text: 'В темнице Свет светит только крысам.', set: { power_lumina_jailed: true } },
    { who: 'voice', text: 'Проходит пять лет.', set: { power_scene: 'gidan' }, scene: 'gidan_study', at: [9, 4.5], dir: 'left' },
  ],
  power_gidan: [
    { who: 'voice', text: 'Покои императора пахнут лекарствами. На стене — новый портрет: ты в короне, Долита рядом. Она не улыбается.', letterbox: true },
    { who: 'gidan', text: '*кашляет* …Ты хорошо {правил|правила}. Ровно. Холодно. Как я и боялся.' },
    { who: 'gidan', text: 'Аэдел… береги её. От… *кашель*' },
    { who: 'aedel', text: 'Ваше величество?' },
    { who: 'voice', text: 'Император Гидан умирает на рассвете. Аэдел держит его руку до самого конца.', set: { power_gidan_dead: true } },
    { who: 'voice', text: 'Через неделю Аэдела обвиняют в заговоре. Приказ подписан твоей рукой.',
      set: { power_scene: 'aedel' }, scene: 'palace_gate', at: [7.5, 9], dir: 'up' },
  ],
  power_aedel: [
    { who: 'voice', text: 'Площадь перед дворцом. Аэдел в цепях стоит на коленях — без шлема, без очков.', letterbox: true },
    { who: 'voice', text: 'Рядом — Каменный рыцарь, новый страж трона: доспех без лица, который слушается только тебя.' },
    { who: 'aedel', text: 'Знаешь, я мог убить тебя тогда, в тронном зале. Одно слово Гидана…' },
    { who: 'voice', text: 'Аэдел улыбается. Потом смотрит на Долиту — долго, будто запоминает.' },
    { who: 'aedel', text: 'Не надейся на тёплый приём в этот раз, Игрок.' },
    { who: 'stone_knight', text: '…', fx: 'flash', set: { power_aedel_executed: true } },
    { who: 'voice', text: 'Проходит год.', set: { power_scene: 'dolita' }, scene: 'nokt_garden', at: [17, 5], dir: 'left' },
  ],
  power_dolita_end: [
    { who: 'voice', text: 'Лунный сад зарос. У беседки — белый камень без надписи.', letterbox: true },
    { who: 'voice', text: 'Долита ушла тихо, зимой. Лекари сказали — слабое сердце. Служанки сказали — она просто перестала есть.' },
    { who: 'voice', text: 'На её столе нашли записку. Последнюю.' },
    { who: 'note', text: '«Ты получил{|а} всё, что хотел{|а}. Надеюсь, оно того стоило <3»\n\n— Д.Т.', set: { power_dolita_dead: true } },
    { who: 'voice', text: '…', ending: 'power' },
  ],

  // ---------- Отступить в финальном выборе: Прощение (только если path_hate < 2 и path_power < 2)
  retreat_hope: [
    { if: [{ lt: ['path_hate', 2] }, { lt: ['path_power', 2] }], who: 'voice', text: 'Ты {опустил|опустила} взгляд и {сделал|сделала} шаг назад. Потом ещё один.', next: 'forgiveness' },
    { if: { any: [{ gte: ['path_hate', 2] }, { gte: ['path_power', 2] }] }, who: 'gidan', text: 'Отступить? После всего, что ты {сделал|сделала}, чтобы оказаться здесь? Нет.', next: 'throne_why' },
  ],
  retreat_power: [
    { if: [{ lt: ['path_hate', 2] }, { lt: ['path_power', 2] }], who: 'voice', text: 'Ты {снял|сняла} цепь с запястья Долиты и {сделал|сделала} шаг назад. Потом ещё один.', next: 'forgiveness' },
    { if: { any: [{ gte: ['path_hate', 2] }, { gte: ['path_power', 2] }] }, who: 'gidan', text: 'Отступить? С моей дочерью на цепи? Поздно, {герой|героиня}.', next: 'power_deal_choice' },
  ],
  forgiveness: [
    { who: 'voice', text: 'Никто тебя не держит. Двери открыты. Свет гаснет.', set: { ending_forgiveness: true }, ending: 'forgiveness' },
  ],

  // ---------- Перчатка вызова: арена
  duel_start: [{ who: 'voice', text: 'Ты бросаешь перчатку. Мир вокруг тускнеет — остаются только арена и противник.' }],
  duel_won: [{ who: 'voice', text: 'Противник склоняет голову и растворяется. Арена гаснет — пора обратно.', duelEnd: true }],
  duel_lost: [{ who: 'voice', text: 'Ты приходишь в себя там, откуда {бросил|бросила} перчатку. Вызов можно повторить.' }],
  duel_leave: [
    { who: 'voice', text: 'Уйти с арены?', choices: [
      { text: 'Вернуться в мир.', duelEnd: true },
      { text: 'Остаться.' },
    ] },
  ],

  // ============================================================ ЭТАП 6. Столица Нокт (Путь Надежды)
  capital_intro: [
    { who: 'voice', text: 'Ноктюрн, столица Нокта. Чёрные шпили, фиолетовые фонари и запах дождя на брусчатке.', set: { capital_seen: true } },
    { who: 'dolita', text: 'Наконец-то! Я уж думала, Кассиан тебя съест.' },
    { if: { flag: 'note_1_taken' }, who: 'hero', text: 'Ты… Долита? Это ты оставляла записки с подписью «Д.Т.»?' },
    { if: { flag: 'note_1_taken' }, who: 'dolita', text: 'Может быть. Я люблю, когда меня ищут.' },
    { if: { not: 'note_1_taken' }, who: 'hero', text: 'Ты меня знаешь?' },
    { if: { not: 'note_1_taken' }, who: 'dolita', text: 'Я много кого знаю. Долита Тенебрис, к твоим услугам. Почти ко всем.' },
    // помнит прошлое прохождение, где её убили или герой шёл путём ненависти
    { if: { flag: 'bad_past' }, who: 'dolita', text: 'Рада, что ты {выбрал|выбрала} правильный путь.', set: { dolita_knows: true } },
    { if: { flag: 'bad_past' }, who: 'hero', text: 'Что? О каком пути ты говоришь?' },
    { if: { flag: 'bad_past' }, who: 'dolita', text: '…' },
    { if: { flag: 'bad_past' }, who: 'voice', text: 'Долита отводит взгляд. Улыбка на месте, а в глазах — нет. Больше она об этом не скажет ни слова.' },
    { who: 'dolita', text: 'И вот ещё. Повяжи на руку — с ней тебя не так легко поцарапать.', set: { inv_ribbon: 1 }, toast: 'Получено: Красная лента (урон по тебе −15%)' },
    { who: 'dolita', text: 'Ладно. Во дворец пускают только по паролю. Он меняется каждую ночь, и знает его… ну, допустим, я.' },
    { who: 'dolita', text: 'Просто так не скажу. Пойдём в Лунный сад — развлеки меня, и пароль твой.' },
    { who: 'voice', text: 'Долита ныряет в западный переулок.', set: { dolita_led: true }, toast: 'Лунный сад — на западе столицы' },
  ],
  capital_dolita: [
    { who: 'dolita', text: 'Ну что стоишь? Сад на западе.' },
  ],
  capital_west_locked: [
    { who: 'voice', text: 'Узкий переулок упирается в запертую калитку.' },
  ],
  capital_guard: [
    { if: { not: 'palace_open' }, who: 'guard', text: 'Дальше — дворцовая площадь. Без пароля у ворот делать нечего.' },
    { if: { flag: 'palace_open' }, who: 'guard', text: 'Говорят, сам Первый рыцарь тебя пропустил. Чудеса.' },
  ],
  capital_citizen: [
    { who: 'citizen', text: 'Император Гидан? Строгий, но честный. А вот к нам в гости, говорят, сама королева Люмина едет. Мир подписывать.' },
    { who: 'citizen', text: 'Мир с Люминосом… Мой дед бы не поверил.' },
  ],

  // ---------- Лунный сад: мини-игры за пароль
  garden_intro: [
    { who: 'voice', text: 'Лунный сад. Над озером висит огромная бледная луна, в траве что-то мерцает.', set: { garden_seen: true } },
    { who: 'dolita', text: 'Моё любимое место. Здесь даже Аэдел иногда улыбается. Иногда.' },
    { who: 'dolita', text: 'Подойди, когда будешь {готов|готова}.' },
  ],
  garden_games: [
    { who: 'dolita', text: 'Выбирай, чем меня развлечёшь. Справишься — скажу пароль.', choices: [
      { if: { eq: ['hero_gender', 'm'] }, text: 'Пустить камушки по озеру.', mini: 'stones' },
      { if: { eq: ['hero_gender', 'm'] }, text: 'Собрать тебе букет.', next: 'bouquet_start' },
      { if: { eq: ['hero_gender', 'f'] }, text: 'Сплести венок.', next: 'wreath_start' },
      { if: { eq: ['hero_gender', 'f'] }, text: 'Пустить фонарики по озеру.', mini: 'lantern' },
      { text: 'Поймать светлячков.', next: 'fireflies_start' },
      { text: 'Чуть позже.' },
    ] },
  ],
  bouquet_start: [
    { who: 'dolita', text: 'Букет? Как мило. Только собери в том порядке, в каком я назову. Я капризная.', mini: 'bouquet' },
  ],
  wreath_start: [
    { who: 'dolita', text: 'Венок! Я покажу, как вплетать цветы, а ты повторяй. Порядок важен — иначе развалится.', mini: 'wreath' },
  ],
  fireflies_start: [
    { who: 'dolita', text: 'Десять светлячков за тридцать секунд. Они пугливые — не несись прямо на них, обходи.', mini: 'fireflies' },
  ],
  stones_win: [
    { who: 'dolita', text: 'Ого, через всё озеро! А говорил{|а}, что ты {простой рыцарь|простая рыцарша}.', next: 'garden_password' },
  ],
  lantern_win: [
    { who: 'dolita', text: 'Смотри, как красиво плывут… Ни один не погас. Ты умеешь ждать — редкий талант.', next: 'garden_password' },
  ],
  wreath_win: [
    { who: 'dolita', text: 'Ни одного лишнего цветка! Надень его мне. Нет, на меня, а не на себя!', next: 'garden_password' },
  ],
  bouquet_win: [
    { who: 'dolita', text: 'Роза, лилия, василёк… всё как я сказала. Аэдел за сто лет так и не запомнил.', next: 'garden_password' },
  ],
  fireflies_win: [
    { who: 'dolita', text: 'Целая банка звёзд! Отпустим их потом. Они тоже кому-то нужны.', next: 'garden_password' },
  ],
  fireflies_fail: [
    { who: 'dolita', text: 'Разлетелись! Не беда — к ночи вернутся.', next: 'mini_fail' },
  ],
  mini_fail: [
    { who: 'dolita', text: 'Почти! Попробуешь ещё?', choices: [
      { text: 'Ещё раз.', next: 'garden_games' },
      { text: 'Позже.' },
    ] },
  ],
  garden_password: [
    { who: 'dolita', text: 'Пароль на эту ночь — «Лунная соль». Скажешь его стражнику у дворцовых ворот.', set: { palace_password: true }, toast: 'Узнан пароль: «Лунная соль»' },
    { who: 'dolita', text: 'И… если у ворот будет стоять кто-то большой и молчаливый — не пугайся. Он всегда такой.' },
    { who: 'dolita', text: 'А это — на память. Бездонная Пиала. Из неё сколько ни пей, всё мало. Как я.', set: { inv_bowl: 1 }, toast: 'Получено: Бездонная Пиала (лечение +25%)' },
  ],
  garden_after: [
    { who: 'dolita', text: '«Лунная соль». Не забудь. Дворец — на севере столицы.' },
  ],

  // ---------- Ворота дворца: Тёмный рыцарь
  pgate_intro: [
    { who: 'voice', text: 'Ворота дворца. Перед ними неподвижно стоит фигура в чёрных доспехах с голубыми прожилками.', set: { pgate_seen: true } },
  ],
  knight_silent: [
    { who: 'dark_knight', text: '…' },
    { who: 'voice', text: 'Сквозь щель шлема мерцает холодный голубой свет.' },
  ],
  pguard: [
    { who: 'guard', text: 'Стой. Пароль?' },
    { who: 'hero', text: 'Я… не знаю.' },
    { who: 'guard', text: 'Тогда до свидания. Без пароля во дворец не входят даже кошки.' },
  ],
  pguard_pass: [
    { who: 'guard', text: 'Стой. Пароль?' },
    { who: 'hero', text: '«Лунная соль».' },
    { who: 'guard', text: '…Верно. Проходи.' },
    { who: 'voice', text: 'Но Тёмный рыцарь делает шаг вперёд и медленно вынимает меч.' },
    { who: 'guard', text: 'Э-э… сэр рыцарь, пароль верный…' },
    { who: 'dark_knight', text: 'Пароль — для гостей. Чужак со Светом Люминоса в руках — не гость.', choices: [
      { text: 'Я не хочу драться.', next: 'knight_fight' },
      { text: 'Отойди, или пройду силой.', next: 'knight_fight' },
    ] },
  ],
  knight_fight: [
    { who: 'dark_knight', text: 'Тогда защищайся.', set: { knight_fight: true } },
  ],
  knight_unmask: [
    { who: 'voice', text: 'Звонкий голос перекрывает лязг стали:', fx: 'flash', letterbox: true },
    { who: 'dolita', text: 'АЭДЕЛ! Стой! Это мой гость!' },
    { who: 'voice', text: 'Рыцарь замирает. Медленно опускает меч.' },
    { who: 'voice', text: 'И снимает шлем. Белые волосы, собранные в хвост, тонкие очки, спокойные голубые глаза.', set: { knight_stopped: true } },
    { who: 'aedel', text: 'Долита. Ты опять водишь во дворец кого попало.' },
    { who: 'dolita', text: '{Он|Она} не кто попало! {Прошёл|Прошла} храм без капли чужой крови. Кассиан дал печать Марии.' },
    { who: 'aedel', text: '…' },
    { who: 'aedel', text: 'Аэдел Анима. Первый рыцарь императора.' },
    { who: 'hero', text: '{name}. Из Люминоса.' },
    { who: 'aedel', text: 'Знаю. Свет у тебя в руках виден за милю.' },
    { who: 'aedel', text: 'Ты хорошо {держал|держала} удар. Немногие выдерживают больше трёх.' },
    { who: 'dolita', text: 'Это он так извиняется.' },
    { who: 'aedel', text: 'Я не извиняюсь.', choices: [
      { text: 'Спасибо, что не добил.', next: 'aedel_calm' },
      { text: 'Для Первого рыцаря ты бьёшь слабовато.', next: 'aedel_angry' },
    ] },
  ],
  aedel_calm: [
    { who: 'aedel', text: 'Не за что. Пока.', next: 'palace_gate_open' },
  ],
  // достижение «Трещина во льду»: разозлить Аэдела
  aedel_angry: [
    { who: 'voice', text: 'Камни под ногами Аэдела покрываются инеем. По стеклу его очков с тихим звоном бежит тонкая трещина.' },
    { who: 'aedel', text: 'Повтори.' },
    { who: 'dolita', text: 'Ой-ой. Нет-нет-нет, не повторяй!' },
    { who: 'aedel', text: '…В следующий раз меня не остановит даже Долита.', set: { aedel_angry: true }, achieve: 'ice_crack', next: 'palace_gate_open' },
  ],
  palace_gate_open: [
    { who: 'voice', text: 'Ворота дворца со скрипом открываются.', set: { palace_open: true, aedel_met: true }, heal: true, toast: 'Знакомство: Аэдел Анима' },
  ],
  aedel_gate_after: [
    { who: 'aedel', text: 'Император ждёт. Он не любит ждать. Я — тоже.' },
  ],
  dolita_gate_after: [
    { who: 'dolita', text: 'Не обижайся на Аэдела. Он лёд снаружи, а внутри… тоже лёд. Но тёплый.' },
  ],
  pguard_open: [
    { who: 'guard', text: 'Проходите. И… простите за рыцаря.' },
  ],
  hero_down_knight: [
    { if: { lt: ['aedel_phase', 2] }, who: 'voice', text: 'Ты приходишь в себя у края площади. Тёмный рыцарь ждёт у ворот, как будто ничего не было.' },
    { if: { gte: ['aedel_phase', 2] }, who: 'voice', text: 'Ты приходишь в себя у ворот. Дождь не кончился. Аэдел ждёт, опустив меч, — двери за тобой снова схватывает лёд.' },
  ],

  // ---------- Тронный зал
  palace_intro: [
    { who: 'voice', text: 'Тронный зал. Чёрный мрамор, серебряные колонны. На троне — император Гидан.', set: { palace_seen: true } },
  ],
  throne_gidan: [
    { who: 'gidan', text: 'Значит, это ты. Герой, которого Люмина отправила в мою империю.', set: { throne_seen: true }, letterbox: true },
    { who: 'gidan', text: 'Мне докладывали о каждом твоём шаге. Волки, северные ворота, храм. Ты {мог|могла} убивать — и не {стал|стала}.' },
    { who: 'gidan', text: 'Сто лет Свет и Тьма воюют из-за обид, которых никто уже не помнит. Мне нужен человек, которому поверят по обе стороны границы.' },
    { who: 'gidan', text: 'Стань послом Нокта в Люминосе. Королева Люмина согласилась на переговоры — впервые за сотни лет.', choices: [
      { text: '{Согласен|Согласна}.', next: 'throne_accept' },
      { text: 'Почему я?', next: 'throne_why' },
      { text: 'Отступить.', next: 'retreat_hope' },
    ] },
  ],
  throne_why: [
    { who: 'gidan', text: 'Потому что ты — единственный человек, в котором Свет и Тьма не дерутся.' },
    { who: 'dolita', text: 'Я же говорила!' },
    { who: 'gidan', text: 'Ну так что?', choices: [
      { text: '{Согласен|Согласна}.', next: 'throne_accept' },
    ] },
  ],
  throne_accept: [
    { who: 'gidan', text: 'Хорошо. Аэдел, Долита — вы едете с нами. В Люминос.', set: { ambassador: true } },
    { who: 'aedel', text: 'Да, ваше величество.', scene: 'luminos_square', at: [10, 9.5], dir: 'up' },
  ],
  gidan_after: [
    { who: 'gidan', text: 'Люмина ждёт, посол.' },
  ],

  // ---------- Площадь Люминоса: посольство Нокта у белого камня
  embassy_square: [
    { who: 'voice', text: 'Люминос. Площадь Светлого города и белый камень — тот самый, с которого всё началось.', set: { embassy_seen: true, invited: true }, letterbox: true },
    { who: 'voice', text: 'Внизу, полукругом: ты впереди, справа от тебя — Гидан, слева — Аэдел, за ним — Долита.' },
    { who: 'dolita', text: 'Ой, как тут светло. Аэдел, держи меня за руку — а то ослепну.' },
    { who: 'aedel', text: '…Держу.' },
    { who: 'gidan', text: 'Люди Света смотрят на нас, как на чуму. Пусть смотрят. Идём, посол — ко дворцу. Королева ждёт.' },
  ],

  // ---------- Переговоры в тронном зале Люмины: перстень с ядом
  negotiation: [
    { who: 'voice', text: 'Тронный зал Люмины. Впервые за много лет здесь собрались и светлые, и тёмные: крестьяне Люминоса, горожане Нокта, стража обеих корон.',
      set: { negotiation_seen: true }, letterbox: true },
    { who: 'lumina', text: 'А, {name}. {Мой верный|Моя верная}… посол.' },
    { who: 'lumina', text: 'Я так рада, что ты {дошёл|дошла}. Выпей со мной за мир.' },
    { who: 'voice', text: 'Люмина сама протягивает тебе кубок. Вино тёмное, почти чёрное.', choices: [
      { text: 'Выпить.', next: 'negotiation_drink' },
    ] },
  ],
  negotiation_drink: [
    { who: 'voice', text: 'Ты подносишь кубок к губам — и рука в латной перчатке ложится на твоё запястье.', fx: 'flash' },
    { if: { not: 'aedel_angry' }, who: 'voice', text: 'Аэдел останавливает твою руку. Молча. Только переводит взгляд на перстень королевы.' },
    { if: { flag: 'aedel_angry' }, who: 'voice', text: 'Аэдел останавливает твою руку — грубо, не глядя на тебя. Только переводит взгляд на перстень королевы.' },
    { who: 'voice', text: 'Крышечка перстня открыта. Внутри пусто. Ты понимаешь всё без слов.' },
    { who: 'voice', text: 'Гидан берёт руку её величества и сам закрывает крышечку перстня с ядом.' },
    { who: 'gidan', text: 'Королева, как вы можете это объяснить?' },
    { who: 'lumina', text: 'Это простая ошибка!' },
    { who: 'voice', text: 'Гидан кивает страже.' },
    { who: 'gidan', text: 'Ошибкам место в темнице.', set: { lumina_exposed: true } },
    { who: 'voice', text: 'Люмину уводят. Её корона катится по ступеням трона и останавливается у твоих ног.' },
    { who: 'gidan', text: 'ВЫ ВИДИТЕ? Королева Люмина, развязавшая эту войну много веков назад, желает её продолжить. Я считаю, что Люминос заслуживает лучшего правителя, а вы?' },
    { who: 'voice', text: 'Толпа гудит.' },
    { who: 'voice', text: 'Гидан хитро смотрит на тебя.' },
    { who: 'gidan', text: 'Как насчёт тебя, {name}?' },
    { who: 'voice', text: 'Толпа радостно гудит.', choices: [
      { text: 'Я стану {королём|королевой}.', next: 'coronation' },
    ] },
  ],
  negotiation_wait: [{ who: 'lumina', text: 'Посол. Садись, переговоры не ждут.' }],
  coronation: [
    { who: 'voice', text: 'Через месяц в Люминосе звонят все колокола. {name} — {король|королева} Света.', fx: 'flash',
      set: { hero_king: true, feast: true }, scene: 'luminos_throne', at: [10, 4.9], dir: 'down' },
  ],

  // ---------- Пир в тронном зале Люмины (концовка Надежды)
  feast: [
    { who: 'voice', text: 'Пир в тронном зале. За одним столом — крестьяне Люминоса и горожане Нокта. Никто не держит руку на мече.',
      set: { feast_seen: true }, letterbox: true },
    { who: 'dolita', text: 'Ваше величество! Можно я всё равно буду звать тебя по имени?' },
    { who: 'aedel', text: 'Долита.' },
    { who: 'dolita', text: 'Что? И вообще, раз уж все тут счастливы… Аэдел, скажи им.' },
    { who: 'aedel', text: '…Мы женимся.', scene: 'nokt_garden', at: [15, 4], dir: 'up', set: { wedding: true } },
  ],

  // ---------- Свадьба Долиты и Аэдела — концовка Надежды
  wedding: [
    { who: 'voice', text: 'Лунный сад. Беседка увита розами, над озером и гостями кружат светлячки.', set: { wedding_seen: true }, letterbox: true },
    { who: 'priest', text: 'Мария благословляет союз крови и льда.' },
    { who: 'dolita', text: 'Я же говорила, что это моё любимое место.' },
    { who: 'aedel', text: 'Ты говорила, что здесь я иногда улыбаюсь.' },
    { who: 'dolita', text: 'Ну так улыбнись!' },
    { who: 'voice', text: 'И Аэдел Анима, Первый рыцарь и лёд Нокта, улыбается.' },
    { who: 'gidan', text: 'За мир. За Свет и Тьму в одном сердце.' },
    { who: 'hero', text: 'За мир.', ending: 'hope' },
  ],

  // ============================================================ ЭТАП 7. Путь Ненависти / Мести
  capital_hate: [
    { who: 'voice', text: 'Ноктюрн, столица Нокта. Улицы пустеют, едва ты выходишь из-за угла. Ставни хлопают одна за другой.', set: { capital_seen: true } },
    { who: 'voice', text: 'Кто-то шепчет за дверью: «Это {он|она}… {тот|та}, кто был{|а} в храме».' },
    { if: { flag: 'dolita_dead' }, who: 'voice', text: 'На дверях храмовой лавки — чёрная лента. Город уже знает, что случилось в органном зале.' },
  ],
  capital_citizen_hate: [
    { who: 'citizen', text: 'Н-не подходи! Я ничего не видел! Дворец — там, на севере, только не трогай меня…' },
  ],
  hate_gate_intro: [
    { who: 'voice', text: 'Дождь. Стражник у ворот бросает копьё и убегает. Остаётся только Тёмный рыцарь.', set: { hgate_seen: true, pgate_seen: true } },
    { who: 'dark_knight', text: '…' },
    { who: 'voice', text: 'Он молча поднимает двуручный меч. По клинку бежит голубое пламя.', set: { hknight_fight: true, aedel_phase: 1 },
      toast: 'Двери заперты. Волны меча идут до стены — прячься за колоннами' },
  ],
  helm_broken: [
    { who: 'voice', text: 'Твой удар раскалывает шлем. Из-под чёрной стали — белые волосы и треснувшие очки.', fx: 'flash' },
    { who: 'aedel', text: 'Аэдел Анима. Запомни это имя, раз уж решил{|а} всех здесь перечеркнуть.', achieve: 'ice_crack' },
    { if: { flag: 'dolita_spared' }, who: 'dolita', text: 'Аэдел! Я с тобой!' },
    { if: { flag: 'dolita_spared' }, who: 'aedel', text: 'Долита, назад… Нет. Вместе.' },
    { if: { flag: 'dolita_dead' }, who: 'aedel', text: 'Лёд не тает. Он трескается.' },
    { who: 'voice', text: 'Ворота за спиной схватывает иней. Дождь стучит по броне. Аэдел поднимает меч — по клинку бежит голубой свет.',
      toast: 'Двери заперты. Волны меча идут до стены — прячься за колоннами. Аэдел уворачивается от половины ударов' },
  ],
  aedel_defeated: [
    { who: 'aedel', text: 'Я запомню это, я запомню тебя, ведь… Для тебя это всего лишь игра, правда?', letterbox: true },
    { if: { flag: 'dolita_spared' }, who: 'dolita', text: 'Нет-нет-нет… Аэдел, вставай. Вставай!' },
    { if: { flag: 'dolita_spared' }, who: 'dolita', text: 'Уходи. Просто уходи. Ты уже всё взял{|а}.' },
    { who: 'voice', text: 'Ворота дворца распахиваются сами. Внутри темно и тихо.' },
    { who: 'voice', text: 'Холод Аэдела не уходит. Он остаётся в пальцах, в крови, в каждом шаге.',
      set: { curse_spirit: true, curse_blood: true }, toast: 'Проклятие Духа и Проклятие Крови' },
  ],
  palace_hate_intro: [
    { who: 'voice', text: 'Тронный зал пуст. Ни стражи, ни слуг. Только император на троне — и тишина.', set: { palace_seen: true } },
  ],

  // ---------- Первый заход: Гидан говорит с Игроком
  gidan_player: [
    { who: 'gidan', text: '{name}. Нет… Не {name}.', set: { throne_seen: true }, letterbox: true },
    { who: 'gidan', text: 'Я говорю не с куклой. Я говорю с тобой. С тем, кто сидит по ту сторону стекла и решает, куда ей идти.' },
    { who: 'gidan', text: 'Тебе было интересно, что будет, если убивать? Вот что будет. Пустой дворец. Пустой сад.' },
    { if: { flag: 'dolita_dead' }, who: 'gidan', text: 'Аэдел был мне сыном. Долита — дочерью. Ты {забрал|забрала} обоих и даже не {замедлился|замедлилась}.' },
    { if: { flag: 'dolita_spared' }, who: 'gidan', text: 'Долиту ты {пощадил|пощадила}. Думаешь, это что-то меняет? Она больше никогда не улыбнётся.' },
    { who: 'gidan', text: 'Ха… ха-ха. Знаешь, что бывает с тем, кто теряет всё? Он остаётся наедине со своей головой.' },
    { who: 'gidan', text: 'Хочешь меня? Найди. Только помни: здесь всё — мои мысли.', scene: 'mind_maze', fx: 'flash', set: { gidan_gone: true } },
  ],
  maze_intro: [
    { who: 'voice', text: 'Лабиринт сознания. Стены дышат. Где-то впереди смеются — то голосом Гидана, то голосом Долиты.', set: { maze_seen: true } },
    { who: 'voice', text: 'Найди настоящего Гидана. Он умеет менять облик, а морок тает от прикосновения.' },
    { who: 'voice', text: 'Рядом с Гиданом подступает Безумие — оно медленно отнимает ОЗ. Отойди от него или найди якорь: портрет, зеркало, письмо, ленту.' },
  ],
  maze_caught: [
    { who: 'voice', text: 'Ты хватаешь его за плечо. Фигура оборачивается — и на тебя смотрит твоё собственное лицо.', letterbox: true },
    { who: 'mirror', text: 'Ну? Вот он я. Вот он ты.', choices: [
      { text: 'Ударить.', next: 'maze_kill' },
      { text: 'Опустить оружие.', next: 'maze_lower' },
    ] },
  ],
  maze_lower: [
    { who: 'mirror', text: 'Ты {пришёл|пришла} сюда по колено в крови, чтобы пожалеть меня? Нет. Доведи до конца.', choices: [
      { text: 'Ударить.', next: 'maze_kill' },
    ] },
  ],
  maze_kill: [
    { who: 'voice', text: 'Удар. Отражение трескается, как стекло.', fx: 'flash', add: { path_hate: 1 }, set: { curse_mind: true, curse_feelings: true }, toast: 'Проклятие Разума и Проклятие Чувств' },
    { who: 'voice', text: 'Стены лабиринта осыпаются — и под ними проступает тронный зал. Кто-то тяжело дышит у трона.',
      scene: 'palace_throne', at: [10, 8], dir: 'up' },
  ],

  // ---------- Маги Света (площадь Люминоса) и Тьмы (храм): бой по вызову, за победу — очки маны
  mage_light: [
    { who: 'mage_light', text: 'Свет не только греет, {герой|героиня}. Он ещё и жжёт.' },
    { who: 'mage_light', text: 'Нас двое. Одолеешь — Свет поделится с тобой маной. Проверим?', choices: [
      { text: 'Сразиться.', next: 'mage_light_go' },
      { text: 'Не сейчас.', next: 'mage_later' },
    ] },
  ],
  mage_light_go: [{ who: 'mage_light', text: 'Тогда не стой на месте. Мы — не стоим.', set: { duel_light: true } }],
  mage_light_win: [
    { who: 'mage_light', text: 'Достойно. Мана твоя — держи крепче, она утекает у тех, кто суетится.' },
    { who: 'voice', text: 'Очки маны тратят у странствующих магов. Говорят, одна такая сидит в торговом городе.' },
  ],
  mage_light_after: [
    { who: 'mage_light', text: 'Свет тебя запомнил. Ещё раз? Мана лишней не бывает.', choices: [
      { text: 'Сразиться снова.', next: 'mage_light_go' },
      { text: 'Не сейчас.', next: 'mage_later' },
    ] },
  ],
  mage_dark: [
    { who: 'mage_dark', text: 'Тьма в храме Марии не молится. Она ждёт.' },
    { who: 'mage_dark', text: 'Хочешь нашей маны? Возьми её — если сможешь поймать.', choices: [
      { text: 'Сразиться.', next: 'mage_dark_go' },
      { text: 'Не сейчас.', next: 'mage_later' },
    ] },
  ],
  mage_dark_go: [{ who: 'mage_dark', text: 'Хорошо. Только не жалуйся, когда тени ответят.', set: { duel_dark: true } }],
  mage_dark_win: [{ who: 'mage_dark', text: 'Ты {поймал|поймала} тень. Редкость. Мана — твоя.' }],
  mage_dark_after: [
    { who: 'mage_dark', text: 'Тьма тебя помнит. Пришёл{|а} за добавкой?', choices: [
      { text: 'Сразиться снова.', next: 'mage_dark_go' },
      { text: 'Не сейчас.', next: 'mage_later' },
    ] },
  ],
  mage_later: [{ who: 'voice', text: 'Маг пожимает плечами и возвращается к своим мыслям.' }],

  // ---------- Полианна — странствующий маг: дерево способностей за очки маны
  polianna: [
    { if: { not: 'polianna_met' }, who: 'polianna', text: '…М-м? *зевает* Полианна. Странствующий маг. Ты пахнешь битвой… и чуть-чуть маной.', set: { polianna_met: true } },
    { if: { not: 'polianna_met' }, who: 'polianna', text: 'Мана — не деньги. Её не сэкономишь, если хочешь выжить… Так что неси её мне. Я сделаю из неё что-нибудь полезное.' },
    { if: { not: 'inv_glove' }, who: 'polianna', text: '…И вот. Перчатка вызова. Бросишь — и любой, кого ты встречал{|а}, выйдет драться. Ради маны. Мне лень, а тебе полезно.',
      set: { inv_glove: 1 }, toast: 'Получено: Перчатка вызова (сумка или пауза → «Вызов на бой»)' },
    { who: 'polianna', text: 'А… ты снова здесь. Ну, садись. Что качаем? У тебя ✦ {$mana_points}.', choices: [
      { text: 'Открыть дерево способностей', ui: 'skills' },
      { text: 'Где взять ману?', next: 'polianna_mana' },
      { text: 'Ничего, я пойду.', next: 'polianna_bye' },
    ] },
  ],
  polianna_mana: [
    { who: 'polianna', text: 'Маги Света — на площади Люминоса. Побьёшь — поделятся. Они не обижаются… почти.' },
    { who: 'polianna', text: 'Ещё мана капает с уровнями. Медленно. Как всё хорошее.' },
  ],
  shop_intro: [
    { who: 'voice', text: 'Внутри шатра пахнет воском и полынью. На полках светятся зелья, в витринах — кольца, жезлы и камни.', set: { shop_seen: true } },
    { who: 'voice', text: 'За стойкой, подперев щёку рукой, дремлет Полианна.' },
  ],
  shop_case: [
    { who: 'voice', text: 'Под стеклом — кольца, жезлы и самоцветы. На каждом бирка с ценой в мане. Полианна приоткрывает один глаз: «Руками не трогать. Смотреть можно».' },
  ],
  polianna_bye: [{ who: 'polianna', text: 'Не беги так быстро. Устанешь. …Хотя, может, тебе и полезно.' }],

  // ---------- Дариан — уличная торговка: зелья, еда и печёная картошка
  darian: [
    { if: { not: 'darian_met' }, who: 'darian', text: 'Эй, герой, не ходи голодным. Голодный герой — мёртвый герой!', set: { darian_met: true } },
    { if: { not: 'darian_met' }, who: 'darian', text: 'Я Дариан. Зелья, пирожки, пряники… и картошка. Печёная. Лучше любого зелья, честное слово.' },
    { who: 'darian', text: 'Картошечка? Только из печи. Такую нигде не найдёшь.', choices: [
      { text: 'Посмотреть корзинку', ui: 'shop' },
      { text: 'Почему картошка лучше зелья?', next: 'darian_potato' },
      { text: 'В другой раз.' },
    ] },
  ],
  darian_potato: [
    { who: 'darian', text: 'Печёная картошка — она и раны лечит, и душу греет. Восемьдесят ОЗ, проверено на стражниках.' },
    { who: 'darian', text: 'Только больше двух в одни руки не дам — печь у меня одна, а голодных много.' },
  ],

  // ---------- Покои после лабиринта: три комнаты, потом дверь
  rooms_intro: [
    { who: 'voice', text: 'Дворец Нокта. Ни души. Двери трёх комнат приоткрыты, а дверь в конце коридора запечатана тремя печатями.', set: { maze_exit_seen: true }, letterbox: true },
    { who: 'gidan', text: '(голос отовсюду) Посмотри, что ты {оставил|оставила} после себя. Комнату дочери. Комнату сына. Мой кабинет.' },
    { who: 'voice', text: 'Осмотри все три комнаты — тогда печати спадут.' },
  ],
  // комната Долиты
  dolita_diary: [
    { who: 'voice', text: 'Дневник Долиты. Последняя запись сделана накануне твоего прихода.' },
    { who: 'voice', text: '«Папа опять не спал. Аэдел говорит, что всё будет хорошо. Налила чай в любимую пиалу — она кажется бездонной, если пить медленно.»' },
    { who: 'voice', text: '«Завтра в Нокт придёт {герой|героиня} из Люминоса. Интересно, {он|она} любит музыку?»', set: { room_dolita_visited: true } },
  ],
  dolita_diary_again: [{ who: 'voice', text: 'Ты не хочешь перечитывать.' }],
  dolita_mirror: [{ who: 'voice', text: 'Зеркало Долиты. Комната в нём та же — только тебя в отражении нет.' }],
  dolita_commode: [
    { who: 'voice', text: 'Комод. Ноты для органа, перевязанные чёрной лентой.' },
    { who: 'voice', text: 'Под нотами — детский рисунок: трое держатся за руки. Большой человек в короне, рыцарь и девочка.' },
  ],
  // комната Аэдела
  aedel_portrait: [
    { who: 'voice', text: 'Портрет Аэдела в парадных доспехах. Совсем юный, без шлема, с прямой спиной.' },
    { who: 'voice', text: 'Ты переворачиваешь раму. На обороте, глубоко, остриём ножа: «За что?»' },
    { who: 'voice', text: 'Ты вешаешь портрет обратно. Нарисованный Аэдел закрыл глаза и отвернулся.', set: { room_aedel_visited: true } },
  ],
  aedel_portrait_again: [{ who: 'voice', text: 'Аэдел на портрете не смотрит на тебя.' }],
  aedel_stand: [{ who: 'voice', text: 'Стойка для меча. Пустая. На полу — следы тренировок: годы шагов по одному и тому же кругу.' }],
  // кабинет Гидана
  gidan_desk_letter: [
    { who: 'voice', text: 'На столе — письмо с печатью Люминоса. Почерк Люмины, буквы рвут бумагу.' },
    { who: 'lumina', text: '«Ты заплатишь за то, что не признал меня истинной повелительницей! {Он|Она} уже идёт за тобой!»' },
    { who: 'voice', text: 'Ниже — приписка рукой Гидана: «Пусть идёт. Встречу {его|её} как гостя.»', set: { room_gidan_visited: true } },
  ],
  gidan_desk_again: [{ who: 'voice', text: '«Встречу как гостя». Чернила давно высохли.' }],
  rooms_door_locked: [{ who: 'voice', text: 'Дверь держат три печати: Долиты, Аэдела и Гидана. Осмотри комнаты ({$rooms_visited} из 3).' }],
  maze_exit: [
    { who: 'voice', text: 'Печати осыпаются пеплом. За дверью — белый свет.' },
    { who: 'gidan', text: 'Надеюсь, в следующий раз ты выберешь лучший путь.', set: { hate_first_clear: true } },
    { who: 'voice', text: 'Дворец гаснет.', ending: 'hate' },
  ],

  // ---------- Второй заход: вместо боя — предложение
  gidan_offer: [
    { who: 'gidan', text: 'Снова ты. Снова кровь на ступенях храма. Снова те двое у ворот.', set: { throne_seen: true }, letterbox: true },
    { who: 'gidan', text: 'Я помню прошлый раз. Помню, как ты {нашёл|нашла} меня в моей же голове. Больно, кстати.' },
    { who: 'gidan', text: 'Я не стану бежать. И драться не стану.' },
    { who: 'gidan', text: 'Хочешь я покажу тебе иной путь?', choices: [
      { text: 'Да.', next: 'revenge_start' },
    ] },
  ],
  revenge_start: [
    { who: 'gidan', text: 'Тогда смотри внимательно. Это — Путь Мести.', set: { revenge_path: true }, fx: 'flash' },
    { who: 'voice', text: 'Тронный зал гаснет, как задутая свеча.', scene: 'void', at: [9.5, 7.6], dir: 'up' },
  ],

  // ============================================================ ЭТАП 8. Путь Мести: мета-сцена
  void_scene: [
    { who: 'voice', text: 'Темнота. Ни стен, ни пола. Только трое — и ты.', set: { void_seen: true }, letterbox: true },
    { if: { flag: 'dolita_dead' }, who: 'dolita', text: 'Привет. Не удивляйся, что я здесь. Тут никто по-настоящему не умирает.' },
    { if: { not: 'dolita_dead' }, who: 'dolita', text: 'Привет. Не удивляйся, что мы все здесь. Тут никто по-настоящему не умирает.' },
    { who: 'aedel', text: 'Кроме тех, кто держит нитки.' },
    { who: 'gidan', text: 'Мы — Куклы. Нас нарисовали, дали нам имена и реплики. Ты {двигал|двигала} нас. Ты {решал|решала}, кому жить.' },
    { who: 'dolita', text: 'А Создатель разрешил тебе всё. Убивать. Загружаться. Пробовать снова. Мы-то так не умеем.' },
    { who: 'aedel', text: 'Ты можешь всё. Ты не можешь лишь Умереть.' },
    { who: 'gidan', text: 'Ты {просил|просила} иной путь. Вот он. Путь Мести — только мстим здесь мы.' },
    { who: 'dolita', text: 'Сохранения, загрузки, вторые шансы… Скучно, правда?' },
    { who: 'dolita', text: 'Давайте добавим Хардкора.', set: { void_raise: true } },
    { who: 'voice', text: 'Все трое поднимают оружие. Кровавый сосуд Долиты. Серебряный скипетр Гидана. Ледяной меч Аэдела.' },
    { who: 'gidan', text: 'Прощай, Игрок.' },
    { who: 'voice', text: 'Удар.', crack: true },
    { who: 'voice', text: 'Последнее, что ты видишь сквозь трещины, — взгляд Аэдела. Спокойный. Почти сочувствующий.' },
    { who: 'aedel', text: '…', lock: true },
  ],

  // ============================================================ ПАТЧ v2.5. Пролог: камень истины, посол, письмо Люмины
  ambassador_again: [
    { who: 'ambassador', text: 'Её величество ждёт ответа. Прочтите ещё раз — может, решитесь.', letter: 'lumina' },
  ],
  ambassador_after: [
    { who: 'ambassador', text: 'Ворота дворца открыты для вас. Её величество не любит ждать.' },
  ],
  letter_accept: [
    { who: 'ambassador', text: 'Благодарю. Следуйте за мной — ворота дворца уже открыты.' },
    { who: 'voice', text: 'Толпа расступается. Шёпот стихает за твоей спиной.', scene: 'luminos_throne', fx: 'flash' },
  ],
  // «Нет» — сразу концовка Прощения
  letter_refuse: [
    { who: 'ambassador', text: 'Нет?.. Я передам её величеству.' },
    { who: 'voice', text: 'Посол уходит. Камень гаснет. Люди отворачиваются, будто тебя здесь и не было.', set: { ending_forgiveness: true }, ending: 'forgiveness' },
  ],
  square_gate_locked: [
    { who: 'voice', text: 'Ворота дворца закрыты. Стража пускает только по приглашению королевы.' },
  ],

  // Двор Королевского дворца и кучер
  palace_yard: [
    { who: 'voice', text: 'Двор Королевского дворца. Белый камень, фонтаны, у ворот — повозка с гербом Люминоса.', set: { palace_yard_seen: true } },
  ],
  coachman: [
    { who: 'coachman', text: 'В деревню у Живительного ручья? Садитесь, {господин Герой|госпожа Героиня}. Дорога недальняя.', choices: [
      { text: 'Поехали.', next: 'coach_go' },
      { text: 'Подожди немного.', next: 'coach_wait' },
    ] },
  ],
  coach_go: [
    { who: 'voice', text: 'Колёса стучат по брусчатке, потом по просёлку. Белые башни Люминоса тают за холмами.', scene: 'village', at: [9, 6], dir: 'down' },
  ],
  coach_wait: [
    { who: 'coachman', text: 'Подожду. Лошади не торопятся — и я не буду.' },
  ],

  // ============================================================ ПАТЧ v2.5. Лес и Вожак Стаи
  forest_intro: [
    { who: 'voice', text: 'Восточный лес. Между стволами — серый туман, где-то воет волк. Потом ещё один. И ещё.', set: { forest_seen: true } },
    { who: 'voice', text: 'Стая. Не меньше пятнадцати.', toast: 'Волк приседает перед прыжком — уклоняйся! Shift — рывок' },
  ],
  forest_cleared: [
    { who: 'voice', text: 'Последний волк растворяется дымом. Лес затихает.' },
    { who: 'voice', text: 'Но с востока, от ручья, доносится низкий вой — глубже и злее остальных.', toast: 'У ручья ждёт вожак стаи' },
  ],
  note_1_after: [
    { who: 'hero', text: 'Д.Т.? Кто это… И откуда этот кто-то знал, что я буду здесь?' },
    { who: 'voice', text: 'Ты {убрал|убрала} записку и сосуд в сумку.', set: { note_1_taken: true, got_flask: true }, toast: 'Получено: Сосуд жизни. Набери в него воды из ручья' },
  ],
  hero_down_stream: [
    { who: 'voice', text: 'Темнота… Холодная вода на лице. Ты {очнулся|очнулась} у края ручья.' },
    { who: 'voice', text: 'Вожак кружит у воды. Отдышись — и попробуй снова.' },
  ],

  // ============================================================ ПАТЧ v2.5. Горы: разбойники
  bandits_ambush: [
    { who: 'voice', text: 'Северный перевал. Ветер свистит в скалах, дорога петляет между валунами.', set: { bandits_seen: true } },
    { who: 'bandit', text: 'Гляди-ка, {светлый|светлая}! Кошель, сапоги и что там ещё блестит — на землю!' },
    { who: 'bandit', text: 'Не хочешь? Ну, сам{|а} напросил{ся|ась}. Ребята!', toast: 'Разбойники! Четверо' },
  ],
  bandits_choice: [
    { who: 'voice', text: 'Разбойники валяются на камнях и стонут. Снизу по тропе поднимается патруль Люминоса.' },
    { who: 'patrol', text: 'Ого. Это вы их так? Что прикажете, {господин Герой|госпожа Героиня}?', choices: [
      { text: 'Связать и сдать страже. Пусть их судят.', set: { bandits_tied: true, bandits_done: true }, add: { path_hope: 1 }, next: 'bandits_tied' },
      { text: 'Сначала награда за поимку. Иначе отпущу их.', set: { bandits_bribed: true, bandits_done: true }, add: { path_power: 1, gold: 20 }, next: 'bandits_bribed' },
      { text: 'Добить.', set: { bandits_killed: true, bandits_done: true }, add: { path_hate: 1 }, next: 'bandits_killed' },
    ] },
  ],
  bandits_tied: [
    { who: 'patrol', text: 'Свяжем. Суд Люминоса справедлив — ну, почти всегда.' },
    { who: 'voice', text: 'Один из разбойников бормочет: «Спасибо, что живыми…»' },
  ],
  bandits_bribed: [
    { who: 'patrol', text: 'Это… не по уставу. Ладно, ладно! Двадцать золотых — и они наши.', toast: '💰 +20 золота' },
    { who: 'voice', text: 'Патрульные переглядываются. Ты {научился|научилась} покупать людей — и продавать тоже.' },
  ],
  bandits_killed: [
    { who: 'voice', text: 'Камни становятся красными. Патрульные отводят глаза и молча уходят вниз.' },
    { who: 'patrol', text: '…Да хранит вас Свет. Кому-то же он должен.' },
  ],
  hero_down_bandits: [
    { who: 'voice', text: 'Тебя сбрасывают с тропы. Ты {очнулся|очнулась} внизу, у подножия перевала.' },
    { who: 'voice', text: 'Сверху смеются. Они никуда не делись.' },
  ],

  // ============================================================ ПАТЧ v2.5. Берт: воровка, трущобы, торговая улица, тупик
  slums_locked: [
    { who: 'voice', text: 'Переулок уходит в трущобы. Тебе там нечего делать.' },
  ],
  bert_gate_locked: [
    { who: 'voice', text: 'Арка ведёт к воротам на Демин. Сначала разберись со своим кошелём.' },
  ],
  thief_lost: [
    { who: 'voice', text: 'Торговая улица. Толпа, крики зазывал, запах сдобы. Воровки нигде нет.', set: { street_lost: true } },
    { who: 'voice', text: 'Потерял{|а}. Только справа, из переулка за пекарней, доносится лязг стражи.', toast: 'Переулок — справа, за пекарней' },
  ],
  house_door: [{ who: 'voice', text: 'Ты стучишь. За дверью шаркают шаги — и замирают. Не откроют.' }],
  house_door2: [{ who: 'voice', text: 'На двери табличка: «Ушли на рынок. Воров не ждём».' }],
  bakery_door: [{ who: 'voice', text: 'Пекарня закрыта на обед. Даже дверь пахнет корицей.' }],
  alley_scene: [
    { who: 'voice', text: 'Тупик. Стража прижала к стене ту самую девчонку. Твой кошель — у неё в руках.', letterbox: true },
    { who: 'guard', text: 'Попалась, крыса! Чей кошель? Отвечай!' },
    { who: 'thief', text: 'Мой! …Ладно, не мой.' },
    { who: 'guard', text: 'А, вот и {хозяин|хозяйка}. Это ваш? Она у нас отправится в яму на месяц.' },
    { who: 'voice', text: 'Девчонка смотрит на тебя. Серые глаза — сухие, но очень просят.', choices: [
      { text: 'Это я сам{|а} дал{|а} ей денег.', set: { thief_saved: true, theft_done: true }, add: { path_hope: 1 }, next: 'alley_saved' },
      { text: 'Остаться в стороне.', set: { thief_left: true, theft_done: true, bert_password: true }, add: { path_power: 1, gold: '$stolen_gold' }, next: 'alley_left' },
    ] },
  ],
  alley_saved: [
    { who: 'guard', text: 'Сам{|а} дал{|а}? …Ну, как скажете. Гуляй, крыса.' },
    { who: 'voice', text: 'Стража уходит, ворча. Девчонка прижимает кошель к груди.' },
    { who: 'thief', text: 'Зачем?.. Ладно. Не важно. Спасибо.' },
    { who: 'thief', text: 'На воротах к Демину сейчас никого — стража гоняет таких, как я, по трущобам. Иди, пока пусто.', toast: 'Кошель остался у воровки. Путь к Демину — через арку на площади' },
  ],
  alley_left: [
    { who: 'voice', text: 'Ты молчишь. Стражник забирает кошель и бросает тебе.', toast: 'Кошель возвращён' },
    { who: 'thief', text: 'Ну и катись! …Эй! На воротах к Демину пароль — «Серый вереск». Может, хоть совесть у тебя заговорит, когда пройдёшь!' },
    { who: 'voice', text: 'Её уводят. Пароль от ворот теперь у тебя.', toast: 'Узнан пароль от ворот на Демин' },
  ],
  // Путь Ненависти: город почти пуст, воровку можно догнать
  thief_cornered: [
    { who: 'voice', text: 'Улица пуста. Девчонка вжимается в стену — бежать некуда.' },
    { who: 'thief', text: 'Н-не надо… Забирай, всё забирай!', choices: [
      { text: 'Убить.', set: { thief_killed: true, theft_done: true }, add: { path_hate: 1, gold: '$stolen_gold' }, next: 'thief_killed' },
      { text: 'Забрать кошель и уйти.', set: { thief_left: true, theft_done: true }, add: { gold: '$stolen_gold' }, next: 'thief_spared_hate' },
    ] },
  ],
  thief_killed: [
    { who: 'voice', text: 'Короткий вскрик. Кошель падает в грязь. Ты поднимаешь его — монеты липкие.', toast: 'Кошель возвращён' },
    { who: 'voice', text: 'Где-то наверху хлопают ставни. Берт видел.' },
  ],
  thief_spared_hate: [
    { who: 'voice', text: 'Ты вырываешь кошель. Девчонка сползает по стене и не смеет поднять глаз.', toast: 'Кошель возвращён' },
  ],

  // Ворота Берта на Демин
  bgate_empty: [
    { who: 'voice', text: 'Ворота на Демин распахнуты. Стражи нет — только ветер гоняет по камням обрывки объявлений.', set: { bgate_seen: true } },
    { who: 'voice', text: '«Разыскивается: воровка, серые глаза, каштановые волосы». Похоже, все ловят её в трущобах.' },
  ],
  bgate_intro: [
    { who: 'voice', text: 'Ворота Берта на Демин. Дорога за ними уходит в лес.', set: { bgate_seen: true } },
    { if: { path: 'hate' }, who: 'guard', text: 'Стой! Это {он|она}! С Северных врат… К оружию!', set: { bgate_fight: true }, toast: 'Стража ворот нападает' },
    { if: { not: { path: 'hate' } }, who: 'guard', text: 'Стой. Куда собрал{ся|ась}?' },
  ],
  bgate_guard: [
    { who: 'guard', text: 'Проход в Демин — по пропуску. Или по паролю. Или по… договорённости.', choices: [
      { if: { flag: 'bert_password' }, text: '«Серый вереск».', set: { demin_gate_open: true }, next: 'bgate_pass' },
      { if: { gte: ['gold', 15] }, text: 'Договоримся. (15 золотых)', add: { gold: -15, path_power: 1 }, set: { demin_gate_open: true }, next: 'bgate_paid' },
      { text: 'Пройду силой.', set: { bgate_fight: true }, next: 'bgate_fight_start' },
      { text: 'Уйти.' },
    ] },
  ],
  bgate_pass: [{ who: 'guard', text: 'Хм. Свежий пароль. Проходи.', toast: 'Ворота на Демин открыты' }],
  bgate_paid: [{ who: 'guard', text: 'Приятно иметь дело. Демин — прямо по дороге.', toast: '−15 золота. Ворота на Демин открыты' }],
  bgate_fight_start: [{ who: 'guard', text: 'Ну, сам{|а} выбрал{|а}!' }],
  bgate_cleared: [{ who: 'voice', text: 'Стража лежит у ворот. Створки открыты — путь на Демин свободен.' }],
  bgate_blocked: [{ who: 'voice', text: 'Стража перегородила ворота. Сначала поговори с ними.' }],

  // ============================================================ ПАТЧ v2.5. Демин и Храм Крови
  demin_intro: [
    { who: 'voice', text: 'Демин — город двух богов. Наверху справа — алый собор Марии, внизу — синие башни Ордена Диллада.', set: { demin_visited: true } },
    { who: 'voice', text: 'Здесь молятся крови и льду одновременно. И никто не спрашивает, кому больше.' },
  ],
  sign_demin: [
    { who: 'voice', text: 'Старик опирается на палку: «Собор Марии — наверху, за алыми ступенями. Орден Диллада — за ледяной аркой. А на север, к Лесу чувств, без благословения Марии не ходят».' },
  ],
  demin_north_locked: [
    { who: 'voice', text: 'Дорогу на север перекрыла храмовая стража: «Только с благословения Марии». Сначала — Храм Крови.' },
  ],
  blood_intro: [
    { who: 'voice', text: 'Высокие двери Храма Крови. Внутри пахнет воском, железом и розами.', set: { blood_seen: true } },
    { who: 'voice', text: 'Четверо служителей в красных плащах склоняют капюшоны. Никто не мешает пройти.' },
  ],
  cultist_door: [{ who: 'cultist', text: 'Мария видит всех входящих. И всех выходящих — тоже.' }],
  cultist_whisper: [{ who: 'cultist', text: '…кровь не лжёт… кровь не лжёт…' }],
  priest_hope_go: [
    { who: 'priest', text: 'Не жалей меня. Мария не любит жалости — до последнего мгновения.', toast: 'Покажи силу — и остановись вовремя' },
  ],
  priest_mercy: [
    { who: 'voice', text: 'Кассиан падает на колени у алтаря. Ещё удар — и всё.', letterbox: true },
    { who: 'priest', text: 'Ну?.. Сила — это когда можешь. Мария смотрит, что ты сделаешь.', choices: [
      { text: 'Опустить оружие. Пощадить.', set: { priest_spared: true, temple_done: true, temple_blood_cleared: true, mary_seal: true }, add: { path_hope: 1 }, next: 'priest_spared' },
      { text: 'Добить.', set: { temple_done: true, temple_blood_cleared: true, priest_beaten: true }, add: { path_hate: 1 }, next: 'priest_killed' },
    ] },
  ],
  priest_spared: [
    { who: 'priest', text: '…Мария улыбается. Редко она это делает.' },
    { who: 'priest', text: 'Держи печать Марии. С ней тебя пропустят на север, к Лесу чувств, и дальше — в столицу.', toast: 'Получено: печать Марии' },
    { who: 'hero', text: 'А та, что подписывается «Д.Т.»?' },
    { who: 'priest', text: 'Долита? Узнаешь. Она тебя уже знает.' },
  ],
  priest_killed: [
    { who: 'voice', text: 'Посох Кассиана катится по ступеням. Витражи Марии темнеют.' },
    { who: 'voice', text: 'С балкона за органом кто-то тихо вздыхает. Там никого.' },
  ],

  // ============================================================ ПАТЧ v2.5. Орден Диллада
  order_warrior: [{ who: 'order_warrior', text: 'Глава ждёт в ледяном зале. Не шуми — лёд слушает.' }],
  order_hall_intro: [
    { who: 'voice', text: 'Ледяной зал. Пар изо рта, голубые огоньки под сводами. В нишах — доспехи без хозяев.', set: { order_hall_seen: true } },
    { who: 'voice', text: 'Доспехи оборачиваются. Из-под шлемов — пустота и холодный свет.', toast: 'Призраки проходят сквозь стены. Стрелы и магия бьют их сильнее' },
  ],
  dane_mercy: [
    { who: 'voice', text: 'Дэйн опускается на колено. Копии тают. Ещё удар — и лёд треснет навсегда.', letterbox: true },
    { who: 'dane', text: 'Ну? Добей. Или докажи, что сила бывает тёплой.', choices: [
      { text: 'Опустить оружие.', set: { dane_defeated: true, dane_spared: true, order_dillad_cleared: true }, add: { path_hope: 1 }, next: 'dane_beaten' },
      { text: 'Добить.', set: { dane_defeated: true, order_dillad_cleared: true }, add: { path_hate: 1 }, next: 'dane_killed' },
    ] },
  ],
  dane_killed: [
    { who: 'voice', text: 'Иней на плаще Дэйна гаснет. Зал становится просто холодным.' },
    { who: 'voice', text: 'Благословения не будет. Лёд не прощает.' },
  ],

  // ============================================================ ПАТЧ v2.5. Лес призраков чувств и Древо Чувств
  feelings_intro: [
    { who: 'voice', text: 'Лес призраков чувств. Деревья светятся бледно-зелёным, а между ними бродят люди — прозрачные, как дыхание на стекле.', set: { ffor_seen: true } },
    { who: 'voice', text: 'Горожане Люминоса. Кто-то беззвучно смеётся, кто-то плачет. Тебя они не видят.' },
  ],
  tree_intro: [
    { who: 'voice', text: 'Древо Чувств. Огромное, старое, а из дупла льётся фиолетовый свет.', set: { ftree_seen: true } },
  ],
  tree_hollow: [
    { who: 'voice', text: 'В дупле — фиолетовый ящик. Внутри — пачка писем, перевязанных лентой, и странная игрушка: тряпичный рыцарь с пуговицами вместо глаз.' },
    { who: 'voice', text: 'Верхнее письмо не запечатано.', letter: 'tree' },
  ],
  tree_letter_after: [
    { who: 'hero', text: 'Элли… Г.Т.? Гидан Тенебрис?' },
    { who: 'voice', text: 'Ты {положил|положила} письмо обратно. Игрушку — тоже. Есть вещи, которые не берут.', set: { tree_letter_read: true }, toast: 'Прочитано: письмо из дупла' },
  ],
  tree_hollow_again: [
    { who: 'voice', text: 'Фиолетовый ящик, письма, тряпичный рыцарь. Всё на месте.' },
  ],

  // ============================================================ ПАТЧ v2.5. Столица и Ворота дворца
  capital_power: [
    { who: 'voice', text: 'Ноктюрн, столица Нокта. Чёрные шпили, фиолетовые фонари и запах дождя на брусчатке.', set: { capital_seen: true } },
    { who: 'voice', text: 'Говорят, дочь императора ходит молиться у ворот дворца без охраны. Говорят, стража у ворот любит золото.' },
  ],
  pgate_find_dolita: [
    { who: 'voice', text: 'Где-то здесь, за воротами, должна быть дочь императора. Найди её.' },
  ],
  pguard_power: [
    { who: 'guard', text: 'Стой. Пароль?' },
    { who: 'hero', text: 'Пароля нет. Есть золото.' },
    { who: 'guard', text: '…Сколько?', choices: [
      { if: { gte: ['gold', 20] }, text: 'Двадцать. И ты меня не видел.', add: { gold: -20, path_power: 1 }, set: { noc_palace_gates: true, palace_open: true }, next: 'pguard_bribed' },
      { if: { lt: ['gold', 20] }, text: 'Нисколько. Но император узнает, кто пускает во дворец кого попало.', add: { path_power: 1 }, set: { noc_palace_gates: true, palace_open: true }, next: 'pguard_bribed' },
      { text: 'Уйти.' },
    ] },
  ],
  pguard_bribed: [
    { who: 'guard', text: 'Я… ничего не видел. Рыцарь сегодня во дворце. Проходи.' },
    { who: 'voice', text: 'Ворота со скрипом открываются. За ними, на ступенях, сидит девушка в красном.', toast: 'Ворота открыты. Найди Долиту за воротами' },
  ],
  aedel_helm_off: [
    { who: 'voice', text: 'Удар срывает шлем. Белые волосы, треснувшие очки. Аэдел Анима.', fx: 'flash', set: { helm_broken: true } },
    { who: 'aedel', text: '…' },
    { if: { flag: 'dolita_spared' }, who: 'voice', text: 'Из-за колонны выбегает Долита с луком и молча встаёт рядом с ним.' },
    { who: 'voice', text: 'Он не говорит ни слова. Только бьёт — сильнее, и уходит от каждого второго удара.' },
  ],
  aedel_rage: [
    { who: 'voice', text: 'Аэдел срывает треснувшие очки. Голубое пламя на мече становится белым. Он больше не уклоняется — он просто идёт.', fx: 'flash' },
  ],
  gidan_wounded: [
    { who: 'voice', text: 'Тронный зал. Император Гидан сидит на ступенях трона, прижимая ладонь к боку. Сквозь пальцы — тёмная кровь.', set: { wounded_seen: true }, letterbox: true },
    { who: 'gidan', text: 'Вернул{ся|ась}… Конечно. Ты всегда возвращаешься.' },
    { who: 'gidan', text: 'Знаешь, что самое смешное? Для нас это жизнь. Сад, дочь, дождь над воротами. А для тебя наш мир — игра.' },
    { who: 'gidan', text: 'Ты нажимаешь кнопку — и кто-то падает. Ты закрываешь окно — и нас нет.' },
    { who: 'gidan', text: 'Иди. Покои за тронным залом. Посмотри, кого ты стёр{|ла}.' },
    { who: 'voice', text: 'Гидан закрывает глаза. Дыхание затихает.', scene: 'hate_palace', at: [19.5, 8], dir: 'left' },
  ],
};
