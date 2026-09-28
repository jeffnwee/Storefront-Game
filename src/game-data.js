export const MOVES = Object.freeze({
  "crispy-slash": { id: "crispy-slash", name: "Crispy Slash", description: "Deals 22 Power damage to the monster.", target: "monster", power: 22, animation: "./assets/animations/characters/katsu-chan/crispy-slash.mp4" },
  "heros-courage": { id: "heros-courage", name: "Hero's Courage", description: "Increase own Attack by 60% and take 25% less damage for 3 turns.", target: "self", attackUpPct: 0.6, damageReductionPct: 0.25, duration: 3, animation: "./assets/animations/characters/katsu-chan/heros-courage.mp4" },
  "comfort-meal": { id: "comfort-meal", name: "Comfort Meal", description: "Heal self for 22% HP.", target: "self", healPct: 0.22, animation: "./assets/animations/characters/katsu-chan/comfort-meal.mp4" },
  "counter-guard": { id: "counter-guard", name: "Counter Guard", description: "Take 45% less damage this turn and counter if hit.", target: "self", damageReductionPct: 0.45, counterPower: 16, duration: 1, animation: "./assets/animations/characters/katsu-chan/counter-guard.mp4" },

  "vine-whip": { id: "vine-whip", name: "Vine Whip", description: "Deals 31 Power damage.", target: "monster", power: 31, animation: "./assets/animations/characters/monstora-sharemi/vine-whip.mp4" },
  "sharing-feast": { id: "sharing-feast", name: "Sharing Feast", description: "Heal all allies by 22% HP.", target: "all-allies", healPct: 0.25, animation: "./assets/animations/characters/monstora-sharemi/sharing-feast.mp4" },
  "rally-together": { id: "rally-together", name: "Rally Together", description: "Increase all allies' Attack by 60% for 3 turns.", target: "all-allies", attackUpPct: 0.5, duration: 3, animation: "./assets/animations/characters/monstora-sharemi/rally-together.mp4" },
  "tangling-vines": { id: "tangling-vines", name: "Tangling Vines", description: "Deals 13 Power and reduces the monster's Attack by 35% for 3 turns.", target: "monster", power: 13, attackDownPct: 0.35, duration: 3, animation: "./assets/animations/characters/monstora-sharemi/tangling-vines.mp4" },

  "mega-chomp": { id: "mega-chomp", name: "Mega Chomp", description: "Deals 27 Power damage.", target: "monster", power: 27, animation: "./assets/animations/characters/giga-nomu/mega-chomp.mp4" },
  "devour": { id: "devour", name: "Devour", description: "Damage the monster and recover 45% of damage dealt.", target: "monster", power: 24, lifestealPct: 0.45, animation: "./assets/animations/characters/giga-nomu/devour.mp4" },
  "belly-shield": { id: "belly-shield", name: "Belly Shield", description: "Gain a shield equal to 22% Max HP.", target: "self", shieldPct: 0.22, animation: "./assets/animations/characters/giga-nomu/belly-shield.mp4" },
  "hungry-challenge": { id: "hungry-challenge", name: "Hungry Challenge", description: "Taunt the monster, take 25% less damage and gain 50% Attack for 3 turns.", target: "self", tauntTurns: 2, damageReductionPct: 0.25, attackUpPct: 0.5, duration: 3, animation: "./assets/animations/characters/giga-nomu/hungry-challenge.mp4" },

  "egg-toss": { id: "egg-toss", name: "Egg Toss", description: "Deals 34 Power damage.", target: "monster", power: 34, animation: "./assets/animations/characters/tamago-puffy/egg-toss.mp4" },
  "fluffy-hug": { id: "fluffy-hug", name: "Fluffy Hug", description: "Heal the lowest-HP ally by 30% HP.", target: "lowest-ally", healPct: 0.30, animation: "./assets/animations/characters/tamago-puffy/fluffy-hug.mp4" },
  "sunny-side-up": { id: "sunny-side-up", name: "Sunny Side Up", description: "Remove debuffs from the lowest-HP ally and heal 18% HP.", target: "lowest-ally", cleanse: true, healPct: 0.18, animation: "./assets/animations/characters/tamago-puffy/sunny-side-up.mp4" },
  "sweet-dreams": { id: "sweet-dreams", name: "Sweet Dreams", description: "Give an ally 25% damage reduction, regeneration and 40% Attack for 3 turns.", target: "lowest-ally", damageReductionPct: 0.25, regenPct: 0.08, attackUpPct: 0.4, duration: 3, animation: "./assets/animations/characters/tamago-puffy/sweet-dreams.mp4" },

  "cheese-wheel": { id: "cheese-wheel", name: "Cheese Wheel", description: "Deals 27 Power damage.", target: "monster", power: 27, animation: "./assets/animations/characters/cheezu-mellow/cheese-wheel.mp4" },
  "melted-cheese": { id: "melted-cheese", name: "Melted Cheese", description: "Shield the lowest-HP ally for 25% Max HP.", target: "lowest-ally", shieldPct: 0.25, animation: "./assets/animations/characters/cheezu-mellow/melted-cheese.mp4" },
  "cover-up": { id: "cover-up", name: "Cover Up", description: "Redirect attacks from the weakest ally to Cheezu, who takes 25% less damage.", target: "self", cover: true, damageReductionPct: 0.25, duration: 2, animation: "./assets/animations/characters/cheezu-mellow/cover-up.mp4" },
  "comfort-feast": { id: "comfort-feast", name: "Comfort Feast", description: "Heal all allies 18%, reduce damage taken by 20% and raise Attack by 50% for 3 turns.", target: "all-allies", healPct: 0.18, damageReductionPct: 0.2, attackUpPct: 0.5, duration: 3, animation: "./assets/animations/characters/cheezu-mellow/comfort-feast.mp4" },

  "noodle-strike": { id: "noodle-strike", name: "Noodle Strike", description: "Deals 20 Power damage.", target: "monster", power: 20, animation: "./assets/animations/characters/ramy-noodleton/noodle-strike.mp4" },
  "slurp-combo": { id: "slurp-combo", name: "Slurp Combo", description: "Attack twice: 8 Power on the first hit and 12 Power on the second.", target: "monster", hits: [8, 12], animation: "./assets/animations/characters/ramy-noodleton/slurp-combo.mp4" },
  "cold-broth": { id: "cold-broth", name: "Cold Broth", description: "Increase own Attack by 50% for 3 turns and heal 30% HP.", target: "self", attackUpPct: 0.50, duration: 3, healPct: 0.30, animation: "./assets/animations/characters/ramy-noodleton/cold-broth.mp4" },
  "finishing-slurp": { id: "finishing-slurp", name: "Finishing Slurp", description: "Deals 15 Power, +75% if monster is below 40% HP.", target: "monster", power: 15, executeBelowPct: 0.4, executeBonusPct: 0.75, animation: "./assets/animations/characters/ramy-noodleton/finishing-slurp.mp4" },

  "sizzling-plate": { id: "sizzling-plate", name: "Sizzling Plate", description: "Deals 18 Power damage.", target: "monster", power: 18, animation: "./assets/animations/characters/hot-sizz/sizzling-plate.mp4" },
  "flame-burst": { id: "flame-burst", name: "Flame Burst", description: "Deals 14 Power and burns for 5% Max HP for 3 turns.", target: "monster", power: 14, burnPct: 0.05, burnTurns: 3, animation: "./assets/animations/characters/hot-sizz/flame-burst.mp4" },
  "heat-up": { id: "heat-up", name: "Heat Up", description: "Increase own Attack by 55% for 3 turns.", target: "self", attackUpPct: 0.55, duration: 3, animation: "./assets/animations/characters/hot-sizz/heat-up.mp4" },
  "grand-performance": { id: "grand-performance", name: "Grand Performance", description: "Deals 25 Power, but take 20% more damage this turn.", target: "monster", power: 25, selfDefenseDownPct: 0.2, selfDefenseDownTurns: 1, animation: "./assets/animations/characters/hot-sizz/grand-performance.mp4" },

  "precision-skewer": { id: "precision-skewer", name: "Precision Skewer", description: "Deals 22 Power damage.", target: "monster", power: 22, animation: "./assets/animations/characters/teppa-spark/precision-skewer.mp4" },
  "spark-plate": { id: "spark-plate", name: "Spark Plate", description: "Deals 15 Power and lowers monster Attack by 30% for 3 turns.", target: "monster", power: 15, attackDownPct: 0.3, duration: 3, animation: "./assets/animations/characters/teppa-spark/spark-plate.mp4" },
  "focus-flambe": { id: "focus-flambe", name: "Focus Flambe", description: "Increase own Attack by 60% for 3 turns.", target: "self", attackUpPct: 0.6, duration: 3, animation: "./assets/animations/characters/teppa-spark/focus-flambe.mp4" },
  "final-showpiece": { id: "final-showpiece", name: "Final Showpiece", description: "Deals 20 Power and gains a 10% Max HP shield.", target: "monster", power: 20, selfShieldPct: 0.1, animation: "./assets/animations/characters/teppa-spark/final-showpiece.mp4" },

  "filthy-swipe": { id: "filthy-swipe", name: "Filthy Swipe", description: "A grime-covered claw strike from the Rotten Goblin.", target: "player", power: 29 },
  "noxious-stench": { id: "noxious-stench", name: "Noxious Stench", description: "A foul cloud that lowers the whole party's Attack.", target: "all-players", attackDownPct: 0.19, duration: 2 },
  "sludge-guard": { id: "sludge-guard", name: "Sludge Guard", description: "The Rotten Goblin coats itself in protective sludge.", target: "self", shieldPct: 0.14 },

  "sauce-swipe": { id: "sauce-swipe", name: "Sauce Swipe", description: "A quick curry-coated claw strike.", target: "player", power: 24 },
  "curry-cloud": { id: "curry-cloud", name: "Curry Cloud", description: "A spicy cloud that lowers the whole party's Attack.", target: "all-players", attackDownPct: 0.12, duration: 2 },

  "root-bash": { id: "root-bash", name: "Root Bash", description: "A heavy strike powered by twisting roots.", target: "player", power: 23 },
  "gravy-snare": { id: "gravy-snare", name: "Gravy Snare", description: "Sticky gravy damages one player and lowers Attack.", target: "player", power: 17, attackDownPct: 0.15, duration: 2 },
  "root-guard": { id: "root-guard", name: "Root Guard", description: "The brute hardens its roots into a shield.", target: "self", shieldPct: 0.12 },

  "spore-punch": { id: "spore-punch", name: "Spore Punch", description: "A crushing fist covered in wild mushrooms.", target: "player", power: 28 },
  "mushroom-haze": { id: "mushroom-haze", name: "Mushroom Haze", description: "A spore cloud that lowers the whole party's Attack.", target: "all-players", attackDownPct: 0.18, duration: 2 },
  "fungal-guard": { id: "fungal-guard", name: "Fungal Guard", description: "A dense mushroom barrier protects the brute.", target: "self", shieldPct: 0.14 },

  "flame-claw": { id: "flame-claw", name: "Flame Claw", description: "A blazing claw strike.", target: "player", power: 30 },
  "ember-crush": { id: "ember-crush", name: "Ember Crush", description: "A powerful blast of concentrated heat.", target: "player", power: 34 },
  "wildfire-roar": { id: "wildfire-roar", name: "Wildfire Roar", description: "A scorching roar that lowers the whole party's Attack.", target: "all-players", attackDownPct: 0.2, duration: 2 },

  "monster-claw": { id: "monster-claw", name: "Monster Claw", description: "A direct monster strike.", target: "player", power: 18 },
  "curry-splash": { id: "curry-splash", name: "Curry Splash", description: "Hits one player and lowers Attack.", target: "player", power: 18, attackDownPct: 0.15, duration: 2 },
  "spice-roar": { id: "spice-roar", name: "Spice Roar", description: "Lowers all players' Attack.", target: "all-players", attackDownPct: 0.15, duration: 2 },
  "pot-slam": { id: "pot-slam", name: "Pot Slam", description: "A heavy monster strike.", target: "player", power: 26 },
  "monster-guard": { id: "monster-guard", name: "Monster Guard", description: "The monster gains a shield.", target: "self", shieldPct: 0.12 },
  "mega-stomp": { id: "mega-stomp", name: "Mega Stomp", description: "A dangerous late-level strike.", target: "player", power: 36 }
});

