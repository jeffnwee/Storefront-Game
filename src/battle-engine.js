import { getLevelCount, getMove } from "./game-data.js?v=20260808-hard-enemies";
import { appendLog, buildMonster, clamp, createEmptyEffects, getAlivePlayerIds, getOrderedPlayers } from "./shared.js?v=20260808-hard-enemies";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cloneEffects(effects = {}) {
  return { ...createEmptyEffects(), ...effects };
}

function cloneFighter(fighter) {
  return {
    ...fighter,
    hp: Number(fighter?.hp ?? fighter?.maxHp ?? 0),
    maxHp: Number(fighter?.maxHp ?? 0),
    atk: Number(fighter?.atk ?? 0),
    shield: Number(fighter?.shield ?? 0),
    effects: cloneEffects(fighter?.effects)
  };
}

function effectiveAttack(actor) {
  const effects = actor.effects || {};
  const attackUp = effects.attackUpTurns > 0 ? Number(effects.attackUpPct || 0) : 0;
  const attackDown = effects.attackDownTurns > 0 ? Number(effects.attackDownPct || 0) : 0;
  return Math.max(1, actor.atk * (1 + attackUp - attackDown));
}

function damageReduction(target) {
  const effects = target.effects || {};
  const reduction = effects.damageReductionTurns > 0 ? Number(effects.damageReductionPct || 0) : 0;
  const defenseDown = effects.defenseDownTurns > 0 ? Number(effects.defenseDownPct || 0) : 0;
  return clamp(reduction - defenseDown, -0.5, 0.75);
}

function powerDamage(actor, target, power) {
  const variance = randomInt(-4, 5);
  const base = Math.round((Number(power || 0) * effectiveAttack(actor)) / 10);
  const reduced = Math.round((base + variance) * (1 - damageReduction(target)));
  return Math.max(1, reduced);
}

function heal(actor, pct) {
  const amount = Math.round(actor.maxHp * Number(pct || 0));
  const before = actor.hp;
  actor.hp = clamp(actor.hp + amount, 0, actor.maxHp);
  return actor.hp - before;
}

function shield(actor, pct) {
  const amount = Math.round(actor.maxHp * Number(pct || 0));
  const before = actor.shield;
  actor.shield = clamp(actor.shield + amount, 0, Math.round(actor.maxHp * 0.55));
  return actor.shield - before;
}

function applyDamage(target, amount) {
  const incoming = Math.max(0, amount);
  const blocked = Math.min(target.shield, incoming);
  const damage = incoming - blocked;

  target.shield = Math.max(0, target.shield - blocked);
  target.hp = clamp(target.hp - damage, 0, target.maxHp);

  return { blocked, damage };
}

function isAlive(fighter) {
  return Number(fighter?.hp || 0) > 0;
}

function lowestHpAlly(players) {
  return players
    .filter(isAlive)
    .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || players[0];
}

function setTimedEffect(fighter, key, pct, turns) {
  fighter.effects[`${key}Pct`] = Math.max(Number(fighter.effects[`${key}Pct`] || 0), Number(pct || 0));
  fighter.effects[`${key}Turns`] = Math.max(Number(fighter.effects[`${key}Turns`] || 0), Number(turns || 1));
}

function clearDebuffs(fighter) {
  fighter.effects.attackDownPct = 0;
  fighter.effects.attackDownTurns = 0;
  fighter.effects.defenseDownPct = 0;
  fighter.effects.defenseDownTurns = 0;
  fighter.effects.burnPct = 0;
  fighter.effects.burnTurns = 0;
}

function applyStartEffects(fighter, messages) {
  if (!isAlive(fighter)) {
    return;
  }

  if (fighter.effects.regenTurns > 0 && fighter.effects.regenPct > 0) {
    const healed = heal(fighter, fighter.effects.regenPct);
    if (healed > 0) {
      messages.push(`${fighter.name} regenerated ${healed} HP.`);
    }
  }

  if (fighter.effects.burnTurns > 0 && fighter.effects.burnPct > 0) {
    const burnDamage = Math.round(fighter.maxHp * fighter.effects.burnPct);
    const result = applyDamage(fighter, burnDamage);
    messages.push(`${fighter.name} took ${result.damage} burn damage.`);
  }
}

