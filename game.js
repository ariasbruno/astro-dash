// Platanus Hack 26 — Astro Dash
// Top-down 1v1 space combat dogfighter.
// Features: 8-way movement, meteor hazards, health orbs, energy bursts, Homing Missiles & Flares.

const W = 800, H = 600;
const STORAGE_KEY_SOLO = 'platanus-hack-26-astrodash-solo-v1';
const STORAGE_KEY_DUEL = 'platanus-hack-26-astrodash-duel-v1';
const POWS = { MISSILE: 'M', FLARE: 'F', SHIELD: 'S', RAPID: 'R' };
const COLORS = {
  bg: 0x05070a, p1: 0x00ff66, p2: 0xfacc15, debris: 0x444444, orb: 0x00ff88,
  white: 0xffffff, accent: 0xfacc15, stable: 0x4fb89a, cell: 0x111111, frame: 0x333333, overlay: 0x020408, 
  energy: 0xfacc15, dodge: 0x6366f1, missile: 0xff4422, flare: 0xffeeaa, shield: 0x00ccff, overdrive: 0xff00ff
};
const SHIP_COLORS = [0x00f2ff, 0xff00ea, 0xfbff00]; // Cyan, Magenta, Yellow


const c2s = (c) => '#' + c.toString(16).padStart(6, '0');

const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'],
  P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'],
  P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter'], START2: ['2']
};
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

const config = {
  type: Phaser.AUTO, width: W, height: H, parent: 'game-root', backgroundColor: '#05070a',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() {}

function create() {
  const s = this;
  s.state = { 
    phase: 'loading', mode: 'solo', scores: { p1: 0, p2: 0 }, highScoresSolo: [], highScoresDuel: [], menu: { cursor: 0, cd: 0 }, 
    nameEntry: { name: ['A','A','A'], idx: 0, cIdx: 0, winner: '', score: 0, cd: 0, timeStr: '' },
    spawnTimer: 0, orbTimer: 0, powTimer: 0, round: 1, showerCount: 0, nextRoundTime: 0, startTime: 0, 
    showerPending: false, isShowerActive: false 
  };

  // Parallax Layer 1: Infinite Moving Grid
  s.bgGrid = s.add.tileSprite(W/2, H/2, W, H, null);
  const gridG = s.add.graphics();
  gridG.lineStyle(1, COLORS.frame, 0.2);
  for (let x = 0; x <= 80; x += 40) gridG.lineBetween(x, 0, x, 40);
  for (let y = 0; y <= 80; y += 40) gridG.lineBetween(0, y, 40, y);
  const gridTex = gridG.generateTexture('grid', 40, 40);
  gridG.destroy();
  s.bgGrid.setTexture('grid').setAlpha(0.3).setDepth(-10);

  // Parallax Layer 2: Tech Dust
  s.dust = [];
  for (let i = 0; i < 40; i++) {
    const d = s.add.rectangle(Math.random()*W, Math.random()*H, 2, 2, 0x4fb89a, 0.3);
    s.dust.push({ obj: d, s: 0.2 + Math.random()*0.5 });
  }

  // Parallax Layer 3: Industrial Embers
  s.embers = [];
  for (let i = 0; i < 30; i++) {
    const e = s.add.circle(Math.random()*W, Math.random()*H, 1, 0xffaa00, 0.5);
    s.embers.push({ obj: e, s: 0.8 + Math.random()*1.2 });
  }

  s.ships = s.add.group(); s.bullets = s.add.group(); s.meteors = s.add.group(); 
  s.orbs = s.add.group(); s.powerups = s.add.group(); s.missiles = s.add.group(); s.flares = s.add.group();
  s.enemies = s.add.group();

  s.p1 = createShip(s, 150, H / 2, 'p1', COLORS.p1);
  s.p2 = createShip(s, W - 150, H / 2, 'p2', COLORS.p2);

  s.physics.add.overlap(s.bullets, s.ships, hitShip, null, s);
  s.physics.add.overlap(s.bullets, s.meteors, hitMeteor, null, s);
  s.physics.add.overlap(s.ships, s.meteors, crashShip, null, s);
  s.physics.add.overlap(s.ships, s.orbs, takeOrb, null, s);
  s.physics.add.overlap(s.ships, s.powerups, takePowerup, null, s);
  s.physics.add.overlap(s.missiles, s.ships, hitShipMissile, null, s);
  s.physics.add.overlap(s.missiles, s.meteors, hitMeteor, null, s);
  s.physics.add.overlap(s.missiles, s.flares, hitFlareMissile, null, s);
  s.physics.add.overlap(s.bullets, s.enemies, hitEnemy, null, s);
  s.physics.add.overlap(s.missiles, s.enemies, hitEnemyMissile, null, s);
  s.physics.add.overlap(s.ships, s.enemies, crashEnemy, null, s);
  s.physics.add.overlap(s.enemies, s.meteors, hitEnemyMeteor, null, s);

  initUi(s); initControls(s);
  s.add.container(0, 0).add(createScanlines(s)).setDepth(2000).setScrollFactor(0);
  loadHighScores().then(hs => { 
    s.state.highScoresSolo = hs.solo; 
    s.state.highScoresDuel = hs.duel; 
    showStartScreen(s);
  });
}

function createScanlines(s) {
  const g = s.add.graphics();
  g.lineStyle(1, 0x000000, 0.15);
  for (let y = 0; y < H; y += 3) g.lineBetween(0, y, W, y);
  
  // Vignette
  const v = s.add.graphics();
  v.fillStyle(0x000000, 0.4);
  v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.3, 0.3);
  return g;
}

function update(time, delta) {
  const s = this; const p = s.state.phase;
  if (p === 'start') handleStartMenu(s, time);
  else if (p === 'modeSelect') handleModeSelect(s, time);
  else if (p === 'leaderboard' || p === 'help') { if (consume(s, ['START1', 'START2', 'P1_1', 'P2_1'])) showStartScreen(s); }
  else if (p === 'test') { if (consume(s, ['START1', 'START2'])) showStartScreen(s); }
  else if (p === 'playing') { 
    updateShips(s, time, delta); updateMeteors(s, time); updateOrbs(s, time); updatePowerups(s, time); updateMissiles(s, time);
    updateRounds(s, time, delta);
    
    // Background Parallax
    s.bgGrid.tilePositionX += 0.2;
    s.bgGrid.tilePositionY += 0.1;
    s.dust.forEach(d => { d.obj.x -= d.s; if (d.obj.x < 0) d.obj.x = W; });
    s.embers.forEach(e => { e.obj.x -= e.s; if (e.obj.x < 0) e.obj.x = W; });

    s.bullets.children.each(b => { if(b && b.active && (b.x < 0 || b.x > W || b.y < 0 || b.y > H)) safeDestroy(b); });
    if (consume(s, ['START1', 'START2'])) pauseMatch(s); 
  }
  else if (p === 'paused') { if (consume(s, ['START1', 'START2'])) resumeMatch(s); }
  else if (p === 'gameover') { 
    if (consume(s, ['START1', 'START2', 'P1_1', 'P2_1'])) {
      if (s.state.mode === 'solo' && s.state.gameoverDone && s.state.isHS) showNameEntry(s, s.state.winId, s.state.score, s.state.timeStr);
      else if (s.state.gameoverDone) returnToStart(s);
    }
  }
  else if (p === 'nameEntry') handleNameEntry(s, time);
  if (p === 'test') updateTestScreen(s);
}

function createShip(s, x, y, id, color) {
  const c = s.add.container(x, y);
  const g = s.add.graphics();
  
  // Main Hull (Scaled Down Aggressive Design)
  g.lineStyle(2, color).beginPath()
    .moveTo(16, 0)      // Front tip
    .lineTo(4, 9)       // Top wing start
    .lineTo(-9, 10)     // Top wing end
    .lineTo(-6, 4)      // Tech notch
    .lineTo(-11, 4)     // Reactor base
    .lineTo(-11, -4)    // Reactor base
    .lineTo(-6, -4)     // Tech notch
    .lineTo(-9, -10)    // Bottom wing end
    .lineTo(4, -9)      // Bottom wing start
    .closePath().strokePath();

  // Cockpit & Interior Detailing
  g.lineStyle(1, color, 0.6).beginPath()
    .moveTo(7, 0).lineTo(0, 3).lineTo(-4, 0).lineTo(0, -3).closePath().strokePath();
  
  // Hull Reinforcement Lines
  g.lineStyle(1, color, 0.4);
  g.lineBetween(-1, 6, -6, 7);
  g.lineBetween(-1, -6, -6, -7);
  g.lineBetween(6, 2, 2, 2);
  g.lineBetween(6, -2, 2, -2);

  const reactor = s.add.graphics();
  const wingLights = s.add.graphics();
  const glow = s.add.graphics().fillStyle(color, 0.15).fillCircle(0, 0, 15);
  
  c.add([glow, reactor, wingLights, g]); s.physics.add.existing(c);
  c.body.setDrag(2000).setMaxVelocity(1200).setCircle(10, -10, -10).setCollideWorldBounds(true);
  
  c.setData({ id, hp: 100, energy: 100, lastFire: 0, lastDash: 0, boostUntil: 0, lastHit: 0, color, shipColor: COLORS.white, hasShield: false, dead: false, spType: null, spCount: 0, overdriveUntil: 0, overheated: false, mustRelease: false, reactor, wingLights });

  s.ships.add(c); return c;
}

