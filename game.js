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

const ASSETS = { atlas: null, manifest: null };

async function loadAssets(){
  setBoot(10, 'abrindo os arquivos antigos…');
  const manifestResp = await fetch('assets/sprites/player_manifest.json');
  ASSETS.manifest = await manifestResp.json();
  // os frames "left"/"right" do atlas saíram invertidos na exportação —
  // troca as duas entradas para que a personagem olhe para o lado certo.
  {
    const d = ASSETS.manifest.directions;
    const tmp = d.left;
    d.left = d.right;
    d.right = tmp;
  }
  setBoot(45, 'acendendo as velas…');

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = 'assets/sprites/player_atlas.png';
    ASSETS.atlas = img;
  });
  setBoot(85, 'organizando as estantes…');
  await new Promise(r => setTimeout(r, 220));
  setBoot(100, 'pronto.');
  await new Promise(r => setTimeout(r, 180));
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
   2. WORLD DEFINITION  (a lost library hall)
--------------------------------------------------------------------- */
const WORLD = { w: 1700, h: 1050 };

// Bookshelf obstacles: {x,y,w,h}
const SHELVES = [];
(function buildShelves(){
  // top wall shelves
  for (let i=0;i<6;i++){
    SHELVES.push({x: 90 + i*250, y: 70, w: 190, h: 70, id:'top'+i});
  }
  // left column of shelves (vertical row, forming aisles)
  for (let i=0;i<3;i++){
    SHELVES.push({x: 120, y: 260 + i*220, w: 70, h: 160, id:'left'+i});
  }
  // right column
  for (let i=0;i<3;i++){
    SHELVES.push({x: WORLD.w-190, y: 260 + i*220, w: 70, h: 160, id:'right'+i});
  }
  // center double-row island shelves
  for (let i=0;i<3;i++){
    SHELVES.push({x: 560 + i*270, y: 430, w: 160, h: 60, id:'mid'+i});
    SHELVES.push({x: 560 + i*270, y: 620, w: 160, h: 60, id:'mid2'+i});
  }
})();

// Decorative (non-solid) props
const RUGS = [
  {x: 700, y: 500, w: 340, h: 190}
];
const TABLES = [
  {x: 760, y: 540, w: 220, h: 90}
];
const CANDLES = [
  {x: 800, y: 545}, {x: 940, y: 545},
  {x: 200, y: 100}, {x: 1450, y: 100},
  {x: 200, y: WORLD.h-110}, {x: 1450, y: WORLD.h-110},
];

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
    desc:'Cheira a papel velho. Quem o usou por último parece ter desaparecido entre as estantes.' },
  vela_eterna: { name:'Vela Eterna', cat:'itens', icon:'🕯️',
    desc:'Nunca se apaga. Talvez ilumine caminhos que a biblioteca prefere manter escondidos.' },
  chave_antiga: { name:'Chave Antiga', cat:'itens', icon:'🗝️',
    desc:'Enferrujada e fria ao toque. Abre... alguma coisa. Você ainda não sabe o quê.' },
  pocao_tinta: { name:'Frasco de Tinta Viva', cat:'itens', icon:'🧪',
    desc:'A tinta se move sozinha dentro do vidro, como se ainda estivesse escrevendo algo.' },
  pergaminho: { name:'Pergaminho Rasgado', cat:'itens', icon:'📜',
    desc:'Um fragmento de mapa. Falta o resto — talvez em outra estante.' },
};

