/* ================================================================
   COSMO TRIPPIN' — Vanilla JavaScript Game
   ================================================================
   Converted from React + TypeScript to plain HTML/CSS/JS.
   Organized into clearly named sections for easy presentation.

   SECTIONS:
     1.  Constants & Configuration
     2.  Asset Paths
     3.  Score Utilities
     4.  Starfield Generator
     5.  Navigation System
     6.  Track Geometry
     7.  Difficulty System
     8.  Spawn System
     9.  Game State
     10. Game Controls (Keyboard & Touch)
     11. HUD Rendering
     12. Entity & Toast Rendering
     13. Desktop Stage Scaling
     14. Game Loop
     15. App Initialization
   ================================================================ */


/* ================================================================
   SECTION 1 — CONSTANTS & CONFIGURATION
   ================================================================ */

/** Progress value (0=far, 1=near) where the player sits on the track. */
const PLAYER_P = 0.82;

/** Half-width of the hit detection band around the player row. */
const HIT_BAND = 0.055;

/** Width-to-height ratio of the track SVG artwork (1145 × 1374 px). */
const TRACK_ASPECT = 1145 / 1374;

/**
 * X positions (in % of track width) for each lane at the TOP of the track
 * (the far-away vanishing point — lanes are close together).
 */
const LANE_TOP_X = [45, 50, 55];

/**
 * X positions (in % of track width) for each lane at the BOTTOM of the track
 * (the near foreground — lanes spread wide due to perspective).
 */
const LANE_BOT_X = [17, 50, 83];

/** Top & bottom Y bounds (in % of track height) for the visible play area. */
const Y_TOP = 14;
const Y_BOT = 92;

/** LocalStorage key for the best score. */
const BEST_KEY = 'cosmo-trippin-best';

/** Human-readable names for each obstacle type (used for alt text). */
const ENTITY_LABELS = {
  asteroid:  'Asteroid',
  ufo:       'UFO',
  blackhole: 'Black hole',
  star:      'Star',
};


/* ================================================================
   SECTION 2 — ASSET PATHS
   ================================================================ */

/** All game image sources, relative to index.html. */
const ASSETS = {
  astronaut:  'assets/cosmo_astronaut.svg',
  asteroid:   'assets/new_asteroid_ultra_thick_outline.svg',
  star:       'assets/star_exact.svg',
  ufo:        'assets/ufo_final.png',
  blackhole:  'assets/cosmo_planet_exact.svg',
  arrowLeft:  'assets/new_arrow_left.svg',

  navHome:    'assets/nav_home_active.svg',
  navGame:    'assets/nav_game_active.svg',
  navHowto:   'assets/nav_how_to_play_active.svg',
};

/** Returns the correct image source for a given entity type. */
function getEntitySrc(type) {
  return ASSETS[type] ?? ASSETS.asteroid;
}


/* ================================================================
   SECTION 3 — SCORE UTILITIES
   ================================================================ */

/** Load the best score from localStorage. Returns 0 if not set. */
function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Save a new best score to localStorage. */
function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* Ignore storage failures (private mode, storage full, etc.) */
  }
}

/**
 * Format a score as a zero-padded string, like an arcade cabinet.
 * Example: pad(1240) → "01240"
 */
function pad(n, len = 5) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}


/* ================================================================
   SECTION 4 — STARFIELD GENERATOR
   ================================================================ */

/** Colors used for randomly generated background stars. */
const STAR_COLORS = ['#f8f8f8', '#00e0ff', '#ffd04d', '#ff4f9a'];

/**
 * Fill a container element with randomly placed, randomly colored,
 * twinkling pixel dots (the space background).
 *
 * @param {HTMLElement} container - The element to fill with stars.
 * @param {number}      count     - How many star dots to create.
 */
function createStarfield(container, count) {
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'star-dot';

    // Random position
    dot.style.left  = Math.random() * 100 + '%';
    dot.style.top   = Math.random() * 100 + '%';

    // Mostly 2px, occasionally 3px for variation
    const size = Math.random() < 0.75 ? 2 : 3;
    dot.style.width  = size + 'px';
    dot.style.height = size + 'px';

    // Random star color
    dot.style.backgroundColor =
      STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];

    // Staggered twinkle animation
    const delay = Math.random() * 4;
    const dur   = 2 + Math.random() * 3;
    dot.style.animation = `cosmo-twinkle ${dur}s ease-in-out ${delay}s infinite`;

    container.appendChild(dot);
  }
}


/* ================================================================
   SECTION 5 — NAVIGATION SYSTEM
   ================================================================ */

/** Which page is currently visible: 'home' | 'game' | 'howto' */
let currentPage = 'home';

/** The current all-time best score (read from localStorage on init). */
let bestScore = 0;

