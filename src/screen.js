import { allAlivePlayersHaveMoves, prepareNextLevel, resolveRound } from "./battle-engine.js?v=20260808-hard-enemies";
import { CHARACTERS, LEVELS, getLevelCount, getMove } from "./game-data.js?v=20260808-hard-enemies";
import {
  allPlayersAcknowledgedTutorial,
  appendLog,
  createAttractSession,
  formatGameCode,
  getAlivePlayerIds,
  getGameId,
  getLobbyEntries,
  getOrderedPlayers,
  hpPercent,
  buildMonster,
  buildPlayer
} from "./shared.js?v=20260808-hard-enemies";

let get;
let onDisconnect;
let onValue;
let ref;
let remove;
let runTransaction;
let serverTimestamp;
let set;
let update;
let db;
let firestoreDb;
let fsDoc;
let fsSetDoc;
let fsTimestamp;
let fsServerTimestamp;

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
const WEBSITE_URL = "https://tayyiting1219.github.io/Monster-Curry-World/";
const IDLE_IMPACT_WORDS = ["BAM!", "SIZZLE!", "CRUNCH!", "POW!", "SLASH!", "BOOM!"];

const $ = (id) => document.getElementById(id);
const elements = {
  attractView: $("attractView"),
  lobbyView: $("lobbyView"),
  battleView: $("battleView"),
  gameOverView: $("gameOverView"),
  tutorialOverlay: $("tutorialOverlay"),
  tutorialWaitingText: $("tutorialWaitingText"),
  tutorialObjectiveText: $("tutorialObjectiveText"),
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
  fullScreenButton: $("fullScreenButton"),
  resetCountdownBanner: $("resetCountdownBanner"),
  resetCountdownLabel: $("resetCountdownLabel"),
  resetCountdownValue: $("resetCountdownValue")
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

async function claimGameId(excludedGameId = null) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = generateFourDigitCode();
    if (candidate === excludedGameId) {
      continue;
    }

    const result = await runTransaction(ref(db, `sessions/${candidate}`), (current) => {
      if (current !== null) {
        return undefined; // code already in use, abort
      }
      return createAttractSession(candidate, null, serverTimestamp());
    });

    if (result.committed) {
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
  const [databaseModule, firestoreModule, firebaseModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
    import("./firebase.js")
  ]);

  ({
    get,
    onDisconnect,
    onValue,
    ref,
    remove,
    runTransaction,
    serverTimestamp,
    set,
    update
  } = databaseModule);
  db = firebaseModule.db;
  firestoreDb = firebaseModule.firestore;
  fsDoc = firestoreModule.doc;
  fsSetDoc = firestoreModule.setDoc;
  fsTimestamp = firestoreModule.Timestamp;
  fsServerTimestamp = firestoreModule.serverTimestamp;
  await firebaseModule.authReady;
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
  fxAnchorCards.get(video)?.classList.toggle("is-playing-move", playing);
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

// Move animations play where the fighter stands, not in the middle of the screen.
// The effect element (move video or monster portrait) is placed exactly over the fighter's
// art, same size, and that fighter's art is hidden while it plays so it isn't shown twice.
// Players' videos are mirrored so they face the monster (the videos are drawn facing left).
const fxAnchorCards = new WeakMap();

function anchorEffectToFighter(effect, card, { mirror = false } = {}) {
  const art = card?.querySelector(".combat-art");
  const layer = effect?.offsetParent;
  if (!effect || !art || !layer) {
    effect?.classList.remove("is-anchored", "is-mirrored");
    fxAnchorCards.delete(effect);
    return;
  }

  // getBoundingClientRect is in screen pixels; the kiosk layout is scaled, so convert back.
  const layerRect = layer.getBoundingClientRect();
  const artRect = art.getBoundingClientRect();
  const toLayout = layer.offsetWidth / Math.max(1, layerRect.width);
  const size = Math.max(artRect.width, artRect.height) * toLayout;
  effect.style.setProperty("--fx-x", `${(artRect.left - layerRect.left + artRect.width / 2) * toLayout}px`);
  effect.style.setProperty("--fx-y", `${(artRect.top - layerRect.top + artRect.height / 2) * toLayout}px`);
  effect.style.setProperty("--fx-size", `${size}px`);
  effect.classList.add("is-anchored");
  effect.classList.toggle("is-mirrored", mirror);
  fxAnchorCards.set(effect, card);
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
  anchorEffectToFighter(elements.liveMonsterPortrait, elements.monsterCard);
  animateIdleElement(elements.liveMonsterPortrait, "is-showing", 1080);
  animateIdleElement(elements.monsterCard, "is-playing-move", 1080);
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
      anchorEffectToFighter(video, playerCard, { mirror: true });
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
  elements.battleBackgroundVideo?.pause();
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

    elements.battleBackgroundVideo?.play().catch(() => {
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
  elements.battleBackgroundVideo?.pause();
  if (elements.battleBackgroundVideo) elements.battleBackgroundVideo.currentTime = 0;
}

function startBattleBackground() {
  if (battleBackgroundRunning) {
    return;
  }

  battleBackgroundRunning = true;
  elements.battleBackgroundVideo?.play().catch(() => {
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
  if (viewName !== "game-over") {
    stopConfetti();
  }
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

  return `Effects: ${parts.length ? parts.join(" / ") : "None"}`;
}

// HP bar colour: hue slides smoothly green -> yellow -> orange -> red as HP drops.
// Each stop is [hp percent, hue]; values in between are interpolated.
const HP_HUE_STOPS = [
  [100, 140],
  [75, 115],
  [55, 52],
  [35, 28],
  [15, 3],
  [0, 0]
];

function hpHue(pct) {
  if (pct >= HP_HUE_STOPS[0][0]) {
    return HP_HUE_STOPS[0][1];
  }
  for (let i = 1; i < HP_HUE_STOPS.length; i += 1) {
    const [lowPct, lowHue] = HP_HUE_STOPS[i];
    const [highPct, highHue] = HP_HUE_STOPS[i - 1];
    if (pct >= lowPct) {
      const t = (pct - lowPct) / (highPct - lowPct);
      return lowHue + (highHue - lowHue) * t;
    }
  }
  return 0;
}

function spawnHpDelta(fill, delta) {
  const row = fill.closest(".hp-row");
  if (!row) {
    return;
  }
  const el = document.createElement("span");
  el.className = `hp-delta ${delta < 0 ? "hp-delta-loss" : "hp-delta-gain"}`;
  el.textContent = delta < 0 ? String(delta) : `+${delta}`;
  row.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 2200);
}

function applyHpFill(fill, fighter) {
  const pct = hpPercent(fighter);
  const hue = hpHue(pct);
  const track = fill.parentElement;
  let ghost = track?.querySelector(".hp-ghost");
  if (track && !ghost) {
    ghost = document.createElement("div");
    ghost.className = "hp-ghost";
    track.insertBefore(ghost, fill);
  }

  // Previous values live on the element so each bar tracks its own history.
  const hasPrev = fill.dataset.prevHp !== undefined && Number(fill.dataset.prevMax) === fighter.maxHp;
  const prevHp = Number(fill.dataset.prevHp);
  const prevPct = Number(fill.dataset.prevPct);
  const prevHue = Number(fill.dataset.prevHue);
  const delta = hasPrev ? fighter.hp - prevHp : 0;

  fill.style.width = `${pct}%`;
  fill.style.setProperty("--hp-from", `hsl(${hue.toFixed(1)} 68% 42%)`);
  fill.style.setProperty("--hp-to", `hsl(${(hue + 14).toFixed(1)} 78% 56%)`);

  if (ghost) {
    if (!hasPrev || delta > 0) {
      // First draw, new fighter, or heal: no trail.
      clearTimeout(ghost._drainTimer);
      ghost.style.transition = "none";
      ghost.style.width = `${pct}%`;
      ghost.style.background = `hsl(${hue.toFixed(1)} 85% 80%)`;
    } else if (delta < 0) {
      // Hit: keep a paler copy of the old bar colour where the HP was, then drain it.
      clearTimeout(ghost._drainTimer);
      const shown = parseFloat(ghost.style.width) || prevPct;
      ghost.style.transition = "none";
      ghost.style.width = `${Math.max(shown, prevPct)}%`;
      ghost.style.background = `hsl(${prevHue.toFixed(1)} 85% 80%)`;
      ghost._drainTimer = setTimeout(() => {
        ghost.style.transition = "width 700ms ease-out";
        ghost.style.width = `${pct}%`;
      }, 450);
    }
  }

  if (track) {
    track.classList.toggle("hp-low", fighter.hp > 0 && pct <= 25);
  }
  if (delta !== 0) {
    spawnHpDelta(fill, delta);
  }

  fill.dataset.prevHp = String(fighter.hp);
  fill.dataset.prevMax = String(fighter.maxHp);
  fill.dataset.prevPct = String(pct);
  fill.dataset.prevHue = String(hue);
}

function renderHp(track, label, fighter) {
  applyHpFill(track, fighter);
  label.textContent = `${fighter.hp}/${fighter.maxHp}`;
}

function renderTutorialOverlay(state) {
  const showing = Boolean(state?.showTutorial);
  elements.tutorialOverlay.hidden = !showing;

  if (!showing) {
    return;
  }

  if (elements.tutorialObjectiveText) {
    elements.tutorialObjectiveText.textContent = `Defeat ${state.monster?.name || "the monster"}`;
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
  const soloChosenNow = state.mode === "solo"
    || entries.some((entry) => entry.soloRequested === true);
  elements.lobbyMessage.textContent = soloChosenNow
    ? "Solo mode. Pick your character on your phone."
    : entries.length >= 2
      ? "Co-op mode is starting automatically. Pick your characters on your phones."
      : "A player can press Start on their phone to play solo. A second player starts co-op automatically.";
  elements.lobbySlots.innerHTML = "";

  const soloChosen = state.mode === "solo"
    || entries.some((entry) => entry.soloRequested === true);

  [0, 1].forEach((slot) => {
    const entry = entries.find((item) => Number(item.slot) === slot);
    const closed = !entry && soloChosen;
    const card = document.createElement("article");
    card.className = `lobby-slot ${entry ? "filled" : ""}`;
    card.innerHTML = `
      <span>Player ${slot + 1}</span>
      <strong>${entry ? "Joined" : closed ? "Closed" : "Open"}</strong>
    `;
    elements.lobbySlots.append(card);
  });
}

function createPlayerCard(player) {
  const card = document.createElement("article");
  card.className = "combat-card player-card";
  card.dataset.playerId = player.id;
  card.innerHTML = `
    <img class="combat-art" alt="" width="512" height="512" decoding="async" loading="eager" fetchpriority="high">
    <div class="fighter-info">
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
      <div class="effect-line"></div>
      <div class="locked-move"></div>
    </div>
  `;
  return card;
}

function updatePlayerCard(card, player, pendingMoves) {
  const move = pendingMoves?.[player.id] ? getMove(pendingMoves[player.id].moveId) : null;
  const sourceUrl = getPlayerArtUrl(player);
  const art = card.querySelector(".combat-art");

  card.dataset.characterId = player.characterId || ""; // lets the CSS place the pad under this character's feet
  card.classList.toggle("down", player.hp <= 0);
  card.classList.toggle("is-defeated", player.hp <= 0);
  card.style.setProperty("--fighter-color", player.color || "#ed1d24");
  card.style.setProperty("--fighter-accent", player.accent || "#f5ad0f");
  card.querySelector(".combat-label span").textContent = `Player ${Number(player.slot || 0) + 1}`;
  card.querySelector(".combat-label strong").textContent = player.name;
  applyHpFill(card.querySelector(".hp-fill"), player);
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
  const entries = Array.isArray(log) ? log.slice(-3) : [];
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
    // e.g. "assets/enemies/curry-goblin.webp" -> "curry-goblin", so the CSS can place the pad under its feet
    elements.monsterCard.dataset.monster = String(monster.asset || "").split("?")[0].split("/").pop().replace(/\.[a-z0-9]+$/i, "");
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
      : "Now pick your move on your phone!";
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

  elements.lastMoves.textContent = "Battle Log";
  renderLog(state.log, players, monster);
  animateResolvingMoves(state);
  animateRoundOutcome(state, previousSnapshot);
  lastBattleSnapshot = captureBattleSnapshot(state);
}

// ---- Win screen confetti ---------------------------------------------------
// Pure-CSS falling confetti, built once when the players win and removed when the win screen goes away.
const CONFETTI_COUNT = 70;
const CONFETTI_COLORS = ["#ed1d24", "#f5ad0f", "#ffffff", "#fff7e8", "#ff6b35"];
let confettiActive = false;

function startConfetti() {
  const layer = document.getElementById("confettiLayer");
  if (!layer || confettiActive) return;
  confettiActive = true;
  const pieces = document.createDocumentFragment();
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    const piece = document.createElement("i");
    piece.className = i % 5 === 0 ? "confetti-piece is-round" : "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.setProperty("--w", `${8 + Math.random() * 8}px`);
    piece.style.setProperty("--drift", `${Math.round(Math.random() * 160 - 80)}px`);
    piece.style.setProperty("--spin", `${Math.round(360 + Math.random() * 720)}deg`);
    piece.style.animationDuration = `${3.2 + Math.random() * 3}s`;
    piece.style.animationDelay = `${-Math.random() * 6}s`;
    pieces.appendChild(piece);
  }
  layer.appendChild(pieces);
}

function stopConfetti() {
  if (!confettiActive) return;
  confettiActive = false;
  const layer = document.getElementById("confettiLayer");
  if (layer) layer.textContent = "";
}

function renderGameOver(state) {
  setView("game-over");
  const playersWon = state.winner === "players";
  elements.gameOverEyebrow.textContent = playersWon ? "All levels cleared" : "Battle lost";
  elements.winnerText.textContent = playersWon ? "\u{1F389} Players win! \u{1F389}" : "Monster wins";
  elements.winnerText.classList.toggle("is-win", playersWon);
  elements.gameOverMessage.textContent = playersWon
    ? `The curry party cleared all ${getLevelCount(state.mode || "solo")} levels. A fresh code will appear for the next battle.`
    : "The monster held the screen. A fresh code will appear for the next battle. Let the next player take on the challenge.";
  if (elements.voucherQrPanel) {
    elements.voucherQrPanel.hidden = !playersWon;
  }
  if (playersWon) {
    startConfetti();
  } else {
    stopConfetti();
  }
}

// ---- Battle intro cutscene (VS opening) -----------------------------------
// Plays on the kiosk when a level becomes playable (after the tutorial on level 1, and for each new
// monster after that). The move timer and move resolving wait until it has finished.
const BATTLE_INTRO_MS = 5000;
const BATTLE_INTRO_ART_WAIT_MS = 800;
let battleIntroKey = null;
let battleIntroActive = false;
let battleIntroTimer = null;
let latestState = null;

function battleIntroKeyFor(state) {
  if (state?.status !== "battle" || state.showTutorial) return null;
  if (Number(state.turn || 1) !== 1) return null;
  if (!state.monster || !Object.keys(state.players || {}).length) return null;
  const key = `${state.gameId || gameId}:${Number(state.levelIndex || 0)}`;
  return key === battleIntroKey ? null : key;
}

function maybePlayBattleIntro(state) {
  if (battleIntroActive && state?.status !== "battle") {
    endBattleIntro();
    return;
  }

  const key = battleIntroKeyFor(state);
  if (key) {
    playBattleIntro(state, key).catch((error) => {
      console.error("Battle intro failed", error);
      endBattleIntro();
    });
  }
}

// Splits a name into per-letter spans (grouped by word so wrapping only happens between words).
// CSS slams the letters in one by one (--i = letter index, --r = starting tilt) and then runs a wave.
function setVsName(element, text) {
  setVsNameParts(element, [{ text }]);
}

// Same as setVsName, but each part can have its own outline colour (`accent`).
// Used for co-op: each player's name in their own colour, "&" in black.
// Letter numbering (--i) runs across all parts so the slam and wave stay one smooth sweep.
function setVsNameParts(element, parts) {
  element.replaceChildren();
  element.setAttribute("aria-label", parts.map((part) => part.text).join(" "));

  let index = 0;
  parts.forEach((part, partIndex) => {
    const partElement = document.createElement("span");
    partElement.className = "vs-name-part";
    if (part.accent) {
      partElement.style.setProperty("--part-accent", part.accent);
    }

    const words = String(part.text || "").split(/\s+/).filter(Boolean);
    words.forEach((word, wordIndex) => {
      const wordElement = document.createElement("span");
      wordElement.className = "vs-word";
      wordElement.setAttribute("aria-hidden", "true");

      [...word].forEach((character) => {
        const letter = document.createElement("span");
        letter.className = "vs-letter";
        letter.textContent = character;
        letter.style.setProperty("--i", String(index));
        letter.style.setProperty("--r", `${(index % 2 ? 1 : -1) * (6 + ((index * 7) % 9))}deg`);
        wordElement.appendChild(letter);
        index += 1;
      });

      partElement.appendChild(wordElement);
      if (wordIndex < words.length - 1) {
        partElement.appendChild(document.createTextNode(" "));
      }
    });

    element.appendChild(partElement);
    if (partIndex < parts.length - 1) {
      element.appendChild(document.createTextNode(" "));
    }
  });
}

async function playBattleIntro(state, key) {
  const intro = $("vsIntro");
  if (!intro) return;

  battleIntroKey = key;
  battleIntroActive = true;

  const players = getOrderedPlayers(state);
  const monster = state.monster;
  const team = $("vsTeam");
  const monsterArt = $("vsMonsterArt");
  const images = [];

  team.replaceChildren();
  team.dataset.size = String(Math.min(players.length, 4));
  players.forEach((player) => {
    const url = getPlayerArtUrl(player);
    if (!url) return;
    const image = new Image();
    image.alt = "";
    image.decoding = "async";
    image.src = url;
    team.appendChild(image);
    images.push(image);
  });

  monsterArt.src = monster.asset || "";
  images.push(monsterArt);

  $("vsLevel").textContent = `Level ${Number(state.levelIndex || 0) + 1}`;
  $("vsPlayerKicker").textContent = players.length > 1 ? "Team" : "Player";
  const playerAccent = (player) => player?.color || player?.accent || "#f5ad0f";
  if (players.length > 1) {
    // Co-op: each name outlined in that player's colour, "&" in black.
    const parts = [];
    players.forEach((player, playerIndex) => {
      if (playerIndex > 0) parts.push({ text: "&", accent: "#111" });
      parts.push({ text: player.name, accent: playerAccent(player) });
    });
    setVsNameParts($("vsPlayerName"), parts);
  } else {
    setVsName($("vsPlayerName"), players[0]?.name || "Player");
  }
  setVsName($("vsMonsterName"), monster.name);
  $("vsMonsterHp").textContent = `HP ${monster.maxHp}`;
  // Colours for the card edges (team = first player's colour). Uses each fighter's main `color`
  // from Firebase, because most `accent` values are a similar gold. To use `accent` instead,
  // swap the two fields below.
  intro.classList.toggle("is-team", players.length > 1);
  intro.style.setProperty("--vs-player-accent", playerAccent(players[0]));
  // Second half of the split lines in co-op (same colour as the first in solo, so no split shows).
  intro.style.setProperty("--vs-player-accent-2", playerAccent(players[1] || players[0]));
  intro.style.setProperty("--vs-monster-accent", monster.color || monster.accent || "#ed1d24");
  intro.querySelector(".vs-banner-player strong").style.fontSize = players.length > 1 ? "40px" : "";

  // Wait briefly for the art so it doesn't pop in mid-animation.
  await Promise.race([
    Promise.all(images.map((image) => (image.decode ? image.decode().catch(() => { }) : Promise.resolve()))),
    new Promise((resolve) => window.setTimeout(resolve, BATTLE_INTRO_ART_WAIT_MS))
  ]);

  if (!battleIntroActive || battleIntroKey !== key) return;

  intro.hidden = false;
  void intro.offsetWidth; // restart the CSS animations
  intro.classList.add("is-playing");
  window.clearTimeout(battleIntroTimer);
  battleIntroTimer = window.setTimeout(endBattleIntro, BATTLE_INTRO_MS);
}

function endBattleIntro() {
  window.clearTimeout(battleIntroTimer);
  battleIntroTimer = null;

  const intro = $("vsIntro");
  if (intro) {
    intro.classList.remove("is-playing");
    intro.hidden = true;
  }

  if (!battleIntroActive) return;
  battleIntroActive = false;

  // Start the things we held back while the cutscene played.
  if (latestState) {
    try {
      scheduleMoveTimeout(latestState);
    } catch (error) {
      console.error("scheduleMoveTimeout() failed", error);
    }
    resolvePendingMoves(latestState).catch((error) => {
      console.error("Could not resolve moves", error);
      resolvingToken = null;
    });
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
    const nextGameId = await claimGameId(previousGameId);
    if (previousRef) {
      await disarmSessionCleanup(previousRef);
      await remove(previousRef);
    }

    await activateSession(nextGameId, false);
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
  if (battleIntroActive) {
    return; // endBattleIntro() calls this again once the cutscene is over
  }

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

let resetCountdownInterval = null;
let resetCountdownEndAt = null;

function updateResetCountdownText(label) {
  if (!elements.resetCountdownLabel || !elements.resetCountdownValue) return;
  const remainingMs = Math.max(0, resetCountdownEndAt - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);
  elements.resetCountdownLabel.textContent = label;
  elements.resetCountdownValue.textContent = `${seconds}s`;
  if (remainingMs <= 0) {
    window.clearInterval(resetCountdownInterval);
    resetCountdownInterval = null;
  }
}

function showResetCountdown(durationMs, label) {
  if (!elements.resetCountdownBanner) return;
  resetCountdownEndAt = Date.now() + durationMs;
  elements.resetCountdownBanner.hidden = false;
  updateResetCountdownText(label);
  window.clearInterval(resetCountdownInterval);
  resetCountdownInterval = window.setInterval(() => updateResetCountdownText(label), 250);
}

function hideResetCountdown() {
  if (!elements.resetCountdownBanner) return;
  elements.resetCountdownBanner.hidden = true;
  window.clearInterval(resetCountdownInterval);
  resetCountdownInterval = null;
  resetCountdownEndAt = null;
}

function scheduleAbandonedSessionReset(state) {

  // An empty lobby is handled by scheduleCharacterTimeout (5s reset), so skip the 10s one.
  if (["lobby", "character-select"].includes(state?.status) && getLobbyEntries(state).length === 0) {
    if (abandonedSessionTimer) {
      window.clearTimeout(abandonedSessionTimer);
      abandonedSessionTimer = null;
    }
    return;
  }
  
  const isActiveSession = state && !["attract", "game-over"].includes(state.status);
  const expectedPlayerIds = (Array.isArray(state?.playerOrder) && state.playerOrder.length
    ? state.playerOrder
    : Object.keys(state?.lobby || {}))
    // A player who tapped Leave has no lobby entry any more. That is a deliberate exit,
    // handled by resolveLeavers(), not a dropped connection that should reset the game.
    .filter((id) => Boolean(state?.lobby?.[id]));
  const presence = state?.presence || {};
  const allPlayersConnected = expectedPlayerIds.length > 0
    && expectedPlayerIds.every((id) => presence[id] === true);

  console.log("[abandon-check]", { status: state?.status, expectedPlayerIds, presence, allPlayersConnected, timerRunning: Boolean(abandonedSessionTimer) });

  if (!isActiveSession || allPlayersConnected) {
    if (abandonedSessionTimer) {
      window.clearTimeout(abandonedSessionTimer);
      abandonedSessionTimer = null;
      hideResetCountdown();
    }
    return;
  }

  if (abandonedSessionTimer) {
    return;
  }

  abandonedSessionTimer = window.setTimeout(() => {
    abandonedSessionTimer = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not auto-reset abandoned session", error));
  }, ABANDONED_SESSION_GRACE_MS);

  showResetCountdown(ABANDONED_SESSION_GRACE_MS, "Player disconnected. Resetting game");
}

function scheduleGameOverReset(state) {
  if (state?.status !== "game-over") {
    if (gameOverTimer) {
      window.clearTimeout(gameOverTimer);
      gameOverTimer = null;
      hideResetCountdown();
    }
    return;
  }

  if (gameOverTimer) {
    return;
  }

  gameOverTimer = window.setTimeout(() => {
    gameOverTimer = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not rotate game code", error));
  }, GAME_OVER_RESET_DELAY_MS);

  showResetCountdown(GAME_OVER_RESET_DELAY_MS, "Next game starting");
}

const MOVE_TIMEOUT_MS = 30000;
let moveTimeoutTimer = null;
let moveTimeoutKey = null;

function clearMoveTimeout() {
  if (moveTimeoutTimer) {
    window.clearTimeout(moveTimeoutTimer);
    moveTimeoutTimer = null;
  }
  if (moveTimeoutKey !== null) {
    moveTimeoutKey = null;
    hideResetCountdown();
  }
}

function scheduleMoveTimeout(state) {
  if (battleIntroActive && state?.status === "battle") {
    return; // the 30s move timer starts when the cutscene ends
  }

  const waitingForMoves = state?.status === "battle"
    && !state.showTutorial
    && !allAlivePlayersHaveMoves(state);

  if (!waitingForMoves) {
    clearMoveTimeout();
    return;
  }

  const turnKey = `${Number(state.levelIndex || 0)}:${Number(state.turn || 1)}`;
  const timerKey = `${state.gameId || ""}:${turnKey}`;
  if (timerKey === moveTimeoutKey) {
    return; // this turn's countdown is already running
  }

  clearMoveTimeout();
  moveTimeoutKey = timerKey;

  // Tell the phones when this turn started so they can show the same countdown.
  update(sessionRef, { moveTurnKey: turnKey, moveTurnStartedAt: serverTimestamp() })
    .catch((error) => console.error("Could not write move timer", error));

  moveTimeoutTimer = window.setTimeout(() => {
    moveTimeoutTimer = null;
    moveTimeoutKey = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not reset after move timeout", error));
  }, MOVE_TIMEOUT_MS);

  showResetCountdown(MOVE_TIMEOUT_MS, "Pick your move or the game resets");
}

const TUTORIAL_TIMEOUT_MS = 30000;
const LOBBY_WAIT_TIMEOUT_MS = 30000;
let tutorialTimeoutTimer = null;
let tutorialTimeoutKey = null;
let lobbyWaitTimer = null;
let lobbyWaitKey = null;
let tutorialEndAt = 0;
let lobbyWaitEndAt = 0;
const TUTORIAL_LABEL = "Press Got It or the game resets";
const LOBBY_WAIT_LABEL = "Waiting for a 2nd player or Start.";

// Other timers hide the shared banner when they clear, and they can run after us in the same
// update. So we only hide it if it is still showing OUR label, and we put it back if it vanished.
function hideOwnBanner(label) {
  if (elements.resetCountdownLabel?.textContent === label) {
    hideResetCountdown();
  }
}

function restoreBanner(endAt, label) {
  const remainingMs = endAt - Date.now();
  if (elements.resetCountdownBanner?.hidden && remainingMs > 0) {
    showResetCountdown(remainingMs, label);
  }
}

function clearTutorialTimeout() {
  if (tutorialTimeoutTimer) {
    window.clearTimeout(tutorialTimeoutTimer);
    tutorialTimeoutTimer = null;
  }
  if (tutorialTimeoutKey !== null) {
    tutorialTimeoutKey = null;
    hideOwnBanner(TUTORIAL_LABEL);
  }
}

// Instructions are showing and someone hasn't pressed "Got It": reset after 30s.
function scheduleTutorialTimeout(state) {
  if (state?.status !== "battle" || !state.showTutorial) {
    clearTutorialTimeout();
    return;
  }

  const key = `${state.gameId || ""}:${Number(state.levelIndex || 0)}:${Number(state.turn || 1)}:tutorial`;
  if (key === tutorialTimeoutKey) {
    restoreBanner(tutorialEndAt, TUTORIAL_LABEL);
    return; // countdown already running
  }

  clearTutorialTimeout();
  tutorialTimeoutKey = key;

  // Tell the phones when the instructions started so they can show the same countdown.
  update(sessionRef, { tutorialKey: `${Number(state.levelIndex || 0)}:${Number(state.turn || 1)}`, tutorialStartedAt: serverTimestamp() })
    .catch((error) => console.error("Could not write tutorial timer", error));

  tutorialTimeoutTimer = window.setTimeout(() => {
    tutorialTimeoutTimer = null;
    tutorialTimeoutKey = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not reset after tutorial timeout", error));
  }, TUTORIAL_TIMEOUT_MS);

  tutorialEndAt = Date.now() + TUTORIAL_TIMEOUT_MS;
  showResetCountdown(TUTORIAL_TIMEOUT_MS, TUTORIAL_LABEL);
}

function clearLobbyWaitTimeout() {
  if (lobbyWaitTimer) {
    window.clearTimeout(lobbyWaitTimer);
    lobbyWaitTimer = null;
  }
  if (lobbyWaitKey !== null) {
    lobbyWaitKey = null;
    hideOwnBanner(LOBBY_WAIT_LABEL);
  }
}

// One player is in the lobby, waiting for a 2nd player or for Start (solo): reset after 30s.
function scheduleLobbyWaitTimeout(state) {
  const entries = getLobbyEntries(state);
  const waiting = state?.status === "lobby"
    && entries.length === 1
    && entries[0].soloRequested !== true;

  if (!waiting) {
    clearLobbyWaitTimeout();
    return;
  }

  const key = `${state.gameId || ""}:lobby-wait:${entries[0].id}`;
  if (key === lobbyWaitKey) {
    restoreBanner(lobbyWaitEndAt, LOBBY_WAIT_LABEL);
    return; // countdown already running
  }

  clearLobbyWaitTimeout();
  lobbyWaitKey = key;

  // Tell the phones when the lobby wait started so they can show the same countdown.
  update(sessionRef, { lobbyWaitEntryId: entries[0].id, lobbyWaitStartedAt: serverTimestamp() })
    .catch((error) => console.error("Could not write lobby wait timer", error));

  lobbyWaitTimer = window.setTimeout(() => {
    lobbyWaitTimer = null;
    lobbyWaitKey = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not reset after lobby wait timeout", error));
  }, LOBBY_WAIT_TIMEOUT_MS);

  lobbyWaitEndAt = Date.now() + LOBBY_WAIT_TIMEOUT_MS;
  showResetCountdown(LOBBY_WAIT_TIMEOUT_MS, LOBBY_WAIT_LABEL);
}

const CHARACTER_TIMEOUT_MS = 45000;
const EMPTY_LOBBY_RESET_MS = 5000;
let characterTimeoutTimer = null;
let characterTimeoutKey = null;

function stopCharacterTimeout() {
  if (characterTimeoutTimer) {
    window.clearTimeout(characterTimeoutTimer);
    characterTimeoutTimer = null;
  }
  if (characterTimeoutKey !== null) {
    characterTimeoutKey = null;
    hideResetCountdown();
  }
}

function scheduleCharacterTimeout(state) {
  const entries = getLobbyEntries(state);
  const preBattle = state?.status === "lobby" || state?.status === "character-select";

  // Nobody is left in the lobby (for example a solo player pressed Start, then left):
  // reset the game after a short countdown.
  if (preBattle && entries.length === 0) {
    const emptyKey = `${state.gameId || ""}:empty`;
    if (emptyKey === characterTimeoutKey) {
      return; // countdown already running
    }

    stopCharacterTimeout();
    characterTimeoutKey = emptyKey;

    characterTimeoutTimer = window.setTimeout(() => {
      characterTimeoutTimer = null;
      characterTimeoutKey = null;
      hideResetCountdown();
      rotateToNewSession().catch((error) => console.error("Could not reset empty lobby", error));
    }, EMPTY_LOBBY_RESET_MS);

    showResetCountdown(EMPTY_LOBBY_RESET_MS, "Lobby empty. Resetting game");
    return;
  }

  const expectedCount = state?.mode === "multiplayer" ? 2 : 1;
  const confirmedCount = entries.filter((entry) => entry.confirmed && entry.characterId).length;
  const waitingForCharacters = state?.status === "character-select" && confirmedCount < expectedCount;

  if (!waitingForCharacters) {
    stopCharacterTimeout();
    // Clear the old start time so a later character select doesn't show a stale countdown.
    if (state?.characterSelectStartedAt) {
      update(sessionRef, { characterSelectStartedAt: null })
        .catch((error) => console.error("Could not clear character timer", error));
    }
    return;
  }

  const timerKey = `${state.gameId || ""}:character-select:${entries.length}`;
  if (timerKey === characterTimeoutKey) {
    return; // countdown already running
  }

  stopCharacterTimeout();
  characterTimeoutKey = timerKey;

  // Tell the phones when character select started so they can show the same countdown.
  update(sessionRef, { characterSelectStartedAt: serverTimestamp() })
    .catch((error) => console.error("Could not write character timer", error));

  characterTimeoutTimer = window.setTimeout(() => {
    characterTimeoutTimer = null;
    characterTimeoutKey = null;
    hideResetCountdown();
    rotateToNewSession().catch((error) => console.error("Could not reset after character timeout", error));
  }, CHARACTER_TIMEOUT_MS);

  showResetCountdown(CHARACTER_TIMEOUT_MS, "Pick your character or the game resets");
}

// ---------------------------------------------------------------------------
// Kiosk-owned game flow.
// Phones only write their own lobby entry, their own move and their tutorial tick.
// Everything else (lobby -> character select -> battle, and win records) is done here,
// because only the staff-signed-in kiosk is allowed to write it.
// ---------------------------------------------------------------------------
const WIN_VALID_MS = 24 * 60 * 60 * 1000; // how long a winner can collect the voucher
let lobbyTransitionToken = null;
let battleStartToken = null;
let winsRecordedForGame = null;
let slotConflictToken = null;

// Phones assign themselves a slot (0 or 1) client-side by reading the lobby before they
// write. Two phones joining at the exact same instant can both read an empty lobby and
// both pick slot 0 — nothing stops that race, since each phone can only write its own
// lobby/{id} key, not see-and-lock its sibling's. The kiosk is the only party with full
// write access to the session, so it's the one place that can notice and fix a collision:
// if two entries claim the same slot (or an out-of-range slot), renumber them
// deterministically by joinedAt so every client converges on the same result.
async function resolveLobbySlotConflicts(state) {
  if (!state || !sessionRef) {
    return;
  }

  // Slot numbers only matter before a battle is built: buildPlayer() (see section 2 of
  // resolveLobbyTransitions below) assigns players by sorted array index, not by raw
  // entry.slot, once players/activePlayerIds exist. No need to touch it after that.
  if (!["attract", "lobby", "character-select"].includes(state.status)) {
    slotConflictToken = null;
    return;
  }

  const entries = getLobbyEntries(state).slice(0, 2);
  if (entries.length < 2) {
    slotConflictToken = null;
    return;
  }

  const usedSlots = new Set(entries.map((entry) => Number(entry.slot)));
  const hasConflict = usedSlots.size !== entries.length
    || entries.some((entry) => ![0, 1].includes(Number(entry.slot)));

  if (!hasConflict) {
    slotConflictToken = null;
    return;
  }

  const token = `${state.status}|${entries.map((entry) => `${entry.id}:${entry.slot}`).join(",")}`;
  if (slotConflictToken === token) {
    return;
  }
  slotConflictToken = token;

  const activeGameId = gameId;
  const activeSessionRef = sessionRef;

  // Earliest joinedAt wins slot 0; tie-break on id so all clients agree on the same order.
  const canonical = [...entries].sort((a, b) => {
    const at = Number(a.joinedAt || 0);
    const bt = Number(b.joinedAt || 0);
    return at !== bt ? at - bt : String(a.id).localeCompare(String(b.id));
  });

  const updates = {};
  canonical.forEach((entry, index) => {
    if (Number(entry.slot) !== index) {
      updates[`lobby/${entry.id}/slot`] = index;
      updates[`lobby/${entry.id}/label`] = `Player ${index + 1}`;
    }
  });

  if (!Object.keys(updates).length) {
    return;
  }

  // Re-check against a live snapshot before writing, same pattern as resolveLobbyTransitions,
  // so a reset or status change that happened while we were computing this doesn't get clobbered.
  const snapshot = await get(activeSessionRef);
  const liveState = snapshot.val();
  if (gameId !== activeGameId || !liveState || !["attract", "lobby", "character-select"].includes(liveState.status)) {
    slotConflictToken = null;
    return;
  }

  updates.lastActionAt = serverTimestamp();
  await update(activeSessionRef, updates);
}

async function resolveLobbyTransitions(state) {
  if (!state || !sessionRef) {
    return;
  }

  const entries = getLobbyEntries(state);
  const activeGameId = gameId;
  const activeSessionRef = sessionRef;

  // 1. Players joining: attract -> lobby -> character-select
  if (state.status === "attract" || state.status === "lobby") {
    let next = null;
    if (entries.some((entry) => entry.soloRequested === true)) {
      next = { status: "character-select", mode: "solo" };
    } else if (entries.length >= 2) {
      next = { status: "character-select", mode: "multiplayer" };
    } else if (entries.length === 1 && state.status === "attract") {
      next = { status: "lobby" };
    }

    if (!next) {
      lobbyTransitionToken = null;
      return;
    }

    const token = `${state.status}|${entries.map((entry) => entry.id).join(",")}|${next.status}|${next.mode || ""}`;
    if (lobbyTransitionToken === token) {
      return;
    }
    lobbyTransitionToken = token;

    const snapshot = await get(activeSessionRef);
    const liveState = snapshot.val();
    if (gameId !== activeGameId || !liveState || !["attract", "lobby"].includes(liveState.status)) {
      lobbyTransitionToken = null;
      return;
    }

    const updates = { ...next, lastActionAt: serverTimestamp() };
    if (next.mode === "solo") {
      entries
        .filter((entry) => entry.soloRequested !== true)
        .forEach((entry) => {
          updates[`lobby/${entry.id}`] = null;
        });
    }
    await update(activeSessionRef, updates);
    return;
  }

  // 2. Everyone has confirmed a character: build the battle.
  if (state.status === "character-select") {
    const expectedCount = state.mode === "multiplayer" ? 2 : 1;
    const readyEntries = entries
      .filter((entry) => entry.confirmed && entry.characterId)
      .filter((entry) => state.mode !== "solo" || entry.soloRequested === true)
      .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
      .slice(0, expectedCount);

    if (readyEntries.length < expectedCount) {
      battleStartToken = null;
      return;
    }

    const token = `${activeGameId}|${readyEntries.map((entry) => `${entry.id}:${entry.characterId}`).join(",")}`;
    if (battleStartToken === token) {
      return;
    }
    battleStartToken = token;

    const snapshot = await get(activeSessionRef);
    const liveState = snapshot.val();
    if (gameId !== activeGameId || !liveState || liveState.status !== "character-select") {
      battleStartToken = null;
      return;
    }

    const mode = liveState.mode === "multiplayer" ? "multiplayer" : "solo";
    const playerOrder = readyEntries.map((entry) => entry.id);
    const players = Object.fromEntries(readyEntries.map((entry, index) => [
      entry.id,
      buildPlayer(entry.characterId, entry.id, index)
    ]));
    const monster = buildMonster(mode, 0);
    const log = [
      `${readyEntries.length === 2 ? "Two players" : "One player"} entered ${mode === "multiplayer" ? "co-op" : "solo"} mode.`,
      `${monster.name} enters the battle.`
    ];

    await update(activeSessionRef, {
      status: "battle",
      activePlayerIds: playerOrder,
      playerOrder,
      players,
      monster,
      levelIndex: 0,
      turn: 1,
      pendingMoves: {},
      activeMoves: {},
      roundResult: { messages: log, createdAt: Date.now() },
      winner: null,
      log,
      showTutorial: true,
      tutorialAcks: {},
      battleStartedAt: serverTimestamp(),
      lastActionAt: serverTimestamp()
    });
    return;
  }

  lobbyTransitionToken = null;
  battleStartToken = null;
}

// When the players really win, write a short-lived "win" record for each winning phone.
// Firestore only lets a phone read vouchers/storefront-win if its record exists.
async function recordWins(state) {
  if (state?.status !== "game-over" || state.winner !== "players") {
    return;
  }

  if (winsRecordedForGame === gameId) {
    return;
  }
  winsRecordedForGame = gameId;

  const activeGameId = gameId;
  const uids = getOrderedPlayers(state)
    .map((player) => state.lobby?.[player.id]?.uid)
    .filter(Boolean);

  try {
    await Promise.all(uids.map((uid) => fsSetDoc(fsDoc(firestoreDb, "wins", uid), {
      gameId: activeGameId,
      createdAt: fsServerTimestamp(),
      expiresAt: fsTimestamp.fromMillis(Date.now() + WIN_VALID_MS)
    })));
  } catch (error) {
    winsRecordedForGame = null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Mid-game "Leave Game".
// A phone can only delete its own lobby entry (see database rules), so that deletion is
// the leave signal. Only the kiosk may edit players/playerOrder/activePlayerIds, so it
// removes the leaver here and lets any teammate carry on.
const IN_GAME_STATUSES = ["battle", "resolving", "level-complete"];
let leaverToken = null;

async function resolveLeavers(state) {
  if (!state || !sessionRef || !IN_GAME_STATUSES.includes(state.status)) {
    leaverToken = null;
    return;
  }

  const activeIds = Array.isArray(state.activePlayerIds) ? state.activePlayerIds : [];
  const leftIds = activeIds.filter((id) => !state.lobby?.[id]);
  if (!leftIds.length) {
    leaverToken = null;
    return;
  }

  // Wait out an in-flight round: resolvePendingMoves rewrites players/pendingMoves when its
  // animation timer fires and would clash with this edit. The snapshot after the round
  // (status back to battle / level-complete / game-over) re-triggers this function.
  if (state.status === "resolving") {
    return;
  }

  const token = `${gameId}|${state.status}|${leftIds.join(",")}`;
  if (leaverToken === token) {
    return;
  }
  leaverToken = token;

  const activeGameId = gameId;
  const activeSessionRef = sessionRef;
  const snapshot = await get(activeSessionRef);
  const live = snapshot.val();
  if (gameId !== activeGameId || !live || !IN_GAME_STATUSES.includes(live.status) || live.status === "resolving") {
    leaverToken = null;
    return;
  }

  const gone = (Array.isArray(live.activePlayerIds) ? live.activePlayerIds : []).filter((id) => !live.lobby?.[id]);
  if (!gone.length) {
    leaverToken = null;
    return;
  }

  const remainingOrder = (Array.isArray(live.playerOrder) ? live.playerOrder : []).filter((id) => !gone.includes(id));
  const remainingActive = (Array.isArray(live.activePlayerIds) ? live.activePlayerIds : []).filter((id) => !gone.includes(id));

  // Nobody left (solo player quit, or both co-op players quit): reset right away.
  if (!remainingOrder.length) {
    await rotateToNewSession();
    return;
  }

  const messages = gone.map((id) => `${live.players?.[id]?.name || "A player"} left the game.`);
  const updates = {
    playerOrder: remainingOrder,
    activePlayerIds: remainingActive,
    log: appendLog(live.log, messages),
    lastActionAt: serverTimestamp()
  };
  gone.forEach((id) => {
    updates[`players/${id}`] = null;
    updates[`pendingMoves/${id}`] = null;
    updates[`activeMoves/${id}`] = null;
    updates[`tutorialAcks/${id}`] = null;
    updates[`presence/${id}`] = null;
  });

  // If the only player still standing was the one who left, the party has lost. Without
  // this the game would sit in "battle" forever: allAlivePlayersHaveMoves needs an alive player.
  const someoneAlive = remainingOrder.some((id) => Number(live.players?.[id]?.hp || 0) > 0);
  if (live.status === "battle" && !someoneAlive) {
    updates.status = "game-over";
    updates.winner = "monster";
    updates.gameOverAt = serverTimestamp();
    updates.log = appendLog(live.log, [...messages, "All players are out of HP."]);
  }

  await update(activeSessionRef, updates);
  leaverToken = null;
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

  await activateSession(await claimGameId(), false);
}

let connectedUnsubscribe = null;

function armSessionCleanup() {
  if (connectedUnsubscribe) {
    connectedUnsubscribe();
    connectedUnsubscribe = null;
  }

  const cleanupRef = sessionRef;
  connectedUnsubscribe = onValue(ref(db, ".info/connected"), (snapshot) => {
    if (snapshot.val() !== true) {
      return;
    }
    onDisconnect(cleanupRef).remove().catch((error) => {
      console.warn("Could not arm session cleanup", error);
    });
  });
}

async function disarmSessionCleanup(targetRef) {
  if (connectedUnsubscribe) {
    connectedUnsubscribe();
    connectedUnsubscribe = null;
  }

  if (targetRef) {
    try {
      await onDisconnect(targetRef).cancel();
    } catch (error) {
      console.warn("Could not cancel session cleanup", error);
    }
  }
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

  armSessionCleanup();

  const activeGameId = gameId;
  unsubscribe = onValue(sessionRef, (nextSnapshot) => {
    if (gameId !== activeGameId) return;

    const state = nextSnapshot.val();
    latestState = state;

    if (state === null && !rotatingSession) {
      rotateToNewSession().catch((error) => console.error("Could not recover deleted session", error));
      return;
    }

    try {
      render(state);
    } catch (error) {
      console.error("render() failed", error);
    }

    try {
      maybePlayBattleIntro(state);
    } catch (error) {
      console.error("maybePlayBattleIntro() failed", error);
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

    try {
      scheduleMoveTimeout(state);
    } catch (error) {
      console.error("scheduleMoveTimeout() failed", error);
    }

    try {
      scheduleCharacterTimeout(state);
    } catch (error) {
      console.error("scheduleCharacterTimeout() failed", error);
    }

    // Keep these last: the older timers above can hide the shared banner in the same update,
    // and these two put theirs back.
    try {
      scheduleTutorialTimeout(state);
    } catch (error) {
      console.error("scheduleTutorialTimeout() failed", error);
    }

    try {
      scheduleLobbyWaitTimeout(state);
    } catch (error) {
      console.error("scheduleLobbyWaitTimeout() failed", error);
    }

    resolveTutorialAcknowledgement(state).catch((error) => {
      console.error("Could not resolve tutorial acknowledgement", error);
      tutorialDismissToken = null;
    });
    resolvePendingMoves(state).catch((error) => {
      console.error("Could not resolve moves", error);
      resolvingToken = null;
    });
    resolveLeavers(state).catch((error) => {
      console.error("Could not remove leaving player", error);
      leaverToken = null;
    });
    resolveLobbySlotConflicts(state).catch((error) => {
      console.error("Could not resolve lobby slot conflict", error);
      slotConflictToken = null;
    });
    resolveLobbyTransitions(state).catch((error) => {
      console.error("Could not update lobby", error);
      lobbyTransitionToken = null;
      battleStartToken = null;
    });
    recordWins(state).catch((error) => {
      console.error("Could not record win", error);
    });
  });
}

boot().catch((error) => {
  console.error(error);
  elements.gameCodeLabel.textContent = "Firebase connection failed";
});