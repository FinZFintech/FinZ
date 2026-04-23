/**
 * FBotMemory — local learning layer for FBot
 *
 * A tiny, offline-only memory store that lets FBot "learn" across
 * sessions without a backend LLM. Persisted to AsyncStorage under
 * fbot_memory_v1. Everything here is best-effort and non-critical —
 * if reads / writes fail, FBot degrades gracefully.
 *
 * What it remembers
 * ─────────────────
 * • facts       — user-level key/value pairs the bot picks up during
 *                 chat (userName, preferredLanguage, occupation, etc.)
 * • corrections — when the user rejects a prefilled value and types a
 *                 new one, store the corrected value keyed by step so
 *                 we can propose it next time.
 * • chipTaps    — per-step count of which quick-reply chips the user
 *                 actually taps; used to reorder chips so the most-
 *                 used one is first.
 * • intentLog   — ring buffer of the last 50 recognized intents, used
 *                 to detect repeat questions and preload answers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fbot_memory_v1';
const INTENT_LOG_MAX = 50;

let memory = {
  facts: {},
  corrections: {},
  chipTaps: {},
  intentLog: [],
};

let loaded = false;
let loadPromise = null;
let saveDebounce = null;

/** Load memory from AsyncStorage. Idempotent — safe to call many times. */
export async function loadMemory() {
  if (loaded) return memory;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          memory = {
            facts: parsed.facts || {},
            corrections: parsed.corrections || {},
            chipTaps: parsed.chipTaps || {},
            intentLog: Array.isArray(parsed.intentLog) ? parsed.intentLog : [],
          };
        } catch (_) { /* keep defaults */ }
      }
      loaded = true;
      return memory;
    }).catch(() => {
      loaded = true;
      return memory;
    });
  }
  return loadPromise;
}

/** Persist memory. Debounced so a burst of remembers collapses to one write. */
function scheduleSave() {
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory)).catch(() => {});
  }, 400);
}

/** Remember an arbitrary user fact. */
export function remember(key, value) {
  if (!key) return;
  memory.facts[key] = value;
  scheduleSave();
}

/** Recall a fact. Returns undefined if we haven't seen it. */
export function recall(key) {
  return memory.facts[key];
}

/** All facts (for debugging / profile view). */
export function getAllFacts() {
  return { ...memory.facts };
}

/** Store a user's correction to a previously-proposed value at a given step. */
export function rememberCorrection(step, value) {
  if (!step || value == null) return;
  memory.corrections[step] = value;
  scheduleSave();
}

/** Retrieve the last-corrected value for a step, if any. */
export function recallCorrection(step) {
  return memory.corrections[step];
}

/** Log which chip the user tapped for a given step (so we can reorder). */
export function logChipTap(step, chipValue) {
  if (!step || !chipValue) return;
  if (!memory.chipTaps[step]) memory.chipTaps[step] = {};
  memory.chipTaps[step][chipValue] = (memory.chipTaps[step][chipValue] || 0) + 1;
  scheduleSave();
}

/**
 * Given the default chip order for a step, reorder it so chips the user
 * taps most often appear first. Stable for untapped chips.
 */
export function reorderChipsByTaps(step, chips) {
  const taps = memory.chipTaps[step] || {};
  return [...chips].sort((a, b) => (taps[b.value] || 0) - (taps[a.value] || 0));
}

/** Record a recognized intent. Ring-buffered to INTENT_LOG_MAX. */
export function logIntent(intent, text) {
  if (!intent) return;
  memory.intentLog.push({ intent, text: (text || '').slice(0, 120), at: Date.now() });
  if (memory.intentLog.length > INTENT_LOG_MAX) {
    memory.intentLog = memory.intentLog.slice(-INTENT_LOG_MAX);
  }
  scheduleSave();
}

/** How many times the user has hit this intent recently. */
export function intentFrequency(intent) {
  return memory.intentLog.filter((i) => i.intent === intent).length;
}

/** Full intent log for debugging. */
export function getIntentLog() {
  return [...memory.intentLog];
}

/** Nuke everything (used by "reset" flows). */
export async function clearMemory() {
  memory = { facts: {}, corrections: {}, chipTaps: {}, intentLog: [] };
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
}