// These effects begin the turn AFTER they are applied (duration 1 = one full next turn).
// Guard, taunt and self-defense-down are NOT listed on purpose: they must work immediately.
const DEFERRED_EFFECT_KEYS = ["attackUpTurns", "attackDownTurns", "regenTurns", "burnTurns"];

function snapshotActiveEffects(fighter) {
  return Object.fromEntries(
    DEFERRED_EFFECT_KEYS.map((key) => [key, Number(fighter.effects?.[key] || 0) > 0])
  );
}

function tickEffects(fighter, activeAtStart = {}) {
  const effects = fighter.effects || createEmptyEffects();
  [
    "attackUpTurns",
    "attackDownTurns",
    "damageReductionTurns",
    "defenseDownTurns",
    "regenTurns",
    "burnTurns",
    "tauntTurns"
  ].forEach((key) => {
    // Applied this round? Skip its first tick so it starts next turn.
    if (DEFERRED_EFFECT_KEYS.includes(key) && !activeAtStart[key]) {
      return;
    }
    effects[key] = Math.max(0, Number(effects[key] || 0) - 1);
  });

  if (effects.attackUpTurns <= 0) effects.attackUpPct = 0;
  if (effects.attackDownTurns <= 0) effects.attackDownPct = 0;
  if (effects.damageReductionTurns <= 0) effects.damageReductionPct = 0;
  if (effects.defenseDownTurns <= 0) effects.defenseDownPct = 0;
  if (effects.regenTurns <= 0) effects.regenPct = 0;
  if (effects.burnTurns <= 0) effects.burnPct = 0;
  if (effects.tauntTurns <= 0) effects.tauntTurns = 0;

  effects.counterPower = 0;
  effects.coverForId = null;
  fighter.effects = effects;
}

function applyPlayerDamage(actor, monster, move, power, messages) {
  let movePower = power;
  if (move.executeBelowPct && monster.hp / monster.maxHp < move.executeBelowPct) {
    movePower = Math.round(movePower * (1 + move.executeBonusPct));
    messages.push(`${actor.name} found the finishing angle.`);
  }

  const amount = powerDamage(actor, monster, movePower);
  const result = applyDamage(monster, amount);
  const blockText = result.blocked ? ` ${monster.name} blocked ${result.blocked}.` : "";
  messages.push(`${actor.name} used ${move.name} on ${monster.name} for ${result.damage} damage.${blockText}`);

  if (move.lifestealPct && result.damage > 0) {
    const before = actor.hp;
    actor.hp = clamp(actor.hp + Math.round(result.damage * move.lifestealPct), 0, actor.maxHp);
    messages.push(`${actor.name} recovered ${actor.hp - before} HP.`);
  }
}

