import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { db, authReady } from "./firebase.js";

// All game data (characters, moves, levels) now lives in Firebase at /admin.
// Edit it in the Firebase Console: admin/characters/<id>/... and admin/game/solo|multiplayer/...

const CACHE_KEY = "storefront-game-data";
const FETCH_ATTEMPTS = 3;

export let MOVES = {};
export let CHARACTERS = [];
export let LEVELS = { solo: [], multiplayer: [] };

function sortedList(obj) {
  return Object.entries(obj || {})
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function applyGameData(remote) {
  const moves = {};
  const addMoves = (movesObj, prefix = "") => {
    sortedList(movesObj).forEach(({ order, ...move }) => {
      const id = `${prefix}${move.id}`;
      moves[id] = { ...move, id };
    });
  };

  const characters = sortedList(remote?.characters).map(({ order, moves: characterMoves, ...character }) => {
    addMoves(characterMoves);
    return { ...character, moves: sortedList(characterMoves).map((move) => move.id) };
  });

  const buildLevels = (levelsObj, mode) =>
    Object.entries(levelsObj || {})
      .filter(([, level]) => level && typeof level === "object")
      .sort(([keyA, levelA], [keyB, levelB]) => {
        const orderA = Number(levelA.order ?? Infinity);
        const orderB = Number(levelB.order ?? Infinity);
        if (orderA !== orderB) return orderA < orderB ? -1 : 1;
        return keyA.localeCompare(keyB, undefined, { numeric: true });
      })
      .map(([levelKey, { order, moves: levelMoves, ...level }]) => {
        const prefix = `${mode}:${levelKey}:`;
        addMoves(levelMoves, prefix);
        return { ...level, moves: sortedList(levelMoves).map((move) => `${prefix}${move.id}`) };
      });

  const levels = {
    solo: buildLevels(remote?.game?.solo, "solo"),
    multiplayer: buildLevels(remote?.game?.multiplayer, "multiplayer")
  };

  if (!characters.length || !levels.solo.length || !levels.multiplayer.length) {
    throw new Error("Game data in Firebase (admin/characters, admin/game) is missing or incomplete.");
  }

  MOVES = Object.freeze(moves);
  CHARACTERS = Object.freeze(characters);
  LEVELS = Object.freeze(levels);
}

async function fetchRemote() {
  await authReady;
  const snapshot = await get(ref(db, "admin"));
  if (!snapshot.exists()) {
    throw new Error("Nothing found at /admin in Firebase.");
  }
  return snapshot.val();
}

async function loadGameData() {
  let lastError;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const remote = await fetchRemote();
      applyGameData(remote);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(remote));
      } catch (error) {
        // Cache is optional.
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Game data load failed (attempt ${attempt}/${FETCH_ATTEMPTS})`, error);
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Offline fallback: use the last copy that loaded successfully on this device.
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) {
      applyGameData(JSON.parse(cached));
      console.warn("Using cached game data from this device.");
      return;
    }
  } catch (error) {
    // Fall through to the error below.
  }

  throw lastError;
}

// Top-level await: any file that imports game-data.js waits until the data is loaded,
// so screen.js, shared.js and battle-engine.js never see empty data.
await loadGameData();

export function getCharacter(characterId) {
  return CHARACTERS.find((character) => character.id === characterId) || CHARACTERS[0];
}

export function getMove(moveId) {
  return MOVES[moveId] || null;
}

export function getMoves(moveIds) {
  return moveIds.map(getMove).filter(Boolean);
}

export function getLevel(mode, levelIndex) {
  const levels = LEVELS[mode] || LEVELS.solo;
  return levels[Math.min(Math.max(levelIndex, 0), levels.length - 1)];
}

export function getLevelCount(mode) {
  return (LEVELS[mode] || LEVELS.solo).length;
}