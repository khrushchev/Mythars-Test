// homebrew.js — Homebrew editor logic

import {
  getAllSpecies, getAllCultures, getAllCareers,
  addHomebrew, updateHomebrew, deleteHomebrew,
  exportAllHomebrew, importHomebrew, generateHomebrewId,
} from "./data/loader.js";
import { DEFAULT_SPECIES  } from "./data/defaults/species.js";
import { DEFAULT_CULTURES } from "./data/defaults/cultures.js";
import { DEFAULT_CAREERS  } from "./data/defaults/careers.js";
import { STANDARD_SKILL_NAMES } from "./mythras.js";

const CHARS = ["STR","CON","SIZ","DEX","INT","POW","CHA"];
const BASE_FORMULAS = ["STR+DEX","CON*2","DEX*2","INT*2","POW*2","CHA*2",
  "STR+CON","STR+SIZ","DEX+INT","DEX+CHA","INT+POW","INT+CHA","POW+CHA",
  "POW+CON","CON+POW","STR+POW"];

let editingId = null;
// temp lists while modal is open
let spTraits = [];
let cuSkills = [];
let caStdSkills = [];
let caProfSkills = [];
let caEquipment = [];

// ── Tabs ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".homebrew-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".homebrew-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".hb-panel").forEach(p => { p.classList.add("hidden"); p.classList.remove("active"); });
    btn.classList.add("active");
    document.querySelector(`.hb-panel[data-tab="${btn.dataset.tab}"]`)?.classList.replace("hidden","active");
  });
});

// ── Render lists ──────────────────────────────────────────────────────────
function renderAll() {
  renderSpeciesList();
  renderCultureList();
  renderCareerList();
}

function renderSpeciesList() {
  const hbList   = document.getElementById("homebrew-species-list");
  const coreList = document.getElementById("core-species-list");

  const homebrew = getAllSpecies().filter(s => s.source === "homebrew");
  hbList.innerHTML = homebrew.length
    ? homebrew.map(sp => entryRow(sp, "species")).join("")
    : '<div class="empty-state" style="padding:var(--sp-8);"><div class="empty-state-text">No homebrew species yet</div></div>';

  coreList.innerHTML = DEFAULT_SPECIES.map(sp => coreRow(sp, "species")).join("");
}

function renderCultureList() {
  const hbList   = document.getElementById("homebrew-culture-list");
  const coreList = document.getElementById("core-culture-list");

  const homebrew = getAllCultures().filter(c => c.source === "homebrew");
  hbList.innerHTML = homebrew.length
    ? homebrew.map(cu => entryRow(cu, "cultures")).join("")
    : '<div class="empty-state" style="padding:var(--sp-8);"><div class="empty-state-text">No homebrew cultures yet</div></div>';

  coreList.innerHTML = DEFAULT_CULTURES.map(cu => coreRow(cu, "cultures")).join("");
}

function renderCareerList() {
  const hbList   = document.getElementById("homebrew-career-list");
  const coreList = document.getElementById("core-career-list");

  const homebrew = getAllCareers().filter(c => c.source === "homebrew");
  hbList.innerHTML = homebrew.length
    ? homebrew.map(ca => entryRow(ca, "careers")).join("")
    : '<div class="empty-state" style="padding:var(--sp-8);"><div class="empty-state-text">No homebrew careers yet</div></div>';

  coreList.innerHTML = DEFAULT_CAREERS.map(ca => coreRow(ca, "careers")).join("");
}

function entryRow(entry, type) {
  return `
  <div class="homebrew-entry-row">
    <div>
      <div class="homebrew-entry-name">${entry.name} <span class="badge badge-gold">Homebrew</span></div>
      <div class="homebrew-entry-desc">${entry.description || ""}</div>
    </div>
    <div class="homebrew-entry-actions">
      <button class="btn btn-secondary btn-sm" onclick="window._editEntry('${type}','${entry.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="window._deleteEntry('${type}','${entry.id}','${entry.name}')">Delete</button>
    </div>
  </div>`;
}

function coreRow(entry, type) {
  return `
  <div class="core-entry-row">
    <div>
      <span class="core-entry-name">${entry.name}</span>
      <span class="badge badge-dim" style="margin-left:var(--sp-2);">Core</span>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window._copyToHomebrew('${type}','${entry.id}')">Copy to Homebrew</button>
  </div>`;
}