/**
 * Navigate to a page. Shows the correct page section, hides others,
 * and updates all navigation SVG images to show the active state.
 *
 * @param {string} page - 'home' | 'game' | 'howto'
 */
function navigate(page) {
  // Don't navigate to the page already being shown
  if (page === currentPage && page !== 'game') return;

  currentPage = page;

  // Show/hide the three page divs
  document.getElementById('page-home').classList.toggle('active', page === 'home');
  document.getElementById('page-home').classList.toggle('hidden', page !== 'home');
  document.getElementById('page-game').classList.toggle('active', page === 'game');
  document.getElementById('page-game').classList.toggle('hidden', page !== 'game');
  document.getElementById('page-howto').classList.toggle('active', page === 'howto');
  document.getElementById('page-howto').classList.toggle('hidden', page !== 'howto');

  // Update every nav image to show which item is active
  updateAllNavImages(page);

  // Desktop footer: visible only on Game + How To Play pages (≥640px)
  const footer = document.getElementById('desktop-footer');
  footer.classList.toggle('visible', page !== 'home');

  // If navigating to the game page, start a fresh game
  if (page === 'game') {
    startFreshGame();
  }

  // Recalculate desktop scaling after page switch
  if (page === 'game') {
    requestAnimationFrame(measureDesktopStage);
  }
}

/**
 * Update the nav SVG image on all nav bars to reflect the active page.
 * The three nav SVG assets each have a different item highlighted in magenta.
 *
 * @param {string} page - Current active page.
 */
function updateAllNavImages(page) {
  const src = page === 'home'  ? ASSETS.navHome
            : page === 'game'  ? ASSETS.navGame
            : ASSETS.navHowto;

  // Update every nav img element on the page
  const navImgs = document.querySelectorAll('.nav-img');
  navImgs.forEach(img => { img.src = src; });
}

/**
 * Attach click listeners to all nav zone buttons.
 * Each button has a data-nav attribute telling it which page to navigate to.
 */
function setupNavigation() {
  document.querySelectorAll('.nav-zone').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.nav);
    });
  });

  // Home page buttons
  document.getElementById('btn-home-start').addEventListener('click', () => {
    navigate('game');
  });
  document.getElementById('btn-home-howto').addEventListener('click', () => {
    navigate('howto');
  });

  // How To Play: START GAME button
  document.getElementById('btn-howto-start').addEventListener('click', () => {
    navigate('game');
  });
}


/* ================================================================
   SECTION 6 — TRACK GEOMETRY
   ================================================================ */

/**
 * Given a fractional lane position (0=left, 1=center, 2=right) and
 * a progress value (0=top/far, 1=bottom/near), returns the
 * X percentage across the track width where the entity should sit.
 * Uses perspective math: lanes converge at the top (vanishing point).
 *
 * @param {number} laneF - Fractional lane (supports decimals for drifting).
 * @param {number} p     - Progress along the track (0→1).
 * @returns {number} X position as % of track width.
 */
function laneX(laneF, p) {
  const topX = LANE_TOP_X[0] + (LANE_TOP_X[2] - LANE_TOP_X[0]) * (laneF / 2);
  const botX = LANE_BOT_X[0] + (LANE_BOT_X[2] - LANE_BOT_X[0]) * (laneF / 2);
  return topX + (botX - topX) * p;
}

/**
 * Given a progress value (0=top/far, 1=bottom/near), returns the
 * Y percentage down the track height where the entity should sit.
 *
 * @param {number} p - Progress along the track (0→1).
 * @returns {number} Y position as % of track height.
 */
function laneY(p) {
  return Y_TOP + (Y_BOT - Y_TOP) * p;
}

/**
 * Compute where the track artwork actually sits within its container div.
 * The track SVG uses object-fit: contain, so when the container's aspect
 * ratio differs from the SVG's, the track image may be letterboxed.
 * This returns the pixel position and size of the visible track area.
 *
 * @param {number} width  - Container pixel width.
 * @param {number} height - Container pixel height.
 * @returns {{ left, top, width, height }} Pixel bounds of the track artwork.
 */
function trackBounds(width, height) {
  const trackWidth  = Math.min(width, height * TRACK_ASPECT);
  const trackHeight = trackWidth / TRACK_ASPECT;
  return {
    left:   (width  - trackWidth)  / 2,
    top:    (height - trackHeight) / 2,
    width:  trackWidth,
    height: trackHeight,
  };
}

/**
 * Cached track dimensions, updated by ResizeObserver.
 * Using a cached value avoids reading the DOM every animation frame.
 */
let trackDims = { w: 0, h: 0 };

/** Read and cache the current track element pixel size. */
function measureTrack() {
  const track = document.getElementById('game-track');
  if (track) {
    trackDims = { w: track.clientWidth, h: track.clientHeight };
  }
}


