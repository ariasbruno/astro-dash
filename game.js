let S;
// Platanus Hack 26 — Astro Dash
// Top-down 1v1 space combat dogfighter.

/** 
 * OPTIMIZATION DICTIONARY (For 50KB Constraint)
 * -------------------------------------------
 * C      : Object containing all hex color codes (was COLORS).
 * rnd(m) : Helper for Math.random() * m. Defaults to 0-1 if m is null.
 * rB(a,b): Helper for Phaser.Math.Between(a, b).
 * POWS   : Powerup types stored as 1-char strings ('M', 'F', 'S', 'R').
 * SHIP_C : Array of ship color hex codes.
 * 
 * playSfx helpers:
 * sV : setValueAtTime | eR : exponentialRampToValueAtTime | lR : linearRampToValueAtTime
 */

const W = 800, H = 600;
const STORAGE_KEY_SOLO = 'platanus-hack-26-astrodash-solo-v1';
const STORAGE_KEY_DUEL = 'platanus-hack-26-astrodash-duel-v1';
const POWS = { MISSILE: 'M', FLARE: 'F', SHIELD: 'S', RAPID: 'R' };
const C = {
  bg: 0x05070a, p1: 0x00ff66, p2: 0xfacc15, debris: 0x444444, orb: 0x00ff88, black: 0,
  white: 0xffffff, accent: 0xfacc15, stable: 0x4fb89a, cell: 0x111111, frame: 0x333333, overlay: 0x020408,
  energy: 0xfacc15, dodge: 0x6366f1, missile: 0xff4422, flare: 0xff9900, shield: 0x00ccff, overdrive: 0xff5d00
};
const rnd = (m) => Math.random() * (m || 1), rB = Phaser.Math.Between;
const dist = Phaser.Math.Distance.Between, tween = (c) => S.tweens.add(c);
const delay = (ms, cb) => S.time.delayedCall(ms, cb), addPhys = (o) => S.physics.add.existing(o);
const SHIP_C = [0x00f2ff, 0xff00ea, 0xfbff00]; // Cyan, Magenta, Yellow
const S_SOLO = 'solo', S_DUEL = 'duel', S_PLAY = 'playing', S_GO = 'gameover', S_NE = 'nameEntry', S_LOAD = 'loading';
const drawS = (g, p) => { g.moveTo(p[0], p[1]); for(let i=2; i<p.length; i+=2) g.lineTo(p[i], p[i+1]); return g; };


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
const TX = (s, x, y, t, f, c, o, yO) => {
  const tx = s.add.text(x, y, t, { font: (f[0] == 'b' ? 'bold ' : '') + f.replace('b', '') + 'px monospace', fill: c });
  if (o != null) tx.setOrigin(o, yO ?? o); return tx;
};
const cA = c2s(C.accent), cS = c2s(C.stable), cSh = c2s(C.shield), cP1 = c2s(C.p1), cP2 = c2s(C.p2);

const config = {
  type: Phaser.AUTO, width: W, height: H, parent: 'game-root', backgroundColor: '#05070a',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() { }

function create() {
  S = this;
  S.state = {
    phase: S_LOAD, mode: S_SOLO, scores: { p1: 0, p2: 0 }, menu: { cursor: 0, cd: 0 }, round: 1,
    hSS: [], // highScoresSolo
    hSD: [], // highScoresDuel
    nE: { name: ['A', 'A', 'A'], idx: 0, cIdx: 0, winner: '', score: 0, cd: 0, timeStr: '' }, // nameEntry
    sT: 0, // spawnTimer
    oT: 0, // orbTimer
    pT: 0, // powTimer
    sC: 0, // showerCount
    nRT: 0, // nextRoundTime
    stT: 0, // startTime
    sP: false, // showerPending
    iSA: false, // isShowerActive
    bT: 0 // bossTension
  };

  const gridG = S.add.graphics();
  gridG.lineStyle(1, C.frame, 0.2);
  for (let x = 0; x <= 80; x += 40) gridG.lineBetween(x, 0, x, 40);
  for (let y = 0; y <= 80; y += 40) gridG.lineBetween(0, y, 40, y);
  gridG.generateTexture('grid', 40, 40);
  gridG.destroy();
  S.bgGrid = S.add.tileSprite(W / 2, H / 2, W, H, 'grid').setAlpha(0.3).setDepth(-10);

  // Parallax Layer 2: Deep Space Stars
  S.starsFar = [];
  for (let i = 0; i < 60; i++) {
    const st = S.add.circle(rnd(W), rnd(H), 0.5, C.white, 0.2);
    S.starsFar.push({ obj: st, s: 0.05 + rnd(0.1) });
  }

  // Parallax Layer 3: Near Bright Stars
  S.starsNear = [];
  for (let i = 0; i < 25; i++) {
    const st = S.add.circle(rnd(W), rnd(H), 1, C.white, 0.5);
    S.starsNear.push({ obj: st, s: 0.3 + rnd(0.5) });
  }

  // Parallax Layer 4: Tech Dust & Embers
  S.embers = [];
  for (let i = 0; i < 15; i++) {
    const d = S.add.rectangle(rnd() * W, rnd() * H, 2, 2, 0x4fb89a, 0.2);
    const e = S.add.circle(rnd() * W, rnd() * H, 1.5, 0xffaa00, 0.4);
    S.embers.push({ obj: d, s: 0.8 }, { obj: e, s: 1.2 });
  }

  S.ships = S.add.group();S.bullets = S.add.group();S.meteors = S.add.group();
  S.orbs = S.add.group();S.powerups = S.add.group();S.missiles = S.add.group();S.flares = S.add.group();
  S.enemies = S.add.group();
  S.particles = S.add.group({
    classType: Phaser.GameObjects.Rectangle,
    maxSize: 100,
    runChildUpdate: false
  });
  // Pre-create some particles for the pool
  for(let i=0; i<100; i++) {
    const p = S.add.rectangle(0, 0, 3, 3, 0xffffff);
    S.physics.add.existing(p);
    p.setActive(false).setVisible(false);
    S.particles.add(p);
  }

  S.p1 = createShip(150, H / 2, 'p1', C.p1);
  S.p2 = createShip(W - 150, H / 2, 'p2', C.p2);

  S.physics.add.overlap(S.bullets, S.ships, hitShip, null, S);
  S.physics.add.overlap(S.bullets, S.meteors, hitMeteor, null, S);
  S.physics.add.overlap(S.ships, S.meteors, crashShip, null, S);
  S.physics.add.overlap(S.ships, S.orbs, takeOrb, null, S);
  S.physics.add.overlap(S.ships, S.powerups, takePowerup, null, S);
  S.physics.add.overlap(S.missiles, S.ships, hitShipMissile, null, S);
  S.physics.add.overlap(S.missiles, S.meteors, hitMeteor, null, S);
  S.physics.add.overlap(S.missiles, S.flares, hitFlareMissile, null, S);
  S.physics.add.overlap(S.bullets, S.enemies, hitEnemy, null, S);
  S.physics.add.overlap(S.missiles, S.enemies, hitEnemyMissile, null, S);
  S.physics.add.overlap(S.ships, S.enemies, crashEnemy, null, S);
  S.physics.add.overlap(S.enemies, S.meteors, hitEnemyMeteor, null, S);

  initUi();initControls();
  S.add.container(0, 0).add(createScanlines()).setDepth(2000).setScrollFactor(0);
  loadHighScores().then(hs => {
    S.state.hSS = hs.solo;
    S.state.hSD = hs.duel;
    showStartScreen();
  });
}

function createScanlines() {
  const g = S.add.graphics();
  g.lineStyle(1, C.black, 0.15);
  for (let y = 0; y < H; y += 3) g.lineBetween(0, y, W, y);
  return g;
}

function update(time, delta) {
  const p = S.state.phase;
  if (p === 'start') handleStartMenu(time);
  else if (p === 'modeSelect') handleModeSelect(time);
  else if (p === 'leaderboard' || p === 'help') { if (consume(['START1', 'START2', 'P1_1', 'P2_1'])) showStartScreen(); }
  else if (p === 'test') { if (consume(['START1', 'START2'])) showStartScreen(); }
  else if (p === S_PLAY) {
    updateShips(time, delta); updateMeteors(time); updateOrbs(time); updatePowerups(time); updateMissiles(time);
    updateRounds(time, delta);

    // Background Parallax
    S.bgGrid.tilePositionX += 0.2;
    S.bgGrid.tilePositionY += 0.1;
    S.starsFar.forEach(st => { st.obj.x -= st.s; if (st.obj.x < 0) st.obj.x = W; });
    S.starsNear.forEach(st => { st.obj.x -= st.s; if (st.obj.x < 0) st.obj.x = W; });
    S.embers.forEach(e => { e.obj.x -= e.s; if (e.obj.x < 0) e.obj.x = W; });

    S.bullets.children.each(b => { if (b && b.active && (b.x < 0 || b.x > W || b.y < 0 || b.y > H)) safeDestroy(b); });
    if (consume(['START1', 'START2'])) pauseMatch();
  }
  else if (p === 'paused') { if (consume(['START1', 'START2'])) resumeMatch(); }
  else if (p === S_GO) {
    if (consume(['START1', 'START2', 'P1_1', 'P2_1'])) {
      if (S.state.mode === S_SOLO && S.state.gameoverDone && S.state.isHS) showNameEntry(S.state.winId, S.state.score, S.state.timeStr);
      else if (S.state.gameoverDone) returnToStart();
    }
  }
  else if (p === S_NE) handleNameEntry(time);
  if (p === 'test') updateTestScreen();
  updateMusic(time);
}

function createShip(x, y, id, color) {
  const c = S.add.container(x, y);
  c.id = id; c.isP1 = id === 'p1';
  const g = S.add.graphics();

  // Main Hull (Scaled Down Aggressive Design)
  drawS(g.lineStyle(2, color).beginPath(), [16, 0, 4, 9, -9, 10, -6, 4, -11, 4, -11, -4, -6, -4, -9, -10, 4, -9]).closePath().strokePath();

  // Cockpit & Interior Detailing
  drawS(g.lineStyle(1, color, 0.6).beginPath(), [7, 0, 0, 3, -4, 0, 0, -3]).closePath().strokePath();

  // Hull Reinforcement Lines
  g.lineStyle(1, color, 0.4);
  g.lineBetween(-1, 6, -6, 7);
  g.lineBetween(-1, -6, -6, -7);
  g.lineBetween(6, 2, 2, 2);
  g.lineBetween(6, -2, 2, -2);

  const reactor = S.add.graphics();
  const wingLights = S.add.graphics();
  const glow = S.add.graphics().fillStyle(color, 0.15).fillCircle(0, 0, 15);

  c.add([glow, reactor, wingLights, g]); S.physics.add.existing(c);
  c.body.setDrag(2000).setMaxVelocity(1200).setCircle(10, -10, -10).setCollideWorldBounds(true);
  Object.assign(
    c,
    { id, hp: 100, energy: 100, lastFire: 0, lastDash: 0, boostUntil: 0, lastHit: 0, color, shipColor: null, hasShield: false, dead: false, spType: null, spCount: 0, overdriveUntil: 0, overheated: false, mustRelease: false, reactor, wingLights, glow }
  );

  S.ships.add(c); return c;
}

function updateShips(time, delta) {
  [S.p1, S.p2].forEach((ship, i) => {
    if (ship.dead) return;
    if (S.state.mode === S_SOLO && !ship.isP1) return;
    const p = i === 0 ? 'P1' : 'P2', opp = i === 0 ? S.p2 : S.p1;
    const b = ship.body, curE = ship.energy;

    const isSolo = S.state.mode === S_SOLO && ship === S.p1;
    let vx = (held(p + '_R') || (isSolo && held('P2_R')) ? 1 : 0) - (held(p + '_L') || (isSolo && held('P2_L')) ? 1 : 0);
    let vy = (held(p + '_D') || (isSolo && held('P2_D')) ? 1 : 0) - (held(p + '_U') || (isSolo && held('P2_U')) ? 1 : 0);
    const speed = b.speed, isO = time < ship.overdriveUntil;
    if (vx !== 0 || vy !== 0) {
      const a = Math.atan2(vy, vx);
      ship.rotation = a;
      if (speed < 400) S.physics.velocityFromRotation(a, 320, b.velocity);
      if (isO || time % 60 < 20) spawnTrail(ship);
    }

    // Color Fire Logic (Buttons 1, 2, 3)
    const fs = isSolo ? [p + '_1', p + '_2', p + '_3', 'P2_1', 'P2_2', 'P2_3'] : [p + '_1', p + '_2', p + '_3'];
    const isOverdrive = isO;
    const isFiring = fs.some(k => held(k)), isOverheated = ship.overheated;
    const mustRelease = ship.mustRelease;

    if (!isFiring) ship.mustRelease = false;

    let actuallyFired = false;
    if (isFiring && !isOverheated && !mustRelease) {
      fs.forEach((fKey, i) => {
        if (held(fKey)) {
          ship.shipColor = SHIP_C[i % 3];
          if (time > ship.lastFire && (isOverdrive || curE >= 12)) {
            fireBullet(ship); ship.lastFire = time + 140;
            if (!isOverdrive) ship.energy = Math.max(0, curE - 12);
            actuallyFired = true;
          }
        }
      });
    }

    if (!actuallyFired) {
      ship.energy = Math.min(100, curE + delta * 0.045);
    }

    if (!isOverdrive && curE < 12 && isFiring && !isOverheated) {
      Object.assign(ship, { overheated: true, mustRelease: true }); playSfx('hit');
    }
    if (curE >= 50) ship.overheated = false;

    // Boost Logic (Button 4)
    const boostTriggered = consume(isSolo ? [p + '_4', 'P2_4'] : [p + '_4']);
    if (boostTriggered && time > ship.lastDash) {
      S.physics.velocityFromRotation(ship.rotation, 1200, b.velocity);
      ship.lastDash = time + 3000;
      ship.boostUntil = time + 200;
      playSfx('boost'); explode(ship.x, ship.y, isO ? C.overdrive : C.dodge, 4);
    }

    // Special / Shield Logic (Button 6)
    if (consume(isSolo ? [p + '_6', 'P2_6'] : [p + '_6'])) {
      const type = ship.spType;
      if (type === POWS.SHIELD) {
        Object.assign(ship, { hasShield: true, spType: null, spCount: 0 });
        playSfx('act');
      } else {
        fireSpecial(ship, opp);
      }
    }
    updateHud(ship, time);
    updateShipVisuals(ship);
    if (ship.hasShield) drawShield(ship);
  });
}

function updateShipVisuals(ship) {
  const hp = ship.hp, en = ship.energy, oh = ship.overheated;
  const reactor = ship.reactor, wingLights = ship.wingLights;
  const isDead = ship.dead;
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
    reactor.lineStyle(1, C.white, 0.5).strokeCircle(-10, 0, rSize + 2);
  }

  // 1.1 Update Glow (Aura)
  const glow = ship.glow;
  const isO = ship.scene.time.now < ship.overdriveUntil;
  const gCol = isO ? C.overdrive : ship.color;
  const gAlpha = isO ? 0.15 + Math.sin(ship.scene.time.now / 150) * 0.05 : 0.08;
  glow.clear().fillStyle(gCol, gAlpha).fillCircle(0, 0, 16);

  // 2. Update Wing Lights (Health)
  wingLights.clear();
  const hpSegments = hp > 66 ? 3 : (hp > 33 ? 2 : (hp > 0 ? 1 : 0));
  const isCritical = hp < 20;
  const flash = isCritical && (Math.floor(Date.now() / 200) % 2 === 0);

  const drawWing = (side) => {
    const yMult = side === 'top' ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const active = i < hpSegments;
      let col = ship.color;
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
    ship.setAlpha(0.6 + Math.sin(Date.now() / 100) * 0.3);
  } else {
    ship.setAlpha(1);
  }
}