// Interaction points placed in the world
const INTERACTABLES = [
  { id:'shelf_a', x:185, y:105, r:60, type:'item', itemId:'espada_enferrujada',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_b', x:685, y:105, r:60, type:'item', itemId:'colete_couro',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_c', x:1185, y:105, r:60, type:'item', itemId:'vela_eterna',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_left0', x:155, y:340, r:60, type:'item', itemId:'chave_antiga',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_right0', x:WORLD.w-155, y:340, r:60, type:'item', itemId:'adaga_bibliotecaria',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_right2', x:WORLD.w-155, y:780, r:60, type:'item', itemId:'pocao_tinta',
    prompt:'estante empoeirada', found:false },
  { id:'shelf_left2', x:155, y:780, r:60, type:'item', itemId:'manto_poeira',
    prompt:'estante empoeirada', found:false },
  { id:'table_scroll', x:870, y:560, r:70, type:'item', itemId:'pergaminho',
    prompt:'mesa de leitura', found:false },
  { id:'ghost', x:1300, y:560, r:80, type:'npc',
    prompt:'presença silenciosa',
    lines:[
      'Uma sombra entre as estantes se vira lentamente para você.',
      '"Ah... um visitante. Faz tanto tempo desde o último."',
      '"Esta biblioteca guarda mais do que livros. Guarda quem os leu por último."',
      '"Procure entre as estantes. Talvez encontre o caminho de volta. Ou não."',
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
const dialogueText = document.getElementById('dialogue-text');
let dialogueState = { open:false, lines:[], idx:0 };
function openDialogue(lines){
  dialogueState = { open:true, lines, idx:0 };
  dialogueText.textContent = lines[0];
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
  if (dialogueState.open){ advanceDialogue(); return; }
  if (inventoryState.open){ return; } // selection already shows detail on tap
  // try interact with nearest interactable in range
  const target = getNearbyInteractable();
  if (!target) return;
  if (target.type === 'npc'){
    openDialogue(target.lines);
  } else if (target.type === 'item'){
    if (target.found){
      showToast(null, 'já não há nada mais aqui.');
      return;
    }
    target.found = true;
    addItemToInventory(target.itemId);
    const def = ITEM_DB[target.itemId];
    showToast('+ item encontrado', `${def.icon} ${def.name}`);
  }
}
function onCancel(){
  if (dialogueState.open){ closeDialogue(); return; }
  if (inventoryState.open){ closeInventory(); return; }
}
function onInventoryToggle(){
  if (dialogueState.open) return;
  if (inventoryState.open) closeInventory();
  else openInventory();
}

/* ---------------------------------------------------------------------
   7. PLAYER
--------------------------------------------------------------------- */
const Player = {
  x: WORLD.w/2, y: WORLD.h/2 + 250,
  w: 34, h: 20,          // collision box (feet area, small)
  speed: 190,
  dir: 'down',
  moving: false,
  animTime: 0,
  frameIdx: 0,
  frameDur: 0.11,
};

function playerFootBox(){
  return { x: Player.x - Player.w/2, y: Player.y - Player.h/2, w: Player.w, h: Player.h };
}

function rectsOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function tryMove(dx, dy){
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
  Player.moving = len > 0.05;
  if (Player.moving){
    mvx /= len; mvy /= len;
    // pick dominant direction for sprite
    if (Math.abs(mvx) > Math.abs(mvy)){
      Player.dir = mvx > 0 ? 'right' : 'left';
    } else {
      Player.dir = mvy > 0 ? 'down' : 'up';
    }
    tryMove(mvx * Player.speed * dt, mvy * Player.speed * dt);
  }

  // animation
  const dirData = ASSETS.manifest.directions[Player.dir];
  const frames = Player.moving ? dirData.walkFrames : [dirData.idleFrame];
  if (Player.moving){
    Player.animTime += dt;
    if (Player.animTime >= Player.frameDur){
      Player.animTime = 0;
      Player.frameIdx = (Player.frameIdx + 1) % frames.length;
    }
  } else {
    Player.frameIdx = 0;
    Player.animTime = 0;
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
  floorA:'#1b130c', floorB:'#221708', floorPlank:'#150e08',
  wallTop:'#0d0906',
  shelfWood:'#2c1c10', shelfWoodLight:'#4a2f18', shelfEdge:'#0e0904',
  bookColors:['#7f9a72','#a8503b','#8c6a2e','#5c7a8c','#9c7638','#6b4d2c'],
  rug:'#5c2c28', rugEdge:'#3a1c18',
  table:'#3a2716',
};

function drawFloor(){
  ctx.fillStyle = COLORS.floorA;
  ctx.fillRect(0,0,WORLD.w,WORLD.h);
  // plank lines
  ctx.strokeStyle = COLORS.floorPlank;
  ctx.lineWidth = 2;
  for (let x=0; x<WORLD.w; x+=64){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,WORLD.h); ctx.stroke();
  }
  for (let y=0; y<WORLD.h; y+=220){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(WORLD.w,y); ctx.stroke();
  }
  // subtle alternating tint
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = COLORS.floorB;
  for (let y=0; y<WORLD.h; y+=220){
    for (let x=0; x<WORLD.w; x+=128){
      if (((x/64)+(y/220))%2===0) ctx.fillRect(x,y,64,220);
    }
  }
  ctx.globalAlpha = 1;
}

function drawRug(r){
  ctx.fillStyle = COLORS.rugEdge;
  roundRect(r.x-6, r.y-6, r.w+12, r.h+12, 10); ctx.fill();
  ctx.fillStyle = COLORS.rug;
  roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(216,171,92,.25)';
  ctx.lineWidth = 3;
  roundRect(r.x+14, r.y+14, r.w-28, r.h-28, 6); ctx.stroke();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawShelf(s){
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(s.x+4, s.y+s.h-6, s.w, 12);
  // frame
  ctx.fillStyle = COLORS.shelfWood;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = COLORS.shelfEdge;
  ctx.fillRect(s.x, s.y, s.w, 6);
  ctx.fillRect(s.x, s.y+s.h-6, s.w, 6);
  // books (vertical stripes)
  const innerX = s.x+6, innerW = s.w-12, innerY = s.y+8, innerH = s.h-16;
  let bx = innerX;
  let i=0;
  while (bx < innerX+innerW-4){
    const bw = 8 + ((i*37)%10);
    if (bx+bw > innerX+innerW) break;
    ctx.fillStyle = COLORS.bookColors[i % COLORS.bookColors.length];
    ctx.fillRect(bx, innerY + (i%3), bw, innerH - (i%3)*2);
    bx += bw + 2;
    i++;
  }
  // glow ring if this shelf has an uncollected item nearby
  const linked = INTERACTABLES.find(it => it.type==='item' && !it.found &&
    Math.abs((it.x-30) - s.x) < 40 && Math.abs((it.y) - s.y) < 40);
}

function drawTable(t){
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(t.x+4, t.y+t.h-8, t.w, 10);
  ctx.fillStyle = COLORS.table;
  roundRect(t.x, t.y, t.w, t.h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(216,171,92,.2)';
  ctx.lineWidth = 2;
  roundRect(t.x, t.y, t.w, t.h, 6); ctx.stroke();
  // little book on table
  ctx.fillStyle = COLORS.bookColors[1];
  ctx.fillRect(t.x + t.w/2 - 22, t.y + 18, 30, 20);
  ctx.fillStyle = COLORS.bookColors[3];
  ctx.fillRect(t.x + t.w/2 - 4, t.y + 22, 26, 18);
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
  const dirData = ASSETS.manifest.directions[Player.dir];
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

  ctx.drawImage(
    ASSETS.atlas,
    f.x, f.y, f.w, f.h,
    dx, dy, drawW, drawH
  );
}

let clock = 0;
function render(){
  ctx.clearRect(0,0,VW,VH);
  ctx.save();
  ctx.translate(-Camera.x, -Camera.y);

  drawFloor();
  RUGS.forEach(drawRug);
  TABLES.forEach(drawTable);

  // z-sort: shelves (back), then interact prompts, candles, player, by y for simple depth
  const drawables = [];
  SHELVES.forEach(s => drawables.push({ y: s.y+s.h, draw: () => drawShelf(s) }));
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
  let label = 'Salão Principal';
  if (Player.x < 400) label = 'Ala Oeste';
  else if (Player.x > WORLD.w - 400) label = 'Ala Leste';
  else if (Player.y > 480 && Player.y < 700) label = 'Sala de Leitura';
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

  setTimeout(() => {
    showToast('Lost Library', 'explore as estantes e encontre o que foi perdido.');
  }, 900);

  requestAnimationFrame((t)=>{ lastT = t; requestAnimationFrame(loop); });
})();

})();
