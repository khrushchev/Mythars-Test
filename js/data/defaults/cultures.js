// data/defaults/cultures.js
// Core Mythras culture definitions.

export const DEFAULT_CULTURES = [
  {
    id: "barbarian",
    name: "Barbarian",
    source: "core",
    description: "Tribal societies living close to nature, hardened by harsh conditions and constant struggle.",
    standardSkillBonuses: {
      athletics: 10, brawn: 10, endurance: 10, firstAid: 5,
      locale: 5, perception: 5, willpower: 5,
    },
    combatStyle: {
      name: "Barbarian Warrior",
      weapons: ["Battle Axe", "Spear", "Shield"],
      bonus: 10,
    },
    professionalSkillChoices: ["Craft (any)", "Lore (any)", "Musicianship", "Navigate", "Ride", "Survival", "Track"],
    professionalSkillChoiceCount: 2,
  },
  {
    id: "civilised",
    name: "Civilised",
    source: "core",
    description: "Urban cultures with complex social hierarchies, trade networks, and legal systems.",
    standardSkillBonuses: {
      conceal: 5, deceit: 10, drive: 5, influence: 10,
      insight: 10, locale: 10, willpower: 10,
    },
    combatStyle: {
      name: "Militia Training",
      weapons: ["Sword", "Shield", "Spear"],
      bonus: 10,
    },
    professionalSkillChoices: ["Art (any)", "Commerce", "Craft (any)", "Language (any)", "Lore (any)", "Oratory", "Rhetoric"],
    professionalSkillChoiceCount: 3,
  },
  {
    id: "nomadic",
    name: "Nomadic",
    source: "core",
    description: "Wandering peoples who follow herds or trade routes, expert riders and survivalists.",
    standardSkillBonuses: {
      athletics: 10, endurance: 10, firstAid: 5,
      locale: 5, perception: 10, ride: 10, stealth: 5, survival: 5,
    },
    combatStyle: {
      name: "Nomad Warrior",
      weapons: ["Composite Bow", "Sabre", "Javelin"],
      bonus: 10,
    },
    professionalSkillChoices: ["Animal Handling", "Craft (any)", "Healing", "Lore (any)", "Navigate", "Survival", "Track"],
    professionalSkillChoiceCount: 2,
  },
  {
    id: "primitive",
    name: "Primitive",
    source: "core",
    description: "Hunter-gatherer societies living in close harmony with the natural world.",
    standardSkillBonuses: {
      athletics: 10, brawn: 5, endurance: 10, firstAid: 5,
      locale: 5, perception: 10, stealth: 10, swim: 5,
    },
    combatStyle: {
      name: "Hunter's Way",
      weapons: ["Spear", "Bow", "Dagger"],
      bonus: 10,
    },
    professionalSkillChoices: ["Craft (any)", "Healing", "Lore (any)", "Navigate", "Survival", "Track"],
    professionalSkillChoiceCount: 2,
  },
];
