import { allAlivePlayersHaveMoves, prepareNextLevel, resolveRound } from "./battle-engine.js?v=20260808-hard-enemies";
import { CHARACTERS, LEVELS, getLevelCount, getMove } from "./game-data.js?v=20260808-hard-enemies";
import {
  allPlayersAcknowledgedTutorial,
  createAttractSession,
  formatGameCode,
  getAlivePlayerIds,
  getGameId,
  getLobbyEntries,
  getOrderedPlayers,
  hpPercent
} from "./shared.js?v=20260808-hard-enemies";

let get;
let onValue;
let ref;
let remove;
let serverTimestamp;
let set;
let update;
let db;

const DESIGN_WIDTH = 577;
const DESIGN_HEIGHT = 1439;
const SCREEN_GAME_STORAGE_KEY = "storefront-screen-game";
const MOVE_ANIMATION_FALLBACK_TIMEOUT_MS = 1600;
const MOVE_ANIMATION_READY_TIMEOUT_MS = 10000;
const MOVE_ANIMATION_PLAYBACK_WATCHDOG_MS = 2200;
const BATTLE_BACKGROUND_RESUME_DELAY_MS = 180;
const GAME_OVER_REVEAL_DELAY_MS = 1650;
const GAME_OVER_RESET_DELAY_MS = 15000;
const MOVE_ANIMATION_VERSION = "20260812-alpha-kiosk1";
const IDLE_ANIMATION_VERSION = "20260724-idle-perf2";
const IDLE_BACKGROUND_VERSION = "20260724-idle-perf2";
const PLAYER_ART_VERSION = "20260803-player-art-perf1";
const PLAYER_LOOK_UP_DELAY_MS = 1800;
const LIVE_MOVE_ANIMATION_SPACING_MS = 940;
const WEBSITE_URL = "https://reito-bt.github.io/Monster-Curry-Personality-Prototype-Website/";
const IDLE_IMPACT_WORDS = ["BAM!", "SIZZLE!", "CRUNCH!", "POW!", "SLASH!", "BOOM!"];

const $ = (id) => document.getElementById(id);
const elements = {
  attractView: $("attractView"),
  lobbyView: $("lobbyView"),
  battleView: $("battleView"),
  gameOverView: $("gameOverView"),
  tutorialOverlay: $("tutorialOverlay"),
  tutorialWaitingText: $("tutorialWaitingText"),
  websiteQr: $("websiteQr"),
  websiteQrFallback: $("websiteQrFallback"),
  voucherQrPanel: $("voucherQrPanel"),
  idleBattleBackground: $("idleBattleBackground"),
  idleBattleMove: $("idleBattleMove"),
  idlePlayerFighter: $("idlePlayerFighter"),
  idlePlayerArt: $("idlePlayerArt"),
  idleMoveAnimation: $("idleMoveAnimation"),
  idleMonsterFighter: $("idleMonsterFighter"),
  idleMonsterArt: $("idleMonsterArt"),
  monsterCard: $("monsterCard"),
  liveBattleMove: $("liveBattleMove"),
  liveBattleImpact: $("liveBattleImpact"),
  liveMonsterPortrait: $("liveMonsterPortrait"),
  moveAnimation: $("moveAnimation"),
  moveAnimations: [$("moveAnimation"), $("moveAnimationSecondary")],
  battleBackgroundVideo: $("battleBackgroundVideo"),
  gameCodeLabel: $("gameCodeLabel"),
  lobbyCode: $("lobbyCode"),
  lobbyJoinCode: $("lobbyJoinCode"),
  miniGameCode: $("miniGameCode"),
  gameOverCode: $("gameOverCode"),
  lobbyTitle: $("lobbyTitle"),
  lobbyMessage: $("lobbyMessage"),
  lobbySlots: $("lobbySlots"),
  modeLabel: $("modeLabel"),
  levelLabel: $("levelLabel"),
  turnNumber: $("turnNumber"),
  playerCards: $("playerCards"),
  monsterName: $("monsterName"),
  monsterHpBar: $("monsterHpBar"),
  monsterHpText: $("monsterHpText"),
  monsterArt: $("monsterArt"),
  monsterEffects: $("monsterEffects"),
  battleStatus: $("battleStatus"),
  lastMoves: $("lastMoves"),
  battleLog: $("battleLog"),
  winnerText: $("winnerText"),
  gameOverMessage: $("gameOverMessage"),
  gameOverEyebrow: $("gameOverEyebrow"),
  resetButton: $("resetButton"),
  copyJoinButton: $("copyJoinButton"),
  fullScreenButton: $("fullScreenButton")
};

let resolvingToken = null;
let levelAdvanceToken = null;
let gameOverTimer = null;
let gameId = null;
let gameCode = null;
let sessionRef = null;
let unsubscribe = null;
let rotatingSession = false;
let battleBackgroundRunning = false;
let battleBackgroundSuspendedForMove = false;
let battleBackgroundResumeTimer = null;
let idleBattleTimer = null;
let idleBattleState = null;
let idleCharacterCursor = 0;
let idleMonsterCursor = 0;
let idleBackgroundRequest = 0;
let idleBackgroundWarmTimer = null;
let liveBattleAnimationToken = null;
let screenScaleFrame = null;
let lastBattleSnapshot = null;
let gameOverRevealTimer = null;
const liveBattleTimers = new Set();
const warmedMoveAnimations = new Set();
const warmingMoveAnimations = new Set();
const queuedMoveAnimations = new Set();
const moveAnimationWarmQueue = [];
const idleBackgroundPreloads = new Map();
const playerArtPreloads = new Map();
const playerCardElements = new Map();
const idleElementAnimationStates = new WeakMap();
const moveAnimationPlaybackStates = new WeakMap();
const activeLiveMoveVideos = new Set();
const moveAnimationReadinessByToken = new Map();
const moveAnimationReadinessJobs = new Map();
let moveAnimationWarmQueueRunning = false;
let liveMoveTransparencyVerified = false;
const transparentMoveAnimationsSupported = Boolean(
  elements.moveAnimation?.canPlayType('video/webm; codecs="vp9"')
);
const animationQuality = new URLSearchParams(window.location.search).get("animationQuality");
const preferTransparentBattleAnimations = Boolean(
  transparentMoveAnimationsSupported && animationQuality !== "static"
);
const useHighQualityBattleAnimations = animationQuality === "high";
const constrainedAnimationDevice = Boolean(
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  || (navigator.deviceMemory && navigator.deviceMemory <= 4)
);
const networkInformation = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const idleVideoAnimationsEnabled = Boolean(
  transparentMoveAnimationsSupported
  && animationQuality !== "static"
  && !constrainedAnimationDevice
  && !networkInformation?.saveData
  && !["slow-2g", "2g"].includes(networkInformation?.effectiveType)
  && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
);

function updateScreenScale() {
  const viewport = window.visualViewport;
  const viewportWidth = Math.max(1, viewport?.width || document.documentElement.clientWidth || window.innerWidth);
  const viewportHeight = Math.max(1, viewport?.height || document.documentElement.clientHeight || window.innerHeight);
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const scale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT);
  const screenWidth = DESIGN_WIDTH * scale;
  const screenHeight = DESIGN_HEIGHT * scale;
  const screenX = viewportLeft + Math.max(0, (viewportWidth - screenWidth) / 2);
  const screenY = viewportTop + Math.max(0, (viewportHeight - screenHeight) / 2);
  const rootStyle = document.documentElement.style;

  rootStyle.setProperty("--screen-scale", String(scale));
  rootStyle.setProperty("--screen-x", `${screenX}px`);
  rootStyle.setProperty("--screen-y", `${screenY}px`);
}

function scheduleScreenScaleUpdate() {
  updateScreenScale();
  window.cancelAnimationFrame(screenScaleFrame);
  screenScaleFrame = window.requestAnimationFrame(() => {
    screenScaleFrame = window.requestAnimationFrame(() => {
      screenScaleFrame = null;
      updateScreenScale();
    });
  });
}

function isFourDigitCode(value) {
  return /^\d{4}$/.test(String(value || ""));
}

function generateFourDigitCode() {
  const randomValue = new Uint32Array(1);
  window.crypto.getRandomValues(randomValue);
  return String(1000 + (randomValue[0] % 9000));
}

async function findAvailableGameId(excludedGameId = null) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = generateFourDigitCode();
    if (candidate === excludedGameId) {
      continue;
    }
    const snapshot = await get(ref(db, `sessions/${candidate}`));
    if (!snapshot.exists()) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a four-digit game code.");
}

