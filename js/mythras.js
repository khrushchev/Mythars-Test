// mythras.js — Pure calculation functions. No DOM, no side effects.

/** Get effective characteristic value */
export function effectiveChar(char) {
  return (char.base || 0) + (char.modifier || 0);
}

/** Derived: Action Points */
export function calcActionPoints(chars) {
  const sum = effectiveChar(chars.DEX) + effectiveChar(chars.INT);
  if (sum <= 12) return 1;
  if (sum <= 24) return 2;
  return 3;
}

/** Derived: Damage Modifier (as string) */
export function calcDamageModifier(chars) {
  const sum = effectiveChar(chars.STR) + effectiveChar(chars.SIZ);
  if (sum <= 5)   return "−1d8";
  if (sum <= 10)  return "−1d6";
  if (sum <= 15)  return "−1d4";
  if (sum <= 20)  return "−1d2";
  if (sum <= 25)  return "+0";
  if (sum <= 30)  return "+1d2";
  if (sum <= 35)  return "+1d4";
  if (sum <= 40)  return "+1d6";
  if (sum <= 45)  return "+1d8";
  if (sum <= 50)  return "+1d10";
  if (sum <= 60)  return "+1d12";
  if (sum <= 70)  return "+2d6";
  if (sum <= 80)  return "+1d8+1d6";
  if (sum <= 90)  return "+2d8";
  if (sum <= 100) return "+1d10+1d8";
  if (sum <= 110) return "+2d10";
  if (sum <= 120) return "+2d10+1d2";
  return "+3d10";
}

/** Derived: Experience Modifier */
export function calcExpModifier(chars) {
  return Math.floor((effectiveChar(chars.CHA) - 1) / 10);
}

/** Derived: Healing Rate */
export function calcHealingRate(chars) {
  return Math.max(1, Math.floor(effectiveChar(chars.CON) / 6));
}

/** Derived: Hit Points (total, used to calc per-location) */
export function calcTotalHP(chars) {
  return Math.ceil((effectiveChar(chars.CON) + effectiveChar(chars.SIZ)) / 2);
}

/** Derived: Initiative Bonus */
export function calcInitiativeBonus(chars) {
  return Math.round((effectiveChar(chars.DEX) + effectiveChar(chars.INT)) / 2);
}

/** Derived: Luck Points */
export function calcLuckPoints(chars) {
  return Math.max(1, Math.ceil(effectiveChar(chars.POW) / 10));
}

/** Derived: Magic Points */
export function calcMagicPoints(chars) {
  return effectiveChar(chars.POW);
}

/** Derived: Movement Rate */
export function calcMovementRate(baseMove, modifiers) {
  return Math.max(1, baseMove + (modifiers?.movementRate || 0));
}

/** Hit location HP from total HP */
export function calcLocationHP(totalHP, locationId) {
  switch (locationId) {
    case "hl_ches": return totalHP;
    case "hl_abdo": return Math.max(1, totalHP - 1);
    case "hl_head": return Math.max(1, totalHP - 1);
    case "hl_rleg":
    case "hl_lleg": return Math.max(1, totalHP - 1);
    case "hl_rarm":
    case "hl_larm": return Math.max(1, totalHP - 2);
    default:        return totalHP;
  }
}

/** Standard skill base values */
export const STANDARD_SKILL_BASES = {
  athletics:   chars => effectiveChar(chars.STR) + effectiveChar(chars.DEX),
  boating:     chars => effectiveChar(chars.STR) + effectiveChar(chars.CON),
  brawn:       chars => effectiveChar(chars.STR) + effectiveChar(chars.SIZ),
  conceal:     chars => effectiveChar(chars.DEX) + effectiveChar(chars.POW),
  customs:     chars => effectiveChar(chars.INT) * 2 + 40,
  dance:       chars => effectiveChar(chars.DEX) + effectiveChar(chars.CHA),
  deceit:      chars => effectiveChar(chars.INT) + effectiveChar(chars.CHA),
  drive:       chars => effectiveChar(chars.DEX) + effectiveChar(chars.POW),
  endurance:   chars => effectiveChar(chars.CON) * 2,
  evade:       chars => effectiveChar(chars.DEX) * 2,
  firstAid:    chars => effectiveChar(chars.INT) + effectiveChar(chars.DEX),
  influence:   chars => effectiveChar(chars.CHA) * 2,
  insight:     chars => effectiveChar(chars.INT) + effectiveChar(chars.POW),
  locale:      chars => effectiveChar(chars.INT) * 2,
  nativeTongue:chars => effectiveChar(chars.INT) + effectiveChar(chars.CHA) + 40,
  perception:  chars => effectiveChar(chars.INT) + effectiveChar(chars.POW),
  ride:        chars => effectiveChar(chars.DEX) + effectiveChar(chars.POW),
  sing:        chars => effectiveChar(chars.POW) + effectiveChar(chars.CHA),
  stealth:     chars => effectiveChar(chars.DEX) + effectiveChar(chars.INT),
  swim:        chars => effectiveChar(chars.STR) + effectiveChar(chars.CON),
  unarmed:     chars => effectiveChar(chars.STR) + effectiveChar(chars.DEX),
  willpower:   chars => effectiveChar(chars.POW) * 2,
};