function applyMove(actor, move, players, monster, messages) {
  if (!move || !isAlive(actor)) {
    return;
  }

  const targets = move.target === "all-allies"
    ? players.filter(isAlive)
    : move.target === "lowest-ally"
      ? [lowestHpAlly(players)]
      : move.target === "self"
        ? [actor]
        : [];

  if (move.hits) {
    move.hits.forEach((power) => applyPlayerDamage(actor, monster, move, power, messages));
  } else if (move.power) {
    applyPlayerDamage(actor, monster, move, move.power, messages);
  }

  if (move.burnPct) {
    monster.effects.burnPct = Math.max(monster.effects.burnPct || 0, move.burnPct);
    monster.effects.burnTurns = Math.max(monster.effects.burnTurns || 0, move.burnTurns || 1);
    messages.push(`${monster.name} is burning.`);
  }

  if (move.attackDownPct && move.target === "monster") {
    setTimedEffect(monster, "attackDown", move.attackDownPct, move.duration || 1);
    messages.push(`${actor.name} lowered ${monster.name}'s Attack.`);
  }

  if (move.selfShieldPct) {
    const amount = shield(actor, move.selfShieldPct);
    messages.push(`${actor.name} gained ${amount} shield.`);
  }

  targets.forEach((target) => {
    if (!target) {
      return;
    }

    if (move.healPct) {
      const healed = heal(target, move.healPct);
      messages.push(`${target.name} healed ${healed} HP.`);
    }

    if (move.shieldPct) {
      const amount = shield(target, move.shieldPct);
      messages.push(`${target.name} gained ${amount} shield.`);
    }

    if (move.attackUpPct) {
      setTimedEffect(target, "attackUp", move.attackUpPct, move.duration || 1);
      messages.push(`${target.name}'s Attack rose.`);
    }

    if (move.damageReductionPct) {
      setTimedEffect(target, "damageReduction", move.damageReductionPct, move.duration || 1);
      messages.push(`${target.name} is guarded.`);
    }

    if (move.regenPct) {
      target.effects.regenPct = Math.max(target.effects.regenPct || 0, move.regenPct);
      target.effects.regenTurns = Math.max(target.effects.regenTurns || 0, move.duration || 1);
      messages.push(`${target.name} will regenerate HP.`);
    }

    if (move.counterPower) {
      target.effects.counterPower = move.counterPower;
      messages.push(`${target.name} prepared a counter.`);
    }

    if (move.tauntTurns) {
      target.effects.tauntTurns = Math.max(target.effects.tauntTurns || 0, move.tauntTurns);
      messages.push(`${target.name} challenged the monster.`);
    }

    if (move.cover) {
      const coverTarget = target.id === actor.id
        ? players.find((player) => player.id !== actor.id && isAlive(player))
        : target;
      actor.effects.coverForId = coverTarget?.id || null;
      messages.push(`${actor.name} is covering ${coverTarget?.name || "the party"}.`);
    }

    if (move.cleanse) {
      clearDebuffs(target);
      messages.push(`${target.name}'s debuffs were removed.`);
    }
  });

  if (move.selfDefenseDownPct) {
    setTimedEffect(actor, "defenseDown", move.selfDefenseDownPct, move.selfDefenseDownTurns || 1);
    messages.push(`${actor.name}'s Defense dropped after the performance.`);
  }
}

function chooseMonsterMove(monster, players) {
  const moves = monster.moves || ["monster-claw"];
  const guardMoves = moves.filter((moveId) => {
    const move = getMove(moveId);
    return move?.target === "self" && move.shieldPct;
  });
  const partyMoves = moves.filter((moveId) => getMove(moveId)?.target === "all-players");

  if (monster.hp < monster.maxHp * 0.45 && guardMoves.length && Math.random() < 0.28) {
    return guardMoves[randomInt(0, guardMoves.length - 1)];
  }

  if (players.length > 1 && partyMoves.length && Math.random() < 0.28) {
    return partyMoves[randomInt(0, partyMoves.length - 1)];
  }

  const damageMoves = moves.filter((moveId) => getMove(moveId)?.power);
  return damageMoves[randomInt(0, damageMoves.length - 1)] || moves[0];
}

function chooseMonsterTarget(players) {
  const taunter = players.find((player) => player.effects?.tauntTurns > 0 && isAlive(player));
  if (taunter) {
    return taunter;
  }

  const weakest = lowestHpAlly(players);
  return Math.random() < 0.62
    ? weakest
    : players.filter(isAlive)[randomInt(0, players.filter(isAlive).length - 1)];
}

function applyMonsterMove(monster, move, players, messages) {
  if (!move || !isAlive(monster)) {
    return;
  }

  if (move.target === "self" && move.shieldPct) {
    const amount = shield(monster, move.shieldPct);
    messages.push(`${monster.name} used ${move.name}. A ${amount}-point shield formed.`);
    return;
  }

  if (move.target === "all-players") {
    players.filter(isAlive).forEach((player) => {
      if (move.attackDownPct) {
        setTimedEffect(player, "attackDown", move.attackDownPct, move.duration || 1);
      }
    });
    messages.push(`${monster.name} used ${move.name}. The party's Attack fell.`);
    return;
  }

  let target = chooseMonsterTarget(players);
  const coverer = players.find((player) => player.effects?.coverForId === target.id && isAlive(player));
  if (coverer) {
    messages.push(`${coverer.name} covered ${target.name}.`);
    target = coverer;
  }

  const amount = powerDamage(monster, target, move.power);
  const result = applyDamage(target, amount);
  const blockText = result.blocked ? ` ${target.name} blocked ${result.blocked}.` : "";
  messages.push(`${monster.name} used ${move.name} on ${target.name} for ${result.damage} damage.${blockText}`);

  if (move.attackDownPct) {
    setTimedEffect(target, "attackDown", move.attackDownPct, move.duration || 1);
    messages.push(`${target.name}'s Attack fell.`);
  }

  if (target.effects.counterPower && result.damage > 0 && isAlive(target)) {
    const counterMove = { name: "Counter Guard" };
    applyPlayerDamage(target, monster, counterMove, target.effects.counterPower, messages);
  }
}