function updateShips(s, time, delta) {
  const cfg = [{ ship: s.p1, enemy: s.p2, u: 'P1_U', d: 'P1_D', l: 'P1_L', r: 'P1_R', f1: 'P1_1', f2: 'P1_2', f3: 'P1_3', dL: 'P1_4', dR: 'P1_5', sp: 'P1_6' },
               { ship: s.p2, enemy: s.p1, u: 'P2_U', d: 'P2_D', l: 'P2_L', r: 'P2_R', f1: 'P2_1', f2: 'P2_2', f3: 'P2_3', dL: 'P2_4', dR: 'P2_5', sp: 'P2_6' }];
  cfg.forEach(p => {
    if (p.ship.getData('dead')) return;
    if (s.state.mode === 'solo' && p.ship.getData('id') === 'p2') return;
    const b = p.ship.body, curE = p.ship.getData('energy');
    
    const isSolo = s.state.mode === 'solo' && p.ship === s.p1;
    let vx = (held(s, p.r) || (isSolo && held(s, 'P2_R')) ? 1 : 0) - (held(s, p.l) || (isSolo && held(s, 'P2_L')) ? 1 : 0);
    let vy = (held(s, p.d) || (isSolo && held(s, 'P2_D')) ? 1 : 0) - (held(s, p.u) || (isSolo && held(s, 'P2_U')) ? 1 : 0);
    const speed = b.speed;
    if (vx !== 0 || vy !== 0) {
      const a = Math.atan2(vy, vx); 
      p.ship.rotation = a; 
      if (speed < 400) s.physics.velocityFromRotation(a, 320, b.velocity);
      if (time % 60 < 20) spawnTrail(s, p.ship);
    }
    
    // Color Fire Logic (Buttons 1, 2, 3)
    const fs = isSolo ? [p.f1, p.f2, p.f3, 'P2_1', 'P2_2', 'P2_3'] : [p.f1, p.f2, p.f3];
    const isOverdrive = time < p.ship.getData('overdriveUntil');
    const isFiring = fs.some(k => held(s, k)), isOverheated = p.ship.getData('overheated');
    const mustRelease = p.ship.getData('mustRelease');

    if (!isFiring) p.ship.setData('mustRelease', false);

    let actuallyFired = false;
    if (isFiring && !isOverheated && !mustRelease) {
      fs.forEach((fKey, i) => {
        if (held(s, fKey)) {
          p.ship.setData('shipColor', SHIP_COLORS[i % 3]);
          if (time > p.ship.getData('lastFire') && (isOverdrive || curE >= 12)) {
            fireBullet(s, p.ship); p.ship.setData('lastFire', time + 140); 
            if (!isOverdrive) p.ship.setData('energy', Math.max(0, curE - 12));
            actuallyFired = true;
          }
        }
      });
    }

    if (!actuallyFired) {
      p.ship.setData('energy', Math.min(100, curE + delta * 0.045));
    }

    if (!isOverdrive && curE < 12 && isFiring && !isOverheated) {
      p.ship.setData({ overheated: true, mustRelease: true }); playSfx(s, 'hit');
    }
    if (curE >= 50) p.ship.setData('overheated', false);

    // Boost Logic (Button 4)
    const boostTriggered = consume(s, isSolo ? [p.dL, 'P2_4'] : [p.dL]);
    if (boostTriggered && time > p.ship.getData('lastDash')) {
      s.physics.velocityFromRotation(p.ship.rotation, 1200, b.velocity);
      p.ship.setData('lastDash', time + 3000); 
      p.ship.setData('boostUntil', time + 200);
      playSfx(s, 'dash'); explode(s, p.ship.x, p.ship.y, COLORS.dodge, 4);
    }
    
    // Special / Shield Logic (Button 6)
    if (consume(s, isSolo ? [p.sp, 'P2_6'] : [p.sp])) {
      const type = p.ship.getData('spType');
      if (type === POWS.SHIELD) {
        p.ship.setData({ hasShield: true, spType: null, spCount: 0 });
        playSfx(s, 'orb');
      } else {
        fireSpecial(s, p.ship, p.enemy);
      }
    }
    updateHud(s, p.ship, time);
    updateShipVisuals(p.ship);
    if (p.ship.getData('hasShield')) drawShield(s, p.ship);
  });
}

function updateShipVisuals(ship) {
  const hp = ship.getData('hp'), en = ship.getData('energy'), oh = ship.getData('overheated');
  const reactor = ship.getData('reactor'), wingLights = ship.getData('wingLights');
  const isDead = ship.getData('dead');
  if (isDead) return;

  // 1. Update Reactor (Energy/Ammo)
  const enPct = en / 100;
  const rSize = 2 + enPct * 4;
  const lowCol = { r: 255, g: 68, b: 0 };    // 0xff4400
  const highCol = { r: 0, g: 204, b: 255 };  // 0x00ccff
  
  let rCol;
  if (oh) {
    rCol = (Math.floor(Date.now() / 50) % 2 === 0) ? 0xff0000 : 0x330000;
  } else {
    const r = Math.floor(lowCol.r + (highCol.r - lowCol.r) * enPct);
    const g = Math.floor(lowCol.g + (highCol.g - lowCol.g) * enPct);
    const b = Math.floor(lowCol.b + (highCol.b - lowCol.b) * enPct);
    rCol = (r << 16) | (g << 8) | b;
  }

  reactor.clear();
  reactor.fillStyle(rCol, 0.8).fillCircle(-10, 0, rSize);
  if (enPct > 0.8 || oh) {
    reactor.lineStyle(1, 0xffffff, 0.5).strokeCircle(-10, 0, rSize + 2);
  }

  // 2. Update Wing Lights (Health)
  wingLights.clear();
  const hpSegments = hp > 66 ? 3 : (hp > 33 ? 2 : (hp > 0 ? 1 : 0));
  const isCritical = hp < 20;
  const flash = isCritical && (Math.floor(Date.now() / 200) % 2 === 0);
  
  const drawWing = (side) => {
    const yMult = side === 'top' ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const active = i < hpSegments;
      let col = ship.getData('color');
      let alpha = 0.8;
      
      if (!active) {
        col = 0x333333; alpha = 0.3;
      } else if (i === 0 && isCritical) {
        col = flash ? 0xff0000 : 0x440000;
      }

      // Positioning segments along the wing trailing edge
      // Wing line is roughly from (4, 9) to (-9, 10)
      const x = 2 - i * 4;
      const y = (9 + i * 0.5) * yMult;
      wingLights.fillStyle(col, alpha).fillRect(x, y - 1, 3, 2);
    }
  };
  drawWing('top');
  drawWing('bottom');

  if (oh) {
    ship.setAlpha(0.6 + Math.sin(Date.now()/100) * 0.3);
  } else {
    ship.setAlpha(1);
  }
}


function fireBullet(s, ship) {
  const x = ship.x + Math.cos(ship.rotation)*22, y = ship.y + Math.sin(ship.rotation)*22;
  const b = s.add.container(x, y); b.add(s.add.circle(0, 0, 3, ship.getData('shipColor') || ship.getData('color')));
  s.physics.add.existing(b); b.body.setCircle(3, -3, -3).setVelocity(Math.cos(ship.rotation)*1000, Math.sin(ship.rotation)*1000);
  b.setData({ owner: ship.getData('id'), color: ship.getData('shipColor') || ship.getData('color') }); 
  s.bullets.add(b); playSfx(s, 'pew');
}

function fireSpecial(s, ship, enemy) {
  const type = ship.getData('spType'), count = ship.getData('spCount');
  if (!type || count <= 0) return;
  if (type === POWS.MISSILE) {
    const mis = s.add.container(ship.x, ship.y); mis.rotation = ship.rotation;
    mis.add([s.add.graphics().lineStyle(2, COLORS.missile).strokeTriangle(10, 0, -5, 5, -5, -5), s.add.graphics().fillStyle(COLORS.missile, 0.3).fillCircle(-2,0,8)]);
    s.physics.add.existing(mis); mis.body.setCircle(8, -8, -8).setVelocity(Math.cos(ship.rotation)*400, Math.sin(ship.rotation)*400);
    mis.setData({ owner: ship.getData('id'), target: enemy, expiry: s.time.now + 5000 }); s.missiles.add(mis);
    playSfx(s, 'dash');
  } else if (type === POWS.FLARE) {
    for (let i = 0; i < 5; i++) {
      const fl = s.add.circle(ship.x, ship.y, 4, COLORS.flare); s.physics.add.existing(fl);
      fl.body.setVelocity((Math.random()-0.5)*400, (Math.random()-0.5)*400).setDrag(200);
      s.flares.add(fl); s.time.delayedCall(2000 + Math.random()*1000, () => safeDestroy(fl));
    }
    playSfx(s, 'hit');
  }
  const next = count - 1; ship.setData({ spCount: next, spType: next <= 0 ? null : type });
}

function updateMissiles(s, time) {
  s.missiles.children.each(m => {
    if (!m || !m.active || !m.body) return;
    if (time > m.getData('expiry')) { explode(s, m.x, m.y, COLORS.missile, 15); playSfx(s, 'hit'); safeDestroy(m); return; }
    
    const ownerId = m.getData('owner');
    let target = null;
    let minDist = Infinity;

    // Scan for nearest active threat (Opponent ships or Interceptors)
    s.ships.children.each(ship => {
      if (ship.active && !ship.getData('dead') && ship.getData('id') !== ownerId) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, ship.x, ship.y);
        if (d < minDist) { minDist = d; target = ship; }
      }
    });

    s.enemies.children.each(enemy => {
      if (enemy.active && !enemy.getData('dead') && enemy.getData('id') !== ownerId) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, enemy.x, enemy.y);
        if (d < minDist) { minDist = d; target = enemy; }
      }
    });

    // Check for flare distractions
    s.flares.children.each(f => { 
      if (f && f.active && Phaser.Math.Distance.Between(m.x, m.y, f.x, f.y) < 350) target = f; 
    });

    if (!target) return;

    const angle = Phaser.Math.Angle.Between(m.x, m.y, target.x, target.y);
    const turnRate = m.getData('turnRate') || 0.1;
    m.rotation = Phaser.Math.Angle.RotateTo(m.rotation, angle, turnRate);
    const speed = m.getData('speed') || 450;
    const vx = Math.cos(m.rotation) * speed, vy = Math.sin(m.rotation) * speed;
    m.body.setVelocity(vx, vy);
    
    if (time % 100 < 20) {
      const p = s.add.circle(m.x, m.y, 2, COLORS.missile, 0.5);
      s.tweens.add({ targets: p, alpha: 0, scale: 2, duration: 400, onComplete: () => p.destroy() });
    }
  });
}

function drawPowerupIcon(g, type, color, sz) {
  g.clear();
  g.lineStyle(2, color).fillStyle(color, 0.2);
  if (type === POWS.MISSILE) {
    g.beginPath().moveTo(0, -sz).lineTo(sz*0.8, sz).lineTo(0, sz*0.5).lineTo(-sz*0.8, sz).closePath().fillPath().strokePath();
    g.lineStyle(1, 0xffffff, 0.5).strokeCircle(0, 0, sz * 0.4);
  } else if (type === POWS.FLARE) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.lineBetween(0, 0, Math.cos(a)*sz, Math.sin(a)*sz);
    }
    g.strokeCircle(0, 0, sz * 0.5);
  } else if (type === POWS.SHIELD) {
    const pts = []; for(let i=0; i<8; i++) { const a = i * Math.PI/4; pts.push({x: Math.cos(a)*sz, y: Math.sin(a)*sz}); }
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.forEach(p => g.lineTo(p.x, p.y)); g.closePath().fillPath().strokePath();
    g.lineStyle(1, color, 0.4).strokeCircle(0, 0, sz * 0.6);
  } else if (type === POWS.RAPID) {
    g.beginPath().moveTo(-sz/2, -sz).lineTo(sz/2, -sz/4).lineTo(0, 0).lineTo(sz/2, sz).lineTo(-sz/2, sz/4).lineTo(0, 0).closePath().fillPath().strokePath();
  } else { // REPAIR (+)
    const r = sz*0.4;
    g.lineStyle(2, color).strokeRoundedRect(-sz, -r, sz*2, r*2, 2).strokeRoundedRect(-r, -sz, r*2, sz*2, 2).fillRoundedRect(-sz, -r, sz*2, r*2, 2).fillRoundedRect(-r, -sz, r*2, sz*2, 2);
  }
}

