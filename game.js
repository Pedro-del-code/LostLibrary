/* =========================================================================
   LOST LIBRARY — core game
   Canvas 2D game: exploration + inventory, keyboard + touch joystick/buttons
   ========================================================================= */
(() => {
"use strict";

/* ---------------------------------------------------------------------
   0. BOOT / ASSET LOADING
--------------------------------------------------------------------- */
const bootFill = document.getElementById('boot-fill');
const bootHint = document.getElementById('boot-hint');
const bootScreen = document.getElementById('boot-screen');

function setBoot(pct, text){
  bootFill.style.width = pct + '%';
  if (text) bootHint.textContent = text;
}

const ASSETS = { atlas: null, manifest: null, tiles: {} };

// Ruins tile set — hand-painted sprites (processed: background removed, trimmed)
const TILE_FILES = {
  pisoA: 'piso_pedra_a.png', pisoB: 'piso_pedra_b.png',
  coluna1: 'coluna_1.png', coluna2: 'coluna_2.png', coluna3: 'coluna_3.png',
  canteiroBase: 'canteiro_base.png', canteiroGlow: 'canteiro_glow.png',
  aberturaTeto: 'abertura_teto.png',
  vinhaA: 'vinha_a.png', vinhaB: 'vinha_b.png',
  entulho1: 'entulho_1.png', entulho2: 'entulho_2.png',
  raizes1: 'raizes_1.png', raizes2: 'raizes_2.png',
  arco: 'arco_passagem.png',
  savePoint: 'save_point.png',
  paredeFundo: 'parede_fundo.png',
  florBush1: 'flor_bush_1.png', florBush2: 'flor_bush_2.png', florBush3: 'flor_bush_3.png',
  florSmall: 'flor_small.png',
  florBushWide1: 'flor_bush_wide_1.png', florBushWide2: 'flor_bush_wide_2.png',
  florScatter: 'flor_scatter.png',
};

function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets(){
  // cache-busting query param: bumps whenever sprite assets change, so
  // browsers/CDNs that cached an older build always fetch the new files.
  const ASSET_VERSION = 'v6';
  setBoot(10, 'abrindo os arquivos antigos…');
  const manifestResp = await fetch(`assets/sprites/player_manifest.json?${ASSET_VERSION}`);
  ASSETS.manifest = await manifestResp.json();
  setBoot(30, 'acendendo as velas…');

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = `assets/sprites/player_atlas.png?${ASSET_VERSION}`;
    ASSETS.atlas = img;
  });
  setBoot(55, 'esculpindo as colunas…');

  const tileEntries = Object.entries(TILE_FILES);
  let loaded = 0;
  await Promise.all(tileEntries.map(([key, file]) =>
    loadImage(`assets/tiles/${file}?${ASSET_VERSION}`).then(img => {
      ASSETS.tiles[key] = img;
      loaded++;
      setBoot(55 + Math.round((loaded/tileEntries.length)*30), 'ouvindo os ecos de pedra…');
    })
  ));

  setBoot(95, 'quase lá…');
  await new Promise(r => setTimeout(r, 180));
  setBoot(100, 'pronto.');
  await new Promise(r => setTimeout(r, 150));
}

/* ---------------------------------------------------------------------
   1. CANVAS / VIEWPORT
--------------------------------------------------------------------- */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let VW = 0, VH = 0; // css pixel viewport size

function resize(){
  VW = window.innerWidth;
  VH = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VW * DPR);
  canvas.height = Math.round(VH * DPR);
  canvas.style.width = VW + 'px';
  canvas.style.height = VH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/* ---------------------------------------------------------------------
   2. WORLD DEFINITION  — the chamber where she fell.
      A small, contained ruin: a hole far above, a bed of flowers that broke
      her fall, and stone columns older than anything with a name for them.
--------------------------------------------------------------------- */
const WORLD = { w: 900, h: 680 };
const ROOM_CENTER = { x: WORLD.w/2, y: 430 };

// scale factor applied to the raw column art (native ~107x299) so it reads as
// monumental but doesn't overwhelm this small room
const PILLAR_SCALE = 0.62;
const PILLAR_SPRITES = { 1:'coluna1', 2:'coluna2', 3:'coluna3' };

// Columns: {cx,cy} = bottom-center anchor point. Collision is a small footprint
// box under the base — tall art, but you can walk in front of/behind it (y-sorted).
const PILLARS = [];
(function buildPillars(){
  const defs = [
    {cx:150, cy:270, variant:1, vine:false},
    {cx:750, cy:270, variant:2, vine:true},
    {cx: 95, cy:480, variant:2, vine:false},
    {cx:805, cy:480, variant:3, vine:true},
    {cx:230, cy:640, variant:3, vine:false},
    {cx:670, cy:640, variant:1, vine:false},
  ];
  defs.forEach((d,i) => {
    const img = null; // resolved at draw time from ASSETS.tiles
    PILLARS.push({ id:'pillar'+i, ...d });
  });
})();