/* ================================================================
   SECTION 7 — DIFFICULTY SYSTEM
   ================================================================ */

/**
 * Calculate the speed multiplier based on stars collected.
 * Every star adds +8% speed (cumulative), capped at 3× for playability.
 *
 * @param {number} stars - Number of stars collected so far.
 * @returns {number} Speed multiplier (1.0 at start, max 3.0).
 */
function speedMult(stars) {
  return Math.min(3.0, 1 + stars * 0.08);
}

/**
 * Map star count to a difficulty tier (1–5).
 * Higher tiers unlock more complex obstacle patterns.
 *
 * @param {number} stars - Stars collected.
 * @returns {number} Tier number (1=easiest, 5=hardest).
 */
function tier(stars) {
  if (stars < 5)  return 1;
  if (stars < 10) return 2;
  if (stars < 15) return 3;
  if (stars < 20) return 4;
  return 5;
}

/**
 * Pick a random entity type to spawn, weighted by the current tier.
 * At higher tiers, black holes and UFOs become more common.
 *
 * @param {number} stars - Stars collected (used to determine tier).
 * @returns {string} Entity type: 'asteroid' | 'ufo' | 'blackhole' | 'star'
 */
function pickObstacleType(stars) {
  const t = tier(stars);
  const starChance = 0.28;
  const bhChance   = t >= 3 ? 0.18 : 0.12;
  const ufoChance  = t >= 2 ? 0.22 : 0.12;
  const r = Math.random();
  if (r < starChance)                           return 'star';
  if (r < starChance + bhChance)                return 'blackhole';
  if (r < starChance + bhChance + ufoChance)    return 'ufo';
  return 'asteroid';
}


/* ================================================================
   SECTION 8 — SPAWN SYSTEM
   ================================================================ */

/**
 * Build a group of 1–3 entities to spawn at once.
 *
 * Rules:
 * - Single obstacle: mostly avoids the player's current lane.
 * - Two obstacles: block exactly 2 lanes, always leaving one free.
 * - Three obstacles: two blockers + a collectable star in the free lane.
 * - At higher tiers, some obstacles drift laterally across the track.
 *
 * @param {number} stars      - Stars collected (determines difficulty tier).
 * @param {number} playerLane - Player's current lane (0,1,2).
 * @param {number} nextId     - ID to assign to the first new entity.
 * @returns {Array} Array of entity objects to add to the game.
 */
function buildSpawnGroup(stars, playerLane, nextId) {
  const t = tier(stars);

  // Chance of spawning a second or third obstacle in the same wave
  const twoObsChance   = [0, 0, 0.15, 0.28, 0.42, 0.55][t] ?? 0;
  const threeObsChance = [0, 0,    0,    0, 0.10, 0.22][t] ?? 0;

  // Chance that a single obstacle drifts sideways across lanes
  const movingChance   = [0, 0, 0.10, 0.22, 0.36, 0.50][t] ?? 0;

  // Decide how many obstacles to spawn this wave
  const count = Math.random() < threeObsChance ? 3
              : Math.random() < twoObsChance   ? 2
              : 1;

  // Build the entity list based on count
  if (count === 1) {
    // Single obstacle: prefer a lane other than the player's
    const candidates = [0, 1, 2].filter(l => l !== playerLane);
    const ln = Math.random() < 0.35
      ? playerLane
      : candidates[Math.floor(Math.random() * candidates.length)];

    const drifts  = Math.random() < movingChance;
    const driftDir = Math.random() < 0.5 ? 1 : -1;
    const type = pickObstacleType(stars);

    return [createEntity(nextId, ln, type, stars, drifts ? driftDir * (0.3 + Math.random() * 0.5) : 0)];

  } else if (count === 2) {
    // Two obstacles: block 2 lanes, always leave 1 free
    const freeLane = Math.floor(Math.random() * 3);
    const blockedLanes = [0, 1, 2].filter(l => l !== freeLane);

    return blockedLanes.map((ln, i) => {
      const type = pickObstacleType(stars);
      return createEntity(nextId + i, ln, type, stars, 0);
    });

  } else {
    // Three-wave: two obstacles + a star in the free lane
    const freeLane = Math.floor(Math.random() * 3);
    const blockedLanes = [0, 1, 2].filter(l => l !== freeLane);

    const obstacles = blockedLanes.map((ln, i) => {
      const type = pickObstacleType(stars);
      return createEntity(nextId + i, ln, type, stars, 0);
    });

    // Star reward in the open lane
    const starEntity = createEntity(nextId + 2, freeLane, 'star', stars, 0);

    return [...obstacles, starEntity];
  }
}

