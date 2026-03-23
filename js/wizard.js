// wizard.js — Character creation wizard

import { getAllSpecies, getAllCultures, getAllCareers } from "./data/loader.js";
import * as M from "./mythras.js";
import { Storage } from "./storage.js";

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  step: 1,
  totalSteps: 6,
  species:  null,
  culture:  null,
  career:   null,
  chosenProfSkills: [],
  charMode: "roll", // "roll" | "buy"
  characteristics: { STR:10, CON:10, SIZ:13, DEX:10, INT:13, POW:10, CHA:10 },
  skillBonuses: {}, // { skillKey: { culture:n, career:n, free:n } }
  careerPoints: 60,
  freePoints: 100,
  identity: { name:"", age:"", gender:"", background:"" },
};

const STEPS = [
  { label:"Species" }, { label:"Culture" }, { label:"Career" },
  { label:"Stats" }, { label:"Skills" }, { label:"Review" },
];

const CHARS = ["STR","CON","SIZ","DEX","INT","POW","CHA"];
const BUY_POOL = 80;

// ── Boot ───────────────────────────────────────────────────────────────────
renderProgress();
renderStep();
document.getElementById("back-btn").addEventListener("click", back);
document.getElementById("next-btn").addEventListener("click", next);

// ── Navigation ─────────────────────────────────────────────────────────────
function next() {
  if (!validateStep()) return;
  if (state.step === state.totalSteps) { createCharacter(); return; }
  if (state.step === 3) prepSkillState(); // after career chosen
  state.step++;
  renderProgress();
  renderStep();
  window.scrollTo(0, 0);
}

function back() {
  if (state.step === 1) { location.href = "index.html"; return; }
  state.step--;
  renderProgress();
  renderStep();
  window.scrollTo(0, 0);
}