function updateGameCodeLabels(state = null) {
  elements.gameCodeLabel.textContent = gameCode || "----";
  elements.lobbyCode.textContent = gameCode || "----";
  elements.lobbyJoinCode.textContent = gameCode || "----";
  elements.miniGameCode.textContent = gameCode || "----";
  elements.gameOverCode.textContent = state?.status === "game-over" ? "New code soon" : gameCode || "----";
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function renderWebsiteQr() {
  if (!elements.websiteQr) {
    return;
  }

  if (window.QRious) {
    elements.websiteQr.hidden = false;
    elements.websiteQrFallback.hidden = true;
    new window.QRious({
      element: elements.websiteQr,
      value: WEBSITE_URL,
      size: 260,
      level: "H",
      background: "white",
      foreground: "#151515"
    });
    return;
  }

  elements.websiteQr.hidden = true;
  elements.websiteQrFallback.hidden = false;
  elements.websiteQrFallback.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(WEBSITE_URL)}`;
}

async function connectFirebase() {
  const [databaseModule, firebaseModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
    import("./firebase.js")
  ]);

  ({
    get,
    onValue,
    ref,
    remove,
    serverTimestamp,
    set,
    update
  } = databaseModule);
  db = firebaseModule.db;
}

function clearIdleElementAnimations(element) {
  if (!element) {
    return;
  }

  const states = idleElementAnimationStates.get(element);
  if (!states) {
    return;
  }

  states.forEach((state, className) => {
    window.cancelAnimationFrame(state.frame);
    window.clearTimeout(state.timer);
    element.classList.remove(className);
  });
  idleElementAnimationStates.delete(element);
}

function animateIdleElement(element, className, duration = 720) {
  if (!element) {
    return;
  }

  let states = idleElementAnimationStates.get(element);
  if (!states) {
    states = new Map();
    idleElementAnimationStates.set(element, states);
  }

  const previousState = states.get(className);
  window.cancelAnimationFrame(previousState?.frame);
  window.clearTimeout(previousState?.timer);
  element.classList.remove(className);
  const state = { frame: null, timer: null };
  states.set(className, state);
  state.frame = window.requestAnimationFrame(() => {
    state.frame = window.requestAnimationFrame(() => {
      state.frame = null;
      element.classList.add(className);
      state.timer = window.setTimeout(() => {
        element.classList.remove(className);
        states.delete(className);
        if (states.size === 0) {
          idleElementAnimationStates.delete(element);
        }
      }, duration);
    });
  });
}

function idleBackgroundUrl(backgroundPath) {
  if (!backgroundPath) {
    return null;
  }

  const url = new URL(backgroundPath, window.location.href);
  url.searchParams.set("v", IDLE_BACKGROUND_VERSION);
  return url.href;
}

function preloadIdleBackground(backgroundPath) {
  const sourceUrl = idleBackgroundUrl(backgroundPath);
  if (!sourceUrl) {
    return Promise.resolve(null);
  }

  if (!idleBackgroundPreloads.has(sourceUrl)) {
    const preload = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => resolve(sourceUrl), { once: true });
      image.addEventListener("error", () => {
        idleBackgroundPreloads.delete(sourceUrl);
        resolve(null);
      }, { once: true });
      image.src = sourceUrl;
    });
    idleBackgroundPreloads.set(sourceUrl, preload);
  }

  return idleBackgroundPreloads.get(sourceUrl);
}

function getPlayerArtPath(player) {
  const character = CHARACTERS.find((entry) => entry.id === player?.characterId);
  return character?.idleAsset || character?.asset || player?.asset || null;
}

function getPlayerArtUrl(player) {
  const assetPath = getPlayerArtPath(player);
  if (!assetPath) {
    return null;
  }

  const url = new URL(assetPath, window.location.href);
  url.searchParams.set("v", PLAYER_ART_VERSION);
  return url.href;
}

function preloadPlayerArt(player) {
  const sourceUrl = getPlayerArtUrl(player);
  if (!sourceUrl) {
    return Promise.resolve(null);
  }

  if (!playerArtPreloads.has(sourceUrl)) {
    const preload = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.addEventListener("load", () => {
        const decode = typeof image.decode === "function" ? image.decode() : Promise.resolve();
        decode.catch(() => { }).finally(() => resolve(sourceUrl));
      }, { once: true });
      image.addEventListener("error", () => {
        playerArtPreloads.delete(sourceUrl);
        resolve(null);
      }, { once: true });
      image.src = sourceUrl;
    });
    playerArtPreloads.set(sourceUrl, preload);
  }

  return playerArtPreloads.get(sourceUrl);
}

function warmSelectedCharacterArt(state) {
  const characterIds = new Set([
    ...getLobbyEntries(state)
      .filter((entry) => entry.confirmed && entry.characterId)
      .map((entry) => entry.characterId),
    ...getOrderedPlayers(state)
      .map((player) => player.characterId)
      .filter(Boolean)
  ]);

  characterIds.forEach((characterId) => {
    const character = CHARACTERS.find((entry) => entry.id === characterId);
    if (character) {
      void preloadPlayerArt({ characterId, asset: character.asset });
    }
  });
}

function updateIdleBattleBackground(backgroundPath) {
  const sourceUrl = idleBackgroundUrl(backgroundPath);
  if (!sourceUrl || elements.idleBattleBackground.dataset.sourceUrl === sourceUrl) {
    return;
  }

  const requestId = ++idleBackgroundRequest;
  void preloadIdleBackground(backgroundPath).then((loadedUrl) => {
    if (!loadedUrl || requestId !== idleBackgroundRequest || elements.attractView.hidden) {
      return;
    }

    elements.idleBattleBackground.style.backgroundImage = `url("${loadedUrl}")`;
    elements.idleBattleBackground.dataset.sourceUrl = loadedUrl;
  });
}

function updateIdleBattleDisplay() {
  const state = idleBattleState;
  if (!state) {
    return;
  }

  elements.idlePlayerArt.src = state.character.idleAsset || state.character.asset;
  elements.idlePlayerArt.alt = state.character.name;
  elements.idlePlayerFighter.dataset.characterId = state.character.id;
  elements.idleMonsterArt.src = state.monster.asset;
  elements.idleMonsterArt.alt = state.monster.name;
  elements.idleMonsterFighter.dataset.monsterName = state.monster.name;
  updateIdleBattleBackground(state.monster.idleBackground);
}

function showIdleBattleMove(moveName) {
  elements.idleBattleMove.textContent = moveName;
  animateIdleElement(elements.idleBattleMove, "is-showing", 1080);
}

function scheduleIdleBattleStep(delay) {
  window.clearTimeout(idleBattleTimer);
  idleBattleTimer = window.setTimeout(() => {
    idleBattleTimer = null;
    runIdleBattleStep();
  }, delay);
}

function resetIdleBattle() {
  const character = CHARACTERS[idleCharacterCursor % CHARACTERS.length];
  const monster = LEVELS.solo[idleMonsterCursor % LEVELS.solo.length];
  const playerMove = getMove(character.moves[0]);
  const playerAnimationMove = playerMove && character.idleAnimation
    ? { ...playerMove, animation: character.idleAnimation }
    : null;
  idleCharacterCursor = (idleCharacterCursor + 1) % CHARACTERS.length;
  idleMonsterCursor = (idleMonsterCursor + 1) % LEVELS.solo.length;
  idleBattleState = {
    character,
    monster,
    playerMove,
    playerAnimationMove,
    playerAnimationShown: false,
    playerHp: 100,
    monsterHp: 100,
    playerTurn: true
  };

  clearMoveAnimationPlayback(elements.idleMoveAnimation);
  clearIdleElementAnimations(elements.idleBattleMove);
  clearIdleElementAnimations(elements.idlePlayerFighter);
  clearIdleElementAnimations(elements.idleMonsterFighter);
  elements.idlePlayerFighter.classList.remove("is-attacking", "is-hit", "is-victorious", "is-defeated");
  elements.idleMonsterFighter.classList.remove("is-attacking", "is-hit", "is-victorious", "is-defeated");
  showIdleBattleMove(`${character.name} enters the arena!`);
  updateIdleBattleDisplay();
  if (idleVideoAnimationsEnabled && playerAnimationMove) {
    warmMoveAnimation(playerAnimationMove);
  }
  window.clearTimeout(idleBackgroundWarmTimer);
  idleBackgroundWarmTimer = window.setTimeout(() => {
    idleBackgroundWarmTimer = null;
    if (idleBattleState?.character === character && !document.hidden && !elements.attractView.hidden) {
      void preloadIdleBackground(LEVELS.solo[idleMonsterCursor % LEVELS.solo.length]?.idleBackground);
    }
  }, 1400);
}

function runIdleBattleStep() {
  if (elements.attractView.hidden) {
    return;
  }

  if (!idleBattleState) {
    resetIdleBattle();
  }

  const state = idleBattleState;
  const playerAttacks = state.playerTurn;
  const attacker = playerAttacks ? elements.idlePlayerFighter : elements.idleMonsterFighter;
  const defender = playerAttacks ? elements.idleMonsterFighter : elements.idlePlayerFighter;
  const move = playerAttacks
    ? state.playerMove
    : getMove(randomItem(state.monster.moves));
  const damage = Math.floor(15 + Math.random() * 18);

  if (playerAttacks) {
    state.monsterHp = Math.max(0, state.monsterHp - damage);
  } else {
    state.playerHp = Math.max(0, state.playerHp - damage);
  }

  showIdleBattleMove(move?.name || "Power attack");
  if (playerAttacks && !state.playerAnimationShown && idleVideoAnimationsEnabled && state.playerAnimationMove) {
    state.playerAnimationShown = true;
    playMoveAnimation(state.playerAnimationMove, elements.idleMoveAnimation, true);
  }
  animateIdleElement(attacker, "is-attacking");
  animateIdleElement(defender, "is-hit", 560);
  updateIdleBattleDisplay();

  const battleEnded = state.playerHp <= 0 || state.monsterHp <= 0;
  if (battleEnded) {
    const playerWon = state.monsterHp <= 0;
    const winner = playerWon ? elements.idlePlayerFighter : elements.idleMonsterFighter;
    const defeated = playerWon ? elements.idleMonsterFighter : elements.idlePlayerFighter;
    showIdleBattleMove(playerWon ? `${state.character.name} wins!` : "Monster wins!");
    winner.classList.add("is-victorious");
    defeated.classList.add("is-defeated");
    scheduleIdleBattleStep(1650);
    idleBattleState = null;
    return;
  }

  state.playerTurn = !state.playerTurn;
  scheduleIdleBattleStep(1050 + Math.floor(Math.random() * 500));
}

function startIdleBattle() {
  if (idleBattleTimer) {
    return;
  }

  resetIdleBattle();
  scheduleIdleBattleStep(700);
}

function stopIdleBattle() {
  window.clearTimeout(idleBattleTimer);
  window.clearTimeout(idleBackgroundWarmTimer);
  idleBattleTimer = null;
  idleBackgroundWarmTimer = null;
  idleBattleState = null;
  idleBackgroundRequest += 1;
  clearMoveAnimationPlayback(elements.idleMoveAnimation);
  clearIdleElementAnimations(elements.idleBattleMove);
  clearIdleElementAnimations(elements.idlePlayerFighter);
  clearIdleElementAnimations(elements.idleMonsterFighter);
  elements.idlePlayerFighter.classList.remove("is-attacking", "is-hit", "is-victorious", "is-defeated");
  elements.idleMonsterFighter.classList.remove("is-attacking", "is-hit", "is-victorious", "is-defeated");
}

function scheduleLiveBattleAnimation(callback, delay) {
  const timer = window.setTimeout(() => {
    liveBattleTimers.delete(timer);
    callback();
  }, delay);
  liveBattleTimers.add(timer);
}

function getMoveAnimationPlaybackState(video) {
  if (!moveAnimationPlaybackStates.has(video)) {
    moveAnimationPlaybackStates.set(video, {
      fallbackTimer: null,
      watchdogTimer: null,
      requestId: 0
    });
  }

  return moveAnimationPlaybackStates.get(video);
}

function clearMoveAnimationPlayback(video) {
  if (!video) {
    return;
  }

  const playback = getMoveAnimationPlaybackState(video);
  window.clearTimeout(playback.fallbackTimer);
  window.clearTimeout(playback.watchdogTimer);
  playback.fallbackTimer = null;
  playback.watchdogTimer = null;
  playback.requestId += 1;
  video.pause();
  video.oncanplay = null;
  video.onerror = null;
  setMoveAnimationPlaying(video, false);
  video.classList.remove("has-transparent-source");
  if (video.getAttribute("src")) {
    video.removeAttribute("src");
    video.load();
  }
  if (elements.moveAnimations.includes(video)) {
    activeLiveMoveVideos.delete(video);
    resumeBattleBackgroundAfterMove();
  }
}

function setMoveAnimationPlaying(video, playing) {
  if (!video) {
    return;
  }

  video.classList.toggle("is-playing", playing);
  if (video === elements.idleMoveAnimation) {
    elements.idlePlayerFighter.classList.toggle("is-playing-animation", playing);
  }
}

function cancelMoveAnimationReadiness(token) {
  moveAnimationReadinessJobs.get(token)?.cancel();
}

function cancelAllMoveAnimationReadiness() {
  [...moveAnimationReadinessJobs.values()].forEach((job) => job.cancel());
}

function verifyLiveMoveTransparency(video) {
  if (liveMoveTransparencyVerified) {
    return true;
  }

  if (!video.videoWidth || !video.videoHeight) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return false;
    }

    const sampleSize = Math.max(1, Math.min(12, video.videoWidth, video.videoHeight));
    const edgeSamples = [
      [0, 0],
      [video.videoWidth - sampleSize, 0],
      [0, video.videoHeight - sampleSize],
      [video.videoWidth - sampleSize, video.videoHeight - sampleSize]
    ];
    edgeSamples.forEach(([sourceX, sourceY], targetX) => {
      context.drawImage(
        video,
        sourceX,
        sourceY,
        sampleSize,
        sampleSize,
        targetX,
        0,
        1,
        1
      );
    });

    const pixels = context.getImageData(0, 0, 4, 1).data;
    liveMoveTransparencyVerified = edgeSamples.some((_, index) => pixels[index * 4 + 3] < 250);
    return liveMoveTransparencyVerified;
  } catch {
    return false;
  }
}

function clearLiveBattleAnimations({ cancelReadiness = true, preservePreparedVideos = false } = {}) {
  liveBattleTimers.forEach((timer) => window.clearTimeout(timer));
  liveBattleTimers.clear();
  liveBattleAnimationToken = null;
  lastBattleSnapshot = null;
  elements.liveBattleMove.classList.remove("is-showing");
  elements.liveBattleImpact.classList.remove("is-bursting");
  elements.liveMonsterPortrait.classList.remove("is-showing");
  if (cancelReadiness) {
    cancelAllMoveAnimationReadiness();
  }
  elements.moveAnimations
    .filter((video) => !preservePreparedVideos || video.classList.contains("is-playing"))
    .forEach(clearMoveAnimationPlayback);
  activeLiveMoveVideos.clear();
}

function pruneMoveAnimationReadiness(state) {
  const activeTokens = new Set([
    ...Object.values(state?.pendingMoves || {}),
    ...Object.values(state?.activeMoves || {})
  ].map((entry) => entry?.token).filter(Boolean));

  moveAnimationReadinessJobs.forEach((_, token) => {
    if (!activeTokens.has(token)) {
      cancelMoveAnimationReadiness(token);
    }
  });
  moveAnimationReadinessByToken.forEach((_, token) => {
    if (!activeTokens.has(token)) {
      moveAnimationReadinessByToken.delete(token);
    }
  });
}

function getPlayerBattleCard(playerId) {
  return Array.from(elements.playerCards.children)
    .find((card) => card.dataset.playerId === playerId) || null;
}

function showLiveMonsterPortrait(monster) {
  if (!monster?.asset) {
    return;
  }
  elements.liveMonsterPortrait.src = monster.asset;
  elements.liveMonsterPortrait.alt = monster.name || "Monster";
  animateIdleElement(elements.liveMonsterPortrait, "is-showing", 1080);
}

function showLiveBattleAction(moveName, impact = null) {
  elements.liveBattleMove.textContent = moveName;
  animateIdleElement(elements.liveBattleMove, "is-showing", 1080);
  if (impact) {
    elements.liveBattleImpact.textContent = impact;
    animateIdleElement(elements.liveBattleImpact, "is-bursting", 700);
  }
}

function moveAnimationUrl(move, transparent = preferTransparentBattleAnimations) {
  if (!move?.animation) {
    return null;
  }

  const isIdleAnimation = move.animation.includes("/animations/idle/");
  const transparentExtension = isIdleAnimation || useHighQualityBattleAnimations
    ? ".webm"
    : ".kiosk.webm";
  const animationPath = transparent
    ? move.animation.replace(/\.mp4$/i, transparentExtension)
    : move.animation;
  const url = new URL(animationPath, window.location.href);
  url.searchParams.set(
    "v",
    animationPath.includes("/animations/idle/")
      ? IDLE_ANIMATION_VERSION
      : MOVE_ANIMATION_VERSION
  );
  return url.href;
}

async function consumeResponseBody(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    await response.blob();
    return;
  }

  while (true) {
    const { done } = await reader.read();
    if (done) {
      return;
    }
  }
}

async function fetchMoveAnimationSource(sourceUrl, urgent = false) {
  if (!sourceUrl || warmedMoveAnimations.has(sourceUrl) || warmingMoveAnimations.has(sourceUrl)) {
    return;
  }

  warmingMoveAnimations.add(sourceUrl);
  try {
    const response = await fetch(sourceUrl, {
      cache: "force-cache",
      priority: urgent ? "high" : "low"
    });
    if (!response.ok) {
      throw new Error(`Could not preload move animation (${response.status})`);
    }
    await consumeResponseBody(response);
    warmedMoveAnimations.add(sourceUrl);
  } catch {
    // The prepared video element still retries the transparent source on demand.
  } finally {
    warmingMoveAnimations.delete(sourceUrl);
  }
}

async function drainMoveAnimationWarmQueue() {
  if (moveAnimationWarmQueueRunning) {
    return;
  }

  moveAnimationWarmQueueRunning = true;
  try {
    while (moveAnimationWarmQueue.length) {
      const { sourceUrl } = moveAnimationWarmQueue.shift();
      queuedMoveAnimations.delete(sourceUrl);
      await fetchMoveAnimationSource(sourceUrl);
    }
  } finally {
    moveAnimationWarmQueueRunning = false;
    if (moveAnimationWarmQueue.length) {
      void drainMoveAnimationWarmQueue();
    }
  }
}

function warmMoveAnimation(
  move,
  {
    urgent = false,
    transparent = preferTransparentBattleAnimations
  } = {}
) {
  const sourceUrl = moveAnimationUrl(move, transparent);
  if (!sourceUrl || warmedMoveAnimations.has(sourceUrl) || warmingMoveAnimations.has(sourceUrl)) {
    return;
  }

  if (queuedMoveAnimations.has(sourceUrl)) {
    const queuedIndex = moveAnimationWarmQueue.findIndex((entry) => entry.sourceUrl === sourceUrl);
    if (!urgent) {
      return;
    }
    if (queuedIndex >= 0) {
      moveAnimationWarmQueue.splice(queuedIndex, 1);
    }
    queuedMoveAnimations.delete(sourceUrl);
  }

  if (urgent) {
    void fetchMoveAnimationSource(sourceUrl, true);
    return;
  }

  moveAnimationWarmQueue.push({ sourceUrl });
  queuedMoveAnimations.add(sourceUrl);
  void drainMoveAnimationWarmQueue();
}

function warmSelectedCharacterAnimations(state) {
  if (
    state?.status === "attract"
    || constrainedAnimationDevice
    || !preferTransparentBattleAnimations
  ) {
    return;
  }

  const characterIds = new Set([
    ...getLobbyEntries(state)
      .filter((entry) => entry.confirmed && entry.characterId)
      .map((entry) => entry.characterId),
    ...Object.values(state?.players || {})
      .map((player) => player.characterId)
      .filter(Boolean)
  ]);

  characterIds.forEach((characterId) => {
    const character = CHARACTERS.find((entry) => entry.id === characterId);
    character?.moves
      .map((moveId) => getMove(moveId))
      .filter(Boolean)
      .forEach((move) => warmMoveAnimation(move));
  });
}

function prepareMoveAnimation(
  move,
  video = elements.moveAnimation,
  preferTransparency = preferTransparentBattleAnimations
) {
  if (
    !video
    || !move?.animation
    || !preferTransparency
    || !transparentMoveAnimationsSupported
    || video.classList.contains("is-playing")
  ) {
    return;
  }

  const usesTransparency = true;
  const sourceUrl = moveAnimationUrl(move, true);
  const alternateUrl = null;
  if (!sourceUrl || (video.src === sourceUrl && !video.error)) {
    return;
  }

  const playback = getMoveAnimationPlaybackState(video);
  window.clearTimeout(playback.fallbackTimer);
  window.clearTimeout(playback.watchdogTimer);
  playback.fallbackTimer = null;
  playback.watchdogTimer = null;
  playback.requestId += 1;
  video.pause();
  video.oncanplay = null;
  video.onerror = null;
  setMoveAnimationPlaying(video, false);
  video.classList.toggle("has-transparent-source", usesTransparency);
  video.preload = "auto";
  const fallbackUrl = alternateUrl;
  const loadPreparedSource = (nextUrl, nextUsesTransparency) => {
    if (!nextUrl) {
      return;
    }
    video.classList.toggle("has-transparent-source", nextUsesTransparency);
    video.onerror = fallbackUrl && nextUrl !== fallbackUrl
      ? () => loadPreparedSource(fallbackUrl, !usesTransparency)
      : null;
    video.oncanplay = null;
    video.src = nextUrl;
    video.load();
  };
  loadPreparedSource(sourceUrl, usesTransparency);
}

function waitForMoveAnimationReady(move, video, token) {
  if (
    !video
    || !move?.animation
    || !token
    || !preferTransparentBattleAnimations
    || !transparentMoveAnimationsSupported
  ) {
    if (token) {
      moveAnimationReadinessByToken.set(token, false);
    }
    return Promise.resolve(false);
  }

  const sourceUrl = moveAnimationUrl(move, true);
  if (!sourceUrl) {
    moveAnimationReadinessByToken.set(token, false);
    return Promise.resolve(false);
  }

  if (moveAnimationReadinessByToken.has(token)) {
    return Promise.resolve(moveAnimationReadinessByToken.get(token));
  }

  const existingJob = moveAnimationReadinessJobs.get(token);
  if (existingJob) {
    return existingJob.promise;
  }

  const job = { cancel: null, promise: null };
  job.promise = new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    const finish = (ready, recordResult = true) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      if (moveAnimationReadinessJobs.get(token) === job) {
        moveAnimationReadinessJobs.delete(token);
      }
      if (recordResult) {
        moveAnimationReadinessByToken.set(token, ready);
      }
      resolve(ready);
    };
    const handleCanPlay = () => {
      if (video.src !== sourceUrl) {
        return;
      }

      if (!verifyLiveMoveTransparency(video)) {
        finish(false);
        return;
      }

      finish(true);
    };
    const handleError = () => {
      if (video.src === sourceUrl) {
        finish(false);
      }
    };

    job.cancel = () => finish(false, false);
    moveAnimationReadinessJobs.set(token, job);

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    timeout = window.setTimeout(() => finish(false), MOVE_ANIMATION_READY_TIMEOUT_MS);

    if (video.src !== sourceUrl) {
      prepareMoveAnimation(move, video, true);
    }

    if (video.error) {
      handleError();
    } else if (video.src === sourceUrl && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      handleCanPlay();
    }
  });

  return job.promise;
}

function waitForPendingMoveAnimations(state) {
  const pendingMoves = state?.pendingMoves || {};
  const jobs = getOrderedPlayers(state)
    .filter((player) => player.hp > 0)
    .map((player, index) => {
      const pendingMove = pendingMoves[player.id];
      return {
        move: getMove(pendingMove?.moveId),
        token: pendingMove?.token,
        video: elements.moveAnimations[index % elements.moveAnimations.length]
      };
    })
    .filter(({ move, token }) => move && token)
    .map(({ move, token, video }) => waitForMoveAnimationReady(move, video, token));

  return Promise.all(jobs);
}

function playMoveAnimation(
  move,
  video = elements.moveAnimation,
  preferTransparency = preferTransparentBattleAnimations
) {
  if (
    !video
    || !move?.animation
    || !preferTransparency
    || !transparentMoveAnimationsSupported
  ) {
    return;
  }

  const playback = getMoveAnimationPlaybackState(video);
  window.clearTimeout(playback.fallbackTimer);
  window.clearTimeout(playback.watchdogTimer);
  playback.fallbackTimer = null;
  playback.watchdogTimer = null;
  const requestId = ++playback.requestId;
  const transparentUrl = moveAnimationUrl(move, true);
  const isLiveVideo = elements.moveAnimations.includes(video);
  if (
    isLiveVideo
    && (video.src !== transparentUrl || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
  ) {
    return;
  }
  const preferredUrl = transparentUrl;
  const secondaryUrl = null;
  const preparedUrl = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && [preferredUrl, secondaryUrl].includes(video.src)
    ? video.src
    : preferredUrl;
  const preparedUsesTransparency = preparedUrl === transparentUrl;
  const retryUrl = preparedUrl === preferredUrl ? secondaryUrl : preferredUrl;
  const hasRetrySource = Boolean(retryUrl && retryUrl !== preparedUrl);

  const finishPlayback = () => {
    window.clearTimeout(playback.fallbackTimer);
    window.clearTimeout(playback.watchdogTimer);
    playback.fallbackTimer = null;
    playback.watchdogTimer = null;
    video.oncanplay = null;
    video.onerror = null;
    video.pause();
    setMoveAnimationPlaying(video, false);
    if (isLiveVideo) {
      activeLiveMoveVideos.delete(video);
      resumeBattleBackgroundAfterMove();
    }
  };

  const startPlayback = (sourceUrl, usesTransparency, retryUrl = null, retryUsesTransparency = false) => {
    if (requestId !== playback.requestId || video.src !== sourceUrl) {
      return;
    }

    window.clearTimeout(playback.fallbackTimer);
    window.clearTimeout(playback.watchdogTimer);
    playback.fallbackTimer = null;
    playback.watchdogTimer = null;
    video.oncanplay = null;
    video.onerror = finishPlayback;
    video.pause();
    if (isLiveVideo && !verifyLiveMoveTransparency(video)) {
      finishPlayback();
      return;
    }
    video.currentTime = 0;
    setMoveAnimationPlaying(video, false);
    video.classList.toggle("has-transparent-source", usesTransparency);
    setMoveAnimationPlaying(video, true);
    if (isLiveVideo) {
      activeLiveMoveVideos.add(video);
      suspendBattleBackgroundForMove();
    }
    video.play()
      .catch(() => {
        if (requestId !== playback.requestId) {
          return;
        }

        if (isLiveVideo) {
          activeLiveMoveVideos.delete(video);
          resumeBattleBackgroundAfterMove();
        }
        if (retryUrl) {
          loadSource(retryUrl, retryUsesTransparency);
        } else {
          finishPlayback();
        }
      });
    playback.watchdogTimer = window.setTimeout(finishPlayback, MOVE_ANIMATION_PLAYBACK_WATCHDOG_MS);
  };

  const loadSource = (sourceUrl, usesTransparency, retryUrl = null, retryUsesTransparency = false) => {
    if (!sourceUrl || requestId !== playback.requestId) {
      return;
    }

    window.clearTimeout(playback.fallbackTimer);
    window.clearTimeout(playback.watchdogTimer);
    playback.fallbackTimer = null;
    playback.watchdogTimer = null;
    video.pause();
    setMoveAnimationPlaying(video, false);
    video.classList.toggle("has-transparent-source", usesTransparency);
    video.oncanplay = () => startPlayback(sourceUrl, usesTransparency, retryUrl, retryUsesTransparency);
    video.onerror = () => {
      if (requestId !== playback.requestId) {
        return;
      }

      if (isLiveVideo) {
        resumeBattleBackgroundAfterMove();
      }
      if (retryUrl) {
        loadSource(retryUrl, retryUsesTransparency);
      } else {
        finishPlayback();
      }
    };

    if (video.src !== sourceUrl) {
      video.src = sourceUrl;
      video.load();
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback(sourceUrl, usesTransparency, retryUrl, retryUsesTransparency);
      return;
    }

    if (isLiveVideo) {
      finishPlayback();
      return;
    }

    playback.fallbackTimer = window.setTimeout(() => {
      playback.fallbackTimer = null;
      if (requestId === playback.requestId && !video.classList.contains("is-playing")) {
        if (retryUrl) {
          loadSource(retryUrl, retryUsesTransparency);
        } else {
          finishPlayback();
        }
      }
    }, MOVE_ANIMATION_FALLBACK_TIMEOUT_MS);
  };

  loadSource(
    preparedUrl,
    preparedUsesTransparency,
    hasRetrySource ? retryUrl : null,
    retryUrl === transparentUrl
  );
}

function captureBattleSnapshot(state) {
  return {
    roundResultCreatedAt: state.roundResult?.createdAt || null,
    monsterHp: Number(state.monster?.hp || 0),
    players: Object.fromEntries(getOrderedPlayers(state).map((player) => [player.id, Number(player.hp || 0)]))
  };
}

function animateResolvingMoves(state) {
  if (state.status !== "resolving") {
    return;
  }

  const activeMoves = state.activeMoves || {};
  const token = Object.values(activeMoves).map((entry) => entry.token).filter(Boolean).sort().join("|");
  if (!token || liveBattleAnimationToken === token) {
    return;
  }

  liveBattleAnimationToken = token;
  const actions = getOrderedPlayers(state)
    .map((player) => ({
      player,
      move: getMove(activeMoves[player.id]?.moveId),
      token: activeMoves[player.id]?.token
    }))
    .filter((action) => action.move && action.player.hp > 0);

  actions.forEach(({ player, move, token: moveToken }, index) => {
    scheduleLiveBattleAnimation(() => {
      if (elements.battleView.hidden || document.hidden) {
        return;
      }

      const playerCard = getPlayerBattleCard(player.id);
      showLiveBattleAction(move.name, randomItem(IDLE_IMPACT_WORDS));
      const video = elements.moveAnimations[index % elements.moveAnimations.length];
      if (
        moveAnimationReadinessByToken.get(moveToken) === true
        && video.src === moveAnimationUrl(move, true)
        && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        playMoveAnimation(move, video);
      }
      animateIdleElement(playerCard, "is-live-attacking", 680);
      if (move.power || move.hits) {
        animateIdleElement(elements.monsterCard, "is-live-hit", 580);
      }
    }, PLAYER_LOOK_UP_DELAY_MS + index * (LIVE_MOVE_ANIMATION_SPACING_MS + MOVE_ANIMATION_FALLBACK_TIMEOUT_MS));
  });
}

function monsterMoveNameFromMessages(monsterName, messages) {
  const prefix = `${monsterName} used `;
  const message = messages.find((entry) => entry.startsWith(prefix));
  if (!message) {
    return messages.some((entry) => entry.startsWith(`${monsterName} gained `))
      ? getMove("monster-guard")?.name || "Monster Guard"
      : null;
  }

  const remainder = message.slice(prefix.length);
  return remainder.split(" on ")[0].split(".")[0];
}

function animateRoundOutcome(state, previousSnapshot) {
  const roundResultCreatedAt = state.roundResult?.createdAt || null;
  if (!previousSnapshot || !roundResultCreatedAt || previousSnapshot.roundResultCreatedAt === roundResultCreatedAt) {
    return;
  }

  const messages = Array.isArray(state.roundResult?.messages) ? state.roundResult.messages : [];
  const monsterMoveName = monsterMoveNameFromMessages(state.monster?.name || "", messages);
  const damagedPlayerIds = getOrderedPlayers(state)
    .filter((player) => Number(player.hp || 0) < Number(previousSnapshot.players[player.id] ?? player.hp))
    .map((player) => player.id);

  if (monsterMoveName) {
    scheduleLiveBattleAnimation(() => {
      if (elements.battleView.hidden) {
        return;
      }

      showLiveBattleAction(monsterMoveName, randomItem(IDLE_IMPACT_WORDS));
      showLiveMonsterPortrait(state.monster);
      animateIdleElement(elements.monsterCard, "is-live-attacking", 680);
      damagedPlayerIds.forEach((playerId) => animateIdleElement(getPlayerBattleCard(playerId), "is-live-hit", 580));
    }, 100);
  } else if (Number(state.monster?.hp || 0) <= 0 && previousSnapshot.monsterHp > 0) {
    scheduleLiveBattleAnimation(() => showLiveBattleAction(`${state.monster.name} defeated!`, "KO!"), 100);
  }
}

function suspendBattleBackgroundForMove() {
  window.clearTimeout(battleBackgroundResumeTimer);
  battleBackgroundResumeTimer = null;
  if (!battleBackgroundRunning || battleBackgroundSuspendedForMove) {
    return;
  }

  battleBackgroundSuspendedForMove = true;
  elements.battleView.classList.add("is-move-playing");
  elements.battleBackgroundVideo.pause();
}

function resumeBattleBackgroundAfterMove() {
  if (activeLiveMoveVideos.size > 0) {
    window.clearTimeout(battleBackgroundResumeTimer);
    battleBackgroundResumeTimer = null;
    return;
  }

  if (!battleBackgroundSuspendedForMove) {
    elements.battleView.classList.remove("is-move-playing");
    return;
  }

  window.clearTimeout(battleBackgroundResumeTimer);
  battleBackgroundResumeTimer = window.setTimeout(() => {
    battleBackgroundResumeTimer = null;
    if (activeLiveMoveVideos.size > 0) {
      return;
    }
    battleBackgroundSuspendedForMove = false;
    elements.battleView.classList.remove("is-move-playing");
    if (!battleBackgroundRunning || document.hidden || elements.battleView.hidden) {
      return;
    }

    elements.battleBackgroundVideo.play().catch(() => {
      // Foreground animation remains usable if background playback cannot resume.
    });
  }, BATTLE_BACKGROUND_RESUME_DELAY_MS);
}

function stopBattleBackground() {
  battleBackgroundRunning = false;
  battleBackgroundSuspendedForMove = false;
  activeLiveMoveVideos.clear();
  window.clearTimeout(battleBackgroundResumeTimer);
  battleBackgroundResumeTimer = null;
  elements.battleView.classList.remove("is-move-playing");
  elements.battleBackgroundVideo.pause();
  elements.battleBackgroundVideo.currentTime = 0;
}

function startBattleBackground() {
  if (battleBackgroundRunning) {
    return;
  }

  battleBackgroundRunning = true;
  elements.battleBackgroundVideo.play().catch(() => {
    // The game stays usable if a browser blocks muted autoplay.
  });
}

function setView(viewName) {
  const attractIsActive = viewName === "attract";
  const battleIsActive = viewName === "battle";
  elements.attractView.hidden = !attractIsActive;
  elements.lobbyView.hidden = viewName !== "lobby";
  elements.battleView.hidden = !battleIsActive;
  elements.gameOverView.hidden = viewName !== "game-over";
  elements.tutorialOverlay.hidden = !battleIsActive;

  if (battleIsActive && !document.hidden) {
    startBattleBackground();
  } else if (battleBackgroundRunning) {
    stopBattleBackground();
  }

  if (!battleIsActive) {
    clearLiveBattleAnimations();
  }

  if (attractIsActive && !document.hidden) {
    startIdleBattle();
  } else {
    stopIdleBattle();
  }
}

function effectText(fighter) {
  const effects = fighter?.effects || {};
  const parts = [];

  if (fighter?.shield > 0) parts.push(`Shield ${fighter.shield}`);
  if (effects.attackUpTurns > 0) parts.push("Attack up");
  if (effects.attackDownTurns > 0) parts.push("Attack down");
  if (effects.damageReductionTurns > 0) parts.push("Guarded");
  if (effects.regenTurns > 0) parts.push("Regenerating");
  if (effects.burnTurns > 0) parts.push("Burning");
  if (effects.tauntTurns > 0) parts.push("Taunting");

  return parts.join(" / ");
}

function renderHp(track, label, fighter) {
  track.style.width = `${hpPercent(fighter)}%`;
  label.textContent = `${fighter.hp}/${fighter.maxHp}`;
}

function renderTutorialOverlay(state) {
  const showing = Boolean(state?.showTutorial);
  elements.tutorialOverlay.hidden = !showing;

  if (!showing) {
    return;
  }

  const players = getOrderedPlayers(state);
  const acks = state.tutorialAcks || {};
  const waitingOn = players.filter((player) => !acks[player.id]).map((player) => player.name);

  elements.tutorialWaitingText.textContent = waitingOn.length
    ? `Waiting on: ${waitingOn.join(", ")}`
    : "Starting battle...";
}

function renderAttract() {
  setView("attract");
}

function renderLobby(state) {
  setView("lobby");
  const entries = getLobbyEntries(state);

  elements.lobbyTitle.textContent = entries.length >= 2 ? "Both players joined" : "Waiting for players";
  elements.lobbyMessage.textContent = entries.length >= 2
    ? "Co-op mode is starting automatically. Pick your characters on your phones."
    : "A player can press Start on their phone to play solo. A second player starts co-op automatically.";
  elements.lobbySlots.innerHTML = "";

  [0, 1].forEach((slot) => {
    const entry = entries.find((item) => Number(item.slot) === slot);
    const card = document.createElement("article");
    card.className = `lobby-slot ${entry ? "filled" : ""}`;
    card.innerHTML = `
      <span>Player ${slot + 1}</span>
      <strong>${entry ? "Joined" : "Open"}</strong>
    `;
    elements.lobbySlots.append(card);
  });
}

function createPlayerCard(player) {
  const card = document.createElement("article");
  card.className = "combat-card player-card";
  card.dataset.playerId = player.id;
  card.innerHTML = `
    <div class="combat-label">
      <span></span>
      <strong></strong>
    </div>
    <div class="hp-row">
      <span>HP</span>
      <div class="hp-track">
        <div class="hp-fill"></div>
        <strong class="hp-value"></strong>
      </div>
    </div>
    <img class="combat-art" alt="" width="512" height="512" decoding="async" loading="eager" fetchpriority="high">
    <div class="effect-line"></div>
    <div class="locked-move"></div>
  `;
  return card;
}

function updatePlayerCard(card, player, pendingMoves) {
  const move = pendingMoves?.[player.id] ? getMove(pendingMoves[player.id].moveId) : null;
  const sourceUrl = getPlayerArtUrl(player);
  const art = card.querySelector(".combat-art");

  card.classList.toggle("down", player.hp <= 0);
  card.classList.toggle("is-defeated", player.hp <= 0);
  card.style.setProperty("--fighter-color", player.color || "#ed1d24");
  card.style.setProperty("--fighter-accent", player.accent || "#f5ad0f");
  card.querySelector(".combat-label span").textContent = `Player ${Number(player.slot || 0) + 1}`;
  card.querySelector(".combat-label strong").textContent = player.name;
  card.querySelector(".hp-fill").style.width = `${hpPercent(player)}%`;
  card.querySelector(".hp-value").textContent = `${player.hp}/${player.maxHp}`;
  card.querySelector(".effect-line").textContent = effectText(player);
  card.querySelector(".locked-move").textContent = player.hp <= 0
    ? "Down"
    : move
      ? `Locked: ${move.name}`
      : "Choosing move";

  art.alt = player.name;
  if (sourceUrl && art.dataset.sourceUrl !== sourceUrl) {
    art.dataset.sourceUrl = sourceUrl;
    art.src = sourceUrl;
    void preloadPlayerArt(player);
  }
}

function renderPlayerCards(players, pendingMoves) {
  const activePlayerIds = new Set(players.map((player) => player.id));

  playerCardElements.forEach((card, playerId) => {
    if (!activePlayerIds.has(playerId)) {
      card.remove();
      playerCardElements.delete(playerId);
    }
  });

  players.forEach((player, index) => {
    let card = playerCardElements.get(player.id);
    if (!card) {
      card = createPlayerCard(player);
      playerCardElements.set(player.id, card);
    }

    updatePlayerCard(card, player, pendingMoves);
    if (elements.playerCards.children[index] !== card) {
      elements.playerCards.insertBefore(card, elements.playerCards.children[index] || null);
    }
  });
}

const LOG_PATTERNS = [
  {
    regex: /^(.+) used .+ on (.+) for (\d+) damage\.(?: (.+) blocked (\d+)\.)?$/,
    icon: (m, ctx) => (m[1] === ctx.monsterName ? "💢" : "⚔️"),
    segments: (m, ctx) => {
      const attacker = m[1];
      const target = m[2];
      const segs = [
        { text: attacker, color: ctx.colors[attacker] },
        { text: " → " },
        { text: target, color: ctx.colors[target] },
        { text: ` −${m[3]}`, color: ctx.colors[attacker] }
      ];
      if (m[5]) segs.push({ text: ` (blk ${m[5]})` });
      return segs;
    }
  },
  {
    regex: /^(.+) used .+ for (\d+) damage\.(?: (.+) blocked (\d+)\.)?$/,
    icon: "⚔️",
    segments: (m, ctx) => {
      const attacker = m[1];
      const target = ctx.monsterName || "Monster";
      const segs = [
        { text: attacker, color: ctx.colors[attacker] },
        { text: " → " },
        { text: target, color: ctx.colors[target] },
        { text: ` −${m[2]}`, color: ctx.colors[attacker] }
      ];
      if (m[4]) segs.push({ text: ` (blk ${m[4]})` });
      return segs;
    }
  },
  { regex: /^(.+) found the finishing angle\.$/, icon: "💥", format: (m) => `${m[1]} finishing blow!` },
  { regex: /^(.+) regenerated (\d+) HP\.$/, icon: "🌿", format: (m) => `${m[1]} +${m[2]}` },
  { regex: /^(.+) took (\d+) burn damage\.$/, icon: "🔥", format: (m) => `${m[1]} −${m[2]}` },
  { regex: /^(.+) recovered (\d+) HP\.$/, icon: "❤️", format: (m) => `${m[1]} +${m[2]}` },
  { regex: /^(.+) is burning\.$/, icon: "🔥", format: (m) => `${m[1]} burning` },
  { regex: /^(.+) lowered (.+)'s Attack\.$/, icon: "⬇️", format: (m) => `${m[2]} ATK↓` },
  { regex: /^(.+) gained (\d+) shield\.$/, icon: "🛡️", format: (m) => `${m[1]} +${m[2]} shield` },
  { regex: /^(.+) healed (\d+) HP\.$/, icon: "❤️", format: (m) => `${m[1]} +${m[2]}` },
  { regex: /^(.+)'s Attack rose\.$/, icon: "⬆️", format: (m) => `${m[1]} ATK↑` },
  { regex: /^(.+) is guarded\.$/, icon: "🛡️", format: (m) => `${m[1]} guarded` },
  { regex: /^(.+) will regenerate HP\.$/, icon: "🌿", format: (m) => `${m[1]} regen ready` },
  { regex: /^(.+) prepared a counter\.$/, icon: "↩️", format: (m) => `${m[1]} counter set` },
  { regex: /^(.+) challenged the monster\.$/, icon: "⚡", format: (m) => `${m[1]} taunt!` },
  { regex: /^(.+) is covering (.+)\.$/, icon: "🛡️", format: (m) => `${m[1]} covers ${m[2]}` },
  { regex: /^(.+)'s debuffs were removed\.$/, icon: "✨", format: (m) => `${m[1]} cleansed` },
  { regex: /^(.+)'s Defense dropped after the performance\.$/, icon: "⬇️", format: (m) => `${m[1]} DEF↓` },
  { regex: /^The final monster is defeated\.$/, icon: "🏆", format: () => "Victory!" },
  { regex: /^(.+) is defeated\. Next level incoming\.$/, icon: "✅", format: (m) => `${m[1]} defeated` },
  { regex: /^All players are out of HP\.$/, icon: "💀", format: () => "Defeat..." },
  { regex: /^(.+) used .+\. A (\d+)-point shield formed\.$/, icon: "🛡️", format: (m) => `${m[1]} shields up +${m[2]}` },
  { regex: /^(.+) used .+\. The party's Attack fell\.$/, icon: "⬇️", format: (m) => `${m[1]}: party ATK↓` },
  { regex: /^(.+) covered (.+)\.$/, icon: "🛡️", format: (m) => `${m[1]} covers ${m[2]}` },
  { regex: /^(.+)'s Attack fell\.$/, icon: "⬇️", format: (m) => `${m[1]} ATK↓` },
  { regex: /^(.+) enters the battle\.$/, icon: "👾", format: (m) => `${m[1]} appears!` }
];

function formatLogEntry(text, context) {
  for (const pattern of LOG_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      const segments = pattern.segments
        ? pattern.segments(match, context)
        : [{ text: pattern.format(match, context) }];
      const icon = typeof pattern.icon === "function" ? pattern.icon(match, context) : pattern.icon;
      return { icon, segments };
    }
  }
  return { icon: "📝", segments: [{ text }] };
}

const knownFighterColors = {};

function registerFighterColors(players, monster) {
  players.forEach((player) => {
    if (player?.name && player?.color) {
      knownFighterColors[player.name] = player.color;
    }
  });
  if (monster?.name && monster?.color) {
    knownFighterColors[monster.name] = monster.color;
  }
}

function renderLog(log, players, monster) {
  registerFighterColors(players, monster);
  const entries = Array.isArray(log) ? log.slice(-5) : [];
  const context = { colors: knownFighterColors, monsterName: monster?.name };
  elements.battleLog.innerHTML = "";

  entries.forEach((entry) => {
    const { icon, segments } = formatLogEntry(entry, context);
    const row = document.createElement("p");
    row.className = "log-row";

    const iconSpan = document.createElement("span");
    iconSpan.className = "log-icon";
    iconSpan.textContent = icon;
    row.append(iconSpan);

    const textWrap = document.createElement("span");
    textWrap.className = "log-text";
    segments.forEach((segment) => {
      const span = document.createElement("span");
      span.textContent = segment.text;
      if (segment.color) {
        span.style.color = segment.color;
        span.style.fontWeight = "1000";
      }
      textWrap.append(span);
    });
    row.append(textWrap);

    elements.battleLog.append(row);
  });
}

function renderBattle(state) {
  const previousSnapshot = lastBattleSnapshot;
  setView("battle");
  renderTutorialOverlay(state);
  const players = getOrderedPlayers(state);
  const monster = state.monster;
  const aliveIds = getAlivePlayerIds(state);
  const readyCount = aliveIds.filter((id) => Boolean(state.pendingMoves?.[id])).length;
  const totalLevels = getLevelCount(state.mode || "solo");

  elements.modeLabel.textContent = state.mode === "multiplayer" ? "Co-op Mode" : "Solo Mode";
  elements.levelLabel.textContent = `Level ${Number(state.levelIndex || 0) + 1} / ${totalLevels}`;
  elements.turnNumber.textContent = state.turn || 1;
  renderPlayerCards(players, state.pendingMoves || {});

  if (monster) {
    elements.monsterCard.classList.toggle("is-defeated", monster.hp <= 0);
    elements.monsterCard.style.setProperty("--fighter-color", monster.color || "#1d6e58");
    elements.monsterCard.style.setProperty("--fighter-accent", monster.accent || "#f5ad0f");
    elements.monsterName.textContent = monster.name;
    renderHp(elements.monsterHpBar, elements.monsterHpText, monster);
    elements.monsterArt.src = monster.asset;
    elements.monsterArt.alt = monster.name;
    elements.monsterEffects.textContent = effectText(monster);
  }

  if (state.status === "resolving") {
    elements.battleStatus.textContent = "Resolving moves...";
  } else if (state.status === "level-complete") {
    elements.battleStatus.textContent = "Level cleared. Get ready!";
  } else if (state.status === "game-over") {
    elements.battleStatus.textContent = "Final blow!";
  } else {
    elements.battleStatus.textContent = readyCount >= aliveIds.length
      ? "Moves locked. Resolving now!"
      : `Now pick your move on your phone! ${readyCount}/${aliveIds.length} ready`;
  }

  const chosenMoves = players
    .map((player) => state.pendingMoves?.[player.id])
    .map((entry) => getMove(entry?.moveId))
    .filter(Boolean);
  if (state.status === "battle") {
    chosenMoves.forEach((move, index) => {
      prepareMoveAnimation(move, elements.moveAnimations[index % elements.moveAnimations.length]);
    });
  }
  elements.lastMoves.textContent = chosenMoves.length ? `Locked moves: ${chosenMoves.map((move) => move.name).join(" + ")}` : "";
  renderLog(state.log, players, monster);
  animateResolvingMoves(state);
  animateRoundOutcome(state, previousSnapshot);
  lastBattleSnapshot = captureBattleSnapshot(state);
}

function renderGameOver(state) {
  setView("game-over");
  const playersWon = state.winner === "players";
  elements.gameOverEyebrow.textContent = playersWon ? "All levels cleared" : "Battle lost";
  elements.winnerText.textContent = playersWon ? "Players win!" : "Monster wins";
  elements.gameOverMessage.textContent = playersWon
    ? `The curry party cleared all ${getLevelCount(state.mode || "solo")} levels. A fresh code will appear for the next battle.`
    : "The monster held the screen. A fresh code will appear for the next battle.";
  if (elements.voucherQrPanel) {
    elements.voucherQrPanel.hidden = !playersWon;
  }
}

function render(state) {
  pruneMoveAnimationReadiness(state);
  warmSelectedCharacterArt(state);
  warmSelectedCharacterAnimations(state);
  updateGameCodeLabels(state);

  if (state?.status !== "game-over" && gameOverRevealTimer) {
    window.clearTimeout(gameOverRevealTimer);
    gameOverRevealTimer = null;
  }

  if (!state || state.status === "attract") {
    renderAttract();
    return;
  }

  if (state.status === "lobby" || state.status === "character-select") {
    renderLobby(state);
    return;
  }

  if (state.status === "game-over") {
    if (!elements.battleView.hidden) {
      if (!gameOverRevealTimer) {
        renderBattle(state);
        gameOverRevealTimer = window.setTimeout(() => {
          gameOverRevealTimer = null;
          renderGameOver(state);
        }, GAME_OVER_REVEAL_DELAY_MS);
      }
      return;
    }

    renderGameOver(state);
    return;
  }

  renderBattle(state);
}

async function rotateToNewSession() {
  if (rotatingSession) {
    return;
  }

  rotatingSession = true;
  window.clearTimeout(gameOverTimer);
  gameOverTimer = null;
  window.clearTimeout(gameOverRevealTimer);
  gameOverRevealTimer = null;
  clearLiveBattleAnimations();
  levelAdvanceToken = null;
  resolvingToken = null;

  const previousRef = sessionRef;
  const previousGameId = gameId;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  try {
    const nextGameId = await findAvailableGameId(previousGameId);
    if (previousRef) {
      await remove(previousRef);
    }

    await activateSession(nextGameId, true);
  } finally {
    rotatingSession = false;
  }
}

let tutorialDismissToken = null;

async function resolveTutorialAcknowledgement(state) {
  if (!state?.showTutorial) {
    tutorialDismissToken = null;
    return;
  }

  if (!allPlayersAcknowledgedTutorial(state)) {
    return;
  }

  const token = `${state.levelIndex}-${state.turn}-tutorial`;
  if (tutorialDismissToken === token) {
    return;
  }
  tutorialDismissToken = token;

  const activeGameId = gameId;
  const activeSessionRef = sessionRef;
  const snapshot = await get(activeSessionRef);
  const liveState = snapshot.val();

  if (!liveState || !liveState.showTutorial || !allPlayersAcknowledgedTutorial(liveState)) {
    tutorialDismissToken = null;
    return;
  }

  await update(activeSessionRef, {
    showTutorial: false,
    tutorialAcks: {},
    lastActionAt: serverTimestamp()
  });
}

async function resolvePendingMoves(state) {
  if (state.status !== "battle" || !allAlivePlayersHaveMoves(state)) {
    return;
  }

  const token = Object.values(state.pendingMoves || {})
    .map((entry) => entry.token)
    .sort()
    .join("|");

  if (!token || resolvingToken === token) {
    return;
  }

  resolvingToken = token;
  const activeGameId = gameId;
  const activeSessionRef = sessionRef;
  await waitForPendingMoveAnimations(state);

  if (gameId !== activeGameId || resolvingToken !== token) {
    return;
  }

  const readySnapshot = await get(activeSessionRef);
  const readyState = readySnapshot.val();
  const readyToken = Object.values(readyState?.pendingMoves || {})
    .map((entry) => entry.token)
    .sort()
    .join("|");
  if (!readyState || readyState.status !== "battle" || readyToken !== token) {
    if (resolvingToken === token) {
      resolvingToken = null;
    }
    return;
  }

  await update(activeSessionRef, {
    status: "resolving",
    activeMoves: readyState.pendingMoves,
    lastActionAt: serverTimestamp()
  });

  const animationDelay = PLAYER_LOOK_UP_DELAY_MS + 1400
    + Math.max(0, getAlivePlayerIds(readyState).length - 1)
    * (LIVE_MOVE_ANIMATION_SPACING_MS + MOVE_ANIMATION_FALLBACK_TIMEOUT_MS);

  window.setTimeout(async () => {
    if (gameId !== activeGameId) {
      return;
    }

    const snapshot = await get(activeSessionRef);
    const liveState = snapshot.val();
    const liveToken = Object.values(liveState?.pendingMoves || {})
      .map((entry) => entry.token)
      .sort()
      .join("|");

    if (!liveState || liveToken !== token) {
      resolvingToken = null;
      return;
    }

    const nextState = resolveRound(liveState);
    const updatePayload = {
      ...nextState,
      pendingMoves: {},
      activeMoves: {},
      lastActionAt: serverTimestamp()
    };

    if (nextState.status === "game-over") {
      updatePayload.gameOverAt = serverTimestamp();
    }

    await update(activeSessionRef, updatePayload);
    resolvingToken = null;
  }, animationDelay);
}

function scheduleLevelAdvance(state) {
  if (state?.status !== "level-complete") {
    levelAdvanceToken = null;
    return;
  }

  const token = `${state.levelIndex}-${state.roundResult?.createdAt || ""}`;
  if (levelAdvanceToken === token) {
    return;
  }

  levelAdvanceToken = token;
  const activeGameId = gameId;
  const activeSessionRef = sessionRef;
  window.setTimeout(async () => {
    if (gameId !== activeGameId) {
      return;
    }

    const snapshot = await get(activeSessionRef);
    const liveState = snapshot.val();

    if (!liveState || liveState.status !== "level-complete") {
      return;
    }

    await update(activeSessionRef, {
      ...prepareNextLevel(liveState),
      lastActionAt: serverTimestamp()
    });
  }, 4200);
}

const ABANDONED_SESSION_GRACE_MS = 10000; // 10s buffer for brief reconnects
let abandonedSessionTimer = null;

function scheduleAbandonedSessionReset(state) {
  const isActiveSession = state && !["attract", "game-over"].includes(state.status);
  const expectedPlayerIds = Array.isArray(state?.playerOrder) && state.playerOrder.length
    ? state.playerOrder
    : Object.keys(state?.lobby || {});
  const presence = state?.presence || {};
  const allPlayersConnected = expectedPlayerIds.length > 0
    && expectedPlayerIds.every((id) => presence[id] === true);

  console.log("[abandon-check]", { status: state?.status, expectedPlayerIds, presence, allPlayersConnected, timerRunning: Boolean(abandonedSessionTimer) });

  if (!isActiveSession || allPlayersConnected) {
    window.clearTimeout(abandonedSessionTimer);
    abandonedSessionTimer = null;
    return;
  }

  if (abandonedSessionTimer) {
    return;
  }

  abandonedSessionTimer = window.setTimeout(() => {
    abandonedSessionTimer = null;
    rotateToNewSession().catch((error) => console.error("Could not auto-reset abandoned session", error));
  }, ABANDONED_SESSION_GRACE_MS);
}

function scheduleGameOverReset(state) {
  if (state?.status !== "game-over") {
    window.clearTimeout(gameOverTimer);
    gameOverTimer = null;
    return;
  }

  if (gameOverTimer) {
    return;
  }

  gameOverTimer = window.setTimeout(() => {
    gameOverTimer = null;
    rotateToNewSession().catch((error) => console.error("Could not rotate game code", error));
  }, GAME_OVER_RESET_DELAY_MS);
}

function bindControls() {
  elements.resetButton.addEventListener("click", () => {
    rotateToNewSession().catch((error) => console.error("Could not reset game", error));
  });
  elements.copyJoinButton.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(gameId);
    elements.copyJoinButton.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyJoinButton.textContent = "Copy game code";
    }, 1200);
  });
  elements.fullScreenButton.addEventListener("click", () => {
    document.documentElement.requestFullscreen?.();
  });
}

async function boot() {
  updateScreenScale();
  renderWebsiteQr();
  startIdleBattle();
  window.addEventListener("resize", scheduleScreenScaleUpdate);
  window.addEventListener("orientationchange", scheduleScreenScaleUpdate);
  window.addEventListener("load", renderWebsiteQr, { once: true });
  window.visualViewport?.addEventListener("resize", scheduleScreenScaleUpdate);
  window.visualViewport?.addEventListener("scroll", scheduleScreenScaleUpdate);
  document.addEventListener("fullscreenchange", scheduleScreenScaleUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopIdleBattle();
      if (battleBackgroundRunning) {
        stopBattleBackground();
      }
      clearLiveBattleAnimations({ cancelReadiness: false, preservePreparedVideos: true });
      return;
    }

    if (!elements.attractView.hidden) {
      startIdleBattle();
    }
    if (!elements.battleView.hidden) {
      startBattleBackground();
    }
  });
  [...elements.moveAnimations, elements.idleMoveAnimation].forEach((video) => {
    video?.addEventListener("ended", () => {
      setMoveAnimationPlaying(video, false);
      const playback = getMoveAnimationPlaybackState(video);
      window.clearTimeout(playback.watchdogTimer);
      playback.watchdogTimer = null;
      video.currentTime = 0;
      if (elements.moveAnimations.includes(video)) {
        activeLiveMoveVideos.delete(video);
        resumeBattleBackgroundAfterMove();
      }
    });
  });
  bindControls();

  await connectFirebase();

  const requestedGameId = getGameId(null);
  const storedGameId = window.localStorage.getItem(SCREEN_GAME_STORAGE_KEY);
  const preferredGameId = isFourDigitCode(requestedGameId)
    ? requestedGameId
    : isFourDigitCode(storedGameId)
      ? storedGameId
      : null;

  if (preferredGameId) {
    const snapshot = await get(ref(db, `sessions/${preferredGameId}`));
    const state = snapshot.val();
    if (state && !["closed", "game-over"].includes(state.status)) {
      await activateSession(preferredGameId, false);
      return;
    }
  }

  await activateSession(await findAvailableGameId(), true);
}

async function activateSession(nextGameId, createNew) {
  cancelAllMoveAnimationReadiness();
  moveAnimationReadinessByToken.clear();
  liveMoveTransparencyVerified = false;
  gameId = nextGameId;
  gameCode = formatGameCode(gameId);
  sessionRef = ref(db, `sessions/${gameId}`);
  window.localStorage.setItem(SCREEN_GAME_STORAGE_KEY, gameId);
  updateGameCodeLabels();

  if (createNew) {
    await set(sessionRef, createAttractSession(gameId, null, serverTimestamp()));
  }

  const activeGameId = gameId;
  unsubscribe = onValue(sessionRef, (nextSnapshot) => {
    if (gameId !== activeGameId) return;

    const state = nextSnapshot.val();

    try {
      render(state);
    } catch (error) {
      console.error("render() failed", error);
    }

    try {
      scheduleLevelAdvance(state);
    } catch (error) {
      console.error("scheduleLevelAdvance() failed", error);
    }

    try {
      scheduleGameOverReset(state);
    } catch (error) {
      console.error("scheduleGameOverReset() failed", error);
    }

    // Always run this one, no matter what happened above.
    try {
      scheduleAbandonedSessionReset(state);
    } catch (error) {
      console.error("scheduleAbandonedSessionReset() failed", error);
    }

    resolveTutorialAcknowledgement(state).catch((error) => {
      console.error("Could not resolve tutorial acknowledgement", error);
      tutorialDismissToken = null;
    });
    resolvePendingMoves(state).catch((error) => {
      console.error("Could not resolve moves", error);
      resolvingToken = null;
    });
  });
}

boot().catch((error) => {
  console.error(error);
  elements.gameCodeLabel.textContent = "Firebase connection failed";
});
