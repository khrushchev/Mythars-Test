// storage.js — localStorage CRUD for characters

const PREFIX     = "mythrasforge:";
const INDEX_KEY  = PREFIX + "index";
const SETTINGS_KEY = PREFIX + "settings";

function getIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]"); }
  catch { return []; }
}
function setIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}
function genId() {
  return "ch_" + Math.random().toString(36).slice(2, 9);
}

export const Storage = {
  listCharacters() { return getIndex(); },

  getCharacter(id) {
    try {
      const raw = localStorage.getItem(PREFIX + "char:" + id);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  saveCharacter(character) {
    const now = new Date().toISOString();
    if (!character.meta) character.meta = {};
    character.meta.updatedAt = now;
    localStorage.setItem(PREFIX + "char:" + character.id, JSON.stringify(character));
    const index = getIndex();
    const i = index.findIndex(c => c.id === character.id);
    const summary = {
      id: character.id,
      name: character.identity?.name || "Unnamed",
      species: character.identity?.species || "",
      career: character.identity?.career || "",
      updatedAt: now,
    };
    if (i >= 0) index[i] = summary; else index.push(summary);
    setIndex(index);
  },

  createCharacter(name = "New Character") {
    const id = genId();
    const now = new Date().toISOString();
    const character = defaultCharacter(id, name, now);
    this.saveCharacter(character);
    return character;
  },

  deleteCharacter(id) {
    localStorage.removeItem(PREFIX + "char:" + id);
    setIndex(getIndex().filter(c => c.id !== id));
  },

  duplicateCharacter(id) {
    const orig = this.getCharacter(id);
    if (!orig) return null;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = genId();
    copy.identity.name = (orig.identity.name || "Character") + " (copy)";
    copy.meta.createdAt = new Date().toISOString();
    this.saveCharacter(copy);
    return copy;
  },

  exportCharacter(id) {
    const char = this.getCharacter(id);
    if (!char) return;
    const fn = (char.identity.name || "character").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
    const blob = new Blob([JSON.stringify(char, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fn; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  importCharacter(jsonString) {
    const char = JSON.parse(jsonString);
    if (!char.identity || !char.characteristics) throw new Error("Invalid character file");
    char.id = genId();
    char.identity.name = (char.identity.name || "Imported") + " (imported)";
    char.meta = { ...(char.meta || {}), createdAt: new Date().toISOString() };
    this.saveCharacter(char);
    return char;
  },

  getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
    catch { return {}; }
  },
  saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); },

  storageUsedKB() {
    let t = 0;
    for (const k of Object.keys(localStorage))
      if (k.startsWith(PREFIX)) t += (localStorage.getItem(k) || "").length;
    return Math.round(t / 1024 * 10) / 10;
  },
};

function defaultCharacter(id, name, now) {
  return {
    id, version: 1,
    meta: { createdAt: now, updatedAt: now },
    identity: {
      name, species: "Human", culture: "", career: "", rank: "", age: 0,
      gender: "", deity: "", cult: "", height: "", weight: "",
      hair: "", eyes: "", distinguishingMarks: "", background: "",
    },
    speciesData: { movementRate: 6 },
    characteristics: {
      STR: { base: 10, modifier: 0 }, CON: { base: 10, modifier: 0 },
      SIZ: { base: 13, modifier: 0 }, DEX: { base: 10, modifier: 0 },
      INT: { base: 13, modifier: 0 }, POW: { base: 10, modifier: 0 },
      CHA: { base: 10, modifier: 0 },
    },
    attributes: { modifiers: { actionPoints: 0, magicPoints: 0, hitPoints: 0, luckPoints: 0, movementRate: 0 } },
    standardSkills: Object.fromEntries([
      "athletics","boating","brawn","conceal","customs","dance","deceit","drive",
      "endurance","evade","firstAid","influence","insight","locale","nativeTongue",
      "perception","ride","sing","stealth","swim","unarmed","willpower"
    ].map(k => [k, { bonus: 0 }])),
    professionalSkills: [],
    passions: [],
    combatStyles: [],
    weapons: [],
    hitLocations: [
      { id:"hl_rleg", name:"Right Leg",  dieRange:[1,3],   armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_lleg", name:"Left Leg",   dieRange:[4,6],   armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_abdo", name:"Abdomen",    dieRange:[7,9],   armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_ches", name:"Chest",      dieRange:[10,12], armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_rarm", name:"Right Arm",  dieRange:[13,15], armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_larm", name:"Left Arm",   dieRange:[16,18], armorAP:0, baseHP:0, currentHP:0, wounds:[] },
      { id:"hl_head", name:"Head",       dieRange:[19,20], armorAP:0, baseHP:0, currentHP:0, wounds:[] },
    ],
    armor: [],
    magic: {
      folkMagic: { active: false, spells: [] },
      animism:   { active: false, fetch: { INT: 0, POW: 0 }, practiceSkill: 0, spirits: [] },
      mysticism: { active: false, mysticismSkill: 0, flaws: [], abilities: [] },
      sorcery:   { active: false, invokeSkill: 0, shaping: { duration:false, magnitude:false, range:false, targets:false, combine:false }, grimoires: [], spells: [] },
      theism:    { active: false, worshipSkill: 0, deity: "", piety: 0, miracles: [] },
    },
    equipment: [],
    currency: { gold: 0, silver: 0, copper: 0, custom: "" },
    notes: "",
  };
}