/**
 * Create a single entity object with all required fields.
 *
 * @param {number} id        - Unique numeric ID for this entity.
 * @param {number} lane      - Starting lane (0=left, 1=center, 2=right).
 * @param {string} type      - Entity type (asteroid | ufo | blackhole | star).
 * @param {number} stars     - Stars collected (used to compute scale variety).
 * @param {number} driftLane - Lateral drift speed (lanes/sec); 0 = stationary.
 * @returns {object} Entity state object.
 */
function createEntity(id, lane, type, stars, driftLane) {
  // Bigger asteroids and UFOs at higher difficulties
  let scale = 1;
  if (type === 'asteroid') scale = 0.5 + Math.random();
  if (type === 'ufo')      scale = 1 + Math.random();

  return {
    id,
    lane,
    laneF:     lane,   // fractional lane (updated each frame for drifting)
    p:         0,      // progress: 0 = spawning at far top, 1 = reaching player
    type,
    scale,
    driftLane, // negative = moving left, positive = moving right
    resolved:  false,  // true after collision/collection is processed
  };
}


/* ================================================================
   SECTION 9 — GAME STATE
   ================================================================ */

/**
 * All mutable game state lives in one object.
 * This makes the game loop simple: one object, updated each frame.
 */
let game = {
  entities:   [],   // active entities on the track
  toasts:     [],   // floating "+100" / "HIT!" feedback messages
  lane:       1,    // player's current lane (0=left, 1=center, 2=right)
  score:      0,    // points this run
  stars:      0,    // stars collected this run (drives difficulty)
  lives:      3,    // remaining lives (game over at 0)
  elapsed:    0,    // seconds elapsed this game
  spawnTimer: 0,    // countdown until next spawn wave
  nextId:     1,    // auto-incrementing ID for new entities
  over:       false,// true when lives reach 0
};

/** Current game status: 'ready' | 'playing' | 'over' */
let gameStatus = 'ready';

/** requestAnimationFrame handle, so we can cancel the loop. */
let rafHandle = null;

/** Timestamp of the previous animation frame (for delta-time calculation). */
let lastFrameTime = 0;

/**
 * Reset all game state and prepare for a new run.
 * Called before every new game (including after Game Over).
 */
function resetGame() {
  game = {
    entities:   [],
    toasts:     [],
    lane:       1,
    score:      0,
    stars:      0,
    lives:      3,
    elapsed:    0,
    spawnTimer: 0.4,  // small delay before first obstacle
    nextId:     1,
    over:       false,
  };
}

/**
 * Cancel any running game loop, reset the game, and switch to 'playing' status.
 * Also updates the HUD immediately so the player sees correct initial values.
 */
function startGame() {
  if (rafHandle) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  resetGame();
  gameStatus = 'ready';

  showOverlay('ready');
  updateHUD();
  renderLives();
}

/**
 * Begin actual gameplay from the READY overlay.
 * Called when the player taps/clicks "START GAME".
 */
function beginPlay() {
  gameStatus = 'playing';
  hideAllOverlays();
  showTrackArrows(true);
  lastFrameTime = performance.now();
  rafHandle = requestAnimationFrame(gameLoop);
}

/**
 * Navigate to Game page and immediately start a fresh game.
 * Called from HOME and HOW TO PLAY "START GAME" buttons.
 */
function startFreshGame() {
  startGame();
}


/* ================================================================
   SECTION 10 — GAME CONTROLS (Keyboard & Touch)
   ================================================================ */

/**
 * Move the player one lane to the left (-1) or right (+1).
 * Clamps to valid lanes 0–2. Only works while the game is playing.
 *
 * @param {number} dir - Direction: -1 (left) or +1 (right).
 */
function movePlayer(dir) {
  if (gameStatus !== 'playing') return;
  const next = Math.min(2, Math.max(0, game.lane + dir));
  if (next !== game.lane) {
    game.lane = next;
    updatePlayerPosition(); // move the astronaut immediately
  }
}

/**
 * Set up keyboard event listeners for desktop play.
 * Arrow keys and A/D keys control lane movement.
 * Enter/Space starts the game from the overlay screens.
 */
function setupKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      movePlayer(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      movePlayer(1);
    } else if ((e.key === 'Enter' || e.key === ' ') && gameStatus !== 'playing') {
      e.preventDefault();
      if (gameStatus === 'ready') beginPlay();
      else if (gameStatus === 'over') startGame();
    }
  });
}

/**
 * Set up touch (and click) listeners for the in-track arrow buttons.
 * These are the large tappable buttons in the lower corners of the track.
 */