function spawnPowerup(s) {
  const r = Math.random();
  const type = r < 0.25 ? POWS.MISSILE : (r < 0.5 ? POWS.FLARE : (r < 0.75 ? POWS.SHIELD : POWS.RAPID));
  const x = 100 + Math.random()*(W-200), y = 100 + Math.random()*(H-200);
  const c = s.add.container(x, y);
  let color = COLORS.missile;
  if (type === POWS.FLARE) color = COLORS.flare;
  if (type === POWS.SHIELD) color = COLORS.shield;
  if (type === POWS.RAPID) color = COLORS.overdrive;
  
  const g = s.add.graphics(); drawPowerupIcon(g, type, color, 12);
  const glow = s.add.graphics().fillStyle(color, 0.1).fillCircle(0, 0, 20);
  c.add([glow, g]);
  s.physics.add.existing(c); 
  c.body.setCircle(15, -15, -15);
  c.body.setAngularVelocity(100); 
  c.setData('type', type); s.powerups.add(c);
  s.time.delayedCall(10000, () => { if(c.active) safeDestroy(c); });
}


function updatePowerups(s, time) { if (time > s.state.powTimer) { spawnPowerup(s); s.state.powTimer = time + 15000 + Math.random()*10000; } }

function takePowerup(ship, pow) {
  if (!pow.active || ship.getData('dead')) return;
  const type = pow.getData('type');
  if (type === POWS.RAPID) {
    ship.setData('overdriveUntil', this.time.now + 8000);
  } else {
    ship.setData({ spType: type, spCount: type === POWS.MISSILE ? 3 : (type === POWS.FLARE ? 5 : 1) });
  }
  addPoints(this, ship.getData('id'), 25, pow.x, pow.y);
  safeDestroy(pow); playSfx(this, 'orb');
}


