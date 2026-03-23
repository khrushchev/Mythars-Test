// data/loader.js
// Merges core defaults with homebrew entries from localStorage.

import { DEFAULT_SPECIES  } from "./defaults/species.js";
import { DEFAULT_CULTURES } from "./defaults/cultures.js";
import { DEFAULT_CAREERS  } from "./defaults/careers.js";

const HB_PREFIX = "mythrasforge:homebrew:";

function getHomebrew(key) {
  try {
    return JSON.parse(localStorage.getItem(HB_PREFIX + key) || "[]");
  } catch { return []; }
}

export function getAllSpecies()  { return [...DEFAULT_SPECIES,  ...getHomebrew("species")];  }
export function getAllCultures() { return [...DEFAULT_CULTURES, ...getHomebrew("cultures")]; }
export function getAllCareers()  { return [...DEFAULT_CAREERS,  ...getHomebrew("careers")];  }

export function getSpeciesById(id)  { return getAllSpecies().find(s => s.id === id)  || null; }
export function getCultureById(id)  { return getAllCultures().find(c => c.id === id) || null; }
export function getCareerById(id)   { return getAllCareers().find(c => c.id === id)  || null; }

export function saveHomebrew(type, entries) {
  localStorage.setItem(HB_PREFIX + type, JSON.stringify(entries));
}

export function addHomebrew(type, entry) {
  const existing = getHomebrew(type);
  existing.push(entry);
  saveHomebrew(type, existing);
}

export function updateHomebrew(type, entry) {
  const existing = getHomebrew(type);
  const i = existing.findIndex(e => e.id === entry.id);
  if (i >= 0) existing[i] = entry;
  else existing.push(entry);
  saveHomebrew(type, existing);
}

export function deleteHomebrew(type, id) {
  const existing = getHomebrew(type).filter(e => e.id !== id);
  saveHomebrew(type, existing);
}

export function exportAllHomebrew() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    species:  getHomebrew("species"),
    cultures: getHomebrew("cultures"),
    careers:  getHomebrew("careers"),
  };
}

export function importHomebrew(jsonString) {
  const data = JSON.parse(jsonString);
  for (const type of ["species", "cultures", "careers"]) {
    if (!data[type]) continue;
    const existing = getHomebrew(type);
    const map = new Map(existing.map(e => [e.id, e]));
    for (const entry of data[type]) map.set(entry.id, entry);
    saveHomebrew(type, [...map.values()]);
  }
}

export function generateHomebrewId(prefix) {
  return `hb_${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