// the flower bed that broke her fall — the heart of the room
const FLOWERBED = { cx: ROOM_CENTER.x, cy: ROOM_CENTER.y, scale: 0.86 };

// the hole in the ceiling, far above, with a shaft of light connecting it to the flowers
const CEILING_OPENING = { cx: ROOM_CENTER.x, cy: 128, scale: 0.72 };

// a quiet save point beside the flowers
const SAVE_POINT = { cx: ROOM_CENTER.x + 165, cy: ROOM_CENTER.y + 25, scale: 0.6 };

// the archway south of the room — the only way further in (more of the ruins
// arrive in a later update; for now this just marks that the room continues)
const ARCHWAY = { cx: ROOM_CENTER.x, cy: 655, scale: 0.85 };

// purely decorative scatter
const RUBBLE = [
  { cx:230, cy:330, sprite:'entulho1', scale:0.55 },
  { cx:700, cy:360, sprite:'entulho2', scale:0.6 },
  { cx:330, cy:600, sprite:'entulho2', scale:0.5 },
];
const ROOTS = [
  { cx:130, cy:590, sprite:'raizes1', scale:0.6 },
  { cx:770, cy:600, sprite:'raizes2', scale:0.6 },
];
const GROUND_FLOWERS = [
  { cx: ROOM_CENTER.x-150, cy: ROOM_CENTER.y+55, sprite:'florBush1', scale:0.55 },
  { cx: ROOM_CENTER.x+140, cy: ROOM_CENTER.y+60, sprite:'florBush2', scale:0.55 },
  { cx: ROOM_CENTER.x-95, cy: ROOM_CENTER.y-70, sprite:'florSmall', scale:0.6 },
  { cx: ROOM_CENTER.x+95, cy: ROOM_CENTER.y-75, sprite:'florScatter', scale:0.5 },
  { cx: ROOM_CENTER.x-40, cy: ROOM_CENTER.y+95, sprite:'florBush3', scale:0.5 },
];

/* ---------------------------------------------------------------------
   3. ITEM DATABASE + INTERACTABLES
--------------------------------------------------------------------- */
const ITEM_DB = {
  espada_enferrujada: { name:'Espada Enferrujada', cat:'armas', icon:'⚔️',
    desc:'Uma lâmina tomada pela ferrugem. Ainda corta — se você tiver coragem de empunhá-la.' },
  adaga_bibliotecaria: { name:'Adaga da Guardiã', cat:'armas', icon:'🗡️',
    desc:'Curta e silenciosa. Quem a carregava não estava mais aqui quando você chegou.' },
  colete_couro: { name:'Colete de Couro', cat:'armaduras', icon:'🥋',
    desc:'Gasto pelo tempo, mas ainda protege o suficiente contra a pedra fria e as sombras.' },
  manto_poeira: { name:'Manto Empoeirado', cat:'armaduras', icon:'🧥',
    desc:'Cheira a musgo e pedra antiga. Quem o usou por último parece ter desaparecido entre as colunas.' },
  vela_eterna: { name:'Chama Perene', cat:'itens', icon:'🕯️',
    desc:'Nunca se apaga. Talvez ilumine caminhos que as ruínas preferem manter escondidos.',
    thought:'Essa chama não tremula... nem quando eu sopro.' },
  chave_antiga: { name:'Chave Antiga', cat:'itens', icon:'🗝️',
    desc:'Enferrujada e fria ao toque. Abre... alguma coisa. Você ainda não sabe o quê.',
    thought:'Fria demais pra ter ficado tanto tempo largada aí.' },
  pocao_tinta: { name:'Frasco de Seiva Viva', cat:'itens', icon:'🧪',
    desc:'Um líquido escuro se move sozinho dentro do vidro, como se ainda estivesse crescendo.' },
  pergaminho: { name:'Fragmento de Mapa', cat:'itens', icon:'📜',
    desc:'Um pedaço rasgado de um mapa de pedra. Falta o resto — talvez em outra câmara.',
    thought:'Um mapa... rasgado bem onde eu mais precisava.' },
};

