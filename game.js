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

const ASSETS = { atlas: null, manifest: null, tiles: null, tileManifest: null };

function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets(){
  setBoot(10, 'abrindo as passagens antigas…');
  const manifestResp = await fetch('assets/sprites/player_manifest.json');
  ASSETS.manifest = await manifestResp.json();
  setBoot(35, 'acendendo as velas…');

  ASSETS.atlas = await loadImage('assets/sprites/player_atlas.png');
  setBoot(60, 'musgo e pedra…');

  const tileManifestResp = await fetch('assets/tiles/tile_manifest.json');
  ASSETS.tileManifest = await tileManifestResp.json();
  ASSETS.tiles = await loadImage('assets/tiles/tile_atlas.png');
  setBoot(90, 'organizando as ruínas…');

  await new Promise(r => setTimeout(r, 220));
  setBoot(100, 'pronto.');
  await new Promise(r => setTimeout(r, 180));
}

// draw a named tile from the ruins atlas, anchored at bottom-center of (x,y),
// scaled so its on-screen height equals drawH (aspect ratio preserved).
function drawTile(name, x, y, drawH, opts){
  const t = ASSETS.tileManifest[name];
  if (!t) return;
  const scale = drawH / t.h;
  const drawW = t.w * scale;
  const flip = opts && opts.flip;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(ASSETS.tiles, t.x, t.y, t.w, t.h, -drawW/2, -drawH, drawW, drawH);
  ctx.restore();
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
   2. WORLD DEFINITION  (crumbled ruins, Undertale-inspired)
--------------------------------------------------------------------- */
const WORLD = { w: 1900, h: 1250 };

// Solid ruin pieces: {x,y,w,h} is the FOOT/collision box (small, near the
// base of the piece); `tile` + `drawH` control the sprite drawn above it.
const SHELVES = []; // kept name so the rest of the engine (collision) needs no changes
function ruin(tile, x, y, w, h, drawH, extra){
  return Object.assign({ tile, x, y, w, h, drawH }, extra || {});
}
(function buildRuins(){
  // broken gate at the top — flanking pillars + wall stubs around the entrance
  SHELVES.push(ruin('pillar_thick', 760, 150, 30, 22, 150));
  SHELVES.push(ruin('pillar_thick', 1080, 150, 30, 22, 150));
  SHELVES.push(ruin('wall_corner', 640, 170, 90, 40, 140));
  SHELVES.push(ruin('wall_corner', 1150, 170, 90, 40, 140, {flip:true}));
  SHELVES.push(ruin('arch_doorway', 910, 190, 70, 30, 190));

  // a loose row of standing pillars, like the ones lining the main path
  const pillarXs = [260, 430, 1470, 1640];
  pillarXs.forEach((px,i) => SHELVES.push(ruin('pillar_thin', px, 260 + (i%2)*40, 26, 20, 118)));
  SHELVES.push(ruin('pillar_thin2', 340, 420, 26, 20, 118));
  SHELVES.push(ruin('pillar_thin2', 1560, 420, 26, 20, 118));

  // left ruined wall-line (forms a natural aisle down the west side)
  SHELVES.push(ruin('wall_block', 150, 330, 100, 40, 130));
  SHELVES.push(ruin('wall_broken3', 150, 520, 70, 60, 120));
  SHELVES.push(ruin('wall_block', 150, 700, 100, 40, 130));
  SHELVES.push(ruin('wall_broken1', 170, 880, 44, 50, 96));

  // right ruined wall-line
  SHELVES.push(ruin('wall_block', WORLD.w-250, 330, 100, 40, 130, {flip:true}));
  SHELVES.push(ruin('wall_broken4', WORLD.w-280, 520, 50, 55, 110));
  SHELVES.push(ruin('wall_block', WORLD.w-250, 700, 100, 40, 130, {flip:true}));
  SHELVES.push(ruin('wall_broken2', WORLD.w-260, 880, 44, 50, 96));

  // scattered broken rooms in the middle of the field
  SHELVES.push(ruin('wall_corner', 720, 560, 90, 40, 140));
  SHELVES.push(ruin('wall_broken3', 900, 640, 70, 60, 120));
  SHELVES.push(ruin('wall_corner', 1120, 560, 90, 40, 140, {flip:true}));
  SHELVES.push(ruin('rubble_small', 1000, 500, 40, 26, 60));

  // lower field ruins, near the river
  SHELVES.push(ruin('wall_broken1', 500, 980, 44, 50, 96));
  SHELVES.push(ruin('wall_broken4', 780, 1010, 50, 55, 110));
  SHELVES.push(ruin('wall_broken2', 1180, 1000, 44, 50, 96));
  SHELVES.push(ruin('pillar_thin', 1400, 970, 26, 20, 118));
})();

// small non-solid landmark near the entrance: a lone pedestal
const SHRINE = { x: 920, y: 350, tile:'pedestal1', drawH: 70 };
const VASES = [
  { x: 700, y: 260, tile:'vase', drawH: 56 },
  { x: 1140, y: 260, tile:'vase', drawH: 56 },
];
const SIGN = { x: 555, y: 470, tile:'sign', drawH: 58 };

// candles double as the ruins' floating lights
const CANDLES = [
  { x: 750, y: 300 }, { x: 1090, y: 300 },
  { x: 260, y: 900 }, { x: WORLD.w-260, y: 900 },
];

// ground clutter (non-solid, purely decorative) — bushes & flowers
const CLUTTER = [];
(function buildClutter(){
  const bushes = ['bush1','bush2','bush3'];
  const flowers = ['flower1','flower2','flower3','flower4','flower5','flower6',
                    'flower_cluster1','flower_cluster2','flower_cluster3'];
  const spots = [
    [200,470],[1700,470],[260,650],[1640,650],[520,320],[1360,320],
    [820,400],[1020,400],[640,760],[1260,760],[380,1050],[1520,1050],
    [960,900],[300,200],[1600,200],[700,980],[1200,980],[980,620],
    [180,760],[1720,760],[460,880],[1440,880],[860,720],[1040,720],
  ];
  spots.forEach((s, i) => {
    const kind = (i % 3 === 0) ? bushes[i % bushes.length] : flowers[i % flowers.length];
    CLUTTER.push({ x: s[0], y: s[1], tile: kind, drawH: kind.startsWith('bush') ? 46 : 30 });
  });
})();

// border trees — decorative only, sit just outside/along the walkable area
const TREES = [];
(function buildTrees(){
  const kinds = ['tree_pink1','tree_teal1','tree_teal2','tree_purple','tree_blue','tree_magenta','tree_dead1','tree_dead2'];
  let k = 0;
  for (let x = 40; x < WORLD.w-40; x += 190){
    TREES.push({ x, y: 30, tile: kinds[k % kinds.length], drawH: 150 }); k++;
    TREES.push({ x, y: WORLD.h-40, tile: kinds[k % kinds.length], drawH: 150 }); k++;
  }
  for (let y = 220; y < WORLD.h-160; y += 210){
    TREES.push({ x: 20, y, tile: kinds[k % kinds.length], drawH: 150 }); k++;
    TREES.push({ x: WORLD.w-20, y, tile: kinds[k % kinds.length], drawH: 150 }); k++;
  }
})();

// river along the south edge, banked with the fenced ruin-stone tile
const RIVER_Y = WORLD.h - 46;

/* ---------------------------------------------------------------------
   3. ITEM DATABASE + INTERACTABLES
--------------------------------------------------------------------- */
const ITEM_DB = {
  espada_enferrujada: { name:'Espada Enferrujada', cat:'armas', icon:'⚔️',
    desc:'Uma lâmina tomada pela ferrugem. Ainda corta — se você tiver coragem de empunhá-la.' },
  adaga_bibliotecaria: { name:'Adaga do Bibliotecário', cat:'armas', icon:'🗡️',
    desc:'Curta e silenciosa. Usada para cortar páginas... ou algo mais.' },
  colete_couro: { name:'Colete de Couro', cat:'armaduras', icon:'🥋',
    desc:'Gasto pelo tempo, mas ainda protege o suficiente contra o pó e as sombras.' },
  manto_poeira: { name:'Manto Empoeirado', cat:'armaduras', icon:'🧥',
    desc:'Cheira a papel velho. Quem o usou por último parece ter desaparecido entre as colunas quebradas.' },
  vela_eterna: { name:'Vela Eterna', cat:'itens', icon:'🕯️',
    desc:'Nunca se apaga. Talvez ilumine caminhos que as ruínas preferem manter escondidos.',
    thought:'Essa chama não tremula... nem quando eu sopro.' },
  chave_antiga: { name:'Chave Antiga', cat:'itens', icon:'🗝️',
    desc:'Enferrujada e fria ao toque. Abre... alguma coisa. Você ainda não sabe o quê.',
    thought:'Fria demais pra ter ficado tanto tempo largada aí.' },
  pocao_tinta: { name:'Frasco de Tinta Viva', cat:'itens', icon:'🧪',
    desc:'A tinta se move sozinha dentro do vidro, como se ainda estivesse escrevendo algo.' },
  pergaminho: { name:'Pergaminho Rasgado', cat:'itens', icon:'📜',
    desc:'Um fragmento de mapa. Falta o resto — talvez em outra parte das ruínas.',
    thought:'Um mapa... rasgado bem onde eu mais precisava.' },
};

// Interaction points placed in the world
const INTERACTABLES = [
  { id:'ruin_a', x:260, y:290, r:60, type:'item', itemId:'espada_enferrujada',
    prompt:'entulho de pedra', found:false },
  { id:'ruin_b', x:640, y:190, r:60, type:'item', itemId:'colete_couro',
    prompt:'nicho na parede', found:false },
  { id:'ruin_c', x:1150, y:190, r:60, type:'item', itemId:'vela_eterna',
    prompt:'nicho na parede', found:false },
  { id:'ruin_left0', x:150, y:390, r:60, type:'item', itemId:'chave_antiga',
    prompt:'fresta na muralha', found:false },
  { id:'ruin_right0', x:WORLD.w-150, y:390, r:60, type:'item', itemId:'adaga_bibliotecaria',
    prompt:'fresta na muralha', found:false },
  { id:'ruin_right2', x:WORLD.w-260, y:940, r:60, type:'item', itemId:'pocao_tinta',
    prompt:'pedras cobertas de musgo', found:false },
  { id:'ruin_left2', x:540, y:940, r:60, type:'item', itemId:'manto_poeira',
    prompt:'pedras cobertas de musgo', found:false },
  { id:'shrine_scroll', x:920, y:350, r:70, type:'item', itemId:'pergaminho',
    prompt:'pedestal antigo', found:false },
  { id:'ghost', x:1300, y:650, r:80, type:'npc',
    prompt:'presença silenciosa',
    lines:[
      'Uma sombra entre as colunas quebradas se vira lentamente para você.',
      '"Ah... um visitante. Faz tanto tempo desde o último."',
      '"Estas ruínas guardam mais do que pedra. Guardam quem passou por aqui por último."',
      '"Siga entre as colunas. Talvez encontre o caminho de volta. Ou não."',
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
    itemGridEl.innerHTML = '<div class="item-grid-empty">nada aqui ainda…<br>explore as ruínas.</div>';
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
  x: WORLD.w/2, y: WORLD.h/2 + 400,
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

function tryMove(dx, dy){
  const x0 = Player.x, y0 = Player.y;
  // move X
  if (dx !== 0){
    Player.x += dx;
    const box = playerFootBox();
    for (const s of SHELVES){
      if (rectsOverlap(box, s)){
        Player.x -= dx;
        break;
      }
    }
    Player.x = Math.max(30, Math.min(WORLD.w-30, Player.x));
  }
  // move Y
  if (dy !== 0){
    Player.y += dy;
    const box = playerFootBox();
    for (const s of SHELVES){
      if (rectsOverlap(box, s)){
        Player.y -= dy;
        break;
      }
    }
    Player.y = Math.max(120, Math.min(WORLD.h-40, Player.y));
  }
  // return the distance ACTUALLY covered (0 if fully blocked by a shelf/wall) —
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
    // along a shelf diagonally can zero out the x-axis move while the sprite
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
  // walking into a shelf/wall now correctly freezes the walk cycle instead of
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
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// ground tile textures, cycled in a deterministic patchwork
const GROUND_KINDS = ['ground_purple','ground_magenta','ground_teal','ground_magenta2','ground_teal_pebble','ground_rubble'];
const GROUND_TILE = 96;

// simple hash so the patchwork looks organic but never changes frame to frame
function tileHash(gx, gy){
  const n = (gx*374761393 + gy*668265263) ^ (gx*3266489917);
  return Math.abs(n) % GROUND_KINDS.length;
}

// a loose stone path connecting the entrance to the lower field
function onPath(wx, wy){
  const cx = WORLD.w/2;
  if (Math.abs(wx - cx) < 90 && wy > 190 && wy < WORLD.h - 60) return true; // north-south spine
  if (wy > 560 && wy < 700 && wx > 700 && wx < WORLD.w - 700) return true; // east-west crossing
  return false;
}

function drawFloor(){
  const t0 = ASSETS.tileManifest['ground_purple'];
  const startGX = 0, startGY = 0;
  const cols = Math.ceil(WORLD.w / GROUND_TILE) + 1;
  const rows = Math.ceil(WORLD.h / GROUND_TILE) + 1;
  for (let gy = 0; gy < rows; gy++){
    for (let gx = 0; gx < cols; gx++){
      const wx = gx*GROUND_TILE, wy = gy*GROUND_TILE;
      const path = onPath(wx+GROUND_TILE/2, wy+GROUND_TILE/2);
      const kind = path ? 'ground_stone' : GROUND_KINDS[tileHash(gx,gy)];
      const t = ASSETS.tileManifest[kind];
      if (!t) continue;
      ctx.drawImage(ASSETS.tiles, t.x, t.y, t.w, t.h, wx, wy, GROUND_TILE, GROUND_TILE);
    }
  }
  // river along the south edge, banked with the fenced ruin-stone tile
  const rt = ASSETS.tileManifest['riverbank_fence'];
  if (rt){
    const bw = 120;
    for (let x = 0; x < WORLD.w; x += bw){
      ctx.drawImage(ASSETS.tiles, rt.x, rt.y, rt.w, rt.h, x, RIVER_Y, bw+2, WORLD.h - RIVER_Y);
    }
  }
  // soft vignette darkening toward the edges
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0,0,WORLD.w,40);
  ctx.globalAlpha = 1;
}

function drawCandle(c, t){
  const flicker = 0.7 + Math.sin(t*9 + c.x) * 0.15 + Math.sin(t*23+c.y)*0.08;
  ctx.save();
  ctx.translate(c.x, c.y);
  // holder
  ctx.fillStyle = '#2b2016';
  ctx.fillRect(-6, 10, 12, 8);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(-3, -6, 6, 18);
  // glow
  const grad = ctx.createRadialGradient(0,-10,2, 0,-10, 70*flicker);
  grad.addColorStop(0, `rgba(255,196,110,${0.55*flicker})`);
  grad.addColorStop(1, 'rgba(255,196,110,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0,-10,70*flicker,0,Math.PI*2); ctx.fill();
  // flame
  ctx.fillStyle = `rgba(255,${180+Math.floor(30*flicker)},90,0.95)`;
  ctx.beginPath();
  ctx.ellipse(0,-10,3.2,7*flicker,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawRuinPiece(s){
  // ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w/2, s.y + s.h, s.w*0.55, s.h*0.4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawTile(s.tile, s.x + s.w/2, s.y + s.h, s.drawH, { flip: s.flip });
}

function drawTreeDeco(t){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y+6, 22, 8, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawTile(t.tile, t.x, t.y, t.drawH);
}

function drawClutterPiece(c){
  drawTile(c.tile, c.x, c.y, c.drawH);
}

function drawLandmark(o){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y+4, 20, 7, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawTile(o.tile, o.x, o.y, o.drawH);
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
  CLUTTER.forEach(drawClutterPiece); // ground-level decoration, always beneath everything standing

  // z-sort: ruin pieces, trees, landmarks, candles and the player all sort by their foot y
  const drawables = [];
  SHELVES.forEach(s => drawables.push({ y: s.y+s.h, draw: () => drawRuinPiece(s) }));
  TREES.forEach(t => drawables.push({ y: t.y, draw: () => drawTreeDeco(t) }));
  VASES.forEach(v => drawables.push({ y: v.y, draw: () => drawLandmark(v) }));
  drawables.push({ y: SHRINE.y, draw: () => drawLandmark(SHRINE) });
  drawables.push({ y: SIGN.y, draw: () => drawLandmark(SIGN) });
  CANDLES.forEach(c => drawables.push({ y: c.y+40, draw: () => drawCandle(c, clock) }));
  drawables.push({ y: Player.y, draw: drawPlayer });

  drawables.sort((a,b)=> a.y - b.y);
  drawables.forEach(d => d.draw());

  INTERACTABLES.forEach(it => drawInteractPrompt(it, clock));

  ctx.restore();
}

/* ---------------------------------------------------------------------
   10. ZONE LABEL (simple)
--------------------------------------------------------------------- */
const zoneEl = document.getElementById('hud-zone');
function updateZoneLabel(){
  let label = 'Praça das Colunas';
  if (Player.x < 400) label = 'Muralha Oeste';
  else if (Player.x > WORLD.w - 400) label = 'Muralha Leste';
  else if (Player.y > 560 && Player.y < 760) label = 'Ruínas Centrais';
  else if (Player.y > WORLD.h - 260) label = 'Margem do Rio';
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
      showToast('Lost Ruins', 'explore as colunas quebradas e encontre o que foi perdido.');
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
    bootHint.textContent = 'erro ao carregar os arquivos das ruínas…';
    console.error(err);
    return;
  }
  bootScreen.classList.add('fade-out');
  setTimeout(()=> bootScreen.remove(), 900);
  setTimeout(() => enterChapterSelect(), 700);
})();

})();