function toPlayerObject(players) {
  return Object.fromEntries(players.map((player) => [player.id, player]));
}

export function resolveRound(state) {
  const mode = state.mode || "solo";
  const levelIndex = Number(state.levelIndex || 0);
  const players = getOrderedPlayers(state).map(cloneFighter);
  const monster = cloneFighter(state.monster || buildMonster(mode, levelIndex));
  const turn = Number(state.turn || 1);
  const pendingMoves = state.pendingMoves || {};
  const messages = [];

  const startSnapshots = {};
  players.forEach((player) => {
    startSnapshots[player.id] = snapshotActiveEffects(player);
  });
  const monsterSnapshot = snapshotActiveEffects(monster);

  players.forEach((player) => applyStartEffects(player, messages));
  applyStartEffects(monster, messages);

  players.forEach((player) => {
    // Only accept moves this character really has; anything else falls back to their first move.
    const requestedMoveId = pendingMoves[player.id]?.moveId;
    const moveId = player.moves?.includes(requestedMoveId) ? requestedMoveId : player.moves?.[0];
    const move = getMove(moveId);
    applyMove(player, move, players, monster, messages);
  });

  let status = "battle";
  let winner = null;
  let levelCleared = false;

  if (monster.hp <= 0) {
    levelCleared = true;
    const finalLevel = levelIndex >= getLevelCount(mode) - 1;
    if (finalLevel) {
      status = "game-over";
      winner = "players";
      messages.push("The final monster is defeated.");
    } else {
      status = "level-complete";
      messages.push(`${monster.name} is defeated. Next level incoming.`);
    }
  } else {
    const alivePlayers = players.filter(isAlive);
    if (alivePlayers.length) {
      const monsterMove = getMove(chooseMonsterMove(monster, alivePlayers));
      applyMonsterMove(monster, monsterMove, alivePlayers, messages);
    } 

    if (players.every((player) => !isAlive(player))) {
      status = "game-over";
      winner = "monster";
      messages.push("All players are out of HP.");
    }
  }

  players.forEach((player) => tickEffects(player, startSnapshots[player.id]));
  tickEffects(monster, monsterSnapshot);

  return {
    players: toPlayerObject(players),
    monster,
    status,
    winner,
    levelCleared,
    turn: status === "battle" ? turn + 1 : turn,
    roundResult: {
      messages,
      createdAt: Date.now()
    },
    log: appendLog(state.log, messages)
  };
}

export function prepareNextLevel(state) {
  const mode = state.mode || "solo";
  const nextLevelIndex = Number(state.levelIndex || 0) + 1;
  const players = getOrderedPlayers(state).map((player) => {
    const healed = cloneFighter(player);
    healed.hp = clamp(healed.hp + Math.round(healed.maxHp * 0.65), 1, healed.maxHp);
    healed.shield = 0;
    healed.effects = createEmptyEffects();
    return healed;
  });
  const monster = buildMonster(mode, nextLevelIndex);
  const messages = [`${monster.name} enters the battle.`];

  return {
    status: "battle",
    levelIndex: nextLevelIndex,
    turn: 1,
    players: toPlayerObject(players),
    monster,
    pendingMoves: {},
    activeMoves: {},
    roundResult: {
      messages,
      createdAt: Date.now()
    },
    log: appendLog(state.log, messages)
  };
}

export function allAlivePlayersHaveMoves(state) {
  const aliveIds = getAlivePlayerIds(state);
  const pendingMoves = state?.pendingMoves || {};
  return aliveIds.length > 0 && aliveIds.every((id) => Boolean(pendingMoves[id]?.moveId));
}