// Interaction points placed in the world — few and close together, since
// this is just the small chamber where she landed.
const INTERACTABLES = [
  { id:'roots_item', x:ROOTS[0].cx, y:ROOTS[0].cy-20, r:65, type:'item', itemId:'chave_antiga',
    prompt:'raízes retorcidas', found:false },
  { id:'rubble_item', x:RUBBLE[0].cx, y:RUBBLE[0].cy-10, r:60, type:'item', itemId:'espada_enferrujada',
    prompt:'monte de escombros', found:false },
  { id:'flowerbed_item', x:FLOWERBED.cx, y:FLOWERBED.cy-10, r:75, type:'item', itemId:'vela_eterna',
    prompt:'canteiro de flores', found:false },
  { id:'ghost', x:ARCHWAY.cx, y:ARCHWAY.cy-60, r:80, type:'npc',
    prompt:'presença silenciosa',
    lines:[
      'Uma sombra junto ao arco se vira lentamente para você.',
      '"Ah... um visitante. Faz tanto tempo desde o último."',
      '"Você caiu bem no meio das flores. Elas amorteceram, dessa vez."',
      '"Além desse arco, as ruínas continuam. Mas isso... é para depois."',
    ]},
];

/* ---------------------------------------------------------------------
   4. INPUT
--------------------------------------------------------------------- */
const Keys = Object.create(null);
const Input = {
  moveX: 0, moveY: 0,
  actionPressed:false, cancelPressed:false, inventoryPressed:false,
};

const KEYMAP_MOVE = {
  ArrowUp:'up', KeyW:'up',
  ArrowDown:'down', KeyS:'down',
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
};

window.addEventListener('keydown', (e) => {
  if (KEYMAP_MOVE[e.code]) { Keys[KEYMAP_MOVE[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyZ') { onAction(); e.preventDefault(); }
  if (e.code === 'KeyX') { onCancel(); e.preventDefault(); }
  if (e.code === 'KeyC') { onInventoryToggle(); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP_MOVE[e.code]) { Keys[KEYMAP_MOVE[e.code]] = false; e.preventDefault(); }
});

// --- virtual joystick ---
const joyZone = document.getElementById('joystick-zone');
const joyNub = document.getElementById('joystick-nub');
let joyActive = false, joyId = null, joyVec = {x:0,y:0};
const JOY_RADIUS = 46;

function joyStart(id, clientX, clientY){
  joyActive = true; joyId = id;
  joyZone.classList.add('active');
  updateJoy(clientX, clientY);
}
function updateJoy(clientX, clientY){
  const rect = joyZone.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  let dx = clientX - cx, dy = clientY - cy;
  const dist = Math.hypot(dx,dy);
  const max = rect.width/2;
  if (dist > max){ dx = dx/dist*max; dy = dy/dist*max; }
  joyNub.style.transform = `translate(-50%,-50%) translate(${dx}px, ${dy}px)`;
  const norm = Math.min(dist,max)/max;
  const deadzone = 0.18;
  if (norm < deadzone){ joyVec.x = 0; joyVec.y = 0; }
  else { joyVec.x = dx/max; joyVec.y = dy/max; }
}
function joyEnd(){
  joyActive = false; joyId = null;
  joyZone.classList.remove('active');
  joyNub.style.transform = 'translate(-50%,-50%)';
  joyVec.x = 0; joyVec.y = 0;
}
joyZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  joyStart(t.identifier, t.clientX, t.clientY);
  e.preventDefault();
}, {passive:false});
joyZone.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches){
    if (t.identifier === joyId) updateJoy(t.clientX, t.clientY);
  }
  e.preventDefault();
}, {passive:false});
window.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches){
    if (t.identifier === joyId) joyEnd();
  }
});
window.addEventListener('touchcancel', () => joyEnd());
// mouse fallback for testing joystick on desktop
joyZone.addEventListener('mousedown', (e) => { joyStart('mouse', e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (joyActive && joyId==='mouse') updateJoy(e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { if (joyId==='mouse') joyEnd(); });

// --- mobile action buttons ---
function bindPress(el, handler){
  const press = (e) => { el.classList.add('pressed'); handler(); e.preventDefault(); };
  const release = (e) => { el.classList.remove('pressed'); };
  el.addEventListener('touchstart', press, {passive:false});
  el.addEventListener('touchend', release);
  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
}
bindPress(document.getElementById('btn-z'), () => onAction());
bindPress(document.getElementById('btn-x'), () => onCancel());
bindPress(document.getElementById('btn-c'), () => onInventoryToggle());

/* ---------------------------------------------------------------------
   5. UI STATE: toast / dialogue / inventory
--------------------------------------------------------------------- */
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(title, body){
  toastEl.innerHTML = (title ? `<span class="toast-title">${title}</span>` : '') + (body||'');
  toastEl.classList.remove('hidden');
  requestAnimationFrame(()=> toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{
    toastEl.classList.remove('show');
    setTimeout(()=> toastEl.classList.add('hidden'), 320);
  }, 2600);
}

const dialogueEl = document.getElementById('dialogue');
const dialogueBoxEl = document.getElementById('dialogue-box');
const dialogueText = document.getElementById('dialogue-text');
const dialogueNameEl = document.getElementById('dialogue-name');
let dialogueState = { open:false, lines:[], idx:0 };

// speaker: 'general' (anyone/anything else — the frame with no portrait) or
// 'player' (the protagonist's own voice/thoughts — frame with her portrait).
function openDialogue(lines, speaker = 'general', name = ''){
  dialogueState = { open:true, lines, idx:0 };
  dialogueText.textContent = lines[0];
  dialogueBoxEl.classList.remove('style-general', 'style-player');
  dialogueBoxEl.classList.add(speaker === 'player' ? 'style-player' : 'style-general');
  dialogueNameEl.textContent = name;
  dialogueEl.classList.remove('hidden');
}
function advanceDialogue(){
  dialogueState.idx++;
  if (dialogueState.idx >= dialogueState.lines.length){ closeDialogue(); return; }
  dialogueText.textContent = dialogueState.lines[dialogueState.idx];
}
function closeDialogue(){
  dialogueState.open = false;
  dialogueEl.classList.add('hidden');
}

const invEl = document.getElementById('inventory');
const itemGridEl = document.getElementById('item-grid');
const itemDetailEl = document.getElementById('item-detail');
const tabs = Array.from(document.querySelectorAll('.tab'));
const inventoryState = { open:false, cat:'armas', items:{ armas:[], armaduras:[], itens:[] }, selected:null };

function addItemToInventory(itemId){
  const def = ITEM_DB[itemId];
  if (!def) return;
  inventoryState.items[def.cat].push(itemId);
}

function renderInventory(){
  itemGridEl.innerHTML = '';
  const list = inventoryState.items[inventoryState.cat];
  if (list.length === 0){
    itemGridEl.innerHTML = '<div class="item-grid-empty">nada aqui ainda…<br>explore a biblioteca.</div>';
  } else {
    list.forEach((itemId, i) => {
      const def = ITEM_DB[itemId];
      const slot = document.createElement('div');
      slot.className = 'item-slot' + (inventoryState.selected === itemId ? ' selected' : '');
      slot.innerHTML = `${def.icon}`;
      slot.title = def.name;
      slot.addEventListener('click', () => { inventoryState.selected = itemId; renderInventory(); });
      itemGridEl.appendChild(slot);
    });
  }
  renderDetail();
}
function renderDetail(){
  const id = inventoryState.selected;
  const def = id ? ITEM_DB[id] : null;
  if (!def || def.cat !== inventoryState.cat){
    itemDetailEl.innerHTML = '<p class="item-detail-empty">selecione um item para examiná-lo</p>';
    return;
  }
  itemDetailEl.innerHTML = `
    <span class="item-detail-icon">${def.icon}</span>
    <h3>${def.name}</h3>
    <span class="item-kind">${def.cat}</span>
    <p>${def.desc}</p>
  `;
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    inventoryState.cat = tab.dataset.cat;
    inventoryState.selected = null;
    renderInventory();
  });
});