function fireBullet(ship) {
  const isO = S.time.now < ship.overdriveUntil;
  const color = isO ? C.overdrive : (ship.shipColor || ship.color);
  const x = ship.x + Math.cos(ship.rotation) * 22, y = ship.y + Math.sin(ship.rotation) * 22;
  const b = S.add.container(x, y); b.rotation = ship.rotation;
  const laser = S.add.rectangle(0, 0, 10, 2, color);
  const core = S.add.rectangle(0, 0, 8, 1, 0xffffff);
  const glow = S.add.rectangle(0, 0, 14, 4, color, 0.4);
  b.add([glow, laser, core]);
  S.physics.add.existing(b); b.body.setCircle(3, -3, -3).setVelocity(Math.cos(ship.rotation) * 1200, Math.sin(ship.rotation) * 1200);
  Object.assign(b, { owner: ship.id, color });
  S.bullets.add(b); playSfx('pew');
}

function fireSpecial(ship, enemy) {
  const type = ship.spType, count = ship.spCount;
  if (!type || count <= 0) return;
  if (type === POWS.MISSILE) {
    playSfx('launch');
    const mis = S.add.container(ship.x, ship.y); mis.rotation = ship.rotation;
    mis.add([S.add.graphics().lineStyle(2, C.missile).strokeTriangle(10, 0, -5, 5, -5, -5), S.add.graphics().fillStyle(C.missile, 0.3).fillCircle(-2, 0, 8)]);
    S.physics.add.existing(mis); mis.body.setCircle(8, -8, -8).setVelocity(Math.cos(ship.rotation) * 400, Math.sin(ship.rotation) * 400);
    Object.assign(mis, { owner: ship.id, target: enemy, expiry: S.time.now + 5000 }); S.missiles.add(mis);
    playSfx('act');
  } else if (type === POWS.FLARE) {
    for (let i = 0; i < 10; i++) {
      S.time.delayedCall(i * 50, () => {
        if (!ship.active || ship.dead) return;
        const c = S.add.container(ship.x, ship.y);
        const fl = S.add.circle(0, 0, 3, C.white), gl = S.add.circle(0, 0, 10, C.flare, 0.5);
        c.add([gl, fl]); S.physics.add.existing(c);
        const a = ship.rotation + Math.PI + (rnd() - 0.5) * 2.5, spd = 50 + rnd() * 250;
        c.body.setCircle(5, -5, -5).setVelocity(Math.cos(a) * spd, Math.sin(a) * spd).setDrag(300);
        S.tweens.add({ targets: gl, alpha: 0.1, duration: 50 + rnd() * 50, yoyo: true, repeat: -1 });
        S.flares.add(c); S.time.delayedCall(1500 + rnd() * 1000, () => safeDestroy(c));
        playSfx('mortar');
      });
    }
  }
  const next = count - 1; Object.assign(ship, { spCount: next, spType: next <= 0 ? null : type });
}

function updateMissiles(time) {
  S.missiles.children.each(m => {
    if (!m || !m.active || !m.body) return;
    if (time > m.expiry) {
      const x = m.x, y = m.y, owner = m.owner;
      safeDestroy(m); missileExplode(x, y, owner);
      return;
    }

    const ownerId = m.owner;
    let target = null;
    let minDist = Infinity;

    // Scan for nearest active threat (Opponent ships or Interceptors)
    S.ships.children.each(ship => {
      if (ship.active && !ship.dead && ship.id !== ownerId) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, ship.x, ship.y);
        if (d < minDist) { minDist = d; target = ship; }
      }
    });

    S.enemies.children.each(enemy => {
      if (enemy.active && !enemy.dead && enemy.id !== ownerId) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, enemy.x, enemy.y);
        if (d < minDist) { minDist = d; target = enemy; }
      }
    });

    // Check for flare distractions
    S.flares.children.each(f => {
      if (f && f.active && Phaser.Math.Distance.Between(m.x, m.y, f.x, f.y) < 350) target = f;
    });

    if (!target) return;
    if (target === S.p1 && minDist < 500) {
      const now = S.time.now, last = target.lA || 0, iv = Phaser.Math.Clamp(minDist, 70, 500);
      if (now > last + iv) { playSfx('lock'); target.lA = now; }
    }

    const angle = Phaser.Math.Angle.Between(m.x, m.y, target.x, target.y);
    const turnRate = m.turnRate || 0.1;
    m.rotation = Phaser.Math.Angle.RotateTo(m.rotation, angle, turnRate);
    const speed = m.speed || 450;
    const vx = Math.cos(m.rotation) * speed, vy = Math.sin(m.rotation) * speed;
    m.body.setVelocity(vx, vy);

    if (time % 150 < 20) playSfx('thrum');

    if (time % 100 < 20) {
      const p = S.add.circle(m.x, m.y, 2, C.missile, 0.5);
      S.tweens.add({ targets: p, alpha: 0, scale: 2, duration: 400, onComplete: () => p.destroy() });
    }
  });
}

function drawPowerupIcon(g, type, color, sz) {
  g.clear();
  g.lineStyle(2, color).fillStyle(color, 0.2);
  if (type === POWS.MISSILE) {
    drawS(g.beginPath(), [0, -sz, sz * 0.8, sz, 0, sz * 0.5, -sz * 0.8, sz]).closePath().fillPath().strokePath();
    g.lineStyle(1, C.white, 0.5).strokeCircle(0, 0, sz * 0.4);
  } else if (type === POWS.FLARE) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.lineBetween(0, 0, Math.cos(a) * sz, Math.sin(a) * sz);
    }
    g.strokeCircle(0, 0, sz * 0.5);
  } else if (type === POWS.SHIELD) {
    const pts = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pts.push({ x: Math.cos(a) * sz, y: Math.sin(a) * sz }); }
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.forEach(p => g.lineTo(p.x, p.y)); g.closePath().fillPath().strokePath();
    g.lineStyle(1, color, 0.4).strokeCircle(0, 0, sz * 0.6);
  } else if (type === POWS.RAPID) {
    drawS(g.beginPath(), [-sz / 2, -sz, sz / 2, -sz / 4, 0, 0, sz / 2, sz, -sz / 2, sz / 4, 0, 0]).closePath().fillPath().strokePath();
  } else { // REPAIR (+)
    const r = sz * 0.4;
    g.lineStyle(2, color).strokeRoundedRect(-sz, -r, sz * 2, r * 2, 2).strokeRoundedRect(-r, -sz, r * 2, sz * 2, 2).fillRoundedRect(-sz, -r, sz * 2, r * 2, 2).fillRoundedRect(-r, -sz, r * 2, sz * 2, 2);
  }
}

