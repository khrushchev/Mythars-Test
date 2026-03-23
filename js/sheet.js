// sheet.js — Character sheet controller

import { Storage } from "./storage.js";
import * as M from "./mythras.js";
import { skillRoll, charRoll, combatRoll, damageRoll, setCharacterName, initBeyond20 } from "./roller.js";

const params = new URLSearchParams(location.search);
const charId = params.get("id");

let char = null;
let saveTimer = null;
let isDirty = false;

// ── Bootstrap ──────────────────────────────────────────────────────────────
if (!charId) { location.href = "index.html"; }
else {
  char = Storage.getCharacter(charId);
  if (!char) { alert("Character not found."); location.href = "index.html"; }
  else {
    setCharacterName(char.identity?.name || "");
    initBeyond20();
    renderAll();
    bindTabNav();
    bindFieldListeners();
    bindActionButtons();
    document.getElementById("export-btn").addEventListener("click", () => Storage.exportCharacter(charId));
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && isDirty) commitSave(); });
  }
}

// ── Save ────────────────────────────────────────────────────────────────────
function markDirty() {
  isDirty = true;
  setStatus("unsaved");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commitSave, 2000);
}
function commitSave() {
  try {
    Storage.saveCharacter(char);
    isDirty = false;
    setStatus("saved");
  } catch(e) {
    setStatus("error");
    console.error(e);
  }
}
function setStatus(s) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.className = "save-status " + s;
  el.textContent = { unsaved:"Unsaved", saving:"Saving…", saved:"Saved ✓", error:"Save failed ✗" }[s] || "—";
}