export const STANDARD_SKILL_NAMES = {
  athletics: "Athletics",   boating: "Boating",       brawn: "Brawn",
  conceal: "Conceal",       customs: "Customs",       dance: "Dance",
  deceit: "Deceit",         drive: "Drive",           endurance: "Endurance",
  evade: "Evade",           firstAid: "First Aid",    influence: "Influence",
  insight: "Insight",       locale: "Locale",         nativeTongue: "Native Tongue",
  perception: "Perception", ride: "Ride",             sing: "Sing",
  stealth: "Stealth",       swim: "Swim",             unarmed: "Unarmed",
  willpower: "Willpower",
};

/** Evaluate a professional skill base formula string */
export function evalSkillBase(formula, chars) {
  if (!formula || !chars) return 0;
  try {
    // Replace characteristic names with values
    const safe = formula
      .replace(/STR/g, effectiveChar(chars.STR))
      .replace(/CON/g, effectiveChar(chars.CON))
      .replace(/SIZ/g, effectiveChar(chars.SIZ))
      .replace(/DEX/g, effectiveChar(chars.DEX))
      .replace(/INT/g, effectiveChar(chars.INT))
      .replace(/POW/g, effectiveChar(chars.POW))
      .replace(/CHA/g, effectiveChar(chars.CHA));
    // Only allow numbers, operators, parens
    if (!/^[\d+\-*/() ]+$/.test(safe)) return 0;
    return Math.floor(Function('"use strict"; return (' + safe + ')')());
  } catch { return 0; }
}

/** Calculate effective skill % (capped at 200) */
export function effectiveSkillPct(base, bonus) {
  return Math.min(200, Math.max(0, (base || 0) + (bonus || 0)));
}

/** Apply difficulty grade modifier */
export function applyDifficulty(target, grade) {
  switch (grade) {
    case "hard":       return Math.floor(target / 2);
    case "formidable": return Math.floor(target / 3);
    case "herculean":  return Math.floor(target / 5);
    case "hopeless":   return 0;
    default:           return target;
  }
}

/** Determine success grade from roll result */
export function successGrade(rolled, target) {
  const critThreshold = Math.floor(target / 10);
  if (rolled === 1 || rolled <= critThreshold) return "critical";
  if (rolled <= target) return "success";
  if (rolled >= 96 && target < 96) return "fumble";
  if (rolled === 100) return "fumble";
  return "failure";
}

/** Roll NdM+bonus */
export function rollDice(dice, sides, bonus) {
  let total = bonus || 0;
  for (let i = 0; i < dice; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

/** Evaluate a damage expression string like "1d6+1d4+2" */
export function evalDiceExpression(expr) {
  if (!expr) return { total: 0, parts: [] };
  const parts = [];
  let total = 0;
  const diceRe = /([+-]?\d*)d(\d+)/gi;
  let remaining = expr.replace(/\s/g, "");
  let match;
  while ((match = diceRe.exec(expr.replace(/\s/g, ""))) !== null) {
    const negative = match[1].startsWith("-");
    const count = Math.abs(parseInt(match[1] || "1") || 1);
    const sides = parseInt(match[2]);
    let subtotal = 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      subtotal += r;
    }
    if (negative) subtotal = -subtotal;
    parts.push({ expr: `${negative ? "-" : ""}${count}d${sides}`, rolls, subtotal });
    total += subtotal;
    remaining = remaining.replace(match[0], "");
  }
  // remaining constant modifiers
  remaining = remaining.replace(/[^+\-\d]/g, "");
  if (remaining && remaining !== "" && remaining !== "+" && remaining !== "-") {
    try {
      const mod = parseInt(remaining) || 0;
      if (mod !== 0) { parts.push({ expr: String(mod), rolls: [], subtotal: mod }); total += mod; }
    } catch {}
  }
  return { total, parts };
}

/** Compute all derived attributes from a character */
export function computeAllDerived(character) {
  const chars = character.characteristics;
  const mods  = character.attributes?.modifiers || {};
  const baseMove = character.speciesData?.movementRate || 6;

  const totalHP = calcTotalHP(chars) + (mods.hitPoints || 0);

  return {
    actionPoints:     calcActionPoints(chars) + (mods.actionPoints || 0),
    damageModifier:   calcDamageModifier(chars),
    expModifier:      calcExpModifier(chars),
    healingRate:      calcHealingRate(chars),
    hitPoints:        totalHP,
    initiativeBonus:  calcInitiativeBonus(chars),
    luckPoints:       calcLuckPoints(chars) + (mods.luckPoints || 0),
    magicPoints:      calcMagicPoints(chars) + (mods.magicPoints || 0),
    movementRate:     calcMovementRate(baseMove, mods),
    encLimit:         effectiveChar(chars.STR) + effectiveChar(chars.SIZ),
  };
}

/** Compute total ENC from equipment, weapons, armor */
export function computeTotalENC(character) {
  let total = 0;
  for (const w of (character.weapons || []))    total += (parseFloat(w.ENC) || 0);
  for (const a of (character.armor || []))      total += (parseFloat(a.ENC) || 0);
  for (const e of (character.equipment || []))  total += (parseFloat(e.ENC) || 0) * ((e.quantity) || 1);
  return Math.round(total * 10) / 10;
}