// ── Delete ────────────────────────────────────────────────────────────────
window._deleteEntry = function(type, id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  deleteHomebrew(type, id);
  renderAll();
  toast(`Deleted "${name}"`);
};

// ── Copy core to homebrew ─────────────────────────────────────────────────
window._copyToHomebrew = function(type, id) {
  let entry;
  if (type === "species")  entry = DEFAULT_SPECIES.find(s => s.id === id);
  if (type === "cultures") entry = DEFAULT_CULTURES.find(c => c.id === id);
  if (type === "careers")  entry = DEFAULT_CAREERS.find(c => c.id === id);
  if (!entry) return;
  const copy = JSON.parse(JSON.stringify(entry));
  copy.id = generateHomebrewId(type.slice(0,-1));
  copy.name = entry.name + " (variant)";
  copy.source = "homebrew";
  addHomebrew(type, copy);
  renderAll();
  toast(`Copied "${entry.name}" to homebrew`);
  window._editEntry(type, copy.id);
};

// ── Edit dispatch ─────────────────────────────────────────────────────────
window._editEntry = function(type, id) {
  if (type === "species")  openSpeciesModal(id);
  if (type === "cultures") openCultureModal(id);
  if (type === "careers")  openCareerModal(id);
};

// ── SPECIES MODAL ─────────────────────────────────────────────────────────
function openSpeciesModal(id) {
  editingId = id || null;
  const sp = id ? getAllSpecies().find(s => s.id === id) : null;

  document.getElementById("species-modal-title").textContent = sp ? `Edit: ${sp.name}` : "New Species";
  document.getElementById("sp-name").value  = sp?.name  || "";
  document.getElementById("sp-desc").value  = sp?.description || "";
  document.getElementById("sp-move").value  = sp?.movementRate || 6;

  // Char dice inputs
  const grid = document.getElementById("sp-char-grid");
  grid.innerHTML = CHARS.map(c => {
    const ch = sp?.characteristics?.[c] || { dice:3, sides:6, bonus:0 };
    return `
    <div class="char-dice-input">
      <span class="char-dice-label">${c}</span>
      <input class="char-dice-field" type="text" id="sp-dice-${c}" value="${ch.dice}d${ch.sides}${ch.bonus > 0 ? "+"+ch.bonus : ch.bonus < 0 ? ch.bonus : ""}"
        placeholder="3d6" title="${c}: e.g. 3d6+2">
    </div>`;
  }).join("");

  spTraits = [...(sp?.traits || [])];
  renderTraitsList();

  const deleteBtn = document.getElementById("sp-delete");
  deleteBtn.style.display = sp?.source === "homebrew" ? "" : "none";

  document.getElementById("species-modal").classList.remove("hidden");
}

function renderTraitsList() {
  document.getElementById("sp-traits-list").innerHTML = spTraits.map((t,i) => `
    <div class="skill-row-input">
      <input type="text" value="${t}" oninput="spTraits[${i}]=this.value" style="font-size:var(--text-sm);">
      <button class="btn-icon" onclick="spTraits.splice(${i},1);renderTraitsList()">✕</button>
    </div>`).join("");
}
window.renderTraitsList = renderTraitsList;

window._addTrait = function() { spTraits.push(""); renderTraitsList(); };

function parseDiceExpr(str) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec((str || "3d6").replace(/\s/g,""));
  if (!m) return { dice:3, sides:6, bonus:0 };
  return { dice:parseInt(m[1])||1, sides:parseInt(m[2])||6, bonus:parseInt(m[3]||"0")||0 };
}

function saveSpecies() {
  const name = document.getElementById("sp-name").value.trim();
  if (!name) { alert("Name is required."); return; }

  const characteristics = {};
  for (const c of CHARS) {
    characteristics[c] = parseDiceExpr(document.getElementById(`sp-dice-${c}`)?.value || "3d6");
  }

  const entry = {
    id: editingId || generateHomebrewId("species"),
    name, source: "homebrew",
    description: document.getElementById("sp-desc").value.trim(),
    characteristics,
    movementRate: parseInt(document.getElementById("sp-move").value) || 6,
    traits: spTraits.filter(t => t.trim()),
  };

  updateHomebrew("species", entry);
  document.getElementById("species-modal").classList.add("hidden");
  renderAll();
  toast(`Saved "${entry.name}"`);
}

