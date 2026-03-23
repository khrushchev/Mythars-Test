// roller.js — Beyond20 bridge + local fallback roller

import { successGrade, evalDiceExpression, applyDifficulty } from "./mythras.js";

let b20Connected = false;
let characterName = "";

export function setCharacterName(name) { characterName = name; }

// Detect Beyond20
window.addEventListener("Beyond20_Connected", () => {
  b20Connected = true;
  document.body.classList.add("beyond20-active");
  document.querySelectorAll(".b20-indicator").forEach(el => {
    el.classList.add("connected");
    el.querySelector(".b20-dot").title = "Beyond20 connected";
    el.querySelector(".b20-text").textContent = "B20 Connected";
  });
});

// Fire the loaded event
export function initBeyond20() {
  window.dispatchEvent(new CustomEvent("Beyond20_Loaded", {
    detail: { sheet: "MythrasForge", version: "0.1.0" }
  }));
  // Fallback: if no connection in 1.5s, stay in local mode
  setTimeout(() => {
    if (!b20Connected) updateB20UI(false);
  }, 1500);
}

function updateB20UI(connected) {
  document.querySelectorAll(".b20-indicator").forEach(el => {
    if (connected) {
      el.classList.add("connected");
      el.querySelector(".b20-text").textContent = "B20 Connected";
    } else {
      el.classList.remove("connected");
      el.querySelector(".b20-text").textContent = "B20 Not Found";
    }
  });
}

/** Skill / characteristic / passion roll */
export function skillRoll(label, targetPct, options = {}) {
  const grade = options.difficulty || "standard";
  const modified = applyDifficulty(targetPct, grade);
  const gradeLabel = grade !== "standard" ? ` [${grade}]` : "";

  const detail = {
    action: "roll", type: "skill",
    character: options.character || characterName,
    title: label + gradeLabel,
    d100: modified,
    description: `${label} (${modified}%)`,
    fields: [["Skill", label], ["Target", `${modified}%`]],
  };
  dispatch(detail);
}

/** Characteristic check (×5) */
export function charRoll(charName, value, options = {}) {
  const target = value * 5;
  skillRoll(`${charName} ×5`, target, { ...options, description: `${charName} check (${target}%)` });
}

/** Combat style attack + optional damage */
export function combatRoll(styleName, targetPct, damageDice, options = {}) {
  const detail = {
    action: "roll", type: "combatStyle",
    character: options.character || characterName,
    title: styleName,
    d100: targetPct,
    roll: damageDice,
    description: `${styleName} (${targetPct}%)`,
    fields: [["Combat Style", styleName], ["Target", `${targetPct}%`], ["Damage", damageDice]],
  };
  dispatch(detail);
}

/** Damage only */
export function damageRoll(weaponName, damageDice, options = {}) {
  const detail = {
    action: "roll", type: "damage",
    character: options.character || characterName,
    title: `${weaponName} Damage`,
    roll: damageDice,
    fields: [["Weapon", weaponName], ["Damage", damageDice]],
  };
  dispatch(detail);
}

function dispatch(detail) {
  window.dispatchEvent(new CustomEvent("Beyond20_SendMessage", { detail, bubbles: true }));
  if (!b20Connected) localRoll(detail);
}

function localRoll(detail) {
  if (detail.d100 !== undefined) {
    const rolled = Math.floor(Math.random() * 100) + 1;
    const grade  = successGrade(rolled, detail.d100);
    showRollToast(detail.title, rolled, detail.d100, grade, null);
  }
  if (detail.roll && detail.type === "damage") {
    const result = evalDiceExpression(detail.roll);
    showRollToast(detail.title, null, null, null, result);
  }
}

export function showRollToast(title, rolled, target, grade, damageResult) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${grade || ""}`;

  let html = `<div class="toast-title">${title}</div>`;

  if (rolled !== null && target !== null) {
    html += `<div class="toast-roll">${rolled} <span style="color:var(--text-dim);font-size:0.8em">vs ${target}%</span></div>`;
    const gradeTexts = {
      critical: "✦ Critical Success",
      success:  "✔ Success",
      failure:  "✘ Failure",
      fumble:   "☠ Fumble",
    };
    html += `<div class="toast-grade ${grade}">${gradeTexts[grade] || ""}</div>`;
  }

  if (damageResult) {
    const parts = damageResult.parts.map(p => {
      if (p.rolls.length) return `${p.expr}=[${p.rolls.join(",")}]`;
      return p.expr;
    }).join(" ");
    html += `<div class="toast-roll">${damageResult.total}</div>`;
    html += `<div class="toast-body">${parts}</div>`;
  }

  toast.innerHTML = html;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