export const CHARACTERS = Object.freeze([
  {
    id: "katsu-chan",
    name: "Katsu-Chan",
    title: "The Classic Comfort Hero",
    maxHp: 1000,
    atk: 90,
    color: "#f08a24",
    accent: "#ffd15c",
    asset: "./assets/characters/katsu-chan.png",
    idleAsset: "./assets/characters/idle/katsu-chan.webp",
    idleAnimation: "./assets/animations/idle/katsu-chan.webm",
    moves: ["crispy-slash", "heros-courage", "comfort-meal", "counter-guard"]
  },
  {
    id: "monstora-sharemi",
    name: "Monstora Sharemi",
    title: "The Social Feast Buddy",
    maxHp: 950,
    atk: 75,
    color: "#4c9a62",
    accent: "#ffcf5a",
    asset: "./assets/characters/monstora-sharemi.png",
    idleAsset: "./assets/characters/idle/monstora-sharemi.webp",
    idleAnimation: "./assets/animations/idle/monstora-sharemi.webm",
    moves: ["vine-whip", "sharing-feast", "rally-together", "tangling-vines"]
  },
  {
    id: "giga-nomu",
    name: "Giga Nomu",
    title: "The Big Appetite Beast",
    maxHp: 1250,
    atk: 80,
    color: "#9b5a2e",
    accent: "#f5ad0f",
    asset: "./assets/characters/giga-nomu.png",
    idleAsset: "./assets/characters/idle/giga-nomu.webp",
    idleAnimation: "./assets/animations/idle/giga-nomu.webm",
    moves: ["mega-chomp", "devour", "belly-shield", "hungry-challenge"]
  },
  {
    id: "tamago-puffy",
    name: "Tamago Puffy",
    title: "The Soft & Cozy Dreamer",
    maxHp: 1050,
    atk: 65,
    color: "#f7c746",
    accent: "#f67280",
    asset: "./assets/characters/tamago-puffy.png",
    idleAsset: "./assets/characters/idle/tamago-puffy.webp",
    idleAnimation: "./assets/animations/idle/tamago-puffy.webm",
    moves: ["egg-toss", "fluffy-hug", "sunny-side-up", "sweet-dreams"]
  },
  {
    id: "cheezu-mellow",
    name: "Cheezu Mellow",
    title: "The Cheesy Comfort Lover",
    maxHp: 1100,
    atk: 75,
    color: "#f5ad0f",
    accent: "#ed1d24",
    asset: "./assets/characters/cheezu-mellow.png",
    idleAsset: "./assets/characters/idle/cheezu-mellow.webp",
    idleAnimation: "./assets/animations/idle/cheezu-mellow.webm",
    moves: ["cheese-wheel", "melted-cheese", "cover-up", "comfort-feast"]
  },
  {
    id: "ramy-noodleton",
    name: "Ramy Noodleton",
    title: "The Chill Slurper",
    maxHp: 950,
    atk: 115,
    color: "#db8b41",
    accent: "#ffe48a",
    asset: "./assets/characters/ramy-noodleton.png",
    idleAsset: "./assets/characters/idle/ramy-noodleton.webp",
    idleAnimation: "./assets/animations/idle/ramy-noodleton.webm",
    moves: ["noodle-strike", "slurp-combo", "cold-broth", "finishing-slurp"]
  },
  {
    id: "hot-sizz",
    name: "Hot Sizz",
    title: "The Hotplate Performer",
    maxHp: 1000,
    atk: 125,
    color: "#ed1d24",
    accent: "#f5ad0f",
    asset: "./assets/characters/hot-sizz.png",
    idleAsset: "./assets/characters/idle/hot-sizz.webp",
    idleAnimation: "./assets/animations/idle/hot-sizz.webm",
    moves: ["sizzling-plate", "flame-burst", "heat-up", "grand-performance"]
  },
  {
    id: "teppa-spark",
    name: "Teppa Spark",
    title: "The Precision Show Chef",
    maxHp: 950,
    atk: 100,
    color: "#b01c42",
    accent: "#ffa12b",
    asset: "./assets/characters/teppa-spark.png",
    idleAsset: "./assets/characters/idle/teppa-spark.webp",
    idleAnimation: "./assets/animations/idle/teppa-spark.webm",
    moves: ["precision-skewer", "spark-plate", "focus-flambe", "final-showpiece"],
    assumed: true
  }
]);