document.getElementById("add-species-btn").addEventListener("click", () => openSpeciesModal(null));
document.getElementById("sp-save").addEventListener("click", saveSpecies);
document.getElementById("sp-cancel").addEventListener("click", () => document.getElementById("species-modal").classList.add("hidden"));
document.getElementById("sp-delete").addEventListener("click", () => {
  if (!editingId) return;
  const sp = getAllSpecies().find(s => s.id === editingId);
  if (!confirm(`Delete "${sp?.name}"?`)) return;
  deleteHomebrew("species", editingId);
  document.getElementById("species-modal").classList.add("hidden");
  renderAll();
});

// ── CULTURE MODAL ─────────────────────────────────────────────────────────
function openCultureModal(id) {
  editingId = id || null;
  const cu = id ? getAllCultures().find(c => c.id === id) : null;

  document.getElementById("culture-modal-title").textContent = cu ? `Edit: ${cu.name}` : "New Culture";
  document.getElementById("cu-name").value  = cu?.name  || "";
  document.getElementById("cu-desc").value  = cu?.description || "";
  document.getElementById("cu-cs-name").value   = cu?.combatStyle?.name    || "";
  document.getElementById("cu-cs-bonus").value  = cu?.combatStyle?.bonus   || 10;
  document.getElementById("cu-cs-weapons").value= (cu?.combatStyle?.weapons || []).join(", ");
  document.getElementById("cu-prof-choices").value = (cu?.professionalSkillChoices || []).join(", ");
  document.getElementById("cu-prof-count").value   = cu?.professionalSkillChoiceCount || 2;

  cuSkills = Object.entries(cu?.standardSkillBonuses || {}).map(([k,v]) => ({ key:k, val:v }));
  renderCultureSkills();

  document.getElementById("cu-delete").style.display = cu?.source === "homebrew" ? "" : "none";
  document.getElementById("culture-modal").classList.remove("hidden");
}

function renderCultureSkills() {
  document.getElementById("cu-skill-list").innerHTML = cuSkills.map((s,i) => `
    <div class="skill-row-input">
      <select onchange="cuSkills[${i}].key=this.value" style="font-size:var(--text-sm);">
        ${Object.entries(STANDARD_SKILL_NAMES).map(([k,v]) =>
          `<option value="${k}" ${s.key===k?'selected':''}>${v}</option>`).join("")}
      </select>
      <input type="number" value="${s.val}" min="1" max="50" style="width:4rem;text-align:center;font-family:var(--font-mono);"
        oninput="cuSkills[${i}].val=parseInt(this.value)||0">
      <button class="btn-icon" onclick="cuSkills.splice(${i},1);renderCultureSkills()">✕</button>
    </div>`).join("");
}
window.renderCultureSkills = renderCultureSkills;

window._addCultureSkill = function() {
  cuSkills.push({ key:"athletics", val:5 });
  renderCultureSkills();
};

function saveCulture() {
  const name = document.getElementById("cu-name").value.trim();
  if (!name) { alert("Name is required."); return; }

  const standardSkillBonuses = {};
  cuSkills.forEach(s => { if (s.key) standardSkillBonuses[s.key] = s.val || 0; });

  const entry = {
    id: editingId || generateHomebrewId("culture"),
    name, source: "homebrew",
    description: document.getElementById("cu-desc").value.trim(),
    standardSkillBonuses,
    combatStyle: {
      name:    document.getElementById("cu-cs-name").value.trim(),
      bonus:   parseInt(document.getElementById("cu-cs-bonus").value) || 10,
      weapons: document.getElementById("cu-cs-weapons").value.split(",").map(w=>w.trim()).filter(Boolean),
    },
    professionalSkillChoices: document.getElementById("cu-prof-choices").value.split(",").map(s=>s.trim()).filter(Boolean),
    professionalSkillChoiceCount: parseInt(document.getElementById("cu-prof-count").value) || 2,
  };

  updateHomebrew("cultures", entry);
  document.getElementById("culture-modal").classList.add("hidden");
  renderAll();
  toast(`Saved "${entry.name}"`);
}