// ── Tab Nav ─────────────────────────────────────────────────────────────────
function bindTabNav() {
  document.querySelectorAll(".sheet-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sheet-tab").forEach(b => b.setAttribute("aria-selected","false"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.setAttribute("aria-selected","true");
      document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`)?.classList.add("active");
    });
  });
}

// ── Deep set utility ────────────────────────────────────────────────────────
function deepSet(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = value;
}
function deepGet(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ── Field Listeners ─────────────────────────────────────────────────────────
function bindFieldListeners() {
  document.addEventListener("change", e => {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    const val = el.type === "number" ? (parseFloat(el.value) || 0) : el.type === "checkbox" ? el.checked : el.value;
    deepSet(char, field, val);
    markDirty();
    if (field.startsWith("characteristics") || field.startsWith("attributes")) recalcDerived();
    if (field === "identity.name") { updateHeader(); setCharacterName(val); }
    if (field.startsWith("identity.")) updateHeader();
    if (field.startsWith("armor")) recalcArmorAP();
  });

  // contenteditable sheet name
  const nameEl = document.getElementById("sheet-name");
  if (nameEl) {
    nameEl.addEventListener("input", () => {
      char.identity.name = nameEl.textContent.trim();
      markDirty();
      setCharacterName(char.identity.name);
    });
    nameEl.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); } });
  }
}

// ── Render All ──────────────────────────────────────────────────────────────
function renderAll() {
  updateHeader();
  renderCharacteristics();
  recalcDerived();
  renderStandardSkills();
  renderProfSkills();
  renderPassions();
  renderCombatStyles();
  renderWeapons();
  renderHitLocations();
  renderArmor();
  renderMagic();
  renderEquipment();
  renderCurrency();
  renderNotes();
  populateIdentityFields();
  updateFooter();
}

function updateHeader() {
  const id = char.identity;
  document.getElementById("sheet-name").textContent = id.name || "Unnamed Character";
  document.title = `${id.name || "Character"} — MythrasForge`;
  const parts = [id.species, id.culture, id.career, id.age ? `Age ${id.age}` : ""].filter(Boolean);
  document.getElementById("sheet-subtitle").textContent = parts.join(" · ");
}

function populateIdentityFields() {
  document.querySelectorAll("[data-field]").forEach(el => {
    const val = deepGet(char, el.dataset.field);
    if (val === undefined) return;
    if (el.type === "checkbox") el.checked = !!val;
    else el.value = val ?? "";
  });
}

// ── Characteristics ─────────────────────────────────────────────────────────
const CHARS = ["STR","CON","SIZ","DEX","INT","POW","CHA"];

function renderCharacteristics() {
  const grid = document.getElementById("char-grid");
  if (!grid) return;
  grid.innerHTML = CHARS.map(c => {
    const eff = M.effectiveChar(char.characteristics[c]);
    return `
    <div class="char-block" data-char="${c}">
      <button class="char-roll-btn btn-icon" title="Roll ${c}×5" onclick="event.stopPropagation(); window._rollChar('${c}')">⚂</button>
      <span class="char-label">${c}</span>
      <span class="char-value" id="char-val-${c}">${eff}</span>
      <span class="char-mod" id="char-mod-${c}">${char.characteristics[c].modifier ? (char.characteristics[c].modifier > 0 ? "+" : "") + char.characteristics[c].modifier : ""}</span>
    </div>`;
  }).join("");

  grid.querySelectorAll(".char-block").forEach(block => {
    block.addEventListener("click", e => {
      if (e.target.classList.contains("char-roll-btn")) return;
      const c = block.dataset.char;
      const valEl = document.getElementById("char-val-" + c);
      if (valEl.tagName === "INPUT") return;
      const inp = document.createElement("input");
      inp.type = "number"; inp.min = 1; inp.max = 99;
      inp.value = char.characteristics[c].base;
      inp.className = "char-value-input";
      valEl.replaceWith(inp);
      inp.id = "char-val-" + c;
      inp.focus(); inp.select();
      const commit = () => {
        const v = Math.max(1, Math.min(99, parseInt(inp.value) || 1));
        char.characteristics[c].base = v;
        markDirty();
        renderCharacteristics();
        recalcDerived();
        renderStandardSkills();
        renderProfSkills();
      };
      inp.addEventListener("blur", commit);
      inp.addEventListener("keydown", e2 => { if (e2.key === "Enter") inp.blur(); });
    });
  });
}

window._rollChar = function(c) {
  const eff = M.effectiveChar(char.characteristics[c]);
  charRoll(c, eff);
};

// ── Derived Attributes ──────────────────────────────────────────────────────
function recalcDerived() {
  const d = M.computeAllDerived(char);
  const grid = document.getElementById("attr-grid");
  if (grid) {
    grid.innerHTML = [
      ["Action Points", d.actionPoints],
      ["Damage Modifier", d.damageModifier],
      ["Experience Mod", (d.expModifier >= 0 ? "+" : "") + d.expModifier],
      ["Healing Rate", d.healingRate],
      ["Hit Points", d.hitPoints],
      ["Initiative Bonus", "+" + d.initiativeBonus],
      ["Luck Points", d.luckPoints],
      ["Magic Points", d.magicPoints],
      ["Movement Rate", d.movementRate + "m"],
      ["ENC Limit", d.encLimit],
    ].map(([label, val]) => `
      <div class="attr-block">
        <span class="attr-label">${label}</span>
        <span class="attr-value">${val}</span>
      </div>`).join("");
  }

  // Recalc hit location HP
  const hp = d.hitPoints;
  char.hitLocations.forEach(loc => {
    const newBase = M.calcLocationHP(hp, loc.id);
    if (loc.baseHP !== newBase) {
      if (loc.currentHP === loc.baseHP || loc.currentHP === 0) loc.currentHP = newBase;
      loc.baseHP = newBase;
    }
  });
  renderHitLocations();
  updateFooter();
}

function updateFooter() {
  const d = M.computeAllDerived(char);
  const enc = M.computeTotalENC(char);
  const limit = d.encLimit;
  const pct = limit > 0 ? Math.min(100, (enc / limit) * 100) : 0;
  const encEl = document.getElementById("enc-val");
  const barEl = document.getElementById("enc-bar-fill");
  if (encEl) {
    encEl.textContent = enc;
    encEl.className = "footer-stat-val" + (enc > limit ? " danger" : enc > limit * 0.75 ? " warning" : "");
  }
  document.getElementById("enc-limit").textContent  = limit;
  if (barEl) {
    barEl.style.width = pct + "%";
    barEl.className = "enc-bar-fill" + (enc > limit ? " danger" : enc > limit * 0.75 ? " warning" : "");
  }
  document.getElementById("footer-ap").textContent   = d.actionPoints;
  document.getElementById("footer-mp").textContent   = d.magicPoints;
  document.getElementById("footer-luck").textContent = d.luckPoints;
}

// ── Standard Skills ─────────────────────────────────────────────────────────
function renderStandardSkills() {
  const list = document.getElementById("standard-skill-list");
  if (!list) return;
  list.innerHTML = Object.entries(M.STANDARD_SKILL_NAMES).map(([key, label]) => {
    const base = M.STANDARD_SKILL_BASES[key](char.characteristics);
    const bonus = char.standardSkills[key]?.bonus || 0;
    const eff = M.effectiveSkillPct(base, bonus);
    return `
    <li class="skill-row" data-skill="${key}" data-type="standard" data-target="${eff}"
        onclick="window._rollSkill('${label}', ${eff}, event)">
      <span class="skill-roll-icon">⚂</span>
      <span class="skill-name">${label}</span>
      <span class="skill-base">${base}</span>
      <input class="skill-bonus-input" type="number" value="${bonus}" min="0" max="200"
        data-skill="${key}" onclick="event.stopPropagation()"
        oninput="window._updateStdBonus('${key}', this.value)">
      <span class="skill-pct ${eff >= 100 ? 'high' : eff < 30 ? 'low' : ''}">${eff}%</span>
    </li>`;
  }).join("");
}

window._updateStdBonus = function(key, val) {
  char.standardSkills[key].bonus = parseInt(val) || 0;
  markDirty();
  renderStandardSkills();
};

// ── Professional Skills ──────────────────────────────────────────────────────
function renderProfSkills() {
  const list = document.getElementById("prof-skill-list");
  if (!list) return;
  if (!char.professionalSkills.length) {
    list.innerHTML = '<li style="padding:var(--sp-3) var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No professional skills</li>';
    return;
  }
  list.innerHTML = char.professionalSkills.map((ps, i) => {
    const base = M.evalSkillBase(ps.base, char.characteristics);
    const eff  = M.effectiveSkillPct(base, ps.bonus);
    const disp = ps.specialization ? `${ps.name} (${ps.specialization})` : ps.name;
    return `
    <li class="skill-row" data-skill="${i}" data-type="prof" data-target="${eff}"
        onclick="window._rollSkill('${disp}', ${eff}, event)">
      <span class="skill-roll-icon">⚂</span>
      <span class="skill-name">${disp} <span class="skill-name-spec"></span></span>
      <span class="skill-base">${base}</span>
      <input class="skill-bonus-input" type="number" value="${ps.bonus}" min="0" max="200"
        onclick="event.stopPropagation()"
        oninput="window._updateProfBonus(${i}, this.value)">
      <span class="skill-pct ${eff >= 100 ? 'high' : eff < 30 ? 'low' : ''}">${eff}%</span>
      <button class="btn-icon" onclick="event.stopPropagation(); window._editProfSkill(${i})">✎</button>
    </li>`;
  }).join("");
}

window._updateProfBonus = function(i, val) {
  char.professionalSkills[i].bonus = parseInt(val) || 0;
  markDirty();
  renderProfSkills();
};

window._rollSkill = function(label, target, e) {
  let grade = "standard";
  if (e.ctrlKey && e.shiftKey) grade = "hopeless";
  else if (e.ctrlKey)  grade = "formidable";
  else if (e.shiftKey) grade = "hard";
  else if (e.altKey)   grade = "herculean";
  skillRoll(label, target, { difficulty: grade });
};

// ── Passions ─────────────────────────────────────────────────────────────────
function renderPassions() {
  const list = document.getElementById("passion-list");
  if (!list) return;
  if (!char.passions.length) {
    list.innerHTML = '<li style="padding:var(--sp-3) var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No passions</li>';
    return;
  }
  list.innerHTML = char.passions.map((p, i) => `
    <li class="passion-row" onclick="window._rollSkill('${p.type}: ${p.subject}', ${p.value}, event)">
      <span class="skill-roll-icon">⚂</span>
      <div>
        <div class="passion-type">${p.type}</div>
        <div class="passion-subject">${p.subject || "—"}</div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--sp-2);">
        <span class="skill-pct">${p.value}%</span>
        <button class="btn-icon" onclick="event.stopPropagation(); window._editPassion(${i})">✎</button>
      </div>
    </li>`).join("");
}

// ── Combat Styles ─────────────────────────────────────────────────────────────
function renderCombatStyles() {
  const list = document.getElementById("combat-style-list");
  if (!list) return;
  if (!char.combatStyles.length) {
    list.innerHTML = '<div style="padding:var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No combat styles</div>';
    return;
  }
  const base = char.characteristics ? M.effectiveChar(char.characteristics.STR) + M.effectiveChar(char.characteristics.DEX) : 0;
  list.innerHTML = char.combatStyles.map((cs, i) => {
    const eff = M.effectiveSkillPct(base, cs.bonus);
    return `
    <div class="combat-style-row" onclick="window._rollSkill('${cs.name}', ${eff}, event)">
      <span class="skill-roll-icon">⚂</span>
      <div>
        <div class="combat-style-name">${cs.name}</div>
        <div class="combat-style-weapons">${cs.weapons?.join(", ") || ""}</div>
      </div>
      <span class="skill-base">${base}</span>
      <span class="skill-pct ${eff >= 100 ? 'high' : ''}">${eff}%</span>
      <input class="skill-bonus-input" type="number" value="${cs.bonus}" min="0" max="200"
        onclick="event.stopPropagation()"
        oninput="window._updateCSBonus(${i}, this.value)">
      <button class="btn-icon" onclick="event.stopPropagation(); window._editCombatStyle(${i})">✎</button>
    </div>`;
  }).join("");
}

window._updateCSBonus = function(i, val) {
  char.combatStyles[i].bonus = parseInt(val) || 0;
  markDirty();
  renderCombatStyles();
};

// ── Weapons ───────────────────────────────────────────────────────────────────
function renderWeapons() {
  const list = document.getElementById("weapon-list");
  if (!list) return;
  if (!char.weapons.length) {
    list.innerHTML = '<div style="padding:var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No weapons</div>';
    return;
  }
  const dm = M.calcDamageModifier(char.characteristics);
  list.innerHTML = `
    <div class="weapon-row" style="font-family:var(--font-display);font-size:var(--text-xs);letter-spacing:0.1em;text-transform:uppercase;color:var(--text-label);padding-top:var(--sp-3);">
      <span>Weapon</span><span>Damage</span><span>Reach</span><span>Size</span><span>AP/HP</span><span></span>
    </div>` +
    char.weapons.map((w, i) => `
    <div class="weapon-row">
      <span class="weapon-name">${w.name}</span>
      <span class="weapon-damage" title="Click to roll damage" onclick="window._rollDamage('${w.name}', '${w.damage}', '${dm}')">${w.damage}</span>
      <span class="weapon-stat">${w.reach || "—"}</span>
      <span class="weapon-stat">${w.size || "—"}</span>
      <span class="weapon-stat">${w.AP || "—"}/${w.HP || "—"}</span>
      <button class="btn-icon" onclick="window._editWeapon(${i})">✎</button>
    </div>`).join("");
}

window._rollDamage = function(name, damage, dm) {
  let expr = damage;
  if (dm && dm !== "+0") expr = damage + dm;
  damageRoll(name, expr);
};

// ── Hit Locations ─────────────────────────────────────────────────────────────
function renderHitLocations() {
  const el = document.getElementById("hit-location-list");
  if (!el) return;
  el.innerHTML = char.hitLocations.map((loc, i) => {
    const pct = loc.baseHP > 0 ? loc.currentHP / loc.baseHP : 1;
    const cls = pct <= 0 ? "critical" : pct <= 0.33 ? "serious" : pct <= 0.66 ? "wounded" : "healthy";
    return `
    <div class="hit-loc-row">
      <span class="hit-loc-name">${loc.name}</span>
      <span class="hit-loc-range">${loc.dieRange[0]}–${loc.dieRange[1]}</span>
      <div class="hit-loc-hp">
        <span class="hit-loc-hp-cur ${cls}" title="Click to edit HP" onclick="window._editLocHP(${i})">${loc.currentHP}</span>
        <span class="hit-loc-hp-sep">/</span>
        <span class="hit-loc-hp-max">${loc.baseHP}</span>
      </div>
      <span class="hit-loc-ap" title="AP (armour)">
        <input type="number" value="${loc.armorAP}" min="0" max="20" style="width:3rem;text-align:center;font-family:var(--font-mono);font-size:var(--text-sm);padding:2px 4px;"
          onchange="window._updateLocAP(${i}, this.value)" onclick="event.stopPropagation()">
      </span>
    </div>`;
  }).join("");
}

window._editLocHP = function(i) {
  const loc = char.hitLocations[i];
  const el = document.querySelector(`.hit-loc-row:nth-child(${i + 1}) .hit-loc-hp-cur`);
  const inp = document.createElement("input");
  inp.type = "number"; inp.value = loc.currentHP;
  inp.style.cssText = "width:3rem;text-align:center;font-family:var(--font-mono);font-size:var(--text-base);background:var(--bg-input);border:1px solid var(--gold);border-radius:var(--radius);color:var(--gold-bright);padding:1px 3px;";
  el.replaceWith(inp);
  inp.focus(); inp.select();
  const done = () => {
    loc.currentHP = Math.min(loc.baseHP, parseInt(inp.value) || 0);
    markDirty(); renderHitLocations();
  };
  inp.addEventListener("blur", done);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); });
};

window._updateLocAP = function(i, v) {
  char.hitLocations[i].armorAP = parseInt(v) || 0;
  markDirty();
};

// ── Armor ─────────────────────────────────────────────────────────────────────
function renderArmor() {
  const list = document.getElementById("armor-list");
  if (!list) return;
  if (!char.armor.length) {
    list.innerHTML = '<div style="padding:var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No armor</div>';
    return;
  }
  list.innerHTML = char.armor.map((a, i) => `
    <div class="weapon-row">
      <span class="weapon-name">${a.name}</span>
      <span class="weapon-stat">AP ${a.AP}</span>
      <span class="weapon-stat">ENC ${a.ENC}</span>
      <span class="weapon-stat" style="font-size:var(--text-xs);color:var(--text-dim);">${(a.locations||[]).join(", ")}</span>
      <button class="btn-icon" onclick="window._editArmor(${i})">✎</button>
    </div>`).join("");
}

function recalcArmorAP() {
  // Reset then sum
  char.hitLocations.forEach(loc => { loc.armorAP = 0; });
  char.armor.forEach(a => {
    (a.locations || []).forEach(locName => {
      const loc = char.hitLocations.find(l => l.name.toLowerCase().includes(locName.toLowerCase()));
      if (loc) loc.armorAP += (a.AP || 0);
    });
  });
  renderHitLocations();
}

// ── Magic ─────────────────────────────────────────────────────────────────────
const MAGIC_SYSTEMS = [
  { key:"folkMagic", label:"Folk Magic" },
  { key:"animism",   label:"Animism" },
  { key:"mysticism", label:"Mysticism" },
  { key:"sorcery",   label:"Sorcery" },
  { key:"theism",    label:"Theism" },
];

function renderMagic() {
  const btnBar = document.getElementById("magic-system-btns");
  const panels = document.getElementById("magic-panels");
  if (!btnBar || !panels) return;

  btnBar.innerHTML = MAGIC_SYSTEMS.map(ms => `
    <button class="magic-system-btn ${char.magic[ms.key]?.active ? 'active' : ''}"
      data-magic="${ms.key}"
      onclick="window._toggleMagic('${ms.key}', this)">${ms.label}
      ${char.magic[ms.key]?.active ? '' : '<span style="opacity:0.5;font-size:0.9em"> ○</span>'}
    </button>`).join("");

  panels.innerHTML = MAGIC_SYSTEMS.map(ms => `
    <div class="magic-panel ${char.magic[ms.key]?.active ? 'active' : ''}" data-magic="${ms.key}">
      ${renderMagicPanel(ms.key)}
    </div>`).join("");
}

window._toggleMagic = function(key, btn) {
  char.magic[key].active = !char.magic[key].active;
  markDirty();
  renderMagic();
};

function renderMagicPanel(key) {
  const m = char.magic[key];
  if (!m.active) return `<div class="card"><div class="card-body" style="color:var(--text-dim);">System not active. Click the button above to enable.</div></div>`;

  switch(key) {
    case "folkMagic": return renderFolkMagic(m);
    case "theism":    return renderTheism(m);
    case "sorcery":   return renderSorcery(m);
    case "animism":   return renderAnimism(m);
    case "mysticism": return renderMysticism(m);
    default: return "";
  }
}

function renderFolkMagic(m) {
  const spells = m.spells || [];
  return `<div class="card">
    <div class="card-header"><span class="card-title">Folk Magic Spells</span><button class="btn btn-ghost btn-sm" onclick="window._addFolkSpell()">+ Add Spell</button></div>
    ${spells.length ? spells.map((s,i) => `
      <div class="spell-row">
        <span class="spell-name">${s.name}</span>
        <span class="spell-mag">Mag ${s.magnitude}</span>
        <button class="btn-icon" onclick="window._editFolkSpell(${i})">✎</button>
      </div>`).join("") :
      '<div style="padding:var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No spells</div>'}
  </div>`;
}

function renderTheism(m) {
  return `<div class="card"><div class="card-header"><span class="card-title">Theism</span></div><div class="card-body">
    <div class="two-col">
      <div class="form-group"><label class="form-label">Deity</label><input type="text" data-field="magic.theism.deity" value="${m.deity||''}"></div>
      <div class="form-group"><label class="form-label">Worship Skill %</label><input type="number" data-field="magic.theism.worshipSkill" value="${m.worshipSkill||0}" style="max-width:8rem;"></div>
      <div class="form-group"><label class="form-label">Piety Points</label><input type="number" data-field="magic.theism.piety" value="${m.piety||0}" style="max-width:8rem;"></div>
    </div>
    <div class="card-header" style="margin-top:var(--sp-4);"><span class="card-title">Miracles</span><button class="btn btn-ghost btn-sm" onclick="window._addMiracle()">+ Add</button></div>
    ${(m.miracles||[]).map((mir,i) => `<div class="spell-row"><span class="spell-name">${mir.name}</span><span class="spell-mag">Int ${mir.intensity||1}</span><button class="btn-icon" onclick="window._editMiracle(${i})">✎</button></div>`).join("") || '<div style="padding:var(--sp-3);color:var(--text-dim);font-size:var(--text-sm);">No miracles</div>'}
  </div></div>`;
}

function renderSorcery(m) {
  return `<div class="card"><div class="card-header"><span class="card-title">Sorcery</span></div><div class="card-body">
    <div class="two-col">
      <div class="form-group"><label class="form-label">Invoke Skill %</label><input type="number" data-field="magic.sorcery.invokeSkill" value="${m.invokeSkill||0}" style="max-width:8rem;"></div>
    </div>
    <div class="form-group"><label class="form-label">Shaping Knacks</label>
      <div class="shaping-grid">${["duration","magnitude","range","targets","combine"].map(k => `
        <label class="shaping-item"><input type="checkbox" data-field="magic.sorcery.shaping.${k}" ${m.shaping?.[k] ? 'checked' : ''}><span class="shaping-label">${k}</span></label>`).join("")}
      </div>
    </div>
    <div class="card-header" style="margin-top:var(--sp-4);"><span class="card-title">Grimoires / Spells</span><button class="btn btn-ghost btn-sm" onclick="window._addSorcSpell()">+ Add Spell</button></div>
    ${(m.spells||[]).map((s,i) => `<div class="spell-row"><span class="spell-name">${s.name}</span><span class="spell-mag">${s.grimoire||''}</span><button class="btn-icon" onclick="window._editSorcSpell(${i})">✎</button></div>`).join("") || '<div style="padding:var(--sp-3);color:var(--text-dim);font-size:var(--text-sm);">No spells</div>'}
  </div></div>`;
}

function renderAnimism(m) {
  return `<div class="card"><div class="card-header"><span class="card-title">Animism</span></div><div class="card-body">
    <div class="two-col">
      <div class="form-group"><label class="form-label">Practice Skill %</label><input type="number" data-field="magic.animism.practiceSkill" value="${m.practiceSkill||0}" style="max-width:8rem;"></div>
      <div class="form-group"><label class="form-label">Fetch INT</label><input type="number" data-field="magic.animism.fetch.INT" value="${m.fetch?.INT||0}" style="max-width:8rem;"></div>
      <div class="form-group"><label class="form-label">Fetch POW</label><input type="number" data-field="magic.animism.fetch.POW" value="${m.fetch?.POW||0}" style="max-width:8rem;"></div>
    </div>
    <div class="card-header" style="margin-top:var(--sp-4);"><span class="card-title">Spirits</span><button class="btn btn-ghost btn-sm" onclick="window._addSpirit()">+ Add</button></div>
    ${(m.spirits||[]).map((s,i) => `<div class="weapon-row"><span class="weapon-name">${s.name}</span><span class="weapon-stat">POW ${s.POW||'?'}</span><button class="btn-icon" onclick="window._editSpirit(${i})">✎</button></div>`).join("") || '<div style="padding:var(--sp-3);color:var(--text-dim);font-size:var(--text-sm);">No spirits</div>'}
  </div></div>`;
}

function renderMysticism(m) {
  return `<div class="card"><div class="card-header"><span class="card-title">Mysticism</span></div><div class="card-body">
    <div class="form-group"><label class="form-label">Mysticism Skill %</label><input type="number" data-field="magic.mysticism.mysticismSkill" value="${m.mysticismSkill||0}" style="max-width:8rem;"></div>
    <div class="card-header" style="margin-top:var(--sp-4);"><span class="card-title">Abilities</span><button class="btn btn-ghost btn-sm" onclick="window._addMysticAbility()">+ Add</button></div>
    ${(m.abilities||[]).map((a,i) => `<div class="spell-row"><span class="spell-name">${a.name}</span><span class="spell-mag">${a.level||1}</span><button class="btn-icon" onclick="window._editMysticAbility(${i})">✎</button></div>`).join("") || '<div style="padding:var(--sp-3);color:var(--text-dim);font-size:var(--text-sm);">No abilities</div>'}
    <div class="card-header" style="margin-top:var(--sp-4);"><span class="card-title">Flaws</span><button class="btn btn-ghost btn-sm" onclick="window._addMysticFlaw()">+ Add</button></div>
    ${(m.flaws||[]).map((f,i) => `<div class="spell-row"><span class="spell-name">${f.name}</span><button class="btn-icon" onclick="window._editMysticFlaw(${i})">✎</button></div>`).join("") || '<div style="padding:var(--sp-3);color:var(--text-dim);font-size:var(--text-sm);">No flaws</div>'}
  </div></div>`;
}

// ── Equipment ─────────────────────────────────────────────────────────────────
function renderEquipment() {
  const list = document.getElementById("equipment-list");
  if (!list) return;
  if (!char.equipment.length) {
    list.innerHTML = '<div style="padding:var(--sp-4);color:var(--text-dim);font-size:var(--text-sm);">No items</div>';
    return;
  }
  list.innerHTML = `
    <div class="equipment-row" style="font-family:var(--font-display);font-size:var(--text-xs);letter-spacing:0.1em;text-transform:uppercase;color:var(--text-label);">
      <span>Item</span><span>Qty</span><span>ENC</span><span></span>
    </div>` +
    char.equipment.map((item, i) => `
    <div class="equipment-row">
      <span class="equipment-name">${item.name}</span>
      <span class="equipment-qty">${item.quantity || 1}</span>
      <span class="equipment-enc">${item.ENC || 0}</span>
      <button class="btn-icon" onclick="window._editEquipment(${i})">✎</button>
    </div>`).join("");
}

function renderCurrency() {
  document.querySelectorAll("[data-field^='currency']").forEach(el => {
    const val = deepGet(char, el.dataset.field);
    el.value = val ?? "";
  });
}

function renderNotes() {
  const el = document.querySelector("[data-field='notes']");
  if (el) el.value = char.notes || "";
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(title, bodyHTML, onSave, onDelete) {
  document.getElementById("item-modal-title").textContent = title;
  document.getElementById("item-modal-body").innerHTML = bodyHTML;
  document.getElementById("item-modal").classList.remove("hidden");
  const saveBtn   = document.getElementById("item-modal-save");
  const cancelBtn = document.getElementById("item-modal-cancel");
  const deleteBtn = document.getElementById("item-modal-delete");
  const close = () => document.getElementById("item-modal").classList.add("hidden");

  const newSave   = saveBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  const newDelete = deleteBtn.cloneNode(true);
  saveBtn.replaceWith(newSave); cancelBtn.replaceWith(newCancel); deleteBtn.replaceWith(newDelete);

  document.getElementById("item-modal-save").addEventListener("click",   () => { onSave(); close(); });
  document.getElementById("item-modal-cancel").addEventListener("click", close);
  document.getElementById("item-modal-delete").addEventListener("click", () => {
    if (onDelete) { onDelete(); close(); }
  });
  if (!onDelete) document.getElementById("item-modal-delete").classList.add("hidden");
  else document.getElementById("item-modal-delete").classList.remove("hidden");
}

function getModalInputs() {
  const inputs = {};
  document.querySelectorAll("#item-modal-body [data-modal-key]").forEach(el => {
    inputs[el.dataset.modalKey] = el.type === "checkbox" ? el.checked : (el.type === "number" ? (parseFloat(el.value) || 0) : el.value);
  });
  return inputs;
}

function fld(key, label, val, type="text", extra="") {
  return `<div class="form-group"><label class="form-label">${label}</label>
    <input type="${type}" data-modal-key="${key}" value="${val ?? ''}" ${extra}></div>`;
}

// ── Item edit windows ─────────────────────────────────────────────────────────
window._editProfSkill = function(i) {
  const ps = char.professionalSkills[i] || {};
  openModal("Edit Professional Skill",
    fld("name","Skill Name",ps.name) + fld("specialization","Specialization",ps.specialization) +
    fld("base","Base Formula",ps.base,"text","placeholder='DEX+INT'") + fld("bonus","Bonus Points",ps.bonus,"number"),
    () => { const v = getModalInputs(); char.professionalSkills[i] = {...ps,...v}; markDirty(); renderProfSkills(); },
    () => { char.professionalSkills.splice(i,1); markDirty(); renderProfSkills(); }
  );
};

document.getElementById("add-prof-skill").addEventListener("click", () => {
  char.professionalSkills.push({ name:"New Skill", specialization:"", base:"INT*2", bonus:0 });
  markDirty(); renderProfSkills();
  window._editProfSkill(char.professionalSkills.length - 1);
});

window._editPassion = function(i) {
  const p = char.passions[i] || {};
  openModal("Edit Passion",
    fld("type","Type (Love/Loyalty/Hate…)",p.type) + fld("subject","Subject",p.subject) + fld("value","Value %",p.value,"number"),
    () => { const v = getModalInputs(); char.passions[i] = {...p,...v}; markDirty(); renderPassions(); },
    () => { char.passions.splice(i,1); markDirty(); renderPassions(); }
  );
};

document.getElementById("add-passion").addEventListener("click", () => {
  char.passions.push({ type:"Love", subject:"", value:60 });
  markDirty(); renderPassions();
  window._editPassion(char.passions.length - 1);
});

window._editCombatStyle = function(i) {
  const cs = char.combatStyles[i] || {};
  openModal("Edit Combat Style",
    fld("name","Style Name",cs.name) + fld("weapons","Weapons (comma-separated)",cs.weapons?.join(", ")) +
    fld("bonus","Bonus Points",cs.bonus,"number") + fld("specialEffect","Special Effect / Trait",cs.specialEffect),
    () => { const v = getModalInputs(); char.combatStyles[i] = {...cs,...v, weapons: v.weapons.split(",").map(w=>w.trim()).filter(Boolean)}; markDirty(); renderCombatStyles(); },
    () => { char.combatStyles.splice(i,1); markDirty(); renderCombatStyles(); }
  );
};

document.getElementById("add-combat-style").addEventListener("click", () => {
  char.combatStyles.push({ name:"New Style", weapons:[], bonus:0, specialEffect:"" });
  markDirty(); renderCombatStyles();
  window._editCombatStyle(char.combatStyles.length - 1);
});

window._editWeapon = function(i) {
  const w = char.weapons[i] || {};
  openModal("Edit Weapon",
    fld("name","Weapon Name",w.name) + fld("damage","Damage Dice",w.damage) +
    fld("reach","Reach (T/S/M/L/VL)",w.reach) + fld("size","Size (S/M/L/H/E)",w.size) +
    fld("AP","Armor Points",w.AP,"number") + fld("HP","Hit Points",w.HP,"number") + fld("ENC","ENC",w.ENC,"number","step=0.5") +
    fld("traits","Traits (comma-separated)", w.traits?.join(", ")),
    () => { const v = getModalInputs(); char.weapons[i] = {...w,...v, traits:v.traits.split(",").map(t=>t.trim()).filter(Boolean)}; markDirty(); renderWeapons(); updateFooter(); },
    () => { char.weapons.splice(i,1); markDirty(); renderWeapons(); updateFooter(); }
  );
};

document.getElementById("add-weapon").addEventListener("click", () => {
  char.weapons.push({ name:"New Weapon", damage:"1d6", reach:"M", size:"M", AP:4, HP:6, ENC:1, traits:[] });
  markDirty(); renderWeapons();
  window._editWeapon(char.weapons.length - 1);
});

window._editArmor = function(i) {
  const a = char.armor[i] || {};
  openModal("Edit Armor",
    fld("name","Armor Name",a.name) + fld("AP","Armor Points",a.AP,"number") + fld("ENC","ENC",a.ENC,"number","step=0.5") +
    fld("locations","Locations (comma-separated)", a.locations?.join(", ")),
    () => { const v = getModalInputs(); char.armor[i] = {...a,...v, locations:v.locations.split(",").map(l=>l.trim()).filter(Boolean)}; markDirty(); renderArmor(); recalcArmorAP(); updateFooter(); },
    () => { char.armor.splice(i,1); markDirty(); renderArmor(); recalcArmorAP(); updateFooter(); }
  );
};

document.getElementById("add-armor").addEventListener("click", () => {
  char.armor.push({ name:"New Armor", AP:2, ENC:2, locations:[] });
  markDirty(); renderArmor();
  window._editArmor(char.armor.length - 1);
});

window._editEquipment = function(i) {
  const item = char.equipment[i] || {};
  openModal("Edit Equipment",
    fld("name","Item Name",item.name) + fld("quantity","Quantity",item.quantity||1,"number") + fld("ENC","ENC",item.ENC||0,"number","step=0.5") +
    fld("notes","Notes",item.notes),
    () => { const v = getModalInputs(); char.equipment[i] = {...item,...v}; markDirty(); renderEquipment(); updateFooter(); },
    () => { char.equipment.splice(i,1); markDirty(); renderEquipment(); updateFooter(); }
  );
};

document.getElementById("add-equipment").addEventListener("click", () => {
  char.equipment.push({ name:"New Item", quantity:1, ENC:0, notes:"" });
  markDirty(); renderEquipment();
  window._editEquipment(char.equipment.length - 1);
});

// Magic item editors
window._addFolkSpell = () => { char.magic.folkMagic.spells.push({ name:"New Spell", magnitude:1 }); markDirty(); window._editFolkSpell(char.magic.folkMagic.spells.length-1); };
window._editFolkSpell = function(i) {
  const s = char.magic.folkMagic.spells[i];
  openModal("Edit Folk Magic Spell", fld("name","Spell Name",s.name) + fld("magnitude","Magnitude",s.magnitude,"number") + fld("notes","Notes",s.notes),
    () => { Object.assign(char.magic.folkMagic.spells[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.folkMagic.spells.splice(i,1); markDirty(); renderMagic(); }
  );
};

window._addMiracle = () => { char.magic.theism.miracles.push({ name:"New Miracle", intensity:1 }); markDirty(); window._editMiracle(char.magic.theism.miracles.length-1); };
window._editMiracle = function(i) {
  const m = char.magic.theism.miracles[i];
  openModal("Edit Miracle", fld("name","Miracle Name",m.name) + fld("intensity","Intensity",m.intensity||1,"number"),
    () => { Object.assign(char.magic.theism.miracles[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.theism.miracles.splice(i,1); markDirty(); renderMagic(); }
  );
};

window._addSorcSpell = () => { char.magic.sorcery.spells.push({ name:"New Spell", grimoire:"" }); markDirty(); window._editSorcSpell(char.magic.sorcery.spells.length-1); };
window._editSorcSpell = function(i) {
  const s = char.magic.sorcery.spells[i];
  openModal("Edit Sorcery Spell", fld("name","Spell Name",s.name) + fld("grimoire","Grimoire",s.grimoire) + fld("notes","Notes",s.notes),
    () => { Object.assign(char.magic.sorcery.spells[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.sorcery.spells.splice(i,1); markDirty(); renderMagic(); }
  );
};

window._addSpirit = () => { char.magic.animism.spirits.push({ name:"New Spirit", POW:10 }); markDirty(); window._editSpirit(char.magic.animism.spirits.length-1); };
window._editSpirit = function(i) {
  const s = char.magic.animism.spirits[i];
  openModal("Edit Spirit", fld("name","Spirit Name",s.name) + fld("POW","POW",s.POW,"number"),
    () => { Object.assign(char.magic.animism.spirits[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.animism.spirits.splice(i,1); markDirty(); renderMagic(); }
  );
};

window._addMysticAbility = () => { char.magic.mysticism.abilities.push({ name:"New Ability", level:1 }); markDirty(); window._editMysticAbility(char.magic.mysticism.abilities.length-1); };
window._editMysticAbility = function(i) {
  const a = char.magic.mysticism.abilities[i];
  openModal("Edit Mystic Ability", fld("name","Ability Name",a.name) + fld("level","Level",a.level||1,"number"),
    () => { Object.assign(char.magic.mysticism.abilities[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.mysticism.abilities.splice(i,1); markDirty(); renderMagic(); }
  );
};

window._addMysticFlaw = () => { char.magic.mysticism.flaws.push({ name:"New Flaw" }); markDirty(); window._editMysticFlaw(char.magic.mysticism.flaws.length-1); };
window._editMysticFlaw = function(i) {
  const f = char.magic.mysticism.flaws[i];
  openModal("Edit Mystic Flaw", fld("name","Flaw Name",f.name),
    () => { Object.assign(char.magic.mysticism.flaws[i], getModalInputs()); markDirty(); renderMagic(); },
    () => { char.magic.mysticism.flaws.splice(i,1); markDirty(); renderMagic(); }
  );
};

// ── Action Buttons ─────────────────────────────────────────────────────────
function bindActionButtons() {
  // Close modal on backdrop click
  document.getElementById("item-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("item-modal")) document.getElementById("item-modal").classList.add("hidden");
  });
}