function spawnPowerup() {
  const r = rnd();
  const type = r < 0.25 ? POWS.MISSILE : (r < 0.5 ? POWS.FLARE : (r < 0.75 ? POWS.SHIELD : POWS.RAPID));
  const x = 100 + rnd() * (W - 200), y = 100 + rnd() * (H - 200);
  const c = S.add.container(x, y);
  let color = C.missile;
  if (type === POWS.FLARE) color = C.flare;
  if (type === POWS.SHIELD) color = C.shield;
  if (type === POWS.RAPID) color = C.overdrive;

  const g = S.add.graphics(); drawPowerupIcon(g, type, color, 12);
  const glow = S.add.graphics().fillStyle(color, 0.1).fillCircle(0, 0, 20);
  c.add([glow, g]);
  S.physics.add.existing(c);
  c.body.setCircle(15, -15, -15);
  c.body.setAngularVelocity(100);
  c.type = type; S.powerups.add(c);
  S.time.delayedCall(10000, () => { if (c.active) safeDestroy(c); });
}


function updatePowerups(time) { if (time > S.state.pT) { spawnPowerup(); S.state.pT = time + 15000 + rnd() * 10000; } }

function takePowerup(ship, pow) {
  if (!pow.active || ship.dead) return;
  const type = pow.type;
  if (type === POWS.RAPID) {
    ship.overdriveUntil = this.time.now + 8000;
  } else {
    Object.assign(
      ship,
      { spType: type, spCount: type === POWS.MISSILE ? 3 : (type === POWS.FLARE ? 5 : 1) }
    );
  }
  addPoints(ship.id, 25, pow.x, pow.y);
  pickupJuice(ship, pow.color || C.white);
  if (pow.body) pow.body.enable = false;
  this.tweens.add({ targets: pow, scale: 0, duration: 150, onComplete: () => safeDestroy(pow) });
  playSfx('orb');
}

function pickupJuice(ship, col) {
  ship.setScale(1.2);
  S.tweens.add({ targets: ship, scale: 1, duration: 200 });
  const f = S.add.circle(ship.x, ship.y, 25, col, 0.4);
  S.tweens.add({ targets: f, alpha: 0, scale: 1.2, duration: 250, onComplete: () => f.destroy() });
}


function spawnMeteor(x, y, size = 40, color = C.debris) {
  if (x === undefined) {
    let valid = false, tries = 0;
    while (!valid && tries < 10) {
      const edge = Math.floor(rnd() * 4);
      x = edge < 2 ? (edge === 0 ? -50 : W + 50) : rnd() * W;
      y = edge < 2 ? rnd() * H : (edge === 2 ? -50 : H + 50);
      let tooClose = false; S.ships.children.iterate(ship => { if (Phaser.Math.Distance.Between(x, y, ship.x, ship.y) < 180) tooClose = true; });
      if (!tooClose) valid = true; tries++;
    }
  }
  const g = S.add.graphics().lineStyle(2, color); g.beginPath();
  const pts = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2, r = size * (0.6 + rnd() * 0.6);
    if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r); else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const m = S.add.container(x, y, [g.closePath().strokePath()]);
  const hitboxScale = size >= 20 ? 0.85 : 0.7;
  S.physics.add.existing(m); const speedMult = 1 + Math.floor((S.state.round - 1) / 5) * 0.25;
  m.body.setCircle(size * hitboxScale, -size * hitboxScale, -size * hitboxScale).setVelocity((rnd() - 0.5) * 120 * speedMult, (rnd() - 0.5) * 120 * speedMult).setAngularVelocity((rnd() - 0.5) * 100);
  Object.assign(m, { size, color }); S.meteors.add(m);
  return m;
}