document.getElementById("add-culture-btn").addEventListener("click", () => openCultureModal(null));
document.getElementById("cu-save").addEventListener("click", saveCulture);
document.getElementById("cu-cancel").addEventListener("click", () => document.getElementById("culture-modal").classList.add("hidden"));
document.getElementById("cu-delete").addEventListener("click", () => {
  if (!editingId) return;
  const cu = getAllCultures().find(c => c.id === editingId);
  if (!confirm(`Delete "${cu?.name}"?`)) return;
  deleteHomebrew("cultures", editingId);
  document.getElementById("culture-modal").classList.add("hidden");
  renderAll();
});

// ── CAREER MODAL ──────────────────────────────────────────────────────────
function openCareerModal(id) {
  editingId = id || null;
  const ca = id ? getAllCareers().find(c => c.id === id) : null;

  document.getElementById("career-modal-title").textContent = ca ? `Edit: ${ca.name}` : "New Career";
  document.getElementById("ca-name").value   = ca?.name   || "";
  document.getElementById("ca-desc").value   = ca?.description || "";
  document.getElementById("ca-points").value = ca?.careerSkillPoints || 60;

  caStdSkills  = Object.entries(ca?.standardSkillBonuses || {}).map(([k,v]) => ({ key:k, val:v }));
  caProfSkills = (ca?.professionalSkills || []).map(ps => ({ ...ps }));
  caEquipment  = [...(ca?.startingEquipment || [])];

  // Magic checkboxes
  const magic = ca?.suggestedMagicSystems || [];
  ["folkMagic","theism","sorcery","animism","mysticism"].forEach(s => {
    const cb = document.getElementById(`ca-magic-${s}`);
    if (cb) cb.checked = magic.includes(s);
  });

  renderCareerStdSkills();
  renderCareerProf();
  renderCareerEquip();

  document.getElementById("ca-delete").style.display = ca?.source === "homebrew" ? "" : "none";
  document.getElementById("career-modal").classList.remove("hidden");
}

function renderCareerStdSkills() {
  document.getElementById("ca-std-skill-list").innerHTML = caStdSkills.map((s,i) => `
    <div class="skill-row-input">
      <select onchange="caStdSkills[${i}].key=this.value" style="font-size:var(--text-sm);">
        ${Object.entries(STANDARD_SKILL_NAMES).map(([k,v]) =>
          `<option value="${k}" ${s.key===k?'selected':''}>${v}</option>`).join("")}
      </select>
      <input type="number" value="${s.val}" min="1" max="50" style="width:4rem;text-align:center;font-family:var(--font-mono);"
        oninput="caStdSkills[${i}].val=parseInt(this.value)||0">
      <button class="btn-icon" onclick="caStdSkills.splice(${i},1);renderCareerStdSkills()">✕</button>
    </div>`).join("");
}
window.renderCareerStdSkills = renderCareerStdSkills;
window._addCareerStdSkill = function() { caStdSkills.push({ key:"athletics", val:5 }); renderCareerStdSkills(); };

function renderCareerProf() {
  document.getElementById("ca-prof-list").innerHTML = caProfSkills.map((ps,i) => `
    <div class="prof-row-input">
      <input type="text" value="${ps.name||''}" placeholder="Skill name" style="font-size:var(--text-sm);"
        oninput="caProfSkills[${i}].name=this.value">
      <select onchange="caProfSkills[${i}].base=this.value" style="font-size:var(--text-sm);width:9rem;">
        ${BASE_FORMULAS.map(f => `<option value="${f}" ${ps.base===f?'selected':''}>${f}</option>`).join("")}
        <option value="${ps.base||'INT*2'}" ${!BASE_FORMULAS.includes(ps.base)?'selected':''}>Custom…</option>
      </select>
      <input type="number" value="${ps.startingBonus||0}" min="0" max="50"
        style="width:4rem;text-align:center;font-family:var(--font-mono);" title="Starting bonus"
        oninput="caProfSkills[${i}].startingBonus=parseInt(this.value)||0">
      <button class="btn-icon" onclick="caProfSkills.splice(${i},1);renderCareerProf()">✕</button>
    </div>`).join("") +
    `<div style="font-size:var(--text-xs);color:var(--text-dim);margin-top:var(--sp-1);padding-left:2px;">Name · Base Formula · Starting Bonus</div>`;
}
window.renderCareerProf = renderCareerProf;
window._addCareerProf = function() { caProfSkills.push({ name:"", base:"INT*2", startingBonus:5 }); renderCareerProf(); };

