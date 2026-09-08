import { CHARACTERS, getCharacter, getLevel } from "./game-data.js?v=20260808-hard-enemies";

export function sanitizeGameId(value) {
  if (!value) {
    return null;
  }

  const clean = String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 48);
  return clean || null;
}

export function getGameId(fallback = null) {
  const params = new URLSearchParams(window.location.search);
  return sanitizeGameId(params.get("gameId")) || sanitizeGameId(fallback);
}

export function formatGameCode(gameId) {
  return sanitizeGameId(gameId).replace(/-/g, " ").toUpperCase();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hpPercent(fighter) {
  if (!fighter || !fighter.maxHp) {
    return 0;
  }

  return clamp(Math.round((Number(fighter.hp || 0) / Number(fighter.maxHp || 1)) * 100), 0, 100);
}

export function getOrCreatePlayerId(gameId) {
  const key = `storefront-player:${gameId}`;
  const stored = window.localStorage.getItem(key);

  if (stored) {
    return stored;
  }

  const generated = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  window.localStorage.setItem(key, generated);
  return generated;
}

export function createEmptyEffects() {
  return {
    attackUpPct: 0,
    attackUpTurns: 0,
    attackDownPct: 0,
    attackDownTurns: 0,
    damageReductionPct: 0,
    damageReductionTurns: 0,
    defenseDownPct: 0,
    defenseDownTurns: 0,
    regenPct: 0,
    regenTurns: 0,
    burnPct: 0,
    burnTurns: 0,
    counterPower: 0,
    coverForId: null,
    tauntTurns: 0
  };
}

export function buildPlayer(characterId, playerId, slot = 0) {
  const character = getCharacter(characterId);

  return {
    id: playerId,
    slot,
    characterId: character.id,
    name: character.name,
    title: character.title,
    maxHp: character.maxHp,
    hp: character.maxHp,
    atk: character.atk,
    shield: 0,
    color: character.color,
    accent: character.accent,
    asset: character.asset,
    moves: character.moves,
    effects: createEmptyEffects()
  };
}

export function buildMonster(mode = "solo", levelIndex = 0) {
  const level = getLevel(mode, levelIndex);

  return {
    id: `monster-${mode}-${levelIndex + 1}`,
    name: level.name,
    title: mode === "multiplayer" ? "Co-op challenge" : "Solo challenge",
    maxHp: level.maxHp,
    hp: level.maxHp,
    atk: level.atk,
    shield: 0,
    color: level.color || "#1d6e58",
    accent: level.accent || "#f5ad0f",
    asset: level.asset,
    moves: level.moves,
    effects: createEmptyEffects()
  };
}

export function createAttractSession(gameId, joinUrl = null, timestampValue) {
  return {
    gameId,
    joinUrl,
    status: "attract",
    mode: null,
    lobby: {},
    activePlayerIds: [],
    playerOrder: [],
    players: {},
    monster: null,
    levelIndex: 0,
    turn: 0,
    pendingMoves: {},
    activeMoves: {},
    showTutorial: false,
    tutorialAcks: {},
    roundResult: null,
    winner: null,
    log: ["Enter the big-screen game code on the Monster Curry website to join."],
    createdAt: timestampValue,
    lastActionAt: timestampValue
  };
}

export function appendLog(currentLog, entries, limit = 10) {
  const base = Array.isArray(currentLog) ? currentLog : [];
  return [...base, ...entries].slice(-limit);
}

export function listCharacters() {
  return CHARACTERS;
}

export function getOrderedPlayers(state) {
  const players = state?.players || {};
  const order = Array.isArray(state?.playerOrder) ? state.playerOrder : Object.keys(players);

  return order.map((id) => players[id]).filter(Boolean).sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
}

export function getLobbyEntries(state) {
  return Object.values(state?.lobby || {}).sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
}

export function getAlivePlayerIds(state) {
  const activeIds = Array.isArray(state?.activePlayerIds) ? state.activePlayerIds : [];
  const players = state?.players || {};
  return activeIds.filter((id) => Number(players[id]?.hp || 0) > 0);
}

export function allPlayersAcknowledgedTutorial(state) {
  const playerIds = getOrderedPlayers(state).map((player) => player.id);
  const acks = state?.tutorialAcks || {};
  return playerIds.length > 0 && playerIds.every((id) => Boolean(acks[id]));
}