function spawnMeteor(s, x, y, size = 40, color = COLORS.debris) {
  if (x === undefined) {
    let valid = false, tries = 0;
    while(!valid && tries < 10) {
      const edge = Math.floor(Math.random()*4);
      x = edge < 2 ? (edge === 0 ? -50 : W + 50) : Math.random()*W;
      y = edge < 2 ? Math.random()*H : (edge === 2 ? -50 : H + 50);
      let tooClose = false; s.ships.children.iterate(ship => { if(Phaser.Math.Distance.Between(x, y, ship.x, ship.y) < 180) tooClose = true; });
      if(!tooClose) valid = true; tries++;
    }
  }
  const g = s.add.graphics().lineStyle(2, color); g.beginPath();
  const pts = 5 + Math.floor(Math.random()*4);
  for (let i = 0; i <= pts; i++) {
    const a = (i/pts)*Math.PI*2, r = size*(0.6+Math.random()*0.6);
    if (i === 0) g.moveTo(Math.cos(a)*r, Math.sin(a)*r); else g.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  const m = s.add.container(x, y, [g.closePath().strokePath()]);
  const hitboxScale = size >= 20 ? 0.85 : 0.7;
  s.physics.add.existing(m);  const speedMult = 1 + Math.floor((s.state.round - 1) / 5) * 0.25;
  m.body.setCircle(size*hitboxScale, -size*hitboxScale, -size*hitboxScale).setVelocity((Math.random()-0.5)*120 * speedMult, (Math.random()-0.5)*120 * speedMult).setAngularVelocity((Math.random()-0.5)*100);
  m.setData({ size, color }); s.meteors.add(m);
  return m;
}


function updateMeteors(s, time) {
  if (s.state.showerPending) {
    if (!s.hud.clearMsg) {
      s.hud.clearMsg = s.add.text(W/2, H - 50, '>>> ALERT: CLEAR SECTOR OF ALL REMAINING HAZARDS <<<', { font: 'bold 20px monospace', fill: '#ff4400' }).setOrigin(0.5).setDepth(300);
      s.tweens.add({ targets: s.hud.clearMsg, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    }
    let hasBig = false;
    s.meteors.getChildren().forEach(m => { if(m && m.active && m.getData('size') > 25) hasBig = true; });
    if (!hasBig) {
      if (s.hud.clearMsg) { s.hud.clearMsg.destroy(); s.hud.clearMsg = null; }
      s.state.showerPending = false; s.state.isShowerActive = true; s.state.showerCount++;
      const msg = s.add.text(W/2, H/2 - 100, '!!! METEOR SHOWER !!!', { font: 'bold 36px monospace', fill: '#ff0' }).setOrigin(0.5).setDepth(300);
      s.time.delayedCall(2000, () => msg.destroy());
    }
  }

  const timeRemainingInRound = s.state.nextRoundTime - time;
  const isSpawningPhase = timeRemainingInRound > 12500;

  const speedMult = 1 + Math.floor((s.state.round - 1) / 5) * 0.25;
  if (time > s.state.spawnTimer) { 
    if (s.state.isShowerActive) {
      const poolSize = Math.min(4, Math.floor((s.state.showerCount - 1) / 2) + 1);
      const spawnDirIndex = Math.floor(time / 2000) % poolSize;
      updateShowerAlert(s, time, poolSize);
      
      let x, y, vx, vy;
      if (spawnDirIndex === 0) { // Right to Left
        x = W + 60; y = Math.random()*H; vx = -(400 + Math.random()*150) * speedMult; vy = (Math.random()-0.5)*80 * speedMult;
      } else if (spawnDirIndex === 1) { // Top to Bottom
        x = Math.random()*W; y = -60; vx = (Math.random()-0.5)*80 * speedMult; vy = (400 + Math.random()*150) * speedMult;
      } else if (spawnDirIndex === 2) { // Left to Right
        x = -60; y = Math.random()*H; vx = (400 + Math.random()*150) * speedMult; vy = (Math.random()-0.5)*80 * speedMult;
      } else { // Bottom to Top
        x = Math.random()*W; y = H + 60; vx = (Math.random()-0.5)*80 * speedMult; vy = -(400 + Math.random()*150) * speedMult;
      }
      const m = spawnMeteor(s, x, y, 15 + Math.random()*15);
      if (m) m.setData('isShower', true);
      if (m && m.body) m.body.setVelocity(vx, vy);
      s.state.spawnTimer = time + 160;
    } else {
      if (s.hud.showerAlert) s.hud.showerAlert.clear();
      if (!s.state.showerPending && isSpawningPhase) {
        const numAdditionalColors = Math.min(3, Math.max(0, s.state.round - 1));
        const available = [COLORS.white];
        for (let i = 0; i < numAdditionalColors; i++) available.push(SHIP_COLORS[i]);
        const color = available[Math.floor(Math.random() * available.length)];
        spawnMeteor(s, undefined, undefined, 40, color); 
        const capped = Math.min(4, s.state.round);
        const delay = Math.max(400, 2500 - (capped * 400));
        s.state.spawnTimer = time + delay; 
      }
    }
  }

  s.meteors.getChildren().forEach(m => { 
    if(m && m.active && (m.x < -100 || m.x > W + 100 || m.y < -100 || m.y > H + 100)) {
      if (!s.state.showerPending && !s.state.isShowerActive && !m.getData('isShower')) {
        s.physics.world.wrap(m, 60);
      } else {
        m.destroy();
      }
    }
  });
}


function spawnOrb(s) {
  const x = 100 + Math.random()*(W-200), y = 100 + Math.random()*(H-200);
  const c = s.add.container(x, y);
  const g = s.add.graphics(); drawPowerupIcon(g, '+', COLORS.orb, 10);
  const glow = s.add.graphics().fillStyle(COLORS.orb, 0.15).fillCircle(0, 0, 20);
  c.add([glow, g]); s.physics.add.existing(c); 
  c.body.setCircle(15, -15, -15);
  s.orbs.add(c);
  s.tweens.add({ targets: c, scale: 1.2, duration: 800, yoyo: true, repeat: -1 });
  s.time.delayedCall(8000, () => { if(c.active) safeDestroy(c); });
}

function updateOrbs(s, time) { if (time > s.state.orbTimer) { spawnOrb(s); s.state.orbTimer = time + 12000 + Math.random()*8000; } }

function spawnBoss(s) {
  const startY = 100 + Math.random() * (H - 200);
  const boss = s.add.container(-150, startY);
  const g = s.add.graphics();
  
  const nRed = 0xff3344, nOrng = 0xffaa00, nDarkRed = 0x880011, dBody = 0x050505;
  
  // V-Wings (Detailed layers)
  g.lineStyle(2, nRed).fillStyle(dBody);
  g.beginPath().moveTo(100, 40).lineTo(0, -30).lineTo(40, 15).lineTo(90, 45).closePath().fillPath().strokePath();
  g.beginPath().moveTo(100, 60).lineTo(0, 130).lineTo(40, 85).lineTo(90, 55).closePath().fillPath().strokePath();
  
  // Wing Ribs
  g.lineStyle(1, nRed, 0.4);
  for(let i=1; i<4; i++) {
    g.beginPath().moveTo(12*i, -30+22*i).lineTo(25*i, -5+18*i).strokePath();
    g.beginPath().moveTo(12*i, 130-22*i).lineTo(25*i, 105-18*i).strokePath();
  }

  // Central Hull & Brackets
  g.lineStyle(2, nRed).fillStyle(dBody);
  g.beginPath().moveTo(160, 50).lineTo(80, 20).lineTo(50, 50).lineTo(80, 80).closePath().fillPath().strokePath();
  
  g.lineStyle(1, nRed, 0.4);
  g.beginPath().moveTo(150, 30).lineTo(175, 30).lineTo(175, 45).strokePath();
  g.beginPath().moveTo(150, 70).lineTo(175, 70).lineTo(175, 55).strokePath();
  
  // Circuitry & Indicators
  g.lineStyle(1, nOrng);
  g.beginPath().moveTo(40, 25).lineTo(80, 40).strokePath();
  g.beginPath().moveTo(40, 75).lineTo(80, 60).strokePath();
  
  const drawT = (x, y, sz) => {
    g.fillStyle(nOrng).beginPath().moveTo(x, y-sz).lineTo(x+sz, y+sz).lineTo(x-sz, y+sz).closePath().fill();
  };
  [[15,-15],[15,115],[125,35],[125,65],[60,50]].forEach(p => drawT(p[0], p[1], 3));
  
  // Glowing Components
  const eng = s.add.circle(40, 50, 20, nRed, 0.2);
  s.tweens.add({ targets: eng, scale: 2.5, alpha: 0, duration: 800, repeat: -1 });
  
  const eye = s.add.rectangle(110, 50, 25, 4, nRed, 0.7);
  s.tweens.add({ targets: eye, alpha: 0.2, duration: 200, yoyo: true, repeat: -1 });
  
  boss.add([eng, g, eye]);
  s.physics.add.existing(boss);
  boss.body.setCircle(65, 22, -15);
  const bossHp = 150 + Math.floor((s.state.round - 3) / 3) * 50;
  boss.setData({ id: 'boss', hp: bossHp, dead: false });
  s.enemies.add(boss);
  
  // Life: Engine Trail, Side Thrusters & Critical Damage
  s.time.addEvent({ delay: 50, loop: true, callback: () => {
    if (!boss.active || boss.getData('dead')) return;
    const vy = boss.body.velocity.y, hp = boss.getData('hp');
    
    // Main Trail
    const t = s.add.circle(boss.x + 20, boss.y + 50 + (Math.random()-0.5)*20, 4 + Math.random()*8, nRed, 0.4);
    s.tweens.add({ targets: t, x: boss.x - 100, alpha: 0, scale: 0.1, duration: 400, onComplete: () => t.destroy() });

    // Side thrusters for vertical movement
    if (Math.abs(vy) > 20) {
      const py = vy > 0 ? -30 : 130; 
      const st = s.add.circle(boss.x + 30, boss.y + py, 3 + Math.random()*3, 0x00ccff, 0.6);
      s.tweens.add({ targets: st, x: boss.x - 20, alpha: 0, duration: 200, onComplete: () => st.destroy() });
    }

    // Critical sparks
    if (hp < 30 && Math.random() > 0.7) {
      explode(s, boss.x + Math.random()*150, boss.y + Math.random()*100, 0xffaa00, 2);
    }
  }});

  // Life: Dynamic tilt based on Y velocity
  s.time.addEvent({ delay: 16, loop: true, callback: () => {
    if (!boss.active || boss.getData('dead') || boss.getData('tilting')) return;
    const vy = boss.body.velocity.y;
    boss.rotation = Phaser.Math.Angle.RotateTo(boss.rotation, vy * 0.001, 0.02);
  }});

  // Flicker effect & Burst Attack
  s.time.addEvent({ delay: 50, loop: true, callback: () => { 
    if(!boss.active) return;
    boss.alpha = Math.random() > 0.95 ? 0.6 : 1; 
  }});

  s.time.addEvent({ delay: 2500, loop: true, callback: () => {
    if (!boss.active || boss.getData('dead') || s.state.phase !== 'playing') return;
    const dist = Phaser.Math.Distance.Between(boss.x + 80, boss.y + 50, s.p1.x, s.p1.y);
    if (dist < 450) {
      for (let i = 0; i < 3; i++) {
        s.time.delayedCall(i * 120, () => {
          if (!boss.active || boss.getData('dead')) return;
          const b = s.add.circle(boss.x + 160, boss.y + 50, 4, nRed);
          s.physics.add.existing(b);
          const angle = Phaser.Math.Angle.Between(boss.x + 160, boss.y + 50, s.p1.x, s.p1.y);
          s.physics.velocityFromRotation(angle, 550, b.body.velocity);
          b.setData({ owner: 'boss', color: nRed });
          s.bullets.add(b); playSfx(s, 'pew');
        });
      }
    }
  }});

  const tx = s.tweens.add({ targets: boss, x: W + 200, duration: 6000, ease: 'Linear', onComplete: () => { if(boss.active) boss.destroy(); } });
  const ty = s.tweens.add({ targets: boss, y: startY + 120, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  boss.setData('tweens', [tx, ty]);

  const missileCount = s.state.round / 3;
  const duration = 5000;
  const windowStart = 800; 
  const windowEnd = 4200;
  const step = (windowEnd - windowStart) / Math.max(1, missileCount);

  for (let i = 0; i < missileCount; i++) {
    const delay = windowStart + (i * step) + (Math.random() * step * 0.8);
    s.time.delayedCall(Math.min(delay, duration - 500), () => {
      if (boss && boss.active && s.state.phase === 'playing') fireBossMissile(s, boss);
    });
  }

  const alert = s.add.text(W/2, 100, '!!! ENEMY INTERCEPTOR !!!', { font: 'bold 24px monospace', fill: '#f33' }).setOrigin(0.5).setDepth(500);
  s.time.delayedCall(2000, () => alert.destroy());
  playSfx(s, 'dash');
}

function fireBossMissile(s, boss) {
  if (!s.p1 || !s.p1.active) return;
  const mis = s.add.container(boss.x, boss.y + 50);
  mis.add(s.add.circle(0, 0, 8, COLORS.missile));
  s.physics.add.existing(mis); 
  if (mis.body) {
    mis.body.setCircle(8, -8, -8).setVelocity(350, 0);
    mis.setData({ owner: 'boss', target: s.p1, expiry: s.time.now + 8000, speed: 350, turnRate: 0.06 });
    s.missiles.add(mis); 
    playSfx(s, 'dash');
  }
}

function takeOrb(ship, orb) { 
  if (!orb.active || ship.getData('dead')) return; 
  ship.setData('hp', Math.min(100, ship.getData('hp') + 25)); 
  addPoints(this, ship.getData('id'), 25, orb.x, orb.y);
  safeDestroy(orb); playSfx(this, 'orb'); 
}

function hitFlareMissile(mis, fl) {
  explode(this, mis.x, mis.y, COLORS.missile, 12);
  playSfx(this, 'hit');
  safeDestroy(mis);
  safeDestroy(fl);
}

function safeDestroy(obj) {
  if (!obj || !obj.active) return;
  if (obj.body) { obj.body.enable = false; obj.body.setVelocity(0); }
  obj.setPosition(-2000, -2000); obj.active = false; obj.destroy();
}

function hitShip(bullet, ship) { 
  if (!bullet.active || bullet.getData('owner') === ship.getData('id')) return; 
  addPoints(this, bullet.getData('owner'), 100, bullet.x, bullet.y);
  safeDestroy(bullet); dmgShip(this, ship, 10); explode(this, bullet.x, bullet.y, ship.getData('color'), 5); 
}
function hitShipMissile(missile, ship) { 
  if (!missile.active || missile.getData('owner') === ship.getData('id')) return; 
  const owner = missile.getData('owner');
  if (owner === 'p1' || owner === 'p2') addPoints(this, owner, 250, missile.x, missile.y);
  safeDestroy(missile); dmgShip(this, ship, 30); explode(this, missile.x, missile.y, COLORS.missile, 15); 
}

function hitEnemy(bullet, enemy) {
  if (!bullet.active || bullet.getData('owner') === 'boss') return;
  const owner = bullet.getData('owner');
  safeDestroy(bullet);
  dmgEnemy(this, enemy, 10, owner);
  explode(this, bullet.x, bullet.y, 0xff3344, 5);
}

function hitEnemyMissile(missile, enemy) {
  if (!missile.active || missile.getData('owner') === 'boss') return;
  const owner = missile.getData('owner');
  safeDestroy(missile);
  dmgEnemy(this, enemy, 30, owner);
  explode(this, missile.x, missile.y, COLORS.missile, 15);
}

function hitEnemyMeteor(enemy, meteor) {
  if (!meteor.active || enemy.getData('dead')) return;
  explode(this, meteor.x, meteor.y, meteor.getData('color') || COLORS.debris, 5);
  safeDestroy(meteor);
  playSfx(this, 'hit');
}

function dmgEnemy(s, enemy, amt, owner) {
  if (enemy.getData('dead')) return;
  const hp = enemy.getData('hp') - amt;
  enemy.setData('hp', hp);
  
  // Flash & Shake effect
  enemy.setAlpha(0.5);
  const shakeX = (Math.random()-0.5)*10, shakeY = (Math.random()-0.5)*10;
  enemy.x += shakeX; enemy.y += shakeY;

  // Aggressive Tilt Dodge on heavy hit
  if (amt >= 30) {
    const side = Math.random() > 0.5 ? 1 : -1;
    enemy.setData('tilting', true);
    s.tweens.add({ 
      targets: enemy, 
      angle: 35 * side, 
      duration: 150, 
      yoyo: true, 
      ease: 'Quad.easeOut',
      onComplete: () => { if(enemy.active) enemy.setData('tilting', false); }
    });
  }
  s.time.delayedCall(50, () => { 
    if(enemy.active) {
      enemy.setAlpha(1); 
      enemy.x -= shakeX; enemy.y -= shakeY;
    }
  });
  playSfx(s, 'hit');

  if (hp <= 0) {
    enemy.setData('dead', true);
    const { x, y } = enemy;
    const tweens = enemy.getData('tweens');
    if (tweens) tweens.forEach(t => t.stop());
    
    addPoints(s, owner, 1000, x + 80, y + 50);
    spectacularExplosion(s, x + 80, y + 50, 0xff3344);
    enemy.destroy();
  }
}

function hitMeteor(bullet, meteor) {
  if (!meteor.active || (bullet && !bullet.active)) return;
  if (bullet && bullet.getData('color') === meteor.getData('color')) return;
  const s = this;
  if (bullet) {
    const sz = meteor.getData('size');
    const pts = sz >= 40 ? 50 : (sz >= 20 ? 150 : 300);
    addPoints(s, bullet.getData('owner'), pts, meteor.x, meteor.y);
    safeDestroy(bullet);
  }
  const sz = meteor.getData('size');
  explode(s, meteor.x, meteor.y, COLORS.debris, sz/8);
  if (sz > 18) { spawnMeteor(s, meteor.x, meteor.y, sz/2); spawnMeteor(s, meteor.x, meteor.y, sz/2); }
  safeDestroy(meteor); playSfx(s, 'hit');
}

function crashShip(ship, meteor) { 
  if (!meteor.active || ship.getData('dead') || this.time.now < ship.getData('lastHit') + 200) return;
  const mColor = meteor.getData('color'), sz = meteor.getData('size');
  if (ship.getData('shipColor') === mColor) {
    explode(this, meteor.x, meteor.y, mColor, 5); safeDestroy(meteor); playSfx(this, 'pew'); return;
  }
  ship.setData('lastHit', this.time.now); 
  dmgShip(this, ship, Math.floor(sz / 2)); 
  explode(this, meteor.x, meteor.y, mColor || COLORS.debris, 5); safeDestroy(meteor); playSfx(this, 'hit');
}


function crashEnemy(ship, enemy) {
  if (ship.getData('dead') || enemy.getData('dead') || this.time.now < ship.getData('lastHit') + 200) return;
  ship.setData('lastHit', this.time.now);
  dmgShip(this, ship, 25);
  dmgEnemy(this, enemy, 20, ship.getData('id'));
  explode(this, ship.x, ship.y, 0xff3344, 10);
  playSfx(this, 'hit');
}

function dmgShip(s, ship, amt) {
  if (ship.getData('dead')) return;
  if (ship.getData('hasShield')) {
    ship.setData('hasShield', false);
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
    playSfx(s, 'dash'); explode(s, ship.x, ship.y, COLORS.shield, 10);
    return;
  }
  const hp = Math.max(0, ship.getData('hp') - amt); ship.setData('hp', hp); 
  
  // Hit Feedback: Sound, Stop & Shake
  playSfx(s, 'hit');
  s.cameras.main.shake(150, 0.015);
  s.physics.world.pause();
  s.time.delayedCall(50, () => s.physics.world.resume());

  // Glitch Flash Effect
  const flash = s.add.graphics().fillStyle(0xffffff, 0.8).fillCircle(0, 0, 20);
  ship.add(flash);
  s.time.delayedCall(50, () => flash.destroy());
  
  ship.setAlpha(0.3);
  s.time.delayedCall(80, () => { if(ship.active) ship.setAlpha(1); });

  if (hp <= 0) {
    const { x, y } = ship;
    ship.setData('dead', true).setVisible(false); 
    if(ship.body) { ship.body.enable = false; ship.body.setVelocity(0, 0); }
    ship.setPosition(-1000, -1000); 
    if (s.state.mode === 'solo') spectacularExplosion(s, x, y, ship.getData('color'));
    else explode(s, x, y, ship.getData('color'), 25); 
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
    s.time.delayedCall(1200, () => endMatch(s));
  }
}


function updateHud(s, ship, time) {
  const id = ship.getData('id'), hp = ship.getData('hp'), en = ship.getData('energy'), ld = ship.getData('lastDash'), type = ship.getData('spType'), count = ship.getData('spCount'), score = s.state.scores[id], sh = ship.getData('hasShield');
  const isOverdrive = time < ship.getData('overdriveUntil');
  const shots = Math.floor(en / 12);
  s.hud[id].hp.setText(`${id.toUpperCase()} // HULL ${Math.ceil(hp)}%`);
  s.hud[id].shInd.setVisible(sh).setAlpha(0.6 + Math.sin(time/100)*0.4);
  if (isOverdrive) s.hud[id].enBar.setText(`!! OVERDRIVE_ACTIVE !!`).setTint(0xff00ff);
  else s.hud[id].enBar.setText(`ENERGY: ${shots > 0 ? '█'.repeat(shots) : '---'} (${Math.ceil(en)}%)`).clearTint();
  
  const dReady = Math.max(0, ld-time) <= 0;
  const g = s.hud[id].dodgeInd; g.clear();
  const ox = id === 'p1' ? 0 : -60;
  g.lineStyle(1, 0x888888, 0.4).strokeRect(ox, 48, 60, 10);
  if (dReady) g.fillStyle(COLORS.dodge, 0.8).fillRect(ox + 2, 50, 56, 6);
  else {
    const pct = 1 - (ld - time) / 3000;
    g.fillStyle(0x444444, 0.8).fillRect(ox + 2, 50, 56 * pct, 6);
  }
  
  s.hud[id].sp.setText(type ? `>> SP_WEAPON: ${type === POWS.MISSILE ? 'MISSILES' : (type === POWS.FLARE ? 'FLARES' : 'SHIELD')} [${count}]` : '');
  s.hud[id].score.setText(`ARCHIVE: ${String(score).padStart(6, '0')}`);

  
  if (s.state.phase === 'playing') {
    const elapsed = s.time.now - s.state.startTime;
    const mins = Math.floor(elapsed / 60000), secs = Math.floor((elapsed % 60000) / 1000);
    const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    const remaining = Math.max(0, Math.ceil((s.state.nextRoundTime - time) / 1000));
    
    if (s.state.mode === 'solo') {
      s.hud.timer.setText(`TIME ${timeStr} // ROUND ${s.state.round} (NEXT ${remaining}s)`);
    } else {
      s.hud.timer.setText(`ROUND ${s.state.round} // NEXT IN ${remaining}s`);
    }
  }
}

function showPoints(s, x, y, amt, color) {
  const t = s.add.text(x, y, `+${amt}`, { font: 'bold 24px monospace', fill: c2s(color) });
  t.setOrigin(0.5).setDepth(200);
  s.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

function addPoints(s, id, amt, x, y) {
  if (s.state.phase !== 'playing' || s.state.scores[id] === undefined) return;
  s.state.scores[id] += amt;
  if (x !== undefined && y !== undefined && COLORS[id]) showPoints(s, x, y, amt, COLORS[id]);
}

function updateRounds(s, time, delta) {
  if (s.state.showerPending) {
    s.state.nextRoundTime += delta;
    return;
  }

  if (time > s.state.nextRoundTime) {
    s.state.round++;
    s.state.nextRoundTime = time + 25000;
    s.state.spawnTimer = time + 1000;
    s.state.isShowerActive = false;
    s.state.showerPending = false;
    const bonus = s.state.round * 500;
    addPoints(s, 'p1', bonus); 
    if (s.state.mode === 'duel') addPoints(s, 'p2', bonus);
    
    // Visual Announcement
    const msg = s.add.text(W/2, H/2, `ROUND ${s.state.round}\nMETEOR INTENSITY UP!`, { font: 'bold 42px monospace', fill: c2s(COLORS.accent), align: 'center' }).setOrigin(0.5).setDepth(300).setScale(0);
    s.tweens.add({ targets: msg, scale: 1, duration: 500, ease: 'Back.out' });
    s.time.delayedCall(2000, () => s.tweens.add({ targets: msg, alpha: 0, scale: 1.5, duration: 500, onComplete: () => msg.destroy() }));
    
    if (s.state.mode === 'solo' && s.state.round % 3 === 0) {
      s.time.delayedCall(3000, () => spawnBoss(s));
    }
    if (s.state.round >= 5 && (s.state.round - 5) % 4 === 0) {
      s.state.showerPending = true;
    }
    playSfx(s, 'dash');
  }
}

function explode(s, x, y, color, count=10) {
  for (let i = 0; i < count; i++) {
    const p = s.add.rectangle(x, y, 3, 3, color);
    s.physics.add.existing(p);
    const a = Math.random()*Math.PI*2, spd = 100 + Math.random()*200;
    p.body.setVelocity(Math.cos(a)*spd, Math.sin(a)*spd).setDrag(200);
    s.tweens.add({ targets: p, alpha: 0, scale: 0, duration: 600 + Math.random()*400, onComplete: () => p.destroy() });
  }
  // Screen Glitch Effect
  if (count > 15) triggerGlitch(s);
}

function triggerGlitch(s) {
  const intensity = 8;
  s.tweens.add({
    targets: s.cameras.main,
    x: { from: -intensity, to: intensity },
    duration: 40,
    yoyo: true,
    repeat: 3,
    onComplete: () => { s.cameras.main.x = 0; }
  });
}

function spawnTrail(s, ship) {
  const isOverdrive = s.time.now < ship.getData('overdriveUntil');
  const hp = ship.getData('hp');
  const color = isOverdrive ? COLORS.overdrive : (ship.getData('shipColor') || ship.getData('color'));
  
  // 1. Fire Particle (Ejected from reactor)
  const isSputtering = hp < 30 && (Math.floor(Date.now() / 100) % 2 === 0);
  if (!isSputtering) {
    const fX = ship.x - Math.cos(ship.rotation) * 10;
    const fY = ship.y - Math.sin(ship.rotation) * 10;
    const f = s.add.circle(fX, fY, 2.5, color, 0.8);
    s.tweens.add({
      targets: f,
      x: fX - Math.cos(ship.rotation) * 20,
      y: fY - Math.sin(ship.rotation) * 20,
      scale: 0.1, alpha: 0, duration: 300,
      onComplete: () => f.destroy()
    });
  }

  // 2. Smoke Particle (Adaptive based on HP)
  if (hp < 80) {
    const smokeChance = (80 - hp) / 70; 
    if (Math.random() < smokeChance) {
      const sm = s.add.circle(ship.x, ship.y, 3, color, 0.25);
      const driftX = (Math.random() - 0.5) * 40;
      const driftY = (Math.random() - 0.5) * 40;
      s.tweens.add({
        targets: sm,
        x: ship.x + driftX,
        y: ship.y + driftY,
        scale: 4 + Math.random() * 2,
        alpha: 0,
        duration: 800 + Math.random() * 500,
        onComplete: () => sm.destroy()
      });
    }
  }
}

function drawShield(s, ship) {
  if (!ship.shieldVisual) {
    ship.shieldVisual = s.add.graphics();
    ship.add(ship.shieldVisual);
  }
  ship.shieldVisual.clear().lineStyle(2, COLORS.shield, 0.6).strokeCircle(0, 0, 20 + Math.sin(s.time.now/100)*2);
}


function initUi(s) {
  const f = { font: 'bold 18px monospace' }, sf = { font: '12px monospace' };
  
  // HUD Containers for P1 and P2
  const p1H = s.add.container(25, 25).setDepth(500);
  const p2H = s.add.container(W - 25, 25).setDepth(500);
  
  s.hud = {
    p1: { 
      hp: s.add.text(0, 0, 'P1 // HULL OK', { ...f, fill: '#00ff66' }), 
      enBar: s.add.text(0, 25, 'ENERGY: 100%', { ...sf, fill: '#888' }), 
      dodgeInd: s.add.graphics(), 
      shInd: s.add.text(0, 65, '>> DEFENSE: [ SHIELD_UP ]', { ...sf, fill: c2s(COLORS.shield) }).setVisible(false),
      sp: s.add.text(0, 85, '', { ...sf, fill: '#ff4422' }),
      score: s.add.text(0, 105, 'ARCHIVE: 000000', { ...sf, fill: '#00ff66' })
    },
    p2: { 
      hp: s.add.text(0, 0, 'P2 // HULL OK', { ...f, fill: '#ffcc00' }).setOrigin(1,0), 
      enBar: s.add.text(0, 25, 'ENERGY: 100%', { ...sf, fill: '#888' }).setOrigin(1,0), 
      dodgeInd: s.add.graphics(), 
      shInd: s.add.text(0, 65, '[ SHIELD_UP ] :DEFENSE <<', { ...sf, fill: c2s(COLORS.shield) }).setOrigin(1,0).setVisible(false),
      sp: s.add.text(0, 85, '', { ...sf, fill: '#ffcc00' }).setOrigin(1,0),
      score: s.add.text(0, 105, 'ARCHIVE: 000000', { ...sf, fill: '#ffcc00' }).setOrigin(1,0)
    },
    timer: s.add.text(W/2, 25, '', { font: 'bold 16px monospace', fill: '#888' }).setOrigin(0.5).setDepth(500)
  };
  
  p1H.add([s.hud.p1.hp, s.hud.p1.enBar, s.hud.p1.dodgeInd, s.hud.p1.shInd, s.hud.p1.sp, s.hud.p1.score]);
  p2H.add([s.hud.p2.hp, s.hud.p2.enBar, s.hud.p2.dodgeInd, s.hud.p2.shInd, s.hud.p2.sp, s.hud.p2.score]);
  
  s.scrStart = createStartScreen(s);
  s.scrMode = createModeSelectScreen(s);
  s.scrGeneric = createOverlay(s, '', []); s.scrGameOver = createOverlay(s, 'MATCH OVER', []);
  s.scrName = createNameEntryScreen(s);
}

function createModeSelectScreen(s) {
  const c = s.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(s.add.rectangle(W/2, H/2, W, H, COLORS.overlay, 1));
  c.add(s.add.text(W/2, 120, 'SELECT OPERATION', { font: 'bold 42px monospace', fill: c2s(COLORS.accent) }).setOrigin(0.5));
  
  const modes = [
    { id: 'solo', name: '1 PLAYER: RESISTANCE', desc: 'Survive the meteor storm as long as possible.' },
    { id: 'duel', name: '2 PLAYERS: DUEL (1V1)', desc: 'Standard dogfight. Last pilot standing wins.' }
  ];
  
  const btns = modes.map((m, i) => {
    const y = 280 + i*140;
    const bg = s.add.rectangle(W/2, y, 500, 100, COLORS.cell).setStrokeStyle(2, COLORS.frame);
    const title = s.add.text(W/2, y - 20, m.name, { font: 'bold 24px monospace', fill: '#fff' }).setOrigin(0.5);
    const desc = s.add.text(W/2, y + 20, m.desc, { font: '14px monospace', fill: c2s(COLORS.stable) }).setOrigin(0.5);
    c.add([bg, title, desc]); return { bg, title, desc };
  });
  
  const help = s.add.text(W/2, H-60, 'JOYSTICK U/D: NAVIGATE | START: INITIATE', { font: '14px monospace', fill: '#888' }).setOrigin(0.5);
  c.add(help);
  
  return { c, btns };
}

function createNameEntryScreen(s) {
  const c = s.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(s.add.rectangle(W/2, H/2, W, H, COLORS.overlay, 0.98));
  const t1 = s.add.text(W/2, 120, 'NEW HIGH SCORE!', { font: 'bold 42px monospace', fill: c2s(COLORS.accent) }).setOrigin(0.5);
  const t2 = s.add.text(W/2, 180, 'PILOT IDENTIFICATION', { font: '24px monospace', fill: '#fff' }).setOrigin(0.5);
  
  const charTexts = [0,1,2].map(i => s.add.text(W/2 - 60 + i*60, H/2, 'A', { font: 'bold 64px monospace', fill: '#fff' }).setOrigin(0.5));
  const underline = s.add.graphics().lineStyle(4, COLORS.accent).lineBetween(-25, 40, 25, 40);
  const cursor = s.add.container(W/2 - 60, H/2).add(underline);
  
  const confirmMsg = s.add.text(W/2, H/2 + 80, '>>> CONFIRM NAME? [START] YES / [ACTION] EDIT <<<', { font: 'bold 18px monospace', fill: '#ffcc00' }).setOrigin(0.5).setVisible(false);
  const help = s.add.text(W/2, H-120, 'JOYSTICK L/R: POSITION | U/D: CHANGE CHAR\nSTART: CONFIRM NAME', { font: 'bold 16px monospace', fill: c2s(COLORS.stable), align: 'center' }).setOrigin(0.5);
  
  c.add([t1, t2, ...charTexts, cursor, confirmMsg, help]);
  return { c, chars: charTexts, cursor, t1, help, confirmMsg };
}

function createStartScreen(s) {
  const c = s.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(s.add.rectangle(W/2, H/2, W, H, COLORS.overlay, 1));
  
  // OS Header
  const headerBg = s.add.graphics().fillStyle(0x0a0a0a, 0.9).fillRect(0, 0, W, 50);
  const headerLine = s.add.graphics().lineStyle(2, COLORS.accent, 0.5).lineBetween(0, 50, W, 50);
  const osTitle = s.add.text(25, 15, 'ASTRO_DASH // V1.0', { font: 'bold 18px monospace', fill: c2s(COLORS.accent) });
  const sysInfo = s.add.text(W - 25, 18, 'CORE_TEMP: 42°C | MEMORY: 92% | SECTOR: 7G', { font: '12px monospace', fill: c2s(COLORS.stable) }).setOrigin(1, 0);
  c.add([headerBg, headerLine, osTitle, sysInfo]);
  
  s.time.addEvent({ delay: 150, loop: true, callback: () => { 
    if (s.state.phase === 'start') sysInfo.setText(`CORE_TEMP: ${41 + Math.floor(Math.random()*4)}°C | MEMORY: ${91 + Math.floor(Math.random()*6)}% | SECTOR: ${Math.floor(Math.random()*9)}G`);
  }});

  drawHazardStripes(s, c, 0, H - 25, W, 25);

  // Left Section: Interaction Console
  const leftX = 50, leftY = 100, leftW = 320, leftH = 440;
  const leftBox = drawTechFrame(s, leftX, leftY, leftW, leftH, COLORS.frame);
  const leftTitle = s.add.text(leftX + leftW/2, leftY + 30, '┌ PILOT CONSOLE ┐', { font: 'bold 24px monospace', fill: '#fff' }).setOrigin(0.5, 0);
  const leftSub = s.add.text(leftX + leftW/2, leftY + 70, 'STATION_7G // STANDBY', { font: '12px monospace', fill: c2s(COLORS.stable) }).setOrigin(0.5, 0);
  c.add([leftBox, leftTitle, leftSub]);

  const buttons = ['PLAY', 'HELP', 'TEST'];
  const btns = buttons.map((txt, i) => {
    const y = leftY + 180 + i*85; 
    const bg = s.add.rectangle(leftX + leftW/2, y, 240, 55, COLORS.cell).setStrokeStyle(2, COLORS.frame);
    const label = s.add.text(leftX + leftW/2, y, `[ ${txt} ]`, { font: 'bold 20px monospace', fill: '#fff' }).setOrigin(0.5);
    c.add([bg, label]); return { bg, label };
  });

  // Right Section: Global Ranking
  const rightX = 400, rightY = 100, rightW = 350, rightH = 440;
  const rightBox = drawTechFrame(s, rightX, rightY, rightW, rightH, COLORS.frame);
  const rightTitle = s.add.text(rightX + rightW/2, rightY + 30, '┌ PILOT RANKINGS ┐', { font: 'bold 24px monospace', fill: '#fff' }).setOrigin(0.5, 0);
  c.add([rightBox, rightTitle]);
  
  const sbSoloHeader = s.add.text(rightX + 90, rightY + 100, '--- SOLO_RECORD ---', { font: 'bold 12px monospace', fill: c2s(COLORS.p1) }).setOrigin(0.5);
  const sbSoloText = s.add.text(rightX + 90, rightY + 130, 'LOADING...', { font: '13px monospace', fill: '#fff', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);
  
  const sbDuelHeader = s.add.text(rightX + 260, rightY + 100, '--- DUEL_RECORD ---', { font: 'bold 12px monospace', fill: c2s(COLORS.p2) }).setOrigin(0.5);
  const sbDuelText = s.add.text(rightX + 260, rightY + 130, 'LOADING...', { font: '13px monospace', fill: '#fff', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);
  
  c.add([sbSoloHeader, sbSoloText, sbDuelHeader, sbDuelText]);

  return { c, btns, sbSoloText, sbDuelText };
}

function drawTechFrame(s, x, y, w, h, color) {
  const g = s.add.graphics();
  g.lineStyle(1, color, 0.5);
  g.strokeRect(x, y, w, h);
  
  // Decorative Corners
  g.lineStyle(3, color, 1);
  const l = 20;
  g.lineBetween(x, y, x+l, y); g.lineBetween(x, y, x, y+l); // TL
  g.lineBetween(x+w, y, x+w-l, y); g.lineBetween(x+w, y, x+w, y+l); // TR
  g.lineBetween(x, y+h, x+l, y+h); g.lineBetween(x, y+h, x, y+h-l); // BL
  g.lineBetween(x+w, y+h, x+w-l, y+h); g.lineBetween(x+w, y+h, x+w, y+h-l); // BR
  
  // Tech labels
  const label = s.add.text(x + w - 5, y + h + 5, 'SYS_REF: '+Math.random().toString(16).slice(2,8).toUpperCase(), { font: '9px monospace', fill: c2s(color) }).setOrigin(1,0).setAlpha(0.6);
  const container = s.add.container(0, 0, [g, label]);
  return container;
}

function drawHazardStripes(s, container, x, y, w, h) {
  const g = s.add.graphics();
  g.fillStyle(COLORS.accent, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(8, 0x000000, 1);
  for (let i = 0; i < w; i += 20) {
    g.lineBetween(x + i, y + h, x + i + 10, y);
  }
  container.add(g);
}

function createOverlay(s, title, buttons) {
  const c = s.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(s.add.rectangle(W/2, H/2, W, H, COLORS.overlay, 1));
  const tText = s.add.text(W/2, 140, title, { font: 'bold 64px monospace', fill: c2s(COLORS.accent) }).setOrigin(0.5);
  c.add(tText);
  const btns = buttons.map((txt, i) => {
    const y = 300 + i*70; const bg = s.add.rectangle(W/2, y, 280, 45, COLORS.cell).setStrokeStyle(2, COLORS.frame);
    const label = s.add.text(W/2, y, `[ ${txt} ]`, { font: 'bold 22px monospace', fill: '#fff' }).setOrigin(0.5);
    c.add([bg, label]); return { bg, label };
  });
  return { c, btns, t: tText };
}

function showStartScreen(s) { 
  s.state.phase = 'start'; 
  s.scrStart.c.setVisible(true); 
  s.scrMode.c.setVisible(false);
  s.scrGeneric.c.setVisible(false); 
  s.scrGameOver.c.setVisible(false); 
  s.scrName.c.setVisible(false);
  s.state.menu.cd = s.time.now + 500; 
  s.controls.pressed = {}; 
  Object.values(s.hud.p1).forEach(h => h.setVisible(false));
  Object.values(s.hud.p2).forEach(h => h.setVisible(false));
  s.hud.timer.setVisible(false);
  updateScoreboardUi(s); updateMenu(s); 
}
function updateScoreboardUi(s) {
  const solo = s.state.highScoresSolo;
  const duel = s.state.highScoresDuel;
  
  const soloTxt = solo.length ? solo.slice(0, 5).map((e, i) => `${i+1}. ${e.name.padEnd(3)} ${String(e.score).padStart(6, '0')}\n${e.time || '00:00'}`).join('\n\n') : 'NO DATA FOUND';
  const duelTxt = duel.length ? duel.slice(0, 5).map((e, i) => `${i+1}. ${e.name.padEnd(3)} ${String(e.score).padStart(6, '0')}`).join('\n\n') : 'NO DATA FOUND';
  
  s.scrStart.sbSoloText.setText(soloTxt);
  s.scrStart.sbDuelText.setText(duelTxt);
}
function updateMenu(s) { 
  s.scrStart.btns.forEach((b, i) => { 
    const a = i === s.state.menu.cursor; 
    b.bg.setFillStyle(a ? COLORS.accent : COLORS.cell); 
    b.label.setFill(a ? '#000' : '#fff'); 
    b.bg.setStrokeStyle(2, a ? COLORS.white : COLORS.frame);
  }); 
}

function handleStartMenu(s, time) {
  const st = consume(s, ['START1', 'START2', 'P1_1', 'P2_1']); if (time < s.state.menu.cd) return;
  const dy = (held(s, 'P1_D') || held(s, 'P2_D') ? 1 : 0) - (held(s, 'P1_U') || held(s, 'P2_U') ? 1 : 0);
  if (dy !== 0) { s.state.menu.cursor = Phaser.Math.Wrap(s.state.menu.cursor + dy, 0, 3); s.state.menu.cd = time + 200; updateMenu(s); playSfx(s, 'click'); }
  if (st) { 
    const cur = s.state.menu.cursor; 
    if (cur === 0) showModeSelect(s); 
    else if (cur === 1) showHelp(s); 
    else showTestScreen(s); 
  }
}

function showModeSelect(s) {
  s.state.phase = 'modeSelect';
  s.state.menu.cursor = 0;
  s.state.menu.cd = s.time.now + 300;
  s.scrStart.c.setVisible(false);
  s.scrMode.c.setVisible(true);
  updateModeMenu(s);
}

function updateModeMenu(s) {
  s.scrMode.btns.forEach((b, i) => {
    const a = i === s.state.menu.cursor;
    b.bg.setFillStyle(a ? COLORS.accent : COLORS.cell);
    b.title.setFill(a ? '#000' : '#fff');
    b.bg.setStrokeStyle(2, a ? COLORS.white : COLORS.frame);
  });
}

function handleModeSelect(s, time) {
  const st = consume(s, ['START1', 'START2', 'P1_1', 'P2_1']); if (time < s.state.menu.cd) return;
  const dy = (held(s, 'P1_D') || held(s, 'P2_D') ? 1 : 0) - (held(s, 'P1_U') || held(s, 'P2_U') ? 1 : 0);
  if (dy !== 0) { s.state.menu.cursor = Phaser.Math.Wrap(s.state.menu.cursor + dy, 0, 2); s.state.menu.cd = time + 200; updateModeMenu(s); playSfx(s, 'click'); }
  if (st) {
    const mode = s.state.menu.cursor === 0 ? 'solo' : 'duel';
    s.state.mode = mode;
    startMatch(s);
  }
}

function startMatch(s) { 
  s.state.phase = 'playing'; 
  s.scrStart.c.setVisible(false); 
  s.scrMode.c.setVisible(false);
  s.scrGameOver.c.setVisible(false); 
  resetGame(s); 
}

function resetGame(s) {
  s.state.startTime = s.time.now;
  s.ships.children.iterate(ship => { 
    const isP2 = ship.getData('id') === 'p2';
    const active = s.state.mode === 'duel' || !isP2;
    
    ship.setData({ hp: 100, energy: 100, dead: !active, lastHit: 0, spType: null, spCount: 0, shipColor: SHIP_COLORS[0], hasShield: false })
        .setVisible(active).setPosition(ship.getData('id')==='p1'?150:W-150, H/2).setRotation(ship.getData('id')==='p1'?0:Math.PI); 
    ship.body.setVelocity(0).enable = active; 
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
  });

  s.bullets.clear(true, true); s.meteors.clear(true, true); s.orbs.clear(true, true); s.powerups.clear(true, true); s.missiles.clear(true, true); s.flares.clear(true, true); s.enemies.clear(true, true);
  if (s.hud.clearMsg) { s.hud.clearMsg.destroy(); s.hud.clearMsg = null; }
  if (s.hud.showerAlert) { s.hud.showerAlert.clear(); }
  
  const isDuel = s.state.mode === 'duel';
  Object.values(s.hud.p1).forEach(h => h.setVisible(true));
  Object.values(s.hud.p2).forEach(h => h.setVisible(isDuel));
  s.hud.timer.setVisible(true);

  s.state.scores = { p1: 0, p2: 0 }; s.state.round = 1; s.state.showerCount = 0; s.state.nextRoundTime = s.time.now + 25000;
  s.state.spawnTimer = 0; s.state.orbTimer = s.time.now + 15000; s.state.powTimer = s.time.now + 10000; s.physics.resume(); s.controls.pressed = {};
  s.state.gameoverDone = false;
}

function endMatch(s) { 
  s.state.phase = 'gameover'; s.physics.pause(); s.state.gameoverDone = false;
  const duration = s.time.now - s.state.startTime;
  const mins = Math.floor(duration / 60000), secs = Math.floor((duration % 60000) / 1000);
  const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  
  let winId = 'p1', score = s.state.scores.p1;
  if (s.state.mode === 'duel') {
    winId = s.state.scores.p1 > s.state.scores.p2 ? 'p1' : 'p2';
    score = s.state.scores[winId];
  }
  
  const hsList = s.state.mode === 'solo' ? s.state.highScoresSolo : s.state.highScoresDuel;
  const isHS = hsList.length < 10 || score > (hsList.length ? hsList[hsList.length-1].score : -1);

  if (s.state.mode === 'solo') {
    playLossMelody(s);
    s.scrGameOver.c.setVisible(true); 
    s.scrGameOver.t.setText('SIGNAL TERMINATED').setTint(0xff4422).setScale(0);
    s.tweens.add({ targets: s.scrGameOver.t, scale: 1, alpha: { from: 0, to: 1 }, duration: 800, ease: 'Bounce.out' });
    
    const scoreBox = drawTechFrame(s, W/2 - 180, 210, 360, 240, COLORS.frame);
    s.scrGameOver.c.add(scoreBox);

    const scoreLabel = s.add.text(W/2, 235, '--- RECOVERY_COMPLETE ---', { font: '14px monospace', fill: c2s(COLORS.stable) }).setOrigin(0.5);
    const scoreVal = s.add.text(W/2, 300, '000000', { font: 'bold 72px monospace', fill: '#fff' }).setOrigin(0.5);
    s.scrGameOver.c.add([scoreLabel, scoreVal]);
    
    let cur = 0;
    s.time.addEvent({
      delay: 35,
      callback: () => {
        cur = Math.min(score, cur + Math.max(1, Math.floor(score / 35)));
        scoreVal.setText(String(cur).padStart(6, '0'));
        if (cur < score) playSfx(s, 'click');
        else {
          scoreLabel.setText(isHS ? '!! NEW_RECORD_DETECTED !!' : '>> DATA_ARCHIVED_SUCCESSFULLY');
          const timeInfo = s.add.text(W/2, 370, `FLIGHT_TIME: ${timeStr}`, { font: '18px monospace', fill: '#888' }).setOrigin(0.5).setAlpha(0);
          const prompt = s.add.text(W/2, 420, isHS ? 'PRESS START TO SYNC DATA' : 'PRESS START TO DISCONNECT', { font: 'bold 16px monospace', fill: isHS ? c2s(COLORS.accent) : '#666' }).setOrigin(0.5).setAlpha(0);
          s.scrGameOver.c.add([timeInfo, prompt]);
          s.tweens.add({ targets: [timeInfo, prompt], alpha: 1, y: '+=10', duration: 500 });
          s.state.gameoverDone = true; s.state.isHS = isHS; s.state.winId = winId; s.state.score = score; s.state.timeStr = timeStr;
        }
      },
      repeat: 35
    });
  } else {
    if (isHS) showNameEntry(s, winId, score, timeStr);
    else {
      s.scrGameOver.c.setVisible(true); 
      const msg = winId === 'p1' ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!';
      const info = s.add.text(W/2, 240, msg, { font: 'bold 36px monospace', fill: '#fff' }).setOrigin(0.5); 
      s.scrGameOver.c.add(info); 
      s.state.gameoverDone = true;
    }
  }
}

function showNameEntry(s, winner, score, timeStr) {
  s.state.phase = 'nameEntry';
  s.state.nameEntry = { name: ['A','A','A'], idx: 0, cIdx: 0, winner, score, timeStr, cd: 0, confirming: false };
  s.scrName.c.setVisible(true);
  s.scrName.confirmMsg.setVisible(false);
  s.scrName.help.setVisible(true);
  s.scrName.t1.setText(s.state.mode === 'solo' ? 'NEW RECORD DETECTED' : `${winner.toUpperCase()} ACED IT!`);
  updateNameEntryUi(s);
}

function updateNameEntryUi(s) {
  const e = s.state.nameEntry;
  s.scrName.chars.forEach((t, i) => {
    t.setText(e.name[i]);
    t.setFill(e.confirming ? '#ffcc00' : (i === e.idx ? c2s(COLORS.accent) : '#fff'));
    if (e.confirming) {
       t.setAlpha(0.6 + Math.sin(Date.now()/100)*0.4);
    } else {
       t.setAlpha(1);
    }
  });
  s.scrName.cursor.setX(W/2 - 60 + e.idx*60);
  s.scrName.cursor.setVisible(!e.confirming);
  s.scrName.confirmMsg.setVisible(e.confirming);
  s.scrName.help.setVisible(!e.confirming);
}

function handleNameEntry(s, time) {
  const e = s.state.nameEntry; if (time < e.cd) return;
  const dy = (held(s, 'P1_D') || held(s, 'P2_D') ? 1 : 0) - (held(s, 'P1_U') || held(s, 'P2_U') ? 1 : 0);
  const dx = (held(s, 'P1_R') || held(s, 'P2_R') ? 1 : 0) - (held(s, 'P1_L') || held(s, 'P2_L') ? 1 : 0);
  const ok = consume(s, ['START1', 'START2']);
  const cancel = consume(s, ['P1_1', 'P1_2', 'P1_3', 'P2_1', 'P2_2', 'P2_3']);

  if (e.confirming) {
    if (cancel || dy !== 0 || dx !== 0) {
      e.confirming = false;
      e.cd = time + 200;
      playSfx(s, 'click');
      updateNameEntryUi(s);
      return;
    }
    if (ok) {
      saveHighScore(e.name.join(''), e.score, e.timeStr, s.state.mode).then(hs => {
        if (s.state.mode === 'solo') s.state.highScoresSolo = hs;
        else s.state.highScoresDuel = hs;
        s.scrName.c.setVisible(false);
        showStartScreen(s);
      });
      playSfx(s, 'orb');
      e.cd = time + 1000;
    }
    return;
  }

  if (dy !== 0) {
    e.cIdx = Phaser.Math.Wrap(e.cIdx + dy, 0, CHARS.length);
    e.name[e.idx] = CHARS[e.cIdx];
    e.cd = time + 150; playSfx(s, 'click'); updateNameEntryUi(s);
  }
  if (dx !== 0) {
    e.idx = Phaser.Math.Wrap(e.idx + dx, 0, 3);
    e.cIdx = CHARS.indexOf(e.name[e.idx]);
    e.cd = time + 200; playSfx(s, 'dash'); updateNameEntryUi(s);
  }
  if (ok) {
    e.confirming = true;
    e.cd = time + 300;
    playSfx(s, 'dash');
    updateNameEntryUi(s);
  }
}

function clearC(c, k=2) { const l = c.list; for (let i = l.length-1; i >= k; i--) l[i].destroy(); }
function returnToStart(s) { clearC(s.scrGameOver.c); showStartScreen(s); }
function pauseMatch(s) { s.state.phase = 'paused'; s.physics.pause(); clearC(s.scrGeneric.c); s.scrGeneric.c.setVisible(true); s.scrGeneric.t.setText('PAUSED'); s.controls.pressed = {}; }
function resumeMatch(s) { s.state.phase = 'playing'; s.physics.resume(); s.scrGeneric.c.setVisible(false); }
function showLeaderboard(s) { /* Unused - rankings are now integrated into start screen */ }
function showHelp(s) {
  s.state.phase = 'help';
  s.scrStart.c.setVisible(false);
  clearC(s.scrGeneric.c);
  s.scrGeneric.c.setVisible(true);
  s.scrGeneric.t.setText('OPERATIONAL INTEL').setFontSize(48).setY(80);
  const c = s.scrGeneric.c;
  
  const ctrl = s.add.text(W/2, 140, 'JOYSTICK: MOVE | BTN 1-3: FIRE | BTN 4: BOOST | BTN 6: SPECIAL', { font: 'bold 13px monospace', fill: '#888' }).setOrigin(0.5);
  c.add(ctrl);

  const items = [
    { t: POWS.MISSILE, n: 'MISSILE', d: 'HOMING STRIKE.\nTRACKS HOSTILES.', c: COLORS.missile },
    { t: POWS.FLARE, n: 'FLARE', d: 'DECOY. DEFLECTS\nINCOMING MISSILES.', c: COLORS.flare },
    { t: POWS.SHIELD, n: 'SHIELD', d: 'KINETIC BARRIER.\nBLOCKS ONE IMPACT.', c: COLORS.shield },
    { t: POWS.RAPID, n: 'OVERDRIVE', d: 'UNLIMITED ENERGY.\nLASTS 8 SECONDS.', c: COLORS.overdrive },
    { t: '+', n: 'REPAIR', d: 'RESTORES 25% HULL\nINTEGRITY.', c: COLORS.orb }
  ];

  items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W/2 + (col === 0 ? -280 : 80), y = 240 + row * 110;
    
    const box = s.add.container(x, y);
    const g = s.add.graphics(); drawPowerupIcon(g, item.t, item.c, 20);
    box.add(g); c.add(box);
    s.tweens.add({ targets: box, angle: 360, duration: 4000, repeat: -1 });
    s.tweens.add({ targets: box, scale: 1.15, duration: 800, yoyo: true, repeat: -1 });
    
    const name = s.add.text(x + 45, y - 18, item.n, { font: 'bold 18px monospace', fill: c2s(item.c) }).setOrigin(0, 0.5);
    const desc = s.add.text(x + 45, y + 18, item.d, { font: '12px monospace', fill: '#bbb' }).setOrigin(0, 0.5);
    c.add([name, desc]);
  });

  const tip = s.add.text(W/2, H - 60, 'TIP: BOOST ENABLES INERTIAL DRIFT! ROTATE AND FIRE WHILE SLIDING.', { font: 'bold 13px monospace', fill: c2s(COLORS.stable) }).setOrigin(0.5);
  c.add(tip);
}



function showTestScreen(s) {
  s.state.phase = 'test'; s.scrStart.c.setVisible(false); clearC(s.scrGeneric.c); s.scrGeneric.c.setVisible(true); s.scrGeneric.t.setText('INPUT TEST');
  const codes = Object.keys(CABINET_KEYS); s.testTexts = {};
  codes.forEach((c, i) => {
    const x = c.startsWith('P1') ? W*0.25 : (c.startsWith('P2') ? W*0.75 : W*0.5);
    const y = 220 + (i % 10) * 35;
    const txt = s.add.text(x, y, c, { font: 'bold 18px monospace', fill: '#444' }).setOrigin(0.5);
    s.scrGeneric.c.add(txt); s.testTexts[c] = txt;
  });
  const hint = s.add.text(W/2, 550, 'PRESS START TO EXIT', { font: '14px monospace', fill: '#888' }).setOrigin(0.5);
  s.scrGeneric.c.add(hint);
}

function updateTestScreen(s) {
  Object.entries(s.testTexts).forEach(([code, txt]) => {
    const isP1 = code.startsWith('P1'), isP2 = code.startsWith('P2'), isHeld = held(s, code);
    txt.setFill(isHeld ? (isP1 ? '#00f2ff' : (isP2 ? '#ff00ea' : '#fbff00')) : '#444');
    if (isHeld) txt.setScale(1.2); else txt.setScale(1.0);
  });
}

function initControls(s) {
  const k = { held: {}, pressed: {} }, rev = {}; 
  Object.entries(CABINET_KEYS).forEach(([a, ks]) => ks.forEach(key => {
    const finalKey = key.length === 1 ? key.toLowerCase() : key;
    rev[finalKey] = a;
  }));
  window.onkeydown = (e) => {
    if (e.key === 'Escape') { k.pressed['ESC'] = true; k.held['ESC'] = true; return; }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const a = rev[key];
    if (a) { if (!k.held[a]) k.pressed[a] = true; k.held[a] = true; }
  };
  window.onkeyup = (e) => {
    if (e.key === 'Escape') { k.held['ESC'] = false; return; }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const a = rev[key]; if (a) k.held[a] = false;
  };
  s.controls = k;
}

function held(s, c) { return s.controls.held[c]; }
function consume(s, codes) { for (const c of codes) if (s.controls.pressed[c]) { s.controls.pressed[c] = false; return true; } return false; }

function playSfx(s, type) {
  try {
    const ctx = s.game.sound.context; if (!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination);
    if (type === 'pew') { osc.type = 'triangle'; osc.frequency.setValueAtTime(800, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1); g.gain.setValueAtTime(0.08, ctx.currentTime); }
    else if (type === 'dash') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.12); g.gain.setValueAtTime(0.12, ctx.currentTime); }
    else if (type === 'hit') { osc.type = 'square'; osc.frequency.setValueAtTime(100, ctx.currentTime); osc.frequency.linearRampToValueAtTime(10, ctx.currentTime + 0.1); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1); }
    else if (type === 'orb') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15); g.gain.setValueAtTime(0.1, ctx.currentTime); }
    else if (type === 'click') { osc.type = 'square'; osc.frequency.setValueAtTime(1500, ctx.currentTime); g.gain.setValueAtTime(0.02, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03); osc.start(); osc.stop(ctx.currentTime + 0.03); return; }
    else if (type === 'boom') { osc.type = 'square'; osc.frequency.setValueAtTime(100, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.8); g.gain.setValueAtTime(0.3, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8); osc.start(); osc.stop(ctx.currentTime + 0.8); return; }
    else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, ctx.currentTime); g.gain.setValueAtTime(0.15, ctx.currentTime); }
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

const arcadeStorage = () => window.platanusArcadeStorage || {
  get: async (k) => {
    const v = localStorage.getItem(k);
    return v ? { found: true, value: JSON.parse(v) } : { found: false };
  },
  set: async (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

async function loadHighScores() {
  const s = arcadeStorage();
  const solo = await s.get(STORAGE_KEY_SOLO);
  const duel = await s.get(STORAGE_KEY_DUEL);
  return { solo: solo.found ? solo.value : [], duel: duel.found ? duel.value : [] };
}

async function saveHighScore(name, score, timeStr, mode) {
  const s = arcadeStorage();
  const key = mode === 'solo' ? STORAGE_KEY_SOLO : STORAGE_KEY_DUEL;
  const res = await s.get(key);
  let hs = res.found ? res.value : [];
  const entry = { name, score, date: Date.now() };
  if (mode === 'solo') entry.time = timeStr;
  hs.push(entry);
  hs.sort((a, b) => b.score - a.score);
  hs = hs.slice(0, 10);
  await s.set(key, hs);
  return hs;
}

function spectacularExplosion(s, x, y, color) {
  playSfx(s, 'boom');
  explode(s, x, y, color, 40); explode(s, x, y, 0xffffff, 20); explode(s, x, y, 0xffaa00, 30);
  for (let i = 0; i < 3; i++) {
    const ring = s.add.graphics({ x, y }); ring.lineStyle(4, 0xffffff, 0.8).strokeCircle(0, 0, 10);
    s.tweens.add({ targets: ring, scale: 15, alpha: 0, duration: 800 + i * 200, onComplete: () => ring.destroy() });
  }
  s.cameras.main.shake(600, 0.04);
  for(let i=0; i<4; i++) s.time.delayedCall(i*150, () => triggerGlitch(s));
}

function playLossMelody(s) {
  const ctx = s.game.sound.context; if (!ctx) return;
  const notes = [330, 311, 293, 277, 261, 246, 233, 220]; 
  notes.forEach((freq, i) => {
    s.time.delayedCall(i * 120, () => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    });
  });
}

function updateShowerAlert(s, time, poolSize) {
  if (!s.hud.showerAlert) s.hud.showerAlert = s.add.graphics().setDepth(50);
  const g = s.hud.showerAlert; g.clear();
  
  // Alert logic: 
  // Each direction cycle is 2000ms.
  // We want to show the alert for direction N starting 500ms BEFORE it starts spawning,
  // and keep it until 1000ms AFTER it starts spawning.
  // Total visibility: 1500ms.
  
  const cycleTime = time % 2000;
  let activeDir = -1;
  
  if (cycleTime > 1500) {
    // Warning for NEXT direction
    activeDir = (Math.floor(time / 2000) + 1) % poolSize;
  } else if (cycleTime < 1000) {
    // Persistence for CURRENT direction
    activeDir = Math.floor(time / 2000) % poolSize;
  }
  
  if (activeDir === -1) return;

  const intensity = 0.3 + Math.sin(s.time.now / 150) * 0.15, col = 0xff3300, th = 80;
  if (activeDir === 0) { // Right
    g.fillGradientStyle(col, col, col, col, 0, intensity, 0, intensity); g.fillRect(W - th, 0, th, H);
  } else if (activeDir === 1) { // Top
    g.fillGradientStyle(col, col, col, col, intensity, intensity, 0, 0); g.fillRect(0, 0, W, th);
  } else if (activeDir === 2) { // Left
    g.fillGradientStyle(col, col, col, col, intensity, 0, intensity, 0); g.fillRect(0, 0, th, H);
  } else if (activeDir === 3) { // Bottom
    g.fillGradientStyle(col, col, col, col, 0, 0, intensity, intensity); g.fillRect(0, H - th, W, th);
  }
}