function renderCareerEquip() {
  document.getElementById("ca-equip-list").innerHTML = caEquipment.map((e,i) => `
    <div class="skill-row-input">
      <input type="text" value="${e||''}" style="font-size:var(--text-sm);"
        oninput="caEquipment[${i}]=this.value">
      <button class="btn-icon" onclick="caEquipment.splice(${i},1);renderCareerEquip()">✕</button>
    </div>`).join("");
}
window.renderCareerEquip = renderCareerEquip;
window._addCareerEquip = function() { caEquipment.push(""); renderCareerEquip(); };

function saveCareer() {
  const name = document.getElementById("ca-name").value.trim();
  if (!name) { alert("Name is required."); return; }

  const standardSkillBonuses = {};
  caStdSkills.forEach(s => { if (s.key) standardSkillBonuses[s.key] = s.val || 0; });

  const magic = ["folkMagic","theism","sorcery","animism","mysticism"]
    .filter(s => document.getElementById(`ca-magic-${s}`)?.checked);

  const entry = {
    id: editingId || generateHomebrewId("career"),
    name, source: "homebrew",
    description: document.getElementById("ca-desc").value.trim(),
    standardSkillBonuses,
    professionalSkills: caProfSkills.filter(ps => ps.name.trim()),
    professionalSkillChoiceCount: caProfSkills.filter(ps => ps.name.trim()).length,
    careerSkillPoints: parseInt(document.getElementById("ca-points").value) || 60,
    startingEquipment: caEquipment.filter(e => e.trim()),
    suggestedMagicSystems: magic,
  };

  updateHomebrew("careers", entry);
  document.getElementById("career-modal").classList.add("hidden");
  renderAll();
  toast(`Saved "${entry.name}"`);
}

document.getElementById("add-career-btn").addEventListener("click", () => openCareerModal(null));
document.getElementById("ca-save").addEventListener("click", saveCareer);
document.getElementById("ca-cancel").addEventListener("click", () => document.getElementById("career-modal").classList.add("hidden"));
document.getElementById("ca-delete").addEventListener("click", () => {
  if (!editingId) return;
  const ca = getAllCareers().find(c => c.id === editingId);
  if (!confirm(`Delete "${ca?.name}"?`)) return;
  deleteHomebrew("careers", editingId);
  document.getElementById("career-modal").classList.add("hidden");
  renderAll();
});

// ── Export ────────────────────────────────────────────────────────────────
document.getElementById("export-btn").addEventListener("click", () => {
  const data = exportAllHomebrew();
  const hasContent = data.species.length || data.cultures.length || data.careers.length;
  if (!hasContent) { toast("No homebrew data to export."); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "mythrasforge-homebrew.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Homebrew exported.");
});

// ── Import ────────────────────────────────────────────────────────────────
document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-modal").classList.remove("hidden"));
document.getElementById("import-cancel").addEventListener("click", () => document.getElementById("import-modal").classList.add("hidden"));
document.getElementById("import-confirm").addEventListener("click", () => {
  const file = document.getElementById("import-file").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importHomebrew(e.target.result);
      document.getElementById("import-modal").classList.add("hidden");
      renderAll();
      toast("Homebrew imported successfully.");
    } catch (err) { alert("Import failed: " + err.message); }
  };
  reader.readAsText(file);
});

// ── Close modals on backdrop click ───────────────────────────────────────
["species-modal","culture-modal","career-modal","import-modal"].forEach(id => {
  document.getElementById(id)?.addEventListener("click", e => {
    if (e.target.id === id) document.getElementById(id).classList.add("hidden");
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────
function toast(msg) {
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast success";
  el.innerHTML = `<div class="toast-title">${msg}</div>`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 250); }, 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────
renderAll();