const IDLE_BACKGROUNDS = Object.freeze({
  curryGoblin: "./assets/backgrounds/curry-goblin.webp",
  rootCurryBrute: "./assets/backgrounds/root-curry-brute.webp",
  sporebackBrute: "./assets/backgrounds/sporeback-brute.webp",
  rottenGoblin: "./assets/backgrounds/rotten-goblin.webp",
  blazeFiend: "./assets/backgrounds/blaze-fiend.webp"
});

export const LEVELS = Object.freeze({
  solo: [
    { name: "Curry Goblin", maxHp: 1200, atk: 100, color: "#657d2f", accent: "#f5ad0f", asset: "./assets/enemies/curry-goblin.webp", idleBackground: IDLE_BACKGROUNDS.curryGoblin, moves: ["sauce-swipe", "curry-splash"] },
    ///{ name: "Root Curry Brute", maxHp: 800, atk: 78, color: "#a9601d", accent: "#8cad2d", asset: "./assets/enemies/root-curry-brute.webp", idleBackground: IDLE_BACKGROUNDS.rootCurryBrute, moves: ["root-bash", "gravy-snare"] },
    ///{ name: "Sporeback Brute", maxHp: 1000, atk: 86, color: "#557329", accent: "#c7b274", asset: "./assets/enemies/sporeback-brute.webp", idleBackground: IDLE_BACKGROUNDS.sporebackBrute, moves: ["spore-punch", "mushroom-haze", "fungal-guard"] }
  ],
  multiplayer: [
    { name: "Curry Goblin", maxHp: 2400, atk: 105, color: "#657d2f", accent: "#f5ad0f", asset: "./assets/enemies/curry-goblin.webp", idleBackground: IDLE_BACKGROUNDS.curryGoblin, moves: ["sauce-swipe", "curry-splash", "curry-cloud"] },
    ///{ name: "Root Curry Brute", maxHp: 1780, atk: 92, color: "#a9601d", accent: "#8cad2d", asset: "./assets/enemies/root-curry-brute.webp", idleBackground: IDLE_BACKGROUNDS.rootCurryBrute, moves: ["root-bash", "gravy-snare", "root-guard"] },
    ///{ name: "Sporeback Brute", maxHp: 2180, atk: 102, color: "#557329", accent: "#c7b274", asset: "./assets/enemies/sporeback-brute.webp", idleBackground: IDLE_BACKGROUNDS.sporebackBrute, moves: ["spore-punch", "mushroom-haze", "fungal-guard"] }
  ]
});

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