function openInventory(){
  inventoryState.open = true;
  invEl.classList.remove('hidden');
  invEl.setAttribute('aria-hidden','false');
  renderInventory();
}
function closeInventory(){
  inventoryState.open = false;
  invEl.classList.add('hidden');
  invEl.setAttribute('aria-hidden','true');
}

/* ---------------------------------------------------------------------
   6. ACTION / CANCEL / INVENTORY HANDLERS  (Z / X / C)
--------------------------------------------------------------------- */
function onAction(){
  if (appState !== 'playing'){ handlePreGameAction(); return; }
  if (dialogueState.open){ advanceDialogue(); return; }
  if (inventoryState.open){ return; } // selection already shows detail on tap
  // try interact with nearest interactable in range
  const target = getNearbyInteractable();
  if (!target) return;
  if (target.type === 'npc'){
    openDialogue(target.lines, 'general', 'Presença');
  } else if (target.type === 'item'){
    if (target.found){
      showToast(null, 'já não há nada mais aqui.');
      return;
    }
    target.found = true;
    addItemToInventory(target.itemId);
    const def = ITEM_DB[target.itemId];
    showToast('+ item encontrado', `${def.icon} ${def.name}`);
    if (def.thought){
      // the protagonist's own reaction — uses her portrait dialogue box
      setTimeout(() => openDialogue([def.thought], 'player'), 260);
    }
  }
}
function onCancel(){
  if (appState === 'cutscene'){ skipCutscene(); return; }
  if (appState !== 'playing') return;
  if (dialogueState.open){ closeDialogue(); return; }
  if (inventoryState.open){ closeInventory(); return; }
}
function onInventoryToggle(){
  if (appState !== 'playing') return;
  if (dialogueState.open) return;
  if (inventoryState.open) closeInventory();
  else openInventory();
}

