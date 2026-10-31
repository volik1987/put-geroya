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

  // Враги: ОЗ, скорость, урон, прыжок с предупреждением «!»
  const ENEMIES = {
    wolf: { hp: 6, speed: 105, aggro: 360, dmg: 10, windup: 0.55, lunge: 480, lungeT: 0.3, rest: 0.7, w: 40, h: 18 },
    guard: { sprite: 'nokt_guard', hp: 12, speed: 90, aggro: 600, dmg: 12, windup: 0.5, lunge: 400, lungeT: 0.25, rest: 0.8, w: 34, h: 18 },
    priest: { sprite: 'priest', boss: 'Первосвященник Кассиан', hp: 40, speed: 85, keep: 260, aggro: 700, rest: 0.5, w: 34, h: 18,
      ranged: { every: 1.6, windup: 0.55, speed: 330, dmg: 10, count: 3, spread: 0.28 } },
    bellows: { art: 'bellows', static: true, hp: 10, w: 56, h: 28 },
    dolita_boss: { sprite: 'dolita', boss: 'Долита Тенебрис', hp: 45, speed: 150, aggro: 900, dmg: 14, windup: 0.45, lunge: 560, lungeT: 0.3, rest: 0.6, w: 34, h: 18,
      ranged: { every: 2.4, windup: 0.5, speed: 380, dmg: 10, count: 5, spread: 0.22 } },
    dark_knight: { boss: 'Тёмный рыцарь', hp: 60, speed: 135, aggro: 900, dmg: 14, windup: 0.5, lunge: 600, lungeT: 0.28, rest: 0.55, w: 34, h: 18,
      ranged: { every: 2.2, windup: 0.5, speed: 420, dmg: 10, count: 3, spread: 0.3, color: '90,180,255' } },
    // Путь Ненависти: рыцарь бьётся насмерть, после трещины в шлеме — Аэдел (и Долита, если её пощадили)
    dark_knight_h: { sprite: 'dark_knight', boss: 'Тёмный рыцарь', hp: 50, speed: 140, aggro: 900, dmg: 14, windup: 0.48, lunge: 600, lungeT: 0.28, rest: 0.5, w: 34, h: 18,
      ranged: { every: 2.2, windup: 0.5, speed: 420, dmg: 10, count: 3, spread: 0.3, color: '90,180,255' } },
    aedel_boss: { sprite: 'aedel', boss: 'Аэдел Анима', hp: 55, speed: 160, aggro: 900, dmg: 15, windup: 0.42, lunge: 650, lungeT: 0.28, rest: 0.5, w: 34, h: 18,
      ranged: { every: 1.9, windup: 0.45, speed: 450, dmg: 10, count: 5, spread: 0.24, color: '90,180,255' } },
    dolita_ally: { sprite: 'dolita', hp: 20, speed: 140, keep: 240, aggro: 900, rest: 0.6, w: 34, h: 18,
      ranged: { every: 3, windup: 0.6, speed: 340, dmg: 8, count: 3, spread: 0.3 } },
    captain: { sprite: 'nokt_captain', hp: 22, speed: 80, aggro: 600, dmg: 16, windup: 0.7, lunge: 430, lungeT: 0.3, rest: 1.0, w: 40, h: 20 },
  };

  // Оружие влияет на спрайт и параметры боя (бой — на этапе 2)
  const WEAPONS = {
    sword: { name: 'Меч',   type: 'melee',  dmg: 3, range: 70,  cooldown: 0.35, info: 'Ближний бой. Быстрые удары, урон 3.' },
    bow:   { name: 'Лук',   type: 'arrow',  dmg: 2, range: 420, cooldown: 0.5,  info: 'Дальний бой. Стрелы летят далеко, урон 2.' },
    staff: { name: 'Посох', type: 'magic',  dmg: 4, range: 320, cooldown: 0.85, info: 'Магический снаряд. Медленно, но урон 4.' },
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
      ],
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
        { id: 'lumina', sprite: 'lumina', x: 7.5, y: 2.6, dir: 'down',
          talk: [{ if: { flag: 'prologue_done' }, d: 'queen_after' }, { d: 'queen_intro' }] },
      ],
      onEnter: [{ if: { not: 'prologue_done' }, d: 'queen_intro' }],
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
      'KcccccccccccccFFcccccccccccccK',
      'KcccccccccccccFFcccccccccccccK',
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
      { id: 'altar', prop: 'altar', x: 8.5, y: 2.1 },
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
    ],
    // Путь Власти: бой с Первосвященником
    encounters: [{
      if: [{ flag: 'priest_fight' }, { not: 'priest_beaten' }],
      enemies: [{ kind: 'priest', x: 8.5, y: 3.4 }, { kind: 'guard', x: 6.3, y: 3.4 }, { kind: 'guard', x: 10.7, y: 3.4 }],
      onClear: { set: { priest_beaten: true, temple_done: true }, d: 'priest_beaten' },
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
      { id: 'desk', prop: 'desk', x: 5.5, y: 2.4, talk: [{ if: { flag: 'lumina_letter_read' }, d: 'desk_again' }, { d: 'lumina_letter' }] },
    ],
    onEnter: [{ if: { not: 'study_seen' }, d: 'study_intro' }],
  };

  // ============================================================ Этап 6. Столица Нокт (Путь Надежды)
  // o тёмный мрамор дворца  h клумба  V ворота дворца (открываются флагом palace_open)
  MAPS.nokt_capital = {
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
      { id: 'dolita_garden', sprite: 'dolita', x: 9, y: 8, dir: 'left', if: { not: 'wedding' },
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
      { if: [{ flag: 'wedding' }, { not: 'wedding_seen' }], d: 'wedding' },
      { if: { not: 'garden_seen' }, d: 'garden_intro' },
    ],
  };

  // Ворота дворца: пароль, Тёмный рыцарь, в середине боя его останавливает Долита
  MAPS.palace_gate = {
    title: 'Нокт · Ворота дворца',
    tiles: [
      'KKKKKKKVVKKKKKKK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
      'KccccccccccccccK',
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
      { id: 'pguard', sprite: 'nokt_guard', x: 10.5, y: 2.2, dir: 'down', if: { not: 'hgate_seen' }, talk: [{ if: { flag: 'palace_open' }, d: 'pguard_open' }, { if: { flag: 'palace_password' }, d: 'pguard_pass' }, { d: 'pguard' }] },
      { id: 'knight', sprite: 'dark_knight', x: 7.5, y: 2.2, dir: 'down', if: [{ not: 'knight_fight' }, { not: 'hknight_fight' }], talk: [{ d: 'knight_silent' }] },
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
      if: [{ flag: 'hknight_fight' }, { not: 'helm_broken' }],
      enemies: [{ kind: 'dark_knight_h', x: 7.5, y: 2.6 }],
      onClear: { set: { helm_broken: true }, d: 'helm_broken' },
    }, {
      // фаза 2: Аэдел без шлема; пощажённая Долита встаёт рядом с ним
      if: [{ flag: 'helm_broken' }, { not: 'aedel_beaten' }],
      enemies: [{ kind: 'aedel_boss', x: 7.5, y: 3 }, { kind: 'dolita_ally', x: 10.5, y: 3, if: { flag: 'dolita_spared' } }],
      onClear: { set: { aedel_beaten: true, palace_open: true }, add: { path_hate: 1 }, d: 'aedel_defeated' },
    }],
    respawn: { map: 'palace_gate', at: [7.5, 12], dir: 'up', d: 'hero_down_knight' },
    onEnter: [
      { if: [{ eq: ['temple_path', 'hate'] }, { not: 'hgate_seen' }], d: 'hate_gate_intro' },
      { if: { not: 'pgate_seen' }, d: 'pgate_intro' },
    ],
  };

  MAPS.palace_throne = {
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
      { id: 't_dolita', sprite: 'dolita', x: 9.8, y: 3.4, dir: 'down', if: { eq: ['temple_path', 'hope'] } },
    ],
    // подошёл к трону — император заговорил: послом (Надежда), с Игроком (Ненависть) или с предложением (Ненависть, повтор)
    triggers: [
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hope'] }], maxY: 6.5 * 64, d: 'throne_gidan' },
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hate'] }, { not: 'hate_first_clear' }], maxY: 6.5 * 64, d: 'gidan_player' },
      { if: [{ not: 'throne_seen' }, { eq: ['temple_path', 'hate'] }, { flag: 'hate_first_clear' }], maxY: 6.5 * 64, d: 'gidan_offer' },
    ],
    onEnter: [
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
      confuseEvery: 11, confuseFor: 3.5,             // мысли путаются: управление наоборот
      caught: 'maze_caught',
    },
    onEnter: [{ if: { not: 'maze_seen' }, d: 'maze_intro' }],
  };

  // ============================================================ Этап 8. Мета-сцена: пустота, трое Кукол
  // v пустота (пол)  Y край пустоты (стена). Долита, Гидан и Аэдел здесь живы, что бы ни было раньше.
  MAPS.void = {
    title: '…',
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

  const PROP_SIZE = {
    throne: { w: 110, h: 50 }, stone: { w: 40, h: 18 }, sign: { w: 30, h: 14 },
    house: { w: 140, h: 52 }, altar: { w: 150, h: 40 }, pew: { w: 150, h: 26 }, mirror: { w: 50, h: 20 }, desk: { w: 130, h: 34 }, nhouse: { w: 140, h: 52 }, stall: { w: 92, h: 34 }, statue: { w: 40, h: 22 }, spring: { w: 70, h: 30 }, note: { w: 0, h: 0 },
    nthrone: { w: 110, h: 50 }, table: { w: 380, h: 56 }, arch: { w: 0, h: 0 },
  };
  let exitLock = false;
  const SOLID = new Set(['#', 'T', '~', 'W', 'G', 'F', 'P', 'R', 'K', 'X', 'B', 'Z', 'Y']);
  // ворота Нокта открываются флагом
  const isSolid = (t) => SOLID.has(t) || (t === 'N' && !state.flags.north_gate_open) || (t === 'V' && !state.flags.palace_open);

  // ---------------------------------------------------------------- Состояние
  let state = null;          // { hero:{name,gender,weapon}, flags, map, x, y, dir }
  let mode = 'title';        // title | create | play | dialog | pause
  let map = null;            // текущая карта
  let npcs = [];
  const hero = { x: 0, y: 0, dir: 'down', moving: false, walk: 0, cd: 0, inv: 0, swing: null, kx: 0, ky: 0 };
  let enemies = [], shots = [], sparks = [], floaters = [];
  let curEnc = null;                 // текущая схватка карты (map.encounters)
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
    if ('not' in c) return !f[c.not];
    if ('eq' in c) return f[c.eq[0]] === c.eq[1];
    if ('gte' in c) return (f[c.gte[0]] || 0) >= c.gte[1];
    if ('in' in c) return c.in[1].includes(f[c.in[0]]);
    return true;
  }
  function apply(o) {
    if (!o) return;
    if (o.toast) toast(render(o.toast));
    if (o.heal) state.hp = maxHp();
    const val = (v) => (typeof v === 'string' && v[0] === '$' ? state.flags[v.slice(1)] ?? 0 : v);   // '$gold' — значение флага
    for (const [k, v] of Object.entries(o.set || {})) state.flags[k] = val(v);
    for (const [k, n] of Object.entries(o.add || {})) state.flags[k] = (state.flags[k] || 0) + val(n);
    if (o.chase) chasePending = true;
    if (o.scene) pending.scene = o;                    // после диалога — в другую локацию
    if (o.mini) pending.mini = o.mini;                 // после диалога — мини-игра
    if (o.ending) pending.ending = o.ending;           // после диалога — экран концовки
    if (o.crack) startCrack();                         // экран трескается прямо на реплике
    if (o.lock) pending.lock = true;                   // после диалога — «Ошибка 888»
    if (o.achieve) unlock(o.achieve);                  // достижение прямо на реплике
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
    return map.tiles[ty][tx];
  }

  function maxHp() { return HERO_HP + (state.flags.light_element === 'radiance' ? 25 : 0); }

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
    shots = []; sparks = []; floaters = [];
    hero.swing = null; hero.kx = hero.ky = 0; hero.inv = 0;
    ghost = null;
    chase = null; chasePending = false;
    if (state.hp == null || state.hp > maxHp()) state.hp = maxHp();
    exitLock = true;
    snapCamera();
    showArea(map.title);
    updateHud();
    save();
    // сцена по флагам при входе
    for (const e of map.onEnter || []) {
      if (check(e.if)) { setTimeout(() => startDialogue(e.d), 500); break; }
    }
  }

  // белая вспышка поверх всего (на реплике с fx: 'flash')
  function flash() {
    const f = $('flash');
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
    el.textContent = `${state.hero.name} · ${WEAPONS[state.hero.weapon].name}${el2 ? ' · ' + el2.icon + ' ' + el2.name : ''}${gold}`;
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
      if (e.code === 'KeyQ') useFlask();
      if (e.code === 'Escape') pause(true);
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
      moveHero(v.x * HERO_SPEED * dt, 0);
      moveHero(0, v.y * HERO_SPEED * dt);
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
  function startHunt() {
    const h = map.hunt;
    hunt = null;
    if (!h || !check(h.if)) return;
    const spots = h.spots.slice().sort(() => Math.random() - 0.5);
    const figs = spots.slice(0, h.figures).map((s, i) => ({ x: s[0] * T + T / 2, y: s[1] * T + T - 6, real: i === 0, ph: Math.random() * 6, alive: 1 }));
    hunt = { h, figs, slips: h.slips, confuse: 0, nextConfuse: h.confuseEvery, scare: 0, whisper: null, wt: 0 };
  }
  function whisper(text) {
    hunt.whisper = render(text);
    hunt.wt = 3;
    hunt.scare = 0.7;
  }
  function updateHunt(dt) {
    if (!hunt || hunt.done) return;
    const h = hunt.h;
    hunt.scare = Math.max(0, hunt.scare - dt);
    hunt.wt = Math.max(0, hunt.wt - dt);
    hunt.confuse = Math.max(0, hunt.confuse - dt);
    if ((hunt.nextConfuse -= dt) <= 0) {
      hunt.nextConfuse = h.confuseEvery;
      hunt.confuse = h.confuseFor;
      toast(render(HUNT_TEXT.confuse));
    }
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
  // тьма вокруг героя, вспышка испуга, шёпот и подсказка о путанице
  function drawMind(ox, oy) {
    if (!hunt) return;
    const hx = hero.x - ox, hy = hero.y - 30 - oy;
    const r = hunt.done ? 420 : 250 + Math.sin(time * 2) * 12;
    const grd = g.createRadialGradient(hx, hy, r * 0.35, hx, hy, r);
    grd.addColorStop(0, 'rgba(4,2,10,0)');
    grd.addColorStop(1, 'rgba(4,2,10,.97)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    if (hunt.scare) { g.fillStyle = `rgba(60,0,30,${hunt.scare * 0.6})`; g.fillRect(0, 0, W, H); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (hunt.wt) {
      g.globalAlpha = Math.min(1, hunt.wt);
      g.font = 'italic 30px Georgia, serif';
      g.fillStyle = '#000'; g.fillText(hunt.whisper, W / 2 + 2, 152);
      g.fillStyle = '#d8b8ff'; g.fillText(hunt.whisper, W / 2, 150);
      g.globalAlpha = 1;
    }
    if (hunt.confuse) {
      g.font = 'bold 26px sans-serif';
      g.fillStyle = `rgba(255,120,200,${0.6 + 0.4 * Math.sin(time * 10)})`;
      g.fillText('⟲ мысли путаются: управление наоборот', W / 2, H - 60);
    }
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
    if (mode !== 'play' || hero.cd > 0) return;
    const w = WEAPONS[state.hero.weapon];
    const el = state.flags.light_element;
    hero.cd = w.cooldown * (el === 'storm' ? 0.75 : 1);
    const dmg = w.dmg + (el === 'sun' ? 1 : 0);
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
    } else {
      const sp = w.type === 'arrow' ? 620 : 360;
      shots.push({ x: hx + Math.cos(ang) * 20, y: hy + Math.sin(ang) * 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: w.range / sp, dmg, kind: w.type, ang });
    }
  }

  function hitEnemy(e, dmg, ang) {
    e.hp -= dmg;
    e.hit = 0.15;
    if (!e.k.static) { e.vx = Math.cos(ang) * (e.k.boss ? 120 : 320); e.vy = Math.sin(ang) * (e.k.boss ? 120 : 320); }
    if (e.st === 'idle' || (e.st === 'windup' && !e.k.boss)) { e.st = 'stagger'; e.t = 0.25; }
    if (e.k.boss && e.st === 'idle') e.st = 'chase';
    floaters.push({ x: e.x, y: e.y - 60, text: String(dmg), life: 0.8, color: '#fff2c4' });
    burst(e.x, e.y - 24, 8, elemColor());
    if (e.hp <= 0) { e.dead = 0.001; burst(e.x, e.y - 20, 18, '120,110,100'); }
  }

  function burst(x, y, n, rgb) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 180;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.3 + Math.random() * 0.3, rgb });
    }
  }

  function hurtHero(dmg, fromX, fromY) {
    if (hero.inv > 0) return;
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
    const r = map.respawn || { map: 'village', at: [16.5, 7.6], dir: 'up', d: 'hero_down' };
    mode = 'fade';
    fade(() => {
      state.hp = maxHp();
      enterMap(r.map, r.at, r.dir);
      setTimeout(() => startDialogue(r.d), 550);
    });
  }

  function useFlask() {
    if (mode !== 'play' || !state.flags.got_flask) return;
    if (!state.flags.has_water_flask) return toast('Бутылка пуста — набери воды в Живительном ручье');
    if (state.hp >= maxHp()) return toast('ОЗ и так полные');
    state.hp = Math.min(maxHp(), state.hp + FLASK_HEAL);
    state.flags.has_water_flask = false;
    floaters.push({ x: hero.x, y: hero.y - 70, text: '+' + FLASK_HEAL, life: 1, color: '#9cf0a0' });
    burst(hero.x, hero.y - 28, 16, '120,230,140');
    toast(`🧪 +${FLASK_HEAL} ОЗ. Бутылка опустела`);
    save();
  }

  function updateCombat(dt) {
    hero.cd = Math.max(0, hero.cd - dt);
    hero.inv = Math.max(0, hero.inv - dt);
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
          hitEnemy(e, s.dmg, s.ang);
          s.life = 0;
          if (s.kind === 'magic') burst(s.x, s.y, 12, elemColor());
        }
      }
    }
    shots = shots.filter((s) => s.life > 0);

    for (const e of enemies) updateEnemy(e, dt);
    enemies = enemies.filter((e) => e.dead < 0.6);

    for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    sparks = sparks.filter((p) => p.life > 0);
    for (const f of floaters) { f.y -= 40 * dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);

    // снаряды врагов
    for (const b of ebolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (isSolid(tileAt(Math.floor(b.x / T), Math.floor((b.y + 20) / T)))) b.life = 0;
      if (b.life > 0 && Math.hypot(hero.x - b.x, hero.y - 24 - b.y) < 26) { b.life = 0; hurtHero(b.dmg, b.x, b.y); burst(b.x, b.y, 8, b.rgb); }
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
        hz.tick = 0.4;
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
        const a = Math.min(1, (h.flood - hz.t) * 4, hz.t * 3);
        g.fillStyle = `rgba(120,6,20,${0.72 * a})`;
        g.fillRect(X, Y, Wd, Hd);
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
    for (let i = 0; i < r.count; i++) {
      const a = a0 + (i - (r.count - 1) / 2) * r.spread;
      ebolts.push({ x: e.x, y: e.y - 30, vx: Math.cos(a) * r.speed, vy: Math.sin(a) * r.speed, life: 2.5, dmg: r.dmg, rgb: r.color || '208,24,44' });
    }
  }

  function updateEnemy(e, dt) {
    if (e.dead) { e.dead += dt; return; }
    const k = e.k;
    e.hit = Math.max(0, e.hit - dt);
    if (k.static) return;                              // механизм: стоит и ждёт удара
    e.t -= dt;
    e.cast -= dt;
    const dx = hero.x - e.x, dy = hero.y - e.y, dist = Math.hypot(dx, dy);
    let mx = 0, my = 0;
    switch (e.st) {
      case 'idle':                                     // бродит, пока не заметит героя
        e.wander += (Math.random() - 0.5) * dt * 3;
        if (e.t < 0) e.t = 1 + Math.random() * 2;
        if (e.t < 0.8) { mx = Math.cos(e.wander) * 35; my = Math.sin(e.wander) * 35; }
        if (dist < k.aggro) e.st = 'chase';
        break;
      case 'chase':
        if (k.keep) {                                  // стрелок держит дистанцию и ходит по кругу
          const dir = dist < k.keep - 40 ? -1 : dist > k.keep + 60 ? 1 : 0;
          mx = (dx * dir - dy * 0.6 * e.side) / dist * k.speed; my = (dy * dir + dx * 0.6 * e.side) / dist * k.speed;
        } else if (dist > 40) { mx = dx / dist * k.speed; my = dy / dist * k.speed; }
        if (k.lunge && dist < 150) { e.st = 'windup'; e.atk = 'lunge'; e.t = k.windup; e.lx = dx / dist; e.ly = dy / dist; }
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
        if (dist < 44) hurtHero(k.dmg, e.x, e.y);
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
    if (!boxBlocked(e.x + mx * dt, e.y, k.w, k.h)) e.x += mx * dt;
    if (!boxBlocked(e.x, e.y + my * dt, k.w, k.h)) e.y += my * dt;
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
    exitLock = true;
    if (!check(ex.if)) { stepBack(); if (ex.else) startDialogue(ex.else); return; }
    if (ex.to) fade(() => enterMap(ex.to, ex.at, ex.dir));
    else if (ex.d) { stepBack(); startDialogue(ex.d); }
  }
  // отойти на шаг от выхода (назад по направлению движения)
  function stepBack() {
    const d = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[hero.dir];
    for (let i = 0; i < 28; i++) if (!blocked(hero.x + d[0], hero.y + d[1])) { hero.x += d[0]; hero.y += d[1]; }
    exitLock = false;
  }

  let fading = 0, fadeCb = null, fadeColor = '0,0,0';
  function fade(cb, color) { if (fading) return; fading = 0.001; fadeCb = cb; fadeColor = color === 'white' ? '255,255,255' : '0,0,0'; mode = 'fade'; }

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

  // ---------------------------------------------------------------- Рисование
  function draw() {
    g.fillStyle = '#0b0908';
    g.fillRect(0, 0, W, H);
    if (!map) { drawCrack(); return; }

    const ox = Math.round(cam.x), oy = Math.round(cam.y);
    const rows = map.tiles.length, cols = map.tiles[0].length;
    const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T));
    const x1 = Math.min(cols - 1, Math.floor((ox + W) / T)), y1 = Math.min(rows - 1, Math.floor((oy + H) / T));

    // земля
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

    // объекты по глубине (нижняя кромка)
    const objs = [];
    for (let ty = y0; ty <= Math.min(rows - 1, y1 + 1); ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = map.tiles[ty][tx];
        if (t === 'T') objs.push({ y: ty * T + T, draw: () => g.drawImage(TREE, tx * T - ox, ty * T - oy - 32, 64, 96) });
        if (t === 'P') objs.push({ y: ty * T + T - 4, draw: () => g.drawImage(PILLAR, tx * T - ox, ty * T - oy - 64, 64, 128) });
      }
    }
    for (const n of npcs) objs.push({ y: n.prop === 'note' ? n.py - 30 : n.py, draw: () => drawNpc(n, ox, oy) });
    for (const e of enemies) objs.push({ y: e.y, draw: () => drawEnemy(e, ox, oy) });
    objs.push({ y: hero.y, draw: () => drawHero(ox, oy) });
    if (chase) objs.push({ y: chase.y, draw: () => drawThief(ox, oy) });
    if (hunt) for (const f of hunt.figs) objs.push({ y: f.y, draw: () => drawFigure(f, ox, oy) });
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.draw();
    drawGhost(ox, oy);
    drawCombatFx(ox, oy);
    drawFireflies(ox, oy);
    drawMind(ox, oy);
    if (map.vignette) drawVignette(ox, oy);
    drawCrack();

    // подсказка «E»
    if (near && mode === 'play') {
      const X = near.px - ox, Y = near.py - oy - 84 + Math.sin(time * 5) * 3;
      g.fillStyle = '#e2b65a';
      g.fillRect(X - 15, Y - 15, 30, 30);
      g.fillStyle = '#2a1d0b';
      g.font = 'bold 20px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('E', X, Y + 1);
    }

    if (state && mode !== 'title' && mode !== 'create') { drawBars(); drawChaseTimer(); drawBossBar(); }
    if (mode === 'mini') drawMini();

    // затемнение при переходе
    if (fading) {
      g.fillStyle = `rgba(${fadeColor},${fading < 1 ? fading : Math.max(0, 2 - fading)})`;
      g.fillRect(0, 0, W, H);
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
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath(); g.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2); g.fill();
  }

  function drawHero(ox, oy) {
    const x = Math.round(hero.x - ox), y = Math.round(hero.y - oy);
    shadow(x, y - 2, 20);
    const bob = hero.moving ? Math.abs(Math.sin(hero.walk)) * 4 : Math.sin(time * 2) * 1;
    const sp = heroSprite(hero.dir);
    if (!ready(sp)) return;
    if (hero.inv > 0 && Math.floor(hero.inv * 14) % 2) g.globalAlpha = 0.35;     // мигает после удара
    g.drawImage(sp, x - 32, Math.round(y - 64 - bob), 64, 64);
    if (hero.inv > 0.75) g.drawImage(silhouette(sp, '#ff5040'), x - 32, Math.round(y - 64 - bob), 64, 64);
    g.globalAlpha = 1;
  }

  function drawEnemy(e, ox, oy) {
    const x = Math.round(e.x - ox), y = Math.round(e.y - oy);
    const sp = e.k.art ? ART[e.k.art] : img(`assets/sprites/${e.k.sprite || e.kind}_${e.dir}.png`);
    if (!e.k.art && !ready(sp)) return;
    if (e.dead) g.globalAlpha = Math.max(0, 1 - e.dead / 0.6);
    shadow(x, y - 2, 24);
    const crouch = e.st === 'windup' ? 6 : 0;
    const hop = e.st === 'lunge' ? 10 : (e.st === 'chase' ? Math.abs(Math.sin(time * 12 + e.wander)) * 3 : 0);
    const sh = e.dead ? 64 * (1 - e.dead / 1.2) : 64;
    g.drawImage(sp, x - 32, y - sh + crouch - hop, 64, sh - crouch);
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
    for (const b of ebolts) {
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
    if (state.flags.got_flask) {
      const fx = X + Wd + 22, full = state.flags.has_water_flask;
      g.fillStyle = 'rgba(10,8,6,.7)'; g.fillRect(fx - 4, Y - 6, 62, 38);
      g.fillStyle = '#b9dbe6'; g.fillRect(fx + 4, Y + 2, 14, 24); g.fillRect(fx + 8, Y - 3, 6, 6);
      if (full) { g.fillStyle = '#5ad0ff'; g.fillRect(fx + 6, Y + 8, 10, 16); }
      g.fillStyle = full ? '#f4dca0' : '#7d7062';
      g.font = 'bold 18px sans-serif'; g.textAlign = 'left';
      g.fillText('Q', fx + 28, Y + 14);
    }
  }

  function drawNpc(n, ox, oy) {
    const x = Math.round(n.px - ox), y = Math.round(n.py - oy);
    if (n.prop === 'sign') { g.drawImage(SIGN, x - 32, y - 60, 64, 64); return; }
    if (n.prop === 'house') { g.drawImage(HOUSE, x - 72, y - 128, 144, 132); return; }
    if (n.prop === 'altar') { g.drawImage(ALTAR, x - 96, y - 70, 192, 112); return; }
    if (n.prop === 'pew') { g.drawImage(PEW, x - 96, y - 40, 192, 64); return; }
    if (n.prop === 'mirror') { g.drawImage(MIRROR, x - 36, y - 104, 72, 108); return; }
    if (n.prop === 'desk') { g.drawImage(DESK, x - 96, y - 82, 192, 112); return; }
    if (n.prop === 'organ') { g.drawImage(state.flags.organ_broken ? ORGAN_BROKEN : ORGAN, x - 192, y - 160, 384, 192); return; }
    if (n.prop === 'nthrone') { g.drawImage(NTHRONE, x - 48, y - 108, 96, 112); return; }
    if (n.prop === 'table') { g.drawImage(TABLE, x - 192, y - 100, 384, 128); return; }
    if (n.prop === 'arch') { g.drawImage(ARCH, x - 96, y - 176, 192, 192); return; }
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
    if (p.scene) fade(() => enterMap(p.scene.scene, p.scene.at, p.scene.dir), p.scene.fx === 'flash' ? 'white' : null);
    else if (p.mini) startMini(p.mini);
    else if (p.ending) showEnding(p.ending);
    else if (p.lock) lockGame();
  }

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
    for (const id of ['title', 'create', 'pause', 'ending', 'locked', 'achievements']) $(id).hidden = id !== name;
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
    if (on && mode === 'play') { mode = 'pause'; screen('pause'); }
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
  $('btn-flask').addEventListener('pointerdown', (e) => { e.preventDefault(); useFlask(); });
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
      fading += dt * 3.5;
      if (fading >= 1 && fadeCb) { const cb = fadeCb; fadeCb = null; cb(); }
      if (fading >= 2) { fading = 0; if (mode === 'fade') mode = 'play'; }
    }
    update(dt);
    typeTick(dt);
    if (crack) crack.t += dt;
    const shake = crack && crack.t < 0.6 ? (0.6 - crack.t) * 30 : 0;      // экран трясёт после удара
    g.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
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
    get curEnc() { return curEnc; }, get mini() { return mini; }, get ffly() { return ffly; }, get hunt() { return hunt; }, miniPress, hz, hero, enterMap, startDialogue, attack, useFlask, maxHp, MAPS, ELEMENTS };

  toTitle();
  nextFrame(frame);
})();