function setupTouchControls() {
  const btnLeft  = document.getElementById('btn-track-left');
  const btnRight = document.getElementById('btn-track-right');
  const btnStart = document.getElementById('btn-start-ready');
  const btnAgain = document.getElementById('btn-play-again');

  btnLeft.addEventListener('click',  () => movePlayer(-1));
  btnRight.addEventListener('click', () => movePlayer(1));
  btnStart.addEventListener('click', () => beginPlay());
  btnAgain.addEventListener('click', () => startGame());

  // Touch: also listen for touchstart for faster response on mobile
  btnLeft.addEventListener('touchstart', (e) => {
    e.preventDefault();
    movePlayer(-1);
  }, { passive: false });

  btnRight.addEventListener('touchstart', (e) => {
    e.preventDefault();
    movePlayer(1);
  }, { passive: false });
}

/** Show or hide the in-track touch arrow buttons. */
function showTrackArrows(visible) {
  document.getElementById('btn-track-left').classList.toggle('hidden', !visible);
  document.getElementById('btn-track-right').classList.toggle('hidden', !visible);
}


/* ================================================================
   SECTION 11 — HUD RENDERING
   ================================================================ */

/**
 * Update the score, best score, and speed multiplier text in the HUD.
 * Called once per animation frame during gameplay.
 */
function updateHUD() {
  document.getElementById('hud-score').textContent = pad(game.score);
  document.getElementById('hud-best').textContent  = pad(bestScore);
  document.getElementById('hud-speed').textContent =
    'Speed ×' + speedMult(game.stars).toFixed(2);
}

/**
 * Rebuild the three heart icons in the HUD based on remaining lives.
 * Full hearts are pink; lost hearts are dark gray with a × mark.
 * Uses inline SVG so no image files are needed.
 */
function renderLives() {
  const container = document.getElementById('hud-lives');
  container.innerHTML = '';
  container.setAttribute('aria-label', game.lives + ' lives remaining');

  const heartPath = 'M10 17C10 17 1 11 1 5C1 2.2 3.2 0 6 0C7.8 0 9.3.9 10 2.2C10.7.9 12.2 0 14 0C16.8 0 19 2.2 19 5C19 11 10 17 10 17Z';

  for (let i = 0; i < 3; i++) {
    const alive = i < game.lives;
    const slot = document.createElement('span');
    slot.className = 'heart-slot';

    // SVG heart icon
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 18');
    svg.setAttribute('class', 'heart-icon pixel');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', alive ? '#ff4f9a' : '#3a3350');
    path.setAttribute('d', heartPath);
    svg.appendChild(path);
    slot.appendChild(svg);

    // Show × on lost lives
    if (!alive) {
      const x = document.createElement('span');
      x.className = 'heart-lost-x';
      x.textContent = '×';
      slot.appendChild(x);
    }

    container.appendChild(slot);
  }
}

/** Show an overlay (ready or gameover). Hides all others first. */
function showOverlay(type) {
  hideAllOverlays();
  document.getElementById('overlay-' + type).classList.remove('hidden');
}

/** Hide all overlay panels. */
function hideAllOverlays() {
  document.getElementById('overlay-ready').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');
}

/** Populate and show the Game Over overlay with final/best scores. */
function showGameOver() {
  document.getElementById('gameover-score').textContent = pad(game.score);
  document.getElementById('gameover-best').textContent  = pad(bestScore);

  const newBestEl = document.getElementById('gameover-newbest');
  if (game.score >= bestScore && game.score > 0) {
    newBestEl.classList.remove('hidden');
  } else {
    newBestEl.classList.add('hidden');
  }

  showOverlay('gameover');
  showTrackArrows(false);
}

/** Shake the game track to give hit feedback. Uses the Web Animations API. */
function shakeTrack() {
  const track = document.getElementById('game-track');
  track.animate(
    [
      { transform: 'translate(0,0)' },
      { transform: 'translate(-6px,3px)' },
      { transform: 'translate(6px,-4px)' },
      { transform: 'translate(-4px,-2px)' },
      { transform: 'translate(0,0)' },
    ],
    { duration: 320, easing: 'steps(4)' }
  );
}


/* ================================================================
   SECTION 12 — ENTITY & TOAST RENDERING
   ================================================================ */

/**
 * Map from entity ID → DOM wrapper element.
 * Allows us to reuse existing elements instead of creating new ones
 * each frame (better performance).
 */
const entityElements = new Map();

/**
 * Sync the DOM entity elements to match the current game.entities array.
 *
 * - Creates a new <div> with an <img> for each new entity.
 * - Updates the position and size of every existing entity element.
 * - Removes DOM elements for entities that have left the game.
 *
 * Positions are computed using the track geometry helpers (laneX / laneY)
 * and the measured pixel dimensions of the game-track element.
 */