/* ---------------------------------------------------------------------
   7. PLAYER
--------------------------------------------------------------------- */
const Player = {
  x: FLOWERBED.cx, y: FLOWERBED.cy + 25,
  w: 34, h: 20,          // collision box (feet area, small)
  speed: 190,
  dir: 'down',
  moving: false,          // true only when the player actually displaced this frame
  animDist: 0,            // accumulated ON-SCREEN pixels actually walked (not blocked)
  frameIdx: 0,
  stepPx: 13,             // pixels of real movement per animation frame (tie animation to distance, not time)
};

function playerFootBox(){
  return { x: Player.x - Player.w/2, y: Player.y - Player.h/2, w: Player.w, h: Player.h };
}

function rectsOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

// pillars collide only at their base (a small footprint under the tall art) —
// so the player can pass visually behind/in front of the column, y-sorted.
function pillarCollisionBox(p){
  const fw = 42, fh = 34;
  return { x: p.cx - fw/2, y: p.cy - fh, w: fw, h: fh };
}

function tryMove(dx, dy){
  const x0 = Player.x, y0 = Player.y;
  // move X
  if (dx !== 0){
    Player.x += dx;
    const box = playerFootBox();
    for (const p of PILLARS){
      if (rectsOverlap(box, pillarCollisionBox(p))){
        Player.x -= dx;
        break;
      }
    }
    Player.x = Math.max(40, Math.min(WORLD.w-40, Player.x));
  }
  // move Y
  if (dy !== 0){
    Player.y += dy;
    const box = playerFootBox();
    for (const p of PILLARS){
      if (rectsOverlap(box, pillarCollisionBox(p))){
        Player.y -= dy;
        break;
      }
    }
    Player.y = Math.max(150, Math.min(WORLD.h-40, Player.y));
  }
  // return the distance ACTUALLY covered (0 if fully blocked by a pillar/wall) —
  // this is what drives the walk animation, so blocked movement never "walks in place".
  return Math.hypot(Player.x - x0, Player.y - y0);
}

function getNearbyInteractable(){
  let best = null, bestDist = Infinity;
  for (const it of INTERACTABLES){
    if (it.type === 'item' && it.found) continue;
    const d = Math.hypot(Player.x - it.x, Player.y - (it.y+30));
    if (d < it.r && d < bestDist){ best = it; bestDist = d; }
  }
  return best;
}

function updatePlayer(dt){
  const uiOpen = inventoryState.open || dialogueState.open;
  let ix = 0, iy = 0;
  if (!uiOpen){
    if (Keys.left) ix -= 1;
    if (Keys.right) ix += 1;
    if (Keys.up) iy -= 1;
    if (Keys.down) iy += 1;
    // joystick overrides/adds
    if (Math.abs(joyVec.x) > 0.001 || Math.abs(joyVec.y) > 0.001){
      ix += joyVec.x; iy += joyVec.y;
    }
  }
  let mvx = ix, mvy = iy;
  const len = Math.hypot(mvx, mvy);
  const wantsToMove = len > 0.05;
  let traveled = 0;
  if (wantsToMove){
    mvx /= len; mvy /= len;
    const x0 = Player.x, y0 = Player.y;
    traveled = tryMove(mvx * Player.speed * dt, mvy * Player.speed * dt);
    // pick sprite direction from the ACTUAL displacement that happened after
    // collision resolution, not the input intent. Otherwise, e.g. sliding
    // along a pillar diagonally can zero out the x-axis move while the sprite
    // still faces/animates left-right — the character visibly moves one way
    // (say, down) while the legs play a sideways stride: that mismatch is
    // exactly what read as a "moonwalk".
    const dxActual = Player.x - x0, dyActual = Player.y - y0;
    if (Math.abs(dxActual) > 0.001 || Math.abs(dyActual) > 0.001){
      if (Math.abs(dxActual) > Math.abs(dyActual)){
        Player.dir = dxActual > 0 ? 'right' : 'left';
      } else {
        Player.dir = dyActual > 0 ? 'down' : 'up';
      }
    }
  }
  // "moving" (for animation purposes) only counts if the player actually displaced —
  // walking into a pillar/wall now correctly freezes the walk cycle instead of
  // animating legs in place.
  Player.moving = traveled > 0.001;

  // animation — advance frames by DISTANCE walked, not by elapsed time, so the
  // stride always matches how far the character actually moved on screen.
  const dirData = ASSETS.manifest.directions[Player.dir];
  const frames = Player.moving ? dirData.walkFrames : [dirData.idleFrame];
  if (Player.moving){
    Player.animDist += traveled;
    if (Player.animDist >= Player.stepPx){
      Player.animDist -= Player.stepPx;
      Player.frameIdx = (Player.frameIdx + 1) % frames.length;
    }
  } else {
    Player.frameIdx = 0;
    Player.animDist = 0;
  }
}