function updateMeteors(time) {
  if (S.state.sP) {
    if (!S.hud.clearMsg) {
      S.hud.clearMsg = TX(S, W / 2, H - 50, '>>> ALERT: CLEAR SECTOR OF ALL REMAINING HAZARDS <<<', 'b20', '#ff4400', 0.5).setDepth(300);
      S.tweens.add({ targets: S.hud.clearMsg, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    }
    let hasBig = false;
    S.meteors.getChildren().forEach(m => { if (m && m.active && m.size > 25) hasBig = true; });
    if (!hasBig) {
      if (S.hud.clearMsg) { S.hud.clearMsg.destroy(); S.hud.clearMsg = null; }
      S.state.sP = false; S.state.iSA = true; S.state.sC++;
      const msg = TX(S, W / 2, H / 2 - 100, '!!! METEOR SHOWER !!!', 'b36', '#ff0', 0.5).setDepth(300);
      S.time.delayedCall(2000, () => msg.destroy());
    }
  }

  const timeRemainingInRound = S.state.nRT - time;
  const isSpawningPhase = timeRemainingInRound > 12500;

  const speedMult = 1 + Math.floor((S.state.round - 1) / 5) * 0.25;
  if (time > S.state.sT) {
    if (S.state.iSA) {
      const poolSize = Math.min(4, Math.floor((S.state.sC - 1) / 2) + 1);
      const spawnDirIndex = Math.floor(time / 2000) % poolSize;
      updateShowerAlert(time, poolSize);

      let x, y, vx, vy;
      if (spawnDirIndex === 0) { // Right to Left
        x = W + 60; y = rnd() * H; vx = -(400 + rnd() * 150) * speedMult; vy = (rnd() - 0.5) * 80 * speedMult;
      } else if (spawnDirIndex === 1) { // Top to Bottom
        x = rnd() * W; y = -60; vx = (rnd() - 0.5) * 80 * speedMult; vy = (400 + rnd() * 150) * speedMult;
      } else if (spawnDirIndex === 2) { // Left to Right
        x = -60; y = rnd() * H; vx = (400 + rnd() * 150) * speedMult; vy = (rnd() - 0.5) * 80 * speedMult;
      } else { // Bottom to Top
        x = rnd() * W; y = H + 60; vx = (rnd() - 0.5) * 80 * speedMult; vy = -(400 + rnd() * 150) * speedMult;
      }
      const m = spawnMeteor(x, y, 15 + rnd() * 15);
      if (m) m.isShower = true;
      if (m && m.body) m.body.setVelocity(vx, vy);
      S.state.sT = time + 160;
    } else {
      if (S.hud.showerAlert) S.hud.showerAlert.clear();
      if (!S.state.sP && isSpawningPhase) {
        const numAdditionalColors = Math.min(3, Math.max(0, S.state.round - 1));
        const available = [C.white];
        for (let i = 0; i < numAdditionalColors; i++) available.push(SHIP_C[i]);
        const color = available[Math.floor(rnd() * available.length)];
        spawnMeteor(undefined, undefined, 40, color);
        const capped = Math.min(4, S.state.round);
        const delay = Math.max(400, 2500 - (capped * 400));
        S.state.sT = time + delay;
      }
    }
    if (S.state.iSA && rnd() > 0.95) playSfx('whoosh');
  }

  S.meteors.getChildren().forEach(m => {
    if (m && m.active && (m.x < -100 || m.x > W + 100 || m.y < -100 || m.y > H + 100)) {
      if (!S.state.sP && !S.state.iSA && !m.isShower) {
        S.physics.world.wrap(m, 60);
      } else {
        m.destroy();
      }
    }
  });
}


function spawnOrb() {
  const x = 100 + rnd() * (W - 200), y = 100 + rnd() * (H - 200);
  const c = S.add.container(x, y);
  const g = S.add.graphics(); drawPowerupIcon(g, '+', C.orb, 10);
  const glow = S.add.graphics().fillStyle(C.orb, 0.15).fillCircle(0, 0, 20);
  c.add([glow, g]); S.physics.add.existing(c);
  c.body.setCircle(15, -15, -15);
  S.orbs.add(c);
  S.tweens.add({ targets: c, scale: 1.2, duration: 800, yoyo: true, repeat: -1 });
  S.time.delayedCall(8000, () => { if (c.active) safeDestroy(c); });
}

function updateOrbs(time) { if (time > S.state.oT) { spawnOrb(); S.state.oT = time + 12000 + rnd() * 8000; } }

function spawnBoss() {
  const startY = 100 + rnd() * (H - 200);
  const boss = S.add.container(-150, startY);
  const g = S.add.graphics();

  const nRed = 0xff3344, nOrng = 0xffaa00, nDarkRed = 0x880011, dBody = 0x050505;

  // V-Wings (Detailed layers)
  g.lineStyle(2, nRed).fillStyle(dBody);
  drawS(g.beginPath(), [100, 40, 0, -30, 40, 15, 90, 45]).closePath().fillPath().strokePath();
  drawS(g.beginPath(), [100, 60, 0, 130, 40, 85, 90, 55]).closePath().fillPath().strokePath();

  // Wing Ribs
  g.lineStyle(1, nRed, 0.4);
  for (let i = 1; i < 4; i++) {
    drawS(g.beginPath(), [12 * i, -30 + 22 * i, 25 * i, -5 + 18 * i]).strokePath();
    drawS(g.beginPath(), [12 * i, 130 - 22 * i, 25 * i, 105 - 18 * i]).strokePath();
  }

  // Central Hull & Brackets
  g.lineStyle(2, nRed).fillStyle(dBody);
  drawS(g.beginPath(), [160, 50, 80, 20, 50, 50, 80, 80]).closePath().fillPath().strokePath();

  g.lineStyle(1, nRed, 0.4);
  drawS(g.beginPath(), [150, 30, 175, 30, 175, 45]).strokePath();
  drawS(g.beginPath(), [150, 70, 175, 70, 175, 55]).strokePath();

  // Circuitry & Indicators
  g.lineStyle(1, nOrng);
  drawS(g.beginPath(), [40, 25, 80, 40]).strokePath();
  drawS(g.beginPath(), [40, 75, 80, 60]).strokePath();

  const drawT = (x, y, sz) => drawS(g.fillStyle(nOrng).beginPath(), [x, y - sz, x + sz, y + sz, x - sz, y + sz]).closePath().fill();
  [[15, -15], [15, 115], [125, 35], [125, 65], [60, 50]].forEach(p => drawT(p[0], p[1], 3));

  // Glowing Components
  const eng = S.add.circle(40, 50, 20, nRed, 0.2);
  S.tweens.add({ targets: eng, scale: 2.5, alpha: 0, duration: 800, repeat: -1 });

  const eye = S.add.rectangle(110, 50, 25, 4, nRed, 0.7);
  S.tweens.add({ targets: eye, alpha: 0.2, duration: 200, yoyo: true, repeat: -1 });

  boss.add([eng, g, eye]);
  S.physics.add.existing(boss);
  boss.body.setCircle(65, 22, -15);
  const bossHp = 150 + Math.floor((S.state.round - 3) / 3) * 50;
  Object.assign(boss, { id: 'boss', hp: bossHp, dead: false });
  S.enemies.add(boss);

  // Life: Engine Trail, Side Thrusters & Critical Damage
  S.time.addEvent({
    delay: 50, loop: true, callback: () => {
      if (!boss.active || boss.dead) return;
      const vy = boss.body.velocity.y, hp = boss.hp;

      // Main Trail
      const t = S.add.circle(boss.x + 20, boss.y + 50 + (rnd() - 0.5) * 20, 4 + rnd() * 8, nRed, 0.4);
      S.tweens.add({ targets: t, x: boss.x - 100, alpha: 0, scale: 0.1, duration: 400, onComplete: () => t.destroy() });

      // Side thrusters for vertical movement
      if (Math.abs(vy) > 20) {
        const py = vy > 0 ? -30 : 130;
        const st = S.add.circle(boss.x + 30, boss.y + py, 3 + rnd() * 3, 0x00ccff, 0.6);
        S.tweens.add({ targets: st, x: boss.x - 20, alpha: 0, duration: 200, onComplete: () => st.destroy() });
      }

      // Critical sparks
      if (hp < 30 && rnd() > 0.7) {
        explode(boss.x + rnd() * 150, boss.y + rnd() * 100, 0xffaa00, 2);
      }
    }
  });

  // Life: Dynamic tilt based on Y velocity
  S.time.addEvent({
    delay: 16, loop: true, callback: () => {
      if (!boss.active || boss.dead || boss.tilting) return;
      const vy = boss.body.velocity.y;
      boss.rotation = Phaser.Math.Angle.RotateTo(boss.rotation, vy * 0.001, 0.02);
    }
  });

  // Flicker effect & Burst Attack
  S.time.addEvent({
    delay: 50, loop: true, callback: () => {
      if (!boss.active) return;
      boss.alpha = rnd() > 0.95 ? 0.6 : 1;
    }
  });

  S.time.addEvent({
    delay: 2500, loop: true, callback: () => {
      if (!boss.active || boss.dead || S.state.phase !== S_PLAY) return;
      const dst = dist(boss.x + 80, boss.y + 50, S.p1.x, S.p1.y);
      if (dst < 450) {
        for (let i = 0; i < 3; i++) {
          delay(i * 120, () => {
            if (!boss.active || boss.dead) return;
            const b = S.add.circle(boss.x + 160, boss.y + 50, 4, nRed);
            addPhys(b);
            const angle = Phaser.Math.Angle.Between(boss.x + 160, boss.y + 50, S.p1.x, S.p1.y);
            S.physics.velocityFromRotation(angle, 550, b.body.velocity);
            Object.assign(b, { owner: 'boss', color: nRed });
            S.bullets.add(b); playSfx('pew');
          });
        }
      }
    }
  });

  const tx = tween({ targets: boss, x: W + 200, duration: 6000, ease: 'Linear', onComplete: () => { 
    if (boss.active) {
      tween({ targets: S.state, bT: 0, duration: 2000, ease: 'Power2' });
      boss.destroy(); 
    }
  } });
  const ty = S.tweens.add({ targets: boss, y: startY + 120, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  boss.tweens = [tx, ty];

  const missileCount = S.state.round / 3;
  const duration = 5000;
  const windowStart = 800;
  const windowEnd = 4200;
  const step = (windowEnd - windowStart) / Math.max(1, missileCount);

  for (let i = 0; i < missileCount; i++) {
    const delay = windowStart + (i * step) + (rnd() * step * 0.8);
    S.time.delayedCall(Math.min(delay, duration - 500), () => {
      if (boss && boss.active && S.state.phase === S_PLAY) fireBossMissile(boss);
    });
  }

  const alert = TX(S, W / 2, 100, '!!! ENEMY INTERCEPTOR !!!', 'b24', '#f33', 0.5).setDepth(500);
  S.time.delayedCall(2000, () => alert.destroy());
  playSfx('dash');
}

function fireBossMissile(boss) {
  if (!S.p1 || !S.p1.active) return;
  const mis = S.add.container(boss.x, boss.y + 50);
  mis.add(S.add.circle(0, 0, 8, C.missile));
  S.physics.add.existing(mis);
  if (mis.body) {
    mis.body.setCircle(8, -8, -8).setVelocity(350, 0);
    Object.assign(
      mis,
      { owner: 'boss', target: S.p1, expiry: S.time.now + 8000, speed: 350, turnRate: 0.06 }
    );
    S.missiles.add(mis);
    playSfx('dash');
  }
}

function takeOrb(ship, orb) {
  if (!orb.active || ship.dead) return;
  ship.hp = Math.min(100, ship.hp + 25);
  addPoints(ship.id, 25, orb.x, orb.y);
  pickupJuice(ship, C.orb);
  if (orb.body) orb.body.enable = false;
  this.tweens.add({ targets: orb, scale: 0, duration: 150, onComplete: () => safeDestroy(orb) });
  playSfx('orb');
}

function hitFlareMissile(mis, fl) {
  const x = mis.x, y = mis.y, owner = mis.owner;
  safeDestroy(mis); safeDestroy(fl);
  missileExplode(x, y, owner);
}

function safeDestroy(obj) {
  if (!obj || !obj.active) return;
  if (obj.body) { obj.body.enable = false; obj.body.setVelocity(0); }
  obj.setPosition(-2000, -2000); obj.active = false; obj.destroy();
}

function hitShip(bullet, ship) {
  if (!bullet.active || bullet.owner === ship.id) return;
  addPoints(bullet.owner, 100, bullet.x, bullet.y);
  safeDestroy(bullet); dmgShip(ship, 10); explode(bullet.x, bullet.y, ship.color, 5);
}
function hitShipMissile(missile, ship) {
  if (!missile.active || missile.owner === ship.id) return;
  const x = missile.x, y = missile.y, owner = missile.owner;
  if (owner === 'p1' || owner === 'p2') addPoints(owner, 250, x, y);
  dmgShip(ship, 30); safeDestroy(missile);
  missileExplode(x, y, owner, ship);
}

function hitEnemy(bullet, enemy) {
  if (!bullet.active || bullet.owner === 'boss') return;
  const owner = bullet.owner;
  safeDestroy(bullet);
  dmgEnemy(enemy, 10, owner);
  explode(bullet.x, bullet.y, 0xff3344, 5);
}

function hitEnemyMissile(missile, enemy) {
  if (!missile.active || missile.owner === 'boss') return;
  const x = missile.x, y = missile.y, owner = missile.owner;
  safeDestroy(missile); dmgEnemy(enemy, 30, owner);
  missileExplode(x, y, owner, enemy);
}

function hitEnemyMeteor(enemy, meteor) {
  if (!meteor.active || enemy.dead) return;
  explode(meteor.x, meteor.y, meteor.color || C.debris, 5);
  safeDestroy(meteor);
  playSfx('hit');
}

function dmgEnemy(enemy, amt, owner) {
  if (enemy.dead) return;
  const hp = enemy.hp - amt;
  enemy.hp = hp;

  // Flash & Shake effect
  enemy.setAlpha(0.5);
  const shakeX = (rnd() - 0.5) * 10, shakeY = (rnd() - 0.5) * 10;
  enemy.x += shakeX; enemy.y += shakeY;

  // Aggressive Tilt Dodge on heavy hit
  if (amt >= 30) {
    const side = rnd() > 0.5 ? 1 : -1;
    enemy.tilting = true;
    S.tweens.add({
      targets: enemy,
      angle: 35 * side,
      duration: 150,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => { if (enemy.active) enemy.tilting = false; }
    });
  }
  S.time.delayedCall(50, () => {
    if (enemy.active) {
      enemy.setAlpha(1);
      enemy.x -= shakeX; enemy.y -= shakeY;
    }
  });
  playSfx('hit');

  if (hp <= 0) {
    enemy.dead = true;
    const { x, y } = enemy;
    const tweens = enemy.tweens;
    if (tweens) tweens.forEach(t => t.stop());

    addPoints(owner, 1000, x + 80, y + 50);
    spectacularExplosion(x + 80, y + 50, 0xff3344);
    S.tweens.add({ targets: S.state, bT: 0, duration: 2000, ease: 'Power2' });
    enemy.destroy();
  }
}

function hitMeteor(bullet, meteor) {
  if (!meteor.active || (bullet && !bullet.active)) return;
  if (bullet && bullet.color === meteor.color) return;
  const s = this, isM = bullet && s.missiles.contains(bullet), mX = meteor.x, mY = meteor.y;
  let owner = null;
  if (bullet) {
    const sz = meteor.size;
    const pts = sz >= 40 ? 50 : (sz >= 20 ? 150 : 300);
    owner = bullet.owner;
    addPoints(owner, pts, mX, mY);
    safeDestroy(bullet);
    for (let i = 0; i < 4; i++) {
      const p = s.add.rectangle(mX, mY, 2, 2, C.white);
      s.physics.add.existing(p);
      const a = rnd() * Math.PI * 2, spd = 200 + rnd() * 200;
      p.body.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd).setDrag(800);
      s.tweens.add({ targets: p, alpha: 0, duration: 300, onComplete: () => p.destroy() });
    }
  }
  const sz = meteor.size;
  explode(mX, mY, C.debris, sz / 8);
  if (sz > 18) { spawnMeteor(mX, mY, sz / 2); spawnMeteor(mX, mY, sz / 2); }
  safeDestroy(meteor);
  if (isM) missileExplode(mX, mY, owner);
  else playSfx('hit');
}

function crashShip(ship, meteor) {
  if (!meteor.active || ship.dead || this.time.now < ship.lastHit + 200) return;
  const mColor = meteor.color, sz = meteor.size;
  if (ship.shipColor === mColor) {
    explode(meteor.x, meteor.y, mColor, 5); safeDestroy(meteor); playSfx('pew'); return;
  }
  ship.lastHit = this.time.now;
  dmgShip(ship, Math.floor(sz / 2));
  explode(meteor.x, meteor.y, mColor || C.debris, 5); safeDestroy(meteor); playSfx('hit');
}


function crashEnemy(ship, enemy) {
  if (ship.dead || enemy.dead || this.time.now < ship.lastHit + 200) return;
  ship.lastHit = this.time.now;
  dmgShip(ship, 25);
  dmgEnemy(enemy, 20, ship.id);
  explode(ship.x, ship.y, 0xff3344, 10);
  playSfx('hit');
}

function dmgShip(ship, amt) {
  if (ship.dead) return;
  if (ship.hasShield) {
    ship.hasShield = false;
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
    playSfx('dash'); explode(ship.x, ship.y, C.shield, 10);
    return;
  }
  const hp = Math.max(0, ship.hp - amt); ship.hp = hp;

  // Hit Feedback: Sound, Stop & Shake
  playSfx('hit');
  const intens = 0.01 + (amt * 0.001);
  S.cameras.main.shake(100 + amt * 5, intens);
  S.physics.world.pause();
  S.time.delayedCall(50, () => S.physics.world.resume());

  // Glitch Flash Effect
  const flash = S.add.graphics().fillStyle(C.white, 0.8).fillCircle(0, 0, 20);
  ship.add(flash);
  S.time.delayedCall(50, () => flash.destroy());

  ship.setAlpha(0.3);
  S.time.delayedCall(80, () => { if (ship.active) ship.setAlpha(1); });

  if (hp <= 0) {
    const { x, y } = ship;
    Object.assign(ship, {
      dead: true
    }).setVisible(false);
    if (ship.body) { ship.body.enable = false; ship.body.setVelocity(0, 0); }
    ship.setPosition(-1000, -1000);
    if (S.state.mode === S_SOLO) spectacularExplosion(x, y, ship.color);
    else explode(x, y, ship.color, 25);
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
    S.time.delayedCall(1200, () => endMatch());
  }
}


function updateHud(ship, time) {
  const id = ship.id, h = S.hud[id];
  const hp = Math.ceil(ship.hp), en = Math.floor(ship.energy), score = S.state.scores[id];
  const sh = ship.hasShield, ld = ship.lastDash;
  const type = ship.spType, count = ship.spCount;
  const isOverdrive = time < ship.overdriveUntil;

  if (hp !== h.lastHp) {
    const hpCol = hp > 60 ? '#00ff66' : (hp > 30 ? '#ffcc00' : '#ff4422');
    h.hp.setText(`${id.toUpperCase()} // HULL ${hp > 0 ? hp + '%' : 'TERMINATED'}`).setFill(hpCol);
    h.lastHp = hp;
  }

  if (sh !== h.lastSh) {
    h.shInd.setVisible(sh);
    h.lastSh = sh;
  }
  if (sh) h.shInd.setAlpha(0.6 + Math.sin(time / 100) * 0.4);

  if (en !== h.lastEn || isOverdrive !== h.lastO) {
    if (isOverdrive) h.enBar.setText(`!! OVERDRIVE_ACTIVE !!`).setTint(C.overdrive);
    else {
      const shots = Math.floor(en / 12);
      h.enBar.setText(`ENERGY: ${shots > 0 ? '█'.repeat(shots) : '---'} (${en}%)`).clearTint();
    }
    h.lastEn = en; h.lastO = isOverdrive;
  }

  if (score !== h.lastScore) {
    h.score.setText(`ARCHIVE: ${String(score).padStart(6, '0')}`);
    h.lastScore = score;
  }

  if (type !== h.lastT || count !== h.lastC) {
    h.sp.setText(type ? `>> SP_WEAPON: ${type === POWS.MISSILE ? 'MISSILES' : (type === POWS.FLARE ? 'FLARES' : 'SHIELD')} [${count}]` : '');
    h.lastT = type; h.lastC = count;
  }

  const dReady = Math.max(0, ld - time) <= 0;
  if (dReady !== h.lastD || !dReady) {
    const g = h.dodgeInd; g.clear();
    const ox = id === 'p1' ? 0 : -60;
    g.lineStyle(1, 0x888888, 0.4).strokeRect(ox, 48, 60, 10);
    if (dReady) g.fillStyle(C.dodge, 0.8).fillRect(ox + 2, 50, 56, 6);
    else {
      const pct = Math.max(0, 1 - (ld - time) / 3000);
      g.fillStyle(0x444444, 0.8).fillRect(ox + 2, 50, 56 * pct, 6);
    }
    h.lastD = dReady;
  }


  if (S.state.phase === S_PLAY) {
    const elapsed = S.time.now - S.state.stT;
    const mins = Math.floor(elapsed / 60000), secs = Math.floor((elapsed % 60000) / 1000);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const remaining = Math.max(0, Math.ceil((S.state.nRT - time) / 1000));

    if (S.state.mode === S_SOLO) {
      S.hud.timer.setText(`TIME ${timeStr} // ROUND ${S.state.round} (NEXT ${remaining}s)`);
    } else {
      S.hud.timer.setText(`ROUND ${S.state.round} // NEXT IN ${remaining}s`);
    }
  }
}

function showPoints(x, y, amt, color) {
  const t = TX(S, x, y, `+${amt}`, 'b24', c2s(color));
  t.setOrigin(0.5).setDepth(200);
  S.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

function addPoints(id, amt, x, y) {
  if (S.state.phase !== S_PLAY || S.state.scores[id] === undefined) return;
  S.state.scores[id] += amt;
  if (x !== undefined && y !== undefined && C[id]) showPoints(x, y, amt, C[id]);
}

function updateRounds(time, delta) {
  if (S.state.sP) {
    S.state.nRT += delta;
    return;
  }

  if (time > S.state.nRT) {
    S.state.round++;
    S.state.nRT = time + 25000;
    S.state.sT = time + 1000;
    S.state.iSA = false;
    S.state.sP = false;
    const bonus = S.state.round * 500;
    addPoints('p1', bonus);
    if (S.state.mode === S_DUEL) addPoints('p2', bonus);

    // Visual Announcement
    const msg = TX(S, W / 2, H / 2, `ROUND ${S.state.round}\nMETEOR INTENSITY UP!`, 'b42', cA, 0.5).setDepth(300).setScale(0).setAlign('center');
    S.tweens.add({ targets: msg, scale: 1, duration: 500, ease: 'Back.out' });
    S.time.delayedCall(2000, () => S.tweens.add({ targets: msg, alpha: 0, scale: 1.5, duration: 500, onComplete: () => msg.destroy() }));

    if (S.state.mode === S_SOLO && S.state.round % 3 === 0) {
      S.tweens.add({ targets: S.state, bT: 1, duration: 2500, ease: 'Power2' });
      S.time.delayedCall(3000, () => spawnBoss());
    }
    if (S.state.round >= 5 && (S.state.round - 5) % 4 === 0) {
      S.state.sP = true;
    }
    playSfx('dash');
  }
}

function explode(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const p = S.add.circle(x, y, 2 + rnd() * 3, color);
    S.physics.add.existing(p);
    p.body.setVelocity((rnd() - 0.5) * 400, (rnd() - 0.5) * 400).setDrag(200);
    S.tweens.add({ targets: p, alpha: 0, scale: 0.1, duration: 500 + rnd() * 500, onComplete: () => p.destroy() });
  }
  if (count > 15) triggerGlitch();
}

function triggerGlitch() {
  const intensity = 8;
  S.tweens.add({
    targets: S.cameras.main,
    x: { from: -intensity, to: intensity },
    duration: 40,
    yoyo: true,
    repeat: 3,
    onComplete: () => { S.cameras.main.x = 0; }
  });
}

function missileExplode(x, y, owner, directHit) {
  explode(x, y, C.missile, 20);
  playSfx('mExp');
  [60, 100, 150].forEach((r, i) => {
    const ring = S.add.circle(x, y, 10, C.missile, 0.3 - i * 0.1);
    S.tweens.add({ targets: ring, radius: r, alpha: 0, duration: 400 + i * 200, onComplete: () => ring.destroy() });
  });
  const targets = [...S.ships.getChildren(), ...S.enemies.getChildren(), ...S.meteors.getChildren()];
  targets.forEach(t => {
    if (!t.active || t.dead) return;
    const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
    if (d > 150) return;
    if (t === S.p1 || t === S.p2) {
      if (t === directHit) return;
      let dmg = d < 60 ? 20 : (d < 100 ? 10 : 5);
      dmgShip(t, dmg);
    } else {
      let dmg = (d < 60 ? 20 : 0) + (d < 100 ? 10 : 0) + (d < 150 ? 5 : 0);
      if (dmg > 0) {
        if (S.meteors.contains(t)) {
          explode(t.x, t.y, t.color || C.debris, 5); safeDestroy(t);
        } else {
          dmgEnemy(t, dmg, owner);
        }
      }
    }
  });
}

function spawnTrail(ship) {
  const isOverdrive = S.time.now < ship.overdriveUntil;
  const hp = ship.hp, color = isOverdrive ? C.overdrive : (ship.shipColor || ship.color);
  const isSputtering = hp < 30 && (Math.floor(S.time.now / 100) % 2 === 0);
  if (!isSputtering) {
    const fX = ship.x - Math.cos(ship.rotation) * 10, fY = ship.y - Math.sin(ship.rotation) * 10;
    const f = S.particles.get();
    if (f) {
      f.setActive(true).setVisible(true).setFillStyle(color, 0.8).setAlpha(1).setScale(1);
      if (f.body) { f.body.enable = true; f.body.reset(fX, fY); }
      S.tweens.add({ targets: f, x: fX - Math.cos(ship.rotation) * 20, y: fY - Math.sin(ship.rotation) * 20, scale: 0.1, alpha: 0, duration: 300, onComplete: () => { f.setActive(false).setVisible(false); if (f.body) f.body.enable = false; } });
    }
  }
  if (hp < 80 && rnd() < (80 - hp) / 70) {
    const sm = S.particles.get();
    if (sm) {
      sm.setActive(true).setVisible(true).setFillStyle(color, 0.25).setAlpha(1).setScale(1);
      if (sm.body) { sm.body.enable = true; sm.body.reset(ship.x, ship.y); }
      S.tweens.add({ targets: sm, x: ship.x + (rnd() - 0.5) * 40, y: ship.y + (rnd() - 0.5) * 40, scale: 4 + rnd() * 2, alpha: 0, duration: 800 + rnd() * 500, onComplete: () => { sm.setActive(false).setVisible(false); if (sm.body) sm.body.enable = false; } });
    }
  }
}

function drawShield(ship) {
  if (!ship.shieldVisual) {
    ship.shieldVisual = S.add.graphics();
    ship.add(ship.shieldVisual);
  }
  ship.shieldVisual.clear().lineStyle(2, C.shield, 0.6).strokeCircle(0, 0, 20 + Math.sin(S.time.now / 100) * 2);
}


function initUi() {
  const f = 'b18', sf = '12';

  // HUD Containers for P1 and P2
  const p1H = S.add.container(25, 25).setDepth(500);
  const p2H = S.add.container(W - 25, 25).setDepth(500);

  S.hud = {
    p1: {
      hp: TX(S, 0, 0, 'P1 // HULL OK', f, cP1),
      enBar: TX(S, 0, 25, 'ENERGY: 100%', sf, '#888'),
      dodgeInd: S.add.graphics(),
      shInd: TX(S, 0, 65, '>> DEFENSE: [ SHIELD_UP ]', sf, cSh).setVisible(false),
      sp: TX(S, 0, 85, '', sf, '#f22'),
      score: TX(S, 0, 105, 'ARCHIVE: 000000', sf, cP1),
      lastHp: -1, lastEn: -1, lastScore: -1, lastSh: null, lastT: null, lastC: -1, lastD: null, lastO: null
    },
    p2: {
      hp: TX(S, 0, 0, 'P2 // HULL OK', f, cP2, 1, 0),
      enBar: TX(S, 0, 25, 'ENERGY: 100%', sf, '#888', 1, 0),
      dodgeInd: S.add.graphics(),
      shInd: TX(S, 0, 65, '[ SHIELD_UP ] :DEFENSE <<', sf, cSh, 1, 0).setVisible(false),
      sp: TX(S, 0, 85, '', sf, cP2, 1, 0),
      score: TX(S, 0, 105, 'ARCHIVE: 000000', sf, cP2, 1, 0),
      lastHp: -1, lastEn: -1, lastScore: -1, lastSh: null, lastT: null, lastC: -1, lastD: null, lastO: null
    },
    timer: TX(S, W / 2, 25, '', 'b16', '#888', 0.5).setDepth(500)
  };

  p1H.add([S.hud.p1.hp, S.hud.p1.enBar, S.hud.p1.dodgeInd, S.hud.p1.shInd, S.hud.p1.sp, S.hud.p1.score]);
  p2H.add([S.hud.p2.hp, S.hud.p2.enBar, S.hud.p2.dodgeInd, S.hud.p2.shInd, S.hud.p2.sp, S.hud.p2.score]);

  S.scrStart = createStartScreen();
  S.scrMode = createModeSelectScreen();
  S.scrGeneric = createOverlay('', []); S.scrGameOver = createOverlay('MATCH OVER', []);
  S.scrName = createNameEntryScreen();
}

function createModeSelectScreen() {
  const c = S.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(S.add.rectangle(W / 2, H / 2, W, H, C.overlay, 1));
  c.add(TX(S, W / 2, 120, 'SELECT OPERATION', 'b42', cA, 0.5));

  const modes = [
    { id: S_SOLO, name: '1 PLAYER: RESISTANCE', desc: 'Survive the meteor storm as long as possible.' },
    { id: S_DUEL, name: '2 PLAYERS: DUEL (1V1)', desc: 'Standard dogfight. Last pilot standing wins.' }
  ];

  const btns = modes.map((m, i) => {
    const y = 280 + i * 140;
    const bg = S.add.rectangle(W / 2, y, 500, 100, C.cell).setStrokeStyle(2, C.frame);
    const title = TX(S, W / 2, y - 20, m.name, 'b24', '#fff', 0.5);
    const desc = TX(S, W / 2, y + 20, m.desc, '14', cS, 0.5);
    c.add([bg, title, desc]); return { bg, title, desc };
  });

  const help = TX(S, W / 2, H - 60, 'JOYSTICK U/D: NAVIGATE | START: INITIATE', '14', '#888', 0.5);
  c.add(help);

  return { c, btns };
}

function createNameEntryScreen() {
  const c = S.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(S.add.rectangle(W / 2, H / 2, W, H, C.overlay, 0.98));
  const t1 = TX(S, W / 2, 120, 'NEW HIGH SCORE!', 'b42', cA, 0.5);
  const t2 = TX(S, W / 2, 180, 'PILOT IDENTIFICATION', 'b24', '#fff', 0.5);

  const charTexts = [0, 1, 2].map(i => TX(S, W / 2 - 60 + i * 60, H / 2, 'A', 'b64', '#fff', 0.5));
  const underline = S.add.graphics().lineStyle(4, C.accent).lineBetween(-25, 40, 25, 40);
  const cursor = S.add.container(W / 2 - 60, H / 2).add(underline);

  const confirmMsg = TX(S, W / 2, H / 2 + 80, '>>> CONFIRM NAME? [START] YES / [ACTION] EDIT <<<', 'b18', cP2, 0.5).setVisible(false);
  const help = TX(S, W / 2, H - 120, 'JOYSTICK L/R: POSITION | U/D: CHANGE CHAR\nSTART: CONFIRM NAME', 'b16', cS, 0.5).setAlign('center');

  c.add([t1, t2, ...charTexts, cursor, confirmMsg, help]);
  return { c, chars: charTexts, cursor, t1, help, confirmMsg };
}

function createStartScreen() {
  const c = S.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(S.add.rectangle(W / 2, H / 2, W, H, C.overlay, 1));

  // OS Header
  const headerBg = S.add.graphics().fillStyle(0x0a0a0a, 0.9).fillRect(0, 0, W, 50);
  const headerLine = S.add.graphics().lineStyle(2, C.accent, 0.5).lineBetween(0, 50, W, 50);
  const osTitle = TX(S, 25, 15, 'ASTRO_DASH // V5', 'b18', cA);
  const sysInfo = TX(S, W - 25, 18, 'CORE_TEMP: 42°C | MEMORY: 92% | SECTOR: 7G', '12', cS, 1, 0);
  c.add([headerBg, headerLine, osTitle, sysInfo]);

  S.time.addEvent({
    delay: 150, loop: true, callback: () => {
      if (S.state.phase === 'start') sysInfo.setText(`CORE_TEMP: ${41 + Math.floor(rnd() * 4)}°C | MEMORY: ${91 + Math.floor(rnd() * 6)}% | SECTOR: ${Math.floor(rnd() * 9)}G`);
    }
  });

  drawHazardStripes(c, 0, H - 25, W, 25);

  // Left Section: Interaction Console
  const leftX = 50, leftY = 100, leftW = 320, leftH = 440;
  const leftBox = drawTechFrame(leftX, leftY, leftW, leftH, C.frame);
  const leftTitle = TX(S, leftX + leftW / 2, leftY + 30, '┌ PILOT CONSOLE ┐', 'b24', '#fff', 0.5, 0);
  const leftSub = TX(S, leftX + leftW / 2, leftY + 70, 'STATION_7G // STANDBY', '12', cS, 0.5, 0);
  c.add([leftBox, leftTitle, leftSub]);

  const buttons = ['PLAY', 'HELP', 'TEST'];
  const btns = buttons.map((txt, i) => {
    const y = leftY + 180 + i * 85;
    const bg = S.add.rectangle(leftX + leftW / 2, y, 240, 55, C.cell).setStrokeStyle(2, C.frame);
    const label = TX(S, leftX + leftW / 2, y, `[ ${txt} ]`, 'b20', '#fff', 0.5);
    c.add([bg, label]); return { bg, label };
  });

  // Right Section: Global Ranking
  const rightX = 400, rightY = 100, rightW = 350, rightH = 440;
  const rightBox = drawTechFrame(rightX, rightY, rightW, rightH, C.frame);
  const rightTitle = TX(S, rightX + rightW / 2, rightY + 30, '┌ PILOT RANKINGS ┐', 'b24', '#fff', 0.5, 0);
  c.add([rightBox, rightTitle]);

  const sbSoloHeader = TX(S, rightX + 90, rightY + 100, '--- SOLO_RECORD ---', 'b12', cP1, 0.5);
  const sbSoloText = TX(S, rightX + 90, rightY + 130, 'LOADING...', '13', '#fff', 0.5, 0).setAlign('center').setLineSpacing(4);

  const sbDuelHeader = TX(S, rightX + 260, rightY + 100, '--- DUEL_RECORD ---', 'b12', cP2, 0.5);
  const sbDuelText = TX(S, rightX + 260, rightY + 130, 'LOADING...', '13', '#fff', 0.5, 0).setAlign('center').setLineSpacing(4);

  c.add([sbSoloHeader, sbSoloText, sbDuelHeader, sbDuelText]);

  return { c, btns, sbSoloText, sbDuelText };
}

function drawTechFrame(x, y, w, h, color) {
  const g = S.add.graphics();
  g.lineStyle(1, color, 0.5);
  g.strokeRect(x, y, w, h);

  // Decorative Corners
  g.lineStyle(3, color, 1);
  const l = 20;
  g.lineBetween(x, y, x + l, y); g.lineBetween(x, y, x, y + l); // TL
  g.lineBetween(x + w, y, x + w - l, y); g.lineBetween(x + w, y, x + w, y + l); // TR
  g.lineBetween(x, y + h, x + l, y + h); g.lineBetween(x, y + h, x, y + h - l); // BL
  g.lineBetween(x + w, y + h, x + w - l, y + h); g.lineBetween(x + w, y + h, x + w, y + h - l); // BR

  // Tech labels
  const label = TX(S, x + w - 5, y + h + 5, 'SYS_REF: ' + rnd().toString(16).slice(2, 8).toUpperCase(), '9', c2s(color), 1, 0).setAlpha(0.6);
  const container = S.add.container(0, 0, [g, label]);
  return container;
}

function drawHazardStripes(container, x, y, w, h) {
  const g = S.add.graphics();
  g.fillStyle(C.accent, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(8, 0x000000, 1);
  for (let i = 0; i < w; i += 20) {
    g.lineBetween(x + i, y + h, x + i + 10, y);
  }
  container.add(g);
}

function createOverlay(title, buttons) {
  const c = S.add.container(0, 0).setDepth(1000).setVisible(false);
  c.add(S.add.rectangle(W / 2, H / 2, W, H, C.overlay, 1));
  const tText = TX(S, W / 2, 140, title, 'b64', cA, 0.5);
  c.add(tText);
  const btns = buttons.map((txt, i) => {
    const y = 300 + i * 70; const bg = S.add.rectangle(W / 2, y, 280, 45, C.cell).setStrokeStyle(2, C.frame);
    const label = TX(S, W / 2, y, `[ ${txt} ]`, 'b22', '#fff', 0.5);
    c.add([bg, label]); return { bg, label };
  });
  return { c, btns, t: tText };
}

function showStartScreen() {
  S.state.phase = 'start';
  S.scrStart.c.setVisible(true);
  S.scrMode.c.setVisible(false);
  S.scrGeneric.c.setVisible(false);
  S.scrGameOver.c.setVisible(false);
  S.scrName.c.setVisible(false);
  S.state.menu.cd = S.time.now + 500;
  S.controls.pressed = {};
  [S.hud.p1, S.hud.p2].forEach(hSide => Object.values(hSide).forEach(h => h && h.setVisible && h.setVisible(false)));
  S.hud.timer.setVisible(false);
  updateScoreboardUi(); updateMenu();
}
function updateScoreboardUi() {
  const solo = S.state.hSS;
  const duel = S.state.hSD;

  const soloTxt = solo.length ? solo.slice(0, 5).map((e, i) => `${i + 1}. ${e.name.padEnd(3)} ${String(e.score).padStart(6, '0')}\n${e.time || '00:00'}`).join('\n\n') : 'NO DATA FOUND';
  const duelTxt = duel.length ? duel.slice(0, 5).map((e, i) => `${i + 1}. ${e.name.padEnd(3)} ${String(e.score).padStart(6, '0')}`).join('\n\n') : 'NO DATA FOUND';

  S.scrStart.sbSoloText.setText(soloTxt);
  S.scrStart.sbDuelText.setText(duelTxt);
}
function updateMenu() {
  S.scrStart.btns.forEach((b, i) => {
    const a = i === S.state.menu.cursor;
    b.bg.setFillStyle(a ? C.accent : C.cell);
    b.label.setFill(a ? '#000' : '#fff');
    b.bg.setStrokeStyle(2, a ? C.white : C.frame);
  });
}

function handleStartMenu(time) {
  const st = consume(['START1', 'START2', 'P1_1', 'P2_1']); if (time < S.state.menu.cd) return;
  const dy = (held('P1_D') || held('P2_D') ? 1 : 0) - (held('P1_U') || held('P2_U') ? 1 : 0);
  if (dy !== 0) { S.state.menu.cursor = Phaser.Math.Wrap(S.state.menu.cursor + dy, 0, 3); S.state.menu.cd = time + 200; updateMenu(); playSfx('click'); }
  if (st) {
    const cur = S.state.menu.cursor;
    if (cur === 0) showModeSelect();
    else if (cur === 1) showHelp();
    else showTestScreen();
  }
}

function showModeSelect() {
  S.state.phase = 'modeSelect';
  S.state.menu.cursor = 0;
  S.state.menu.cd = S.time.now + 300;
  S.scrStart.c.setVisible(false);
  S.scrMode.c.setVisible(true);
  updateModeMenu();
}

function updateModeMenu() {
  S.scrMode.btns.forEach((b, i) => {
    const a = i === S.state.menu.cursor;
    b.bg.setFillStyle(a ? C.accent : C.cell);
    b.title.setFill(a ? '#000' : '#fff');
    b.bg.setStrokeStyle(2, a ? C.white : C.frame);
  });
}

function handleModeSelect(time) {
  const st = consume(['START1', 'START2', 'P1_1', 'P2_1']); if (time < S.state.menu.cd) return;
  const dy = (held('P1_D') || held('P2_D') ? 1 : 0) - (held('P1_U') || held('P2_U') ? 1 : 0);
  if (dy !== 0) { S.state.menu.cursor = Phaser.Math.Wrap(S.state.menu.cursor + dy, 0, 2); S.state.menu.cd = time + 200; updateModeMenu(); playSfx('click'); }
  if (st) {
    const mode = S.state.menu.cursor === 0 ? S_SOLO : S_DUEL;
    S.state.mode = mode;
    startMatch();
  }
}

function startMatch() {
  S.state.phase = S_PLAY;
  S.scrStart.c.setVisible(false);
  S.scrMode.c.setVisible(false);
  S.scrGameOver.c.setVisible(false);
  resetGame();
}

function resetGame() {
  S.state.stT = S.time.now;
  S.ships.children.iterate(ship => {
    const isP2 = !ship.isP1;
    const active = S.state.mode === S_DUEL || !isP2;

    Object.assign(
      ship,
      { hp: 100, energy: 100, dead: !active, lastHit: 0, spType: null, spCount: 0, shipColor: SHIP_C[0], hasShield: false }
    )
      .setVisible(active).setPosition(ship.isP1 ? 150 : W - 150, H / 2).setRotation(ship.isP1 ? 0 : Math.PI);
    ship.body.setVelocity(0).enable = active;
    if (ship.shieldVisual) { ship.shieldVisual.destroy(); ship.shieldVisual = null; }
  });

  S.bullets.clear(true, true); S.meteors.clear(true, true); S.orbs.clear(true, true); S.powerups.clear(true, true); S.missiles.clear(true, true); S.flares.clear(true, true); S.enemies.clear(true, true);
  if (S.hud.clearMsg) { S.hud.clearMsg.destroy(); S.hud.clearMsg = null; }
  if (S.hud.showerAlert) { S.hud.showerAlert.clear(); }

  const isDuel = S.state.mode === S_DUEL;
  Object.values(S.hud.p1).forEach(h => h && h.setVisible && h.setVisible(true));
  Object.values(S.hud.p2).forEach(h => h && h.setVisible && h.setVisible(isDuel));
  S.hud.timer.setVisible(true);

  S.state.scores = { p1: 0, p2: 0 }; S.state.round = 1; S.state.sC = 0; S.state.nRT = S.time.now + 25000;
  S.state.sT = 0; S.state.oT = S.time.now + 15000; S.state.pT = S.time.now + 10000; 
  S.state.iSA = false; S.state.sP = false; S.state.bT = 0;
  if (S.state.goTimer) { S.state.goTimer.remove(); S.state.goTimer = null; }
  
  [S.hud.p1, S.hud.p2].forEach(h => {
    h.lastHp = -1; h.lastEn = -1; h.lastScore = -1; h.lastSh = null; 
    h.lastT = null; h.lastC = -1; h.lastD = null; h.lastO = null;
  });

  S.physics.resume(); S.controls.pressed = {};
  S.state.gameoverDone = false;
}

function endMatch() {
  if (S.state.phase === S_GO) return;
  S.state.phase = S_GO; S.physics.pause(); S.state.gameoverDone = false;
  clearC(S.scrGameOver.c);
  const duration = S.time.now - S.state.stT;
  const mins = Math.floor(duration / 60000), secs = Math.floor((duration % 60000) / 1000);
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  let winId = 'p1', score = S.state.scores.p1;
  if (S.state.mode === S_DUEL) {
    winId = S.state.scores.p1 > S.state.scores.p2 ? 'p1' : 'p2';
    score = S.state.scores[winId];
  }

  const hsList = S.state.mode === S_SOLO ? S.state.hSS : S.state.hSD;
  const isHS = hsList.length < 10 || score > (hsList.length ? hsList[hsList.length - 1].score : -1);

  if (S.state.mode === S_SOLO) {
    playLossMelody();
    S.scrGameOver.c.setVisible(true);
    S.scrGameOver.t.setText('SIGNAL TERMINATED').setTint(0xff4422).setScale(0);
    S.tweens.add({ targets: S.scrGameOver.t, scale: 1, alpha: { from: 0, to: 1 }, duration: 800, ease: 'Bounce.out' });

    const scoreBox = drawTechFrame(W / 2 - 180, 210, 360, 240, C.frame);
    S.scrGameOver.c.add(scoreBox);

    const scoreLabel = TX(S, W / 2, 235, '--- RECOVERY_COMPLETE ---', '14', cS, 0.5);
    const scoreVal = TX(S, W / 2, 300, '000000', 'b72', '#fff', 0.5);
    S.scrGameOver.c.add([scoreLabel, scoreVal]);

    if (S.state.goTimer) { S.state.goTimer.remove(); S.state.goTimer = null; }
    let cur = 0;
    S.state.goTimer = S.time.addEvent({
      delay: 35,
      callback: () => {
        cur = Math.min(score, cur + Math.max(1, Math.floor(score / 35)));
        scoreVal.setText(String(cur).padStart(6, '0'));
        if (cur < score) playSfx('click');
        else {
          scoreLabel.setText(isHS ? '!! NEW_RECORD_DETECTED !!' : '>> DATA_ARCHIVED_SUCCESSFULLY');
          const timeInfo = TX(S, W / 2, 370, `FLIGHT_TIME: ${timeStr}`, '18', '#888', 0.5).setAlpha(0);
          const prompt = TX(S, W / 2, 420, isHS ? 'PRESS START TO SYNC DATA' : 'PRESS START TO DISCONNECT', 'b16', isHS ? cA : '#666', 0.5).setAlpha(0);
          S.scrGameOver.c.add([timeInfo, prompt]);
          S.tweens.add({ targets: [timeInfo, prompt], alpha: 1, y: '+=10', duration: 500 });
          S.state.gameoverDone = true; S.state.isHS = isHS; S.state.winId = winId; S.state.score = score; S.state.timeStr = timeStr;
          S.state.goTimer = null;
        }
      },
      repeat: 35
    });
  } else {
    if (isHS) showNameEntry(winId, score, timeStr);
    else {
      S.scrGameOver.c.setVisible(true);
      const msg = winId === 'p1' ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!';
      const info = TX(S, W / 2, 240, msg, 'b36', '#fff', 0.5);
      S.scrGameOver.c.add(info);
      S.state.gameoverDone = true;
    }
  }
}

function showNameEntry(winner, score, timeStr) {
  S.state.phase = S_NE;
  S.state.nE = { name: ['A', 'A', 'A'], idx: 0, cIdx: 0, winner, score, timeStr, cd: 0, confirming: false };
  S.scrName.c.setVisible(true);
  S.scrName.confirmMsg.setVisible(false);
  S.scrName.help.setVisible(true);
  S.scrName.t1.setText(S.state.mode === S_SOLO ? 'NEW RECORD DETECTED' : `${winner.toUpperCase()} ACED IT!`);
  updateNameEntryUi();
}

function updateNameEntryUi() {
  const e = S.state.nE;
  S.scrName.chars.forEach((t, i) => {
    t.setText(e.name[i]);
    t.setFill(e.confirming ? '#ffcc00' : (i === e.idx ? cA : '#fff'));
    if (e.confirming) {
      t.setAlpha(0.6 + Math.sin(Date.now() / 100) * 0.4);
    } else {
      t.setAlpha(1);
    }
  });
  S.scrName.cursor.setX(W / 2 - 60 + e.idx * 60);
  S.scrName.cursor.setVisible(!e.confirming);
  S.scrName.confirmMsg.setVisible(e.confirming);
  S.scrName.help.setVisible(!e.confirming);
}

function handleNameEntry(time) {
  const e = S.state.nE; if (time < e.cd) return;
  const dy = (held('P1_D') || held('P2_D') ? 1 : 0) - (held('P1_U') || held('P2_U') ? 1 : 0);
  const dx = (held('P1_R') || held('P2_R') ? 1 : 0) - (held('P1_L') || held('P2_L') ? 1 : 0);
  const ok = consume(['START1', 'START2']);
  const cancel = consume(['P1_1', 'P1_2', 'P1_3', 'P2_1', 'P2_2', 'P2_3']);

  if (e.confirming) {
    if (cancel || dy !== 0 || dx !== 0) {
      e.confirming = false;
      e.cd = time + 200;
      playSfx('click');
      updateNameEntryUi();
      return;
    }
    if (ok) {
      saveHighScore(e.name.join(''), e.score, e.timeStr, S.state.mode).then(hs => {
        if (S.state.mode === S_SOLO) S.state.hSS = hs;
        else S.state.hSD = hs;
        S.scrName.c.setVisible(false);
        showStartScreen();
      });
      playSfx('orb');
      e.cd = time + 1000;
    }
    return;
  }

  if (dy !== 0) {
    e.cIdx = Phaser.Math.Wrap(e.cIdx + dy, 0, CHARS.length);
    e.name[e.idx] = CHARS[e.cIdx];
    e.cd = time + 150; playSfx('click'); updateNameEntryUi();
  }
  if (dx !== 0) {
    e.idx = Phaser.Math.Wrap(e.idx + dx, 0, 3);
    e.cIdx = CHARS.indexOf(e.name[e.idx]);
    e.cd = time + 200; playSfx('dash'); updateNameEntryUi();
  }
  if (ok) {
    e.confirming = true;
    e.cd = time + 300;
    playSfx('dash');
    updateNameEntryUi();
  }
}

function clearC(c, k = 2) { const l = c.list; for (let i = l.length - 1; i >= k; i--) l[i].destroy(); }
function returnToStart() { clearC(S.scrGameOver.c); showStartScreen(); }
function pauseMatch() { S.state.phase = 'paused'; S.physics.pause(); clearC(S.scrGeneric.c); S.scrGeneric.c.setVisible(true); S.scrGeneric.t.setText('PAUSED'); S.controls.pressed = {}; }
function resumeMatch() { S.state.phase = S_PLAY; S.physics.resume(); S.scrGeneric.c.setVisible(false); }

function showHelp() {
  S.state.phase = 'help';
  S.scrStart.c.setVisible(false);
  clearC(S.scrGeneric.c);
  S.scrGeneric.c.setVisible(true);
  S.scrGeneric.t.setText('OPERATIONAL INTEL').setFontSize(48).setY(80);
  const c = S.scrGeneric.c;

  const ctrl = TX(S, W / 2, 140, 'JOYSTICK: MOVE | BTN 1-3: FIRE | BTN 4: BOOST | BTN 6: SPECIAL', 'b13', '#888', 0.5);
  c.add(ctrl);

  const items = [
    { t: POWS.MISSILE, n: 'MISSILE', d: 'HOMING STRIKE.\nTRACKS HOSTILES.', c: C.missile },
    { t: POWS.FLARE, n: 'FLARE', d: 'DECOY. DEFLECTS\nINCOMING MISSILES.', c: C.flare },
    { t: POWS.SHIELD, n: 'SHIELD', d: 'KINETIC BARRIER.\nBLOCKS ONE IMPACT.', c: C.shield },
    { t: POWS.RAPID, n: 'OVERDRIVE', d: 'UNLIMITED ENERGY.\nLASTS 8 SECONDS.', c: C.overdrive },
    { t: '+', n: 'REPAIR', d: 'RESTORES 25% HULL\nINTEGRITY.', c: C.orb }
  ];

  items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W / 2 + (col === 0 ? -280 : 80), y = 240 + row * 110;

    const box = S.add.container(x, y);
    const g = S.add.graphics(); drawPowerupIcon(g, item.t, item.c, 20);
    box.add(g); c.add(box);
    S.tweens.add({ targets: box, angle: 360, duration: 4000, repeat: -1 });
    S.tweens.add({ targets: box, scale: 1.15, duration: 800, yoyo: true, repeat: -1 });

    const name = TX(S, x + 45, y - 18, item.n, 'b18', c2s(item.c), 0, 0.5);
    const desc = TX(S, x + 45, y + 18, item.d, '12', '#bbb', 0, 0.5);
    c.add([name, desc]);
  });

  const tip = TX(S, W / 2, H - 60, 'TIP: BOOST ENABLES INERTIAL DRIFT! ROTATE AND FIRE WHILE SLIDING.', 'b13', cS, 0.5);
  c.add(tip);
}



function showTestScreen() {
  S.state.phase = 'test'; S.scrStart.c.setVisible(false); clearC(S.scrGeneric.c); S.scrGeneric.c.setVisible(true); S.scrGeneric.t.setText('INPUT TEST');
  const codes = Object.keys(CABINET_KEYS); S.testTexts = {};
  codes.forEach((c, i) => {
    const x = c.startsWith('P1') ? W * 0.25 : (c.startsWith('P2') ? W * 0.75 : W * 0.5);
    const y = 220 + (i % 10) * 35;
    const txt = TX(S, x, y, c, 'b18', '#444', 0.5);
    S.scrGeneric.c.add(txt); S.testTexts[c] = txt;
  });
  const hint = TX(S, W / 2, 550, 'PRESS START TO EXIT', '14', '#888', 0.5);
  S.scrGeneric.c.add(hint);
}

function updateTestScreen() {
  Object.entries(S.testTexts).forEach(([code, txt]) => {
    const isP1 = code.startsWith('P1'), isP2 = code.startsWith('P2'), isHeld = held(code);
    txt.setFill(isHeld ? (isP1 ? '#00f2ff' : (isP2 ? '#ff00ea' : '#fbff00')) : '#444');
    if (isHeld) txt.setScale(1.2); else txt.setScale(1.0);
  });
}

function initControls() {
  const k = { held: {}, pressed: {} }, rev = {};
  Object.entries(CABINET_KEYS).forEach(([a, ks]) => ks.forEach(key => {
    const finalKey = key.length === 1 ? key.toLowerCase() : key;
    rev[finalKey] = a;
  }));
  window.onkeydown = (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const a = rev[key];
    if (a) { e.preventDefault(); if (!k.held[a]) k.pressed[a] = true; k.held[a] = true; }
  };
  window.onkeyup = (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const a = rev[key]; if (a) { e.preventDefault(); k.held[a] = false; }
  };
  S.controls = k;
}

function held(c) { return S.controls.held[c]; }
function consume(codes) { for (const c of codes) if (S.controls.pressed[c]) { S.controls.pressed[c] = false; return true; } return false; }

function playSfx(type) {
  try {
    const ctx = S.game.sound.context; if (!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination);
    const ct = ctx.currentTime, f = osc.frequency, ga = g.gain;
    const swp = (p, v1, v2, d, e) => { p.setValueAtTime(v1, ct); if (e) p.exponentialRampToValueAtTime(v2, ct + d); else p.linearRampToValueAtTime(v2, ct + d); };

    switch (type) {
      case 'pew': {
        osc.type = 'triangle'; swp(f, 2400, 200, .1, 1); swp(ga, .2, .001, .1, 1);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sawtooth'; swp(o2.frequency, 120, 20, .12, 1); swp(g2.gain, .15, .001, .12, 1);
        o2.start(); o2.stop(ct + .12);
        break;
      }
      case 'dash': osc.type = 'sawtooth'; swp(f, 120, 1e3, .12, 1); swp(ga, .12, .001, .12, 1); break;
      case 'hit': osc.type = 'square'; swp(f, 100, 10, .1); swp(ga, .2, .001, .1); break;
      case 'orb': osc.type = 'sine'; swp(f, 400, 1200, .15, 1); swp(ga, .1, .001, .15, 1); break;
      case 'boost': osc.type = 'sawtooth'; swp(f, 400, 20, .3, 1); ga.setValueAtTime(0, ct); ga.linearRampToValueAtTime(.4, ct + .03); ga.exponentialRampToValueAtTime(.001, ct + .35); break;
      case 'click': osc.type = 'square'; swp(f, 1500, 1500, .03); swp(ga, .02, .001, .03, 1); break;
      case 'whoosh': osc.type = 'sawtooth'; swp(f, 400, 50, .3, 1); swp(ga, .05, .001, .3); break;
      case 'lock': osc.type = 'sine'; swp(f, 1500, 500, .1, 1); swp(ga, .1, .001, .1, 1); break;
      case 'boom': osc.type = 'sawtooth'; swp(f, 200, 20, .4, 1); swp(ga, .3, .001, .4, 1); break;
      case 'launch': osc.type = 'sawtooth'; swp(f, 60, 400, .2, 1); swp(ga, .3, .001, .2, 1); break;
      case 'mortar': {
        osc.type = 'triangle'; swp(f, 250, 40, .1, 1); swp(ga, .3, .001, .1, 1);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine'; swp(o2.frequency, 600, 1800, .08, 1); swp(g2.gain, .1, .001, .08, 1);
        o2.start(); o2.stop(ct + .08);
        break;
      }
      case 'thrum': osc.type = 'triangle'; swp(f, 100, 60, .15, 1); swp(ga, .08, .001, .15, 1); break;
      case 'mExp': {
        osc.type = 'sawtooth'; swp(f, 250, 10, .6, 1); swp(ga, .5, .001, .6, 1);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine'; swp(o2.frequency, 60, 20, .8, 1); swp(g2.gain, .3, .001, .8, 1);
        o2.start(); o2.stop(ct + .8);
        break;
      }
      default: return;
    }
    osc.start(); osc.stop(ct + .4);
  } catch (e) { }
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
  const key = mode === S_SOLO ? STORAGE_KEY_SOLO : STORAGE_KEY_DUEL;
  const res = await s.get(key);
  let hs = res.found ? res.value : [];
  const entry = { name, score, date: Date.now() };
  if (mode === S_SOLO) entry.time = timeStr;
  hs.push(entry);
  hs.sort((a, b) => b.score - a.score);
  hs = hs.slice(0, 10);
  await s.set(key, hs);
  return hs;
}

function spectacularExplosion(x, y, color) {
  playSfx('boom');
  explode(x, y, color, 40); explode(x, y, C.white, 20); explode(x, y, 0xffaa00, 30);
  for (let i = 0; i < 3; i++) {
    const ring = S.add.graphics({ x, y }); ring.lineStyle(4, C.white, 0.8).strokeCircle(0, 0, 10);
    S.tweens.add({ targets: ring, scale: 15, alpha: 0, duration: 800 + i * 200, onComplete: () => ring.destroy() });
  }
  S.cameras.main.shake(600, 0.04);
  for (let i = 0; i < 4; i++) S.time.delayedCall(i * 150, () => triggerGlitch());
}

function playLossMelody() {
  const ctx = S.game.sound.context; if (!ctx) return;
  const notes = [330, 311, 293, 277, 261, 246, 233, 220];
  notes.forEach((freq, i) => {
    S.time.delayedCall(i * 120, () => playNote(ctx, freq, 'square', 0.04, 0.15));
  });
}

function updateMusic(time) {
  if (S.state.phase !== S_PLAY) {
    if (S.musicTimer) { S.musicTimer.remove(); S.musicTimer = null; }
    if (S.drone) { S.drone.stop(); S.drone = null; }
    return;
  }
  const ctx = S.game.sound.context;
  if (ctx && !S.drone) {
    S.drone = ctx.createOscillator(); const g = ctx.createGain();
    S.drone.type = 'triangle'; S.drone.frequency.setValueAtTime(40, ctx.currentTime);
    g.gain.setValueAtTime(0.03, ctx.currentTime); S.drone.connect(g); g.connect(ctx.destination);
    S.drone.start();
  }
  if (!S.musicTimer) {
    S.mState = { beat: 0 };
    S.musicTimer = S.time.addEvent({ delay: 150, loop: true, callback: () => tickMusic() });
  }
  const bt = S.state.bT || 0;
  const tension = bt > 0.5 || (S.enemies && S.enemies.countActive() > 0) || (S.p1.hp < 25);
  S.musicTimer.delay = tension ? 120 : 150;
  const targetFreq = Math.max(40 + bt * 15, (S.p1.hp < 25) ? 55 : 40);
  if (S.drone) S.drone.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.5);
}

function tickMusic() {
  const ctx = S.game.sound.context; if (!ctx || !S.mState) return;
  const b = S.mState.beat, round = S.state.round;
  const bt = S.state.bT || 0;
  const lowHp = S.p1.hp < 25;

  // Villain Bass (Dissonant & Low) - Fades in/out
  if (bt > 0.1 && b % 4 === 0) playNote(ctx, 45, 'sawtooth', 0.25 * bt, 0.4, true);
  
  // Normal Kick - Fades out as boss arrives
  if (bt < 0.9 && b % 4 === 0) playNote(ctx, 60, 'sine', 0.3 * (1 - bt), 0.2, true);

  // Electric Alert (Replaces xylophone)
  if (lowHp && b % 2 === 0) playNote(ctx, 80 + rnd() * 40, 'square', 0.05, 0.1);

  // Ambient Drone - Crossfade
  if (b % 8 === 0) {
    if (bt > 0) playNote(ctx, 35, 'sawtooth', 0.08 * bt, 1.5);
    if (bt < 1) playNote(ctx, 50, 'sawtooth', 0.08 * (1 - bt), 1.5);
  }

  // High Rounds Snare
  if (round >= 3 && (b === 4 || b === 12)) playNote(ctx, 100, 'square', 0.04, 0.1, true);

  // Melodic Atmosphere (Round 5+ and NOT low hp)
  if (round >= 5 && b % 4 === 2 && !lowHp) {
    const notes = [164, 196, 220, 246];
    playNote(ctx, notes[Math.floor(b / 4) % 4], 'triangle', 0.03, 0.6);
  }

  S.mState.beat = (b + 1) % 16;
}

function playNote(ctx, f, type, v, d, sweep = false) {
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime);
    if (sweep) o.frequency.exponentialRampToValueAtTime(f / 4, ctx.currentTime + d);
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + d);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + d);
  } catch (e) { }
}

function updateShowerAlert(time, poolSize) {
  if (!S.hud.showerAlert) S.hud.showerAlert = S.add.graphics().setDepth(50);
  const g = S.hud.showerAlert; g.clear();

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

  const intensity = 0.3 + Math.sin(S.time.now / 150) * 0.15, col = 0xff3300, th = 80;
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