function syncEntities() {
  const H = trackDims.h;
  const W = trackDims.w;
  if (H === 0 || W === 0) return;

  const track  = document.getElementById('game-track');
  const bounds = trackBounds(W, H);

  // Collect the IDs of all currently live entities
  const liveIds = new Set(game.entities.map(e => e.id));

  // Remove DOM elements for entities that have expired
  for (const [id, el] of entityElements) {
    if (!liveIds.has(id)) {
      el.remove();
      entityElements.delete(id);
    }
  }

  // Create or update a DOM element for each live entity
  for (const e of game.entities) {
    let wrapper = entityElements.get(e.id);

    if (!wrapper) {
      // First time we've seen this entity: create its elements
      wrapper = document.createElement('div');
      wrapper.className = 'entity-wrapper';

      const img = document.createElement('img');
      img.src = getEntitySrc(e.type);
      img.alt = ENTITY_LABELS[e.type] ?? '';
      img.className = 'pixel entity-img';

      // Each entity type has its own size within the wrapper
      applyEntityImgSize(img, e.type, e.scale);

      wrapper.appendChild(img);
      track.appendChild(wrapper);
      entityElements.set(e.id, wrapper);
    }

    // Update position: scale with perspective (entities grow as they approach)
    const size = H * (0.075 + 0.14 * e.p);
    wrapper.style.left      = (bounds.left + (bounds.width  * laneX(e.laneF, e.p)) / 100) + 'px';
    wrapper.style.top       = (bounds.top  + (bounds.height * laneY(e.p))           / 100) + 'px';
    wrapper.style.width     = size + 'px';
    wrapper.style.height    = size + 'px';
    wrapper.style.transform = 'translate(-50%, -50%)';
  }
}

/**
 * Set the size of an entity's <img> relative to its wrapper.
 * Each type uses a different scale percentage to match the original design.
 *
 * @param {HTMLImageElement} img   - The image element to size.
 * @param {string}           type  - Entity type.
 * @param {number}           scale - Size multiplier from the entity data.
 */
function applyEntityImgSize(img, type, scale) {
  img.style.position  = 'absolute';
  img.style.top       = '50%';
  img.style.left      = '50%';
  img.style.transform = 'translate(-50%, -50%)';
  img.style.objectFit = 'contain';

  if (type === 'asteroid') {
    // Asteroids vary in size (scale: 0.5–1.5)
    img.style.width  = (scale * 100) + '%';
    img.style.height = (scale * 100) + '%';
  } else if (type === 'ufo') {
    // UFOs are large and vary (scale: 1–2)
    img.style.width  = (scale * 100) + '%';
    img.style.height = (scale * 100) + '%';
  } else if (type === 'blackhole') {
    // Black holes are very large (450% of the wrapper)
    img.style.width  = '450%';
    img.style.height = '450%';
  } else if (type === 'star') {
    // Stars are slightly smaller than their wrapper
    img.style.width  = '60%';
    img.style.height = '60%';
  } else {
    img.style.width  = '100%';
    img.style.height = '100%';
  }
}

/**
 * Update the player astronaut's position on the track.
 * The player always sits at PLAYER_P progress value.
 * Left/right position changes when the player switches lanes.
 */
function updatePlayerPosition() {
  const H = trackDims.h;
  const W = trackDims.w;
  if (H === 0 || W === 0) return;

  const bounds  = trackBounds(W, H);
  const wrapper = document.getElementById('player-wrapper');
  const size    = H * 0.316; // Player size relative to track height

  wrapper.style.left      = (bounds.left + (bounds.width  * laneX(game.lane, PLAYER_P)) / 100) + 'px';
  wrapper.style.top       = (bounds.top  + (bounds.height * laneY(PLAYER_P))             / 100) + 'px';
  wrapper.style.width     = size + 'px';
  wrapper.style.height    = size + 'px';
  wrapper.style.transform = 'translate(-50%, -50%)';
}

/**
 * Map from toast ID → DOM element.
 * Toasts are short-lived "+100" or "HIT!" labels that float upward.
 */
const toastElements = new Map();

/**
 * Sync floating toast messages to the DOM.
 * Creates new elements for new toasts, removes expired ones.
 */
function syncToasts() {
  const H = trackDims.h;
  const W = trackDims.w;
  if (H === 0 || W === 0) return;

  const track  = document.getElementById('game-track');
  const bounds = trackBounds(W, H);

  const liveToastIds = new Set(game.toasts.map(t => t.id));

  // Remove expired toasts
  for (const [id, el] of toastElements) {
    if (!liveToastIds.has(id)) {
      el.remove();
      toastElements.delete(id);
    }
  }

  // Create / position each active toast
  for (const t of game.toasts) {
    let el = toastElements.get(t.id);

    if (!el) {
      el = document.createElement('div');
      el.className  = 'toast animate-rise';
      el.style.color = t.kind === 'hit' ? '#ff4f9a' : '#ffd04d';
      el.textContent = t.kind === 'hit' ? '✖ HIT!' : '★ +100';
      track.appendChild(el);
      toastElements.set(t.id, el);
    }

    el.style.left = (bounds.left + (bounds.width  * laneX(t.lane, PLAYER_P))           / 100) + 'px';
    el.style.top  = (bounds.top  + (bounds.height * (laneY(PLAYER_P) - 8))             / 100) + 'px';
  }
}