/* ---------------------------------------------------------------------
   8. CAMERA
--------------------------------------------------------------------- */
const Camera = { x:0, y:0 };
function updateCamera(){
  Camera.x = Player.x - VW/2;
  Camera.y = Player.y - VH/2;
  Camera.x = Math.max(0, Math.min(WORLD.w - VW, Camera.x));
  Camera.y = Math.max(0, Math.min(WORLD.h - VH, Camera.y));
  if (WORLD.w < VW) Camera.x = (WORLD.w - VW)/2;
  if (WORLD.h < VH) Camera.y = (WORLD.h - VH)/2;
}

/* ---------------------------------------------------------------------
   9. RENDERING
--------------------------------------------------------------------- */
const COLORS = {
  floorMortar:'rgba(10,7,16,.5)',
};

function tile(key){ return ASSETS.tiles[key]; }

// generic sprite draw helper: (cx,cy) is the bottom-center anchor point by
// default, matching how props sit on the ground.
function drawSprite(img, cx, cy, scale, anchorCenter){
  if (!img) return null;
  const w = img.width*scale, h = img.height*scale;
  const dx = cx - w/2;
  const dy = anchorCenter ? cy - h/2 : cy - h;
  ctx.drawImage(img, dx, dy, w, h);
  return { dx, dy, w, h };
}

function drawFloor(){
  const a = tile('pisoA'), b = tile('pisoB');
  if (!a || !b){ ctx.fillStyle = '#1c1728'; ctx.fillRect(0,0,WORLD.w,WORLD.h); return; }
  const TILE = 84;
  for (let y=0; y<WORLD.h; y+=TILE){
    for (let x=0; x<WORLD.w; x+=TILE){
      const img = ((x/TILE)+(y/TILE))%2===0 ? a : b;
      ctx.drawImage(img, x, y, TILE, TILE);
    }
  }
  // soft mortar-line vignette between tiles (very subtle, the art already has texture)
  ctx.strokeStyle = COLORS.floorMortar;
  ctx.lineWidth = 1;
  for (let x=0; x<=WORLD.w; x+=TILE){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD.h); ctx.stroke(); }
  for (let y=0; y<=WORLD.h; y+=TILE){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD.w,y); ctx.stroke(); }
}

