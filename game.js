/*
 * Путь Героя — top-down RPG на canvas 2D.
 * Карта из тайлов 64×64, герой с коллизиями, камера, диалоги с портретами,
 * флаги и сцены (локации), создание героя (пол + оружие), сохранение в localStorage.
 * Бой в реальном времени: меч (дуга), лук (стрелы), посох (магические шары); враги с ИИ.
 */
(() => {
  'use strict';

  const W = 1280, H = 720, T = 64;
  const SAVE_KEY = 'pg2_save';
  const META_KEY = 'pg2_meta';       // память между прохождениями: плохой путь, концовки (не стирается «новой игрой»)
  const HERO_SPEED = 230;            // px/с
  const TALK_DIST = 92;
  const HERO_HP = 100;               // максимум ОЗ (Святое сияние даёт +25)
  const FLASK_HEAL = 50;
  const DASH = { speed: 950, time: 0.16, inv: 0.3, cd: 1.0 };   // рывок: Shift; неуязвимость 0.3 с
  const MAX_MANA = 100;
  // уровни: всего опыта для уровня L — 10·L·(L−1); за уровень +10 ОЗ, +10% урона, рывок быстрее на 0.06 с
  const xpFor = (L) => 10 * L * (L - 1);

  // Враги: ОЗ, скорость, урон, прыжок с предупреждением «!»
  const ENEMIES = {
    // xp — опыт за победу; resist — сопротивление дальнему урону (стрелы и магия) у боссов; mana — очки маны
    wolf: { xp: 5, gold: 2, hp: 6, speed: 105, aggro: 360, dmg: 10, windup: 0.55, lunge: 480, lungeT: 0.3, rest: 0.7, w: 40, h: 18 },
    guard: { sprite: 'nokt_guard', xp: 8, gold: 5, hp: 12, speed: 90, aggro: 600, dmg: 12, windup: 0.5, lunge: 400, lungeT: 0.25, rest: 0.8, w: 34, h: 18 },
    priest: { sprite: 'priest', boss: 'Первосвященник Кассиан', xp: 50, resist: 0.35, hp: 40, speed: 85, keep: 260, aggro: 700, rest: 0.5, w: 34, h: 18,
      ranged: { every: 1.6, windup: 0.55, speed: 330, dmg: 10, count: 3, spread: 0.28 } },
    // Маги Света и Тьмы: держат дистанцию, бьют самонаводящимся сгустком, отпрыгивают от героя; дают очко маны
    mage_dark: { sprite: 'priest', tint: '#9a4aff', xp: 12, mana: 1, gold: 5, hp: 14, speed: 95, keep: 280, aggro: 650, rest: 0.6, w: 34, h: 18, blink: 3,
      ranged: { every: 1.8, windup: 0.6, speed: 300, dmg: 9, count: 1, spread: 0, color: '170,90,255', homing: 1.6 } },
    mage_light: { sprite: 'elder', tint: '#ffd86a', xp: 12, mana: 1, gold: 5, hp: 14, speed: 95, keep: 280, aggro: 650, rest: 0.6, w: 34, h: 18, blink: 3,
      ranged: { every: 1.8, windup: 0.6, speed: 300, dmg: 9, count: 1, spread: 0, color: '255,220,120', homing: 1.6 } },
    bellows: { art: 'bellows', static: true, xp: 2, hp: 10, w: 56, h: 28 },
    dolita_boss: { sprite: 'dolita', boss: 'Долита Тенебрис', xp: 60, resist: 0.35, hp: 45, speed: 150, aggro: 900, dmg: 14, windup: 0.45, lunge: 560, lungeT: 0.3, rest: 0.6, w: 34, h: 18,
      ranged: { every: 2.4, windup: 0.5, speed: 380, dmg: 10, count: 5, spread: 0.22 } },
    dark_knight: { boss: 'Тёмный рыцарь', xp: 50, resist: 0.3, hp: 60, speed: 135, aggro: 900, dmg: 14, windup: 0.5, lunge: 600, lungeT: 0.28, rest: 0.55, w: 34, h: 18,
      ranged: { every: 2.2, windup: 0.5, speed: 420, dmg: 10, count: 3, spread: 0.3, color: '90,180,255' } },
    // Путь Ненависти: рыцарь бьётся насмерть, после трещины в шлеме — Аэдел (и Долита, если её пощадили)
    dark_knight_h: { sprite: 'dark_knight', boss: 'Тёмный рыцарь', xp: 50, resist: 0.3, hp: 50, speed: 140, aggro: 900, dmg: 14, windup: 0.48, lunge: 600, lungeT: 0.28, rest: 0.5, w: 34, h: 18,
      ranged: { every: 2.2, windup: 0.5, speed: 420, dmg: 10, count: 3, spread: 0.3, color: '90,180,255' } },
    // Аэдел-мечник: уворачивается от половины ударов (dodge), сам делает рывок (dash), бьёт голубой волной до стены (wave — точек в волне)
    aedel_boss: { sprite: 'aedel', boss: 'Аэдел Анима', xp: 70, resist: 0.4, hp: 55, speed: 160, aggro: 900, dmg: 15, windup: 0.42, lunge: 650, lungeT: 0.28, rest: 0.5, w: 34, h: 18,
      dodge: 0.5, dash: { speed: 900, time: 0.18, cd: 2.2, at: 300 },
      ranged: { every: 2.5, windup: 0.6, speed: 420, dmg: 14, wave: 9, color: '120,200,255' } },
    // Орден Духа: призраки летают сквозь стены (ghost), стрелы и магия бьют их в 1.5 раза сильнее
    ghost: { sprite: 'nokt_guard', tint: '#bfe8ff', ghost: true, xp: 6, gold: 3, hp: 8, speed: 165, aggro: 800, dmg: 9, windup: 0.4, lunge: 520, lungeT: 0.25, rest: 0.6, w: 30, h: 16 },
    // Дэйн Филит: телепорт (blink), призрачные копии (copies), волны духа; слаб к Духу (weakSpirit — множитель урона)
    dane: { sprite: 'priest', tint: '#8fd8ff', boss: 'Дэйн Филит', xp: 60, resist: 0.3, hp: 55, speed: 110, keep: 240, aggro: 900, rest: 0.5, w: 34, h: 18,
      blink: 2.5, copies: { every: 9, n: 2 }, weakSpirit: 1.35,
      ranged: { every: 2.2, windup: 0.5, speed: 330, dmg: 11, wave: 5, color: '150,220,255' } },
    // Гидан — только на арене «Перчатки вызова»
    gidan_duel: { sprite: 'gidan', boss: 'Император Гидан', xp: 90, resist: 0.35, hp: 70, speed: 120, keep: 250, aggro: 900, rest: 0.5, w: 34, h: 18, blink: 3.5,
      ranged: { every: 1.6, windup: 0.5, speed: 340, dmg: 12, count: 3, spread: 0.3, color: '154,74,255', homing: 1.2 } },
    dane_copy: { sprite: 'priest', tint: '#8fd8ff', ghost: true, xp: 0, gold: 0, hp: 3, life: 8, speed: 175, aggro: 900, dmg: 8, windup: 0.45, lunge: 520, lungeT: 0.25, rest: 0.6, w: 30, h: 16 },
    dolita_ally: { sprite: 'dolita', xp: 20, gold: 0, hp: 20, speed: 140, keep: 240, aggro: 900, rest: 0.6, w: 34, h: 18,
      ranged: { every: 3, windup: 0.6, speed: 340, dmg: 8, count: 3, spread: 0.3 } },
    captain: { sprite: 'nokt_captain', xp: 15, gold: 5, hp: 22, speed: 80, aggro: 600, dmg: 16, windup: 0.7, lunge: 430, lungeT: 0.3, rest: 1.0, w: 40, h: 20 },
  };

  // Оружие влияет на спрайт и параметры боя (бой — на этапе 2)
  const WEAPONS = {
    // меч — риск ближнего боя; лук — запас стрел (ammo, +1 за regen с); посох — мана (manaCost из 100, +manaRegen/с) и каст (cast с стоя)
    sword: { name: 'Меч',   type: 'melee',  dmg: 3, range: 70,  cooldown: 0.35, info: 'Ближний бой. Быстрые удары, урон 3 — но враг рядом.' },
    bow:   { name: 'Лук',   type: 'arrow',  dmg: 4, range: 460, cooldown: 0.45, ammo: 6, regen: 2, info: 'Дальний бой, урон 4. 6 стрел, новая — раз в 2 с.' },
    staff: { name: 'Посох', type: 'magic',  dmg: 5, range: 340, cooldown: 0.8, cast: 0.25, manaCost: 20, manaRegen: 8, info: 'Магия, урон 5. Каст 0.25 с, тратит ману.' },
  };

  // Стихия Светлой магии — выбирается у королевы, даёт способность в бою
  const ELEMENTS = {
    sun:      { name: 'Солнечное пламя',  icon: '🔥', ability: 'Удары поджигают врагов: +1 к урону' },
    storm:    { name: 'Небесная молния',  icon: '⚡', ability: 'Оружие бьёт быстрее: перезарядка −25%' },
    radiance: { name: 'Святое сияние',    icon: '✨', ability: '+25 к максимуму ОЗ и медленное лечение' },
  };

  // ---------------------------------------------------------------- Карты (сцены)
  // # стена  T дерево  . трава  , тропа  ~ вода  f пол  D проход
  // # стена  W белая стена  G золотые ворота  T дерево  . трава  , тропа  ~ вода
  // f пол  m мрамор  r ковёр  F фонтан  P колонна  D проход
  // NPC/предметы: x,y в клетках (можно дробные — 7.5 = между клетками)
  // exits: { x, y, to, at, if, else } — переход; если условие не выполнено — диалог else
  const MAPS = {
    luminos_square: {
      title: 'Люминос · Площадь Светлого города',
      tiles: [
        'WWWWWWWWWWWGGWWWWWWWWWWW',
        'W..T...mmmmmmmmmm...T..W',
        'W......mmmmmmmmmm......W',
        'W......mmmmFFmmmm......W',
        'W..T...mmmmFFmmmm...T..W',
        'W......mmmmmmmmmm......W',
        'WmmmmmmmmmmmmmmmmmmmmmmW',
        'WmmmmmmmmmmmmmmmmmmmmmmW',
        'W......mmmmmmmmmm......W',
        'W..T...mmmmmmmmmm...T..W',
        'W......mmmmmmmmmm......W',
        'WWWWWWWWWWWDDWWWWWWWWWWW',
      ],
      spawn: [12, 9],
      exits: [
        { x: 11, y: 11, if: { flag: 'prologue_done' }, to: 'village', at: [1, 7.5], dir: 'right', else: 'square_locked' },
        { x: 12, y: 11, if: { flag: 'prologue_done' }, to: 'village', at: [1, 7.5], dir: 'right', else: 'square_locked' },
      ],
      npcs: [
        { id: 'white_stone', prop: 'stone', x: 12, y: 7.4,
          talk: [{ if: { flag: 'prologue_done' }, d: 'stone_silent' }, { d: 'stone_touch' }] },
        { id: 'mage_light', sprite: 'elder', tint: '#ffd86a', x: 4.5, y: 6.6, dir: 'right', if: [{ flag: 'prologue_done' }, { not: 'duel_light' }],
          talk: [{ if: { flag: 'mages_light_beaten' }, d: 'mage_light_after' }, { d: 'mage_light' }] },
      ],
      // маги Света — по вызову
      encounters: [{
        if: { flag: 'duel_light' },
        enemies: [{ kind: 'mage_light', x: 4.5, y: 6.6 }, { kind: 'mage_light', x: 19.5, y: 6.6 }],
        onClear: { set: { duel_light: false, mages_light_beaten: true }, d: 'mage_light_win' },
      }],
      onEnter: [{ if: { not: 'intro_seen' }, d: 'intro' }],
    },

    luminos_throne: {
      title: 'Люминос · Тронный зал',
      tiles: [
        'WWWWWWWWWWWWWWWW',
        'WmmmmmmrrmmmmmmW',
        'WmmPmmmrrmmmPmmW',
        'WmmmmmmrrmmmmmmW',
        'WmmPmmmrrmmmPmmW',
        'WmmmmmmrrmmmmmmW',
        'WmmPmmmrrmmmPmmW',
        'WmmmmmmrrmmmmmmW',
        'WmmPmmmrrmmmPmmW',
        'WmmmmmmrrmmmmmmW',
        'WWWWWWWDDWWWWWWW',
      ],
      spawn: [7.5, 8],
      exits: [
        { x: 7, y: 10, to: 'luminos_square', at: [9, 2], dir: 'down' },
        { x: 8, y: 10, to: 'luminos_square', at: [9, 2], dir: 'down' },
      ],
      npcs: [
        { id: 'throne', prop: 'throne', x: 7.5, y: 1.2 },
        { id: 'pl_guard1', sprite: 'nokt_guard', x: 6, y: 3.6, dir: 'up', if: { eq: ['power_scene', 'lumina'] } },
        { id: 'pl_guard2', sprite: 'nokt_guard', x: 9, y: 3.6, dir: 'up', if: { eq: ['power_scene', 'lumina'] } },
        { id: 'lumina', sprite: 'lumina', x: 7.5, y: 2.6, dir: 'down',
          talk: [{ if: { flag: 'prologue_done' }, d: 'queen_after' }, { d: 'queen_intro' }] },
      ],
      onEnter: [{ if: { eq: ['power_scene', 'lumina'] }, d: 'power_lumina' }, { if: { not: 'prologue_done' }, d: 'queen_intro' }],
    },

    // ============================================================ Этап 2
    village: {
      title: 'Деревня у Живительного ручья',
      tiles: [
        'TTTTTTTTTTTTT,,TTTTTTTTTTTTT',
        'T............,,............T',
        'T..T.........,,.........T..T',
        'T............,,............T',
        'T............,,............T',
        'T............,,............T',
        'T............,,............T',
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
        ',,,,,,,,,,,,,,,,,,,,,,,,,,,,',
        'T............,,............T',
        'T............,,............T',
        'T..T.........,,.........T..T',
        'T............,,............T',
        'T............,,............T',
        'T.......T....,,....T.......T',
        'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      ],
      spawn: [1, 7.5],
      exits: [
        { x: 0, y: 7, to: 'luminos_square', at: [11.5, 10], dir: 'up' },
        { x: 0, y: 8, to: 'luminos_square', at: [11.5, 10], dir: 'up' },
        { x: 27, y: 7, to: 'stream', at: [1, 7.5], dir: 'right' },
        { x: 27, y: 8, to: 'stream', at: [1, 7.5], dir: 'right' },
        { x: 13, y: 0, if: { flag: 'elder_rewarded' }, to: 'north_gate', at: [9.5, 23.5], dir: 'up', else: 'north_locked' },
        { x: 14, y: 0, if: { flag: 'elder_rewarded' }, to: 'north_gate', at: [9.5, 23.5], dir: 'up', else: 'north_locked' },
      ],
      npcs: [
        { id: 'house1', prop: 'house', x: 6, y: 5 },
        { id: 'house2', prop: 'house', x: 21, y: 5 },
        { id: 'house3', prop: 'house', x: 6, y: 13 },
        { id: 'house4', prop: 'house', x: 21, y: 13 },
        { id: 'sign', prop: 'sign', x: 2, y: 6.2, talk: [{ d: 'village_sign' }] },
        { id: 'darian', sprite: 'darian', x: 10.5, y: 9.4, dir: 'down', if: { not: 'city_seen' }, talk: [{ d: 'darian' }] },
        { id: 'elder', sprite: 'elder', x: 16.5, y: 6.4, dir: 'down',
          talk: [
            { if: { flag: 'elder_rewarded' }, d: 'elder_after' },
            { if: { flag: 'wolves_dead' }, d: 'elder_done' },
            { if: { flag: 'wolf_quest' }, d: 'elder_wait' },
            { d: 'elder_quest' },
          ] },
      ],
      onEnter: [{ if: { not: 'village_seen' }, d: 'village_intro' }],
    },

    stream: {
      title: 'Живительный ручей',
      tiles: [
        'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
        'T.......T...........~~~..T...T',
        'T..T.................~~~.....T',
        'T....................~~~..T..T',
        'T.........T.........~~~......T',
        'T...................~~~...T..T',
        'T,,,,,.............~~~.......T',
        ',,,,,,,,,,,,,,,,,,,~~~....T..T',
        ',,,,,..............~~~.......T',
        'T...................~~~...T..T',
        'T.....T.............~~~......T',
        'T....................~~~.....T',
        'T..T.................~~~..T..T',
        'T..........T........~~~......T',
        'T...................~~~......T',
        'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      ],
      spawn: [1, 7.5],
      exits: [
        { x: 0, y: 7, to: 'village', at: [26, 7.5], dir: 'left' },
        { x: 0, y: 8, to: 'village', at: [26, 7.5], dir: 'left' },
      ],
      npcs: [
        { id: 'spring', prop: 'spring', x: 18, y: 7.1,
          talk: [
            { if: [{ flag: 'got_flask' }, { not: 'has_water_flask' }], d: 'spring_fill' },
            { if: { flag: 'got_flask' }, d: 'spring_full' },
            { d: 'spring_drink' },
          ] },
        { id: 'note_1', prop: 'note', x: 17, y: 9.2, if: [{ flag: 'wolves_dead' }, { not: 'note_1_taken' }],
          talk: [{ d: 'note_1' }] },
      ],
      enemiesIf: { not: 'wolves_dead' },
      enemies: [
        { kind: 'wolf', x: 11, y: 4 }, { kind: 'wolf', x: 15, y: 6 },
        { kind: 'wolf', x: 10, y: 10 }, { kind: 'wolf', x: 15, y: 11 },
      ],
      onClear: { set: { wolves_dead: true }, d: 'wolves_cleared' },
      onEnter: [{ if: [{ not: 'wolves_dead' }, { not: 'stream_seen' }], d: 'stream_wolves' }],
    },
  };
  // ============================================================ Этап 3
  // R скала  K стена Нокта  N ворота (закрыты, пока нет north_gate_open)  d тёмная трава  g каменистая земля
  MAPS.north_gate = {
    title: 'Северные врата Нокт',
    ground: 'd',
    tiles: [
      'RRRRRRRRR,,RRRRRRRRR',
      'RRRRddddd,,dddddRRRR',
      'RRdddddTd,,ddddddTRR',
      'RRdTddddd,,ddddddddR',
      'RRddddddd,,dddTddddR',
      'RRddddddd,,ddddddddR',
      'RRddTdddd,,dddddTdRR',
      'RRddddddd,,ddddddddR',
      'RRddddddd,,ddddddddR',
      'RRddddddd,,ddddddddR',
      'KKKKKKKKKNNKKKKKKKKK',
      'RRggggggg,,gggggggRR',
      'RRggggggg,,gggggggRR',
      'RRggggggg,,ggggggggR',
      'RRgggRggg,,gggggggRR',
      'RRggggggg,,ggggRgggR',
      'RRggggggg,,gggggggRR',
      'RRRgggggg,,gggggggRR',
      'RRggggggg,,ggggggggR',
      'RRgggggRg,,gggggggRR',
      'RRggggggg,,gggggggRR',
      'RRRgggggg,,ggggggRRR',
      'RRggggggg,,gggggggRR',
      'RRggggggg,,gggggggRR',
      'RRRRggggg,,ggggRRRRR',
      'RRRRRRRRR,,RRRRRRRRR',
    ],
    spawn: [9.5, 23.5],
    exits: [
      { x: 9, y: 25, to: 'village', at: [13.5, 1], dir: 'down' },
      { x: 10, y: 25, to: 'village', at: [13.5, 1], dir: 'down' },
      { x: 9, y: 0, to: 'trade_city', at: [14.5, 18], dir: 'up' },
      { x: 10, y: 0, to: 'trade_city', at: [14.5, 18], dir: 'up' },
    ],
    npcs: [
      // у ворот, пока путь не выбран
      { id: 'captain', sprite: 'nokt_captain', x: 9.5, y: 11.5, dir: 'down', if: [{ not: 'gate_passed' }, { not: 'gate_fight' }], w: 60,
        talk: [{ if: { flag: 'gate_met' }, d: 'captain_again' }, { d: 'captain_intro' }] },
      { id: 'guard1', sprite: 'nokt_guard', x: 7.6, y: 11.8, dir: 'down', if: { not: 'gate_fight' } },
      { id: 'guard2', sprite: 'nokt_guard', x: 11.4, y: 11.8, dir: 'down', if: { not: 'gate_fight' } },
      { id: 'guard3', sprite: 'nokt_guard', x: 13.5, y: 13.2, dir: 'left', if: { not: 'gate_fight' } },
      // пропустили миром — капитан отошёл в сторону
      { id: 'captain_side', sprite: 'nokt_captain', x: 6.2, y: 12.4, dir: 'right', if: [{ flag: 'gate_passed' }, { not: 'gate_fight' }],
        talk: [{ if: { flag: 'gate_bribed' }, d: 'captain_after_power' }, { d: 'captain_after_hope' }] },
      // записка Д.Т. и красный бриллиант — только если никого не убил
      { id: 'note_2', prop: 'note', gem: true, x: 11.3, y: 7.6, if: [{ flag: 'gate_passed' }, { not: 'gate_fight' }, { not: 'note_2_taken' }],
        talk: [{ d: 'note_2' }] },
    ],
    enemiesIf: [{ flag: 'gate_fight' }, { not: 'gate_cleared' }],
    enemies: [
      { kind: 'captain', x: 9.5, y: 11.5 }, { kind: 'guard', x: 7.6, y: 11.8 },
      { kind: 'guard', x: 11.4, y: 11.8 }, { kind: 'guard', x: 13.5, y: 13.2 },
    ],
    onClear: { set: { gate_cleared: true, gate_passed: true, north_gate_open: true, note_2_taken: false }, add: { path_hate: 1 }, d: 'gate_cleared' },
    // после бойни на воротах — силуэт Тёмного рыцаря повторяет позу героя и молча исчезает
    apparition: { if: [{ flag: 'gate_cleared' }, { not: 'knight_seen' }], sprite: 'dark_knight', x: 9.5, y: 9.3, near: 13 * 64, set: 'knight_seen' },
    respawn: { map: 'north_gate', at: [9.5, 23.5], dir: 'up', d: 'hero_down_gate' },
    onEnter: [{ if: { not: 'gate_seen' }, d: 'gate_intro' }],
  };

  // ============================================================ Этап 4
  // c — брусчатка Нокта. Статуи четырёх богов вокруг фонтана, рынок на западе.
  MAPS.trade_city = {
    title: 'Нокт · Торговый город Мерцель',
    tiles: [
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'Kcccccccccccccccccccccccccccc,',
      'Kcccccccccccccccccccccccccccc,',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      ',cccccccccccccFFcccccccccccccK',
      ',cccccccccccccFFcccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccccccK',
      'KKKKKKKKKKKKKK,,KKKKKKKKKKKKKK',
    ],
    spawn: [14.5, 18],
    exits: [
      { x: 14, y: 19, to: 'north_gate', at: [9.5, 1], dir: 'down' },
      { x: 15, y: 19, to: 'north_gate', at: [9.5, 1], dir: 'down' },
      { x: 0, y: 9, if: { flag: 'theft_done' }, to: 'spirit_order', at: [18, 7.5], dir: 'left', else: 'order_locked' },
      { x: 0, y: 10, if: { flag: 'theft_done' }, to: 'spirit_order', at: [18, 7.5], dir: 'left', else: 'order_locked' },
      { x: 29, y: 4, if: { flag: 'theft_done' }, to: 'temple_nave', at: [8.5, 14], dir: 'up', else: 'city_east_locked' },
      { x: 29, y: 5, if: { flag: 'theft_done' }, to: 'temple_nave', at: [8.5, 14], dir: 'up', else: 'city_east_locked' },
    ],
    npcs: [
      { id: 'h1', prop: 'nhouse', x: 3.5, y: 2.6 }, { id: 'h2', prop: 'nhouse', x: 8.5, y: 2.6 },
      { id: 'h3', prop: 'nhouse', x: 21.5, y: 2.6 }, { id: 'h4', prop: 'nhouse', x: 26, y: 2.6 },
      { id: 'h5', prop: 'nhouse', x: 3.5, y: 17.6 }, { id: 'h6', prop: 'nhouse', x: 8.5, y: 17.6 },
      { id: 'h7', prop: 'nhouse', x: 21.5, y: 17.6 }, { id: 'h8', prop: 'nhouse', x: 26, y: 17.6 },
      { id: 'stall1', prop: 'stall', color: '#7b4fb0', x: 3.5, y: 8 },
      { id: 'stall2', prop: 'stall', color: '#2f8a5a', x: 3.5, y: 12 },
      { id: 'stall3', prop: 'stall', color: '#b03040', x: 25, y: 13 },
      { id: 'merchant', sprite: 'merchant', x: 5.6, y: 10, dir: 'left', talk: [{ d: 'merchant' }] },
      { id: 'keeper', sprite: 'keeper', x: 14.5, y: 7.4, dir: 'down',
        talk: [{ if: { flag: 'theft_done' }, d: 'keeper_after' }, { d: 'keeper' }] },
      { id: 'st_gilion', prop: 'statue', color: '#9a5ce0', x: 11.5, y: 7.5, talk: [{ d: 'statue_gilion' }] },
      { id: 'st_maria', prop: 'statue', color: '#d02a3a', x: 18.5, y: 7.5, talk: [{ d: 'statue_maria' }] },
      { id: 'st_eola', prop: 'statue', color: '#3cc46a', x: 11.5, y: 12.3, talk: [{ d: 'statue_eola' }] },
      { id: 'st_dillad', prop: 'statue', color: '#5ab8f0', x: 18.5, y: 12.3, talk: [{ d: 'statue_dillad' }] },
      { id: 'sign_temple', prop: 'sign', x: 27.5, y: 6.2, talk: [{ d: 'sign_temple' }] },
      { id: 'sign_order', prop: 'sign', x: 1.6, y: 8.2, talk: [{ d: 'sign_order' }] },
      { id: 'darian', sprite: 'darian', x: 23.3, y: 13.4, dir: 'left', talk: [{ d: 'darian' }] },
      { id: 'polianna', sprite: 'polianna', x: 26.5, y: 8.4, dir: 'left', talk: [{ d: 'polianna' }] },
    ],
    // зона: дошёл до площади — у героя крадут кошель
    triggers: [{ if: { not: 'theft_done' }, maxY: 14.6 * 64, d: 'theft' }],
    // погоня за воровкой: бежит по точкам и исчезает на востоке, к храму
    chase: {
      sprite: 'stranger', speed: 220, sprint: 1.5, catchDist: 46, caught: 'thief_caught', escaped: 'thief_escaped',
      path: [[16, 14.6], [22, 14.6], [22, 6], [13, 5.5], [8, 6], [8, 14.6], [13, 15.8], [24, 15.8], [27.5, 13.5], [27.5, 5], [29.6, 4.9]],
    },
    onEnter: [{ if: { not: 'city_seen' }, d: 'city_intro' }],
  };

  // ============================================================ Этап 5. Храм Кровавой Марии
  // X стена храма  q тёмный пол  E дверной проём  B книжный шкаф
  MAPS.temple_nave = {
    title: 'Храм Кровавой Марии',
    ground: 'q',
    tiles: [
      'XXXXXXXXEEXXXXXXXX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqPqqqqrrqqqqPqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqqqqqqrrqqqqqqqX',
      'EqqPqqqqrrqqqqPqqE',
      'EqqqqqqqrrqqqqqqqE',
      'XqqqqqqqrrqqqqqqqX',
      'XqqPqqqqrrqqqqPqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqPqqqqrrqqqqPqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XqqqqqqqrrqqqqqqqX',
      'XXXXXXXXEEXXXXXXXX',
    ],
    spawn: [8.5, 14],
    exits: [
      { x: 8, y: 15, to: 'trade_city', at: [28, 4.6], dir: 'left' },
      { x: 9, y: 15, to: 'trade_city', at: [28, 4.6], dir: 'left' },
      // Надежда и Ненависть ведут в столицу; Власть — пока заглушка stage5_end
      { x: 8, y: 0, if: [{ flag: 'temple_done' }, { in: ['temple_path', ['hope', 'hate']] }], to: 'nokt_capital', at: [12.5, 16], dir: 'up', else: 'temple_back' },
      { x: 9, y: 0, if: [{ flag: 'temple_done' }, { in: ['temple_path', ['hope', 'hate']] }], to: 'nokt_capital', at: [12.5, 16], dir: 'up', else: 'temple_back' },
      { x: 17, y: 6, if: { flag: 'priest_fled' }, to: 'organ_hall', at: [1.3, 6.5], dir: 'right', else: 'door_locked' },
      { x: 17, y: 7, if: { flag: 'priest_fled' }, to: 'organ_hall', at: [1.3, 6.5], dir: 'right', else: 'door_locked' },
      { x: 0, y: 6, if: { flag: 'dolita_beaten' }, to: 'gidan_study', at: [10, 4.5], dir: 'left', else: 'door_locked' },
      { x: 0, y: 7, if: { flag: 'dolita_beaten' }, to: 'gidan_study', at: [10, 4.5], dir: 'left', else: 'door_locked' },
    ],
    npcs: [
      { id: 'altar', prop: 'altar', x: 8.5, y: 2.1, talk: [{ d: 'altar_offer' }] },
      { id: 'mirror', prop: 'mirror', x: 2, y: 1.2, talk: [{ d: 'mirror_hint' }] },
      { id: 'pew1', prop: 'pew', x: 5.5, y: 9.6 }, { id: 'pew2', prop: 'pew', x: 5.5, y: 11.6 },
      { id: 'pew3', prop: 'pew', x: 12.2, y: 9.6 }, { id: 'pew4', prop: 'pew', x: 12.2, y: 11.6 },
      { id: 'priest', sprite: 'priest', x: 8.5, y: 3.4, dir: 'down', if: [{ not: 'priest_fight' }, { not: 'priest_fled' }],
        talk: [
          { if: { flag: 'temple_done' }, d: 'priest_after_hope' },
          { if: { eq: ['temple_path', 'hope'] }, d: 'priest_hope' },
          { if: { eq: ['temple_path', 'power'] }, d: 'priest_power' },
          { d: 'priest_hate' },
        ] },
      { id: 'tguard1', sprite: 'nokt_guard', x: 6.3, y: 3.8, dir: 'down', if: [{ not: 'priest_fight' }, { not: 'priest_fled' }] },
      { id: 'tguard2', sprite: 'nokt_guard', x: 10.7, y: 3.8, dir: 'down', if: [{ not: 'priest_fight' }, { not: 'priest_fled' }] },
      { id: 'mage_dark', sprite: 'priest', tint: '#9a4aff', x: 2.2, y: 13.4, dir: 'right', if: { not: 'duel_dark' },
        talk: [{ if: { flag: 'mages_dark_beaten' }, d: 'mage_dark_after' }, { d: 'mage_dark' }] },
    ],
    // Путь Власти: бой с Первосвященником; маги Тьмы — по вызову
    encounters: [{
      if: [{ flag: 'priest_fight' }, { not: 'priest_beaten' }],
      enemies: [{ kind: 'priest', x: 8.5, y: 3.4 }, { kind: 'guard', x: 6.3, y: 3.4 }, { kind: 'guard', x: 10.7, y: 3.4 }],
      onClear: { set: { priest_beaten: true, temple_done: true }, d: 'priest_beaten' },
    }, {
      if: { flag: 'duel_dark' },
      enemies: [{ kind: 'mage_dark', x: 2.2, y: 13 }, { kind: 'mage_dark', x: 15, y: 13 }],
      onClear: { set: { duel_dark: false, mages_dark_beaten: true }, d: 'mage_dark_win' },
    }],
    respawn: { map: 'temple_nave', at: [8.5, 14], dir: 'up', d: 'hero_down_temple' },
    onEnter: [{ if: { not: 'temple_seen' }, d: 'temple_intro' }],
  };

  // Органный зал: Долита на балконе у органа, пол заливает кровью
  MAPS.organ_hall = {
    title: 'Храм · Органный зал',
    ground: 'q',
    tiles: [
      'XXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXX',
      'XqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'EqqqqqqqqqqqqqqqqX',
      'EqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'XqqqqqqqqqqqqqqqqX',
      'XXXXXXXXXXXXXXXXXX',
    ],
    spawn: [1.3, 6.5],
    exits: [
      { x: 0, y: 6, if: { not: 'organ_fight' }, to: 'temple_nave', at: [16, 6.5], dir: 'left', else: 'organ_no_escape' },
      { x: 0, y: 7, if: { not: 'organ_fight' }, to: 'temple_nave', at: [16, 6.5], dir: 'left', else: 'organ_no_escape' },
    ],
    npcs: [
      { id: 'organ', prop: 'organ', x: 8.5, y: 1.9, w: 0, h: 0 },
      { id: 'dolita_balcony', sprite: 'dolita', x: 8.5, y: 2.1, dir: 'down', w: 0, h: 0, if: { not: 'organ_broken' } },
      { id: 'dolita_down', sprite: 'dolita', x: 8.5, y: 6, dir: 'down', if: [{ flag: 'dolita_beaten' }, { not: 'dolita_dead' }, { not: 'dolita_spared' }],
        talk: [{ d: 'dolita_defeated' }] },
    ],
    encounters: [
      { if: [{ flag: 'organ_fight' }, { not: 'organ_broken' }],
        enemies: [{ kind: 'bellows', x: 3, y: 4 }, { kind: 'bellows', x: 14, y: 4 }, { kind: 'bellows', x: 8.5, y: 10 }],
        onClear: { set: { organ_broken: true }, d: 'dolita_jumps' } },
      { if: [{ flag: 'organ_broken' }, { not: 'dolita_beaten' }],
        enemies: [{ kind: 'dolita_boss', x: 8.5, y: 4 }],
        onClear: { set: { dolita_beaten: true, organ_fight: false }, d: 'dolita_defeated' } },
    ],
    // красная жидкость заливает пол по очереди: левая/правая половина, верх/низ, полосы
    hazard: {
      if: { flag: 'organ_fight' }, warn: 1.3, flood: 2.2, rest: 1.0, dmg: 6,
      patterns: [
        [[1, 3, 8, 11]], [[9, 3, 16, 11]], [[1, 3, 16, 6]], [[1, 8, 16, 11]],
        [[1, 3, 4, 11], [9, 3, 12, 11]], [[5, 3, 8, 11], [13, 3, 16, 11]],
      ],
    },
    respawn: { map: 'organ_hall', at: [1.3, 6.5], dir: 'right', d: 'hero_down_organ' },
    onEnter: [{ if: { not: 'organ_seen' }, d: 'dolita_organ' }],
  };

  // Покои императора при храме: письмо Люмины среди бумаг
  MAPS.gidan_study = {
    title: 'Храм · Покои императора',
    tiles: [
      'XXXXXXXXXXXX',
      'XBBBBXXBBBBX',
      'XqqqqqqqqqqX',
      'XqqrrrrrrqqX',
      'XqqrrrrrrqqE',
      'XqqrrrrrrqqE',
      'XqqqqqqqqqqX',
      'XqqqqqqqqqqX',
      'XXXXXXXXXXXX',
    ],
    spawn: [10, 4.5],
    exits: [
      { x: 11, y: 4, to: 'temple_nave', at: [1.2, 6.5], dir: 'right' },
      { x: 11, y: 5, to: 'temple_nave', at: [1.2, 6.5], dir: 'right' },
    ],
    npcs: [
      { id: 'pg_portrait', prop: 'portrait', who: 'gidan', x: 8.5, y: 1, if: { eq: ['power_scene', 'gidan'] } },
      { id: 'pg_gidan', sprite: 'gidan', x: 7, y: 3.4, dir: 'down', if: { eq: ['power_scene', 'gidan'] } },
      { id: 'pg_aedel', sprite: 'aedel', x: 8.3, y: 3.6, dir: 'left', if: { eq: ['power_scene', 'gidan'] } },
      { id: 'desk', prop: 'desk', x: 5.5, y: 2.4, talk: [{ if: { flag: 'lumina_letter_read' }, d: 'desk_again' }, { d: 'lumina_letter' }] },
    ],
    onEnter: [{ if: { eq: ['power_scene', 'gidan'] }, d: 'power_gidan' }, { if: { not: 'study_seen' }, d: 'study_intro' }],
  };

  // ============================================================ Этап 6. Столица Нокт (Путь Надежды)
  // o тёмный мрамор дворца  h клумба  V ворота дворца (открываются флагом palace_open)
  MAPS.nokt_capital = {
    rainStart: true,                                  // вышли из храма — начинается дождь
    title: 'Нокт · Столица Ноктюрн',
    tiles: [
      'KKKKKKKKKKKK,,KKKKKKKKKKKK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      ',cccccccccccFFcccccccccccK',
      ',cccccccccccFFcccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KccccccccccccccccccccccccK',
      'KKKKKKKKKKKK,,KKKKKKKKKKKK',
    ],
    spawn: [12.5, 16],
    exits: [
      { x: 12, y: 17, to: 'temple_nave', at: [8.5, 1.2], dir: 'down' },
      { x: 13, y: 17, to: 'temple_nave', at: [8.5, 1.2], dir: 'down' },
      { x: 0, y: 8, if: { flag: 'dolita_led' }, to: 'nokt_garden', at: [22, 7.6], dir: 'left', else: 'capital_west_locked' },
      { x: 0, y: 9, if: { flag: 'dolita_led' }, to: 'nokt_garden', at: [22, 7.6], dir: 'left', else: 'capital_west_locked' },
      { x: 12, y: 0, to: 'palace_gate', at: [7.5, 12], dir: 'up' },
      { x: 13, y: 0, to: 'palace_gate', at: [7.5, 12], dir: 'up' },
    ],
    npcs: [
      { id: 'h1', prop: 'nhouse', x: 3.5, y: 2.6 }, { id: 'h2', prop: 'nhouse', x: 8, y: 2.6 },
      { id: 'h3', prop: 'nhouse', x: 17, y: 2.6 }, { id: 'h4', prop: 'nhouse', x: 21.5, y: 2.6 },
      { id: 'h5', prop: 'nhouse', x: 3.5, y: 15.6 }, { id: 'h6', prop: 'nhouse', x: 21.5, y: 15.6 },
      { id: 'cguard1', sprite: 'nokt_guard', x: 10.8, y: 1.6, dir: 'down', talk: [{ d: 'capital_guard' }] },
      { id: 'cguard2', sprite: 'nokt_guard', x: 14.2, y: 1.6, dir: 'down', talk: [{ d: 'capital_guard' }] },
      { id: 'citizen', sprite: 'merchant', x: 19, y: 10.5, dir: 'left', talk: [{ if: { eq: ['temple_path', 'hate'] }, d: 'capital_citizen_hate' }, { d: 'capital_citizen' }] },
      { id: 'dolita_capital', sprite: 'dolita', x: 12.5, y: 12.5, dir: 'down', if: [{ not: 'dolita_led' }, { eq: ['temple_path', 'hope'] }], talk: [{ d: 'capital_dolita' }] },
      { id: 'sign_garden', prop: 'sign', x: 1.6, y: 7.2, talk: [{ d: 'sign_garden' }] },
      { id: 'polianna', sprite: 'polianna', x: 4.5, y: 11.4, dir: 'right', talk: [{ d: 'polianna' }] },
      { id: 'darian', sprite: 'darian', x: 21.2, y: 13.4, dir: 'left', talk: [{ d: 'darian' }] },
    ],
    onEnter: [
      { if: [{ not: 'capital_seen' }, { eq: ['temple_path', 'hate'] }], d: 'capital_hate' },
      { if: { not: 'capital_seen' }, d: 'capital_intro' },
    ],
  };

  // Сад у озера: мини-игры за пароль, позже — свадьба
  MAPS.nokt_garden = {
    title: 'Нокт · Лунный сад',
    ground: 'd',
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TdddhhdddddddddddddhhddT',
      'TddddddddddddddddddddddT',
      'Tdd~~~~~~~ddddddddhhdddT',
      'Td~~~~~~~~~ddddddddddddT',
      'Td~~~~~~~~~ddddTdddddddT',
      'Tdd~~~~~~~dddddddddddddT',
      'Tdddd~~~ddddddd,,,,,,,,,',
      'Tddddddddddddd,,,,,,,,,,',
      'TddhddddddddddddddddhddT',
      'TddddddTddddddddddTddddT',
      'TdhhdddddddddddddddddhhT',
      'TddddddddddddddddddddddT',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    spawn: [22, 7.6],
    exits: [
      { x: 23, y: 7, to: 'nokt_capital', at: [1, 8.6], dir: 'right' },
      { x: 23, y: 8, to: 'nokt_capital', at: [1, 8.6], dir: 'right' },
    ],
    npcs: [
      { id: 'pw_arch', prop: 'arch', x: 16.5, y: 4.4, if: { eq: ['power_scene', 'wedding'] } },
      { id: 'pw_dolita', sprite: 'dolita', x: 16, y: 5.2, dir: 'down', if: { eq: ['power_scene', 'wedding'] } },
      { id: 'pw_gidan', sprite: 'gidan', x: 13.6, y: 6.4, dir: 'right', if: { eq: ['power_scene', 'wedding'] } },
      { id: 'pw_aedel', sprite: 'aedel', x: 19.5, y: 6.4, dir: 'left', if: { eq: ['power_scene', 'wedding'] } },
      { id: 'pw_guard', sprite: 'nokt_guard', x: 19.5, y: 9.4, dir: 'up', if: { eq: ['power_scene', 'wedding'] } },
      { id: 'pd_stone', prop: 'stone', x: 16.5, y: 5.4, if: { eq: ['power_scene', 'dolita'] } },
      { id: 'dolita_garden', sprite: 'dolita', x: 9, y: 8, dir: 'left', if: [{ not: 'wedding' }, { not: 'power_scene' }],
        talk: [{ if: { flag: 'palace_password' }, d: 'garden_after' }, { d: 'garden_games' }] },
      // свадьба Долиты и Аэдела
      { id: 'arch', prop: 'arch', x: 16.5, y: 4.4, if: { flag: 'wedding' } },
      { id: 'w_dolita', sprite: 'dolita', x: 16, y: 5.2, dir: 'down', if: { flag: 'wedding' } },
      { id: 'w_aedel', sprite: 'aedel', x: 17, y: 5.2, dir: 'down', if: { flag: 'wedding' } },
      { id: 'w_gidan', sprite: 'gidan', x: 13.6, y: 6.4, dir: 'right', if: { flag: 'wedding' } },
      { id: 'w_priest', sprite: 'priest', x: 16.5, y: 3.6, dir: 'down', if: { flag: 'wedding' } },
      { id: 'w_guard1', sprite: 'nokt_guard', x: 19.5, y: 6.4, dir: 'left', if: { flag: 'wedding' } },
      { id: 'w_keeper', sprite: 'keeper', x: 19.5, y: 9.4, dir: 'up', if: { flag: 'wedding' } },
      { id: 'w_elder', sprite: 'elder', x: 13.6, y: 9.4, dir: 'up', if: { flag: 'wedding' } },
    ],
    onEnter: [
      { if: { eq: ['power_scene', 'wedding'] }, d: 'power_wedding' },
      { if: { eq: ['power_scene', 'dolita'] }, d: 'power_dolita_end' },
      { if: [{ flag: 'wedding' }, { not: 'wedding_seen' }], d: 'wedding' },
      { if: { not: 'garden_seen' }, d: 'garden_intro' },
    ],
  };

  // Ворота дворца: пароль, Тёмный рыцарь, в середине боя его останавливает Долита
  // Арена «Перчатки вызова» (этап F): противники появляются из DUELS, выход — через дверь внизу
  MAPS.arena = {
    title: 'Арена вызова',
    ground: 'o',
    tiles: [
      'KKKKKKKKKKKKKKKK',
      'KooooooooooooooK',
      'KooooooooooooooK',
      'KooPooooooooPooK',
      'KooooooooooooooK',
      'KooooooooooooooK',
      'KooPooooooooPooK',
      'KooooooooooooooK',
      'KooooooooooooooK',
      'KKKKKKKooKKKKKKK',
    ],
    spawn: [7.5, 8],
    exits: [{ x: 7, y: 9, d: 'duel_leave' }, { x: 8, y: 9, d: 'duel_leave' }],
    npcs: [],
  };

  // Орден Духа (этап E): ледяной зал Диллада — призраки, потом Дэйн Филит
  MAPS.spirit_order = {
    title: 'Орден Духа · Ледяной зал',
    ground: 'i',
    tiles: [
      'IIIIIIIIIIIIIIIIIIII',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiPiiiiiiiiiiiiPiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'Iiiiiiiiiiiiiiiiiiii',
      'Iiiiiiiiiiiiiiiiiiii',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiPiiiiiiiiiiiiPiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'IiiiiiiiiiiiiiiiiiiI',
      'IIIIIIIIIIIIIIIIIIII',
    ],
    spawn: [18, 7.5],
    exits: [
      { x: 19, y: 6, to: 'trade_city', at: [1, 9.5], dir: 'right' },
      { x: 19, y: 7, to: 'trade_city', at: [1, 9.5], dir: 'right' },
    ],
    npcs: [
      { id: 'st_dillad_order', prop: 'statue', color: '#5ab8f0', x: 9.5, y: 1.6, talk: [{ d: 'statue_dillad' }] },
      { id: 'dane', sprite: 'priest', tint: '#8fd8ff', x: 9.5, y: 3.2, dir: 'down', if: [{ flag: 'order_ghosts_clear' }, { not: 'dane_fight' }],
        talk: [{ if: { flag: 'dane_defeated' }, d: 'dane_after' }, { d: 'dane' }] },
      { id: 'polianna', sprite: 'polianna', x: 16.5, y: 11.4, dir: 'left', talk: [{ d: 'polianna' }] },
    ],
    encounters: [{
      if: [{ flag: 'order_seen' }, { not: 'order_ghosts_clear' }],
      enemies: [{ kind: 'ghost', x: 4, y: 4 }, { kind: 'ghost', x: 15, y: 4 }, { kind: 'ghost', x: 4, y: 10 }, { kind: 'ghost', x: 15, y: 10 }],
      onClear: { set: { order_ghosts_clear: true }, d: 'order_ghosts_clear' },
    }, {
      if: [{ flag: 'dane_fight' }, { not: 'dane_defeated' }], lock: true,
      enemies: [{ kind: 'dane', x: 9.5, y: 3.2 }],
      onClear: { set: { dane_defeated: true, dane_fight: false }, d: 'dane_beaten' },
    }],
    respawn: { map: 'spirit_order', at: [18, 7.5], dir: 'left', d: 'hero_down_order' },
    onEnter: [{ if: { not: 'order_seen' }, d: 'order_intro' }],
  };

  MAPS.palace_gate = {
    title: 'Нокт · Ворота дворца',
    ground: 'c',
    tiles: [
      'KKKKKKKVVKKKKKKK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccPccccccccPccK',                            // колонны — укрытие от волн Аэдела
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccPccccccccPccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KKKKKKK,,KKKKKKK',
    ],
    spawn: [7.5, 12],
    exits: [
      { x: 7, y: 13, to: 'nokt_capital', at: [12.5, 1.2], dir: 'down' },
      { x: 8, y: 13, to: 'nokt_capital', at: [12.5, 1.2], dir: 'down' },
      { x: 7, y: 0, to: 'palace_throne', at: [7.5, 11.5], dir: 'up' },
      { x: 8, y: 0, to: 'palace_throne', at: [7.5, 11.5], dir: 'up' },
    ],
    npcs: [
      { id: 'pa_aedel', sprite: 'aedel', x: 7.5, y: 4.2, dir: 'down', if: { eq: ['power_scene', 'aedel'] } },
      { id: 'pa_stone', sprite: 'dark_knight', tint: '#8a8a90', x: 6.2, y: 4, dir: 'right', if: { eq: ['power_scene', 'aedel'] } },
      { id: 'pa_dolita', sprite: 'dolita', x: 10.5, y: 6.6, dir: 'left', if: { eq: ['power_scene', 'aedel'] } },
      { id: 'pa_guard1', sprite: 'nokt_guard', x: 4.5, y: 6.2, dir: 'right', if: { eq: ['power_scene', 'aedel'] } },
      { id: 'pa_guard2', sprite: 'nokt_guard', x: 11.6, y: 4.2, dir: 'left', if: { eq: ['power_scene', 'aedel'] } },
      { id: 'pguard', sprite: 'nokt_guard', x: 10.5, y: 2.2, dir: 'down', if: [{ not: 'hgate_seen' }, { not: 'power_scene' }], talk: [{ if: { flag: 'palace_open' }, d: 'pguard_open' }, { if: { flag: 'palace_password' }, d: 'pguard_pass' }, { d: 'pguard' }] },
      { id: 'knight', sprite: 'dark_knight', x: 7.5, y: 2.2, dir: 'down', if: [{ not: 'knight_fight' }, { not: 'hknight_fight' }, { not: 'power_scene' }], talk: [{ d: 'knight_silent' }] },
      // бой остановлен: рыцарь опускает меч (knight_halt), затем снимает шлем (knight_stopped)
      { id: 'knight_halt', sprite: 'dark_knight', x: 7.5, y: 3.4, dir: 'down', if: [{ flag: 'knight_halt' }, { not: 'knight_stopped' }] },
      { id: 'g_aedel', sprite: 'aedel', x: 7.5, y: 3.4, dir: 'down', if: { flag: 'knight_stopped' }, talk: [{ d: 'aedel_gate_after' }] },
      { id: 'g_dolita', sprite: 'dolita', x: 9, y: 3.7, dir: 'left', if: { flag: 'knight_halt' }, talk: [{ d: 'dolita_gate_after' }] },
    ],
    encounters: [{
      if: [{ flag: 'knight_fight' }, { not: 'knight_halt' }],
      enemies: [{ kind: 'dark_knight', x: 7.5, y: 2.6 }],
      stopAt: 0.5,                                   // на половине ОЗ бой прерывает Долита
      onStop: { set: { knight_halt: true }, d: 'knight_unmask', at: [7.5, 5.6], dir: 'up' },
    }, {
      // Путь Ненависти, фаза 1: Тёмный рыцарь
      if: [{ flag: 'hknight_fight' }, { not: 'helm_broken' }], lock: true,
      enemies: [{ kind: 'dark_knight_h', x: 7.5, y: 2.6 }],
      onClear: { set: { helm_broken: true }, d: 'helm_broken' },
    }, {
      // фаза 2: Аэдел без шлема; пощажённая Долита встаёт рядом с ним
      if: [{ flag: 'helm_broken' }, { not: 'aedel_beaten' }], lock: true,      // двери заперты до конца боя
      enemies: [{ kind: 'aedel_boss', x: 7.5, y: 3 }, { kind: 'dolita_ally', x: 10.5, y: 3, if: { flag: 'dolita_spared' } }],
      onClear: { set: { aedel_beaten: true, palace_open: true }, add: { path_hate: 1 }, d: 'aedel_defeated' },
    }],
    respawn: { map: 'palace_gate', at: [7.5, 12], dir: 'up', d: 'hero_down_knight' },
    onEnter: [
      { if: { eq: ['power_scene', 'aedel'] }, d: 'power_aedel' },
      { if: [{ eq: ['temple_path', 'hate'] }, { not: 'hgate_seen' }], d: 'hate_gate_intro' },
      { if: { not: 'pgate_seen' }, d: 'pgate_intro' },
    ],
  };

  MAPS.palace_throne = {
    entry: 'letterbox',                               // вход — полосы letterbox
    title: 'Дворец Нокта · Тронный зал',
    ground: 'o',
    tiles: [
      'KKKKKKKKKKKKKKKK',
      'KoooooorrooooooK',
      'KoooooorrooooooK',
      'KooPooorroooPooK',
      'KoooooorrooooooK',
      'KoooooorrooooooK',
      'KooPooorroooPooK',
      'KoooooorrooooooK',
      'KoooooorrooooooK',
      'KooPooorroooPooK',
      'KoooooorrooooooK',
      'KoooooorrooooooK',
      'KKKKKKK,,KKKKKKK',
    ],
    spawn: [7.5, 11.5],
    exits: [
      { x: 7, y: 12, to: 'palace_gate', at: [7.5, 1.4], dir: 'down' },
      { x: 8, y: 12, to: 'palace_gate', at: [7.5, 1.4], dir: 'down' },
    ],
    npcs: [
      { id: 'nthrone', prop: 'nthrone', x: 7.5, y: 1.2 },
      { id: 't_gidan', sprite: 'gidan', x: 7.5, y: 2.4, dir: 'down', if: { not: 'gidan_gone' }, talk: [{ if: { eq: ['temple_path', 'hope'] }, d: 'gidan_after' }] },
      { id: 't_aedel', sprite: 'aedel', x: 5.2, y: 3.4, dir: 'down', if: { eq: ['temple_path', 'hope'] } },
      { id: 'p_aedel', sprite: 'aedel', x: 5.2, y: 3.4, dir: 'down', if: { eq: ['power_scene', 'deal'] } },
      { id: 'p_dolita', sprite: 'dolita', x: 8.9, y: 7.6, dir: 'up', if: { eq: ['power_scene', 'deal'] } },
      { id: 't_dolita', sprite: 'dolita', x: 9.8, y: 3.4, dir: 'down', if: { eq: ['temple_path', 'hope'] } },
    ],
    // подошёл к трону — император заговорил: послом (Надежда), с Игроком (Ненависть) или с предложением (Ненависть, повтор)
    triggers: [
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hope'] }], maxY: 6.5 * 64, d: 'throne_gidan' },
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hate'] }, { not: 'hate_first_clear' }], maxY: 6.5 * 64, d: 'gidan_player' },
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hate'] }, { flag: 'hate_first_clear' }], maxY: 6.5 * 64, d: 'gidan_offer' },
    ],
    onEnter: [
      { if: { eq: ['power_scene', 'deal'] }, d: 'power_deal' },
      { if: [{ not: 'palace_seen' }, { eq: ['temple_path', 'hate'] }], d: 'palace_hate_intro' },
      { if: { not: 'palace_seen' }, d: 'palace_intro' },
    ],
  };

  // Банкет: Люмина пытается отравить героя
  MAPS.palace_hall = {
    title: 'Дворец Нокта · Пиршественный зал',
    ground: 'o',
    tiles: [
      'KKKKKKKKKKKKKKKKKK',
      'KooooooooooooooooK',
      'KooPooooooooooPooK',
      'KooooooooooooooooK',
      'KooooooooooooooooK',
      'KooooooooooooooooK',
      'KooooooooooooooooK',
      'KooooooooooooooooK',
      'KooPooooooooooPooK',
      'KooooooooooooooooK',
      'KKKKKKKKKKKKKKKKKK',
    ],
    spawn: [8.5, 7],
    npcs: [
      { id: 'table', prop: 'table', x: 8.5, y: 5 },
      { id: 'b_gidan', sprite: 'gidan', x: 8.5, y: 3.7, dir: 'down' },
      { id: 'b_lumina', sprite: 'lumina', x: 6, y: 3.7, dir: 'down', if: { not: 'lumina_exposed' } },
      { id: 'b_aedel', sprite: 'aedel', x: 11, y: 3.7, dir: 'down' },
      { id: 'b_dolita', sprite: 'dolita', x: 12.6, y: 3.7, dir: 'down' },
      { id: 'b_guard1', sprite: 'nokt_guard', x: 1.6, y: 6, dir: 'right' },
      { id: 'b_guard2', sprite: 'nokt_guard', x: 15.4, y: 6, dir: 'left' },
    ],
    onEnter: [{ if: { not: 'banquet_seen' }, d: 'banquet' }],
  };

  // ============================================================ Этап 7. Путь Мести: лабиринт сознания Гидана
  // Z стена мыслей  z пол. Фигуры в тупиках меняют облик; ложные тают, настоящий Гидан дважды ускользает,
  // а пойманный выглядит как сам герой. Тексты шёпота — HUNT_TEXT в dialogues.js.
  MAPS.mind_maze = {
    entry: 'letterbox',                               // вход — полосы letterbox
    title: 'Лабиринт сознания',
    tiles: [
      'ZZZZZZZZZZZZZZZZZZZZZZZZZ',
      'ZzzzzzZzzzzzzzZzzzzzzzzzZ',
      'ZzZZZZZzZZZzZZZzZZZZZzZZZ',
      'ZzzzZzzzZzZzzzzzZzzzZzzzZ',
      'ZzZzZzZZZzZZZZZZZzZzZzZzZ',
      'ZzZzZzZzzzzzZzzzzzZzZzZzZ',
      'ZzZzZzZZZzZZZzZZZZZzZZZzZ',
      'ZzZzzzzzZzzzZzZzzzzzzzzzZ',
      'ZzZZZZZzZZZzZzZzZzZZZZZzZ',
      'ZzZzzzZzzzzzZzZzZzzzzzzzZ',
      'ZZZzZzZzZZZZZzZzZZZzZZZZZ',
      'ZzzzZzZzZzzzzzZzzzzzZzzzZ',
      'ZzZZZzZZZzZZZZZzZZZZZzZzZ',
      'ZzzzZzzzZzZzZzzzzzzzZzzzZ',
      'ZzzzZZZzZzZzZzZZZzZzzzZzZ',
      'ZzZzzzzzzzZzzzzzzzZzzzZzZ',
      'ZZZZZZZZZZZZZZZZZZZZZZZZZ',
    ],
    spawn: [1, 15],
    hunt: {
      if: { not: 'maze_caught' },
      spots: [[5, 1], [13, 1], [23, 1], [9, 3], [7, 5], [11, 5], [21, 5], [1, 9], [7, 11], [11, 13], [23, 15]],
      figures: 5, slips: 2,                          // 1 настоящий + 4 морока; настоящий ускользает дважды
      sprites: ['gidan', 'dolita', 'aedel', 'lumina', 'elder', 'priest', 'stranger'],
      confuseEvery: 16, confuseFor: 3,               // мысли путаются: управление наоборот
      caught: 'maze_caught',
      // якоря возвращают рассудок и снимают перекрытия; zone — о чём рядом издевается Гидан
      anchors: [
        { kind: 'portrait', x: 3, y: 13, zone: 'dolita' }, { kind: 'mirror', x: 13, y: 7 },
        { kind: 'letter', x: 19, y: 3, zone: 'empire' }, { kind: 'ribbon', x: 18, y: 9 },
      ],
      anchorCd: 20, anchorCalm: 6,                   // перезарядка якоря и сколько секунд после него безумие не растёт
      // Безумие: копится в зоне внимания Гидана (attention клеток) и пока он говорит; урон dps[0]…dps[1] ОЗ/с от from%
      madness: { attention: 6, rise: 10, fall: 12, from: 20, dps: [1, 2] },
      taunt: { every: [8, 15], show: 3.5, slow: 0.9 },
      block: { every: [18, 24], hold: 12 },          // Гидан закрывает проход рядом с героем
    },
    onEnter: [
      { if: { flag: 'maze_caught' }, to: 'hate_palace', at: [19.5, 8], dir: 'left' },   // лабиринт уже пройден
      { if: { not: 'maze_seen' }, d: 'maze_intro' },
    ],
  };

  // Покои после лабиринта: три комнаты (Долита, Аэдел, Гидан); осмотрел все — дверь слева открывается
  MAPS.hate_palace = {
    entry: 'letterbox',                               // вход — полосы letterbox
    title: 'Дворец Нокта · Опустевшие покои',
    ground: 'o',
    dark: true,
    tiles: [
      'KKKKKKKKKKKKKKKKKKKKKK',
      'KooooooKooooooKBBBBBBK',
      'KooooooKooooooKooooooK',
      'KooooooKooooooKooooooK',
      'KooooooKooooooKooooooK',
      'KooooooKooooooKooooooK',
      'KKKooKKKKKooKKKKKooKKK',
      'KooooooooooooooooooooK',
      'ErrrrrrrrrrrrrrrrrrrrK',
      'EooooooooooooooooooooK',
      'KKKKKKKKKKKKKKKKKKKKKK',
    ],
    spawn: [19.5, 8],
    exits: [
      { x: 0, y: 8, if: { flag: 'labyrinth_exit_unlocked' }, d: 'maze_exit', else: 'rooms_door_locked' },
      { x: 0, y: 9, if: { flag: 'labyrinth_exit_unlocked' }, d: 'maze_exit', else: 'rooms_door_locked' },
    ],
    npcs: [
      { id: 'r_commode', prop: 'commode', x: 2, y: 1.1, talk: [{ d: 'dolita_commode' }] },
      { id: 'r_dmirror', prop: 'mirror', x: 5.2, y: 1.2, talk: [{ d: 'dolita_mirror' }] },
      { id: 'r_diary', prop: 'note', x: 3.5, y: 3.6, talk: [{ if: { flag: 'room_dolita_visited' }, d: 'dolita_diary_again' }, { d: 'dolita_diary' }] },
      { id: 'r_portrait', prop: 'portrait', who: 'aedel', x: 10.5, y: 1, talk: [{ if: { flag: 'room_aedel_visited' }, d: 'aedel_portrait_again' }, { d: 'aedel_portrait' }] },
      { id: 'r_stand', prop: 'stand', x: 12.6, y: 1.2, talk: [{ d: 'aedel_stand' }] },
      { id: 'r_desk', prop: 'desk', x: 17.5, y: 2.6, talk: [{ if: { flag: 'room_gidan_visited' }, d: 'gidan_desk_again' }, { d: 'gidan_desk_letter' }] },
    ],
    rooms: {
      need: 3, hintAt: 60, markersAt: 120,          // через минуту без толку — подсказка Гидана, через две — метки
      list: [
        { id: 'dolita', flag: 'room_dolita_visited', key: 'r_diary', area: [1, 1, 6, 5] },
        { id: 'aedel', flag: 'room_aedel_visited', key: 'r_portrait', area: [8, 1, 13, 5] },
        { id: 'gidan', flag: 'room_gidan_visited', key: 'r_desk', area: [15, 1, 20, 5] },
      ],
    },
    onEnter: [{ if: { not: 'maze_exit_seen' }, d: 'rooms_intro' }],
  };

  // ============================================================ Этап 8. Мета-сцена: пустота, трое Кукол
  // v пустота (пол)  Y край пустоты (стена). Долита, Гидан и Аэдел здесь живы, что бы ни было раньше.
  MAPS.void = {
    title: '…',
    entry: 'letterbox',
    vignette: true,
    tiles: [
      'YYYYYYYYYYYYYYYYYYYY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YvvvvvvvvvvvvvvvvvvY',
      'YYYYYYYYYYYYYYYYYYYY',
    ],
    spawn: [9.5, 7.6],
    npcs: [
      { id: 'v_gidan', sprite: 'gidan', x: 9.5, y: 4.4, dir: 'down', menace: true },
      { id: 'v_dolita', sprite: 'dolita', x: 7.4, y: 5.6, dir: 'right', menace: true },
      { id: 'v_aedel', sprite: 'aedel', x: 11.6, y: 5.6, dir: 'left', menace: true },
    ],
    onEnter: [{ if: { not: 'void_seen' }, d: 'void_scene' }],
  };

  // ============================================================ Атмосфера локаций (LOCATION_FX)
  // Порядок отрисовки: renderGround → renderFog → renderMid + renderEntities (объекты и персонажи по нижней кромке)
  //   → renderForeground (передний план, свет, дождь, виньетка) → renderUI.
  // fog — туман между землёй и объектами: rgb, a [мин, макс] (0.05–0.15), speed px/с, where: all | water | low,
  //   pulse — дышит в такт органу, colors — несколько цветов по кругу (лабиринт). Три слоя с разной скоростью (параллакс).
  // vignette 0…1 — затемнение краёв; lights [x, y, радиус, 'r,g,b', пульс] (клетки) — свечение 'lighter';
  // rays [x, y] — косые лучи из окон; parts { тип: штук в секунду } — частицы (≤100 на локацию); chimneys — трубы с дымом;
  // fg — передний план поверх героя: прозрачнеет, когда герой за ним; rain — дождь, когда поднят флаг rain_on;
  // puddles — лужи с рябью под дождём; oddShadow — у героя есть тень, которая идёт не за ним.
  const LOCATION_FX = {
    luminos_square: {
      fog: { rgb: '255,236,200', a: [0.04, 0.08], speed: 6 }, vignette: 0.2,
      lights: [[12, 4, 2.4, '170,220,255', 0.15]], parts: { pollen: 4 },
      fg: [{ t: 'branch', x: 3.5, y: 1.4 }, { t: 'branch', x: 20.5, y: 1.4, flip: 1 }, { t: 'banner', x: 8.5, y: 1.1, c: 'lum' },
        { t: 'banner', x: 15.5, y: 1.1, c: 'lum' }, { t: 'branch', x: 3.5, y: 10.6 }, { t: 'branch', x: 20.5, y: 10.6, flip: 1 }],
    },
    luminos_throne: {
      fog: { rgb: '255,240,210', a: [0.04, 0.07], speed: 4 }, vignette: 0.3,
      lights: [[5.5, 1.6, 1.6, '255,210,130', 0.2], [9.5, 1.6, 1.6, '255,210,130', 0.2]], rays: [[1, 2], [1, 6], [14, 2], [14, 6]],
      parts: { dust: 4 },
      fg: [{ t: 'curtain', x: 1.1, y: 3.6 }, { t: 'curtain', x: 14.9, y: 3.6, flip: 1 }, { t: 'banner', x: 4.5, y: 1.1, c: 'lum' }, { t: 'banner', x: 10.5, y: 1.1, c: 'lum' }],
    },
    village: {
      fog: { rgb: '255,226,180', a: [0.06, 0.12], speed: 5 }, vignette: 0.15,
      lights: [[18, 6.8, 1.6, '150,220,255', 0.2]], parts: { pollen: 6 },
      chimneys: [[7.05, 4.1], [22.05, 4.1], [7.05, 12.1], [22.05, 12.1]],
      fg: [{ t: 'branch', x: 3.5, y: 15.4 }, { t: 'branch', x: 11.5, y: 15.4, flip: 1 }, { t: 'branch', x: 19.5, y: 15.4 },
        { t: 'branch', x: 8.5, y: 0.9, flip: 1 }, { t: 'branch', x: 23.5, y: 0.9 }],
    },
    stream: {
      fog: { rgb: '220,240,255', a: [0.06, 0.13], speed: 8, where: 'water' }, vignette: 0.15, parts: { pollen: 5 },
      fg: [{ t: 'branch', x: 4.5, y: 15.4 }, { t: 'branch', x: 15.5, y: 15.4, flip: 1 }, { t: 'branch', x: 25.5, y: 0.9 }, { t: 'branch', x: 9.5, y: 0.9, flip: 1 }],
    },
    north_gate: {
      fog: { rgb: '200,200,215', a: [0.05, 0.1], speed: 10 }, vignette: 0.3,
      lights: [[7.6, 10.4, 1.5, '255,160,80', 0.35], [12.4, 10.4, 1.5, '255,160,80', 0.35]], parts: { dust: 3 },
      fg: [{ t: 'chain', x: 8.4, y: 11.5 }, { t: 'chain', x: 11.6, y: 11.5 }, { t: 'banner', x: 4.5, y: 11.2, c: 'nokt' }, { t: 'banner', x: 15.5, y: 11.2, c: 'nokt' }],
    },
    trade_city: {
      fog: { rgb: '210,230,255', a: [0.08, 0.14], speed: 6, where: 'water' }, vignette: 0.2,
      parts: { bird: 0.4, dust: 4 },
      lights: [[6, 5.6, 1.4, '255,190,110', 0.3], [12.5, 5.6, 1.4, '255,190,110', 0.3], [17.5, 5.6, 1.4, '255,190,110', 0.3], [24, 5.6, 1.4, '255,190,110', 0.3]],
      fg: [{ t: 'line', x: 10, y: 4.6, x2: 13.6 }, { t: 'line', x: 16.4, y: 4.6, x2: 20 }, { t: 'line', x: 11, y: 15.6, x2: 14.4 },
        { t: 'lantern', x: 6, y: 5.6 }, { t: 'lantern', x: 12.5, y: 5.6 }, { t: 'lantern', x: 17.5, y: 5.6 }, { t: 'lantern', x: 24, y: 5.6 },
        { t: 'awning', x: 3.5, y: 6.6, c: '#8a2a3a' }, { t: 'awning', x: 25, y: 11.6, c: '#2a5a7a' }],
    },
    temple_nave: {
      fog: { rgb: '170,20,40', a: [0.08, 0.15], speed: 4, pulse: true }, vignette: 0.55,
      lights: [[1.5, 2.2, 1.3, '255,120,70', 0.4], [16.5, 2.2, 1.3, '255,120,70', 0.4], [1.5, 9, 1.3, '255,120,70', 0.4], [16.5, 9, 1.3, '255,120,70', 0.4], [8.5, 2.2, 2.4, '255,60,60', 0.25]],
      rays: [[4, 1], [12, 1]], parts: { drip: 2, ember: 3 },
      fg: [{ t: 'cloth', x: 3.5, y: 2.2 }, { t: 'cloth', x: 14.5, y: 2.2 }, { t: 'arch', x: 1.2, y: 1.4 }, { t: 'arch', x: 16.8, y: 1.4, flip: 1 }, { t: 'cloth', x: 6, y: 1.6 }, { t: 'cloth', x: 11, y: 1.6 }],
    },
    organ_hall: {
      fog: { rgb: '170,15,35', a: [0.09, 0.15], speed: 3, pulse: true }, vignette: 0.6, candles: true,
      lights: [[8.5, 2, 3.2, '255,50,60', 0.35], [1.5, 4, 1.2, '255,120,70', 0.4], [16.5, 4, 1.2, '255,120,70', 0.4]],
      parts: { drip: 3, ember: 3 },
      fg: [{ t: 'cloth', x: 2.5, y: 3.6 }, { t: 'cloth', x: 15.5, y: 3.6 }, { t: 'arch', x: 1.2, y: 3.6 }, { t: 'arch', x: 16.8, y: 3.6, flip: 1 }],
    },
    gidan_study: {
      fog: { rgb: '200,170,140', a: [0.04, 0.08], speed: 3 }, vignette: 0.45,
      lights: [[6.6, 2.4, 1.5, '255,200,120', 0.3]], parts: { dust: 3 },
      fg: [{ t: 'beam', y: 2.2 }, { t: 'arch', x: 1.2, y: 2.4 }, { t: 'arch', x: 10.8, y: 2.4, flip: 1 }],
    },
    arena: {
      fog: { rgb: '150,110,200', a: [0.06, 0.12], speed: 4 }, vignette: 0.55,
      lights: [[3.5, 2.6, 1.4, '200,150,255', 0.3], [12.5, 2.6, 1.4, '200,150,255', 0.3], [3.5, 5.6, 1.4, '200,150,255', 0.3], [12.5, 5.6, 1.4, '200,150,255', 0.3]],
      parts: { dust: 4, ember: 2 },
      fg: [{ t: 'banner', x: 4, y: 1.1, c: 'nokt' }, { t: 'banner', x: 12, y: 1.1, c: 'lum' }],
    },
    spirit_order: {
      fog: { rgb: '170,215,255', a: [0.07, 0.13], speed: 5 }, vignette: 0.45,
      lights: [[9.5, 1.2, 2.4, '120,200,255', 0.3], [1.5, 6.5, 1.3, '150,220,255', 0.25], [3.5, 3.2, 1.2, '150,220,255', 0.3], [16.5, 3.2, 1.2, '150,220,255', 0.3],
        [3.5, 9.2, 1.2, '150,220,255', 0.3], [16.5, 9.2, 1.2, '150,220,255', 0.3]],
      rays: [[6, 1], [13, 1]], parts: { wisp: 3, feather: 1.2, dust: 4 },
      fg: [{ t: 'arch', x: 1.2, y: 2.4 }, { t: 'arch', x: 18.8, y: 2.4, flip: 1 }, { t: 'banner', x: 6, y: 1.1, c: 'nokt' }, { t: 'banner', x: 13, y: 1.1, c: 'nokt' }],
    },
    nokt_capital: {
      fog: { rgb: '190,170,230', a: [0.05, 0.1], speed: 7 }, vignette: 0.3, rain: true,
      lights: [[5.5, 3.6, 1.4, '200,150,255', 0.3], [19.5, 3.6, 1.4, '200,150,255', 0.3], [5.5, 14.6, 1.4, '200,150,255', 0.3], [19.5, 14.6, 1.4, '200,150,255', 0.3], [12.5, 8.6, 2, '170,200,255', 0.2]],
      rays: [[3, 1], [9, 1], [16, 1], [22, 1]], parts: { firefly: 2, petal: 2 }, puddles: [[6, 7], [18, 11], [9, 13], [20, 6]],
      fg: [{ t: 'banner', x: 6, y: 1.1, c: 'nokt' }, { t: 'banner', x: 19, y: 1.1, c: 'nokt' }, { t: 'lantern', x: 5.5, y: 3.6 }, { t: 'lantern', x: 19.5, y: 3.6 },
        { t: 'lantern', x: 5.5, y: 14.6 }, { t: 'lantern', x: 19.5, y: 14.6 }],
    },
    nokt_garden: {
      fog: { rgb: '190,220,200', a: [0.05, 0.1], speed: 5 }, vignette: 0.3, rain: true,
      lights: [[6, 5, 2.6, '150,190,255', 0.15], [16.5, 4.2, 1.6, '255,220,240', 0.3]], parts: { firefly: 4, petal: 4 }, puddles: [[13, 11], [20, 8]],
      fg: [{ t: 'nbranch', x: 7.5, y: 10.6 }, { t: 'nbranch', x: 18.5, y: 10.6, flip: 1 }, { t: 'nbranch', x: 15.5, y: 5.6 }, { t: 'gazebo', x: 16.5, y: 2.6 },
        { t: 'nbranch', x: 3.5, y: 13.4 }, { t: 'nbranch', x: 20.5, y: 13.4, flip: 1 }],
    },
    palace_gate: {
      fog: { rgb: '150,180,220', a: [0.07, 0.14], speed: 12 }, vignette: 0.4, rain: true,
      lights: [[6, 0.9, 1.4, '255,160,80', 0.35], [10, 0.9, 1.4, '255,160,80', 0.35]], puddles: [[4, 6], [11, 9], [6, 11], [12, 4]],
      fg: [{ t: 'banner', x: 3, y: 1.1, c: 'nokt' }, { t: 'banner', x: 13, y: 1.1, c: 'nokt' }, { t: 'chain', x: 6.4, y: 1.4 }, { t: 'chain', x: 9.6, y: 1.4 }],
    },
    palace_throne: {
      fog: { rgb: '160,170,220', a: [0.05, 0.1], speed: 4 }, vignette: 0.4,
      lights: [[5.5, 1.4, 1.5, '255,210,150', 0.25], [9.5, 1.4, 1.5, '255,210,150', 0.25]], rays: [[1, 2], [1, 6], [14, 3], [14, 7]], parts: { dust: 3 },
      fg: [{ t: 'curtain', x: 1.1, y: 3.6 }, { t: 'curtain', x: 14.9, y: 3.6, flip: 1 }, { t: 'banner', x: 4, y: 1.1, c: 'nokt' }, { t: 'banner', x: 12, y: 1.1, c: 'nokt' }],
    },
    palace_hall: {
      fog: { rgb: '220,200,170', a: [0.04, 0.08], speed: 4 }, vignette: 0.35,
      lights: [[5, 4.6, 1.3, '255,200,120', 0.3], [8.5, 4.6, 1.3, '255,200,120', 0.3], [12, 4.6, 1.3, '255,200,120', 0.3]], rays: [[2, 1], [9, 1], [15, 1]], parts: { dust: 3 },
      fg: [{ t: 'curtain', x: 1.1, y: 3.6 }, { t: 'curtain', x: 16.9, y: 3.6, flip: 1 }, { t: 'banner', x: 5, y: 1.1, c: 'nokt' }, { t: 'banner', x: 12, y: 1.1, c: 'nokt' }],
    },
    mind_maze: {
      fog: { rgb: '120,40,200', colors: ['120,40,200', '40,120,220', '200,30,120'], a: [0.08, 0.15], speed: 9 }, vignette: 0.6,
      parts: { glitch: 6 }, oddShadow: true,
    },
    hate_palace: {
      fog: { rgb: '150,160,210', a: [0.05, 0.1], speed: 4 }, vignette: 0.5,
      lights: [[3.5, 3.2, 1.2, '255,200,130', 0.4], [17.5, 2, 1.3, '255,200,130', 0.4]], parts: { dust: 2 },
      fg: [{ t: 'banner', x: 4, y: 7.1, c: 'nokt' }, { t: 'banner', x: 15, y: 7.1, c: 'nokt' }, { t: 'arch', x: 3.5, y: 6.4 }, { t: 'arch', x: 17.5, y: 6.4, flip: 1 }],
    },
    void: { vignette: 0, parts: { glitch: 2 } },
  };

  const PROP_SIZE = {
    throne: { w: 110, h: 50 }, stone: { w: 40, h: 18 }, sign: { w: 30, h: 14 },
    house: { w: 140, h: 52 }, altar: { w: 150, h: 40 }, pew: { w: 150, h: 26 }, mirror: { w: 50, h: 20 }, desk: { w: 130, h: 34 }, nhouse: { w: 140, h: 52 }, stall: { w: 92, h: 34 }, statue: { w: 40, h: 22 }, spring: { w: 70, h: 30 }, note: { w: 0, h: 0 },
    nthrone: { w: 110, h: 50 }, table: { w: 380, h: 56 }, arch: { w: 0, h: 0 },
    commode: { w: 90, h: 24 }, portrait: { w: 70, h: 16 }, stand: { w: 40, h: 18 },
  };
  let exitLock = false;
  const SOLID = new Set(['#', 'T', '~', 'W', 'G', 'F', 'P', 'R', 'K', 'X', 'B', 'Z', 'Y', 'I']);
  // ворота Нокта открываются флагом
  const isSolid = (t) => SOLID.has(t) || (t === 'N' && !state.flags.north_gate_open) || (t === 'V' && !state.flags.palace_open);

  // ---------------------------------------------------------------- Состояние
  let state = null;          // { hero:{name,gender,weapon}, flags, map, x, y, dir }
  let mode = 'title';        // title | create | play | dialog | pause
  let map = null;            // текущая карта
  let npcs = [];
  const hero = { x: 0, y: 0, dir: 'down', moving: false, walk: 0, cd: 0, inv: 0, swing: null, kx: 0, ky: 0,
    dash: null, dashCd: 0, dodge: 0, trail: [], ammo: 6, mana: MAX_MANA, casting: null };
  let enemies = [], shots = [], sparks = [], floaters = [];
  let curEnc = null;                 // текущая схватка карты (map.encounters)
  const buffs = { dmg: 0, speed: 0 }; // еда Дариан: секунды до конца баффа
  const zoom = { k: 1, want: 1, x: 0, y: 0 }; // наезд камеры (ключ реплики zoom), 2 с на 1.0 → 1.4
  let dim = 0;                       // затемнение экрана после красной вспышки
  let waveId = 0;                    // номер голубой волны (точки одной волны рисуются дугой)
  const BEAT = 0.5;                  // такт органа: трубы, жидкость и её урон
  let flaskRefill = 0, flaskT = 0;   // Сосуд жизни: одно пополнение на бой и таймер до него
  let panel = null;                  // открытое окно: { kind: 'bag'|'shop'|'skills', back: 'play'|'pause', msg }
  let ebolts = [];                   // снаряды врагов
  const hz = { phase: 'rest', t: 1.5, i: 0, tick: 0 };   // затопление пола (map.hazard)
  const cam = { x: 0, y: 0 };
  let time = 0;
  let near = null;           // NPC, с которым можно поговорить
  let saveTimer = 0;
  let pending = {};          // что сделать после диалога: { scene, mini, ending }

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  // ---------------------------------------------------------------- Картинки
  const images = {};
  function img(src) {
    if (!images[src]) {
      const im = new Image();
      im.onerror = () => { im.failed = true; };
      im.src = src;
      images[src] = im;
    }
    return images[src];
  }
  const ready = (im) => im && im.complete && !im.failed && im.naturalWidth > 0;

  // Спрайт героя по полу и оружию; пока нужного нет — временный (парень с мечом)
  function heroSprite(dir, h = state.hero) {
    const want = img(`assets/sprites/hero_${h.gender}_${h.weapon}_${dir}.png`);
    return ready(want) ? want : img(`assets/sprites/hero_m_sword_${dir}.png`);
  }
  function heroSpriteIsTemp(h) {
    const want = img(`assets/sprites/hero_${h.gender}_${h.weapon}_down.png`);
    return !ready(want);
  }

  // ---------------------------------------------------------------- Тайлы (рисуются кодом, пиксели ×2)
  const TILE_ART = {};
  function makeTile(key, draw) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    let seed = key.charCodeAt(0) * 97 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    draw(x, rnd);
    const big = document.createElement('canvas');
    big.width = T; big.height = T;
    const b = big.getContext('2d');
    b.imageSmoothingEnabled = false;
    b.drawImage(c, 0, 0, T, T);
    TILE_ART[key] = big;
  }
  function px(x, c, X, Y, w = 1, h = 1) { x.fillStyle = c; x.fillRect(X, Y, w, h); }

  makeTile('.', (x, r) => {
    px(x, '#4f8a3a', 0, 0, 32, 32);
    for (let i = 0; i < 60; i++) px(x, r() < 0.5 ? '#5d9a44' : '#43792f', (r() * 32) | 0, (r() * 32) | 0);
    for (let i = 0; i < 6; i++) { const X = (r() * 30) | 0, Y = (r() * 29) | 0; px(x, '#6fb052', X, Y, 1, 2); px(x, '#6fb052', X + 1, Y + 1, 1, 2); }
  });
  makeTile(',', (x, r) => {
    px(x, '#b89a6a', 0, 0, 32, 32);
    for (let i = 0; i < 50; i++) px(x, r() < 0.5 ? '#c7aa78' : '#a4865a', (r() * 32) | 0, (r() * 32) | 0);
    for (let i = 0; i < 4; i++) { const X = (r() * 29) | 0, Y = (r() * 29) | 0; px(x, '#8c7350', X, Y, 3, 2); px(x, '#d6bd8f', X, Y, 2, 1); }
  });
  makeTile('~', (x, r) => {
    px(x, '#2f6fa0', 0, 0, 32, 32);
    for (let i = 0; i < 30; i++) px(x, '#3a80b4', (r() * 32) | 0, (r() * 32) | 0, 2, 1);
  });
  makeTile('f', (x) => {
    px(x, '#d9d2c4', 0, 0, 32, 32);
    px(x, '#c9c0b0', 0, 31, 32, 1); px(x, '#c9c0b0', 31, 0, 1, 32);
    px(x, '#e8e2d6', 0, 0, 31, 1); px(x, '#e8e2d6', 0, 0, 1, 31);
    px(x, '#cfc6b6', 6, 9, 9, 1); px(x, '#cfc6b6', 18, 22, 7, 1);
  });
  makeTile('#', (x, r) => {
    px(x, '#4a4541', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let col = -1; col < 3; col++) {
        const X = col * 16 + off + 1, Y = row * 8 + 1;
        px(x, r() < 0.5 ? '#77706a' : '#6b6560', X, Y, 14, 6);
        px(x, '#8a837c', X, Y, 14, 1);
      }
    }
  });
  makeTile('D', (x) => {
    px(x, '#b89a6a', 0, 0, 32, 32);
    px(x, '#f4dca0', 13, 12, 6, 8);
  });

  makeTile('m', (x, r) => {                       // светлый мрамор плиткой
    px(x, '#e6dfd0', 0, 0, 32, 32);
    px(x, '#d3cab8', 0, 15, 32, 1); px(x, '#d3cab8', 15, 0, 1, 32);
    px(x, '#f3eee4', 0, 0, 32, 1); px(x, '#f3eee4', 0, 16, 32, 1);
    for (let i = 0; i < 10; i++) px(x, '#dcd3c2', (r() * 32) | 0, (r() * 32) | 0, 2, 1);
  });
  makeTile('r', (x) => {                          // красный ковёр с золотой каймой
    px(x, '#a3262c', 0, 0, 32, 32);
    px(x, '#8a1d23', 0, 6, 32, 1); px(x, '#8a1d23', 0, 22, 32, 1);
    px(x, '#d9a441', 0, 0, 32, 2); px(x, '#d9a441', 0, 30, 32, 2);
  });
  makeTile('W', (x, r) => {                       // белая стена Люминоса
    px(x, '#b8b0a2', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let col = -1; col < 3; col++) {
        const X = col * 16 + off + 1, Y = row * 8 + 1;
        px(x, r() < 0.5 ? '#efe9dd' : '#e4ddcf', X, Y, 14, 6);
        px(x, '#fbf8f1', X, Y, 14, 1);
      }
    }
    px(x, '#d9a441', 0, 0, 32, 2);
  });
  makeTile('G', (x) => {                          // золотые ворота дворца
    px(x, '#2a2218', 0, 0, 32, 32);
    for (let i = 2; i < 32; i += 6) { px(x, '#d9a441', i, 0, 2, 32); px(x, '#f4dca0', i, 0, 1, 32); }
    px(x, '#d9a441', 0, 10, 32, 2); px(x, '#d9a441', 0, 24, 32, 2);
  });
  makeTile('P', (x) => { px(x, '#e6dfd0', 0, 0, 32, 32); });   // под колонной — мрамор, колонна рисуется объектом
  makeTile('F', (x, r) => {                       // вода фонтана (бортик рисуется отдельно)
    px(x, '#5aa5d6', 0, 0, 32, 32);
    for (let i = 0; i < 24; i++) px(x, '#7cc0ea', (r() * 32) | 0, (r() * 32) | 0, 2, 1);
  });

  makeTile('X', (x, r) => {                       // стена храма: тёмно-красный камень
    px(x, '#2a1014', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let col = -1; col < 3; col++) {
        const X = col * 16 + off + 1, Y = row * 8 + 1;
        px(x, r() < 0.5 ? '#4a1a22' : '#41161d', X, Y, 14, 6);
        px(x, '#5e2430', X, Y, 14, 1);
      }
    }
    px(x, '#b08a3a', 0, 0, 32, 2);
  });
  makeTile('q', (x, r) => {                       // пол храма: чёрно-красная плитка
    px(x, '#24161a', 0, 0, 32, 32);
    px(x, '#30202a', 1, 1, 14, 14); px(x, '#30202a', 17, 17, 14, 14);
    px(x, '#3a1a22', 17, 1, 14, 14); px(x, '#3a1a22', 1, 17, 14, 14);
    for (let i = 0; i < 6; i++) px(x, '#4a2630', (r() * 32) | 0, (r() * 32) | 0, 2, 1);
  });
  makeTile('E', (x) => {                          // дверной проём
    px(x, '#120808', 0, 0, 32, 32);
    px(x, '#b08a3a', 0, 0, 3, 32); px(x, '#b08a3a', 29, 0, 3, 32);
    px(x, '#5a1820', 4, 12, 24, 20);
  });
  makeTile('B', (x, r) => {                       // книжный шкаф
    px(x, '#3d2616', 0, 0, 32, 32);
    for (let sh = 0; sh < 3; sh++) {
      px(x, '#2a1a0e', 2, 2 + sh * 10, 28, 8);
      for (let b = 3; b < 29; b += 3) px(x, ['#7b2a2a', '#2a4a7b', '#3a6b3a', '#7b6a2a', '#5a3a7b'][(r() * 5) | 0], b, 3 + sh * 10 + ((r() * 2) | 0), 2, 7);
    }
  });
  makeTile('c', (x, r) => {                       // брусчатка Нокта
    px(x, '#3a3642', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let col = -1; col < 4; col++) {
        const X = col * 8 + off, Y = row * 8;
        px(x, r() < 0.5 ? '#55505e' : '#4c4855', X + 1, Y + 1, 6, 6);
        px(x, '#625c6c', X + 1, Y + 1, 6, 1);
      }
    }
  });
  makeTile('d', (x, r) => {                       // тёмная трава Нокта
    px(x, '#2f3b2e', 0, 0, 32, 32);
    for (let i = 0; i < 60; i++) px(x, r() < 0.5 ? '#384736' : '#263025', (r() * 32) | 0, (r() * 32) | 0);
    for (let i = 0; i < 5; i++) { const X = (r() * 30) | 0, Y = (r() * 29) | 0; px(x, '#4a3d5c', X, Y, 1, 2); px(x, '#5d4c74', X + 1, Y + 1, 1, 2); }
  });
  makeTile('h', (x, r) => {                       // клумба: тёмная трава с цветами
    px(x, '#2f3b2e', 0, 0, 32, 32);
    for (let i = 0; i < 40; i++) px(x, r() < 0.5 ? '#384736' : '#263025', (r() * 32) | 0, (r() * 32) | 0);
    const cols = ['#e8506a', '#f4f0e0', '#7aa8ff', '#f4d04a', '#c890ff'];
    for (let i = 0; i < 9; i++) {
      const X = 2 + (r() * 27) | 0, Y = 2 + (r() * 27) | 0, c = cols[(r() * cols.length) | 0];
      px(x, '#3f6a34', X + 1, Y + 2, 1, 2); px(x, c, X, Y, 3, 2); px(x, c, X + 1, Y - 1, 1, 1); px(x, '#fff2a0', X + 1, Y, 1, 1);
    }
  });
  makeTile('o', (x, r) => {                       // тёмный мрамор дворца с серебряными швами
    px(x, '#24202c', 0, 0, 32, 32);
    px(x, '#3a3446', 0, 15, 32, 1); px(x, '#3a3446', 15, 0, 1, 32);
    px(x, '#2e2938', 0, 0, 32, 1); px(x, '#2e2938', 0, 16, 32, 1);
    for (let i = 0; i < 8; i++) px(x, r() < 0.5 ? '#2c2736' : '#4a3a62', (r() * 32) | 0, (r() * 32) | 0, 2, 1);
    px(x, '#6a6478', 15, 15, 2, 2);
  });
  makeTile('Z', (x, r) => {                       // стена лабиринта сознания: тьма с фиолетовыми жилками
    px(x, '#0c0814', 0, 0, 32, 32);
    for (let i = 0; i < 30; i++) px(x, r() < 0.5 ? '#160e22' : '#08050e', (r() * 32) | 0, (r() * 32) | 0, 2, 2);
    let X = (r() * 32) | 0;
    for (let Y = 0; Y < 32; Y += 2) { X = clamp(X + ((r() * 3) | 0) - 1, 0, 31); px(x, '#3a1f5a', X, Y, 1, 2); }
    px(x, '#4a2f6e', 0, 0, 32, 1);
  });
  makeTile('z', (x, r) => {                       // пол лабиринта: чёрное стекло с отражениями
    px(x, '#2b2540', 0, 0, 32, 32);
    px(x, '#352e4e', 0, 0, 16, 16); px(x, '#352e4e', 16, 16, 16, 16);
    for (let i = 0; i < 6; i++) px(x, '#5a4f7a', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
  });
  makeTile('v', (x, r) => {                       // пустота: почти чёрная, с едва заметной пылью
    px(x, '#07060a', 0, 0, 32, 32);
    for (let i = 0; i < 4; i++) px(x, '#16131e', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
  });
  makeTile('Y', (x) => { px(x, '#000', 0, 0, 32, 32); });   // край пустоты
  makeTile('g', (x, r) => {                       // каменистая земля перевала
    px(x, '#8a8478', 0, 0, 32, 32);
    for (let i = 0; i < 60; i++) px(x, r() < 0.5 ? '#979185' : '#7a7468', (r() * 32) | 0, (r() * 32) | 0);
    for (let i = 0; i < 4; i++) { const X = (r() * 28) | 0, Y = (r() * 28) | 0; px(x, '#6a645a', X, Y + 2, 4, 2); px(x, '#aaa498', X, Y, 3, 2); }
  });
  makeTile('R', (x, r) => {                       // скала
    px(x, '#5a554e', 0, 0, 32, 32);
    for (let i = 0; i < 7; i++) {
      const X = (r() * 26) | 0, Y = (r() * 26) | 0, w = 6 + (r() * 8) | 0;
      px(x, '#6d675f', X, Y, w, w - 2); px(x, '#837c72', X, Y, w, 1); px(x, '#46423c', X, Y + w - 2, w, 1);
    }
  });
  makeTile('i', (x, r) => {                       // пол Ордена Духа: голубой лёд плитами
    px(x, '#2a3a4c', 0, 0, 32, 32);
    px(x, '#33475c', 1, 1, 14, 14); px(x, '#33475c', 17, 17, 14, 14);
    px(x, '#2e4155', 17, 1, 14, 14); px(x, '#2e4155', 1, 17, 14, 14);
    for (let i = 0; i < 6; i++) px(x, '#8fc8ee', (r() * 30) | 0, (r() * 30) | 0, 2, 1);
    px(x, '#5a7a96', 3, 3, 6, 1);
  });
  makeTile('I', (x, r) => {                       // стена Ордена: серо-голубой камень в инее
    px(x, '#1c2633', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let col = -1; col < 3; col++) {
        const X = col * 16 + off + 1, Y = row * 8 + 1;
        px(x, r() < 0.5 ? '#2c3a4c' : '#283546', X, Y, 14, 6);
        px(x, '#4a6078', X, Y, 14, 1);
      }
    }
    px(x, '#9ad8ff', 0, 0, 32, 2); px(x, '#cfeeff', (r() * 24) | 0, 2, 4, 2);
  });
  makeTile('K', (x, r) => {                       // чёрная стена Нокта с фиолетовыми прожилками
    px(x, '#1d1a24', 0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let col = -1; col < 3; col++) {
        const X = col * 16 + off + 1, Y = row * 8 + 1;
        px(x, r() < 0.5 ? '#2e2a38' : '#282431', X, Y, 14, 6);
        px(x, '#3c3648', X, Y, 14, 1);
      }
    }
    px(x, '#7b4fb0', 0, 0, 32, 2); px(x, '#9d6fd6', (r() * 24) | 0, 12, 6, 1);
  });
  makeTile('N', (x) => {                          // закрытые ворота: железная решётка
    px(x, '#120f18', 0, 0, 32, 32);
    for (let i = 1; i < 32; i += 5) { px(x, '#4a4458', i, 0, 2, 32); px(x, '#6a6280', i, 0, 1, 32); }
    px(x, '#4a4458', 0, 8, 32, 2); px(x, '#4a4458', 0, 22, 32, 2); px(x, '#7b4fb0', 0, 0, 32, 2);
  });
  makeTile('n', (x) => {                          // открытые ворота
    px(x, '#8a8478', 0, 0, 32, 32);
    px(x, '#4a4458', 0, 0, 32, 4); px(x, '#6a6280', 0, 3, 32, 1);
    for (let i = 1; i < 32; i += 5) px(x, '#4a4458', i, 0, 2, 3);
  });

  // Дерево — объект поверх травы, крона выше клетки
  const TREE = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 48;
    const x = c.getContext('2d');
    px(x, '#5b3b22', 13, 30, 6, 14); px(x, '#7a5230', 14, 30, 2, 14);
    const crown = [[16, 16, 14, '#2f6b2c'], [10, 20, 9, '#2f6b2c'], [22, 20, 9, '#2f6b2c'], [16, 12, 10, '#3d8237'], [12, 17, 6, '#4b9a42'], [19, 9, 5, '#5cae4f']];
    for (const [cx, cy, rr, col] of crown) {
      x.fillStyle = col;
      for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy <= rr * rr) x.fillRect(cx + xx, cy + yy, 1, 1);
    }
    return c;
  })();

  // Колонна, белый камень, трон — объекты
  function art(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return c;
  }
  const PILLAR = art(32, 64, (x) => {
    px(x, '#cfc6b4', 4, 56, 24, 8); px(x, '#d9a441', 4, 56, 24, 1);
    px(x, '#efe9dd', 7, 8, 18, 48);
    px(x, '#ffffff', 9, 8, 3, 48); px(x, '#d8d0c0', 21, 8, 4, 48);
    px(x, '#cfc6b4', 4, 2, 24, 7); px(x, '#d9a441', 4, 8, 24, 1);
  });
  const STONE = art(32, 40, (x) => {
    px(x, '#cfc8bb', 9, 34, 14, 4);
    px(x, '#f3efe6', 10, 6, 12, 30); px(x, '#f3efe6', 12, 2, 8, 4);
    px(x, '#ffffff', 11, 4, 3, 30); px(x, '#d7d0c3', 19, 6, 3, 30);
    px(x, '#e2b65a', 14, 12, 4, 1); px(x, '#e2b65a', 15, 16, 2, 4); px(x, '#e2b65a', 13, 23, 6, 1); px(x, '#e2b65a', 15, 26, 2, 4);
  });
  const THRONE = art(48, 56, (x) => {
    px(x, '#8a6420', 8, 2, 32, 40); px(x, '#d9a441', 10, 4, 28, 36);
    px(x, '#a3262c', 14, 10, 20, 28);
    px(x, '#f4dca0', 22, 0, 4, 6); px(x, '#f4dca0', 12, 2, 3, 4); px(x, '#f4dca0', 33, 2, 3, 4);
    px(x, '#8a6420', 4, 34, 40, 16); px(x, '#d9a441', 6, 34, 36, 4); px(x, '#a3262c', 10, 38, 28, 8);
    px(x, '#8a6420', 6, 48, 6, 8); px(x, '#8a6420', 36, 48, 6, 8);
  });

  const SIGN = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const x = c.getContext('2d');
    px(x, '#5b3b22', 15, 14, 3, 16);
    px(x, '#8a5a2e', 5, 6, 22, 11); px(x, '#a8723c', 6, 7, 20, 9);
    px(x, '#5b3b22', 9, 10, 14, 1); px(x, '#5b3b22', 9, 13, 10, 1);
    return c;
  })();

  // Дом: wall/wall2 — стены, roof/roof2 — крыша (деревенский и ноктский)
  const houseArt = (c) => art(48, 44, (x) => {
    px(x, c.wall, 4, 20, 40, 22); px(x, c.wall2, 5, 21, 38, 20);
    for (let i = 24; i < 41; i += 4) px(x, c.wall, 5, i, 38, 1);
    px(x, '#3d2a18', 20, 28, 9, 14); px(x, '#5a3d22', 21, 29, 7, 13); px(x, '#d9a441', 26, 35, 1, 1);
    px(x, '#2b2f3a', 9, 26, 7, 6); px(x, c.light, 10, 27, 5, 4); px(x, c.wall, 12, 27, 1, 4);
    px(x, '#2b2f3a', 33, 26, 7, 6); px(x, c.light, 34, 27, 5, 4); px(x, c.wall, 36, 27, 1, 4);
    for (let r = 0; r < 12; r++) px(x, r % 3 ? c.roof : c.roof2, 22 - r * 2, 2 + r * 1.6 | 0, 4 + r * 4, 2);
    px(x, c.eave, 0, 20, 48, 3); px(x, c.ridge, 21, 1, 6, 2);
    px(x, '#6e6e6e', 34, 4, 5, 8); px(x, '#8a8a8a', 34, 4, 5, 1);
  });
  // Деревенский дом: соломенная крыша, бревенчатые стены
  const HOUSE = houseArt({ wall: '#6b4a2b', wall2: '#8a6038', light: '#f4d27a', roof: '#c99a4a', roof2: '#b0823a', eave: '#8c6428', ridge: '#e0b866' });
  // Дом Нокта: тёмный камень, фиолетовая черепица
  const NHOUSE = houseArt({ wall: '#2c2834', wall2: '#3d3846', light: '#c89cff', roof: '#5a3a80', roof2: '#47306a', eave: '#2a1d3d', ridge: '#9a72d0' });
  // Рыночный ларёк с полосатым навесом
  const stallArt = (color) => art(32, 28, (x) => {
    px(x, '#5b3b22', 3, 10, 2, 16); px(x, '#5b3b22', 27, 10, 2, 16);
    px(x, '#8a6038', 1, 17, 30, 9); px(x, '#a8723c', 1, 17, 30, 2);
    for (let i = 0; i < 8; i++) px(x, i % 2 ? '#e8dcc0' : color, i * 4, 2, 4, 8);
    px(x, '#00000055', 0, 9, 32, 1);
    px(x, '#d02a3a', 5, 14, 3, 3); px(x, '#e0b84a', 10, 14, 3, 3); px(x, '#6a3fa0', 15, 13, 4, 4); px(x, '#3cc46a', 21, 14, 3, 3);
  });
  const stalls = {};
  // Статуя бога: каменная фигура в мантии, светящийся камень цвета бога
  const statueArt = (color) => art(24, 40, (x) => {
    px(x, '#5a5560', 2, 32, 20, 8); px(x, '#77717d', 2, 32, 20, 2);
    px(x, '#8e8896', 6, 10, 12, 22); px(x, '#a9a3b1', 7, 10, 3, 22); px(x, '#6e6876', 15, 12, 3, 20);
    px(x, '#8e8896', 8, 3, 8, 8); px(x, '#a9a3b1', 9, 3, 2, 7);
    px(x, color, 10, 18, 4, 4); px(x, '#ffffff', 11, 18, 1, 1);
    px(x, color, 3, 35, 18, 1);
  });
  const statues = {};
  // Живительный ручей: каменная чаша родника
  const SPRING = art(40, 26, (x) => {
    px(x, '#7d7a73', 2, 6, 36, 18); px(x, '#9c988f', 3, 5, 34, 2); px(x, '#5f5c56', 2, 22, 36, 2);
    px(x, '#3d8fc8', 6, 8, 28, 12); px(x, '#6cc0ee', 8, 9, 24, 3); px(x, '#a8e2ff', 12, 10, 6, 1);
    px(x, '#9c988f', 0, 10, 4, 8); px(x, '#9c988f', 36, 10, 4, 8);
  });
  // Записка под камнем, прижатая бутылкой
  const NOTE = art(24, 20, (x) => {
    px(x, '#7d7a73', 2, 12, 20, 7); px(x, '#9c988f', 3, 11, 18, 2);
    px(x, '#f3ead6', 5, 7, 12, 7); px(x, '#c9bfa6', 7, 9, 8, 1); px(x, '#c9bfa6', 7, 11, 6, 1); px(x, '#c0303a', 14, 12, 2, 1);
    px(x, '#b9dbe6', 16, 2, 4, 10); px(x, '#e8f6fb', 17, 3, 1, 7); px(x, '#8a6038', 17, 0, 2, 2);
  });

  // Записка с красным бриллиантом
  const NOTE_GEM = art(24, 20, (x) => {
    px(x, '#7d7a73', 2, 12, 20, 7); px(x, '#9c988f', 3, 11, 18, 2);
    px(x, '#f3ead6', 4, 7, 12, 7); px(x, '#c9bfa6', 6, 9, 8, 1); px(x, '#c9bfa6', 6, 11, 6, 1);
    px(x, '#8a0f1c', 15, 6, 6, 5); px(x, '#d0263a', 16, 5, 4, 5); px(x, '#ff7a8a', 16, 5, 2, 2); px(x, '#5a0812', 17, 10, 2, 2);
  });

  // Храм: алтарь с чашей, скамья, зеркало, орган, стол императора
  const ALTAR = art(48, 28, (x) => {
    px(x, '#3a1418', 2, 10, 44, 18); px(x, '#5a2028', 3, 10, 42, 3); px(x, '#b08a3a', 2, 10, 44, 1);
    px(x, '#d4af4a', 20, 0, 8, 6); px(x, '#a8862e', 22, 6, 4, 4); px(x, '#8a0f1c', 21, 1, 6, 2);
    px(x, '#e8dcc0', 8, 4, 2, 6); px(x, '#ffb24a', 8, 2, 2, 2); px(x, '#e8dcc0', 38, 4, 2, 6); px(x, '#ffb24a', 38, 2, 2, 2);
  });
  const PEW = art(48, 16, (x) => {
    px(x, '#3d2616', 0, 0, 48, 6); px(x, '#5a3a22', 0, 0, 48, 2);
    px(x, '#4a2e1a', 0, 8, 48, 4); px(x, '#2a1a0e', 2, 12, 3, 4); px(x, '#2a1a0e', 43, 12, 3, 4);
  });
  const MIRROR = art(24, 36, (x) => {
    px(x, '#b08a3a', 2, 0, 20, 34); px(x, '#1a1420', 4, 2, 16, 28); px(x, '#3a3450', 5, 3, 4, 12);
    px(x, '#8a6a2a', 6, 32, 12, 4);
    px(x, '#e8e0f0', 12, 6, 1, 8); px(x, '#e8e0f0', 13, 13, 1, 6); px(x, '#e8e0f0', 11, 18, 1, 5);   // трещина
  });
  const ORGAN = art(96, 48, (x) => {
    px(x, '#2a1014', 0, 30, 96, 18); px(x, '#b08a3a', 0, 30, 96, 2);
    for (let i = 0; i < 15; i++) {
      const h = 10 + Math.abs(7 - i) * -1 + 18 - Math.abs(7 - i) * 2;
      px(x, '#c9a84a', 4 + i * 6, 30 - h, 4, h); px(x, '#f0d890', 4 + i * 6, 30 - h, 1, h); px(x, '#1a0a0a', 5 + i * 6, 26, 2, 2);
    }
    px(x, '#8a0f1c', 30, 34, 36, 6); for (let k = 31; k < 66; k += 3) px(x, '#e8dcc0', k, 35, 2, 4);
  });
  const ORGAN_BROKEN = art(96, 48, (x) => {
    x.drawImage(ORGAN, 0, 0);
    px(x, '#120808', 22, 4, 10, 26); px(x, '#120808', 58, 10, 8, 20); px(x, '#120808', 40, 30, 14, 6);
    px(x, '#6a0a14', 20, 40, 60, 8);
  });
  const DESK = art(48, 28, (x) => {
    px(x, '#3d2616', 0, 8, 48, 14); px(x, '#5a3a22', 0, 8, 48, 3); px(x, '#2a1a0e', 2, 22, 4, 6); px(x, '#2a1a0e', 42, 22, 4, 6);
    px(x, '#efe6d0', 8, 4, 10, 7); px(x, '#e6dcc4', 14, 2, 10, 8); px(x, '#c9bfa6', 16, 4, 6, 1); px(x, '#c9bfa6', 16, 6, 5, 1);
    px(x, '#f3ead6', 28, 5, 9, 6); px(x, '#d4af4a', 33, 9, 3, 2);           // письмо с золотой печатью
    px(x, '#1a1a1a', 40, 3, 3, 6); px(x, '#e8e0f0', 41, 1, 1, 3);
  });
  // Покои после лабиринта: комод Долиты, стойка для меча Аэдела, чёрная лента-якорь
  const COMMODE = art(48, 24, (x) => {
    px(x, '#3a2418', 0, 4, 48, 20); px(x, '#5a3a24', 0, 4, 48, 2);
    for (const yy of [8, 15]) { px(x, '#2a180e', 2, yy, 44, 6); px(x, '#c9a84a', 22, yy + 2, 4, 2); }
    px(x, '#efe6d0', 6, 0, 12, 5); px(x, '#1a1a1a', 8, 1, 8, 1); px(x, '#1a1a1a', 8, 3, 6, 1);   // ноты
    px(x, '#111', 18, 0, 2, 5);                                                                  // чёрная лента
    px(x, '#d8cfe8', 32, 0, 6, 4); px(x, '#a090c0', 33, 1, 4, 2);                               // пиала
  });
  const STAND = art(24, 32, (x) => {
    px(x, '#3a2a1a', 4, 28, 16, 4); px(x, '#5a4028', 10, 6, 4, 22); px(x, '#5a4028', 4, 10, 16, 3);
    px(x, '#2a1a0e', 4, 13, 2, 3); px(x, '#2a1a0e', 18, 13, 2, 3);
  });
  const RIBBON = art(24, 24, (x) => {
    px(x, '#111', 10, 4, 4, 4); px(x, '#222', 4, 2, 6, 5); px(x, '#222', 14, 2, 6, 5);
    px(x, '#111', 8, 8, 3, 12); px(x, '#111', 13, 8, 3, 14); px(x, '#555', 5, 3, 2, 1); px(x, '#555', 15, 3, 2, 1);
  });
  // портрет в золотой раме; Аэдел после осмотра отворачивается и закрывает глаза
  function drawPortraitProp(who, x, y, k = 1) {
    const w = 84 * k, h = 100 * k, X = x - w / 2, Y = y - 120 * k;
    g.fillStyle = '#7a5a20'; g.fillRect(X - 6 * k, Y - 6 * k, w + 12 * k, h + 12 * k);
    g.fillStyle = '#d4af4a'; g.fillRect(X - 3 * k, Y - 3 * k, w + 6 * k, h + 6 * k);
    g.fillStyle = '#1a1420'; g.fillRect(X, Y, w, h);
    const turned = who === 'aedel' && state.flags.room_aedel_visited;
    const im = img(`assets/portraits/${turned ? 'aedel_away' : who}.png`);
    if (ready(im)) g.drawImage(im, 40, 0, 176, 210, X, Y, w, h);
  }
  // Мехи органа — механизмы, которые надо разбить
  const NTHRONE = art(48, 56, (x) => {          // трон Нокта: чёрный с серебром и аметистами
    px(x, '#55506a', 8, 2, 32, 40); px(x, '#1d1a24', 10, 4, 28, 36);
    px(x, '#4a2a6a', 14, 10, 20, 28); px(x, '#6a3a9a', 15, 11, 18, 2);
    px(x, '#c8c4d8', 22, 0, 4, 6); px(x, '#c8c4d8', 12, 2, 3, 4); px(x, '#c8c4d8', 33, 2, 3, 4); px(x, '#b07aff', 23, 1, 2, 2);
    px(x, '#55506a', 4, 34, 40, 16); px(x, '#c8c4d8', 6, 34, 36, 3); px(x, '#4a2a6a', 10, 38, 28, 8);
    px(x, '#55506a', 6, 48, 6, 8); px(x, '#55506a', 36, 48, 6, 8);
  });
  const TABLE = art(96, 32, (x) => {            // длинный пиршественный стол: скатерть, блюда, кубки
    px(x, '#3a2414', 2, 8, 92, 18); px(x, '#efe8da', 0, 4, 96, 16); px(x, '#d8cfbd', 0, 18, 96, 4);
    px(x, '#6a3a9a', 0, 20, 96, 2); px(x, '#3a2414', 4, 24, 4, 8); px(x, '#3a2414', 88, 24, 4, 8);
    for (const X of [10, 30, 50, 70, 86]) { px(x, '#c8c4d8', X - 4, 8, 8, 4); px(x, '#a06030', X - 3, 7, 6, 2); }
    for (const X of [20, 40, 60, 78]) { px(x, '#d9a441', X, 4, 3, 5); px(x, '#8a1a2a', X, 4, 3, 1); px(x, '#d9a441', X - 1, 9, 5, 1); }
    px(x, '#5a8a3a', 46, 6, 6, 3); px(x, '#e8506a', 47, 5, 4, 2);
  });
  const ARCH = art(48, 48, (x) => {             // свадебная арка в цветах
    px(x, '#e6dfd0', 4, 10, 4, 38); px(x, '#e6dfd0', 40, 10, 4, 38);
    px(x, '#e6dfd0', 8, 6, 32, 4); px(x, '#e6dfd0', 6, 8, 4, 4); px(x, '#e6dfd0', 38, 8, 4, 4);
    const cols = ['#e8506a', '#f4f0e0', '#c890ff', '#f4d04a'];
    let i = 0;
    for (const [X, Y] of [[3, 14], [7, 20], [3, 28], [7, 36], [39, 14], [43, 22], [39, 30], [43, 38], [10, 5], [16, 3], [22, 5], [28, 3], [34, 5], [5, 9], [41, 9]]) {
      px(x, '#3f6a34', X - 1, Y + 1, 4, 2); px(x, cols[i++ % 4], X, Y, 3, 3);
    }
  });

  const ART = {
    bellows: art(32, 32, (x) => {
      px(x, '#3a2a1a', 6, 26, 20, 6); px(x, '#5a3a22', 6, 26, 20, 2);
      px(x, '#c9a84a', 8, 4, 4, 22); px(x, '#f0d890', 8, 4, 1, 22); px(x, '#c9a84a', 20, 8, 4, 18); px(x, '#f0d890', 20, 8, 1, 18);
      px(x, '#6a0a14', 11, 14, 10, 12); px(x, '#c0182c', 12, 15, 8, 4); px(x, '#ff6a7a', 13, 15, 2, 1);
    }),
  };

  // Белый силуэт спрайта — вспышка при попадании
  const silhouettes = new WeakMap();             // картинка → { цвет: силуэт }
  function silhouette(im, color) {
    if (!silhouettes.has(im)) silhouettes.set(im, {});
    const cache = silhouettes.get(im);
    if (!cache[color]) {
      const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      cache[color] = art(w, h, (x) => {
        x.drawImage(im, 0, 0);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = color;
        x.fillRect(0, 0, w, h);
      });
    }
    return cache[color];
  }

  // ---------------------------------------------------------------- Флаги и текст
  function check(c) {
    if (!c) return true;
    if (Array.isArray(c)) return c.every(check);
    const f = state.flags;
    if ('flag' in c) return !!f[c.flag];
    if ('not' in c) return typeof c.not === 'object' ? !check(c.not) : !f[c.not];
    if ('eq' in c) return f[c.eq[0]] === c.eq[1];
    if ('gte' in c) return (f[c.gte[0]] || 0) >= c.gte[1];
    if ('lt' in c) return (f[c.lt[0]] || 0) < c.lt[1];
    if ('any' in c) return c.any.some(check);
    if ('in' in c) return c.in[1].includes(f[c.in[0]]);
    return true;
  }
  function apply(o) {
    if (!o) return;
    if (o.toast) toast(render(o.toast));
    if (o.heal) state.hp = maxHp();
    if (o.hurt) state.hp = Math.max(1, state.hp - o.hurt);   // подношение кровью: не ниже 1 ОЗ
    if (o.ui) pending.ui = o.ui;
    if (o.duelEnd) pending.duelEnd = true;             // после диалога — с арены обратно в мир                       // после диалога — окно лавки / дерева / сумки
    const val = (v) => (typeof v === 'string' && v[0] === '$' ? state.flags[v.slice(1)] ?? 0 : v);   // '$gold' — значение флага
    for (const [k, v] of Object.entries(o.set || {})) state.flags[k] = val(v);
    for (const [k, n] of Object.entries(o.add || {})) state.flags[k] = (state.flags[k] || 0) + val(n);
    if (o.chase) chasePending = true;
    if (o.scene) pending.scene = o;                    // после диалога — в другую локацию
    if (o.mini) pending.mini = o.mini;                 // после диалога — мини-игра
    if (o.ending) pending.ending = o.ending;           // после диалога — экран концовки
    if (o.crack) startCrack();                         // экран трескается прямо на реплике
    if (o.lock) pending.lock = true;                   // после диалога — «Ошибка 888»
    if (o.achieve) unlock(o.achieve);
    if (o.zoom) { zoom.x = o.zoom[0] * T + T / 2; zoom.y = o.zoom[1] * T; zoom.want = o.zoom[2]; }
    if (o.letterbox) lboxWant = 1;                     // киношные полосы до конца диалога                  // достижение прямо на реплике
    if (o.thief) spawnThief();
    if (o.pickPath) {                                  // ведущий путь по накопленным очкам (при равенстве: ненависть, власть, надежда)
      const f = state.flags, order = ['hate', 'power', 'hope'];
      f.temple_path = order.reduce((best, p) => ((f['path_' + p] || 0) > (f['path_' + best] || 0) ? p : best), order[0]);
      if (!(f.path_hate || f.path_power || f.path_hope)) f.temple_path = 'hope';
    }
  }
  function render(s) {
    return String(s).replace(/\{([^{}]*)\}/g, (all, body) => {
      if (body === 'name') return state.hero.name;
      if (body === 'g') return state.hero.gender;
      if (body[0] === '$') return state.flags[body.slice(1)] ?? 0;      // {$bribe_cost} — значение флага
      if (body.includes('|')) { const [m, f] = body.split('|'); return state.flags.hero_gender === 'f' ? f : m; }
      return all;
    });
  }

  // ---------------------------------------------------------------- Карта
  function tileAt(tx, ty) {
    if (ty < 0 || ty >= map.tiles.length || tx < 0 || tx >= map.tiles[0].length) return '#';
    if (hunt && hunt.blocks.some((b) => b.tx === tx && b.ty === ty)) return 'Z';      // Гидан закрыл проход
    return map.tiles[ty][tx];
  }

  function maxHp() {
    return HERO_HP + (state.flags.light_element === 'radiance' ? 25 : 0) + (lvl() - 1) * 10 + (blessed('feelings') ? Math.round(20 * blessK()) : 0);
  }
  const lvl = () => state.flags.level || 1;
  // Сумка, дерево Полианны, благословения и проклятия
  const inv = (id) => state.flags['inv_' + id] || 0;
  const skill = (b) => state.flags['skill_' + b] || 0;
  const blessK = () => (skill('spirit') >= 3 ? 1.5 : skill('spirit') >= 1 ? 1.25 : 1);
  const blessed = (k) => !!state.flags['bless_' + k] && state.flags.temple_path !== 'hate';   // на пути Ненависти боги молчат
  const cursed = (k) => !!state.flags['curse_' + k];
  const dmgMul = () => (1 + (lvl() - 1) * 0.1) * (1 + 0.15 * Math.min(2, skill('power'))) * (buffs.dmg > 0 ? 1.2 : 1)
    * (blessed('blood') ? 1 + (inv('amulet') ? 0.35 : 0.2) * blessK() : 1) * (cursed('blood') ? 0.85 : 1);
  const dashCd = () => Math.max(0.4, DASH.cd - (lvl() - 1) * 0.06 - (skill('agility') >= 1 ? 0.15 : 0) - (blessed('spirit') ? 0.1 * blessK() : 0))
    + (cursed('spirit') ? 0.3 : 0);
  const dashInv = () => (skill('agility') >= 2 ? 0.45 : DASH.inv);
  const speedMul = () => 1 + (skill('agility') >= 2 ? 0.1 : 0) + (buffs.speed > 0 ? 0.2 : 0) + (blessed('spirit') ? 0.1 * blessK() : 0);
  const maxMana = () => Math.round((MAX_MANA + (skill('spirit') >= 2 ? 30 : 0)) * (cursed('mind') ? 0.6 : 1));
  const maxAmmo = (w) => (w.ammo ? w.ammo + (skill('spirit') >= 2 ? 2 : 0) : 0);
  const manaRegenMul = () => (blessed('mind') ? 1 + 0.5 * blessK() : 1);
  const castMul = () => (blessed('mind') ? 1 - 0.3 * blessK() : 1);
  const healMul = () => (1 + (inv('bowl') ? 0.25 : 0) + (blessed('feelings') ? 0.3 * blessK() : 0)) * (cursed('feelings') ? 0.7 : 1);
  function healHero(n) {
    const v = Math.round(n * healMul());
    state.hp = Math.min(maxHp(), state.hp + v);
    floaters.push({ x: hero.x, y: hero.y - 70, text: '+' + v, life: 1, color: '#9cf0a0' });
    burst(hero.x, hero.y - 28, 16, '120,230,140');
    return v;
  }
  function gainXp(n, manaPts) {
    const f = state.flags;
    if (manaPts) {
      f.mana_points = (f.mana_points || 0) + manaPts;
      floaters.push({ x: hero.x, y: hero.y - 96, text: `+${manaPts} ✦ маны`, life: 1.4, color: '#c9a0ff' });
    }
    if (!n) return;
    f.xp = (f.xp || 0) + n;
    floaters.push({ x: hero.x + 30, y: hero.y - 80, text: `+${n} опыта`, life: 1.1, color: '#ffe08a' });
    while (f.xp >= xpFor(lvl() + 1)) {
      f.level = lvl() + 1;
      state.hp = maxHp();
      burst(hero.x, hero.y - 30, 30, '255,224,138');
      toast(`Уровень ${f.level}! +10 ОЗ, +10% урона, рывок быстрее`);
    }
    updateHud();
  }

  // NPC и предметы с условием if появляются/исчезают по флагам
  function refreshNpcs() {
    npcs = (map.npcs || []).filter((n) => check(n.if))
      .map((n) => ({ w: 30, h: 16, ...(PROP_SIZE[n.prop] || {}), ...n, px: n.x * T + T / 2, py: n.y * T + T - 6 }));
  }

  function enterMap(id, at, dir) {
    map = MAPS[id];
    if (!map) throw new Error('Нет карты ' + id);
    state.map = id;
    const [sx, sy] = at || map.spawn;
    hero.x = sx * T + T / 2;
    hero.y = sy * T + T - 6;
    if (dir) hero.dir = dir;
    refreshNpcs();
    enemies = []; curEnc = null; ebolts = [];
    ffly = null;
    hz.phase = 'rest'; hz.t = 2; hz.i = 0;
    spawnEncounter();
    startHunt();
    startRooms();
    shots = []; sparks = []; floaters = [];
    hero.swing = null; hero.kx = hero.ky = 0; hero.inv = 0;
    hero.dash = null; hero.casting = null; hero.trail = []; hero.dodge = 0;
    hero.ammo = maxAmmo(WEAPONS[state.hero.weapon]); hero.mana = maxMana();
    state.flags.potato_today = 0;                    // новый визит — Дариан снова печёт картошку
    flaskT = 0;
    ghost = null;
    chase = null; chasePending = false;
    if (state.hp == null || state.hp > maxHp()) state.hp = maxHp();
    exitLock = true;
    snapCamera();
    startFx();
    rainK = fx.rain && state.flags.rain_on ? 1 : 0;
    if (map.rainStart && state.flags.temple_done && !state.flags.rain_on) { state.flags.rain_on = true; rainK = 0; }   // после храма — дождь, нарастает за 2 с
    if (!fading) showArea(map.title);                 // при переходе название уже показано на затемнении
    updateHud();
    save();
    // сцена по флагам при входе
    for (const e of map.onEnter || []) {
      if (!check(e.if)) continue;
      if (e.to) setTimeout(() => fade(() => enterMap(e.to, e.at, e.dir)), 50);   // карта уже пройдена — сразу дальше
      else setTimeout(() => startDialogue(e.d), 500);
      break;
    }
  }

  // белая вспышка поверх всего (на реплике с fx: 'flash')
  function flash(color) {
    const f = $('flash');
    f.style.background = color || '';
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // Плашка героя: имя, оружие, стихия
  function updateHud() {
    const el = $('hud');
    if (!state || !map) { el.hidden = true; return; }
    const el2 = ELEMENTS[state.flags.light_element];
    el.hidden = false;
    const gold = state.flags.gold ? ` · 💰 ${state.flags.gold}` : '';
    const mp = state.flags.mana_points ? ` · ✦ ${state.flags.mana_points}` : '';
    el.textContent = `${state.hero.name} · Ур. ${lvl()} · ${WEAPONS[state.hero.weapon].name}${el2 ? ' · ' + el2.icon + ' ' + el2.name : ''}${gold}${mp}`;
  }

  let areaTimer = 0;
  function showArea(name) {
    const el = $('area-name');
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(areaTimer);
    areaTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------------------------------------------------------------- Ввод
  const keys = {};
  const stick = { x: 0, y: 0 };
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.code === 'Enter') $('btn-start').click(); return; }
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (mode === 'mini') return miniKey(e);
    if (mode === 'dialog') return dialogKey(e);
    if (mode === 'play') {
      if (e.code === 'KeyE' || e.code === 'Enter') { interact(); e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'KeyJ') { if (!e.repeat) attack(); e.preventDefault(); }
      if (e.code === 'KeyQ') quickHeal();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') dash();
      if (e.code === 'KeyI' || e.code === 'Tab') { openPanel('bag'); e.preventDefault(); }
      if (e.code === 'Escape') pause(true);
    } else if (mode === 'panel') {
      if (e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') { closePanel(); e.preventDefault(); }
    } else if (mode === 'pause' && e.code === 'Escape') pause(false);
  });
  addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function moveVector() {
    let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + stick.x;
    let y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + stick.y;
    if (hunt && hunt.confuse > 0) { x = -x; y = -y; }   // лабиринт путает мысли
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(1, len) };
  }

  // ---------------------------------------------------------------- Обновление
  function update(dt) {
    time += dt;
    if (mode === 'mini') updateMini(dt);
    if (mode !== 'play') { hero.moving = false; return; }

    const v = moveVector();
    if (hunt && hunt.stun > 0) v.len = 0;              // безумие: секунду не слушаются ноги
    if (hero.casting) v.len = 0;                       // посох: каст — стоя
    if (hero.dash) {                                   // рывок: короткий бросок, движение не слушается
      hero.dash.t -= dt;
      moveHero(hero.dash.vx * dt, 0); moveHero(0, hero.dash.vy * dt);
      if (Math.random() < 0.6) hero.trail.push({ x: hero.x, y: hero.y, dir: hero.dir, life: 0.25 });
      if (hero.dash.t <= 0) hero.dash = null;
      v.len = 0;
      checkExits();
    }
    hero.moving = v.len > 0.15;
    if (hero.kx || hero.ky) {                         // отбрасывание после удара
      moveHero(hero.kx * dt, 0); moveHero(0, hero.ky * dt);
      const k = Math.pow(0.002, dt);
      hero.kx *= k; hero.ky *= k;
      if (Math.hypot(hero.kx, hero.ky) < 10) hero.kx = hero.ky = 0;
    }
    if (hero.moving) {
      hero.dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'down' : 'up');
      hero.walk += dt * 10;
      const spd = HERO_SPEED * speedMul() * (hunt && hunt.taunt ? hunt.h.taunt.slow : 1);
      moveHero(v.x * spd * dt, 0);
      moveHero(0, v.y * spd * dt);
      checkExits();
    }

    // ближайший собеседник перед героем
    near = null;
    let best = TALK_DIST;
    for (const n of npcs) {
      if (!n.talk) continue;
      const d = Math.hypot(n.px - hero.x, n.py - hero.y) - (n.prop === 'throne' ? 30 : 0);
      if (d < best) { best = d; near = n; }
    }

    updateCombat(dt);
    updateApparition(dt);
    updateChase(dt);
    updateFireflies(dt);
    updateHunt(dt);
    updateRooms(dt);
    if (mode === 'play') checkTriggers();
    if (mode !== 'play') return;                       // герой пал или начался диалог
    followCamera(dt);
    saveTimer += dt;
    if (saveTimer > 5) { saveTimer = 0; save(); }
  }

  // Погоня: беглец идёт по точкам map.chase.path; догнал — caught, добежал до конца — escaped
  let chase = null, chasePending = false;
  function spawnThief() {
    const c = map.chase;
    chase = { x: hero.x + 52, y: hero.y, i: 0, dir: 'left', run: false, c };
  }
  function startChase() {
    if (!chase) spawnThief();
    chase.run = true;
    chase.t = 0;
    chase.left = chaseLeft();
  }
  // сколько секунд осталось бежать беглецу до конца пути
  function chaseLeft() {
    const p = chase.c.path;
    let d = 0, x = chase.x, y = chase.y;
    for (let i = chase.i; i < p.length; i++) {
      const tx = p[i][0] * T + T / 2, ty = p[i][1] * T + T - 6;
      d += Math.hypot(tx - x, ty - y); x = tx; y = ty;
    }
    return d / chase.c.speed;
  }
  function updateChase(dt) {
    if (!chase || !chase.run) return;
    const c = chase.c, p = c.path[chase.i];
    const tx = p[0] * T + T / 2, ty = p[1] * T + T - 6;
    chase.t += dt;
    const boost = chase.t < (c.sprint || 0) ? 1.9 : 1;          // рывок на старте — фора беглецу
    const dx = tx - chase.x, dy = ty - chase.y, d = Math.hypot(dx, dy), step = c.speed * boost * dt;
    if (d <= step) { chase.x = tx; chase.y = ty; chase.i++; }
    else { chase.x += dx / d * step; chase.y += dy / d * step; }
    if (d > 1) chase.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    chase.left = chaseLeft();
    if (Math.hypot(hero.x - chase.x, hero.y - chase.y) < c.catchDist) { chase = null; startDialogue(c.caught); return; }
    if (chase.i >= c.path.length) { chase = null; startDialogue(c.escaped); }
  }
  function drawThief(ox, oy) {
    if (!chase) return;
    const x = Math.round(chase.x - ox), y = Math.round(chase.y - oy);
    shadow(x, y - 2, 18);
    const sp = img(`assets/sprites/${chase.c.sprite}_${chase.dir}.png`);
    const bob = chase.run ? Math.abs(Math.sin(time * 14)) * 4 : 0;
    if (ready(sp)) g.drawImage(sp, x - 32, y - 64 - bob, 64, 64);
  }
  function drawChaseTimer() {
    if (!chase || !chase.run) return;
    const txt = `Догони воровку! ${Math.ceil(chase.left)} с`;
    g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(W / 2 - 190, 92, 380, 46);
    g.fillStyle = chase.left < 5 ? '#ff6a5a' : '#f4dca0';
    g.fillText(txt, W / 2, 116);
  }

  // ---------------------------------------------------------------- Мини-игры сада (этап 6)
  // timing — нажать, когда стрелка в зелёной зоне (камушки, фонарик);
  // memory — запомнить и повторить порядок цветов (венок, букет);
  // catch — ловить светлячков по саду. Тексты и итоги — в dialogues.js (MINIGAMES).
  const FLOWERS = [
    { name: 'Роза', color: '#e8506a', key: '1' }, { name: 'Лилия', color: '#f4f0e0', key: '2' },
    { name: 'Василёк', color: '#7aa8ff', key: '3' }, { name: 'Ромашка', color: '#f4d04a', key: '4' },
  ];
  let mini = null;
  function startMini(id) {
    const m = MINIGAMES[id];
    if (!m) return console.warn('Нет мини-игры', id);
    mini = { id, m, t: 0, done: false };
    if (m.type === 'timing') Object.assign(mini, { try: 0, total: 0, phase: 'aim', zone: 0.3 + Math.random() * 0.4, res: null });
    if (m.type === 'memory') { Object.assign(mini, { round: 0, lives: m.lives, flash: 0 }); newRound(); }
    if (m.type === 'catch') { startFireflies(m); mini = null; return; }
    mode = 'mini';
    for (const k in keys) keys[k] = false;
  }
  function newRound() {
    const len = mini.m.rounds[mini.round];
    mini.seq = Array.from({ length: len }, () => (Math.random() * 4) | 0);
    mini.phase = 'show'; mini.t = -0.6; mini.input = 0;
  }
  const miniPos = () => 0.5 + 0.5 * Math.sin(mini.t * (2.4 + mini.try * 0.7));   // стрелка ходит быстрее с каждой попыткой
  function miniPress(choice) {
    if (!mini || mini.done) return;
    const m = mini.m;
    if (m.type === 'timing' && mini.phase === 'aim') {
      const d = Math.abs(miniPos() - mini.zone);
      const pts = d < 0.06 ? m.score[0] : d < 0.16 ? m.score[1] : m.score[2];
      mini.total += pts;
      mini.res = { pts, grade: d < 0.06 ? 0 : d < 0.16 ? 1 : 2 };
      mini.phase = 'result'; mini.rt = 0;
    } else if (m.type === 'memory' && mini.phase === 'input' && choice != null) {
      mini.pressed = { i: choice, t: 0.25 };
      if (choice === mini.seq[mini.input]) {
        mini.input++;
        if (mini.input >= mini.seq.length) {
          mini.round++;
          if (mini.round >= m.rounds.length) return finishMini(true);
          mini.phase = 'good'; mini.t = 0;
        }
      } else {
        mini.lives--;
        mini.flash = 0.5;
        if (mini.lives <= 0) return finishMini(false);
        mini.phase = 'oops'; mini.t = 0;
      }
    }
  }
  function finishMini(win) {
    mini.done = true;
    mini.win = win;
    mini.phase = 'end'; mini.t = 0;
  }
  function updateMini(dt) {
    if (!mini) return;
    mini.t += dt;
    mini.flash = Math.max(0, (mini.flash || 0) - dt);
    if (mini.pressed && (mini.pressed.t -= dt) <= 0) mini.pressed = null;
    const m = mini.m;
    if (mini.phase === 'end') {
      if (mini.t > 1.2) {
        const d = mini.win ? m.win : m.fail;
        mini = null;
        mode = 'play';
        startDialogue(d);
      }
      return;
    }
    if (m.type === 'timing' && mini.phase === 'result' && (mini.rt += dt) > 1.6) {
      mini.try++;
      if (mini.try >= m.tries) return finishMini(mini.total >= m.need);
      mini.phase = 'aim'; mini.zone = 0.25 + Math.random() * 0.5; mini.res = null; mini.t = 0;
    }
    if (m.type === 'memory') {
      if (mini.phase === 'show' && mini.t > mini.seq.length * 0.8) { mini.phase = 'input'; mini.t = 0; }
      if ((mini.phase === 'good' || mini.phase === 'oops') && mini.t > 0.9) {
        if (mini.phase === 'good') newRound();
        else { mini.phase = 'show'; mini.t = -0.4; mini.input = 0; }      // ошибка — показать тот же порядок ещё раз
      }
    }
  }
  function miniKey(e) {
    if (mini && mini.m.type === 'memory') {
      const i = FLOWERS.findIndex((f) => e.code === 'Digit' + f.key || e.code === 'Numpad' + f.key);
      if (i >= 0) miniPress(i);
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'KeyJ') { if (!e.repeat) miniPress(); }
    e.preventDefault();
  }
  // клик по канве: в «памяти» — по цветку, в «точности» — бросок
  function miniClick(x, y) {
    if (!mini) return;
    if (mini.m.type === 'memory') {
      const i = FLOWERS.findIndex((f, k) => Math.hypot(x - (W / 2 - 270 + k * 180), y - 450) < 70);
      if (i >= 0) miniPress(i);
    } else miniPress();
  }
  function flowerAt(x, y, r, color, glow) {
    if (glow) { g.fillStyle = 'rgba(255,240,180,.35)'; g.beginPath(); g.arc(x, y, r * 1.9, 0, 6.28); g.fill(); }
    g.fillStyle = color;
    for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, 6.28); g.fill(); }
    g.fillStyle = '#f0c040'; g.beginPath(); g.arc(x, y, r * 0.34, 0, 6.28); g.fill();
  }
  function drawMini() {
    if (!mini) return;
    const m = mini.m;
    g.fillStyle = 'rgba(8,6,12,.72)'; g.fillRect(0, 0, W, H);
    const X = W / 2 - 440, Y = 110, PW = 880, PH = 480;
    g.fillStyle = '#1b1620'; g.fillRect(X, Y, PW, PH);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(X + 2, Y + 2, PW - 4, PH - 4);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f4dca0'; g.font = 'bold 36px Georgia, serif'; g.fillText(m.title, W / 2, Y + 48);
    g.fillStyle = '#b9a98f'; g.font = '22px sans-serif'; g.fillText(m.hint, W / 2, Y + 92);
    if (m.type === 'timing') {
      // озеро
      g.fillStyle = '#1c3550'; g.fillRect(X + 60, Y + 130, PW - 120, 150);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(190,230,255,.18)'; g.fillRect(X + 90 + i * 85 + Math.sin(time * 2 + i) * 8, Y + 160 + (i % 3) * 40, 30, 2); }
      if (mini.res) {
        const n = mini.res.pts, k = Math.min(1, mini.rt / 1.2);
        for (let i = 0; i < n; i++) {                      // круги на воде — прыжки камушка / фонарик
          if (k * n < i) break;
          const cx = X + 120 + i * ((PW - 240) / Math.max(1, n)), cy = Y + 205 + Math.sin(i * 2) * 20;
          g.strokeStyle = `rgba(200,235,255,${0.8 - (k * n - i) * 0.15})`; g.lineWidth = 2;
          g.beginPath(); g.ellipse(cx, cy, 14 + (k * n - i) * 10, 5 + (k * n - i) * 3, 0, 0, 6.28); g.stroke();
          if (m.lantern) { g.fillStyle = '#ffcf6a'; g.fillRect(cx - 6, cy - 16, 12, 12); g.fillStyle = 'rgba(255,200,90,.35)'; g.beginPath(); g.arc(cx, cy - 10, 20, 0, 6.28); g.fill(); }
        }
        if (!n) { g.fillStyle = '#e0f0ff'; g.font = 'bold 30px sans-serif'; g.fillText(m.lantern ? 'Порыв ветра — фонарик погас!' : 'Бульк!', W / 2, Y + 205); }
        g.fillStyle = ['#7cf08a', '#f4d04a', '#ff8a7a'][mini.res.grade]; g.font = 'bold 30px sans-serif';
        g.fillText(['Идеально!', 'Неплохо', 'Мимо'][mini.res.grade] + `  +${n}`, W / 2, Y + 312);
      }
      // шкала
      const bx = X + 120, bw = PW - 240, by = Y + 350;
      g.fillStyle = '#3a2f2a'; g.fillRect(bx, by, bw, 34);
      g.fillStyle = '#c8a040'; g.fillRect(bx + (mini.zone - 0.16) * bw, by, 0.32 * bw, 34);
      g.fillStyle = '#4cc860'; g.fillRect(bx + (mini.zone - 0.06) * bw, by, 0.12 * bw, 34);
      const p = mini.phase === 'aim' ? miniPos() : mini.lastPos ?? 0.5;
      if (mini.phase === 'aim') mini.lastPos = p;
      g.fillStyle = '#fff'; g.fillRect(bx + p * bw - 3, by - 10, 6, 54);
      g.fillStyle = '#f4dca0'; g.font = '24px sans-serif';
      g.fillText(`Бросок ${Math.min(mini.try + 1, m.tries)} из ${m.tries}  ·  ${m.unit}: ${mini.total} (нужно ${m.need})`, W / 2, Y + 430);
    } else {
      // цепочка цветов: показ или ввод
      const n = mini.seq.length;
      for (let i = 0; i < n; i++) {
        const cx = W / 2 + (i - (n - 1) / 2) * 90, cy = Y + 200;
        g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.arc(cx, cy, 34, 0, 6.28); g.fill();
        const showing = mini.phase === 'show' && mini.t >= i * 0.8 && mini.t < i * 0.8 + 0.65;
        if (showing) flowerAt(cx, cy, 30, FLOWERS[mini.seq[i]].color, true);
        else if (mini.phase !== 'show' && i < mini.input) flowerAt(cx, cy, 24, FLOWERS[mini.seq[i]].color);
        else if (mini.phase === 'good') flowerAt(cx, cy, 24, FLOWERS[mini.seq[i]].color);
      }
      g.fillStyle = '#f4dca0'; g.font = '24px sans-serif';
      const msg = mini.phase === 'show' ? 'Запоминай…' : mini.phase === 'input' ? 'Повтори!' : mini.phase === 'good' ? 'Верно!' : mini.phase === 'oops' ? 'Не тот цветок — смотри ещё раз' : '';
      g.fillText(msg, W / 2, Y + 270);
      for (let k = 0; k < 4; k++) {
        const cx = W / 2 - 270 + k * 180, cy = 450;
        const on = mini.pressed && mini.pressed.i === k;
        g.fillStyle = on ? '#4a3a24' : '#2b231b'; g.beginPath(); g.arc(cx, cy, 62, 0, 6.28); g.fill();
        g.strokeStyle = on ? '#e2b65a' : '#5c4a35'; g.lineWidth = 3; g.stroke();
        flowerAt(cx, cy - 8, 26, FLOWERS[k].color);
        g.fillStyle = '#b9a98f'; g.font = '18px sans-serif'; g.fillText(`${FLOWERS[k].key} · ${FLOWERS[k].name}`, cx, cy + 40);
      }
      g.fillStyle = '#f4dca0'; g.font = '22px sans-serif';
      g.fillText(`Круг ${Math.min(mini.round + 1, m.rounds.length)} из ${m.rounds.length}  ·  ошибок можно: ${mini.lives - 1}`, W / 2, Y + PH - 20);
      if (mini.flash) { g.fillStyle = `rgba(220,40,40,${mini.flash * 0.5})`; g.fillRect(X, Y, PW, PH); }
    }
    if (mini.phase === 'end') {
      g.fillStyle = 'rgba(8,6,12,.6)'; g.fillRect(X, Y, PW, PH);
      g.fillStyle = mini.win ? '#7cf08a' : '#ff8a7a'; g.font = 'bold 48px Georgia, serif';
      g.fillText(mini.win ? 'Получилось!' : 'Не вышло…', W / 2, Y + PH / 2);
    }
  }

  // Светлячки: ночь в саду, ловить на бегу. Убегают, если подойти слишком близко.
  let ffly = null;
  function startFireflies(m) {
    const flies = [];
    while (flies.length < m.count) {
      const tx = 1 + Math.random() * (map.tiles[0].length - 2), ty = 1 + Math.random() * (map.tiles.length - 2);
      if (isSolid(tileAt(tx | 0, ty | 0)) || Math.hypot(tx * T - hero.x, ty * T - hero.y) < 200) continue;
      flies.push({ x: tx * T, y: ty * T, a: Math.random() * 6.28, ph: Math.random() * 6.28 });
    }
    ffly = { m, t: m.time, got: 0, flies };
  }
  function updateFireflies(dt) {
    if (!ffly) return;
    ffly.t -= dt;
    for (const f of ffly.flies) {
      f.ph += dt * 4;
      f.a += (Math.random() - 0.5) * dt * 4;
      const dx = f.x - hero.x, dy = f.y - (hero.y - 30), d = Math.hypot(dx, dy);
      let sp = ffly.m.speed;
      if (d < ffly.m.shy) { f.a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8; sp = ffly.m.dart; }   // испугался — рывок прочь
      const nx = f.x + Math.cos(f.a) * sp * dt, ny = f.y + Math.sin(f.a) * sp * dt;
      if (isSolid(tileAt(Math.floor(nx / T), Math.floor((ny + 20) / T)))) f.a += Math.PI * (0.6 + Math.random() * 0.8);
      else { f.x = nx; f.y = ny; }
      if (d < 46) { f.caught = true; ffly.got++; burst(f.x, f.y, 10, '230,255,140'); }
    }
    ffly.flies = ffly.flies.filter((f) => !f.caught);
    const m = ffly.m;
    if (ffly.got >= m.need || ffly.t <= 0 || !ffly.flies.length) {
      const win = ffly.got >= m.need;
      ffly = null;
      startDialogue(win ? m.win : m.fail);
    }
  }
  function drawFireflies(ox, oy) {
    if (!ffly) return;
    g.fillStyle = 'rgba(6,8,30,.55)'; g.fillRect(0, 0, W, H);       // ночь
    for (const f of ffly.flies) {
      const x = f.x - ox, y = f.y - oy, a = 0.55 + Math.sin(f.ph) * 0.35;
      g.fillStyle = `rgba(220,255,120,${a * 0.3})`; g.beginPath(); g.arc(x, y, 16, 0, 6.28); g.fill();
      g.fillStyle = `rgba(240,255,170,${a})`; g.fillRect(x - 3, y - 3, 6, 6);
    }
    const txt = `Светлячки: ${ffly.got} / ${ffly.m.need}  ·  ${Math.ceil(ffly.t)} с`;
    g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(W / 2 - 220, 92, 440, 46);
    g.fillStyle = ffly.t < 8 ? '#ff6a5a' : '#e6ffa0';
    g.fillText(txt, W / 2, 116);
  }

  // Охота в лабиринте сознания (map.hunt): видно только вокруг героя, фигуры меняют облик,
  // морок тает с шёпотом, настоящий Гидан ускользает slips раз, пойманный — с лицом героя.
  let hunt = null;
  const rnd = (a) => a[0] + Math.random() * (a[1] - a[0]);
  function startHunt() {
    const h = map.hunt;
    hunt = null;
    if (!h || !check(h.if)) return;
    const spots = h.spots.slice().sort(() => Math.random() - 0.5);
    const figs = spots.slice(0, h.figures).map((s, i) => ({ x: s[0] * T + T / 2, y: s[1] * T + T - 6, real: i === 0, ph: Math.random() * 6, alive: 1 }));
    const anchors = (h.anchors || []).map((a) => ({ ...a, px: a.x * T + T / 2, py: a.y * T + T - 10, cd: 0 }));
    hunt = {
      h, figs, anchors, slips: h.slips, confuse: 0, nextConfuse: h.confuseEvery, scare: 0, whisper: null, wt: 0,
      mad: 0, calm: 0, stun: 0, stunCd: 0, drain: 0,                    // Безумие
      taunt: null, nextTaunt: rnd(h.taunt.every), lastTaunt: null, shake: 0, laugh: 0,   // издёвки
      blocks: [], nextBlock: rnd(h.block.every),                        // перекрытые проходы
    };
  }
  function whisper(text) {
    hunt.whisper = render(text);
    hunt.wt = 3;
    hunt.scare = 0.7;
  }
  // смех Гидана: надпись и короткая тряска экрана
  function laugh() {
    hunt.laugh = 1.2;
    hunt.shake = 0.2;
  }
  // о чём издеваться: у якоря со своей зоной, в тупике — о судьбе, иначе — общее
  function tauntZone() {
    for (const a of hunt.anchors) if (a.zone && Math.hypot(a.px - hero.x, a.py - hero.y) < 4 * T) return a.zone;
    const tx = Math.floor(hero.x / T), ty = Math.floor((hero.y - 10) / T);
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isSolid(tileAt(tx + dx, ty + dy))).length;
    return open <= 1 ? 'fate' : 'any';
  }
  function startTaunt() {
    const pool = HUNT_TEXT.taunts[tauntZone()].filter((t) => t !== hunt.lastTaunt);
    const text = pool[(Math.random() * pool.length) | 0] || HUNT_TEXT.taunts.any.find((t) => t !== hunt.lastTaunt);
    hunt.lastTaunt = text;
    hunt.taunt = { text: render(text), t: hunt.h.taunt.show };
    state.flags.gidan_taunt_count = (state.flags.gidan_taunt_count || 0) + 1;
  }
  // перекрыть коридор в 2–5 клетках от героя (не клетку героя, не якорь, не фигуру)
  function blockPassage() {
    const htx = Math.floor(hero.x / T), hty = Math.floor((hero.y - 10) / T);
    const cand = [];
    for (let ty = 1; ty < map.tiles.length - 1; ty++) {
      for (let tx = 1; tx < map.tiles[0].length - 1; tx++) {
        if (map.tiles[ty][tx] !== 'z') continue;
        const d = Math.abs(tx - htx) + Math.abs(ty - hty);
        if (d < 2 || d > 5) continue;
        const o = (x, y) => map.tiles[y][x] === 'z';
        if (!((o(tx - 1, ty) && o(tx + 1, ty) && !o(tx, ty - 1) && !o(tx, ty + 1)) || (o(tx, ty - 1) && o(tx, ty + 1) && !o(tx - 1, ty) && !o(tx + 1, ty)))) continue;
        if (hunt.anchors.some((a) => a.x === tx && a.y === ty)) continue;
        if (hunt.figs.some((f) => Math.floor(f.x / T) === tx && Math.floor((f.y - 10) / T) === ty)) continue;
        cand.push({ tx, ty });
      }
    }
    if (!cand.length) return;
    const b = cand[(Math.random() * cand.length) | 0];
    hunt.blocks.push({ ...b, t: hunt.h.block.hold });
    burst(b.tx * T + T / 2, b.ty * T + T / 2, 14, '150,90,220');
    toast(HUNT_TEXT.block);
  }
  function clearBlocks() {
    if (!hunt.blocks.length) return;
    for (const b of hunt.blocks) burst(b.tx * T + T / 2, b.ty * T + T / 2, 12, '220,200,255');
    hunt.blocks = [];
  }
  function updateHunt(dt) {
    if (!hunt) return;
    const h = hunt.h, M = h.madness;
    hunt.shake = Math.max(0, hunt.shake - dt);
    hunt.laugh = Math.max(0, hunt.laugh - dt);
    hunt.stun = Math.max(0, hunt.stun - dt);
    hunt.stunCd = Math.max(0, hunt.stunCd - dt);
    hunt.calm = Math.max(0, hunt.calm - dt);
    for (const a of hunt.anchors) a.cd = Math.max(0, a.cd - dt);
    if (hunt.done) {                                    // пойман — безумие отпускает
      hunt.mad = Math.max(0, hunt.mad - dt * 40);
      hunt.blocks = []; hunt.taunt = null;
      syncMadness();
      return;
    }
    hunt.scare = Math.max(0, hunt.scare - dt);
    hunt.wt = Math.max(0, hunt.wt - dt);
    hunt.confuse = Math.max(0, hunt.confuse - dt);
    if ((hunt.nextConfuse -= dt) <= 0) {
      hunt.nextConfuse = h.confuseEvery;
      hunt.confuse = h.confuseFor;
      toast(render(HUNT_TEXT.confuse));
    }

    // издёвки: раз в 8–15 с, не поверх шёпота; в конце — смех
    if (hunt.taunt) {
      if ((hunt.taunt.t -= dt) <= 0) { hunt.taunt = null; laugh(); hunt.nextTaunt = rnd(h.taunt.every); }
    } else if ((hunt.nextTaunt -= dt) <= 0 && !hunt.wt) startTaunt();

    // перекрытия: держатся hold секунд
    for (const b of hunt.blocks) b.t -= dt;
    if (hunt.blocks.some((b) => b.t <= 0)) {
      hunt.blocks = hunt.blocks.filter((b) => b.t > 0);
      toast(HUNT_TEXT.unblock);
    }
    if ((hunt.nextBlock -= dt) <= 0) { hunt.nextBlock = rnd(h.block.every); blockPassage(); }

    // якоря: возвращают рассудок, снимают перекрытия
    for (const a of hunt.anchors) {
      if (Math.hypot(a.px - hero.x, a.py - hero.y) > 52) { a.near = false; continue; }
      if (a.near) continue;
      a.near = true;
      if (a.cd > 0) { toast(HUNT_TEXT.anchorTired); continue; }
      a.cd = h.anchorCd;
      hunt.mad = 0; hunt.calm = h.anchorCalm;
      burst(a.px, a.py - 30, 18, '255,236,170');
      toast(render(HUNT_TEXT.anchors[a.kind]));
      clearBlocks();
    }

    // Безумие: растёт рядом с настоящим Гиданом и пока он говорит, иначе спадает
    const real = hunt.figs.find((f) => f.real && !f.gone);
    const watched = (real && Math.hypot(real.x - hero.x, real.y - hero.y) < M.attention * T) || hunt.taunt;
    if (watched && !hunt.calm) hunt.mad = Math.min(100, hunt.mad + M.rise * dt);
    else hunt.mad = Math.max(0, hunt.mad - M.fall * dt);
    if (hunt.mad >= M.from && state.hp > 1) {           // медленно отнимает ОЗ, уворот не спасает, но не добивает
      hunt.drain += (M.dps[0] + (M.dps[1] - M.dps[0]) * hunt.mad / 100) * dt;
      if (hunt.drain >= 1) {
        const d = Math.floor(hunt.drain);
        hunt.drain -= d;
        state.hp = Math.max(1, state.hp - d);
        floaters.push({ x: hero.x, y: hero.y - 70, text: '−' + d, life: 0.7, color: '#c58aff' });
      }
      if (state.hp <= 1 && !hunt.stunCd) {               // на краю: теряет управление и слышит смех
        hunt.stun = 1; hunt.stunCd = 8;
        laugh();
        toast(render(HUNT_TEXT.stun));
      }
    }
    syncMadness();

    for (const f of hunt.figs) {
      f.ph += dt;
      if (f.gone) { f.alive -= dt * 2; continue; }
      if (Math.hypot(f.x - hero.x, f.y - hero.y) > 58) continue;
      if (!f.real) {                                     // морок тает
        f.gone = true;
        burst(f.x, f.y - 30, 16, '150,90,220');
        whisper(HUNT_TEXT.whispers[(Math.random() * HUNT_TEXT.whispers.length) | 0]);
      } else if (hunt.slips > 0) {                       // ускользает в другой тупик, подальше от героя
        hunt.slips--;
        const busy = (s) => hunt.figs.some((o) => !o.gone && Math.abs(o.x - (s[0] * T + T / 2)) < 2 && Math.abs(o.y - (s[1] * T + T - 6)) < 2);
        const far = h.spots.filter((s) => !busy(s) && Math.hypot(s[0] * T - hero.x, s[1] * T - hero.y) > 6 * T);
        const s = far[(Math.random() * far.length) | 0] || h.spots[0];
        burst(f.x, f.y - 30, 16, '150,90,220');
        f.x = s[0] * T + T / 2; f.y = s[1] * T + T - 6;
        whisper(HUNT_TEXT.slip);
      } else {                                           // пойман: у него лицо героя
        f.caught = true;
        hunt.done = true;
        hunt.confuse = 0;
        state.flags.maze_caught = true;
        const dx = hero.x - f.x, dy = hero.y - f.y;
        f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        startDialogue(h.caught);
      }
    }
    hunt.figs = hunt.figs.filter((f) => f.alive > 0);
  }
  function syncMadness() {
    state.flags.madness_level = Math.round(hunt.mad);
    state.flags.madness_active = hunt.mad >= hunt.h.madness.from;
  }
  function drawFigure(f, ox, oy) {
    const x = Math.round(f.x - ox), y = Math.round(f.y - oy);
    const sp = f.caught ? heroSprite(f.dir)
      : img(`assets/sprites/${hunt.h.sprites[Math.floor(f.ph / 1.1 + f.x) % hunt.h.sprites.length]}_down.png`);
    if (!ready(sp)) return;
    g.globalAlpha = f.caught ? 1 : Math.max(0, f.alive) * (0.6 + 0.3 * Math.sin(f.ph * 5));
    shadow(x, y - 2, 18);
    g.drawImage(sp, x - 32, y - 64 + Math.sin(f.ph * 2) * 2, 64, 64);
    if (!f.caught) { g.globalAlpha *= 0.4; g.drawImage(silhouette(sp, '#7a3cc0'), x - 32, y - 64 + Math.sin(f.ph * 2) * 2, 64, 64); }
    g.globalAlpha = 1;
  }
  // якорь: тёплое свечение (тусклое, пока перезаряжается) и сам предмет
  function drawAnchor(a, ox, oy) {
    const x = Math.round(a.px - ox), y = Math.round(a.py - oy);
    const k = a.cd > 0 ? 0.25 : 1;
    g.fillStyle = `rgba(255,236,170,${(0.25 + Math.sin(time * 3 + a.x) * 0.12) * k})`;
    g.beginPath(); g.ellipse(x, y - 20, 34, 24, 0, 0, 6.28); g.fill();
    g.globalAlpha = 0.5 + 0.5 * k;
    if (a.kind === 'portrait') drawPortraitProp('dolita', x, y + 6, 0.7);
    else if (a.kind === 'mirror') g.drawImage(MIRROR, x - 24, y - 70, 48, 72);
    else if (a.kind === 'letter') g.drawImage(NOTE, x - 30, y - 46, 60, 50);
    else g.drawImage(RIBBON, x - 24, y - 44, 48, 48);
    g.globalAlpha = 1;
  }
  // тьма вокруг героя, фиолетовые края безумия, перекрытия, шёпот, издёвки
  function drawMind(ox, oy) {
    if (!hunt) return;
    for (const b of hunt.blocks) {                       // перекрытый проход — колышущаяся тень
      const X = b.tx * T - ox, Y = b.ty * T - oy;
      g.fillStyle = `rgba(90,20,140,${0.55 + 0.2 * Math.sin(time * 6 + b.tx)})`;
      g.fillRect(X, Y, T, T);
      g.strokeStyle = `rgba(210,150,255,${0.5 + 0.3 * Math.sin(time * 9)})`; g.lineWidth = 3;
      g.strokeRect(X + 4, Y + 4, T - 8, T - 8);
    }
    const hx = hero.x - ox, hy = hero.y - 30 - oy;
    const r = hunt.done ? 420 : 250 + Math.sin(time * 2) * 12;
    const grd = g.createRadialGradient(hx, hy, r * 0.35, hx, hy, r);
    grd.addColorStop(0, 'rgba(4,2,10,0)');
    grd.addColorStop(1, 'rgba(4,2,10,.97)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    if (hunt.mad > 0) {                                  // безумие окрашивает края в фиолетовый (#6a0dad)
      const m = hunt.mad / 100;
      const vg = g.createRadialGradient(W / 2, H / 2, H * (0.62 - 0.3 * m), W / 2, H / 2, W * 0.62);
      vg.addColorStop(0, 'rgba(106,13,173,0)');
      vg.addColorStop(1, `rgba(106,13,173,${0.7 * m})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }
    if (hunt.scare) { g.fillStyle = `rgba(60,0,30,${hunt.scare * 0.6})`; g.fillRect(0, 0, W, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (hunt.wt) {
      g.globalAlpha = Math.min(1, hunt.wt);
      g.font = 'italic 30px Georgia, serif';
      g.fillStyle = '#000'; g.fillText(hunt.whisper, W / 2 + 2, 152);
      g.fillStyle = '#d8b8ff'; g.fillText(hunt.whisper, W / 2, 150);
      g.globalAlpha = 1;
    }
    if (hunt.taunt) {                                    // голос Гидана — без окна диалога
      g.globalAlpha = Math.min(1, hunt.taunt.t * 2, (hunt.h.taunt.show - hunt.taunt.t) * 3);
      g.font = 'italic 28px Georgia, serif';
      wrapText(`Гидан: «${hunt.taunt.text}»`, W / 2, 200, 1000, 36, '#ffb0e8');
      g.globalAlpha = 1;
    }
    if (hunt.laugh) {
      g.globalAlpha = Math.min(1, hunt.laugh * 2);
      g.font = 'bold italic 40px Georgia, serif';
      g.fillStyle = '#000'; g.fillText(HUNT_TEXT.laugh, W / 2 + 3, 283);
      g.fillStyle = '#ff6ad0'; g.fillText(HUNT_TEXT.laugh, W / 2, 280);
      g.globalAlpha = 1;
    }
    if (hunt.confuse) {
      g.font = 'bold 26px sans-serif';
      g.fillStyle = `rgba(255,120,200,${0.6 + 0.4 * Math.sin(time * 10)})`;
      g.fillText('⟲ мысли путаются: управление наоборот', W / 2, H - 60);
    }
  }
  // текст по центру в несколько строк, с тенью
  function wrapText(text, x, y, maxW, lh, color) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    lines.push(cur);
    lines.forEach((l, i) => {
      g.fillStyle = '#000'; g.fillText(l, x + 2, y + i * lh + 2);
      g.fillStyle = color; g.fillText(l, x, y + i * lh);
    });
  }
  // полоска Безумия под ОЗ — как у яда
  function drawMadness() {
    if (!hunt || hunt.mad <= 0) return;
    const X = 16, Y = 124, Wd = 200, m = hunt.mad / 100;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(X, Y, Wd + 44, 22);
    g.fillStyle = '#6a0dad'; g.beginPath(); g.arc(X + 15, Y + 11, 8, 0, 6.28); g.fill();
    g.strokeStyle = '#e0b0ff'; g.lineWidth = 2;
    g.beginPath(); g.arc(X + 15, Y + 11, 4 + Math.sin(time * 6), 0.5, 5.8); g.stroke();
    g.fillStyle = '#25103a'; g.fillRect(X + 32, Y + 5, Wd, 12);
    g.fillStyle = state.flags.madness_active ? '#b04aff' : '#7a3cc0'; g.fillRect(X + 32, Y + 5, Wd * m, 12);
    g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText(`Безумие ${Math.round(hunt.mad)}%`, X + 32 + Wd / 2, Y + 11);
  }

  // Покои после лабиринта (map.rooms): счётчик комнат, подсказки, метки, дверь
  let rooms = null;
  function startRooms() {
    rooms = map.rooms ? { r: map.rooms, idle: 0, hinted: false, markers: false, last: -1, inside: null } : null;
  }
  function updateRooms(dt) {
    if (!rooms) return;
    const R = rooms.r, f = state.flags;
    const n = R.list.filter((x) => f[x.flag]).length;
    f.rooms_visited = n;
    if (n !== rooms.last) { rooms.last = n; rooms.idle = 0; }
    if (n >= R.need && !f.labyrinth_exit_unlocked) {
      f.labyrinth_exit_unlocked = true;
      burst(T / 2, 9 * T, 30, '255,255,255');
      toast(ROOMS_TEXT.open);
      save();
    }
    if (!f.labyrinth_exit_unlocked) {
      rooms.idle += dt;
      if (rooms.idle > R.hintAt && !rooms.hinted) { rooms.hinted = true; toast(ROOMS_TEXT.lost); }
      if (rooms.idle > R.markersAt && !rooms.markers) { rooms.markers = true; toast(ROOMS_TEXT.markers); }
    }
    // зашёл в комнату — её название
    const tx = hero.x / T, ty = (hero.y - 10) / T;
    const room = R.list.find((x) => tx >= x.area[0] && tx < x.area[2] + 1 && ty >= x.area[1] && ty < x.area[3] + 1);
    if ((room && room.id) !== rooms.inside) { rooms.inside = room && room.id; if (room) showArea(ROOMS_TEXT.names[room.id]); }
  }
  function drawRooms(ox, oy) {
    if (!rooms) return;
    const R = rooms.r, f = state.flags;
    for (const y of [8, 9]) {                            // дверь: три печати или белый свет
      const X = -ox, Y = y * T - oy;
      if (f.labyrinth_exit_unlocked) {
        g.fillStyle = `rgba(255,255,240,${0.45 + 0.25 * Math.sin(time * 4)})`; g.fillRect(X, Y, T, T);
      } else {
        g.fillStyle = 'rgba(40,10,60,.85)'; g.fillRect(X, Y, T, T);
        g.fillStyle = '#9a5ad0'; g.fillRect(X + 26, Y + 8, 12, 48);
      }
    }
    // тьма покоев
    const hx = hero.x - ox, hy = hero.y - 30 - oy;
    const grd = g.createRadialGradient(hx, hy, 160, hx, hy, 640);
    grd.addColorStop(0, 'rgba(6,4,12,0)'); grd.addColorStop(1, 'rgba(6,4,12,.85)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // метки над неосмотренным (через две минуты блужданий)
    if (rooms.markers) {
      for (const x of R.list) {
        if (f[x.flag]) continue;
        const n = npcs.find((o) => o.id === x.key);
        if (!n) continue;
        const X = n.px - ox, Y = n.py - oy - 120 + Math.sin(time * 5) * 6;
        g.fillStyle = '#ffd86a';
        g.beginPath(); g.moveTo(X - 14, Y - 14); g.lineTo(X + 14, Y - 14); g.lineTo(X, Y + 6); g.fill();
      }
    }
  }
  // счётчик комнат: «Комнаты: n/3» и три огонька
  function drawRoomsHud() {
    if (!rooms) return;
    const R = rooms.r, f = state.flags;
    const X = 16, Y = 124;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(X, Y, 288, 34);
    g.font = 'bold 18px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = f.labyrinth_exit_unlocked ? '#f4dca0' : '#e0d0ff';
    g.fillText(f.labyrinth_exit_unlocked ? 'Дверь открыта ←' : `Комнаты: ${f.rooms_visited || 0}/${R.need}`, X + 10, Y + 17);
    R.list.forEach((x, i) => {
      const cx = X + 196 + i * 30;
      g.fillStyle = f[x.flag] ? '#ffd86a' : '#3a2a4a';
      g.beginPath(); g.arc(cx, Y + 17, 10, 0, 6.28); g.fill();
      g.fillStyle = f[x.flag] ? '#2a1d0b' : '#9a8ab0';
      g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
      g.fillText(ROOMS_TEXT.names[x.id].split(' ').pop()[0], cx, Y + 18);
    });
  }

  // Пустота мета-сцены: светлое пятно в центре, по краям тьма
  function drawVignette(ox, oy) {
    const cx = (map.tiles[0].length * T) / 2 - ox, cy = (map.tiles.length * T) / 2 - oy - 20;
    const grd = g.createRadialGradient(cx, cy, 80, cx, cy, 420);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }

  // Экран концовки
  function showEnding(id) {
    const e = ENDINGS[id];
    state.flags['ending_' + id] = true;
    save();
    setMeta('ending_' + id, true);
    mode = 'ending';
    $('ending-title').textContent = render(e.title);
    $('ending-text').textContent = render(e.text);
    $('ending').classList.toggle('green', e.style === 'green');          // Прощение: тьма и зелёные буквы, без титров
    $('btn-ending').hidden = e.style === 'green';
    if (e.style === 'green') setTimeout(() => { $('btn-ending').hidden = false; }, 4000);
    screen('ending');
  }

  // Зоны-триггеры: герой зашёл за линию — диалог
  function checkTriggers() {
    if (chase) return;
    for (const tr of map.triggers || []) {
      if (check(tr.if) && (tr.maxY == null || hero.y < tr.maxY)) { startDialogue(tr.d); return; }
    }
  }

  // Видение: появляется, когда герой подходит, копирует его позу и тает
  let ghost = null;
  function updateApparition(dt) {
    const a = map.apparition;
    if (!ghost) {
      if (a && check(a.if) && hero.y < a.near) { ghost = { t: 0, x0: hero.x }; state.flags[a.set] = true; save(); }
      return;
    }
    ghost.t += dt;
    if (ghost.t > 4 || !a) ghost = null;
  }
  function drawGhost(ox, oy) {
    const a = map.apparition;
    if (!ghost || !a) return;
    const alpha = Math.min(1, ghost.t / 0.8, (4 - ghost.t) / 1.2) * 0.85;
    const x = a.x * T + T / 2 + (hero.x - ghost.x0) - ox, y = a.y * T + T - 6 - oy;
    const mirror = { up: 'down', down: 'up', left: 'left', right: 'right' }[hero.dir];   // как отражение
    const sp = img(`assets/sprites/${a.sprite}_${mirror}.png`);
    if (!ready(sp)) return;
    g.globalAlpha = Math.max(0, alpha);
    g.drawImage(silhouette(sp, '#07060c'), x - 32, y - 64, 64, 64);
    g.globalAlpha = Math.max(0, alpha * 0.5);
    g.drawImage(sp, x - 32, y - 64, 64, 64);
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- Бой
  const elemColor = () => ({ sun: '255,150,50', storm: '120,220,255', radiance: '255,230,140' }[state.flags.light_element] || '255,255,255');

  function spawnEnemy(e) {
    const k = ENEMIES[e.kind];
    return { kind: e.kind, k, x: e.x * T + T / 2, y: e.y * T + T - 6, hp: k.hp, st: 'idle', t: Math.random() * 2,
      dir: 'down', vx: 0, vy: 0, hit: 0, dead: 0, wander: Math.random() * 6.28,
      cast: k.ranged ? k.ranged.every * 0.6 : 0, side: Math.random() < 0.5 ? -1 : 1 };
  }

  // Атака: автонаводка на ближайшего врага, мышь — в сторону курсора
  function attack(aimX, aimY) {
    if (mode !== 'play' || hero.cd > 0 || hero.casting) return;
    const w = WEAPONS[state.hero.weapon];
    const el = state.flags.light_element;
    if (w.ammo && hero.ammo < 1) { hero.cd = 0.3; return toast('Стрелы кончились — новая через пару секунд'); }
    if (w.manaCost && hero.mana < w.manaCost) { hero.cd = 0.3; return toast('Не хватает маны'); }
    hero.cd = w.cooldown * (el === 'storm' ? 0.75 : 1);
    const dmg = (w.dmg + (el === 'sun' ? 1 : 0)) * dmgMul();
    const hx = hero.x, hy = hero.y - 26;
    let ang;
    if (aimX != null) ang = Math.atan2(aimY - hy, aimX - hx);
    else {
      let best = w.type === 'melee' ? 150 : w.range * 1.1, tgt = null;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - hx, e.y - 20 - hy);
        if (d < best) { best = d; tgt = e; }
      }
      ang = tgt ? Math.atan2(tgt.y - 20 - hy, tgt.x - hx)
        : { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[hero.dir];
    }
    hero.dir = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? (Math.cos(ang) > 0 ? 'right' : 'left') : (Math.sin(ang) > 0 ? 'down' : 'up');
    if (w.type === 'melee') {
      hero.swing = { t: 0, ang };
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - hx, dy = e.y - 20 - hy;
        let da = Math.atan2(dy, dx) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.hypot(dx, dy) < w.range + 26 && Math.abs(da) < 1.35) hitEnemy(e, dmg, ang);
      }
    } else if (w.cast) {                               // посох: каст стоя, потом снаряд
      hero.mana -= w.manaCost;
      hero.casting = { t: w.cast * castMul(), ang, dmg };
    } else {
      hero.ammo -= 1;
      fireShot(ang, dmg, w);
    }
  }
  function fireShot(ang, dmg, w) {
    const hx = hero.x, hy = hero.y - 26;
    const sp = w.type === 'arrow' ? 620 : 360;           // у стрелы — время полёта, стены и укрытия её ловят
    shots.push({ x: hx + Math.cos(ang) * 20, y: hy + Math.sin(ang) * 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      life: w.range / sp, dmg, kind: w.type, ang });
  }
  // Рывок: в сторону движения (или взгляда), 0.3 с неуязвимости, перезарядка падает с уровнем
  function dash() {
    if (mode !== 'play' || hero.dash || hero.dashCd > 0 || hero.casting) return;
    if (hunt && hunt.stun > 0) return;
    const v = moveVector();
    let ax = v.x, ay = v.y;
    if (v.len < 0.15) [ax, ay] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[hero.dir];
    const l = Math.hypot(ax, ay) || 1;
    hero.dash = { t: DASH.time, vx: ax / l * DASH.speed, vy: ay / l * DASH.speed };
    hero.dodge = dashInv();
    hero.dashCd = dashCd();
    hero.kx = hero.ky = 0;
  }

  function hitEnemy(e, dmg, ang, ranged) {
    if (e.k.dodge && e.st !== 'rest' && !e.dash && Math.random() < e.k.dodge) {   // Аэдел уходит в сторону рывком
      enemyDash(e, ang + (Math.random() < 0.5 ? 1.57 : -1.57));
      e.dashCd = Math.max(e.dashCd, 0.8);
      floaters.push({ x: e.x, y: e.y - 70, text: FIGHT_TEXT.dodge, life: 0.7, color: '#9ad8ff' });
      return;
    }
    if (e.k.ghost && ranged) dmg *= 1.5;             // призраки боятся света и магии
    if (e.k.weakSpirit && (blessed('spirit') || skill('spirit') >= 1)) dmg *= e.k.weakSpirit;
    if (ranged && e.k.resist) dmg *= 1 - e.k.resist * (skill('power') >= 3 ? 0.5 : 1);  // боссы держат стрелы и магию; «Пробой» — вполовину
    dmg = Math.round(dmg * 10) / 10;
    e.hp -= dmg;
    e.hit = 0.15;
    if (!e.k.static) { e.vx = Math.cos(ang) * (e.k.boss ? 120 : 320); e.vy = Math.sin(ang) * (e.k.boss ? 120 : 320); }
    if (e.st === 'idle' || (e.st === 'windup' && !e.k.boss)) { e.st = 'stagger'; e.t = 0.25; }
    if (e.k.boss && e.st === 'idle') e.st = 'chase';
    floaters.push({ x: e.x, y: e.y - 60, text: String(dmg), life: 0.8, color: '#fff2c4' });
    burst(e.x, e.y - 24, 8, elemColor());
    if (e.hp <= 0) {
      e.dead = 0.001; burst(e.x, e.y - 20, 18, '120,110,100'); gainXp(e.k.xp || 0, e.k.mana || 0);
      if (e.k.copies) for (const c of enemies) if (c.kind === 'dane_copy' && !c.dead) { c.dead = 0.001; burst(c.x, c.y - 30, 10, '150,220,255'); }
      const gold = state.map === 'arena' ? 0 : e.k.gold ?? (e.k.boss ? 30 : 0);   // на арене — только опыт и мана
      if (gold) { state.flags.gold = (state.flags.gold || 0) + gold; floaters.push({ x: e.x, y: e.y - 84, text: `+${gold} 💰`, life: 1.1, color: '#ffd86a' }); updateHud(); }
    }
  }

  function burst(x, y, n, rgb) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 180;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.3 + Math.random() * 0.3, rgb });
    }
  }

  function hurtHero(dmg, fromX, fromY, src) {
    if (hero.inv > 0 || hero.dodge > 0) return;
    if (skill('agility') >= 3 && Math.random() < 0.15) {        // «Уворот» Полианны
      hero.inv = 0.4;
      floaters.push({ x: hero.x, y: hero.y - 70, text: 'Уворот!', life: 0.8, color: '#9ad8ff' });
      return;
    }
    if (inv('ribbon')) dmg *= 0.85;                             // Красная лента
    if (src === 'priest' && inv('dagger')) dmg *= 0.6;          // Священный кинжал
    dmg = Math.max(1, Math.round(dmg));
    state.hp = Math.max(0, state.hp - dmg);
    hero.inv = 0.9;
    const a = Math.atan2(hero.y - fromY, hero.x - fromX);
    hero.kx = Math.cos(a) * 420; hero.ky = Math.sin(a) * 420;
    floaters.push({ x: hero.x, y: hero.y - 70, text: '−' + dmg, life: 0.9, color: '#ff8a7a' });
    burst(hero.x, hero.y - 28, 10, '220,60,50');
    if (state.hp <= 0) heroDown();
  }

  // Герой пал — очнётся в деревне с полными ОЗ, волки вернутся
  function heroDown() {
    const dr = state.map === 'arena' && state.flags.duel_ret;                 // проиграл вызов — туда, откуда бросил перчатку
    if (dr) { state.flags.duel_ret = null; curEnc = null; enemies = []; ebolts = []; }
    const r = dr ? { ...dr, d: 'duel_lost' } : map.respawn || { map: 'village', at: [16.5, 7.6], dir: 'up', d: 'hero_down' };
    mode = 'fade';
    fade(() => {
      state.hp = maxHp();
      enterMap(r.map, r.at, r.dir);
      setTimeout(() => startDialogue(r.d), 550);
    });
  }

  function useFlask() {
    if (mode !== 'play' || !state.flags.got_flask) return;
    if (!state.flags.has_water_flask) return toast(BAG_TEXT.flaskEmpty);
    if (state.hp >= maxHp()) return toast(BAG_TEXT.full);
    const v = healHero(FLASK_HEAL);
    state.flags.has_water_flask = false;
    if (curEnc && flaskRefill > 0) { flaskRefill = 0; flaskT = 8; }     // в бою Сосуд наполнится сам — один раз
    toast(`🧪 +${v} ОЗ. Сосуд жизни опустел` + (flaskT > 0 ? ' — наполнится через 8 с' : ''));
    save();
  }
  // Q: сначала Сосуд, потом малое зелье, потом среднее
  function quickHeal() {
    if (mode !== 'play') return;
    if (state.flags.got_flask && state.flags.has_water_flask) return useFlask();
    if (inv('potion_s')) return useItem('potion_s');
    if (inv('potion_m')) return useItem('potion_m');
    if (state.flags.got_flask) return useFlask();
  }
  function useItem(id) {
    const it = ITEMS[id];
    if (id === 'flask') return useFlask();
    if (!it || !inv(id)) return false;
    if (it.heal) {
      if (state.hp >= maxHp()) { toast(BAG_TEXT.full); return false; }
      const v = healHero(it.heal);
      toast(`${it.icon} ${it.name}: +${v} ОЗ`);
    } else if (it.buff) {
      if (it.buff.dmg) buffs.dmg = it.buff.time;
      if (it.buff.speed) buffs.speed = it.buff.time;
      burst(hero.x, hero.y - 28, 14, '255,216,106');
      toast(`${it.icon} ${it.name}: ${it.desc}`);
    } else return false;
    state.flags['inv_' + id] = inv(id) - 1;
    save();
    return true;
  }

  function updateCombat(dt) {
    hero.cd = Math.max(0, hero.cd - dt);
    hero.inv = Math.max(0, hero.inv - dt);
    hero.dodge = Math.max(0, hero.dodge - dt);
    hero.dashCd = Math.max(0, hero.dashCd - dt);
    for (const t of hero.trail) t.life -= dt;
    hero.trail = hero.trail.filter((t) => t.life > 0);
    const w = WEAPONS[state.hero.weapon];
    if (w.ammo) hero.ammo = Math.min(maxAmmo(w), hero.ammo + dt / w.regen);
    if (w.manaCost) hero.mana = Math.min(maxMana(), hero.mana + dt * w.manaRegen * manaRegenMul());
    buffs.dmg = Math.max(0, buffs.dmg - dt); buffs.speed = Math.max(0, buffs.speed - dt);
    if (flaskT > 0 && (flaskT -= dt) <= 0) {
      flaskT = 0;
      if (state.flags.got_flask && !state.flags.has_water_flask) { state.flags.has_water_flask = true; toast('🧪 Сосуд жизни снова полон'); }
    }
    if (hero.casting && (hero.casting.t -= dt) <= 0) { const c = hero.casting; hero.casting = null; fireShot(c.ang, c.dmg, w); }
    if (hero.swing && (hero.swing.t += dt) > 0.22) hero.swing = null;
    if (state.flags.light_element === 'radiance' && state.hp > 0 && state.hp < maxHp()) state.hp = Math.min(maxHp(), state.hp + dt * 0.5);

    // снаряды
    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      const t = tileAt(Math.floor(s.x / T), Math.floor((s.y + 20) / T));
      if (isSolid(t) && t !== '~') s.life = 0;
      for (const e of enemies) {
        if (e.dead || s.life <= 0) continue;
        if (Math.hypot(e.x - s.x, e.y - 22 - s.y) < (s.kind === 'magic' ? 34 : 28)) {
          hitEnemy(e, s.dmg, s.ang, true);
          s.life = 0;
          if (s.kind === 'magic') burst(s.x, s.y, 12, elemColor());
        }
      }
    }
    for (const b of ebolts) if (b.wave) for (const s of shots) if (Math.hypot(b.x - s.x, b.y - s.y) < (b.r || 40)) { s.life = 0; burst(s.x, s.y, 5, b.rgb); }
    shots = shots.filter((s) => s.life > 0);

    for (const e of enemies) updateEnemy(e, dt);
    enemies = enemies.filter((e) => e.dead < 0.6);

    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    sparks = sparks.filter((p) => p.life > 0);
    for (const f of floaters) { f.y -= 40 * dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);

    // снаряды врагов
    for (const b of ebolts) {
      if (b.homing) {                                  // сгусток мага доворачивает к герою
        const want = Math.atan2(hero.y - 24 - b.y, hero.x - b.x), cur = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
        const da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const a = cur + Math.max(-b.homing * dt, Math.min(b.homing * dt, da));
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (isSolid(tileAt(Math.floor(b.x / T), Math.floor((b.y + 20) / T)))) b.life = 0;
      if (b.life > 0 && Math.hypot(hero.x - b.x, hero.y - 24 - b.y) < 26) { b.life = 0; hurtHero(b.dmg, b.x, b.y, b.src); burst(b.x, b.y, 8, b.rgb); }
    }
    ebolts = ebolts.filter((b) => b.life > 0);
    updateHazard(dt);

    // схватку прерывают на stopAt доле ОЗ босса (Долита останавливает рыцаря)
    if (curEnc && curEnc.stopAt && mode === 'play' && enemies.some((e) => e.k.boss && !e.dead && e.hp <= e.k.hp * curEnc.stopAt)) {
      const en = curEnc;
      curEnc = null;
      enemies = []; ebolts = [];
      const at = en.onStop.at;                       // герой встаёт на место сцены
      if (at) { hero.x = at[0] * T + T / 2; hero.y = at[1] * T + T - 6; hero.dir = en.onStop.dir || hero.dir; hero.kx = hero.ky = 0; }
      apply(en.onStop);
      refreshNpcs();
      save();
      startDialogue(en.onStop.d);
      return;
    }

    // все враги схватки повержены
    if (curEnc && !enemies.length && mode === 'play') {
      const en = curEnc;
      curEnc = null;
      ebolts = [];
      apply(en.onClear);
      refreshNpcs();
      save();
      setTimeout(() => { if (mode === 'play') { if (en.onClear.d) startDialogue(en.onClear.d); else spawnEncounter(); } }, 500);
    }
  }

  // Схватки карты: первая, чьё условие выполнено (волки, стража, фазы босса)
  function spawnEncounter() {
    if (curEnc || enemies.length) return;
    const en = (map.encounters || []).find((x) => check(x.if));
    if (!en) return;
    curEnc = en;
    enemies = en.enemies.filter((e) => check(e.if)).map(spawnEnemy);
    flaskRefill = 1; flaskT = 0;
    if (state.flags.got_flask && !state.flags.has_water_flask) {   // пустой Сосуд в начале боя наполняется сразу
      flaskRefill = 0; state.flags.has_water_flask = true; toast('🧪 Сосуд жизни наполнился красной водой');
    }
  }

  // Затопление пола: зона мигает (предупреждение), затем заливается — стоять в ней больно
  function updateHazard(dt) {
    const h = map.hazard;
    if (!h || !check(h.if)) { hz.phase = 'rest'; return; }
    hz.t -= dt;
    if (hz.t <= 0) {
      if (hz.phase === 'rest') { hz.phase = 'warn'; hz.t = h.warn; }
      else if (hz.phase === 'warn') { hz.phase = 'flood'; hz.t = h.flood; hz.tick = 0; }
      else { hz.phase = 'rest'; hz.t = h.rest; hz.i = (hz.i + 1) % h.patterns.length; }
    }
    if (hz.phase === 'flood' && inHazard(hero.x, hero.y - 8)) {
      hz.tick -= dt;
      if (hz.tick <= 0) {
        hz.tick = BEAT;
        state.hp = Math.max(0, state.hp - h.dmg);
        floaters.push({ x: hero.x, y: hero.y - 70, text: '−' + h.dmg, life: 0.7, color: '#ff6a7a' });
        burst(hero.x, hero.y - 6, 5, '170,10,30');
        if (state.hp <= 0) heroDown();
      }
    }
  }
  function inHazard(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return map.hazard.patterns[hz.i].some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);
  }
  function drawHazard(ox, oy) {
    const h = map.hazard;
    if (!h || hz.phase === 'rest' || !check(h.if)) return;
    for (const [x0, y0, x1, y1] of h.patterns[hz.i]) {
      const X = x0 * T - ox, Y = y0 * T - oy, Wd = (x1 - x0 + 1) * T, Hd = (y1 - y0 + 1) * T;
      if (hz.phase === 'warn') {
        g.fillStyle = `rgba(200,20,40,${0.12 + 0.12 * Math.sin(time * 14)})`;
        g.fillRect(X, Y, Wd, Hd);
        g.strokeStyle = 'rgba(255,60,80,.7)'; g.lineWidth = 3; g.strokeRect(X + 2, Y + 2, Wd - 4, Hd - 4);
      } else {
        const a = Math.min(1, (h.flood - hz.t) * 4, hz.t * 3), beat = 1 - (time % BEAT) / BEAT;
        g.fillStyle = `rgba(120,6,20,${0.72 * a})`;
        g.fillRect(X, Y, Wd, Hd);
        g.strokeStyle = `rgba(255,90,110,${0.35 * a})`; g.lineWidth = 2;   // волны по поверхности
        for (let yy = Y + 20; yy < Y + Hd; yy += 40) {
          g.beginPath();
          for (let xx = X; xx <= X + Wd; xx += 16) g.lineTo(xx, yy + Math.sin(xx * 0.05 + time * 4 + yy) * 4);
          g.stroke();
        }
        g.fillStyle = `rgba(255,170,180,${0.25 * a * beat})`;            // отражения вспыхивают в такт
        for (let i = 0; i < Wd * Hd / 9000; i++) g.fillRect(X + ((i * 97 + Y) % Wd), Y + ((i * 53 + X) % Hd), 18, 3);
        g.strokeStyle = `rgba(255,120,140,${0.5 * a * beat})`; g.lineWidth = 2;
        g.beginPath(); g.ellipse(X + Wd / 2, Y + Hd / 2, 20 + (1 - beat) * Wd * 0.35, 8 + (1 - beat) * Hd * 0.2, 0, 0, 6.28); g.stroke();
        g.fillStyle = `rgba(230,60,80,${0.5 * a})`;
        for (let yy = Y + 12; yy < Y + Hd; yy += 32) for (let xx = X + ((yy / 32) % 2) * 20; xx < X + Wd; xx += 48) {
          g.fillRect(xx + Math.sin(time * 3 + yy) * 6, yy, 14, 2);
        }
      }
    }
  }

  // Выстрел врага: веер кровавых сгустков в сторону героя
  function fireBolts(e) {
    const r = e.k.ranged, a0 = Math.atan2(hero.y - 24 - (e.y - 30), hero.x - e.x);
    if (r.wave) {                                    // волна: ряд точек поперёк удара, каждая гаснет о стену или колонну
      const id = ++waveId, mid = (r.wave - 1) / 2, nx = -Math.sin(a0), ny = Math.cos(a0);
      for (let i = 0; i < r.wave; i++) {
        const o = (i - mid) * 22, back = (i - mid) * (i - mid) * 3;   // края чуть отстают — дуга
        ebolts.push({ x: e.x + nx * o - Math.cos(a0) * back, y: e.y - 30 + ny * o - Math.sin(a0) * back, vx: Math.cos(a0) * r.speed, vy: Math.sin(a0) * r.speed,
          life: 4, dmg: r.dmg, rgb: r.color, wave: id, wi: i, r: 30, src: e.kind });
      }
      return;
    }
    for (let i = 0; i < r.count; i++) {
      const a = a0 + (i - (r.count - 1) / 2) * r.spread;
      ebolts.push({ x: e.x, y: e.y - 30, vx: Math.cos(a) * r.speed, vy: Math.sin(a) * r.speed, life: 2.5, dmg: r.dmg, rgb: r.color || '208,24,44', homing: r.homing, src: e.kind });
    }
  }

  // рывок врага (Аэдел): короткий бросок со шлейфом
  function enemyDash(e, ang) {
    const d = e.k.dash;
    e.dash = { t: d.time, vx: Math.cos(ang) * d.speed, vy: Math.sin(ang) * d.speed };
    e.dashCd = d.cd;
  }
  function updateEnemy(e, dt) {
    if (e.dead) { e.dead += dt; return; }
    const k = e.k;
    e.hit = Math.max(0, e.hit - dt);
    if (k.static) return;                              // механизм: стоит и ждёт удара
    for (const t of e.trail || []) t.life -= dt;
    if (e.trail) e.trail = e.trail.filter((t) => t.life > 0);
    if (k.life && (e.life = (e.life ?? k.life) - dt) <= 0) { e.dead = 0.001; burst(e.x, e.y - 30, 10, '150,220,255'); return; }   // копия тает
    if (k.copies) {                                    // Дэйн: призрачные копии
      e.copyT = (e.copyT ?? k.copies.every * 0.5) - dt;
      if (e.copyT <= 0 && e.st !== 'idle') {
        e.copyT = k.copies.every;
        for (let i = 0; i < k.copies.n; i++) {
          const a = Math.random() * 6.28;
          const c = spawnEnemy({ kind: 'dane_copy', x: (e.x + Math.cos(a) * 120) / T - 0.5, y: (e.y + Math.sin(a) * 120 - T + 6) / T });
          c.st = 'chase';
          enemies.push(c);
        }
        burst(e.x, e.y - 30, 20, '150,220,255');
      }
    }
    if (k.dash) {
      e.dashCd = Math.max(0, (e.dashCd ?? 1) - dt);
      if (e.dash) {
        e.dash.t -= dt;
        if (!boxBlocked(e.x + e.dash.vx * dt, e.y, k.w, k.h)) e.x += e.dash.vx * dt;
        if (!boxBlocked(e.x, e.y + e.dash.vy * dt, k.w, k.h)) e.y += e.dash.vy * dt;
        (e.trail = e.trail || []).push({ x: e.x, y: e.y, dir: e.dir, life: 0.25 });
        if (e.dash.t <= 0) e.dash = null;
        return;
      }
    }
    e.t -= dt;
    e.cast -= dt;
    const dx = hero.x - e.x, dy = hero.y - e.y, dist = Math.hypot(dx, dy);
    let mx = 0, my = 0;
    const ranged = state.hero.weapon !== 'sword';
    const keep = k.keep && k.boss && ranged ? k.keep * 0.5 : k.keep;           // босс не даёт стрелку держать дистанцию
    const lungeAt = k.boss && ranged ? 260 : 150;
    const speed = k.speed * (k.boss && ranged ? 1.15 : 1);
    if (k.blink) {                                    // маг: герой рядом — отпрыгивает
      e.blinkCd = (e.blinkCd ?? 1) - dt;
      if (dist < 130 && e.blinkCd <= 0 && e.st !== 'windup') {
        e.blinkCd = k.blink;
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * 6.28, nx = e.x + Math.cos(a) * 240, ny = e.y + Math.sin(a) * 240;
          if (!boxBlocked(nx, ny, k.w, k.h) && Math.hypot(nx - hero.x, ny - hero.y) > 200) {
            burst(e.x, e.y - 30, 12, k.ranged.color); e.x = nx; e.y = ny; burst(e.x, e.y - 30, 12, k.ranged.color);
            break;
          }
        }
      }
    }
    switch (e.st) {
      case 'idle':                                     // бродит, пока не заметит героя
        e.wander += (Math.random() - 0.5) * dt * 3;
        if (e.t < 0) e.t = 1 + Math.random() * 2;
        if (e.t < 0.8) { mx = Math.cos(e.wander) * 35; my = Math.sin(e.wander) * 35; }
        if (dist < k.aggro) e.st = 'chase';
        break;
      case 'chase':
        if (keep) {                                    // стрелок держит дистанцию и ходит по кругу
          const dir = dist < keep - 40 ? -1 : dist > keep + 60 ? 1 : 0;
          mx = (dx * dir - dy * 0.6 * e.side) / dist * speed; my = (dy * dir + dx * 0.6 * e.side) / dist * speed;
        } else if (dist > 40) { mx = dx / dist * speed; my = dy / dist * speed; }
        if (k.ranged && k.ranged.wave && e.cast <= 0 && dist > 120) { e.st = 'windup'; e.atk = 'cast'; e.t = k.ranged.windup; e.cast = k.ranged.every; break; }   // волна — до самой стены
        if (k.dash && dist > k.dash.at && e.dashCd <= 0) { enemyDash(e, Math.atan2(dy, dx)); break; }   // Аэдел сокращает дистанцию рывком
        if (k.lunge && dist < lungeAt) { e.st = 'windup'; e.atk = 'lunge'; e.t = k.windup; e.lx = dx / dist; e.ly = dy / dist; }
        else if (k.ranged && e.cast <= 0 && dist < 560) { e.st = 'windup'; e.atk = 'cast'; e.t = k.ranged.windup; e.cast = k.ranged.every; }
        break;
      case 'windup':                                   // присел перед прыжком или готовит заклинание — «!»
        if (e.t <= 0) {
          if (e.atk === 'cast') { fireBolts(e); e.st = 'rest'; e.t = 0.5; e.side = Math.random() < 0.5 ? -1 : 1; }
          else { e.st = 'lunge'; e.t = k.lungeT; }
        }
        break;
      case 'lunge':
        mx = e.lx * k.lunge; my = e.ly * k.lunge;
        if (dist < 44) hurtHero(k.dmg, e.x, e.y, e.kind);
        if (e.t <= 0) { e.st = 'rest'; e.t = k.rest; }
        break;
      case 'rest':
        if (dist > 1) { mx = -dx / dist * 40; my = -dy / dist * 40; }
        if (e.t <= 0) e.st = 'chase';
        break;
      case 'stagger':
        if (e.t <= 0) e.st = 'chase';
        break;
    }
    // отбрасывание
    mx += e.vx; my += e.vy;
    const kk = Math.pow(0.001, dt);
    e.vx *= kk; e.vy *= kk;
    // не слипаться друг с другом
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const ox = e.x - o.x, oy = e.y - o.y, d = Math.hypot(ox, oy);
      if (d < 48 && d > 0) { mx += ox / d * 80; my += oy / d * 80; }
    }
    if (k.ghost) {                                   // призрак: сквозь стены, но в пределах карты
      const mw = map.tiles[0].length * T, mh = map.tiles.length * T;
      e.x = clamp(e.x + mx * dt, T / 2, mw - T / 2); e.y = clamp(e.y + my * dt, T, mh - T / 2);
    } else {
      if (!boxBlocked(e.x + mx * dt, e.y, k.w, k.h)) e.x += mx * dt;
      if (!boxBlocked(e.x, e.y + my * dt, k.w, k.h)) e.y += my * dt;
    }
    if (Math.abs(mx) + Math.abs(my) > 5) {
      const ax = e.st === 'windup' ? dx : mx, ay = e.st === 'windup' ? dy : my;
      e.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
    } else if (e.st === 'windup') e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  // Коллизии: «ноги» героя 34×20
  const FOOT_W = 34, FOOT_H = 20;
  function boxBlocked(x, y, w, h) {
    const l = x - w / 2, r = x + w / 2, t = y - h, b = y;
    for (let ty = Math.floor(t / T); ty <= Math.floor((b - 1) / T); ty++) {
      for (let tx = Math.floor(l / T); tx <= Math.floor((r - 1) / T); tx++) {
        if (isSolid(tileAt(tx, ty))) return true;
      }
    }
    for (const n of npcs) {
      if (Math.abs(n.px - x) < (w + n.w) / 2 && Math.abs(n.py - y) < (h + n.h) / 2) return true;
    }
    return false;
  }
  const blocked = (x, y) => boxBlocked(x, y, FOOT_W, FOOT_H);
  function moveHero(dx, dy) {
    if (!dx && !dy) return;
    if (!blocked(hero.x + dx, hero.y + dy)) { hero.x += dx; hero.y += dy; return; }
    // упёрлись краем в угол — подталкиваем вбок к свободному проходу
    for (let off = 2; off <= 16; off += 2) {
      for (const sgn of [1, -1]) {
        const ox = dy ? sgn * off : 0, oy = dx ? sgn * off : 0;
        if (!blocked(hero.x + ox, hero.y + oy) && !blocked(hero.x + ox + dx, hero.y + oy + dy)) {
          if (!blocked(hero.x + Math.sign(ox) * 2, hero.y + Math.sign(oy) * 2)) { hero.x += Math.sign(ox) * 2; hero.y += Math.sign(oy) * 2; }
          return;
        }
      }
    }
    // скользим вдоль стены маленькими шагами
    const steps = Math.ceil(Math.abs(dx + dy));
    const sx = Math.sign(dx), sy = Math.sign(dy);
    for (let i = 0; i < steps; i++) {
      if (blocked(hero.x + sx, hero.y + sy)) break;
      hero.x += sx; hero.y += sy;
    }
  }

  function checkExits() {
    const tx = Math.floor(hero.x / T), ty = Math.floor((hero.y - 4) / T);
    const ex = (map.exits || []).find((e) => e.x === tx && e.y === ty);
    if (!ex) { exitLock = false; return; }
    if (exitLock) return;                 // только что пришли на эту клетку — ждём, пока сойдёт
    if (chase && chase.run) { stepBack(); return toast('Не упусти воровку!'); }
    if (curEnc && curEnc.lock && enemies.length) { stepBack(); return toast(FIGHT_TEXT.doorsLocked); }
    exitLock = true;
    if (!check(ex.if)) { stepBack(); if (ex.else) startDialogue(ex.else); return; }
    if (ex.to) fade(() => enterMap(ex.to, ex.at, ex.dir), null, MAPS[ex.to].entry);
    else if (ex.d) { stepBack(); startDialogue(ex.d); }
  }
  // отойти на шаг от выхода (назад по направлению движения)
  function stepBack() {
    const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[hero.dir];
    for (let i = 0; i < 28; i++) if (!blocked(hero.x + d[0], hero.y + d[1])) { hero.x += d[0]; hero.y += d[1]; }
    exitLock = false;
  }

  // переход: 1.5 с затемнения с названием локации или 2 с полос letterbox (style 'letterbox')
  let fading = 0, fadeCb = null, fadeColor = '0,0,0', fadeStyle = null;
  function fade(cb, color, style) {
    if (fading) return;
    fading = 0.001; fadeCb = cb; fadeColor = color === 'white' ? '255,255,255' : '0,0,0'; fadeStyle = style || null; mode = 'fade';
  }

  function snapCamera() {
    const mw = map.tiles[0].length * T, mh = map.tiles.length * T;
    cam.x = clamp(hero.x - W / 2, 0, Math.max(0, mw - W)) - (mw < W ? (W - mw) / 2 : 0);
    cam.y = clamp(hero.y - 32 - H / 2, 0, Math.max(0, mh - H)) - (mh < H ? (H - mh) / 2 : 0);
  }
  function followCamera(dt) {
    const mw = map.tiles[0].length * T, mh = map.tiles.length * T;
    const tx = mw < W ? -(W - mw) / 2 : clamp(hero.x - W / 2, 0, mw - W);
    const ty = mh < H ? -(H - mh) / 2 : clamp(hero.y - 32 - H / 2, 0, mh - H);
    const k = 1 - Math.pow(0.0005, dt);          // плавное следование
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  // ---------------------------------------------------------------- Атмосфера: туман, свет, частицы, дождь, передний план
  // Передний план (рисуется вдвое крупнее, якорь — низ по центру)
  function leafy(cols, flowers) {
    return art(48, 28, (x) => {
      px(x, '#3a2616', 4, 20, 40, 3); px(x, '#3a2616', 20, 14, 3, 8);
      const blobs = [[10, 16, 8], [22, 12, 10], [34, 15, 9], [16, 8, 7], [30, 7, 7], [40, 20, 6], [6, 22, 5]];
      blobs.forEach(([cx, cy, r], i) => {
        x.fillStyle = cols[i % cols.length];
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) x.fillRect(cx + xx, cy + yy, 1, 1);
      });
      for (let i = 0; i < 18; i++) px(x, flowers && i % 3 === 0 ? flowers : cols[cols.length - 1], (i * 17) % 44 + 2, (i * 11) % 22 + 2, 2, 2);
    });
  }
  const FG_ART = {
    branch: leafy(['#1c3f1b', '#24521f', '#2f6b2c', '#3d8237']),
    nbranch: leafy(['#1a2620', '#22342a', '#2b4234', '#38563f'], '#b48ae0'),
    chain: art(6, 48, (x) => { for (let i = 0; i < 12; i++) px(x, i % 2 ? '#5a5a66' : '#8a8a9a', i % 2 ? 1 : 2, i * 4, i % 2 ? 4 : 2, 4); }),
    cloth: art(16, 56, (x) => {
      px(x, '#5a3a22', 0, 0, 16, 3);
      for (let c = 1; c < 15; c++) px(x, c % 4 === 0 ? '#5a0610' : c % 4 === 1 ? '#a01024' : '#7a0a1a', c, 3, 1, 44 + ((c * 7) % 9));
    }),
    lantern: art(10, 20, (x) => {
      px(x, '#2a2a30', 4, 0, 2, 6); px(x, '#3a3040', 1, 6, 8, 2); px(x, '#f4c070', 2, 8, 6, 8); px(x, '#fff0c0', 3, 9, 2, 5);
      px(x, '#3a3040', 1, 16, 8, 2);
    }),
    arch: art(40, 28, (x) => {
      x.fillStyle = '#1a1014'; x.fillRect(0, 0, 40, 28);
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.ellipse(40, 28, 34, 22, 0, 0, 6.28); x.fill();
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = '#4a3036'; x.lineWidth = 2; x.beginPath(); x.ellipse(40, 28, 34, 22, 0, Math.PI, Math.PI * 1.5); x.stroke();
    }),
    curtain: art(14, 60, (x) => {
      for (let c = 0; c < 14; c++) px(x, c % 3 === 0 ? '#2a1640' : c % 3 === 1 ? '#4a2a70' : '#3a2058', c, 0, 1, 60 - Math.max(0, 6 - c) * 2);
      px(x, '#c9a84a', 0, 34, 14, 2);
    }),
    gazebo: art(64, 22, (x) => {
      px(x, '#e8e0f0', 4, 10, 56, 6); px(x, '#b8a8d0', 4, 15, 56, 2);
      for (let i = 0; i < 10; i++) px(x, '#f4f0fa', 30 - i * 3, i, 4 + i * 6, 1);
      px(x, '#7a5aa0', 4, 16, 56, 2); for (let i = 0; i < 7; i++) px(x, '#7a5aa0', 6 + i * 8, 18, 3, 4);
    }),
  };
  const BANNERS = {};
  function bannerArt(c) {
    const [cloth, trim, sign] = { nokt: ['#2a1d3d', '#9a72d0', '#c8c0d8'], lum: ['#efe6d0', '#d4af4a', '#d4af4a'], red: ['#7a0a1a', '#c9a84a', '#e8dcc0'] }[c];
    return art(14, 44, (x) => {
      px(x, '#5a4028', 0, 0, 14, 2); px(x, cloth, 1, 2, 12, 36); px(x, trim, 1, 2, 1, 36); px(x, trim, 12, 2, 1, 36);
      for (let i = 0; i < 6; i++) px(x, cloth, 1 + i * 2, 38, 2, 6 - Math.abs(3 - i));
      px(x, sign, 5, 12, 4, 4); px(x, sign, 6, 10, 2, 8); px(x, sign, 3, 13, 8, 2);
    });
  }
  // размер элемента переднего плана в пикселях мира
  function fgBox(f) {
    if (f.t === 'line') return { l: f.x * T, r: f.x2 * T, t: f.y * T - 60, b: f.y * T };
    if (f.t === 'beam') return { l: 0, r: map.tiles[0].length * T, t: f.y * T - 28, b: f.y * T };
    if (f.t === 'awning') return { l: f.x * T - 70, r: f.x * T + 70, t: f.y * T - 36, b: f.y * T };
    const im = f.t === 'banner' ? (BANNERS[f.c] ||= bannerArt(f.c)) : FG_ART[f.t];
    const w = im.width * 2, h = im.height * 2;
    return { l: f.x * T - w / 2, r: f.x * T + w / 2, t: f.y * T - h, b: f.y * T, im };
  }

  // Мягкие пятна тумана и частицы
  const blobs = {};
  function blob(rgb) {
    return blobs[rgb] ||= art(128, 128, (x) => {
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.55, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    });
  }
  let fx = {}, puffs = [], parts = [], emit = {};
  let fxA = 1, avgDt = 1 / 60;                       // просадка FPS — гасим альфу, а не количество
  let rainK = 0;                                     // сила дождя 0…1, нарастает за 2 с
  let lbox = 0, lboxWant = 0;                        // letterbox в ключевых сценах
  const MAX_PARTS = 100;
  function startFx() {
    fx = LOCATION_FX[state.map] || {};
    parts = []; emit = {};
    puffs = [];
    const f = fx.fog;
    if (!f) return;
    const mw = map.tiles[0].length * T, mh = map.tiles.length * T;
    let spots = null;
    if (f.where === 'water') {                       // туман только над водой
      spots = [];
      map.tiles.forEach((row, ty) => [...row].forEach((c, tx) => { if (c === '~' || c === 'F') spots.push([tx, ty]); }));
    }
    for (let layer = 0; layer < 3; layer++) {
      const n = spots ? Math.min(6, Math.ceil(spots.length / 2)) : Math.min(16, Math.ceil(mw * mh / (T * T * 26)));
      for (let i = 0; i < n; i++) {
        const s = spots && spots[(Math.random() * spots.length) | 0];
        puffs.push({
          x: s ? (s[0] + Math.random()) * T : Math.random() * mw, y: s ? (s[1] + Math.random()) * T : Math.random() * mh,
          r: (spots ? 1 + Math.random() : 2.2 + Math.random() * 2.4) * T * (1 + layer * 0.35), layer, ci: i,
          a: f.a[0] + Math.random() * (f.a[1] - f.a[0]), ph: Math.random() * 6.28, home: !!s,
        });
      }
    }
  }
  function addPart(p) { if (parts.length < MAX_PARTS) parts.push(p); }
  function spawnPart(type, ox, oy) {
    const rx = ox + Math.random() * W, ry = oy + Math.random() * H, R = Math.random;
    switch (type) {
      case 'pollen': return addPart({ type, x: rx, y: ry, vx: 8 + R() * 10, vy: -4 + R() * 8, life: 5, max: 5, s: 2, c: '255,240,150' });
      case 'dust': return addPart({ type, x: rx, y: ry, vx: -4 + R() * 8, vy: -6 + R() * 4, life: 5, max: 5, s: 2, c: '240,230,220' });
      case 'petal': return addPart({ type, x: ox - 20 + R() * W * 0.8, y: oy - 10, vx: 30 + R() * 30, vy: 25 + R() * 20, life: 9, max: 9, s: 4, c: '255,170,210', rot: R() * 6 });
      case 'firefly': return addPart({ type, x: rx, y: ry, vx: 0, vy: 0, life: 6, max: 6, s: 3, c: '210,255,120', ph: R() * 6 });
      case 'wisp': return addPart({ type: 'firefly', x: rx, y: ry, vx: 0, vy: 0, life: 6, max: 6, s: 3, c: '150,220,255', ph: R() * 6 });
      case 'feather': return addPart({ type: 'petal', x: rx, y: oy - 10, vx: -10 + R() * 20, vy: 22 + R() * 12, life: 12, max: 12, s: 4, c: '225,240,255', rot: R() * 6 });
      case 'drip': return addPart({ type, x: rx, y: oy, vx: 0, vy: 120, life: 1.6 + R(), max: 2.6, s: 3, c: '170,10,30' });
      case 'glitch': return addPart({ type, x: rx, y: ry, vx: 0, vy: 0, life: 0.12 + R() * 0.25, max: 0.37, s: 4 + R() * 12, c: ['190,90,255', '90,220,255', '255,60,160'][(R() * 3) | 0] });
      case 'bird': {
        const left = R() < 0.5;
        return addPart({ type, x: left ? ox - 20 : ox + W + 20, y: oy + 40 + R() * H * 0.5, vx: left ? 140 : -140, vy: 0, life: 11, max: 11, s: 6, c: '40,32,30', ph: R() * 6 });
      }
      case 'ember': {
        const l = (fx.lights || [])[(R() * (fx.lights || []).length) | 0];
        if (!l) return;
        return addPart({ type, x: l[0] * T + R() * 20 - 10, y: l[1] * T, vx: -10 + R() * 20, vy: -40 - R() * 30, life: 1.4, max: 1.4, s: 2, c: '255,140,60' });
      }
    }
  }
  function updateFx(dt) {
    avgDt += (dt - avgDt) * 0.05;
    fxA = Math.max(0.4, Math.min(1, fxA + (avgDt > 1 / 45 ? -dt * 0.5 : dt * 0.25)));
    lbox += Math.sign(lboxWant - lbox) * Math.min(Math.abs(lboxWant - lbox), dt / 0.6);
    if (!map) return;
    const want = fx.rain && state.flags.rain_on ? 1 : 0;
    rainK += Math.sign(want - rainK) * Math.min(Math.abs(want - rainK), dt / 2);
    const ox = cam.x, oy = cam.y;
    for (const [type, rate] of Object.entries(fx.parts || {})) {
      emit[type] = (emit[type] || 0) + rate * dt;
      while (emit[type] >= 1) { emit[type] -= 1; spawnPart(type, ox, oy); }
    }
    for (const c of fx.chimneys || []) {           // дым из труб
      if (Math.random() < dt * 2.5) addPart({ type: 'smoke', x: c[0] * T, y: c[1] * T, vx: 10 + Math.random() * 8, vy: -26, life: 3, max: 3, s: 8, c: '200,200,205' });
    }
    if (rainK > 0.05 && Math.random() < dt * 30 * rainK) {
      addPart({ type: 'splash', x: ox + Math.random() * W, y: oy + Math.random() * H, vx: 0, vy: 0, life: 0.3, max: 0.3, s: 4, c: '200,220,255' });
    }
    for (const p of parts) {
      p.life -= dt;
      if (p.type === 'firefly') { p.ph += dt; p.vx += Math.cos(p.ph * 1.3) * 30 * dt; p.vy += Math.sin(p.ph * 0.9) * 30 * dt; p.vx *= 0.98; p.vy *= 0.98; }
      if (p.type === 'drip') p.vy += 500 * dt;
      if (p.type === 'smoke') p.s += dt * 7;
      if (p.type === 'bird') p.vy = Math.sin(time * 3 + p.ph) * 20;
      if (p.type === 'petal' || p.type === 'pollen') p.vx += Math.sin(time + p.y * 0.01) * 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'drip' && p.life <= 0) addPart({ type: 'splash', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, s: 4, c: p.c });
    }
    parts = parts.filter((p) => p.life > 0);
  }

  function renderFog(ox, oy) {
    const f = fx.fog;
    if (f) {
      const mw = map.tiles[0].length * T;
      const pulse = f.pulse ? 0.65 + 0.35 * Math.max(0, Math.sin(time * 2.6)) : 1;    // орган: туман дышит в такт
      const cyc = f.colors ? (time * 0.15) % f.colors.length : 0;
      for (const p of puffs) {
        const speed = f.speed * (0.6 + p.layer * 0.45);
        let x = p.home ? p.x + Math.sin(time * 0.3 + p.ph) * T : ((p.x + time * speed) % (mw + 2 * p.r)) - p.r;
        const px2 = x - ox * (0.9 + p.layer * 0.1), py2 = p.y + Math.sin(time * 0.4 + p.ph) * 12 - oy;
        if (px2 < -p.r * 2 || px2 > W + p.r * 2 || py2 < -p.r || py2 > H + p.r) continue;
        const a = p.a * pulse * fxA * (0.8 + 0.2 * Math.sin(time * 0.7 + p.ph));
        if (f.colors) {                              // лабиринт: туман меняет цвет
          const i = Math.floor(cyc + p.ci * 0.37) % f.colors.length, k = (cyc + p.ci * 0.37) % 1;
          g.globalAlpha = a * (1 - k); g.drawImage(blob(f.colors[i]), px2 - p.r, py2 - p.r * 0.6, p.r * 2, p.r * 1.2);
          g.globalAlpha = a * k; g.drawImage(blob(f.colors[(i + 1) % f.colors.length]), px2 - p.r, py2 - p.r * 0.6, p.r * 2, p.r * 1.2);
        } else {
          g.globalAlpha = a; g.drawImage(blob(f.rgb), px2 - p.r, py2 - p.r * 0.6, p.r * 2, p.r * 1.2);
        }
      }
      g.globalAlpha = 1;
    }
    if (fx.oddShadow && state) {                     // тень, которая идёт не за героем
      const sx = hero.x - ox + Math.cos(time * 0.7) * 46, sy = hero.y - oy + Math.sin(time * 0.9) * 16;
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.beginPath(); g.ellipse(sx, sy - 2, 24, 8, 0, 0, 6.28); g.fill();
    }
    if (rainK > 0) {                                 // рябь в лужах
      for (const [px3, py3] of fx.puddles || []) {
        const X = px3 * T - ox, Y = py3 * T - oy;
        g.fillStyle = `rgba(60,80,110,${0.35 * rainK})`;
        g.beginPath(); g.ellipse(X, Y, 44, 16, 0, 0, 6.28); g.fill();
        for (let i = 0; i < 2; i++) {
          const k = (time * 0.9 + i * 0.5 + px3) % 1;
          g.strokeStyle = `rgba(200,220,255,${(1 - k) * 0.5 * rainK})`; g.lineWidth = 1.5;
          g.beginPath(); g.ellipse(X + (i ? 12 : -10), Y, 6 + k * 22, 2 + k * 7, 0, 0, 6.28); g.stroke();
        }
      }
    }
  }

  function drawParts(ox, oy) {
    for (const p of parts) {
      const x = p.x - ox, y = p.y - oy, a = Math.min(1, p.life / p.max * 3, (p.max - p.life) * 4) * fxA;
      if (p.type === 'smoke') { g.globalAlpha = a * 0.3 * (p.life / p.max); g.drawImage(blob(p.c), x - p.s, y - p.s, p.s * 2, p.s * 2); continue; }
      if (p.type === 'firefly') {
        const k = 0.5 + 0.5 * Math.sin(p.ph * 6);
        g.globalAlpha = a * k * 0.5; g.drawImage(blob(p.c), x - 10, y - 10, 20, 20);
        g.globalAlpha = a * k; g.fillStyle = `rgb(${p.c})`; g.fillRect(x - 1.5, y - 1.5, 3, 3); continue;
      }
      if (p.type === 'bird') {
        g.globalAlpha = a; g.strokeStyle = `rgb(${p.c})`; g.lineWidth = 2;
        const w = Math.sin(time * 12 + p.ph) * 4;
        g.beginPath(); g.moveTo(x - 7, y - 3 + w); g.lineTo(x, y); g.lineTo(x + 7, y - 3 + w); g.stroke(); continue;
      }
      if (p.type === 'splash') {
        g.globalAlpha = a * 0.7; g.strokeStyle = `rgb(${p.c})`; g.lineWidth = 1;
        const k = 1 - p.life / p.max;
        g.beginPath(); g.ellipse(x, y, 2 + k * 7, 1 + k * 2.5, 0, 0, 6.28); g.stroke(); continue;
      }
      g.globalAlpha = a;
      g.fillStyle = `rgb(${p.c})`;
      if (p.type === 'petal') { g.save(); g.translate(x, y); g.rotate(p.rot + time * 2); g.fillRect(-3, -1.5, 6, 3); g.restore(); continue; }
      if (p.type === 'drip') { g.fillRect(x - 1, y - 5, 2, 6); continue; }
      g.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    g.globalAlpha = 1;
  }

  // свет: свечи, окна, фонари, орган — пульсирующие пятна 'lighter'; косые лучи
  function renderLights(ox, oy) {
    const lights = (fx.lights || []).slice();
    for (const f of fx.fg || []) if (f.t === 'lantern') lights.push([f.x, f.y - 0.1, 1, '255,200,120', 0.3]);
    g.globalCompositeOperation = 'lighter';
    lights.forEach(([x, y, r, rgb, pul], i) => {
      if (fx.candles && state.flags.organ_fight && Math.sin(time * 2.3 + i * 7.1) > 0.82) return;   // свеча гаснет и загорается снова
      const X = x * T - ox, Y = y * T - oy, R = r * T * (1 + (pul || 0) * 0.25 * Math.sin(time * (3 + i * 0.7) + i)) * (fx.candles ? 0.85 + Math.random() * 0.2 : 1);
      if (X < -R || X > W + R || Y < -R || Y > H + R) return;
      const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, `rgba(${rgb},${0.22 * fxA})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(X - R, Y - R, R * 2, R * 2);
    });
    for (const [x, y] of fx.rays || []) {
      const X = x * T - ox, Y = y * T - oy, a = (0.07 + 0.03 * Math.sin(time * 0.8 + x)) * fxA;
      const gr = g.createLinearGradient(X, Y, X + 160, Y + 420);
      gr.addColorStop(0, `rgba(255,240,200,${a})`); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + 50, Y); g.lineTo(X + 230, Y + 420); g.lineTo(X + 120, Y + 420); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  function renderForeground(ox, oy) {
    const hb = { l: hero.x - 18, r: hero.x + 18, t: hero.y - 62, b: hero.y };
    for (const f of fx.fg || []) {
      const b = fgBox(f);
      if (b.r - ox < 0 || b.l - ox > W || b.b - oy < 0 || b.t - oy > H + 40) continue;
      const behind = hb.r > b.l && hb.l < b.r && hb.b > b.t && hb.t < b.b;
      g.globalAlpha = behind ? 0.4 : 1;              // герой за объектом — тот прозрачнеет
      const sway = f.t === 'branch' || f.t === 'nbranch' || f.t === 'cloth' || f.t === 'banner' ? Math.sin(time * 1.2 + f.x) * 2 : 0;
      if (f.t === 'line') {                          // бельё на верёвке
        const x1 = f.x * T - ox, x2 = f.x2 * T - ox, y = f.y * T - 56 - oy;
        g.strokeStyle = '#6a5a48'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x1, y); g.quadraticCurveTo((x1 + x2) / 2, y + 18, x2, y); g.stroke();
        const cols = ['#d8d0c0', '#7a9ac0', '#c07a7a', '#e0c890', '#9ac08a'];
        for (let i = 0, n = Math.floor((x2 - x1) / 34); i < n; i++) {
          const cx = x1 + 14 + i * 34, cy = y + 4 + Math.sin(i / Math.max(1, n - 1) * Math.PI) * 15;
          g.fillStyle = cols[(i + f.x) % cols.length | 0];
          g.fillRect(cx + Math.sin(time * 2 + i) * 2, cy, 20, 24 + (i % 2) * 6);
        }
      } else if (f.t === 'beam') {
        g.fillStyle = '#2a1a10'; g.fillRect(b.l - ox, b.t - oy, b.r - b.l, 28); g.fillStyle = '#4a3020'; g.fillRect(b.l - ox, b.t - oy, b.r - b.l, 6);
      } else if (f.t === 'awning') {
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#e8e0d0' : f.c; g.fillRect(b.l - ox + i * 20, b.t - oy, 20, 30); }
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#e8e0d0' : f.c; g.beginPath(); g.arc(b.l - ox + i * 20 + 10, b.t - oy + 30, 10, 0, Math.PI); g.fill(); }
      } else {
        g.save();
        g.translate(f.x * T - ox, f.y * T - oy);
        if (f.flip) g.scale(-1, 1);
        if (sway) g.rotate(sway * 0.01);
        g.drawImage(b.im, -b.im.width, -b.im.height * 2, b.im.width * 2, b.im.height * 2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    drawParts(ox, oy);
    renderLights(ox, oy);
    if (rainK > 0) {                                 // дождь: косые струи и холодный оттенок
      g.fillStyle = `rgba(30,50,80,${0.18 * rainK})`; g.fillRect(0, 0, W, H);
      g.strokeStyle = `rgba(190,210,240,${0.4 * rainK * fxA})`; g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < 140; i++) {
        const sx = (i * 97.3) % 1, sy = (i * 57.9) % 1, sp = 900 + (i % 7) * 60;
        const y = (sy * H + time * sp) % (H + 40) - 20, x = (sx * (W + 200) - (time * sp * 0.25) % (W + 200) + W + 200) % (W + 200) - 100;
        g.moveTo(x, y); g.lineTo(x - 6, y + 22);
      }
      g.stroke();
    }
    if (fx.vignette) {                               // виньетка: сила зависит от локации
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, W * 0.72);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.85 * fx.vignette})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------- Рисование
  function draw() {
    g.fillStyle = '#0b0908';
    g.fillRect(0, 0, W, H);
    if (!map) { drawCrack(); return; }
    const ox = Math.round(cam.x), oy = Math.round(cam.y);
    g.save();
    if (zoom.k !== 1) {                              // наезд камеры на точку (органный балкон)
      const fx0 = zoom.x - ox, fy0 = zoom.y - oy, p = Math.min(1, (zoom.k - 1) / 0.4);   // точка плывёт к центру кадра
      g.translate(fx0 + (W / 2 - fx0) * p, fy0 + (H * 0.42 - fy0) * p); g.scale(zoom.k, zoom.k); g.translate(-fx0, -fy0);
    }
    renderGround(ox, oy);
    renderFog(ox, oy);
    const objs = [];
    renderMid(objs, ox, oy);
    renderEntities(objs, ox, oy);
    renderForeground(ox, oy);
    g.restore();
    if (dim > 0) { g.fillStyle = `rgba(20,0,4,${Math.min(0.6, dim * 0.5)})`; g.fillRect(0, 0, W, H); }
    renderUI(ox, oy);
  }

  // земля: тайлы, блики воды, затопление пола
  function renderGround(ox, oy) {
    const rows = map.tiles.length, cols = map.tiles[0].length;
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T));
    const x1 = Math.min(cols - 1, Math.floor((ox + W) / T)), y1 = Math.min(rows - 1, Math.floor((oy + H) / T));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        let t = map.tiles[ty][tx];
        if (t === 'T') t = map.ground || '.';
        if (t === 'P' && map.ground) t = map.ground;
        if (t === 'N' && state.flags.north_gate_open) t = 'n';
        if (t === 'V') t = state.flags.palace_open ? 'n' : 'N';
        const art = TILE_ART[t] || TILE_ART['.'];
        const X = tx * T - ox, Y = ty * T - oy;
        g.drawImage(art, X, Y);
        if (t === '~') {                            // блики на воде
          g.fillStyle = 'rgba(190,230,255,.35)';
          const s = (Math.sin(time * 2 + tx + ty * 1.7) + 1) * 0.5;
          g.fillRect(X + 10 + s * 20, Y + 18, 14, 2);
          g.fillRect(X + 34 - s * 16, Y + 42, 10, 2);
        }
        if (t === 'F') drawFountainEdge(tx, ty, X, Y);
        if (t === 'D') {                            // проход мерцает
          g.fillStyle = `rgba(244,220,160,${0.15 + 0.15 * Math.sin(time * 4)})`;
          g.fillRect(X, Y, T, T);
        }
      }
    }
    drawHazard(ox, oy);
    if (curEnc && curEnc.lock && enemies.length) {   // бой: выходы затянуты льдом
      for (const ex of map.exits || []) {
        const X = ex.x * T - ox, Y = ex.y * T - oy;
        g.fillStyle = `rgba(140,210,255,${0.45 + 0.1 * Math.sin(time * 3)})`; g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(230,248,255,.8)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(X + 8, Y + 8); g.lineTo(X + T - 8, Y + T - 8); g.moveTo(X + T - 8, Y + 8); g.lineTo(X + 8, Y + T - 8); g.stroke();
      }
    }
  }

  // средний слой: деревья, колонны, мебель, статуи — в общий список глубины
  function renderMid(objs, ox, oy) {
    const rows = map.tiles.length, cols = map.tiles[0].length;
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T));
    const x1 = Math.min(cols - 1, Math.floor((ox + W) / T)), y1 = Math.min(rows - 1, Math.floor((oy + H) / T));
    for (let ty = y0; ty <= Math.min(rows - 1, y1 + 2); ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = map.tiles[ty][tx];
        if (t === 'T') objs.push({ y: ty * T + T, draw: () => g.drawImage(TREE, tx * T - ox, ty * T - oy - 32, 64, 96) });
        if (t === 'P') objs.push({ y: ty * T + T - 4, draw: () => g.drawImage(PILLAR, tx * T - ox, ty * T - oy - 64, 64, 128) });
      }
    }
    for (const n of npcs) if (n.prop) objs.push({ y: n.prop === 'note' ? n.py - 30 : n.py, draw: () => drawNpc(n, ox, oy) });
    if (hunt) for (const a of hunt.anchors) objs.push({ y: a.py, draw: () => drawAnchor(a, ox, oy) });
  }

  // персонажи: сортировка вместе со средним слоем по нижней кромке — герой ниже объекта рисуется поверх, выше — за ним
  function renderEntities(objs, ox, oy) {
    for (const n of npcs) if (!n.prop) objs.push({ y: n.py, draw: () => drawNpc(n, ox, oy) });
    for (const e of enemies) objs.push({ y: e.y, draw: () => drawEnemy(e, ox, oy) });
    objs.push({ y: hero.y, draw: () => drawHero(ox, oy) });
    if (chase) objs.push({ y: chase.y, draw: () => drawThief(ox, oy) });
    if (hunt) for (const f of hunt.figs) objs.push({ y: f.y, draw: () => drawFigure(f, ox, oy) });
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.draw();
    drawGhost(ox, oy);
    drawCombatFx(ox, oy);
    drawFireflies(ox, oy);
  }

  // интерфейс поверх мира: тьма лабиринта, трещина, подсказка «E», полоски, мини-игры, letterbox, переход
  function renderUI(ox, oy) {
    drawMind(ox, oy);
    drawRooms(ox, oy);
    if (map.vignette) drawVignette(ox, oy);
    drawCrack();
    if (near && mode === 'play') {
      const X = near.px - ox, Y = near.py - oy - 84 + Math.sin(time * 5) * 3;
      g.fillStyle = '#e2b65a';
      g.fillRect(X - 15, Y - 15, 30, 30);
      g.fillStyle = '#2a1d0b';
      g.font = 'bold 20px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('E', X, Y + 1);
    }
    if (lbox > 0) {                                  // киношные полосы в ключевых сценах
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, 90 * lbox); g.fillRect(0, H - 90 * lbox, W, 90 * lbox);
    }
    if (state && mode !== 'title' && mode !== 'create') { drawBars(); drawMadness(); drawRoomsHud(); drawChaseTimer(); drawBossBar(); drawPathIcon(); }
    if (mode === 'mini') drawMini();
    if (fading) {                                    // переход: затемнение (или полосы letterbox) с названием локации
      const k = fading < 1 ? fading : Math.max(0, 2 - fading);
      if (fadeStyle === 'letterbox') {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H / 2 * k); g.fillRect(0, H - H / 2 * k, W, H / 2 * k);
      } else {
        g.fillStyle = `rgba(${fadeColor},${k})`;
        g.fillRect(0, 0, W, H);
      }
      if (fading > 1 && fadeColor !== '255,255,255') {
        g.globalAlpha = Math.min(1, (2 - fading) * 2.5, (fading - 1) * 6);
        g.font = '44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#e2c98a'; g.fillText(map.title, W / 2, H / 2);
        g.globalAlpha = 1;
      }
    }
  }

  // бортик фонтана по краям группы F и струя в центре
  function drawFountainEdge(tx, ty, X, Y) {
    g.fillStyle = '#d8d0c0';
    if (tileAt(tx, ty - 1) !== 'F') g.fillRect(X, Y, T, 8);
    if (tileAt(tx, ty + 1) !== 'F') g.fillRect(X, Y + T - 8, T, 8);
    if (tileAt(tx - 1, ty) !== 'F') g.fillRect(X, Y, 8, T);
    if (tileAt(tx + 1, ty) !== 'F') g.fillRect(X + T - 8, Y, 8, T);
    if (tileAt(tx + 1, ty) === 'F' && tileAt(tx, ty + 1) === 'F') {     // левая верхняя клетка — центр струи
      const cx = X + T, cy = Y + T;
      g.fillStyle = '#efe9dd'; g.fillRect(cx - 8, cy - 8, 16, 16);
      for (let i = 0; i < 6; i++) {
        const a = time * 3 + i;
        g.fillStyle = 'rgba(200,235,255,.8)';
        g.fillRect(cx + Math.sin(a) * 14 - 2, cy - 22 + ((time * 40 + i * 9) % 26), 4, 4);
      }
    }
  }

  function shadow(x, y, w) {
    g.fillStyle = 'rgba(0,0,0,.28)';                   // чуть смещена — свет сверху слева
    g.beginPath(); g.ellipse(x + 4, y + 2, w, w * 0.32, 0, 0, Math.PI * 2); g.fill();
  }

  function drawHero(ox, oy) {
    const x = Math.round(hero.x - ox), y = Math.round(hero.y - oy);
    for (const t of hero.trail) {                    // шлейф рывка
      const tp = heroSprite(t.dir);
      if (!ready(tp)) continue;
      g.globalAlpha = t.life * 2;
      g.drawImage(silhouette(tp, '#9ad8ff'), Math.round(t.x - ox) - 32, Math.round(t.y - oy) - 64, 64, 64);
    }
    g.globalAlpha = 1;
    shadow(x, y - 2, 20);
    if (hero.casting) {                              // каст: светящийся круг под героем
      g.strokeStyle = `rgba(${elemColor()},.8)`; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, y - 4, 30 * (1 - hero.casting.t / 0.25) + 10, 12, 0, 0, 6.28); g.stroke();
    }
    const bob = hero.moving ? Math.abs(Math.sin(hero.walk)) * 4 : Math.sin(time * 2) * 1;
    const sp = heroSprite(hero.dir);
    if (!ready(sp)) return;
    if (hero.inv > 0 && Math.floor(hero.inv * 14) % 2) g.globalAlpha = 0.35;     // мигает после удара
    g.drawImage(sp, x - 32, Math.round(y - 64 - bob), 64, 64);
    if (hero.inv > 0.75) g.drawImage(silhouette(sp, '#ff5040'), x - 32, Math.round(y - 64 - bob), 64, 64);
    g.globalAlpha = 1;
  }

  // голубая волна меча: соседние живые точки одной волны — одна светящаяся дуга
  function drawWaves(ox, oy) {
    const groups = {};
    for (const b of ebolts) if (b.wave && b.life > 0) (groups[b.wave] = groups[b.wave] || []).push(b);
    g.lineCap = 'round';
    for (const pts of Object.values(groups)) {
      pts.sort((a, b) => a.wi - b.wi);
      const rgb = pts[0].rgb;
      for (const [w, a] of [[22, 0.25], [11, 0.75], [4, 1]]) {
        g.strokeStyle = a === 1 ? 'rgba(235,250,255,.95)' : `rgba(${rgb},${a})`; g.lineWidth = w;
        g.beginPath();
        pts.forEach((p, i) => {
          if (i && p.wi === pts[i - 1].wi + 1) g.lineTo(p.x - ox, p.y - oy); else g.moveTo(p.x - ox, p.y - oy);
        });
        if (pts.length === 1) g.lineTo(pts[0].x - ox + 1, pts[0].y - oy);
        g.stroke();
      }
    }
    g.lineCap = 'butt';
  }

  function drawEnemy(e, ox, oy) {
    const x = Math.round(e.x - ox), y = Math.round(e.y - oy);
    const sp = e.k.art ? ART[e.k.art] : img(`assets/sprites/${e.k.sprite || e.kind}_${e.dir}.png`);
    if (!e.k.art && !ready(sp)) return;
    for (const t of e.trail || []) {                  // шлейф рывка
      g.globalAlpha = t.life * 2;
      g.drawImage(silhouette(img(`assets/sprites/${e.k.sprite || e.kind}_${t.dir}.png`), '#7ac8ff'), Math.round(t.x - ox) - 32, Math.round(t.y - oy) - 64, 64, 64);
    }
    g.globalAlpha = 1;
    if (e.k.ghost) {                                  // призрак: полупрозрачный, парит, без тени
      g.globalAlpha = (e.dead ? Math.max(0, 1 - e.dead / 0.6) : 1) * (0.55 + 0.15 * Math.sin(time * 4 + e.wander));
      const fy = y - 10 + Math.sin(time * 3 + e.wander) * 4;
      g.drawImage(silhouette(sp, e.k.tint), x - 32, fy - 64, 64, 64);
      g.globalAlpha *= 0.5; g.drawImage(sp, x - 32, fy - 64, 64, 64);
      if (e.hit > 0) { g.globalAlpha = 1; g.drawImage(silhouette(sp, '#ffffff'), x - 32, fy - 64, 64, 64); }
      g.globalAlpha = 1;
      if (!e.dead && e.st === 'windup') { g.fillStyle = '#9ad8ff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('!', x, fy - 70); }
      return;
    }
    if (e.dead) g.globalAlpha = Math.max(0, 1 - e.dead / 0.6);
    shadow(x, y - 2, 24);
    const crouch = e.st === 'windup' ? 6 : 0;
    const hop = e.st === 'lunge' ? 10 : (e.st === 'chase' ? Math.abs(Math.sin(time * 12 + e.wander)) * 3 : 0);
    const sh = e.dead ? 64 * (1 - e.dead / 1.2) : 64;
    g.drawImage(sp, x - 32, y - sh + crouch - hop, 64, sh - crouch);
    if (e.k.tint) {
      g.globalAlpha *= 0.45 + 0.15 * Math.sin(time * 5);
      g.drawImage(silhouette(sp, e.k.tint), x - 32, y - sh + crouch - hop, 64, sh - crouch);
      g.globalAlpha = e.dead ? Math.max(0, 1 - e.dead / 0.6) : 1;
    }
    if (e.hit > 0) g.drawImage(silhouette(sp, '#ffffff'), x - 32, y - sh + crouch - hop, 64, sh - crouch);
    g.globalAlpha = 1;
    if (e.dead) return;
    if (e.st === 'windup') {                          // предупреждение о прыжке
      g.fillStyle = '#ff4b3a';
      g.font = 'bold 34px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('!', x, y - 70 + Math.sin(time * 30) * 2);
    }
    if (e.hp < e.k.hp && !e.k.boss) {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 22, y - 76, 44, 6);
      g.fillStyle = '#e04a3a'; g.fillRect(x - 21, y - 75, 42 * Math.max(0, e.hp / e.k.hp), 4);
    }
  }

  function drawCombatFx(ox, oy) {
    const rgb = elemColor();
    if (hero.swing) {                                 // дуга удара мечом
      const a = 1 - hero.swing.t / 0.22, sweep = -1.3 + (hero.swing.t / 0.22) * 2.6;
      const cx = hero.x - ox, cy = hero.y - 26 - oy;
      g.lineCap = 'round';
      g.strokeStyle = `rgba(${rgb},${0.85 * a})`;
      g.lineWidth = 12;
      g.beginPath(); g.arc(cx, cy, 62, hero.swing.ang - 1.3, hero.swing.ang + sweep); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 4;
      g.beginPath(); g.arc(cx, cy, 62, hero.swing.ang + sweep - 0.5, hero.swing.ang + sweep); g.stroke();
    }
    for (const s of shots) {
      const x = s.x - ox, y = s.y - oy;
      if (s.kind === 'arrow') {
        g.strokeStyle = '#6b4a2b'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - Math.cos(s.ang) * 20, y - Math.sin(s.ang) * 20); g.lineTo(x, y); g.stroke();
        g.fillStyle = `rgb(${rgb})`; g.fillRect(x - 3, y - 3, 6, 6);
      } else {
        g.fillStyle = `rgba(${rgb},.35)`;
        g.beginPath(); g.arc(x, y, 16, 0, 6.28); g.fill();
        g.fillStyle = `rgb(${rgb})`;
        g.beginPath(); g.arc(x, y, 8, 0, 6.28); g.fill();
        g.fillStyle = '#fff'; g.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    drawWaves(ox, oy);
    for (const b of ebolts) {
      if (b.wave) continue;
      const x = b.x - ox, y = b.y - oy;
      g.fillStyle = `rgba(${b.rgb},.35)`; g.beginPath(); g.arc(x, y, 14, 0, 6.28); g.fill();
      g.fillStyle = `rgb(${b.rgb})`; g.beginPath(); g.arc(x, y, 8, 0, 6.28); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x - 3, y - 4, 4, 4);
    }
    for (const p of sparks) {
      g.fillStyle = `rgba(${p.rgb},${Math.min(1, p.life * 3)})`;
      g.fillRect(p.x - ox - 3, p.y - oy - 3, 6, 6);
    }
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of floaters) {
      g.globalAlpha = Math.min(1, f.life * 2);
      g.fillStyle = '#000'; g.fillText(f.text, f.x - ox + 2, f.y - oy + 2);
      g.fillStyle = f.color; g.fillText(f.text, f.x - ox, f.y - oy);
    }
    g.globalAlpha = 1;
  }

  // Полоса ОЗ босса вверху экрана
  function drawBossBar() {
    const b = enemies.find((e) => e.k.boss && !e.dead);
    if (!b) return;
    const Wd = 560, X = (W - Wd) / 2, Y = 30;
    g.fillStyle = 'rgba(10,8,6,.75)'; g.fillRect(X - 6, Y - 6, Wd + 12, 40);
    g.fillStyle = '#2a0a10'; g.fillRect(X, Y + 14, Wd, 14);
    g.fillStyle = '#c0182c'; g.fillRect(X, Y + 14, Wd * Math.max(0, b.hp / b.k.hp), 14);
    g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f4dca0'; g.fillText(b.k.boss, W / 2, Y + 4);
  }

  // Полоса ОЗ и бутылка под плашкой героя
  function drawBars() {
    const max = maxHp(), hp = Math.max(0, state.hp);
    const X = 16, Y = 58, Wd = 280;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(X, Y, Wd + 8, 26);
    g.fillStyle = '#3a1512'; g.fillRect(X + 4, Y + 4, Wd, 18);
    g.fillStyle = hp / max > 0.3 ? '#c8423a' : (Math.floor(time * 4) % 2 ? '#ff5a4a' : '#c8423a');
    g.fillRect(X + 4, Y + 4, Wd * hp / max, 18);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(X + 4, Y + 4, Wd * hp / max, 4);
    g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText(`ОЗ ${Math.ceil(hp)} / ${max}`, X + 4 + Wd / 2, Y + 14);
    // опыт до следующего уровня
    const L = lvl(), x0 = xpFor(L), x1 = xpFor(L + 1), xp = state.flags.xp || 0;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(X, Y + 26, Wd + 8, 10);
    g.fillStyle = '#e2b65a'; g.fillRect(X + 4, Y + 29, Wd * Math.min(1, (xp - x0) / (x1 - x0)), 4);
    // запас стрел, мана посоха, готовность рывка
    const w = WEAPONS[state.hero.weapon];
    let rx = X;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(X, Y + 38, Wd + 8, 22);
    const ammoN = maxAmmo(w);
    if (ammoN) {
      for (let i = 0; i < ammoN; i++) {
        const part = Math.max(0, Math.min(1, hero.ammo - i));
        g.fillStyle = part >= 1 ? '#f4dca0' : '#4a3f33';
        g.fillRect(X + 8 + i * 16, Y + 42, 4, 14);
        if (part > 0 && part < 1) { g.fillStyle = '#a08a60'; g.fillRect(X + 8 + i * 16, Y + 56 - 14 * part, 4, 14 * part); }
        g.fillStyle = part >= 1 ? '#c8423a' : '#3a2f25'; g.fillRect(X + 6 + i * 16, Y + 42, 8, 3);
      }
      rx = X + 8 + ammoN * 16;
    } else if (w.manaCost) {
      g.fillStyle = '#1a2440'; g.fillRect(X + 4, Y + 43, 150, 12);
      g.fillStyle = hero.mana >= w.manaCost ? '#5a9aff' : '#3a5a9a'; g.fillRect(X + 4, Y + 43, 150 * hero.mana / maxMana(), 12);
      g.font = 'bold 11px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(`Мана ${Math.floor(hero.mana)}`, X + 79, Y + 50);
      rx = X + 162;
    }
    g.font = 'bold 13px sans-serif'; g.textAlign = 'left';
    g.fillStyle = hero.dashCd > 0 ? '#7d7062' : '#9ad8ff';
    g.fillText(hero.dashCd > 0 ? `Рывок ${hero.dashCd.toFixed(1)}` : 'Рывок ⇧', rx + 6, Y + 50);
    g.textAlign = 'center';
    if (state.flags.got_flask) {
      const fx = X + Wd + 22, full = state.flags.has_water_flask;
      g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(fx - 4, Y - 6, 62, 38);
      g.fillStyle = '#b9dbe6'; g.fillRect(fx + 4, Y + 2, 14, 24); g.fillRect(fx + 8, Y - 3, 6, 6);
      if (full) { g.fillStyle = '#d0283c'; g.fillRect(fx + 6, Y + 8, 10, 16); }
      else if (flaskT > 0) { g.fillStyle = '#7a1824'; g.fillRect(fx + 6, Y + 24 - 16 * (1 - flaskT / 8), 10, 16 * (1 - flaskT / 8)); }
      g.fillStyle = full ? '#f4dca0' : '#7d7062';
      g.font = 'bold 18px sans-serif'; g.textAlign = 'left';
      g.fillText('Q', fx + 28, Y + 14);
      const pots = inv('potion_s') + inv('potion_m');
      if (pots) { g.font = 'bold 12px sans-serif'; g.fillStyle = '#e8a0b0'; g.fillText('+' + pots, fx + 28, Y + 30); }
    }
    drawStatusIcons(X + Wd + 96, Y - 6);
  }
  // Индикатор пути: после храма — выбранный путь, до него — ведущий счётчик path_* (при равенстве — «не выбран»)
  function leadPath() {
    const f = state.flags;
    if (f.temple_path) return f.temple_path;
    const c = ['hope', 'power', 'hate'].map((k) => [k, f['path_' + k] || 0]).sort((a, b) => b[1] - a[1]);
    return c[0][1] > c[1][1] ? c[0][0] : 'none';
  }
  function drawPathIcon() {
    const p = PATHS[leadPath()] || PATHS.none, x = W - 150, y = 40;
    g.fillStyle = 'rgba(10,8,6,.7)'; g.beginPath(); g.arc(x, y, 22, 0, 6.29); g.fill();
    g.strokeStyle = p.color; g.lineWidth = 3; g.stroke();
    g.fillStyle = p.color; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.icon, x, y + 1);
    g.font = 'bold 13px sans-serif'; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(p.name, x + 1, y + 35);
    g.fillStyle = p.color; g.fillText(p.name, x, y + 34);
  }
  // Благословения, проклятия и еда — значки справа от Сосуда (на пути Ненависти благословения тусклые)
  function drawStatusIcons(x, y) {
    const list = [];
    for (const k in BLESSINGS) if (BLESSINGS[k].icon && state.flags['bless_' + k]) list.push({ icon: BLESSINGS[k].icon, on: blessed(k), c: '#e2b65a' });
    for (const k in CURSES) if (state.flags['curse_' + k]) list.push({ icon: CURSES[k].icon, on: true, c: '#a0304a' });
    if (buffs.dmg > 0) list.push({ icon: ITEMS.pie.icon, on: true, c: '#9cf0a0', t: buffs.dmg });
    if (buffs.speed > 0) list.push({ icon: ITEMS.gingerbread.icon, on: true, c: '#9cf0a0', t: buffs.speed });
    g.textAlign = 'center'; g.textBaseline = 'middle';
    list.forEach((s, i) => {
      const cx = x + i * 40 + 18, cy = y + 19;
      g.globalAlpha = s.on ? 1 : 0.35;
      g.fillStyle = 'rgba(10,8,6,.75)'; g.beginPath(); g.arc(cx, cy, 17, 0, 6.29); g.fill();
      g.strokeStyle = s.c; g.lineWidth = 2; g.stroke();
      g.font = '18px sans-serif'; g.fillStyle = '#fff'; g.fillText(s.icon, cx, cy + 1);
      if (s.t) { g.font = 'bold 11px sans-serif'; g.fillStyle = '#9cf0a0'; g.fillText(Math.ceil(s.t), cx, cy + 26); }
      g.globalAlpha = 1;
    });
  }

  function drawNpc(n, ox, oy) {
    const x = Math.round(n.px - ox), y = Math.round(n.py - oy);
    if (n.prop === 'sign') { g.drawImage(SIGN, x - 32, y - 60, 64, 64); return; }
    if (n.prop === 'house') { g.drawImage(HOUSE, x - 72, y - 128, 144, 132); return; }
    if (n.prop === 'altar') { g.drawImage(ALTAR, x - 96, y - 70, 192, 112); return; }
    if (n.prop === 'pew') { g.drawImage(PEW, x - 96, y - 40, 192, 64); return; }
    if (n.prop === 'mirror') { g.drawImage(MIRROR, x - 36, y - 104, 72, 108); return; }
    if (n.prop === 'desk') { g.drawImage(DESK, x - 96, y - 82, 192, 112); return; }
    if (n.prop === 'organ') {
      g.drawImage(state.flags.organ_broken ? ORGAN_BROKEN : ORGAN, x - 192, y - 160, 384, 192);
      if (state.flags.organ_fight && !state.flags.organ_broken) {      // Долита играет: трубы вспыхивают по очереди в такт
        const step = Math.floor(time / BEAT), beat = 1 - (time % BEAT) / BEAT;
        g.globalCompositeOperation = 'lighter';
        for (const i of [step % 15, 14 - (step % 15)]) {
          const h = 28 - 3 * Math.abs(7 - i), X = x - 192 + (4 + i * 6) * 4, Y = y - 160 + (30 - h) * 4;
          g.fillStyle = `rgba(255,70,80,${0.55 * beat})`; g.fillRect(X, Y, 16, h * 4);
          g.drawImage(blob('255,60,70'), X - 24, Y - 40, 64, 64);
        }
        g.globalCompositeOperation = 'source-over';
      }
      return;
    }
    if (n.prop === 'nthrone') { g.drawImage(NTHRONE, x - 48, y - 108, 96, 112); return; }
    if (n.prop === 'table') { g.drawImage(TABLE, x - 192, y - 100, 384, 128); return; }
    if (n.prop === 'arch') { g.drawImage(ARCH, x - 96, y - 176, 192, 192); return; }
    if (n.prop === 'commode') { shadow(x, y - 2, 44); g.drawImage(COMMODE, x - 48, y - 46, 96, 48); return; }
    if (n.prop === 'stand') { shadow(x, y - 2, 20); g.drawImage(STAND, x - 24, y - 62, 48, 64); return; }
    if (n.prop === 'portrait') { drawPortraitProp(n.who, x, y); return; }
    if (n.prop === 'nhouse') { g.drawImage(NHOUSE, x - 72, y - 128, 144, 132); return; }
    if (n.prop === 'stall') { g.drawImage(stalls[n.color] ||= stallArt(n.color), x - 48, y - 80, 96, 84); return; }
    if (n.prop === 'statue') {
      g.fillStyle = n.color + '44';
      g.beginPath(); g.ellipse(x, y - 64, 30 + Math.sin(time * 2 + n.px) * 4, 40, 0, 0, 6.28); g.fill();
      shadow(x, y - 2, 26);
      g.drawImage(statues[n.color] ||= statueArt(n.color), x - 36, y - 116, 72, 120);
      return;
    }
    if (n.prop === 'spring') {
      g.drawImage(SPRING, x - 60, y - 54, 120, 78);
      g.fillStyle = `rgba(160,230,255,${0.25 + Math.sin(time * 3) * 0.15})`;
      g.beginPath(); g.ellipse(x, y - 24, 44, 18, 0, 0, 6.28); g.fill();
      return;
    }
    if (n.prop === 'note') {
      g.fillStyle = `rgba(255,236,170,${0.3 + Math.sin(time * 4) * 0.2})`;
      g.beginPath(); g.ellipse(x, y - 16, 34, 20, 0, 0, 6.28); g.fill();
      g.drawImage(n.gem ? NOTE_GEM : NOTE, x - 36, y - 54, 72, 60);
      return;
    }
    if (n.prop === 'throne') { g.drawImage(THRONE, x - 48, y - 108, 96, 112); return; }
    if (n.prop === 'stone') {
      const glow = state.flags.prologue_done ? 0.1 : 0.35 + Math.sin(time * 3) * 0.2;
      g.fillStyle = `rgba(255,236,170,${glow})`;
      g.beginPath(); g.ellipse(x, y - 34, 34, 46, 0, 0, Math.PI * 2); g.fill();
      shadow(x, y - 2, 18);
      g.drawImage(STONE, x - 32, y - 78, 64, 80);
      return;
    }
    shadow(x, y - 2, 20);
    // смотрит на героя, когда тот рядом
    let dir = n.dir;
    if (near === n) {
      const dx = hero.x - n.px, dy = hero.y - n.py;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    const sp = img(`assets/sprites/${n.sprite}_${dir}.png`);
    if (ready(sp)) g.drawImage(sp, x - 32, Math.round(y - 64 + Math.sin(time * 2 + n.px) * 1), 64, 64);
    if (n.tint && ready(sp)) {
      g.globalAlpha = 0.4 + 0.15 * Math.sin(time * 4);
      g.drawImage(silhouette(sp, n.tint), x - 32, Math.round(y - 64 + Math.sin(time * 2 + n.px) * 1), 64, 64);
      g.globalAlpha = 1;
    }
    if (n.menace && state.flags.void_raise && ready(sp)) {          // подняли оружие: багровое свечение
      g.globalAlpha = 0.25 + 0.15 * Math.sin(time * 8);
      g.drawImage(silhouette(sp, '#ff1030'), x - 32, Math.round(y - 64), 64, 64);
      g.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- Диалоги
  const dlg = { lines: [], i: 0, typed: 0, full: '', sel: 0, choices: null };

  function interact() {
    if (!near) return;
    const pick = (near.talk || []).find((t) => check(t.if));
    if (pick) startDialogue(pick.d);
  }

  function startDialogue(key) {
    const src = DIALOGUES[key];
    if (!src) { console.warn('Нет диалога', key); return; }
    dlg.lines = src.filter((l) => check(l.if));
    dlg.i = 0;
    if (!dlg.lines.length) return endDialogue();
    mode = 'dialog';
    for (const k in keys) keys[k] = false;
    stick.x = stick.y = 0;
    $('dialog').hidden = false;
    showLine();
  }

  function showLine() {
    const l = dlg.lines[dlg.i];
    apply(l);
    if (map && (l.set || l.add)) refreshNpcs();      // персонажи появляются/исчезают прямо по ходу сцены
    if (l.fx === 'flash') flash();
    if (l.fx === 'red') { flash('#c0102a'); dim = 1.6; }
    const ch = CHARACTERS[l.who] || { name: l.who, portrait: '' };
    const portrait = ch.portrait ? render(ch.portrait) : '';
    const pimg = $('dlg-portrait');
    if (portrait) {
      // портрета девушки пока нет — временно портрет парня
      const im = img(portrait);
      pimg.src = im.failed && l.who === 'hero' ? 'assets/portraits/hero_m.png' : portrait;
      pimg.onerror = () => { if (l.who === 'hero' && !pimg.src.endsWith('hero_m.png')) pimg.src = 'assets/portraits/hero_m.png'; else pimg.removeAttribute('src'); };
    } else pimg.removeAttribute('src');
    $('dialog').classList.toggle('no-portrait', !portrait);
    $('dlg-name').textContent = render(ch.name);
    dlg.full = render(l.text);
    dlg.typed = 0;
    dlg.choices = (l.choices || []).filter((c) => check(c.if));
    dlg.sel = 0;
    $('dlg-text').textContent = '';
    $('dlg-choices').innerHTML = '';
    $('dlg-next').hidden = true;
  }

  function typeTick(dt) {
    if (mode !== 'dialog' || dlg.typed >= dlg.full.length) return;
    dlg.typed = Math.min(dlg.full.length, dlg.typed + dt * 55);
    $('dlg-text').textContent = dlg.full.slice(0, Math.floor(dlg.typed));
    if (dlg.typed >= dlg.full.length) lineDone();
  }

  function lineDone() {
    $('dlg-text').textContent = dlg.full;
    dlg.typed = dlg.full.length;
    if (dlg.choices.length) {
      dlg.shownAt = performance.now();
      const box = $('dlg-choices');
      dlg.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.textContent = `${i + 1}. ${render(c.text)}`;
        b.addEventListener('click', (e) => { e.stopPropagation(); choose(i); });
        b.addEventListener('pointerenter', () => { dlg.sel = i; markSel(); });
        box.appendChild(b);
      });
      markSel();
    } else $('dlg-next').hidden = false;
  }
  function markSel() {
    [...$('dlg-choices').children].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel));
  }

  function advance() {
    if (dlg.typed < dlg.full.length) return lineDone();
    if (dlg.choices.length) return;
    const nextKey = dlg.lines[dlg.i].next;           // реплика ведёт в другой диалог
    if (nextKey) return startDialogue(nextKey);
    dlg.i++;
    if (dlg.i >= dlg.lines.length) endDialogue();
    else showLine();
  }

  function choose(i) {
    const c = dlg.choices[i];
    if (!c) return;
    apply(c);
    if (c.next) return startDialogue(c.next);
    endDialogue();
  }

  function endDialogue() {
    $('dialog').hidden = true;
    lboxWant = 0;
    zoom.want = 1;
    const p = pending;
    pending = {};
    if (map) {
      refreshNpcs();
      spawnEncounter();
      if (chasePending) { chasePending = false; startChase(); }
    }
    updateHud();
    if (mode === 'dialog') mode = 'play';
    save();
    if (p.scene) fade(() => enterMap(p.scene.scene, p.scene.at, p.scene.dir), p.scene.fx === 'flash' ? 'white' : null, MAPS[p.scene.scene].entry);
    else if (p.mini) startMini(p.mini);
    else if (p.ending) showEnding(p.ending);
    else if (p.lock) lockGame();
    else if (p.ui) openPanel(p.ui);
    else if (p.duelEnd) endDuel();
  }

  // ---------------------------------------------------------------- Перчатка вызова: бой на арене и возврат в мир
  function startDuel(id) {
    const d = DUELS.list[id], f = state.flags;
    f.duel_ret = { map: state.map, at: [hero.x / T - 0.5, (hero.y + 6) / T - 1], dir: hero.dir };
    panel = null; screen(null); mode = 'play';
    fade(() => {
      enterMap('arena', [7.5, 8], 'up');
      curEnc = { lock: true, duel: id, onClear: { add: { mana_points: 1, ['duel_' + id + '_won']: 1 }, toast: DUELS.won, d: 'duel_won' } };
      enemies = d.enemies.map(([kind, x, y]) => Object.assign(spawnEnemy({ kind, x, y }), { st: 'chase' }));
      flaskRefill = 1; flaskT = 0;
      if (f.got_flask && !f.has_water_flask) { flaskRefill = 0; f.has_water_flask = true; }
      setTimeout(() => startDialogue('duel_start'), 600);
    });
  }
  function endDuel() {
    const r = state.flags.duel_ret || { map: 'village', at: [16.5, 7.6], dir: 'up' };
    state.flags.duel_ret = null;
    curEnc = null; enemies = []; ebolts = [];
    fade(() => enterMap(r.map, r.at, r.dir));
  }

  // ---------------------------------------------------------------- Окна: сумка, лавка Дариан, дерево Полианны
  function openPanel(kind, back) {
    if (mode !== 'play' && mode !== 'pause') return;
    panel = { kind, back: back || (mode === 'pause' ? 'pause' : 'play'), msg: kind === 'shop' ? SHOP.hello : kind === 'duel' ? DUELS.hello : '' };
    mode = 'panel';
    for (const k in keys) keys[k] = false;
    stick.x = stick.y = 0;
    screen('panel');
    renderPanel();
  }
  function closePanel() {
    const back = panel ? panel.back : 'play';
    panel = null;
    if (back === 'pause') { mode = 'pause'; screen('pause'); }
    else { mode = 'play'; screen(null); }
    updateHud();
    save();
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function row(icon, title, desc, on, btn) {
    return `<div class="ach${on ? ' on' : ''}"><div class="ach-icon">${icon}</div><div class="prow-body"><div class="ach-title">${esc(title)}</div>`
      + `<div class="ach-desc">${esc(desc)}</div></div>${btn ? `<button data-act="${btn.act}"${btn.off ? ' disabled' : ''}>${esc(btn.text)}</button>` : ''}</div>`;
  }
  function renderPanel() {
    const f = state.flags, list = $('panel-list');
    const head = `💰 ${f.gold || 0}   ✦ ${f.mana_points || 0}   ❤ ${Math.ceil(state.hp)} / ${maxHp()}`;
    let html = '', cols = 2;
    if (panel.kind === 'bag') {
      $('panel-title').textContent = BAG_TEXT.title;
      const gifts = [], items = [];
      if (f.got_flask) gifts.push(row(ITEMS.flask.icon, ITEMS.flask.name + (f.has_water_flask ? '' : ' (пуст)'), ITEMS.flask.desc, f.has_water_flask,
        { act: 'use:flask', text: BAG_TEXT.use, off: !f.has_water_flask }));
      for (const [id, it] of Object.entries(ITEMS)) {
        if (id === 'flask' || !inv(id)) continue;
        if (it.gift) gifts.push(row(it.icon, it.name, it.desc, true));
        else if (it.duel) gifts.push(row(it.icon, it.name, it.desc, true, { act: 'use:' + id, text: BAG_TEXT.use }));
        else items.push(row(it.icon, `${it.name} ×${inv(id)}`, it.desc, true, { act: 'use:' + id, text: BAG_TEXT.use }));
      }
      const bl = Object.keys(BLESSINGS).filter((k) => BLESSINGS[k].icon && f['bless_' + k])
        .map((k) => row(BLESSINGS[k].icon, BLESSINGS[k].name, blessed(k) ? BLESSINGS[k].desc : BLESSINGS.off, blessed(k)));
      const cu = Object.keys(CURSES).filter((k) => f['curse_' + k]).map((k) => row(CURSES[k].icon, CURSES[k].name, CURSES[k].desc, true));
      const sec = (t, a) => (a.length ? `<div class="psec">${esc(t)}</div>` + a.join('') : '');
      html = sec(BAG_TEXT.items, items) + sec(BAG_TEXT.gifts, gifts) + sec(BAG_TEXT.bless, bl) + sec(BAG_TEXT.curses, cu);
      if (!html) html = `<div class="psec">${esc(BAG_TEXT.empty)}</div>`;
    } else if (panel.kind === 'shop') {
      $('panel-title').textContent = SHOP.title;
      for (const id of SHOP.items) {
        const it = ITEMS[id], left = it.limit ? it.limit - (f.potato_today || 0) : null;
        const desc = it.desc + (inv(id) ? ` В сумке: ${inv(id)}.` : '') + (left != null ? ` Осталось сегодня: ${left}.` : '');
        html += row(it.icon, it.name, desc, true, { act: 'buy:' + id, text: `Купить · ${it.price} 💰`, off: (f.gold || 0) < it.price || left === 0 });
      }
    } else if (panel.kind === 'duel') {
      $('panel-title').textContent = DUELS.title;
      for (const [id, d] of Object.entries(DUELS.list)) {
        if (!check(d.if)) continue;
        const ready = !d.ready || check(d.ready), won = f['duel_' + id + '_won'] || 0;
        html += row(d.icon, d.name, ready ? (won ? `Побед: ${won}` : 'Ещё не вызывал{|а}') : render(d.refuse), ready,
          { act: 'duel:' + id, text: ready ? 'Вызвать' : 'Отказ' });
      }
      if (!html) html = `<div class="psec">${esc(DUELS.empty)}</div>`;
    } else {
      $('panel-title').textContent = SKILLS.title;
      cols = 3;
      const br = Object.entries(SKILLS.branches);
      html = br.map(([b, d]) => `<div class="pcolh">${d.icon} ${esc(d.name)} · ${skill(b)}/3</div>`).join('');
      for (let t = 0; t < 3; t++) {
        for (const [b, d] of br) {
          const have = skill(b) > t, next = skill(b) === t, cost = SKILLS.cost[t];
          html += row(have ? '✓' : t + 1, d.tiers[t].name, d.tiers[t].desc, have,
            have ? null : { act: `learn:${b}`, text: `Изучить · ${cost} ✦`, off: !next || (f.mana_points || 0) < cost });
        }
      }
    }
    list.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    list.innerHTML = html;
    list.innerHTML = list.innerHTML.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (m, a, b) => render(m));
    $('panel-sub').textContent = (panel.msg ? render(panel.msg) + '   ·   ' : '') + head;
  }
  $('panel-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || mode !== 'panel') return;
    const [act, id] = b.dataset.act.split(':'), f = state.flags;
    if (act === 'use' && id === 'glove') { panel.kind = 'duel'; panel.msg = DUELS.hello; renderPanel(); return; }
    if (act === 'duel') {
      const d = DUELS.list[id];
      if (d.ready && !check(d.ready)) panel.msg = d.refuse;
      else if (curEnc || enemies.length || hunt || state.map === 'arena') panel.msg = DUELS.busy;
      else return startDuel(id);
    } else if (act === 'use') {
      const was = mode;
      mode = 'play';                                   // useFlask/useItem работают в игре
      if (id === 'flask') useFlask(); else useItem(id);
      mode = was;
      panel.msg = '';
    } else if (act === 'buy') {
      const it = ITEMS[id];
      if ((f.gold || 0) < it.price) panel.msg = SHOP.noGold;
      else if (it.limit && (f.potato_today || 0) >= it.limit) panel.msg = SHOP.noPotato;
      else {
        f.gold -= it.price;
        f['inv_' + id] = inv(id) + 1;
        if (it.limit) f.potato_today = (f.potato_today || 0) + 1;
        panel.msg = SHOP.bought[Math.floor(Math.random() * SHOP.bought.length)];
      }
    } else if (act === 'learn') {
      const t = skill(id), cost = SKILLS.cost[t];
      if (t >= 3) return;
      if ((f.mana_points || 0) < cost) panel.msg = SKILLS.noMana;
      else {
        f.mana_points -= cost;
        f['skill_' + id] = t + 1;
        panel.msg = SKILLS.learned[t];
        const w = WEAPONS[state.hero.weapon];
        hero.ammo = Math.min(maxAmmo(w), hero.ammo); hero.mana = Math.min(maxMana(), hero.mana);
      }
    }
    save();
    renderPanel();
  });
  $('btn-panel-close').addEventListener('click', closePanel);

  function dialogKey(e) {
    if (dlg.choices.length && dlg.typed >= dlg.full.length) {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { dlg.sel = (dlg.sel + dlg.choices.length - 1) % dlg.choices.length; markSel(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { dlg.sel = (dlg.sel + 1) % dlg.choices.length; markSel(); }
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { if (performance.now() - dlg.shownAt > 300) choose(dlg.sel); }   // защита от случайного пролистывания
      else if (/^Digit[1-9]$/.test(e.code)) choose(+e.code.slice(5) - 1);
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') advance();
    e.preventDefault();
  }
  $('dialog').addEventListener('click', () => { if (mode === 'dialog') advance(); });

  // ---------------------------------------------------------------- Сохранение
  function save() {
    if (!state || !map) return;
    state.x = hero.x; state.y = hero.y; state.dir = hero.dir;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
    const f = state.flags;
    if ((f.dolita_dead || (f.path_hate || 0) >= 2) && !meta().bad_run) setMeta('bad_run', true);   // Долита это запомнит
    if (f.hate_first_clear && !meta().hate_first_clear) setMeta('hate_first_clear', true);            // Гидан тоже
    checkAchievements();
  }
  function meta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
  }
  function setMeta(k, v) {
    const m = meta();
    m[k] = v;
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.hero && MAPS[s.map]) return s;
    } catch {}
    return null;
  }

  // ---------------------------------------------------------------- Экраны
  function screen(name) {
    for (const id of ['title', 'create', 'pause', 'ending', 'locked', 'achievements', 'panel']) $(id).hidden = id !== name;
  }

  function toTitle() {
    if (meta().game_locked) return showLocked();
    save();
    mode = 'title';
    map = null;
    $('dialog').hidden = true;
    updateHud();
    $('btn-continue').hidden = !load();
    screen('title');
  }

  function pause(on) {
    if (on && mode === 'play') { mode = 'pause'; screen('pause'); $('btn-duel-pause').hidden = !inv('glove'); }
    else if (!on && mode === 'pause') { mode = 'play'; screen(null); }
  }

  $('btn-new').addEventListener('click', () => { mode = 'create'; screen('create'); updateCreate(); });
  $('btn-continue').addEventListener('click', () => {
    state = load();
    if (!state) return;
    screen(null);
    mode = 'play';
    const { x, y } = state;                     // enterMap перезапишет позицию в сохранении
    enterMap(state.map, null, state.dir);
    if (x != null) { hero.x = x; hero.y = y; }
    snapCamera();
  });
  $('btn-back').addEventListener('click', toTitle);
  $('btn-ending').addEventListener('click', toTitle);
  $('btn-resume').addEventListener('click', () => pause(false));
  $('btn-bag-pause').addEventListener('click', () => openPanel('bag', 'pause'));
  $('btn-duel-pause').addEventListener('click', () => openPanel('duel', 'pause'));
  $('btn-to-title').addEventListener('click', toTitle);
  $('btn-wipe').addEventListener('click', () => {
    if (!confirm('Стереть сохранение?')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    state = null;
    toTitle();
  });

  // --- Создание героя
  const pick = { gender: 'm', weapon: 'sword' };
  document.querySelectorAll('.opt-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      pick[row.dataset.group] = b.dataset.value;
      row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      updateCreate();
    });
  });
  function updateCreate() {
    $('weapon-info').textContent = WEAPONS[pick.weapon].info;
    $('hero-name').placeholder = pick.gender === 'f' ? 'Как зовут героиню?' : 'Как зовут героя?';
    setTimeout(() => {
      $('preview-note').textContent = heroSpriteIsTemp(pick) ? 'Этот спрайт ещё рисуется — пока временный' : '';
    }, 300);
  }
  $('btn-start').addEventListener('click', () => {
    const name = $('hero-name').value.replace(/[{}<>|]/g, '').trim();
    if (name.length < 2) { $('hero-name').focus(); $('hero-name').placeholder = 'Имя — хотя бы 2 буквы'; return; }
    state = {
      v: 1,
      hero: { name: name[0].toUpperCase() + name.slice(1), gender: pick.gender, weapon: pick.weapon },
      flags: { hero_gender: pick.gender, hero_weapon: pick.weapon, bad_past: !!meta().bad_run, hate_first_clear: !!meta().hate_first_clear },
      map: null,
    };
    screen(null);
    mode = 'play';
    enterMap('luminos_square');
  });

  // Превью героя крутится по направлениям
  const pv = $('preview').getContext('2d');
  pv.imageSmoothingEnabled = false;
  function drawPreview() {
    pv.clearRect(0, 0, 128, 128);
    const dir = ['down', 'right', 'up', 'left'][Math.floor(time / 0.9) % 4];
    const sp = heroSprite(dir, pick);
    if (ready(sp)) pv.drawImage(sp, 0, 0, 128, 128);
  }

  // ---------------------------------------------------------------- Сенсорное управление
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch) $('touch').hidden = false;
  (() => {
    const el = $('stick'), knob = el.querySelector('.knob');
    let id = null;
    const set = (e) => {
      const r = el.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      stick.x = x; stick.y = y;
      knob.style.transform = `translate(${x * 60}px, ${y * 60}px)`;
    };
    el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); set(e); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const up = () => { id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  })();
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    if (mode === 'mini') return miniClick((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    if (mode !== 'play' || touch) return;
    attack((e.clientX - r.left) / r.width * W + cam.x, (e.clientY - r.top) / r.height * H + cam.y);
  });
  $('btn-atk').addEventListener('pointerdown', (e) => { e.preventDefault(); if (mode === 'mini') miniPress(); else attack(); });
  $('btn-flask').addEventListener('pointerdown', (e) => { e.preventDefault(); quickHeal(); });
  $('btn-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); dash(); });
  $('btn-act').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (mode === 'dialog') { if (dlg.choices.length && dlg.typed >= dlg.full.length) return; advance(); }
    else if (mode === 'play') interact();
  });
  $('btn-menu').addEventListener('pointerdown', () => pause(mode === 'play'));

  // ---------------------------------------------------------------- Этап 8: трещина и «Ошибка 888»
  // Трещина экрана: ломаные из точки удара, держатся до конца (и на экране ошибки).
  let crack = null;
  function makeCrack() {
    const cx = W / 2 + (Math.random() - 0.5) * 120, cy = H / 2 - 60 + (Math.random() - 0.5) * 80;
    const lines = [];
    const branch = (x, y, a, len, w) => {
      const pts = [[x, y]];
      for (let d = 0; d < len; d += 24 + Math.random() * 30) {
        a += (Math.random() - 0.5) * 0.7;
        x += Math.cos(a) * 30; y += Math.sin(a) * 30;
        pts.push([x, y]);
        if (w > 1 && Math.random() < 0.12) branch(x, y, a + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random()), len * 0.4, w - 1);
      }
      lines.push({ pts, w });
    };
    for (let i = 0; i < 13; i++) branch(cx, cy, (i / 13) * Math.PI * 2 + Math.random() * 0.3, 380 + Math.random() * 600, 3);
    return { cx, cy, lines, t: 0 };
  }
  function startCrack() {
    crack = makeCrack();
    paintCrack();
    $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
  }
  // трещина рисуется один раз на отдельном слое поверх всего — треснет и окно диалога
  function paintCrack() {
    const c = $('crackfx').getContext('2d');
    c.clearRect(0, 0, W, H);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const pass of [['rgba(0,0,0,.85)', 2.2, 1.5], ['rgba(235,240,255,.9)', 1, 0]]) {
      c.strokeStyle = pass[0];
      for (const l of crack.lines) {
        c.lineWidth = l.w * pass[1];
        c.beginPath();
        l.pts.forEach(([x, y], i) => (i ? c.lineTo(x + pass[2], y + pass[2]) : c.moveTo(x + pass[2], y + pass[2])));
        c.stroke();
      }
    }
    c.fillStyle = 'rgba(255,255,255,.85)';                // осколки в точке удара
    c.beginPath(); c.arc(crack.cx, crack.cy, 10, 0, 6.28); c.fill();
  }
  function drawCrack() {
    if (crack && crack.t < 0.25) { g.fillStyle = `rgba(255,255,255,${1 - crack.t * 4})`; g.fillRect(0, 0, W, H); }
  }

  // «Ошибка 888»: игра заблокирована, пока не переустановят (сброс localStorage)
  function lockGame() {
    state.flags.game_locked = true;
    save();
    setMeta('game_locked', true);
    fade(() => showLocked());
  }
  function showLocked() {
    mode = 'locked';
    map = null;
    if (!crack) { crack = makeCrack(); crack.t = 9; paintCrack(); }
    $('dialog').hidden = true;
    updateHud();
    const L = LOCK_SCREEN;
    $('err-head').textContent = L.head;
    $('err-title').textContent = L.title;
    $('err-text').textContent = L.text;
    $('err-code').textContent = L.code;
    $('btn-reinstall').textContent = L.button;
    screen('locked');
  }
  $('btn-reinstall').addEventListener('click', () => {
    const b = $('btn-reinstall'), bar = $('err-bar');
    b.disabled = true;
    $('err-progress').hidden = false;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 2600);
      bar.style.width = (k * 100).toFixed(0) + '%';
      $('err-code').textContent = LOCK_SCREEN.steps[Math.min(LOCK_SCREEN.steps.length - 1, Math.floor(k * LOCK_SCREEN.steps.length))];
      if (k < 1) return setTimeout(tick, 50);
      for (const key of [SAVE_KEY, META_KEY]) { try { localStorage.removeItem(key); } catch {} }
      location.reload();
    };
    tick();
  });

  // ---------------------------------------------------------------- Этап 9: достижения
  // Хранятся в pg2_meta.ach (переживают новую игру), выдаются репликой achieve или по условию when.
  const achGot = () => meta().ach || {};
  function unlock(id) {
    if (!ACHIEVEMENTS[id] || achGot()[id]) return;
    setMeta('ach', { ...achGot(), [id]: Date.now() });
    achQueue.push(id);
    if (achQueue.length === 1) showAchPop();
  }
  function checkAchievements() {
    if (!state) return;
    for (const [id, a] of Object.entries(ACHIEVEMENTS)) if (a.when && check(a.when)) unlock(id);
  }
  // карточка «Достижение получено» справа сверху, по одной
  const achQueue = [];
  function showAchPop() {
    const a = ACHIEVEMENTS[achQueue[0]], el = $('ach-pop');
    $('ach-pop-icon').textContent = a.icon;
    $('ach-pop-title').textContent = a.title;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { achQueue.shift(); if (achQueue.length) showAchPop(); }, 450);
    }, achQueue.length > 2 ? 1800 : 3800);                // много сразу (старое сохранение) — быстрее
  }
  // экран со списком: открыт из титула или из паузы — туда и возвращаемся
  let achFrom = 'title';
  function showAchievements(from) {
    achFrom = from;
    const got = achGot(), list = $('ach-list'), all = Object.entries(ACHIEVEMENTS);
    list.innerHTML = '';
    for (const [id, a] of all) {
      const on = !!got[id], secret = a.hidden && !on;
      const row = document.createElement('div');
      row.className = 'ach' + (on ? ' on' : '');
      row.innerHTML = '<div class="ach-icon"></div><div><div class="ach-title"></div><div class="ach-desc"></div></div>';
      row.querySelector('.ach-icon').textContent = secret ? '?' : a.icon;
      row.querySelector('.ach-title').textContent = secret ? '???' : a.title;
      row.querySelector('.ach-desc').textContent = secret ? 'Скрытое достижение' : a.desc;
      list.appendChild(row);
    }
    $('ach-count').textContent = `Получено ${all.filter(([id]) => got[id]).length} из ${all.length}`;
    screen('achievements');
  }
  $('btn-ach').addEventListener('click', () => showAchievements('title'));
  $('btn-ach-pause').addEventListener('click', () => showAchievements('pause'));
  $('btn-ach-back').addEventListener('click', () => screen(achFrom));

  // ---------------------------------------------------------------- Масштаб под экран
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    $('stage').style.transform = `scale(${s}) translate(-50%, -50%)`;
  }
  addEventListener('resize', fit);
  fit();

  // ---------------------------------------------------------------- Цикл
  // ?test — цикл на таймере (в скрытой вкладке requestAnimationFrame стоит), для автотестов
  const nextFrame = location.search.includes('test') ? (f) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fading) {                                  // затемнение → смена карты → проявление
      fading += dt * (fadeStyle === 'letterbox' ? 1 : 2 / 1.5);
      if (fading >= 1 && fadeCb) { const cb = fadeCb; fadeCb = null; cb(); }
      if (fading >= 2) { fading = 0; if (mode === 'fade') mode = 'play'; }
    }
    update(dt);
    updateFx(dt);
    zoom.k += Math.sign(zoom.want - zoom.k) * Math.min(Math.abs(zoom.want - zoom.k), dt * 0.2);   // 1.0 → 1.4 за 2 с
    dim = Math.max(0, dim - dt * 0.5);
    typeTick(dt);
    if (crack) crack.t += dt;
    let shake = crack && crack.t < 0.6 ? (0.6 - crack.t) * 30 : 0;        // экран трясёт после удара
    if (hunt && hunt.shake) shake = Math.max(shake, 16);                 // смех Гидана
    const sway = hunt && hunt.taunt && mode === 'play' ? 1 : 0;          // «пьяная» камера, пока Гидан болтает
    const rot = sway * Math.sin(time * 1.7) * 0.012, c = Math.cos(rot), sn = Math.sin(rot);
    const sx = sway * Math.sin(time * 2.3) * 10 + (Math.random() - 0.5) * shake, sy = sway * Math.cos(time * 1.9) * 6 + (Math.random() - 0.5) * shake;
    g.setTransform(c, sn, -sn, c, sx + W / 2 - (c * W / 2 - sn * H / 2), sy + H / 2 - (sn * W / 2 + c * H / 2));
    if (mode === 'create') { time += dt; drawPreview(); }
    draw();
    g.setTransform(1, 0, 0, 1, 0, 0);
    nextFrame(frame);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // проверка карт: все строки одной длины; одиночные enemies → encounters
  for (const [id, m] of Object.entries(MAPS)) {
    if (m.enemies && !m.encounters) m.encounters = [{ if: m.enemiesIf, enemies: m.enemies, onClear: m.onClear }];
    const w = m.tiles[0].length;
    m.tiles.forEach((r, i) => { if (r.length !== w) console.warn(`Карта ${id}: строка ${i} длины ${r.length}, ждали ${w}`); });
  }

  // Для отладки и автотестов
  window.PG = { get state() { return state; }, get mode() { return mode; }, get enemies() { return enemies; }, get npcs() { return npcs; }, get chase() { return chase; },
    get curEnc() { return curEnc; }, get mini() { return mini; }, get ffly() { return ffly; }, get hunt() { return hunt; }, get rooms() { return rooms; }, get fxInfo() { return { parts: parts.length, fxA, rainK, lbox, puffs: puffs.length }; }, draw, miniPress, hz, hero, enterMap, startDialogue, attack, useFlask, useItem, quickHeal, openPanel, closePanel, maxHp, dmgMul, maxMana, healMul, buffs, zoom, get ebolts() { return ebolts; }, startDuel, leadPath, MAPS, ELEMENTS };

  toTitle();
  nextFrame(frame);
})();