/** Remove all entity and toast DOM elements (called between games). */
function clearEntityDom() {
  for (const el of entityElements.values()) el.remove();
  entityElements.clear();
  for (const el of toastElements.values()) el.remove();
  toastElements.clear();
}


/* ================================================================
   SECTION 13 — DESKTOP STAGE SCALING
   ================================================================ */

/**
 * On desktop (≥1024px), scale and center the game panel to fit
 * the available screen area while preserving its proportions.
 *
 * This mirrors the React version's useLayoutEffect that watched
 * panelRef and gameRef to compute a CSS transform scale.
 *
 * The panel is positioned with negative left/top offsets (-155px)
 * so it overlaps the stage wrapper edge-to-edge on all sides.
 */
function measureDesktopStage() {
  const panel    = document.getElementById('game-panel');
  const outer    = document.getElementById('game-outer');
  const wrapper  = document.getElementById('game-stage-wrapper');

  if (!panel || !outer || window.innerWidth < 1024) {
    // Mobile: let CSS handle layout normally
    panel.style.transform       = '';
    panel.style.transformOrigin = '';
    panel.style.position        = '';
    panel.style.top = panel.style.right = panel.style.bottom = panel.style.left = '';
    wrapper.style.position = '';
    wrapper.style.top = wrapper.style.left = '';
    wrapper.style.transform = '';
    wrapper.style.width = wrapper.style.height = '';
    return;
  }

  // Read natural panel size (without any active transform)
  panel.style.transform = '';
  const panelW = panel.offsetWidth;
  const panelH = panel.offsetHeight;

  const availW = outer.clientWidth  - 48;
  const availH = outer.clientHeight - 32;
  const scale  = Math.min(1.6, availW / panelW, availH / panelH);

  // Apply scaling and panel offset (matches original React visual editor values)
  panel.style.position        = 'absolute';
  panel.style.transformOrigin = 'top left';
  panel.style.transform       = `scale(${scale})`;
  panel.style.top    = '-155px';
  panel.style.right  = '0px';
  panel.style.bottom = '0px';
  panel.style.left   = '-155px';

  // Size the wrapper to exactly contain the scaled panel
  wrapper.style.position  = 'absolute';
  wrapper.style.width     = (panelW * scale) + 'px';
  wrapper.style.height    = (panelH * scale) + 'px';

  // Center the wrapper in the outer container
  wrapper.style.top       = '50%';
  wrapper.style.left      = '50%';
  wrapper.style.transform = 'translate(-50%, -50%)';
}


/* ================================================================
   SECTION 14 — GAME LOOP
   ================================================================ */

/**
 * The main game loop, driven by requestAnimationFrame.
 * Called every frame (~60fps) while the game is 'playing'.
 *
 * Each frame:
 *   1. Compute delta-time (seconds since last frame).
 *   2. Advance every entity along the track using the current speed.
 *   3. Drift any moving obstacles sideways, bouncing off the walls.
 *   4. Detect collisions between the player and nearby entities.
 *   5. Remove off-screen and expired entities.
 *   6. Spawn a new wave of entities if the timer has expired.
 *   7. Check for game over (lives = 0).
 *   8. Update the DOM (entities, player, HUD, toasts).
 *
 * @param {DOMHighResTimeStamp} now - Timestamp from requestAnimationFrame.
 */
