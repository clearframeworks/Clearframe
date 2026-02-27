(() => {
  const SAVE_KEY = "ninthGateSave_v1";

  /** Hidden d20 (never shown). */
  function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  const EXHAUSTION_STATES = ["Stable", "Winded", "Strained", "Failing", "Broken"];

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }


  function pickWorkAssignment(state) {
    const pool = [
      "work_brush_1",
      "work_water_1",
      "work_linen_1",
      "work_plaque_1",
      "work_mortar_1",
      "work_crates_1"
    ];

    // Avoid immediate repeats to reduce "cycle" feel.
    let candidates = pool.slice();
    if (state.lastWork) {
      candidates = candidates.filter(id => id !== state.lastWork);
    }
    // Soft avoid last 2.
    if (Array.isArray(state.workHistory) && state.workHistory.length >= 2) {
      const a = state.workHistory[state.workHistory.length - 1];
      const b = state.workHistory[state.workHistory.length - 2];
      candidates = candidates.filter(id => id !== a && id !== b) || candidates;
      if (candidates.length === 0) candidates = pool.filter(id => id !== state.lastWork);
    }

    // Weighting: higher exhaustion pushes toward lower-risk tasks (still hidden).
    const exhaustion = state.exhaustion || 0;
    const weights = candidates.map(id => {
      if (id === "work_mortar_1") return 0.8 - exhaustion * 0.1;  // crack-seeking gets rarer under fatigue
      if (id === "work_crates_1") return 0.9 - exhaustion * 0.08;
      return 1.0;
    }).map(w => Math.max(0.15, w));

    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        const pick = candidates[i];
        state.lastWork = pick;
        state.workHistory = Array.isArray(state.workHistory) ? state.workHistory : [];
        state.workHistory.push(pick);
        if (state.workHistory.length > 10) state.workHistory.shift();
        return pick;
      }
    }

    const fallback = candidates[0] || pool[0];
    state.lastWork = fallback;
    state.workHistory = Array.isArray(state.workHistory) ? state.workHistory : [];
    state.workHistory.push(fallback);
    if (state.workHistory.length > 10) state.workHistory.shift();
    return fallback;
  }

  function defaultState() {
    return {
      sceneId: null,
      day: 1,

      // Only visible stat to player:
      exhaustion: 0,

      // Hidden compound variables:
      stability: 0,
      observation: 0,
      regulation: 0,
      instability: 0,

      // Hidden flags:
      flags: {},

      // Internal counters:
      nearMisses: 0,
      lastWork: null,
      workHistory: [],
      absorbedEventSeen: false,

      // Hidden progression pressure:
      ticks: 0,
      seamExposure: 0,
      attention: 0
    };
  }

  function save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function qs(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function setExhaustionUI(state) {
    const el = document.getElementById("exhaustionText");
    if (!el) return;
    el.textContent = EXHAUSTION_STATES[clamp(state.exhaustion, 0, 4)];
  }

  function applyEffects(state, effects = {}) {
    // Every action advances the hidden clock.
    state.ticks += 1;

    if (typeof effects.exhaustion === "number") state.exhaustion = clamp(state.exhaustion + effects.exhaustion, 0, 4);
    if (typeof effects.stability === "number") state.stability += effects.stability;
    if (typeof effects.observation === "number") state.observation += effects.observation;
    if (typeof effects.regulation === "number") state.regulation += effects.regulation;
    if (typeof effects.instability === "number") state.instability += effects.instability;

    if (Array.isArray(effects.flags)) {
      effects.flags.forEach(f => state.flags[f] = true);
    }

    // Seam exposure accumulates through specific investigative behaviors.
    // (Used only for rare lateral routing; never shown.)
    const seamFlags = ["noticed_draft", "night_listen", "forced_seam", "inspected_walls", "listened_patterns", "mirrored_rhythm", "counted_cycle", "held_gaze"];
    if (Array.isArray(effects.flags)) {
      effects.flags.forEach(f => {
        if (seamFlags.includes(f)) state.seamExposure += 1;
      });
    }
    if (typeof effects.observation === "number" && effects.observation >= 2) state.seamExposure += 0.5;

    // Attention rises with instability and repeated near-misses; falls slightly with regulation.
    if (typeof effects.instability === "number" && effects.instability > 0) state.attention += 0.5 * effects.instability;
    if (typeof effects.regulation === "number" && effects.regulation > 0) state.attention = Math.max(0, state.attention - 0.25 * effects.regulation);

    // Hidden dampening: high exhaustion makes everything harder to build.
    // (No relief here; only slows growth.)
    if (state.exhaustion >= 3) {
      // bleed a bit of stability/regulation on high exhaustion
      state.stability = Math.max(0, state.stability - 0.25);
      state.regulation = Math.max(0, state.regulation - 0.25);
    }
  }

  /** Assessment qualification: compounding + legible near-miss. */
  function isAssessmentEligible(state) {
    // Official assessment is not early. The Gate needs time to observe you.
    if (state.day < 6) return false;

    const compound = state.stability + state.observation + state.regulation;
    const notTooUnstable = state.instability <= 4.5;
    const notTooExhausted = state.exhaustion <= 2;
    const hasSomePattern = !!(state.flags.mirrored_rhythm || state.flags.controlled_breath || state.flags.counted_cycle || state.flags.listened_patterns);

    return compound >= 10 && notTooUnstable && notTooExhausted && hasSomePattern;
  }

  function assessmentChance(state) {
    // Windowed probability: never 100%. Starts low. Rises slowly with sustained alignment.
    const compound = state.stability + state.observation + state.regulation;

    const base = 0.12;
    const compBoost = clamp((compound - 10) * 0.035, 0, 0.28);
    const dayBoost = clamp((state.day - 6) * 0.03, 0, 0.18);

    const instabilityPenalty = clamp(state.instability * 0.03, 0, 0.24);
    const exhaustionPenalty = clamp(state.exhaustion * 0.08, 0, 0.32);

    const p = clamp(base + compBoost + dayBoost - instabilityPenalty - exhaustionPenalty, 0.03, 0.65);
    return p;
  }

  /** Hidden lateral vector: requires observation + instability (informed deviation). */
  function lateralDoorAvailable(state) {
    // Lateral routing is ambiguous: it can feel like a crack, or like classification.
    // It should not happen early or by guess-clicking.
    if (state.day < 5) return false;
    if (state.exhaustion >= 3) return false;

    const obsOK = (state.observation >= 6) || state.flags.noticed_draft || state.flags.night_listen;
    const instOK = (state.instability >= 6) || state.flags.forced_seam || state.flags.broke_rhythm;
    const seamOK = state.seamExposure >= 5;

    if (!(obsOK && instOK && seamOK)) return false;

    // Probabilistic window: small chance, improves slightly with seam exposure, worsens with attention.
    const base = 0.06;
    const seamBoost = clamp((state.seamExposure - 5) * 0.04, 0, 0.18);
    const attentionPenalty = clamp(state.attention * 0.03, 0, 0.20);
    const p = clamp(base + seamBoost - attentionPenalty, 0.03, 0.28);

    return Math.random() < p;
  }

  function hardDegradeTick(state) {
    // Degrade-repeat-death: pressure rises with time inside the loop.
    // No "neutral" days; even a calm cycle carries drift.
    const timeBoost = clamp((state.day - 1) * 0.03, 0, 0.18);
    const attentionBoost = clamp(state.attention * 0.02, 0, 0.18);

    // Tick probability rises with instability and low regulation.
    const risk = clamp(
      0.18 + timeBoost + attentionBoost +
      (state.instability * 0.03) +
      (Math.max(0, 2 - state.regulation) * 0.05),
      0.18, 0.75
    );

    const r = Math.random();
    if (r < risk) state.exhaustion = clamp(state.exhaustion + 1, 0, 4);
  }

  function setStory(text) {
    const el = document.getElementById("story");
    if (el) el.textContent = text;
  }

  function setChoices(choiceObjs, onClick) {
    const wrap = document.getElementById("choices");
    if (!wrap) return;
    wrap.innerHTML = "";
    choiceObjs.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ng-choicebtn";
      b.textContent = c.label;
      b.addEventListener("click", () => onClick(c, b));
      wrap.appendChild(b);
    });
  }

  function disableChoices() {
    const wrap = document.getElementById("choices");
    if (!wrap) return;
    [...wrap.querySelectorAll("button")].forEach(b => b.disabled = true);
  }

  function systemJumpToTitle() {
    window.location.href = "./index.html";
  }

  function systemReset(state, data) {
    const fresh = defaultState();
    fresh.sceneId = data.startScene;
    save(fresh);
    return fresh;
  }

  async function main() {
    const res = await fetch("./data/arc1.json", { cache: "no-store" });
    const data = await res.json();

    let state = null;
    const mode = qs("mode");

    if (mode === "continue") {
      state = load();
    } else if (mode === "new") {
      clearSave();
      state = null;
    }

    if (!state) {
      state = defaultState();
      state.sceneId = data.startScene;
      save(state);
    }

    document.getElementById("resetBtn")?.addEventListener("click", () => {
      clearSave();
      window.location.href = "./index.html";
    });

    function resolveSystemSceneId(next) {
      if (next === "__SYSTEM_TO_TITLE__") return "__SYSTEM_TO_TITLE__";
      if (next === "__SYSTEM_RESET__") return "__SYSTEM_RESET__";
      if (next === "__SYSTEM_MORNING_CHECK__") return "__SYSTEM_MORNING_CHECK__";
      if (next === "__SYSTEM_WORK_ASSIGN__") return "__SYSTEM_WORK_ASSIGN__";
      return next;
    }

    function render() {
      setExhaustionUI(state);

      // Death only at high exhaustion: broken triggers absorption.
      if (state.exhaustion >= 4) {
        state.sceneId = "arc1_death_absorbed";
        save(state);
      }

      const sceneId = state.sceneId;

      // System scenes:
      if (sceneId === "__SYSTEM_TO_TITLE__") {
        systemJumpToTitle();
        return;
      }

      if (sceneId === "__SYSTEM_RESET__") {
        state = systemReset(state, data);
      }

      
      if (sceneId === "__SYSTEM_WORK_ASSIGN__") {
        // Pick a work assignment (varied tasks to avoid linear repetition).
        state.sceneId = pickWorkAssignment(state);
        save(state);
        render();
        return;
      }

if (sceneId === "__SYSTEM_MORNING_CHECK__") {
        // Each new morning increments day and runs assessment / lateral checks.
        state.day += 1;

        // Degrade-repeat-death pressure (subtle, invisible).
        hardDegradeTick(state);

        // Lateral door opportunity (rare).
        if (lateralDoorAvailable(state)) {
          state.sceneId = "arc1_hidden_door_prompt";
          save(state);
          render();
          return;
        }

        // Official assessment (probabilistic but legible):
        if (isAssessmentEligible(state)) {
          const p = assessmentChance(state);
          const r = Math.random(); // hidden
          if (r < p) {
            state.sceneId = "arc1_reassigned_official";
          } else {
            state.nearMisses += 1;
            state.sceneId = "arc1_near_miss";
          }
        } else {
          // Not eligible yet: continue routine loop.
          state.sceneId = "__SYSTEM_WORK_ASSIGN__";
        }

        save(state);
        render();
        return;
      }

      const scene = data.scenes[sceneId];
      if (!scene) {
        // Failsafe: reset to start.
        state.sceneId = data.startScene;
        save(state);
        render();
        return;
      }

      setStory(scene.text);

      setChoices(scene.choices, (choice) => {
        disableChoices();

        // Micro-pause for weight (immersion).
        window.setTimeout(() => {
          applyEffects(state, choice.effects || {});

          let next = resolveSystemSceneId(choice.next);

          // If player hits absorption event once, mark it (used only for future expansion).
          if (next === "arc1_absorption_event") state.absorbedEventSeen = true;

          // Hidden d20 exists (canon), but we do not display or branch off it in Arc 1 yet.
          rollD20();

          state.sceneId = next;

          save(state);
          render();
        }, 420);
      });
    }

    render();
  }

  main().catch(() => {
    // If fetch fails, show a bare error without leaking mechanics.
    const story = document.getElementById("story");
    if (story) story.textContent = "The Gate does not open.\n\n(Load error. Check file paths.)";
  });
})();