function drawBackWall(){
  const w = tile('paredeFundo');
  if (!w) return;
  const stripH = 150;
  const scale = stripH / w.height;
  const tileW = w.width * scale;
  for (let x = -tileW; x < WORLD.w+tileW; x += tileW){
    ctx.drawImage(w, x, -10, tileW+1, stripH);
  }
  // shadow under the wall strip, grounding it into the floor
  const grad = ctx.createLinearGradient(0, stripH-30, 0, stripH+30);
  grad.addColorStop(0, 'rgba(0,0,0,.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, stripH-30, WORLD.w, 60);
}

function drawCeilingLight(t){
  // soft vertical shaft connecting the opening above to the flowers below —
  // drawn UNDER the sprites, like the light beam from the cutscene.
  const x0 = CEILING_OPENING.cx, y0 = CEILING_OPENING.cy + 20;
  const x1 = FLOWERBED.cx, y1 = FLOWERBED.cy;
  const sway = Math.sin(t*0.4) * 14;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, 'rgba(226,232,255,.30)');
  grad.addColorStop(1, 'rgba(226,232,255,.03)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x0-46+sway*0.3, y0);
  ctx.lineTo(x0+46+sway*0.3, y0);
  ctx.lineTo(x1+150+sway, y1);
  ctx.lineTo(x1-150+sway, y1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCeilingOpening(){
  drawSprite(tile('aberturaTeto'), CEILING_OPENING.cx, CEILING_OPENING.cy, CEILING_OPENING.scale, true);
}

function drawPillar(p){
  const img = tile(PILLAR_SPRITES[p.variant]);
  if (!img) return;
  // contact shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(p.cx, p.cy-2, 26, 8, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawSprite(img, p.cx, p.cy, PILLAR_SCALE);
  if (p.vine){
    const vineImg = tile(p.variant % 2 === 0 ? 'vinhaA' : 'vinhaB');
    const vw = img.width*PILLAR_SCALE, vh = img.height*PILLAR_SCALE;
    drawSprite(vineImg, p.cx + vw*0.22, p.cy - vh*0.62, PILLAR_SCALE*0.85);
  }
}

function drawFlowerbed(){
  drawSprite(tile('canteiroGlow'), FLOWERBED.cx, FLOWERBED.cy + 30, FLOWERBED.scale);
}

function drawArchway(){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(ARCHWAY.cx, ARCHWAY.cy+4, 60, 12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawSprite(tile('arco'), ARCHWAY.cx, ARCHWAY.cy, ARCHWAY.scale);
}

function drawRubble(r){ drawSprite(tile(r.sprite), r.cx, r.cy, r.scale); }
function drawRoots(r){ drawSprite(tile(r.sprite), r.cx, r.cy, r.scale); }
function drawGroundFlower(f){ drawSprite(tile(f.sprite), f.cx, f.cy, f.scale); }

function drawSavePoint(t){
  const img = tile('savePoint');
  if (!img) return;
  const pulse = 0.85 + Math.sin(t*2.4)*0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  drawSprite(img, SAVE_POINT.cx, SAVE_POINT.cy, SAVE_POINT.scale);
  ctx.restore();
}

function drawInteractPrompt(it, t){
  if (it.type==='item' && it.found) return;
  const bob = Math.sin(t*3 + it.x) * 4;
  ctx.save();
  ctx.translate(it.x, it.y - 46 + bob);
  ctx.font = '20px serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(216,171,92,.95)';
  ctx.fillText(it.type==='npc' ? '❔' : '✦', 0, 0);
  ctx.restore();
}

function drawPlayer(){
  // Root cause (verified by measuring face position vs hair mass in the atlas):
  // the manifest's 'left' and 'right' keys are swapped relative to the actual
  // art. Frames labeled "left" visually face right, and frames labeled "right"
  // visually face left. No mirroring is needed — just read from the swapped key.
  const DIR_KEY = { left: 'right', right: 'left', up: 'up', down: 'down' };
  const dirData = ASSETS.manifest.directions[DIR_KEY[Player.dir]];
  const frames = Player.moving ? dirData.walkFrames : [dirData.idleFrame];
  const frameIndex = frames[Player.frameIdx % frames.length];
  const f = dirData.frames[frameIndex];

  // shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(Player.x, Player.y + Player.h/2 + 2, 20, 7, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  const drawH = 108; // on-screen character height in world px
  const scale = drawH / f.h;
  const drawW = f.w * scale;
  const dx = Player.x - drawW/2;
  const dy = Player.y - drawH + Player.h/2 + 6;

  ctx.save();
  ctx.drawImage(
    ASSETS.atlas,
    f.x, f.y, f.w, f.h,
    dx, dy, drawW, drawH
  );
  ctx.restore();
}

let clock = 0;
function render(){
  ctx.clearRect(0,0,VW,VH);
  ctx.save();
  ctx.translate(-Camera.x, -Camera.y);

  drawFloor();
  drawBackWall();
  drawCeilingLight(clock);

  // z-sort everything that stands on the floor by its ground anchor (y), so the
  // player correctly passes in front of / behind columns and props.
  const drawables = [];
  PILLARS.forEach(p => drawables.push({ y: p.cy, draw: () => drawPillar(p) }));
  RUBBLE.forEach(r => drawables.push({ y: r.cy, draw: () => drawRubble(r) }));
  ROOTS.forEach(r => drawables.push({ y: r.cy, draw: () => drawRoots(r) }));
  GROUND_FLOWERS.forEach(f => drawables.push({ y: f.cy, draw: () => drawGroundFlower(f) }));
  drawables.push({ y: FLOWERBED.cy + 55, draw: drawFlowerbed });
  drawables.push({ y: ARCHWAY.cy, draw: drawArchway });
  drawables.push({ y: SAVE_POINT.cy, draw: () => drawSavePoint(clock) });
  drawables.push({ y: Player.y, draw: drawPlayer });

  drawables.sort((a,b)=> a.y - b.y);
  drawables.forEach(d => d.draw());

  drawCeilingOpening();

  INTERACTABLES.forEach(it => drawInteractPrompt(it, clock));

  ctx.restore();
}

/* ---------------------------------------------------------------------
   10. ZONE LABEL (simple)
--------------------------------------------------------------------- */
const zoneEl = document.getElementById('hud-zone');
function updateZoneLabel(){
  let label = 'A Queda';
  if (Math.hypot(Player.x-FLOWERBED.cx, Player.y-FLOWERBED.cy) < 130) label = 'Canteiro de Flores';
  else if (Player.y > ARCHWAY.cy - 90) label = 'O Arco';
  zoneEl.textContent = label;
}

/* ---------------------------------------------------------------------
   11. MAIN LOOP
--------------------------------------------------------------------- */
let lastT = 0;
function loop(t){
  const dt = Math.min(0.05, (t - lastT)/1000 || 0);
  lastT = t;
  clock += dt;

  updatePlayer(dt);
  updateCamera();
  render();
  updateZoneLabel();

  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------------
   11b. INTRO FLOW — chapter select → title card → cutscene → gameplay
--------------------------------------------------------------------- */
let appState = 'boot'; // 'boot' | 'chapterSelect' | 'titleCard' | 'cutscene' | 'playing'
let gameLoopStarted = false;

const chapterSelectEl = document.getElementById('chapter-select');
const chapterTitleCardEl = document.getElementById('chapter-title-card');
const cutsceneEl = document.getElementById('cutscene');
const cutsceneTextEl = document.getElementById('cutscene-text');
const csChapter1Btn = document.getElementById('cs-chapter-1');

const CUTSCENE_LINES = [
  'Você não lembra de ter caído.',
  'Só o silêncio, o cheiro de pedra molhada... e uma luz, muito lá em cima, girando devagar sobre as ruínas.',
  'Quando os olhos se abrem, já é tarde demais para lembrar como chegou aqui.',
  'À sua frente, entre colunas quebradas, alguma coisa parece esperar — como se já soubesse que você viria.',
];
let cutsceneIdx = 0;

function handlePreGameAction(){
  if (appState === 'chapterSelect'){ confirmChapterSelect(); return; }
  if (appState === 'cutscene'){ advanceCutscene(); return; }
  // 'titleCard' and 'boot' ignore input — title card advances on its own
}

function enterChapterSelect(){
  appState = 'chapterSelect';
  chapterSelectEl.classList.remove('hidden');
}
function confirmChapterSelect(){
  if (appState !== 'chapterSelect') return;
  appState = 'titleCard';
  chapterSelectEl.classList.add('fade-out');
  setTimeout(() => chapterSelectEl.classList.add('hidden'), 650);
  chapterTitleCardEl.classList.remove('hidden');
  setTimeout(() => {
    chapterTitleCardEl.classList.add('fade-out');
    setTimeout(() => {
      chapterTitleCardEl.classList.add('hidden');
      startCutscene();
    }, 550);
  }, 2600);
}
csChapter1Btn.addEventListener('click', confirmChapterSelect);

// tap anywhere on the cutscene to advance (mobile has no visible Z button
// at this stage, since #mobile-controls lives inside the still-hidden
// #game-root) — this mirrors how Z behaves during the cutscene.
cutsceneEl.addEventListener('click', (e) => {
  if (e.target.closest('#cutscene-skip-btn')) return; // skip button handles itself
  advanceCutscene();
});
document.getElementById('cutscene-skip-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  skipCutscene();
});

function startCutscene(){
  appState = 'cutscene';
  cutsceneIdx = 0;
  cutsceneTextEl.textContent = CUTSCENE_LINES[0];
  cutsceneEl.classList.remove('hidden');
}
function advanceCutscene(){
  cutsceneIdx++;
  if (cutsceneIdx >= CUTSCENE_LINES.length){ endCutscene(); return; }
  cutsceneTextEl.textContent = CUTSCENE_LINES[cutsceneIdx];
}
function skipCutscene(){
  if (appState !== 'cutscene') return;
  endCutscene();
}
function endCutscene(){
  cutsceneEl.classList.add('fade-out');
  setTimeout(() => {
    cutsceneEl.classList.add('hidden');
    enterGameplay();
  }, 650);
}
function enterGameplay(){
  appState = 'playing';
  document.getElementById('game-root').classList.remove('hidden');
  resize(); // canvas was hidden (0-layout in some browsers) — recompute size now that it's visible
  if (!gameLoopStarted){
    gameLoopStarted = true;
    requestAnimationFrame((t)=>{ lastT = t; requestAnimationFrame(loop); });
    setTimeout(() => {
      showToast('Lost Library', 'explore as ruínas e encontre o que foi perdido.');
    }, 500);
  }
}

/* ---------------------------------------------------------------------
   12. START
--------------------------------------------------------------------- */
(async function start(){
  try{
    await loadAssets();
  } catch(err){
    bootHint.textContent = 'erro ao carregar os arquivos da biblioteca…';
    console.error(err);
    return;
  }
  bootScreen.classList.add('fade-out');
  setTimeout(()=> bootScreen.remove(), 900);
  setTimeout(() => enterChapterSelect(), 700);
})();

})();