function gameLoop(now) {
  // ── Compute delta time ──────────────────────────────────────────
  // Cap at 50ms so a long freeze doesn't cause entities to jump far.
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  game.elapsed += dt;

  // ── Speed and spawn rate from current star count ────────────────
  const mult       = speedMult(game.stars);
  const baseSpeed  = 0.34 * mult;           // track scroll speed (units/sec)
  const spawnEvery = Math.max(0.45, 1.4 - game.stars * 0.038); // spawn interval (sec)

  // ── Advance entity positions ────────────────────────────────────
  for (const e of game.entities) {
    // Move entity toward the player (increase progress)
    e.p += baseSpeed * dt;

    // Lateral drift for moving obstacles
    if (e.driftLane !== 0) {
      e.laneF += e.driftLane * dt;

      // Bounce off the left wall
      if (e.laneF < 0) {
        e.laneF    = 0;
        e.driftLane = Math.abs(e.driftLane);
      }
      // Bounce off the right wall
      if (e.laneF > 2) {
        e.laneF    = 2;
        e.driftLane = -Math.abs(e.driftLane);
      }

      // Snap the integer lane to the nearest fractional position
      e.lane = Math.round(e.laneF);
    }
  }

  // ── Collision & collection detection ───────────────────────────
  for (const e of game.entities) {
    if (e.resolved) continue;

    // Check if entity is in the player's lane and close enough
    const isInLane = e.lane === game.lane;
    const isNear   = Math.abs(e.p - PLAYER_P) <= HIT_BAND;

    if (isInLane && isNear) {
      e.resolved = true;

      if (e.type === 'star') {
        // ── Collect a star ──────────────────────────────────────
        game.score += 100;
        game.stars += 1;
        game.toasts.push({
          id:   game.nextId++,
          text: '+100',
          kind: 'collect',
          lane: e.lane,
          born: game.elapsed,
        });

        // Update best score immediately
        if (game.score > bestScore) {
          bestScore = game.score;
          saveBest(bestScore);
        }
      } else {
        // ── Hit an obstacle ─────────────────────────────────────
        game.lives -= 1;
        game.toasts.push({
          id:   game.nextId++,
          text: 'HIT!',
          kind: 'hit',
          lane: e.lane,
          born: game.elapsed,
        });
        shakeTrack();
        renderLives(); // update hearts immediately

        if (game.lives <= 0) {
          game.over = true;
        }
      }
    }
  }

  // ── Remove off-screen and processed entities ────────────────────
  // Keep entities that: haven't passed the player yet, or are still
  // near the player so the hit animation finishes.
  game.entities = game.entities.filter(
    e => e.p < 1.08 && !(e.resolved && e.p > PLAYER_P)
  );

  // Remove toasts older than 0.9 seconds
  game.toasts = game.toasts.filter(
    t => game.elapsed - t.born < 0.9
  );

  // ── Spawn new wave ──────────────────────────────────────────────
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    // Slight random jitter so waves aren't perfectly metronomic
    game.spawnTimer = spawnEvery + (Math.random() - 0.5) * 0.2;

    const group = buildSpawnGroup(game.stars, game.lane, game.nextId);
    game.nextId += group.length;
    game.entities.push(...group);
  }

  // ── Handle game over ────────────────────────────────────────────
  if (game.over) {
    if (game.score > bestScore) {
      bestScore = game.score;
      saveBest(bestScore);
    }
    gameStatus = 'over';
    clearEntityDom();
    updateHUD();
    showGameOver();
    return; // stop the loop
  }

  // ── Update the DOM for this frame ──────────────────────────────
  syncEntities();
  updatePlayerPosition();
  syncToasts();
  updateHUD();

  // ── Schedule the next frame ─────────────────────────────────────
  rafHandle = requestAnimationFrame(gameLoop);
}


/* ================================================================
   SECTION 15 — APP INITIALIZATION
   ================================================================ */

/**
 * Bootstrap the entire application.
 * Called once when the DOM is fully loaded.
 *
 * Steps:
 *   1. Load the best score from storage.
 *   2. Generate all starfield backgrounds.
 *   3. Set up navigation click handlers.
 *   4. Set up keyboard and touch controls.
 *   5. Set up ResizeObservers for responsive layout.
 *   6. Show the home page.
 */
function init() {
  // 1. Load persisted best score
  bestScore = loadBest();

  // 2. Generate starfields for each page and container
  createStarfield(document.getElementById('stars-home-outer'), 40);
  createStarfield(document.getElementById('stars-home-inner'), 42);
  createStarfield(document.getElementById('stars-game'),       50);
  createStarfield(document.getElementById('stars-track'),      40);
  createStarfield(document.getElementById('stars-howto'),      80);

  // 3. Wire up all navigation buttons
  setupNavigation();

  // 4. Wire up keyboard (desktop) and touch (mobile) controls
  setupKeyboard();
  setupTouchControls();

  // 5. ResizeObserver: remeasure track when the game panel resizes
  //    (e.g., on orientation change or window resize)
  const trackResizeObserver = new ResizeObserver(measureTrack);
  const gameTrack = document.getElementById('game-track');
  if (gameTrack) trackResizeObserver.observe(gameTrack);

  // ResizeObserver: recompute desktop stage scale when layout changes
  const stageResizeObserver = new ResizeObserver(measureDesktopStage);
  const gamePanel = document.getElementById('game-panel');
  const gameOuter = document.getElementById('game-outer');
  if (gamePanel) stageResizeObserver.observe(gamePanel);
  if (gameOuter) stageResizeObserver.observe(gameOuter);
  window.addEventListener('resize', measureDesktopStage);

  // 6. Set initial page (home is shown by default via .active class in HTML)
  //    Update nav images to reflect the home active state
  updateAllNavImages('home');

  console.log('%cCOSMO TRIPPIN\' loaded. Have fun! 🚀', 'color: #00e0ff; font-family: monospace;');
}

// Start the app once the DOM is ready
document.addEventListener('DOMContentLoaded', init);