function validateStep() {
  if (state.step === 1 && !state.species) { alert("Please select a species."); return false; }
  if (state.step === 2 && !state.culture) { alert("Please select a culture."); return false; }
  if (state.step === 3 && !state.career)  { alert("Please select a career."); return false; }
  if (state.step === 4) {
    for (const c of CHARS) {
      if (!state.characteristics[c] || state.characteristics[c] < 1) { alert("All characteristics must be at least 1."); return false; }
    }
    if (state.charMode === "buy") {
      const used = CHARS.reduce((s,c) => s + (state.characteristics[c] || 0), 0);
      const base = getSpeciesMinima();
      const baseTot = Object.values(base).reduce((s,v) => s+v, 0);
      if (used - baseTot > BUY_POOL + 1) { alert("You have spent more points than available."); return false; }
    }
  }
  if (state.step === 6 && !state.identity.name.trim()) { alert("Please enter a character name."); return false; }
  return true;
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function renderProgress() {
  document.getElementById("wizard-steps").innerHTML = STEPS.map((s, i) => {
    const n = i + 1;
    const cls = n < state.step ? "done" : n === state.step ? "active" : "";
    return `<div class="wizard-step-item ${cls}">
      <div class="wizard-step-num">${n < state.step ? "✓" : n}</div>
      <div class="wizard-step-label">${s.label}</div>
    </div>`;
  }).join("");

  const backBtn = document.getElementById("back-btn");
  const nextBtn = document.getElementById("next-btn");
  backBtn.textContent = state.step === 1 ? "✕ Cancel" : "← Back";
  nextBtn.textContent = state.step === state.totalSteps ? "✦ Create Character" : "Next →";
}

// ── Step Router ────────────────────────────────────────────────────────────
function renderStep() {
  const el = document.getElementById("step-content");
  switch (state.step) {
    case 1: el.innerHTML = renderSpeciesStep();  break;
    case 2: el.innerHTML = renderCultureStep();  break;
    case 3: el.innerHTML = renderCareerStep();   break;
    case 4: el.innerHTML = renderCharsStep();    bindCharsStep();   break;
    case 5: el.innerHTML = renderSkillsStep();   bindSkillsStep();  break;
    case 6: el.innerHTML = renderReviewStep();   bindReviewStep();  break;
  }
}

// ── Step 1: Species ────────────────────────────────────────────────────────
function renderSpeciesStep() {
  const species = getAllSpecies();
  return `
    <h2 class="wizard-title">Choose Your Species</h2>
    <p class="wizard-subtitle">Select the species that defines your character's natural abilities and characteristics.</p>
    <div class="selection-cards">
      ${species.map(sp => `
        <div class="selection-card ${state.species === sp.id ? 'selected' : ''}"
             onclick="window._selectSpecies('${sp.id}')">
          ${sp.source === 'homebrew' ? '<span class="badge badge-gold" style="position:absolute;top:var(--sp-2);right:var(--sp-2);">Homebrew</span>' : ''}
          <div class="selection-card-name">${sp.name}</div>
          <div class="selection-card-desc">${sp.description}</div>
          ${sp.traits.length ? `<div style="margin-top:var(--sp-2);font-size:var(--text-xs);color:var(--text-label);">${sp.traits.join(" · ")}</div>` : ""}
          <div class="selection-card-stats">
            ${CHARS.map(c => `<span class="stat-chip">${c} ${sp.characteristics[c].dice}d${sp.characteristics[c].sides}${sp.characteristics[c].bonus > 0 ? "+"+sp.characteristics[c].bonus : sp.characteristics[c].bonus < 0 ? sp.characteristics[c].bonus : ""}</span>`).join("")}
          </div>
        </div>`).join("")}
    </div>`;
}

window._selectSpecies = function(id) {
  state.species = id;
  // Reset characteristics to species averages
  const sp = getAllSpecies().find(s => s.id === id);
  if (sp) {
    CHARS.forEach(c => {
      const ch = sp.characteristics[c];
      state.characteristics[c] = Math.floor(ch.dice * (ch.sides + 1) / 2) + (ch.bonus || 0);
    });
  }
  document.querySelectorAll(".selection-card").forEach(el => el.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
};

// ── Step 2: Culture ────────────────────────────────────────────────────────
function renderCultureStep() {
  const cultures = getAllCultures();
  return `
    <h2 class="wizard-title">Choose Your Culture</h2>
    <p class="wizard-subtitle">Your upbringing shapes your foundational skills and world view.</p>
    <div class="selection-cards">
      ${cultures.map(cu => `
        <div class="selection-card ${state.culture === cu.id ? 'selected' : ''}"
             onclick="window._selectCulture('${cu.id}')">
          ${cu.source === 'homebrew' ? '<span class="badge badge-gold" style="position:absolute;top:var(--sp-2);right:var(--sp-2);">Homebrew</span>' : ''}
          <div class="selection-card-name">${cu.name}</div>
          <div class="selection-card-desc">${cu.description}</div>
          <div class="selection-card-stats">
            ${Object.entries(cu.standardSkillBonuses || {}).map(([k,v]) => `<span class="stat-chip">${M.STANDARD_SKILL_NAMES[k] || k} +${v}</span>`).join("")}
          </div>
          ${cu.combatStyle ? `<div style="margin-top:var(--sp-2);font-size:var(--text-xs);color:var(--blue-bright);">⚔ ${cu.combatStyle.name}</div>` : ""}
        </div>`).join("")}
    </div>`;
}

window._selectCulture = function(id) {
  state.culture = id;
  document.querySelectorAll(".selection-card").forEach(el => el.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
};

// ── Step 3: Career ─────────────────────────────────────────────────────────
function renderCareerStep() {
  const careers = getAllCareers();
  return `
    <h2 class="wizard-title">Choose Your Career</h2>
    <p class="wizard-subtitle">Your profession determines your specialist skills and starting equipment.</p>
    <div class="selection-cards" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      ${careers.map(ca => `
        <div class="selection-card ${state.career === ca.id ? 'selected' : ''}"
             onclick="window._selectCareer('${ca.id}')">
          ${ca.source === 'homebrew' ? '<span class="badge badge-gold" style="position:absolute;top:var(--sp-2);right:var(--sp-2);">Homebrew</span>' : ''}
          <div class="selection-card-name">${ca.name}</div>
          <div class="selection-card-desc">${ca.description}</div>
          <div class="selection-card-stats">
            ${ca.professionalSkills.map(ps => `<span class="stat-chip">${ps.name}</span>`).join("")}
          </div>
          ${ca.startingEquipment?.length ? `<div style="margin-top:var(--sp-2);font-size:var(--text-xs);color:var(--text-dim);">${ca.startingEquipment.slice(0,3).join(" · ")}${ca.startingEquipment.length > 3 ? "…" : ""}</div>` : ""}
        </div>`).join("")}
    </div>`;
}

window._selectCareer = function(id) {
  state.career = id;
  document.querySelectorAll(".selection-card").forEach(el => el.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
};

// ── Step 4: Characteristics ────────────────────────────────────────────────
function getSpeciesMinima() {
  const sp = getAllSpecies().find(s => s.id === state.species);
  if (!sp) return Object.fromEntries(CHARS.map(c => [c, 1]));
  return Object.fromEntries(CHARS.map(c => [c, sp.characteristics[c].bonus + sp.characteristics[c].dice]));
}

function rollStat(dice, sides, bonus) {
  let t = bonus || 0;
  for (let i = 0; i < dice; i++) t += Math.floor(Math.random() * sides) + 1;
  return t;
}

function renderCharsStep() {
  const sp = getAllSpecies().find(s => s.id === state.species);
  const chs = sp ? sp.characteristics : {};
  const chars = state.characteristics;

  // Point buy remaining
  const minima = getSpeciesMinima();
  const spent  = CHARS.reduce((s, c) => s + Math.max(0, (chars[c]||0) - (minima[c]||0)), 0);
  const rem    = BUY_POOL - spent;

  return `
    <h2 class="wizard-title">Characteristics</h2>
    <p class="wizard-subtitle">Set your character's base abilities. Roll the dice or allocate points.</p>

    <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);">
      <button class="magic-system-btn ${state.charMode==='roll'?'active':''}" onclick="window._setCharMode('roll')">🎲 Roll Dice</button>
      <button class="magic-system-btn ${state.charMode==='buy'?'active':''}"  onclick="window._setCharMode('buy')">📊 Point Buy (${BUY_POOL} pts)</button>
    </div>

    ${state.charMode === 'buy' ? `
      <div class="points-bar" style="position:relative;top:0;margin-bottom:var(--sp-4);border-radius:var(--radius);">
        <span>Points Remaining</span>
        <span class="points-remaining ${rem < 0 ? 'over' : rem === 0 ? 'zero' : 'low'}" id="buy-rem">${rem}</span>
      </div>` : `
      <div style="margin-bottom:var(--sp-4);">
        <button class="btn btn-secondary" onclick="window._rollAll()">🎲 Roll All</button>
      </div>`}

    <div class="char-roll-grid" id="char-roll-grid">
      ${CHARS.map(c => {
        const ch = chs[c] || { dice:3, sides:6, bonus:0 };
        const formula = `${ch.dice}d${ch.sides}${ch.bonus > 0 ? "+"+ch.bonus : ch.bonus < 0 ? ch.bonus : ""}`;
        return `
        <div class="char-roll-block">
          <span class="char-roll-label">${c}</span>
          <span class="char-roll-formula">${formula}</span>
          <div class="char-roll-val">
            <input type="number" id="char-inp-${c}" value="${chars[c] || ''}" min="1" max="99"
              oninput="window._updateChar('${c}', this.value)">
          </div>
          ${state.charMode === 'roll' ? `<button class="char-reroll-btn" onclick="window._rerollStat('${c}')">Roll</button>` : ""}
        </div>`;
      }).join("")}
    </div>

    <div style="margin-top:var(--sp-6);padding:var(--sp-4);background:var(--bg-section);border-radius:var(--radius);border:1px solid var(--border-light);">
      <div class="review-section-title">Preview</div>
      <div id="chars-preview" style="display:flex;flex-wrap:wrap;gap:var(--sp-4);"></div>
    </div>`;
}

function bindCharsStep() { updateCharsPreview(); }

window._setCharMode = function(mode) {
  state.charMode = mode;
  document.getElementById("step-content").innerHTML = renderCharsStep();
  bindCharsStep();
};

window._rollAll = function() {
  const sp = getAllSpecies().find(s => s.id === state.species);
  if (!sp) return;
  CHARS.forEach(c => {
    const ch = sp.characteristics[c];
    state.characteristics[c] = rollStat(ch.dice, ch.sides, ch.bonus || 0);
    const inp = document.getElementById(`char-inp-${c}`);
    if (inp) inp.value = state.characteristics[c];
  });
  updateCharsPreview();
};

window._rerollStat = function(c) {
  const sp = getAllSpecies().find(s => s.id === state.species);
  if (!sp) return;
  const ch = sp.characteristics[c];
  state.characteristics[c] = rollStat(ch.dice, ch.sides, ch.bonus || 0);
  const inp = document.getElementById(`char-inp-${c}`);
  if (inp) inp.value = state.characteristics[c];
  updateCharsPreview();
};

window._updateChar = function(c, val) {
  state.characteristics[c] = parseInt(val) || 0;
  if (state.charMode === 'buy') {
    const minima = getSpeciesMinima();
    const spent  = CHARS.reduce((s, ch) => s + Math.max(0, (state.characteristics[ch]||0) - (minima[ch]||0)), 0);
    const rem    = BUY_POOL - spent;
    const remEl  = document.getElementById("buy-rem");
    if (remEl) { remEl.textContent = rem; remEl.className = `points-remaining ${rem < 0 ? 'over' : rem === 0 ? 'zero' : 'low'}`; }
  }
  updateCharsPreview();
};

function updateCharsPreview() {
  const el = document.getElementById("chars-preview");
  if (!el) return;
  const chars = Object.fromEntries(CHARS.map(c => [c, { base: state.characteristics[c] || 0, modifier: 0 }]));
  el.innerHTML = [
    ["Action Points", M.calcActionPoints(chars)],
    ["Damage Mod", M.calcDamageModifier(chars)],
    ["Hit Points", M.calcTotalHP(chars)],
    ["Magic Points", M.calcMagicPoints(chars)],
    ["Luck Points", M.calcLuckPoints(chars)],
    ["Initiative", "+" + M.calcInitiativeBonus(chars)],
  ].map(([k,v]) => `<div style="min-width:140px;"><span style="font-family:var(--font-display);font-size:var(--text-xs);letter-spacing:0.1em;text-transform:uppercase;color:var(--text-label);">${k}</span><div style="font-family:var(--font-mono);color:var(--gold);font-size:var(--text-lg);">${v}</div></div>`).join("");
}

// ── Step 5: Skills ─────────────────────────────────────────────────────────
function prepSkillState() {
  const culture = getAllCultures().find(c => c.id === state.culture);
  const career  = getAllCareers().find(c => c.id === state.career);
  state.careerPoints = career?.careerSkillPoints || 60;

  // Init skill bonus tracking
  const allKeys = [...Object.keys(M.STANDARD_SKILL_NAMES), ...(career?.professionalSkills || []).map(ps => "prof_" + ps.name)];
  state.skillBonuses = {};
  allKeys.forEach(k => {
    state.skillBonuses[k] = { culture: 0, career: 0, free: 0 };
  });

  // Apply culture bonuses (automatic)
  if (culture?.standardSkillBonuses) {
    Object.entries(culture.standardSkillBonuses).forEach(([k, v]) => {
      if (!state.skillBonuses[k]) state.skillBonuses[k] = { culture:0, career:0, free:0 };
      state.skillBonuses[k].culture = v;
    });
  }

  // Apply career starting bonuses
  if (career?.professionalSkills) {
    career.professionalSkills.forEach(ps => {
      const k = "prof_" + ps.name;
      if (!state.skillBonuses[k]) state.skillBonuses[k] = { culture:0, career:0, free:0 };
      state.skillBonuses[k].career = ps.startingBonus || 0;
    });
  }
}

function usedCareerPoints() {
  return Object.values(state.skillBonuses).reduce((s, b) => s + (b.career - (initialCareerBonus(b) || 0)), 0);
}
function initialCareerBonus(b) { return 0; } // user-added on top of starting bonus
function usedFreePoints() {
  return Object.values(state.skillBonuses).reduce((s, b) => s + (b.free || 0), 0);
}

function renderSkillsStep() {
  const career = getAllCareers().find(c => c.id === state.career);
  const chars  = Object.fromEntries(CHARS.map(c => [c, { base: state.characteristics[c] || 0, modifier: 0 }]));

  const careerSpent = Object.values(state.skillBonuses).reduce((s,b) => s + (b.career||0), 0);
  const freeSpent   = Object.values(state.skillBonuses).reduce((s,b) => s + (b.free||0), 0);
  const careerRem   = state.careerPoints - careerSpent;
  const freeRem     = state.freePoints   - freeSpent;

  const stdSkillsHTML = Object.entries(M.STANDARD_SKILL_NAMES).map(([key, label]) => {
    const base     = M.STANDARD_SKILL_BASES[key](chars);
    const cult     = state.skillBonuses[key]?.culture || 0;
    const careerB  = state.skillBonuses[key]?.career  || 0;
    const free     = state.skillBonuses[key]?.free    || 0;
    const eff      = M.effectiveSkillPct(base + cult, careerB + free);
    return `
    <div class="skill-alloc-row">
      <span class="skill-alloc-name">${label}</span>
      <span class="skill-alloc-base">${base}</span>
      <span class="skill-alloc-fixed" title="Culture bonus">${cult > 0 ? '+'+cult : ''}</span>
      <input class="skill-alloc-input skill-bonus-input" type="number" min="0" max="100" value="${free}"
        data-skill="${key}" data-pool="free" oninput="window._allocSkill('${key}','free',this.value)">
      <span class="skill-alloc-total">${eff}%</span>
    </div>`;
  }).join("");

  const profSkillsHTML = (career?.professionalSkills || []).map((ps, i) => {
    const key  = "prof_" + ps.name;
    const base = M.evalSkillBase(ps.base, chars);
    const careerB = state.skillBonuses[key]?.career || ps.startingBonus || 0;
    const free    = state.skillBonuses[key]?.free   || 0;
    const eff     = M.effectiveSkillPct(base + careerB, free);
    return `
    <div class="skill-alloc-row">
      <span class="skill-alloc-name">${ps.name}</span>
      <span class="skill-alloc-base">${base}</span>
      <span class="skill-alloc-fixed" title="Career starting bonus">+${careerB}</span>
      <input class="skill-alloc-input skill-bonus-input" type="number" min="0" max="100" value="${free}"
        data-skill="${key}" data-pool="free" oninput="window._allocSkill('${key}','free',this.value)">
      <span class="skill-alloc-total">${eff}%</span>
    </div>`;
  }).join("");

  return `
    <h2 class="wizard-title">Allocate Skill Points</h2>
    <p class="wizard-subtitle">Distribute your free points across any skills. Career bonuses are already applied.</p>

    <div style="display:flex;gap:var(--sp-6);margin-bottom:var(--sp-4);flex-wrap:wrap;">
      <div>
        <span style="font-family:var(--font-display);font-size:var(--text-xs);letter-spacing:0.1em;text-transform:uppercase;color:var(--text-label);">Free Points Remaining</span>
        <div class="points-remaining ${freeRem < 0 ? 'over' : freeRem === 0 ? 'zero' : 'low'}" id="free-rem">${freeRem}</div>
      </div>
    </div>

    <div class="skills-columns">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Standard Skills</span>
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-dim);">Base · Culture · Free · Total</span>
        </div>
        ${stdSkillsHTML}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Professional Skills (${career?.name || '—'})</span>
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-dim);">Base · Career · Free · Total</span>
        </div>
        ${profSkillsHTML || '<div style="padding:var(--sp-4);color:var(--text-dim);">No professional skills</div>'}
      </div>
    </div>`;
}

function bindSkillsStep() {}

window._allocSkill = function(key, pool, val) {
  if (!state.skillBonuses[key]) state.skillBonuses[key] = { culture:0, career:0, free:0 };
  state.skillBonuses[key][pool] = Math.max(0, parseInt(val) || 0);

  const freeSpent = Object.values(state.skillBonuses).reduce((s,b) => s + (b.free||0), 0);
  const freeRem   = state.freePoints - freeSpent;
  const remEl = document.getElementById("free-rem");
  if (remEl) { remEl.textContent = freeRem; remEl.className = `points-remaining ${freeRem < 0 ? 'over' : freeRem === 0 ? 'zero' : 'low'}`; }
};

// ── Step 6: Review ─────────────────────────────────────────────────────────
function renderReviewStep() {
  const sp  = getAllSpecies().find(s => s.id === state.species);
  const cu  = getAllCultures().find(c => c.id === state.culture);
  const ca  = getAllCareers().find(c => c.id === state.career);
  const chars = Object.fromEntries(CHARS.map(c => [c, { base: state.characteristics[c] || 0, modifier: 0 }]));

  const charRows = CHARS.map(c => `<div class="review-row"><span class="review-key">${c}</span><span class="review-val">${state.characteristics[c]}</span></div>`).join("");
  const derivedRows = [
    ["Action Points", M.calcActionPoints(chars)],
    ["Damage Mod", M.calcDamageModifier(chars)],
    ["Hit Points", M.calcTotalHP(chars)],
    ["Magic Points", M.calcMagicPoints(chars)],
    ["Luck Points", M.calcLuckPoints(chars)],
    ["Initiative", "+" + M.calcInitiativeBonus(chars)],
  ].map(([k,v]) => `<div class="review-row"><span class="review-key">${k}</span><span class="review-val">${v}</span></div>`).join("");

  return `
    <h2 class="wizard-title">Review & Name Your Character</h2>
    <p class="wizard-subtitle">Almost ready. Give your character a name and review your choices.</p>

    <div class="card" style="margin-bottom:var(--sp-4);">
      <div class="card-body">
        <div class="two-col">
          <div class="form-group">
            <label class="form-label">Character Name *</label>
            <input type="text" id="review-name" value="${state.identity.name}" placeholder="Enter name…" style="font-size:var(--text-xl);font-family:var(--font-display);"
              oninput="state.identity.name=this.value">
          </div>
          <div class="form-group">
            <label class="form-label">Age</label>
            <input type="number" id="review-age" value="${state.identity.age}" min="0"
              oninput="state.identity.age=this.value">
          </div>
          <div class="form-group">
            <label class="form-label">Gender / Pronouns</label>
            <input type="text" id="review-gender" value="${state.identity.gender}"
              oninput="state.identity.gender=this.value">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Background</label>
          <textarea id="review-bg" rows="3" oninput="state.identity.background=this.value">${state.identity.background}</textarea>
        </div>
      </div>
    </div>

    <div class="review-grid">
      <div class="card"><div class="card-body">
        <div class="review-section-title">Identity</div>
        <div class="review-row"><span class="review-key">Species</span><span class="review-val">${sp?.name || '—'}</span></div>
        <div class="review-row"><span class="review-key">Culture</span><span class="review-val">${cu?.name || '—'}</span></div>
        <div class="review-row"><span class="review-key">Career</span><span class="review-val">${ca?.name || '—'}</span></div>
      </div></div>

      <div class="card"><div class="card-body">
        <div class="review-section-title">Derived Attributes</div>
        ${derivedRows}
      </div></div>

      <div class="card"><div class="card-body">
        <div class="review-section-title">Characteristics</div>
        ${charRows}
      </div></div>

      <div class="card"><div class="card-body">
        <div class="review-section-title">Top Skills</div>
        ${topSkillsHTML(chars, ca)}
      </div></div>
    </div>`;
}

function topSkillsHTML(chars, career) {
  const skills = [];
  Object.entries(M.STANDARD_SKILL_NAMES).forEach(([key, label]) => {
    const base  = M.STANDARD_SKILL_BASES[key](chars);
    const bonus = (state.skillBonuses[key]?.culture || 0) + (state.skillBonuses[key]?.career || 0) + (state.skillBonuses[key]?.free || 0);
    const eff   = M.effectiveSkillPct(base, bonus);
    skills.push({ label, eff });
  });
  (career?.professionalSkills || []).forEach(ps => {
    const key   = "prof_" + ps.name;
    const base  = M.evalSkillBase(ps.base, chars);
    const bonus = (state.skillBonuses[key]?.career || ps.startingBonus || 0) + (state.skillBonuses[key]?.free || 0);
    skills.push({ label: ps.name, eff: M.effectiveSkillPct(base, bonus) });
  });
  return skills.sort((a,b) => b.eff - a.eff).slice(0,8)
    .map(s => `<div class="review-row"><span class="review-key">${s.label}</span><span class="review-val">${s.eff}%</span></div>`).join("");
}

function bindReviewStep() {
  const inp = document.getElementById("review-name");
  if (inp) inp.focus();
}

// ── Build & Save Character ─────────────────────────────────────────────────
function createCharacter() {
  const sp  = getAllSpecies().find(s => s.id === state.species);
  const cu  = getAllCultures().find(c => c.id === state.culture);
  const ca  = getAllCareers().find(c => c.id === state.career);
  const id  = "ch_" + Math.random().toString(36).slice(2, 9);
  const now = new Date().toISOString();

  const chars = Object.fromEntries(CHARS.map(c => [c, { base: state.characteristics[c] || 10, modifier: 0 }]));
  const derived = M.computeAllDerived({ characteristics: chars, speciesData: sp, attributes: { modifiers: {} } });

  // Standard skill bonuses
  const stdSkills = Object.fromEntries(Object.keys(M.STANDARD_SKILL_NAMES).map(k => {
    const b = state.skillBonuses[k] || { culture:0, career:0, free:0 };
    return [k, { bonus: (b.culture||0) + (b.career||0) + (b.free||0) }];
  }));

  // Professional skills
  const profSkills = (ca?.professionalSkills || []).map(ps => {
    const key  = "prof_" + ps.name;
    const b    = state.skillBonuses[key] || { culture:0, career:0, free:0 };
    return {
      id: "ps_" + Math.random().toString(36).slice(2,7),
      name: ps.name, specialization: "", base: ps.base,
      bonus: (b.career||0) + (b.free||0),
      category: "other",
    };
  });

  // Hit locations
  const hitLocations = [
    { id:"hl_rleg", name:"Right Leg",  dieRange:[1,3],   armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_rleg"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_rleg"), wounds:[] },
    { id:"hl_lleg", name:"Left Leg",   dieRange:[4,6],   armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_lleg"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_lleg"), wounds:[] },
    { id:"hl_abdo", name:"Abdomen",    dieRange:[7,9],   armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_abdo"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_abdo"), wounds:[] },
    { id:"hl_ches", name:"Chest",      dieRange:[10,12], armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_ches"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_ches"), wounds:[] },
    { id:"hl_rarm", name:"Right Arm",  dieRange:[13,15], armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_rarm"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_rarm"), wounds:[] },
    { id:"hl_larm", name:"Left Arm",   dieRange:[16,18], armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_larm"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_larm"), wounds:[] },
    { id:"hl_head", name:"Head",       dieRange:[19,20], armorAP:0, baseHP: M.calcLocationHP(derived.hitPoints, "hl_head"), currentHP: M.calcLocationHP(derived.hitPoints, "hl_head"), wounds:[] },
  ];

  // Starting combat style from culture
  const combatStyles = [];
  if (cu?.combatStyle) {
    const base = (chars.STR.base + chars.DEX.base);
    combatStyles.push({
      id: "cs_1",
      name: cu.combatStyle.name,
      weapons: cu.combatStyle.weapons || [],
      bonus: cu.combatStyle.bonus || 10,
      specialEffect: "",
    });
  }

  // Magic systems
  const magic = {
    folkMagic: { active: false, spells: [] },
    animism:   { active: false, fetch:{INT:0,POW:0}, practiceSkill:0, spirits:[] },
    mysticism: { active: false, mysticismSkill:0, flaws:[], abilities:[] },
    sorcery:   { active: false, invokeSkill:0, shaping:{duration:false,magnitude:false,range:false,targets:false,combine:false}, grimoires:[], spells:[] },
    theism:    { active: false, worshipSkill:0, deity:"", piety:0, miracles:[] },
  };
  (ca?.suggestedMagicSystems || []).forEach(sys => { if (magic[sys]) magic[sys].active = true; });

  const character = {
    id, version: 1,
    meta: { createdAt: now, updatedAt: now },
    identity: {
      name: state.identity.name.trim(),
      species: sp?.name || "", culture: cu?.name || "", career: ca?.name || "",
      rank: "", age: parseInt(state.identity.age) || 0,
      gender: state.identity.gender || "", deity: "", cult: "",
      height:"", weight:"", hair:"", eyes:"", distinguishingMarks:"",
      background: state.identity.background || "",
    },
    speciesData: { movementRate: sp?.movementRate || 6 },
    characteristics: chars,
    attributes: { modifiers: { actionPoints:0, magicPoints:0, hitPoints:0, luckPoints:0, movementRate:0 } },
    standardSkills: stdSkills,
    professionalSkills: profSkills,
    passions: [],
    combatStyles,
    weapons: [],
    hitLocations,
    armor: [],
    magic,
    equipment: (ca?.startingEquipment || []).map((name, i) => ({ id:"eq_"+i, name, quantity:1, ENC:0, notes:"" })),
    currency: { gold:0, silver:0, copper:0, custom:"" },
    notes: "",
  };

  Storage.saveCharacter(character);
  location.href = `sheet.html?id=${id}`;
}
