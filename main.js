// Single-file version (no imports) so it runs by double-clicking index.html.

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function invLerp(a, b, v) {
  if (a === b) return 0;
  return (v - a) / (b - a);
}

function easeOutCubic(t) {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbaFromHex(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function withAlpha(rgba, alpha) {
  if (typeof rgba !== "string") return rgba;
  return rgba.replace(/rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),([^)]+)\)/, `rgba($1,$2,$3, ${alpha})`);
}

// --- Infinite corridor generation + Zones ---

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

function isGeneratedZoneKey(key) {
  return typeof key === "string" && /^gen\d{3}$/.test(key);
}

function pickWeighted(rng, items, avoidKey) {
  let total = 0;
  for (const it of items) total += it.key === avoidKey ? 0 : it.weight;
  let r = rng() * total;
  for (const it of items) {
    if (it.key === avoidKey) continue;
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[0];
}

const SECTIONS_STORAGE_KEY = "gd_sections_v1";

function defaultEnabledKeys() {
  return new Set(ZONES.filter((z) => z.defaultEnabled).map((z) => z.key));
}

function loadEnabledKeys() {
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return defaultEnabledKeys();
    const arr = JSON.parse(raw);
    const keys = new Set();
    if (Array.isArray(arr)) {
      for (const k of arr) if (typeof k === "string") keys.add(k);
    }
    // If empty, fall back.
    if (!keys.size) return defaultEnabledKeys();
    return keys;
  } catch {
    return defaultEnabledKeys();
  }
}

function saveEnabledKeys(keys) {
  try {
    localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore
  }
}

const ZONES = [
  {
    key: "normal",
    name: "Normal",
    desc: "A calm section to recover. Standard speed and corridor width.",
    defaultEnabled: true,
    weight: 2.4,
    minLen: 1200,
    maxLen: 2200,
    speedMul: 1.0,
    widthMul: 1.0,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "speed",
    name: "Speed",
    desc: "Faster forward speed. Tight enough to keep you honest.",
    defaultEnabled: true,
    weight: 1.1,
    minLen: 900,
    maxLen: 1500,
    speedMul: 1.45,
    widthMul: 0.92,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "tight",
    name: "Tight",
    desc: "Narrow tunnel. Precision section.",
    defaultEnabled: true,
    weight: 1.1,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.05,
    widthMul: 0.58,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "zigzag",
    name: "Zig-Zag",
    desc: "Tunnel snaps up/down. Read the rhythm.",
    defaultEnabled: true,
    weight: 1.0,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.08,
    widthMul: 0.78,
    invert: false,
    dual: false,
    pattern: "zigzag",
  },
  {
    key: "dual",
    name: "Dual",
    desc: "Two icons mirrored at once. Survive both hitboxes.",
    defaultEnabled: true,
    weight: 0.85,
    minLen: 1000,
    maxLen: 1800,
    speedMul: 1.05,
    widthMul: 0.92,
    invert: false,
    dual: true,
    pattern: "smooth",
  },
  {
    key: "inverted",
    name: "Inverted",
    desc: "Controls flip vertically. Hold becomes down (and vice versa).",
    defaultEnabled: true,
    weight: 0.85,
    minLen: 1000,
    maxLen: 1900,
    speedMul: 1.0,
    widthMul: 0.82,
    invert: true,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "boost",
    name: "Boost",
    desc: "Hit boost arrows for short speed bursts + shake.",
    defaultEnabled: true,
    weight: 0.9,
    minLen: 950,
    maxLen: 1650,
    speedMul: 1.02,
    widthMul: 0.8,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "pulse",
    name: "Pulse",
    desc: "The tunnel 'breathes' in and out while you fly.",
    defaultEnabled: true,
    weight: 0.85,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.05,
    widthMul: 0.82,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "glitch",
    name: "Glitch",
    desc: "Screen jitters and you can get TP’d backwards.",
    defaultEnabled: true,
    weight: 0.75,
    minLen: 850,
    maxLen: 1500,
    speedMul: 1.12,
    widthMul: 0.86,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  // --- 25 more unique zones (optional, pick in Sections) ---
  {
    key: "rampup",
    name: "Ramp Up",
    desc: "Speed ramps up as the section goes on.",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.0,
    speedRamp: { from: 0.9, to: 1.45 },
    widthMul: 0.86,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "rampdown",
    name: "Ramp Down",
    desc: "Starts fast, then eases down (timing changes mid-run).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.0,
    speedRamp: { from: 1.35, to: 0.85 },
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "sine",
    name: "Sine",
    desc: "The whole tunnel waves up and down like a sine curve.",
    defaultEnabled: false,
    weight: 0.6,
    minLen: 950,
    maxLen: 1750,
    speedMul: 1.02,
    widthMul: 0.92,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "centerSine", amp: 95, k: 0.010, timeFreq: 1.15 },
  },
  {
    key: "squeeze",
    name: "Squeeze",
    desc: "The gap steadily tightens through the section.",
    defaultEnabled: false,
    weight: 0.6,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.0,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "widthEase", from: 1.0, to: 0.62 },
  },
  {
    key: "expand",
    name: "Expand",
    desc: "Starts tight then opens up (breathing relief).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.0,
    widthMul: 0.75,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "widthEase", from: 0.7, to: 1.12 },
  },
  {
    key: "saw",
    name: "Saw",
    desc: "Center snaps in a saw/triangle rhythm (awkward timing).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.05,
    widthMul: 0.84,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "centerSaw", amp: 140, period: 340 },
  },
  {
    key: "offset",
    name: "Offset",
    desc: "The tunnel drifts off-center then returns.",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1600,
    speedMul: 1.0,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "centerEase", delta: 140 },
  },
  {
    key: "quake",
    name: "Quake",
    desc: "Micro-jitter corridor + constant shake vibe.",
    defaultEnabled: false,
    weight: 0.5,
    minLen: 850,
    maxLen: 1450,
    speedMul: 1.06,
    widthMul: 0.86,
    invert: false,
    dual: false,
    pattern: "smooth",
    corridorMod: { type: "quake", amp: 14 },
    overlay: { type: "shake", mag: 2.2 },
  },
  {
    key: "strobe",
    name: "Strobe",
    desc: "Flashing screen pulses. Keep your focus.",
    defaultEnabled: false,
    weight: 0.45,
    minLen: 800,
    maxLen: 1400,
    speedMul: 1.05,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    overlay: { type: "strobe", strength: 0.18, freq: 10.0 },
  },
  {
    key: "lowgrav",
    name: "Low Grav",
    desc: "Floatier physics (gravity reduced).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    gravityMul: 0.72,
  },
  {
    key: "highgrav",
    name: "High Grav",
    desc: "Heavier physics (gravity increased).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.95,
    invert: false,
    dual: false,
    pattern: "smooth",
    gravityMul: 1.35,
  },
  {
    key: "slippery",
    name: "Slippery",
    desc: "Ship is slippery (less damping).",
    defaultEnabled: false,
    weight: 0.5,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.02,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    dragMul: 0.6,
  },
  {
    key: "sticky",
    name: "Sticky",
    desc: "Ship is sticky/heavy (more damping).",
    defaultEnabled: false,
    weight: 0.5,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.92,
    invert: false,
    dual: false,
    pattern: "smooth",
    dragMul: 2.7,
  },
  {
    key: "steep",
    name: "Steep",
    desc: "Wave is steeper (moves up/down faster).",
    defaultEnabled: false,
    weight: 0.52,
    minLen: 850,
    maxLen: 1500,
    speedMul: 1.0,
    widthMul: 0.95,
    invert: false,
    dual: false,
    pattern: "smooth",
    slopeMul: 1.25,
  },
  {
    key: "shallow",
    name: "Shallow",
    desc: "Wave is shallower (moves up/down slower).",
    defaultEnabled: false,
    weight: 0.52,
    minLen: 850,
    maxLen: 1500,
    speedMul: 1.02,
    widthMul: 0.88,
    invert: false,
    dual: false,
    pattern: "smooth",
    slopeMul: 0.82,
  },
  {
    key: "micro",
    name: "Micro",
    desc: "Smaller hitbox (more forgiving).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.12,
    widthMul: 0.78,
    invert: false,
    dual: false,
    pattern: "smooth",
    radiusMul: 0.72,
  },
  {
    key: "fat",
    name: "Fat",
    desc: "Bigger hitbox (harder).",
    defaultEnabled: false,
    weight: 0.5,
    minLen: 850,
    maxLen: 1550,
    speedMul: 0.98,
    widthMul: 1.08,
    invert: false,
    dual: false,
    pattern: "smooth",
    radiusMul: 1.28,
  },
  {
    key: "echo",
    name: "Echo",
    desc: "Longer trail (visual inertia).",
    defaultEnabled: false,
    weight: 0.45,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.92,
    invert: false,
    dual: false,
    pattern: "smooth",
    trailMul: 1.85,
  },
  {
    key: "fade",
    name: "Fade",
    desc: "Screen gently fades in/out (visibility pressure).",
    defaultEnabled: false,
    weight: 0.45,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    overlay: { type: "fade", strength: 0.55, freq: 1.5 },
  },
  {
    key: "blackout",
    name: "Blackout",
    desc: "Stronger fog/spotlight (very limited vision).",
    defaultEnabled: false,
    weight: 0.4,
    minLen: 850,
    maxLen: 1500,
    speedMul: 0.98,
    widthMul: 0.95,
    invert: false,
    dual: false,
    pattern: "smooth",
    overlay: { type: "blackout" },
  },
  {
    key: "flipfast",
    name: "FlipFast",
    desc: "Gravity flips quickly (faster than Flip).",
    defaultEnabled: false,
    weight: 0.42,
    minLen: 850,
    maxLen: 1500,
    speedMul: 1.05,
    widthMul: 0.92,
    invert: false,
    dual: false,
    pattern: "smooth",
    flipFast: true,
  },
  {
    key: "attractor",
    name: "Attractor",
    desc: "A moving gravity target pulls you toward a shifting point.",
    defaultEnabled: false,
    weight: 0.45,
    minLen: 900,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.9,
    invert: false,
    dual: false,
    pattern: "smooth",
    attractor: { amp: 130, k: 0.010, timeFreq: 1.1, force: 9.0 },
  },
  {
    // Trigger zone: flips direction and starts a fresh generated section.
    key: "reverse",
    name: "Reverse",
    desc: "Turn around into a fresh generated section (camera flips).",
    defaultEnabled: false,
    weight: 0.55,
    minLen: 220,
    maxLen: 340,
    speedMul: 1.0,
    widthMul: 1.05,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "smash",
    name: "SMASH",
    desc: "Slow and extremely tight. Pure control check.",
    defaultEnabled: true,
    weight: 0.55,
    minLen: 750,
    maxLen: 1200,
    speedMul: 0.68,
    widthMul: 0.30,
    invert: false,
    dual: false,
    pattern: "smooth",
  },

  // --- 5 new unique zones ---
  {
    key: "flip",
    name: "Flip",
    desc: "Gravity auto-flips on a timer. Keep adapting mid-flight.",
    defaultEnabled: true,
    weight: 0.7,
    minLen: 900,
    maxLen: 1550,
    speedMul: 1.02,
    widthMul: 0.86,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "magnet",
    name: "Magnet",
    desc: "A magnetic pull drags you toward the tunnel center.",
    defaultEnabled: true,
    weight: 0.75,
    minLen: 950,
    maxLen: 1700,
    speedMul: 1.0,
    widthMul: 0.82,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "wind",
    name: "Wind",
    desc: "Wind pushes you up/down in bursts. Fight the drift.",
    defaultEnabled: true,
    weight: 0.75,
    minLen: 950,
    maxLen: 1750,
    speedMul: 1.03,
    widthMul: 0.84,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
  {
    key: "tiny",
    name: "Tiny",
    desc: "Smaller hitbox (more forgiving) but faster and snappier.",
    defaultEnabled: true,
    weight: 0.65,
    minLen: 850,
    maxLen: 1450,
    speedMul: 1.18,
    widthMul: 0.78,
    invert: false,
    dual: false,
    pattern: "smooth",
    radiusMul: 0.67,
  },
  {
    key: "fog",
    name: "Fog",
    desc: "Limited visibility: spotlight around you only.",
    defaultEnabled: true,
    weight: 0.7,
    minLen: 900,
    maxLen: 1700,
    speedMul: 0.98,
    widthMul: 0.88,
    invert: false,
    dual: false,
    pattern: "smooth",
  },
];

function makeGeneratedZones(count) {
  /** @type {any[]} */
  const out = [];
  const usedSig = new Set();
  const usedNames = new Set();

  function hashU32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rand(rng, a, b) {
    return a + (b - a) * rng();
  }

  function rint(rng, a, b) {
    return Math.floor(rand(rng, a, b + 1));
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  const modTypes = [
    "centerSine",
    "widthSine",
    "widthEase",
    "centerSaw",
    "quake",
    // New “continuous parameter” mods so each generated zone is truly unique
    "centerMix",
    "widthMix",
    "combo",
    "centerQuant",
    "widthPulse",
  ];

  const overlayTypes = [null, "strobe", "fade", "shake", "blackout"];
  // User requested removing all laser stuff from maps:
  // Generated zones should never add hazards.
  const hazardTypes = [null];

  const adjectives = [
    "Neon",
    "Violet",
    "Crimson",
    "Cobalt",
    "Solar",
    "Lunar",
    "Static",
    "Hollow",
    "Prism",
    "Cipher",
    "Warp",
    "Arc",
    "Pulse",
    "Gloom",
    "Nova",
    "Rift",
    "Chrome",
    "Spectral",
    "Razor",
    "Feral",
    "Ghost",
    "Obsidian",
    "Azure",
    "Amber",
    "Blizzard",
    "Vortex",
    "Mirage",
    "Echo",
    "Ion",
    "Frost",
    "Inferno",
    "Sonic",
    "Tremor",
    "Quanta",
    "Glint",
    "Radiant",
    "Void",
    "Chroma",
    "Circuit",
    "Glitch",
    "Shatter",
    "Turbo",
    "Zenith",
    "Nexus",
    "Blaze",
    "Haze",
    "Phantom",
    "Aurora",
    "Ripple",
    "Helix",
    "Tangle",
    "Kinetic",
    "Vector",
  ];

  const nouns = [
    "Run",
    "Tunnel",
    "Spine",
    "Chute",
    "Pass",
    "Ridge",
    "Drift",
    "Gauntlet",
    "Corridor",
    "Lane",
    "Channel",
    "Rift",
    "Fissure",
    "Canyon",
    "Vault",
    "Grid",
    "Circuit",
    "Arcade",
    "Pulse",
    "Storm",
    "Fury",
    "Waltz",
    "Spiral",
    "Helix",
    "Blade",
    "Saw",
    "Quake",
    "Beacon",
    "Gate",
    "Prism",
    "Horizon",
    "Mirage",
    "Switch",
    "Shiver",
    "Surge",
    "Sway",
    "Crest",
    "Edge",
    "Scatter",
    "Strobe",
    "Fog",
    "Shadow",
    "Tide",
    "Vortex",
    "Nexus",
    "Vector",
    "Glyph",
    "Cipher",
    "Riddle",
    "Crown",
    "Shard",
    "Echo",
  ];

  for (let i = 1; i <= count; i++) {
    const key = `gen${String(i).padStart(3, "0")}`;
    const baseHash = hashU32(key) ^ 0x9e3779b9;

    // Re-roll if we somehow collide on a rounded “signature”.
    let attempt = 0;
    let rng = mulberry32(baseHash);

    /** @type {any} */
    let corridorMod = undefined;
    /** @type {any} */
    let overlay = undefined;
    /** @type {any} */
    let hazard = undefined;
    /** @type {any} */
    let attractor = undefined;

    let speedMul = 1.0;
    let widthMul = 1.0;
    let gravityMul = 1.0;
    let dragMul = 1.0;
    let slopeMul = 1.0;
    let radiusMul = 1.0;
    let trailMul = 1.0;
    let pattern = "smooth";
    let speedRamp = undefined;

    while (attempt < 80) {
      rng = mulberry32(baseHash ^ (attempt * 0x85ebca6b));

      // Core scalars: continuous (not a small discrete set).
      speedMul = rand(rng, 0.92, 1.26);
      widthMul = rand(rng, 0.66, 1.04);
      gravityMul = rand(rng, 0.68, 1.55);
      dragMul = rand(rng, 0.55, 3.05);
      slopeMul = rand(rng, 0.78, 1.48);
      radiusMul = rand(rng, 0.72, 1.24);
      trailMul = rand(rng, 0.85, 2.55);
      pattern = rng() < 0.18 ? "zigzag" : "smooth";

      // Corridor mod: unique parameters even when type repeats.
      const mt = pick(rng, modTypes);
      if (mt === "centerSine") {
        corridorMod = {
          type: "centerSine",
          amp: rand(rng, 55, 190),
          k: rand(rng, 0.004, 0.022),
          timeFreq: rand(rng, 0.55, 2.3),
          label: "wavy center",
        };
      } else if (mt === "widthSine") {
        corridorMod = {
          type: "widthSine",
          amp: rand(rng, 0.08, 0.34),
          k: rand(rng, 0.004, 0.022),
          timeFreq: rand(rng, 0.55, 2.1),
          label: "breathing gap",
        };
      } else if (mt === "widthEase") {
        const from = rand(rng, 0.78, 1.18);
        const to = rand(rng, 0.62, 1.12);
        corridorMod = { type: "widthEase", from, to, label: from > to ? "tightening gap" : "widening gap" };
      } else if (mt === "centerSaw") {
        corridorMod = {
          type: "centerSaw",
          amp: rand(rng, 70, 230),
          period: rand(rng, 180, 540),
          label: "saw center",
        };
      } else if (mt === "quake") {
        corridorMod = { type: "quake", amp: rand(rng, 6, 23), label: "micro jitter" };
      } else if (mt === "centerMix") {
        corridorMod = {
          type: "centerMix",
          a1: rand(rng, 25, 145),
          k1: rand(rng, 0.004, 0.020),
          f1: rand(rng, 0.55, 2.4),
          a2: rand(rng, 20, 125),
          k2: rand(rng, 0.006, 0.028),
          f2: rand(rng, 0.40, 2.8),
          a3: rand(rng, 10, 85),
          k3: rand(rng, 0.010, 0.040),
          f3: rand(rng, 0.20, 3.2),
          label: "multi-wave center",
        };
      } else if (mt === "widthMix") {
        corridorMod = {
          type: "widthMix",
          a1: rand(rng, 0.04, 0.18),
          k1: rand(rng, 0.004, 0.020),
          f1: rand(rng, 0.55, 2.2),
          a2: rand(rng, 0.03, 0.16),
          k2: rand(rng, 0.006, 0.030),
          f2: rand(rng, 0.40, 2.8),
          label: "multi-wave gap",
        };
      } else if (mt === "combo") {
        corridorMod = {
          type: "combo",
          ca1: rand(rng, 20, 130),
          ck1: rand(rng, 0.004, 0.020),
          cf1: rand(rng, 0.55, 2.4),
          ca2: rand(rng, 10, 100),
          ck2: rand(rng, 0.008, 0.034),
          cf2: rand(rng, 0.30, 2.9),
          wa1: rand(rng, 0.03, 0.16),
          wk1: rand(rng, 0.004, 0.020),
          wf1: rand(rng, 0.55, 2.3),
          wa2: rand(rng, 0.02, 0.14),
          wk2: rand(rng, 0.010, 0.040),
          wf2: rand(rng, 0.30, 3.2),
          label: "combo waves",
        };
      } else if (mt === "centerQuant") {
        corridorMod = {
          type: "centerQuant",
          step: rand(rng, 16, 58),
          amp: rand(rng, 35, 140),
          k: rand(rng, 0.005, 0.028),
          timeFreq: rand(rng, 0.6, 2.5),
          label: "snappy steps",
        };
      } else if (mt === "widthPulse") {
        corridorMod = {
          type: "widthPulse",
          lo: rand(rng, 0.62, 0.92),
          hi: rand(rng, 0.92, 1.22),
          k: rand(rng, 0.005, 0.024),
          timeFreq: rand(rng, 0.6, 2.2),
          label: "pulsing gap",
        };
      }

      // Overlay: parameterized.
      const ot = pick(rng, overlayTypes);
      overlay = undefined;
      if (ot === "strobe") {
        overlay = { type: "strobe", strength: rand(rng, 0.08, 0.22), freq: rand(rng, 7.0, 14.5), label: "strobe" };
      } else if (ot === "fade") {
        overlay = { type: "fade", strength: rand(rng, 0.35, 0.75), freq: rand(rng, 0.75, 2.15), label: "fade" };
      } else if (ot === "shake") {
        overlay = { type: "shake", mag: rand(rng, 1.1, 2.8), label: "shake" };
      } else if (ot === "blackout") {
        overlay = { type: "blackout", label: "blackout" };
      }

      // Hazards: parameterized (and later clamped to corridor size in hazardInfo()).
      const ht = pick(rng, hazardTypes);
      hazard = undefined;
      if (ht === "laser") {
        hazard = {
          type: "laser",
          amp: rand(rng, 70, 210),
          freq: rand(rng, 1.3, 3.6),
          thick: rand(rng, 7, 18),
          label: "laser",
        };
      } else if (ht === "dblaser") {
        hazard = {
          type: "dblaser",
          amp: rand(rng, 55, 185),
          freq: rand(rng, 1.1, 3.2),
          thick: rand(rng, 6, 16),
          sep: rand(rng, 80, 190),
          label: "double laser",
        };
      } else if (ht === "gate") {
        hazard = {
          type: "gate",
          amp: rand(rng, 80, 240),
          freq: rand(rng, 0.85, 2.5),
          thick: rand(rng, 18, 64),
          label: "gate band",
        };
      }

      // Optional attractor (a *new* feel mechanic, not just a “set swap”).
      attractor = undefined;
      if (rng() < 0.26) {
        attractor = {
          amp: rand(rng, 70, 190),
          k: rand(rng, 0.004, 0.020),
          timeFreq: rand(rng, 0.55, 2.0),
          force: rand(rng, 5.0, 14.0),
        };
      }

      // Speed ramp sometimes.
      speedRamp = undefined;
      if (rng() < 0.32) {
        const from = rand(rng, 0.85, 1.45);
        const to = rand(rng, 0.85, 1.55);
        if (Math.abs(to - from) > 0.12) speedRamp = { from, to };
      }

      const sig =
        `${corridorMod?.type ?? "none"}|${overlay?.type ?? "none"}|${hazard?.type ?? "none"}|` +
        `${attractor ? "A" : "N"}|${pattern}|` +
        `${round3(speedMul)}|${round3(widthMul)}|${round3(gravityMul)}|${round3(dragMul)}|${round3(slopeMul)}|${round3(radiusMul)}|${round3(trailMul)}|` +
        `${speedRamp ? `${round3(speedRamp.from)}>${round3(speedRamp.to)}` : "noramp"}|` +
        `${corridorMod ? Object.keys(corridorMod).filter((k) => k !== "label" && k !== "type").map((k) => round3(corridorMod[k])).join(",") : ""}|` +
        `${overlay ? Object.keys(overlay).filter((k) => k !== "label" && k !== "type").map((k) => round3(overlay[k])).join(",") : ""}|` +
        `${hazard ? Object.keys(hazard).filter((k) => k !== "label" && k !== "type").map((k) => round3(hazard[k])).join(",") : ""}|` +
        `${attractor ? [round3(attractor.amp), round3(attractor.k), round3(attractor.timeFreq), round3(attractor.force)].join(",") : ""}`;

      if (!usedSig.has(sig)) {
        usedSig.add(sig);
        break;
      }
      attempt++;
    }

    // Unique name (not just “Gen 12”).
    let baseName = "";
    for (let tries = 0; tries < 30; tries++) {
      const rrng = mulberry32(baseHash ^ (tries * 0x27d4eb2f));
      const a = pick(rrng, adjectives);
      const n = pick(rrng, nouns);
      baseName = `${a} ${n}`;
      if (!usedNames.has(baseName)) {
        usedNames.add(baseName);
        break;
      }
    }
    const name = `Gen ${i} — ${baseName}`;

    const descBits = [];
    if (corridorMod?.label) descBits.push(corridorMod.label);
    if (hazard?.label) descBits.push(hazard.label);
    if (overlay?.label) descBits.push(overlay.label);
    if (speedRamp) descBits.push("speed ramp");
    if (attractor) descBits.push("attractor pull");
    if (gravityMul && Math.abs(gravityMul - 1.0) >= 0.12) descBits.push(gravityMul < 1 ? "low grav" : "high grav");

    out.push({
      key,
      name,
      desc: descBits.length ? descBits.join(" • ") : "Unique generated section.",
      defaultEnabled: false,
      weight: 0.22,
      minLen: 850,
      maxLen: 1500,
      speedMul,
      speedRamp,
      widthMul,
      invert: false,
      dual: false,
      pattern,
      corridorMod: corridorMod ? { ...corridorMod } : undefined,
      overlay: overlay ? { ...overlay } : undefined,
      hazard: hazard ? { ...hazard } : undefined,
      attractor,
      gravityMul,
      dragMul,
      slopeMul,
      radiusMul,
      trailMul,
    });
  }

  return out;
}

// Add 100 more optional generated zones.
ZONES.push(...makeGeneratedZones(100));

const ZONE_BY_KEY = Object.fromEntries(ZONES.map((z) => [z.key, z]));

function getZone(key) {
  return ZONE_BY_KEY[key] ?? ZONE_BY_KEY.normal;
}

function computeCorridorBounds() {
  const margin = 90;
  const minY = margin;
  const maxY = Math.max(margin + 260, view.h - margin);
  const usable = Math.max(260, maxY - minY);
  const baseHalf = clamp(usable * 0.33, 140, 260);
  const halfMax = Math.max(90, usable * 0.5 - 18);
  return { minY, maxY, usable, baseHalf, halfMax };
}

/**
 * Each corridor segment linearly interpolates a center (c) and half-height (h):
 * yTop = c - h, yBottom = c + h
 */
const corridor = {
  seed: 0,
  rng: mulberry32(1),
  segments: /** @type {Array<{x0:number,x1:number,c0:number,c1:number,h0:number,h1:number,zoneKey:string,zoneStartX:number,zoneEndX:number}>} */ ([]),
  nextX: 0,
  zoneKey: "normal",
  zoneStartX: 0,
  zoneEndX: 0,
  lastAvoidZoneKey: "normal",
  state: {
    center: 0,
    half: 200,
    zigDir: 1,
  },
};

function resetCorridor(seed) {
  corridor.seed = seed >>> 0;
  corridor.rng = mulberry32(corridor.seed);
  corridor.segments.length = 0;
  corridor.nextX = 0;
  corridor.zoneKey = "normal";
  corridor.zoneStartX = 0;
  corridor.zoneEndX = 0;
  corridor.lastAvoidZoneKey = "normal";

  const { minY, maxY, baseHalf } = computeCorridorBounds();
  corridor.state.center = (minY + maxY) * 0.5;
  corridor.state.half = baseHalf;
  corridor.state.zigDir = 1;

  // Start with a short warmup.
  corridor.zoneKey = "normal";
  corridor.zoneStartX = 0;
  corridor.zoneEndX = 600;
}

function chooseNextZone() {
  const enabled = game.enabledZones?.size ? game.enabledZones : defaultEnabledKeys();
  const candidates = ZONES.filter(
    (z) => enabled.has(z.key) && (!custom?.ogMode || !isGeneratedZoneKey(z.key))
  );
  const safe = candidates.length ? candidates : [getZone("normal")];

  const next = pickWeighted(corridor.rng, safe, corridor.lastAvoidZoneKey);
  corridor.lastAvoidZoneKey = next.key;
  corridor.zoneKey = next.key;
  corridor.zoneStartX = corridor.nextX;
  const zoneLenScale = next.key === "reverse" ? 1.0 : 1.85; // longer zones to adapt
  corridor.zoneEndX =
    corridor.nextX + randRange(corridor.rng, next.minLen, next.maxLen) * zoneLenScale;
  return next;
}

function generateNextSegment() {
  if (corridor.nextX >= corridor.zoneEndX) chooseNextZone();
  const zone = getZone(corridor.zoneKey);
  const { minY, maxY, usable, baseHalf, halfMax } = computeCorridorBounds();

  const x0 = corridor.nextX;
  const segLen =
    zone.pattern === "zigzag"
      ? randRange(corridor.rng, 150, 220)
      : randRange(corridor.rng, 180, 320);
  const x1 = x0 + segLen;

  const c0 = corridor.state.center;
  const h0 = corridor.state.half;

  const tight = clamp(custom?.tightness ?? 1.0, 0.75, 1.6);
  const targetHalf = clamp(baseHalf * (zone.widthMul / tight), 90, halfMax);
  const halfNoise =
    zone.key === "tight" ? 10 : zone.key === "smash" ? 6 : 22;
  const h1 = clamp(
    lerp(h0, targetHalf, 0.28) + randRange(corridor.rng, -halfNoise, halfNoise),
    90,
    halfMax
  );

  const centerMin = minY + h1 + 10;
  const centerMax = maxY - h1 - 10;

  let c1 = c0;
  if (zone.pattern === "zigzag") {
    const amp = clamp(usable * 0.18, 70, 170);
    c1 = clamp(c0 + corridor.state.zigDir * amp, centerMin, centerMax);
    corridor.state.zigDir *= -1;
  } else {
    const baseDelta = zone.key === "dual" ? 55 : 95;
    const delta =
      baseDelta *
      (zone.key === "tight" ? 0.75 : zone.key === "smash" ? 0.55 : 1.0);
    c1 = clamp(c0 + randRange(corridor.rng, -delta, delta), centerMin, centerMax);
  }

  corridor.segments.push({
    x0,
    x1,
    c0,
    c1,
    h0,
    h1,
    zoneKey: corridor.zoneKey,
    zoneStartX: corridor.zoneStartX,
    zoneEndX: corridor.zoneEndX,
  });

  corridor.state.center = c1;
  corridor.state.half = h1;
  corridor.nextX = x1;
}

function ensureCorridorCoverage(x, ahead) {
  const needTo = x + ahead;
  while (corridor.nextX < needTo) generateNextSegment();

  // Trim old segments.
  const keepBehind = 2600;
  while (corridor.segments.length && corridor.segments[0].x1 < x - keepBehind) {
    corridor.segments.shift();
  }
}

function corridorSample(x, hintIndex = 0) {
  const segs = corridor.segments;
  if (!segs.length) {
    return {
      yTop: 0,
      yBottom: view.h,
      zoneKey: "normal",
      center: view.h * 0.5,
    };
  }

  let i = clamp(hintIndex, 0, segs.length - 1);
  while (i > 0 && x < segs[i].x0) i--;
  while (i < segs.length - 1 && x > segs[i].x1) i++;
  const s = segs[i];

  const t = clamp(invLerp(s.x0, s.x1, x), 0, 1);
  let c = lerp(s.c0, s.c1, t);
  let h = lerp(s.h0, s.h1, t);
  const zt = clamp(invLerp(s.zoneStartX, s.zoneEndX, x), 0, 1);
  const zone = getZone(s.zoneKey);

  // Zone mechanics that affect the actual corridor bounds.
  // Pulse: corridor "breathes" (tightens/widens) and wobbles slightly.
  if (s.zoneKey === "pulse" && typeof game !== "undefined") {
    const osc = 0.80 + 0.18 * Math.sin(x * 0.012 + game.time * 4.2);
    const wob = 18 * Math.sin(x * 0.02 + game.time * 2.1);
    h = clamp(h * osc, 70, 2000);
    return {
      yTop: (c + wob) - h,
      yBottom: (c + wob) + h,
      zoneKey: s.zoneKey,
      center: c + wob,
      hintIndex: i,
      zoneStartX: s.zoneStartX,
      zoneEndX: s.zoneEndX,
    };
  }

  // SMASH: slowly shrinks while you are inside it.
  if (s.zoneKey === "smash") {
    // Shrink factor eases in (starts normal, ends tighter).
    const shrink = lerp(1.0, 0.70, easeOutCubic(zt));
    h = clamp(h * shrink, 60, 2000);
  }

  // Generic corridor modifiers (for many zones).
  if (zone.corridorMod && typeof game !== "undefined") {
    const m = zone.corridorMod;
    if (m.type === "centerSine") {
      const amp = m.amp ?? 80;
      const k = m.k ?? 0.01;
      const tf = m.timeFreq ?? 1.1;
      c += amp * Math.sin(x * k + game.time * tf);
    } else if (m.type === "widthSine") {
      const amp = m.amp ?? 0.18;
      const k = m.k ?? 0.012;
      const tf = m.timeFreq ?? 1.0;
      h = clamp(h * (1 + amp * Math.sin(x * k + game.time * tf)), 60, 2000);
    } else if (m.type === "widthEase") {
      const from = m.from ?? 1.0;
      const to = m.to ?? 0.75;
      const f = lerp(from, to, easeOutCubic(zt));
      h = clamp(h * f, 60, 2000);
    } else if (m.type === "centerEase") {
      const delta = m.delta ?? 120;
      c += delta * (easeOutCubic(zt) * 2 - 1);
    } else if (m.type === "centerSaw") {
      const amp = m.amp ?? 120;
      const period = m.period ?? 340;
      const f = ((x / period) % 1 + 1) % 1;
      const tri = f < 0.5 ? f * 2 : (1 - f) * 2;
      const sign = Math.sin(x * 0.003) >= 0 ? 1 : -1;
      c += sign * amp * (tri - 0.5);
    } else if (m.type === "quake") {
      const amp = m.amp ?? 14;
      c += amp * Math.sin(x * 0.07 + game.time * 22.0);
      h = clamp(h * (0.98 + 0.04 * Math.sin(x * 0.09 + game.time * 18.0)), 60, 2000);
    } else if (m.type === "centerMix") {
      const a1 = m.a1 ?? 90;
      const k1 = m.k1 ?? 0.01;
      const f1 = m.f1 ?? 1.1;
      const a2 = m.a2 ?? 70;
      const k2 = m.k2 ?? 0.018;
      const f2 = m.f2 ?? 1.7;
      const a3 = m.a3 ?? 40;
      const k3 = m.k3 ?? 0.028;
      const f3 = m.f3 ?? 2.2;
      c +=
        a1 * Math.sin(x * k1 + game.time * f1) +
        a2 * Math.sin(x * k2 + game.time * f2) +
        a3 * Math.sin(x * k3 + game.time * f3);
    } else if (m.type === "widthMix") {
      const a1 = m.a1 ?? 0.12;
      const k1 = m.k1 ?? 0.01;
      const f1 = m.f1 ?? 1.0;
      const a2 = m.a2 ?? 0.08;
      const k2 = m.k2 ?? 0.02;
      const f2 = m.f2 ?? 1.6;
      const mul = 1 + a1 * Math.sin(x * k1 + game.time * f1) + a2 * Math.sin(x * k2 + game.time * f2);
      h = clamp(h * mul, 60, 2000);
    } else if (m.type === "combo") {
      const ca1 = m.ca1 ?? 70;
      const ck1 = m.ck1 ?? 0.01;
      const cf1 = m.cf1 ?? 1.1;
      const ca2 = m.ca2 ?? 45;
      const ck2 = m.ck2 ?? 0.022;
      const cf2 = m.cf2 ?? 1.7;
      const wa1 = m.wa1 ?? 0.10;
      const wk1 = m.wk1 ?? 0.012;
      const wf1 = m.wf1 ?? 1.0;
      const wa2 = m.wa2 ?? 0.07;
      const wk2 = m.wk2 ?? 0.026;
      const wf2 = m.wf2 ?? 1.6;
      c += ca1 * Math.sin(x * ck1 + game.time * cf1) + ca2 * Math.sin(x * ck2 + game.time * cf2);
      const mul = 1 + wa1 * Math.sin(x * wk1 + game.time * wf1) + wa2 * Math.sin(x * wk2 + game.time * wf2);
      h = clamp(h * mul, 60, 2000);
    } else if (m.type === "centerQuant") {
      const step = m.step ?? 34;
      const amp = m.amp ?? 90;
      const k = m.k ?? 0.014;
      const tf = m.timeFreq ?? 1.4;
      const raw = amp * Math.sin(x * k + game.time * tf);
      const snapped = Math.round(raw / step) * step;
      c += snapped;
    } else if (m.type === "widthPulse") {
      const lo = m.lo ?? 0.72;
      const hi = m.hi ?? 1.12;
      const k = m.k ?? 0.014;
      const tf = m.timeFreq ?? 1.2;
      const u = 0.5 + 0.5 * Math.sin(x * k + game.time * tf);
      const mul = lerp(lo, hi, u);
      h = clamp(h * mul, 60, 2000);
    }
  }

  return {
    yTop: c - h,
    yBottom: c + h,
    zoneKey: s.zoneKey,
    center: c,
    hintIndex: i,
    zoneStartX: s.zoneStartX,
    zoneEndX: s.zoneEndX,
  };
}

const SPAWN_X = 200;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const $status = document.getElementById("status");
const $dist = document.getElementById("dist");
const $best = document.getElementById("best");
const $scoreFill = document.getElementById("scoreFill");
const $scoreText = document.getElementById("scoreText");
const $zone = document.getElementById("zone");
const $zoneDot = document.getElementById("zoneDot");
const $speed = document.getElementById("speed");
const $dual = document.getElementById("dual");
const $formBtn = document.getElementById("formBtn");
const $customBtn = document.getElementById("customBtn");
const $customPanel = document.getElementById("customPanel");
const $tightnessSelect = document.getElementById("tightnessSelect");
const $baseSpeedSelect = document.getElementById("baseSpeedSelect");
const $ogModeSelect = document.getElementById("ogModeSelect");
const $skinSelect = document.getElementById("skinSelect");
const $primaryColor = document.getElementById("primaryColor");
const $accentColor = document.getElementById("accentColor");
const $trailColor = document.getElementById("trailColor");
const $customClose = document.getElementById("customClose");
const $customReset = document.getElementById("customReset");
const $sectionsBtn = document.getElementById("sectionsBtn");
const $sectionsPanel = document.getElementById("sectionsPanel");
const $sectionsList = document.getElementById("sectionsList");
const $sectionsPlay = document.getElementById("sectionsPlay");
const $sectionsClose = document.getElementById("sectionsClose");
const $sectionsAll = document.getElementById("sectionsAll");
const $sectionsNone = document.getElementById("sectionsNone");
const $sectionsDefaults = document.getElementById("sectionsDefaults");

const view = {
  w: 0,
  h: 0,
  ratio: 1,
};

const dpr = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function resize() {
  view.ratio = dpr();
  view.w = window.innerWidth;
  view.h = window.innerHeight;

  canvas.width = Math.floor(view.w * view.ratio);
  canvas.height = Math.floor(view.h * view.ratio);
  canvas.style.width = `${view.w}px`;
  canvas.style.height = `${view.h}px`;

  // Draw in CSS pixels; the transform maps to device pixels.
  ctx.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- Input (hold = up, release = down) ---
const input = {
  holding: false,
  prevHolding: false,
  justPressed: false,
  restartQueued: false,
};

function setHolding(v) {
  // Don't change gameplay input while the customize panel is open.
  if ($customPanel && !$customPanel.classList.contains("hidden")) return;
  if ($sectionsPanel && !$sectionsPanel.classList.contains("hidden")) return;
  input.holding = v;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    setHolding(true);
    if (!game.player.alive) input.restartQueued = true;
  }
  if (e.code === "KeyE" && !e.repeat) {
    tryParry();
  }
  if (e.code === "KeyR") input.restartQueued = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") setHolding(false);
});

window.addEventListener("mousedown", () => setHolding(true));
window.addEventListener("mouseup", () => setHolding(false));

window.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    setHolding(true);
  },
  { passive: false }
);
window.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    setHolding(false);
  },
  { passive: false }
);

window.addEventListener("click", () => {
  // if dead, click restarts (matches common GD restart habit)
  if (!game.player.alive) input.restartQueued = true;
});

function setStatusForForm(formKey) {
  if (formKey === "wave") {
    $status.textContent = "Hold to go up · Release to go down";
  } else if (formKey === "ship") {
    $status.textContent = "Ship: hold to thrust (inverted zones flip gravity)";
  } else {
    $status.textContent = "UFO: tap to jump (inverted zones flip gravity)";
  }
}

const FORMS = [
  { key: "wave", name: "Wave" },
  { key: "ship", name: "Ship" },
  { key: "ufo", name: "UFO" },
];

function cycleForm() {
  const i = FORMS.findIndex((f) => f.key === game.formKey);
  const next = FORMS[(i + 1 + FORMS.length) % FORMS.length];
  game.formKey = next.key;
  $formBtn.textContent = next.name;
  setStatusForForm(next.key);

  // Reset vertical velocity when switching forms (avoids weird carry-over).
  game.player.vy = 0;
}

// Make the top-left "Wave" pill clickable without triggering gameplay input.
if ($formBtn) {
  $formBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  $formBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  $formBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    cycleForm();
  });
}

// --- Game constants (tuned to feel like base Wave) ---
const GAME = {
  xSpeed: 520, // px/sec (CSS pixels)
  slopeFactor: 1.0, // 1.0 = 45° (ySpeed = xSpeed)
  radius: 6, // hitbox radius
  trailMax: 140,
  cameraLead: 320, // how far ahead the camera looks
  shipGravity: 1500, // px/sec^2 (lighter ship)
  shipThrust: 2850, // px/sec^2 (more thrust)
  shipMaxVy: 980, // px/sec
  shipDrag: 1.6, // 1/sec (smooths ship motion)
  ufoGravity: 1750, // px/sec^2
  ufoJumpVy: 560, // px/sec (less powerful)
  ufoBufferSeconds: 0.10, // jump buffer window
};

const FORM_SPEED = {
  wave: 1.0,
  ship: 1.0,
  ufo: 0.92, // slower UFO
};

const ZONE_STYLES = {
  normal: { stroke: "rgba(170, 220, 255, 0.92)", glow: "rgba(130, 190, 255, 0.45)", fill: "rgba(34, 50, 80, 0.20)", dot: "rgba(170, 220, 255, 0.90)" },
  speed: { stroke: "rgba(255, 226, 140, 0.92)", glow: "rgba(255, 210, 120, 0.45)", fill: "rgba(90, 70, 20, 0.18)", dot: "rgba(255, 226, 140, 0.95)" },
  tight: { stroke: "rgba(255, 140, 170, 0.92)", glow: "rgba(255, 120, 150, 0.45)", fill: "rgba(80, 24, 40, 0.18)", dot: "rgba(255, 140, 170, 0.95)" },
  zigzag: { stroke: "rgba(150, 255, 185, 0.92)", glow: "rgba(120, 255, 165, 0.45)", fill: "rgba(20, 70, 45, 0.18)", dot: "rgba(150, 255, 185, 0.95)" },
  dual: { stroke: "rgba(210, 170, 255, 0.92)", glow: "rgba(190, 140, 255, 0.45)", fill: "rgba(55, 20, 80, 0.18)", dot: "rgba(210, 170, 255, 0.95)" },
  inverted: { stroke: "rgba(150, 220, 255, 0.92)", glow: "rgba(120, 210, 255, 0.45)", fill: "rgba(20, 55, 80, 0.18)", dot: "rgba(150, 220, 255, 0.95)" },
  boost: { stroke: "rgba(120, 255, 245, 0.92)", glow: "rgba(90, 255, 235, 0.45)", fill: "rgba(10, 70, 70, 0.18)", dot: "rgba(120, 255, 245, 0.95)" },
  pulse: { stroke: "rgba(255, 255, 255, 0.92)", glow: "rgba(255, 255, 255, 0.32)", fill: "rgba(40, 40, 60, 0.18)", dot: "rgba(255, 255, 255, 0.92)" },
  glitch: { stroke: "rgba(180, 255, 120, 0.92)", glow: "rgba(160, 255, 100, 0.42)", fill: "rgba(35, 70, 10, 0.18)", dot: "rgba(180, 255, 120, 0.95)" },
  rampup: { stroke: "rgba(255, 240, 170, 0.92)", glow: "rgba(255, 240, 170, 0.38)", fill: "rgba(70, 60, 20, 0.18)", dot: "rgba(255, 240, 170, 0.95)" },
  rampdown: { stroke: "rgba(200, 255, 255, 0.92)", glow: "rgba(200, 255, 255, 0.35)", fill: "rgba(20, 70, 70, 0.18)", dot: "rgba(200, 255, 255, 0.95)" },
  sine: { stroke: "rgba(140, 200, 255, 0.92)", glow: "rgba(140, 200, 255, 0.40)", fill: "rgba(18, 45, 75, 0.18)", dot: "rgba(140, 200, 255, 0.95)" },
  squeeze: { stroke: "rgba(255, 170, 170, 0.92)", glow: "rgba(255, 150, 150, 0.40)", fill: "rgba(70, 18, 18, 0.18)", dot: "rgba(255, 170, 170, 0.95)" },
  expand: { stroke: "rgba(170, 255, 220, 0.92)", glow: "rgba(150, 255, 210, 0.40)", fill: "rgba(10, 70, 55, 0.18)", dot: "rgba(170, 255, 220, 0.95)" },
  saw: { stroke: "rgba(255, 200, 255, 0.92)", glow: "rgba(255, 170, 255, 0.40)", fill: "rgba(70, 20, 70, 0.18)", dot: "rgba(255, 200, 255, 0.95)" },
  offset: { stroke: "rgba(255, 210, 160, 0.92)", glow: "rgba(255, 190, 140, 0.40)", fill: "rgba(70, 35, 10, 0.18)", dot: "rgba(255, 210, 160, 0.95)" },
  quake: { stroke: "rgba(240, 240, 240, 0.92)", glow: "rgba(240, 240, 240, 0.30)", fill: "rgba(40, 40, 40, 0.18)", dot: "rgba(240, 240, 240, 0.95)" },
  strobe: { stroke: "rgba(255, 255, 255, 0.92)", glow: "rgba(255, 255, 255, 0.55)", fill: "rgba(10, 10, 10, 0.18)", dot: "rgba(255, 255, 255, 0.95)" },
  laser: { stroke: "rgba(255, 120, 200, 0.92)", glow: "rgba(255, 120, 200, 0.45)", fill: "rgba(70, 10, 40, 0.18)", dot: "rgba(255, 120, 200, 0.95)" },
  dblaser: { stroke: "rgba(255, 140, 255, 0.92)", glow: "rgba(255, 140, 255, 0.45)", fill: "rgba(70, 10, 70, 0.18)", dot: "rgba(255, 140, 255, 0.95)" },
  gate: { stroke: "rgba(255, 170, 120, 0.92)", glow: "rgba(255, 170, 120, 0.45)", fill: "rgba(70, 30, 10, 0.18)", dot: "rgba(255, 170, 120, 0.95)" },
  lowgrav: { stroke: "rgba(160, 255, 255, 0.92)", glow: "rgba(140, 255, 255, 0.42)", fill: "rgba(10, 70, 70, 0.18)", dot: "rgba(160, 255, 255, 0.95)" },
  highgrav: { stroke: "rgba(255, 160, 120, 0.92)", glow: "rgba(255, 160, 120, 0.42)", fill: "rgba(70, 25, 10, 0.18)", dot: "rgba(255, 160, 120, 0.95)" },
  slippery: { stroke: "rgba(120, 200, 255, 0.92)", glow: "rgba(120, 200, 255, 0.42)", fill: "rgba(10, 45, 75, 0.18)", dot: "rgba(120, 200, 255, 0.95)" },
  sticky: { stroke: "rgba(255, 180, 120, 0.92)", glow: "rgba(255, 180, 120, 0.42)", fill: "rgba(70, 35, 10, 0.18)", dot: "rgba(255, 180, 120, 0.95)" },
  steep: { stroke: "rgba(140, 255, 170, 0.92)", glow: "rgba(140, 255, 170, 0.42)", fill: "rgba(10, 70, 25, 0.18)", dot: "rgba(140, 255, 170, 0.95)" },
  shallow: { stroke: "rgba(170, 200, 255, 0.92)", glow: "rgba(170, 200, 255, 0.42)", fill: "rgba(10, 35, 70, 0.18)", dot: "rgba(170, 200, 255, 0.95)" },
  micro: { stroke: "rgba(200, 255, 200, 0.92)", glow: "rgba(200, 255, 200, 0.42)", fill: "rgba(20, 70, 20, 0.18)", dot: "rgba(200, 255, 200, 0.95)" },
  fat: { stroke: "rgba(255, 200, 200, 0.92)", glow: "rgba(255, 200, 200, 0.42)", fill: "rgba(70, 20, 20, 0.18)", dot: "rgba(255, 200, 200, 0.95)" },
  echo: { stroke: "rgba(200, 200, 255, 0.92)", glow: "rgba(200, 200, 255, 0.42)", fill: "rgba(25, 25, 70, 0.18)", dot: "rgba(200, 200, 255, 0.95)" },
  fade: { stroke: "rgba(220, 220, 220, 0.92)", glow: "rgba(220, 220, 220, 0.28)", fill: "rgba(35, 35, 35, 0.18)", dot: "rgba(220, 220, 220, 0.95)" },
  blackout: { stroke: "rgba(30, 30, 30, 0.92)", glow: "rgba(255, 255, 255, 0.10)", fill: "rgba(0, 0, 0, 0.22)", dot: "rgba(30, 30, 30, 0.95)" },
  flipfast: { stroke: "rgba(255, 255, 170, 0.92)", glow: "rgba(255, 255, 170, 0.40)", fill: "rgba(70, 70, 20, 0.18)", dot: "rgba(255, 255, 170, 0.95)" },
  attractor: { stroke: "rgba(160, 170, 255, 0.92)", glow: "rgba(140, 150, 255, 0.42)", fill: "rgba(25, 30, 80, 0.18)", dot: "rgba(160, 170, 255, 0.95)" },
  smash: { stroke: "rgba(255, 120, 80, 0.92)", glow: "rgba(255, 105, 65, 0.45)", fill: "rgba(80, 25, 10, 0.18)", dot: "rgba(255, 120, 80, 0.95)" },
  reverse: { stroke: "rgba(255, 255, 255, 0.92)", glow: "rgba(255, 255, 255, 0.55)", fill: "rgba(60, 60, 60, 0.18)", dot: "rgba(255, 255, 255, 0.95)" },
  flip: { stroke: "rgba(255, 255, 170, 0.92)", glow: "rgba(255, 255, 130, 0.40)", fill: "rgba(70, 70, 20, 0.18)", dot: "rgba(255, 255, 170, 0.95)" },
  magnet: { stroke: "rgba(160, 170, 255, 0.92)", glow: "rgba(140, 150, 255, 0.42)", fill: "rgba(25, 30, 80, 0.18)", dot: "rgba(160, 170, 255, 0.95)" },
  wind: { stroke: "rgba(150, 255, 220, 0.92)", glow: "rgba(120, 255, 200, 0.42)", fill: "rgba(10, 75, 55, 0.18)", dot: "rgba(150, 255, 220, 0.95)" },
  tiny: { stroke: "rgba(255, 200, 255, 0.92)", glow: "rgba(255, 160, 255, 0.42)", fill: "rgba(70, 20, 70, 0.18)", dot: "rgba(255, 200, 255, 0.95)" },
  fog: { stroke: "rgba(200, 210, 220, 0.92)", glow: "rgba(200, 210, 220, 0.32)", fill: "rgba(30, 35, 40, 0.18)", dot: "rgba(200, 210, 220, 0.95)" },
};

function zoneStyle(key) {
  const known = ZONE_STYLES[key];
  if (known) return known;

  // Deterministic generated palette for new zone keys.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = h % 360;
  const stroke = `hsla(${hue}, 90%, 72%, 0.92)`;
  const glow = `hsla(${hue}, 90%, 70%, 0.42)`;
  const fill = `hsla(${hue}, 45%, 22%, 0.18)`;
  const dot = `hsla(${hue}, 90%, 72%, 0.95)`;
  return { stroke, glow, fill, dot };
}

const CUSTOM_STORAGE_KEY = "gd_custom_v1";
const DEFAULT_CUSTOM = {
  baseSpeed: 1.0,
  tightness: 1.0,
  ogMode: false,
  skin: "classic",
  primary: "#dcfaff",
  accent: "#ffe6ff",
  trail: "#d2f5ff",
};

function loadCustom() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM };
    const data = JSON.parse(raw);
    return {
      baseSpeed:
        typeof data.baseSpeed === "number"
          ? clamp(data.baseSpeed, 0.25, 2.0)
          : DEFAULT_CUSTOM.baseSpeed,
      tightness:
        typeof data.tightness === "number"
          ? clamp(data.tightness, 0.75, 1.6)
          : DEFAULT_CUSTOM.tightness,
      ogMode: typeof data.ogMode === "boolean" ? data.ogMode : DEFAULT_CUSTOM.ogMode,
      skin: typeof data.skin === "string" ? data.skin : DEFAULT_CUSTOM.skin,
      primary: typeof data.primary === "string" ? data.primary : DEFAULT_CUSTOM.primary,
      accent: typeof data.accent === "string" ? data.accent : DEFAULT_CUSTOM.accent,
      trail: typeof data.trail === "string" ? data.trail : DEFAULT_CUSTOM.trail,
    };
  } catch {
    return { ...DEFAULT_CUSTOM };
  }
}

function saveCustom(custom) {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // ignore
  }
}

let custom = loadCustom();

function applyCustomToUI() {
  if ($baseSpeedSelect) $baseSpeedSelect.value = custom.baseSpeed.toFixed(2);
  if ($tightnessSelect) $tightnessSelect.value = custom.tightness.toFixed(2);
  if ($ogModeSelect) $ogModeSelect.value = custom.ogMode ? "on" : "off";
  if ($skinSelect) $skinSelect.value = custom.skin;
  if ($primaryColor) $primaryColor.value = custom.primary;
  if ($accentColor) $accentColor.value = custom.accent;
  if ($trailColor) $trailColor.value = custom.trail;
}

function updateCustomFromUI() {
  if ($baseSpeedSelect) custom.baseSpeed = clamp(parseFloat($baseSpeedSelect.value), 0.25, 2.0);
  if ($tightnessSelect) custom.tightness = clamp(parseFloat($tightnessSelect.value), 0.75, 1.6);
  if ($ogModeSelect) custom.ogMode = $ogModeSelect.value === "on";
  if ($skinSelect) custom.skin = $skinSelect.value;
  if ($primaryColor) custom.primary = $primaryColor.value;
  if ($accentColor) custom.accent = $accentColor.value;
  if ($trailColor) custom.trail = $trailColor.value;
  saveCustom(custom);

  // If OG mode is enabled, strip generated sections from the pool immediately.
  if (custom.ogMode) {
    for (const k of [...game.enabledZones]) {
      if (isGeneratedZoneKey(k)) game.enabledZones.delete(k);
    }
    if (!game.enabledZones.size) game.enabledZones.add("normal");
    saveEnabledKeys(game.enabledZones);
    if ($sectionsPanel && !$sectionsPanel.classList.contains("hidden")) buildSectionsList();
  }
}

function openCustom(open) {
  if (!$customPanel) return;
  if (open) {
    $customPanel.classList.remove("hidden");
  } else {
    $customPanel.classList.add("hidden");
  }
}

function stopEvt(e) {
  e.preventDefault();
  e.stopPropagation();
}

function openSections(open) {
  if (!$sectionsPanel) return;
  if (open) {
    $sectionsPanel.classList.remove("hidden");
    game.running = false;
  } else {
    $sectionsPanel.classList.add("hidden");
    // only resume if not dead
    if (game.player.alive) game.running = true;
  }
}

function buildSectionsList() {
  if (!$sectionsList) return;
  $sectionsList.innerHTML = "";

  const og = !!custom?.ogMode;
  for (const z of ZONES) {
    if (og && isGeneratedZoneKey(z.key)) continue;
    // All zones are pickable.
    const item = document.createElement("div");
    item.className = "section-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = game.enabledZones.has(z.key);
    cb.addEventListener("change", () => {
      if (cb.checked) game.enabledZones.add(z.key);
      else game.enabledZones.delete(z.key);
      // Never allow empty: fall back to Normal.
      if (!game.enabledZones.size) game.enabledZones.add("normal");
      saveEnabledKeys(game.enabledZones);
    });

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "section-title";

    const badge = document.createElement("span");
    badge.className = "section-badge";
    badge.style.background = zoneStyle(z.key).dot;

    const name = document.createElement("span");
    name.textContent = z.name;

    title.appendChild(badge);
    title.appendChild(name);

    const desc = document.createElement("div");
    desc.className = "section-desc";
    desc.textContent = z.desc || "";

    body.appendChild(title);
    body.appendChild(desc);

    item.appendChild(cb);
    item.appendChild(body);
    $sectionsList.appendChild(item);
  }
}

const game = {
  time: 0,
  running: true,
  enabledZones: loadEnabledKeys(),
  activeZoneKey: "normal",
  dualActive: false,
  formKey: "wave",
  reverseActive: false,
  totalDist: 0,
  bestDist: 0,
  rng: mulberry32(1),
  parry: { activeUntil: 0, cooldownUntil: 0, used: false },
  zoneState: {
    flipSign: 1,
    nextFlipT: 0,
    windForce: 0,
    nextWindT: 0,
    flipFastSign: 1,
    nextFlipFastT: 0,
  },
  glitch: { nextTpT: 0, cooldown: 0 },
  boost: { active: false, nextX: 0, until: 0, mul: 1.0 },
  fx: { shakeLeft: 0, shakeTotal: 0, shakeMag: 0, texts: [], particles: [] },
  prev: { x: 0, y: 0, vy: 0, x2: 0, y2: 0 },
  render: { reverse: false, w: 0 },
  player: { x: 0, y: 0, vy: 0, alive: true },
  controls: { shipThrust01: 0, ufoBufferedUntil: 0 },
  player2: { x: 0, y: 0, alive: true },
  trail: [],
  trail2: [],
};

function parryActive() {
  return game.time <= (game.parry.activeUntil ?? 0);
}

function tryParry() {
  // Don't allow parry while menus are open.
  if ($customPanel && !$customPanel.classList.contains("hidden")) return;
  if ($sectionsPanel && !$sectionsPanel.classList.contains("hidden")) return;
  if (!game.player.alive) return;
  if (game.time < (game.parry.cooldownUntil ?? 0)) return;

  game.parry.used = false;
  game.parry.activeUntil = game.time + 0.18;
  game.parry.cooldownUntil = game.time + 1.05;
  fxText("PARRY", "rgba(255,255,255,0.92)", 44, 0.35);
  triggerShake(6, 0.10);
  const col = rgbaFromHex(custom.trail || custom.primary, 0.75);
  spawnParticles(game.player.x, game.player.y, 18, 240, 0.35, col, 0.9);
}

function spawnParticles(x, y, count, speed, life, color, spread = 1) {
  for (let i = 0; i < count; i++) {
    const a = (Math.random() * 2 - 1) * Math.PI * spread;
    const s = speed * (0.55 + Math.random() * 0.75);
    game.fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      t: 0,
      life,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
  if (game.fx.particles.length > 700) game.fx.particles.splice(0, game.fx.particles.length - 700);
}

function stepParticles(dt) {
  const p = game.fx.particles;
  for (let i = p.length - 1; i >= 0; i--) {
    const it = p[i];
    it.t += dt;
    if (it.t >= it.life) {
      p.splice(i, 1);
      continue;
    }
    it.vx *= 1 - 1.8 * dt;
    it.vy *= 1 - 1.8 * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
  }
}

const BEST_STORAGE_KEY = "gd_best_v1";

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_STORAGE_KEY);
    const n = raw ? parseFloat(raw) : 0;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

function saveBest(v) {
  try {
    localStorage.setItem(BEST_STORAGE_KEY, String(Math.max(0, v)));
  } catch {
    // ignore
  }
}

function updateScoreHud() {
  const cur = Math.floor(game.totalDist);
  const best = Math.floor(game.bestDist);
  if ($dist) $dist.textContent = cur.toString();
  if ($best) $best.textContent = best.toString();
  if ($scoreFill && $scoreText) {
    const pct = best > 0 ? clamp(cur / best, 0, 1) : 1;
    $scoreFill.style.width = `${(pct * 100).toFixed(1)}%`;
    $scoreText.textContent = best > 0 ? `${Math.floor(pct * 100)}% of best` : "Set a best!";
  }
}

function enterReverseSection() {
  // Flip direction visually and start a fresh generated section.
  game.reverseActive = !game.reverseActive;

  fxText("REVERSE", zoneStyle("reverse").stroke, 62, 0.75);
  triggerShake(14, 0.22);

  // Fresh generation
  const seed = (Date.now() ^ ((Math.random() * 2 ** 32) >>> 0)) >>> 0;
  game.rng = mulberry32(seed ^ 0x7f4a7c15);
  resetCorridor(seed);
  ensureCorridorCoverage(SPAWN_X, Math.max(2400, view.w + 1200));

  // Reset local section state (but keep totalDist/best)
  const spawn = corridorSample(SPAWN_X);
  game.player.x = SPAWN_X;
  game.player.y = spawn.center;
  game.player.vy = 0;

  game.dualActive = false;
  game.player2.x = SPAWN_X;
  game.player2.y = spawn.center;

  game.trail.length = 0;
  game.trail2.length = 0;

  game.boost.active = false;
  game.boost.nextX = 0;
  game.boost.until = 0;
  game.boost.mul = 1.0;

  game.glitch.nextTpT = 0;
  game.glitch.cooldown = 0;

  game.activeZoneKey = "normal";
  $zone.textContent = getZone(game.activeZoneKey).name;
  if ($zoneDot) $zoneDot.style.background = zoneStyle(game.activeZoneKey).dot;
  $dual.textContent = "Off";

  game.prev.x = game.player.x;
  game.prev.y = game.player.y;
  game.prev.vy = game.player.vy;
  game.prev.x2 = game.player2.x;
  game.prev.y2 = game.player2.y;

  updateScoreHud();
}

function zoneProgress(here, x) {
  const a = typeof here.zoneStartX === "number" ? here.zoneStartX : x;
  const b = typeof here.zoneEndX === "number" ? here.zoneEndX : x + 1;
  return clamp(invLerp(a, b, x), 0, 1);
}

function zoneSpeedFactor(zone, prog) {
  let mul = 1.0;
  if (zone.speedRamp) {
    const from = zone.speedRamp.from ?? 1.0;
    const to = zone.speedRamp.to ?? 1.0;
    mul *= lerp(from, to, easeOutCubic(prog));
  }
  return mul;
}

function hazardInfo(zone, x, t, sample) {
  if (!zone.hazard) return null;
  const hz = zone.hazard;

  const gap = sample.yBottom - sample.yTop;
  // Ensure hazards always leave a playable safe region.
  const rBase = GAME.radius * (zone.radiusMul ?? 1.0);
  const minClear = clamp(Math.max(14, rBase * 1.2), 14, 46); // space to wall
  const minPass = clamp(Math.max(2 * rBase + 34, gap * 0.22), 60, 140); // space to dodge

  if (hz.type === "laser") {
    let amp = hz.amp ?? 120;
    const freq = hz.freq ?? 2.5;
    let thick = hz.thick ?? 10;

    // Clamp thickness so there is always room above/below.
    thick = clamp(thick, 6, Math.max(6, gap - 2 * minClear - minPass));
    // Clamp amplitude so it doesn't shove the laser into the wall region.
    amp = clamp(amp, 0, Math.max(0, (gap - 2 * minClear - thick) * 0.5));

    const rawY = sample.center + amp * Math.sin(t * freq + x * 0.01);
    const y = clamp(rawY, sample.yTop + minClear + thick * 0.5, sample.yBottom - minClear - thick * 0.5);
    return [{ y, thick, colorKey: zone.key }];
  }
  if (hz.type === "dblaser") {
    let amp = hz.amp ?? 120;
    const freq = hz.freq ?? 2.1;
    let thick = hz.thick ?? 9;
    let sep = hz.sep ?? 120;

    // Ensure there is a safe channel between lasers and walls.
    thick = clamp(thick, 6, Math.max(6, (gap - 2 * minClear) * 0.22));
    const maxSep = Math.max(0, gap - 2 * minClear - thick * 2);
    if (maxSep <= 6) {
      // Too tight for a stable double-laser; degrade to a single laser.
      const freq2 = hz.freq ?? 2.1;
      const thick2 = clamp(thick, 6, Math.max(6, gap - 2 * minClear - minPass));
      const amp2 = clamp(amp, 0, Math.max(0, (gap - 2 * minClear - thick2) * 0.5));
      const rawY = sample.center + amp2 * Math.sin(t * freq2 + x * 0.012);
      const y = clamp(rawY, sample.yTop + minClear + thick2 * 0.5, sample.yBottom - minClear - thick2 * 0.5);
      return [{ y, thick: thick2, colorKey: zone.key }];
    }
    // Prefer wide separation so the center lane is always usable.
    sep = clamp(sep, maxSep * 0.65, maxSep);
    // Keep amplitude small enough that lines never squeeze the safe lane shut.
    const ampMaxWalls = Math.max(0, (gap - 2 * minClear - thick * 2 - sep) * 0.5);
    const ampMaxSep = Math.max(0, sep * 0.35);
    amp = clamp(amp, 0, Math.min(ampMaxWalls, ampMaxSep));

    const s = Math.sin(t * freq + x * 0.012);
    const raw1 = sample.center + sep * 0.5 + amp * s;
    const raw2 = sample.center - sep * 0.5 - amp * s;
    // Clamp individually inside walls (keep ordering).
    let y1 = clamp(raw1, sample.yTop + minClear + thick * 0.5, sample.yBottom - minClear - thick * 0.5);
    let y2 = clamp(raw2, sample.yTop + minClear + thick * 0.5, sample.yBottom - minClear - thick * 0.5);
    if (y2 > y1) {
      const tmp = y1;
      y1 = y2;
      y2 = tmp;
    }
    return [
      { y: y1, thick, colorKey: zone.key },
      { y: y2, thick, colorKey: zone.key },
    ];
  }
  if (hz.type === "gate") {
    let amp = hz.amp ?? 140;
    const freq = hz.freq ?? 1.8;
    let thick = hz.thick ?? 38;

    // Thick forbidden band must leave room on at least one side.
    thick = clamp(thick, 10, Math.max(10, gap - 2 * minClear - minPass));
    amp = clamp(amp, 0, Math.max(0, (gap - 2 * minClear - thick) * 0.5));

    const rawY = sample.center + amp * Math.sin(t * freq + x * 0.008);
    const y = clamp(rawY, sample.yTop + minClear + thick * 0.5, sample.yBottom - minClear - thick * 0.5);
    return [{ y, thick, colorKey: zone.key, fillBand: true }];
  }
  return null;
}

function checkHazardsAt(zone, x, t, sample, y, r) {
  const list = hazardInfo(zone, x, t, sample);
  if (!list) return false;
  for (const it of list) {
    if (Math.abs(y - it.y) <= it.thick * 0.5 + r) return true;
  }
  return false;
}

function fxText(text, color, size = 46, dur = 0.9) {
  game.fx.texts.push({ text, color, size, start: game.time, dur });
  // keep small
  if (game.fx.texts.length > 8) game.fx.texts.shift();
}

function triggerShake(mag, dur) {
  if (dur <= 0) return;
  if (game.fx.shakeLeft <= 0 || mag >= game.fx.shakeMag) {
    game.fx.shakeMag = mag;
    game.fx.shakeTotal = dur;
    game.fx.shakeLeft = dur;
  } else {
    game.fx.shakeLeft = Math.max(game.fx.shakeLeft, dur);
    game.fx.shakeTotal = Math.max(game.fx.shakeTotal, dur);
  }
}

function restart() {
  game.time = 0;
  game.bestDist = loadBest();
  game.totalDist = 0;

  game.trail.length = 0;
  game.trail2.length = 0;
  game.fx.texts.length = 0;
  game.fx.particles.length = 0;
  game.fx.shakeLeft = 0;
  game.fx.shakeTotal = 0;
  game.fx.shakeMag = 0;
  game.controls.shipThrust01 = 0;
  game.controls.ufoBufferedUntil = 0;

  // Arcade: infinite corridor + zones.
  const seed = (Date.now() ^ ((Math.random() * 2 ** 32) >>> 0)) >>> 0;
  game.rng = mulberry32(seed ^ 0x9e3779b9);
  resetCorridor(seed);
  ensureCorridorCoverage(SPAWN_X, Math.max(2400, view.w + 1200));

  game.player.x = SPAWN_X;
  const spawnSample = corridorSample(game.player.x);
  game.player.y = spawnSample.center;
  game.player.vy = 0;
  game.player.alive = true;

  game.dualActive = false;
  game.player2.alive = true;
  game.player2.x = game.player.x;
  game.player2.y = game.player.y;

  game.reverseActive = false;

  game.activeZoneKey = "normal";
  game.zoneState.flipSign = 1;
  game.zoneState.nextFlipT = 0;
  game.zoneState.windForce = 0;
  game.zoneState.nextWindT = 0;
  game.zoneState.flipFastSign = 1;
  game.zoneState.nextFlipFastT = 0;
  game.boost.active = false;
  game.boost.nextX = 0;
  game.boost.until = 0;
  game.boost.mul = 1.0;
  game.glitch.nextTpT = 0;
  game.glitch.cooldown = 0;

  setStatusForForm(game.formKey);
  $zone.textContent = getZone(game.activeZoneKey).name;
  if ($zoneDot) $zoneDot.style.background = zoneStyle(game.activeZoneKey).dot;
  $speed.textContent = "1.00x";
  $dual.textContent = "Off";
  $formBtn.textContent = FORMS.find((f) => f.key === game.formKey)?.name ?? "Wave";

  game.prev.x = game.player.x;
  game.prev.y = game.player.y;
  game.prev.vy = game.player.vy;
  game.prev.x2 = game.player2.x;
  game.prev.y2 = game.player2.y;

  updateScoreHud();
}
restart();

// If OG mode is enabled, never allow generated sections in the pool (even if saved before).
if (custom.ogMode) {
  for (const k of [...game.enabledZones]) {
    if (isGeneratedZoneKey(k)) game.enabledZones.delete(k);
  }
  if (!game.enabledZones.size) game.enabledZones.add("normal");
  saveEnabledKeys(game.enabledZones);
}

// Show the Sections menu on first load.
buildSectionsList();
openSections(true);

// --- Customize UI wiring ---
applyCustomToUI();
if ($customBtn) {
  $customBtn.addEventListener("mousedown", stopEvt);
  $customBtn.addEventListener("touchstart", stopEvt, { passive: false });
  $customBtn.addEventListener("click", (e) => {
    stopEvt(e);
    applyCustomToUI();
    openCustom(true);
  });
}
if ($customClose) {
  $customClose.addEventListener("mousedown", stopEvt);
  $customClose.addEventListener("click", (e) => {
    stopEvt(e);
    updateCustomFromUI();
    openCustom(false);
  });
}
if ($customPanel) {
  $customPanel.addEventListener("mousedown", (e) => {
    if (e.target === $customPanel) openCustom(false);
  });
}
if ($customReset) {
  $customReset.addEventListener("mousedown", stopEvt);
  $customReset.addEventListener("click", (e) => {
    stopEvt(e);
    custom = { ...DEFAULT_CUSTOM };
    applyCustomToUI();
    saveCustom(custom);
  });
}
for (const el of [$skinSelect, $primaryColor, $accentColor, $trailColor]) {
  if (!el) continue;
  el.addEventListener("input", () => updateCustomFromUI());
}

if ($baseSpeedSelect) {
  $baseSpeedSelect.addEventListener("input", () => updateCustomFromUI());
}

if ($tightnessSelect) {
  $tightnessSelect.addEventListener("input", () => updateCustomFromUI());
}

if ($ogModeSelect) {
  $ogModeSelect.addEventListener("input", () => updateCustomFromUI());
}

// --- Sections UI wiring ---
if ($sectionsBtn) {
  $sectionsBtn.addEventListener("mousedown", stopEvt);
  $sectionsBtn.addEventListener("touchstart", stopEvt, { passive: false });
  $sectionsBtn.addEventListener("click", (e) => {
    stopEvt(e);
    buildSectionsList();
    openSections(true);
  });
}
if ($sectionsClose) {
  $sectionsClose.addEventListener("mousedown", stopEvt);
  $sectionsClose.addEventListener("click", (e) => {
    stopEvt(e);
    openSections(false);
  });
}
if ($sectionsPanel) {
  $sectionsPanel.addEventListener("mousedown", (e) => {
    if (e.target === $sectionsPanel) openSections(false);
  });
}
if ($sectionsPlay) {
  $sectionsPlay.addEventListener("mousedown", stopEvt);
  $sectionsPlay.addEventListener("click", (e) => {
    stopEvt(e);
    saveEnabledKeys(game.enabledZones);
    openSections(false);
    restart();
    game.running = true;
  });
}
if ($sectionsAll) {
  $sectionsAll.addEventListener("mousedown", stopEvt);
  $sectionsAll.addEventListener("click", (e) => {
    stopEvt(e);
    const og = !!custom?.ogMode;
    game.enabledZones = new Set(
      ZONES.filter((z) => !og || !isGeneratedZoneKey(z.key)).map((z) => z.key)
    );
    saveEnabledKeys(game.enabledZones);
    buildSectionsList();
  });
}
if ($sectionsNone) {
  $sectionsNone.addEventListener("mousedown", stopEvt);
  $sectionsNone.addEventListener("click", (e) => {
    stopEvt(e);
    game.enabledZones = new Set(["normal"]);
    saveEnabledKeys(game.enabledZones);
    buildSectionsList();
  });
}
if ($sectionsDefaults) {
  $sectionsDefaults.addEventListener("mousedown", stopEvt);
  $sectionsDefaults.addEventListener("click", (e) => {
    stopEvt(e);
    game.enabledZones = defaultEnabledKeys();
    if (custom.ogMode) {
      for (const k of [...game.enabledZones]) {
        if (isGeneratedZoneKey(k)) game.enabledZones.delete(k);
      }
      if (!game.enabledZones.size) game.enabledZones.add("normal");
    }
    saveEnabledKeys(game.enabledZones);
    buildSectionsList();
  });
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    buildSectionsList();
    openSections(true);
  }
  if (e.code === "Escape") {
    if ($sectionsPanel && !$sectionsPanel.classList.contains("hidden")) openSections(false);
    if ($customPanel && !$customPanel.classList.contains("hidden")) openCustom(false);
  }
});

function die() {
  if (!game.player.alive) return;
  game.player.alive = false;
  game.player2.alive = false;
  $status.textContent = "Dead. Click or press R to restart.";

  // Death burst
  const c1 = rgbaFromHex(custom.primary, 0.95);
  spawnParticles(game.player.x, game.player.y, 60, 420, 0.7, c1, 1);
  if (game.dualActive) {
    const c2 = rgbaFromHex(custom.accent, 0.9);
    spawnParticles(game.player2.x, game.player2.y, 45, 380, 0.65, c2, 1);
  }
  triggerShake(18, 0.28);

  if (game.totalDist > game.bestDist) {
    game.bestDist = game.totalDist;
    saveBest(game.bestDist);
    updateScoreHud();
    fxText("NEW BEST!", "rgba(255,255,255,0.95)", 56, 0.9);
    triggerShake(10, 0.22);
  }
}

// --- Fixed timestep for crisp collision ---
const FIXED_DT = 1 / 240;
let lastT = performance.now() / 1000;
let acc = 0;
let renderAlpha = 0;

function frame() {
  const now = performance.now() / 1000;
  let dt = now - lastT;
  lastT = now;
  dt = Math.min(dt, 0.05);
  acc += dt;

  if (input.restartQueued) {
    input.restartQueued = false;
    restart();
  }

  if (game.running) {
    while (acc >= FIXED_DT) {
      step(FIXED_DT);
      acc -= FIXED_DT;
    }
  } else {
    // Don't accumulate forever while paused.
    acc = Math.min(acc, FIXED_DT);
  }

  renderAlpha = clamp(acc / FIXED_DT, 0, 1);
  render(renderAlpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function step(dt) {
  if (!game.player.alive) return;

  // Save previous state for interpolation (smooth ship/UFO).
  game.prev.x = game.player.x;
  game.prev.y = game.player.y;
  game.prev.vy = game.player.vy;
  game.prev.x2 = game.player2.x;
  game.prev.y2 = game.player2.y;

  game.time += dt;

  // Edge-trigger input (used by UFO).
  input.justPressed = input.holding && !input.prevHolding;
  if (input.justPressed) game.controls.ufoBufferedUntil = game.time + GAME.ufoBufferSeconds;

  // Keep corridor generated ahead of the player.
  ensureCorridorCoverage(game.player.x, Math.max(2400, view.w + 1200));

  // Zone at the player's position controls speed/mode/invert.
  const here = corridorSample(game.player.x);
  const zone = getZone(here.zoneKey);

  if (here.zoneKey !== game.activeZoneKey) {
    // Reverse is a trigger zone: flip direction and start a fresh section.
    if (here.zoneKey === "reverse") {
      enterReverseSection();
      input.prevHolding = input.holding;
      return;
    }

    game.activeZoneKey = here.zoneKey;
    $zone.textContent = zone.name;
    if ($zoneDot) $zoneDot.style.background = zoneStyle(game.activeZoneKey).dot;

    const st = zoneStyle(game.activeZoneKey);
    fxText(zone.name, st.stroke, zone.key === "smash" ? 58 : 48, 0.85);
    triggerShake(zone.key === "smash" ? 14 : zone.key === "speed" ? 8 : 6, 0.22);

    // Zone-specific state changes.
    if (zone.key === "boost") {
      game.boost.active = true;
      game.boost.nextX = game.player.x + randRange(game.rng, 220, 420);
    } else {
      game.boost.active = false;
    }

    if (zone.key === "glitch") {
      game.glitch.nextTpT = game.time + randRange(game.rng, 0.35, 0.7);
      game.glitch.cooldown = 0;
    } else {
      game.glitch.nextTpT = 0;
      game.glitch.cooldown = 0;
    }

    // New zone state init
    if (zone.key === "flip") {
      game.zoneState.flipSign = 1;
      game.zoneState.nextFlipT = game.time + randRange(game.rng, 0.38, 0.75);
    }
    if (zone.key === "flipfast") {
      game.zoneState.flipFastSign = 1;
      game.zoneState.nextFlipFastT = game.time + randRange(game.rng, 0.18, 0.33);
    }
    if (zone.key === "wind") {
      game.zoneState.windForce = randRange(game.rng, -520, 520);
      game.zoneState.nextWindT = game.time + randRange(game.rng, 0.45, 0.9);
    }
  }

  // Enable/disable dual mode when entering/leaving Dual zone.
  if (zone.dual && !game.dualActive) {
    game.dualActive = true;
    const center = here.center;
    game.player2.x = game.player.x;
    game.player2.y = center + (center - game.player.y);
    game.trail2.length = 0;
  } else if (!zone.dual && game.dualActive) {
    game.dualActive = false;
    game.trail2.length = 0;
  }

  // Boost pads (inside Boost zone).
  if (game.boost.active && game.player.x >= game.boost.nextX) {
    game.boost.until = game.time + 0.45;
    game.boost.mul = 1.35;
    game.boost.nextX = game.player.x + randRange(game.rng, 260, 430);
    fxText("BOOST!", zoneStyle("boost").stroke, 54, 0.55);
    triggerShake(10, 0.18);
  }

  const boostMul = game.time < game.boost.until ? game.boost.mul : 1.0;
  const prog = zoneProgress(here, game.player.x);
  const zSpeed = zoneSpeedFactor(zone, prog);

  // Constant forward speed (modified by zone + boosts).
  const formMul = FORM_SPEED[game.formKey] ?? 1.0;
  const speed =
    GAME.xSpeed * custom.baseSpeed * zone.speedMul * zSpeed * boostMul * formMul;
  const dx = speed * dt;
  game.player.x += dx;
  game.totalDist += dx;

  // New zone mechanics that alter gravity/forces.
  if (zone.key === "flip" && game.time >= game.zoneState.nextFlipT) {
    game.zoneState.flipSign *= -1;
    game.zoneState.nextFlipT = game.time + randRange(game.rng, 0.35, 0.8);
    fxText("FLIP!", zoneStyle("flip").stroke, 54, 0.45);
    triggerShake(10, 0.16);
  }
  if (zone.key === "wind" && game.time >= game.zoneState.nextWindT) {
    game.zoneState.windForce = randRange(game.rng, -650, 650);
    game.zoneState.nextWindT = game.time + randRange(game.rng, 0.35, 0.9);
  }

  if (zone.key === "flipfast" && game.time >= game.zoneState.nextFlipFastT) {
    game.zoneState.flipFastSign *= -1;
    game.zoneState.nextFlipFastT = game.time + randRange(game.rng, 0.16, 0.36);
    triggerShake(6, 0.12);
  }

  // Gravity sign: +1 = normal gravity (down), -1 = inverted gravity (up).
  const flipMul =
    zone.key === "flip"
      ? game.zoneState.flipSign
      : zone.key === "flipfast"
        ? game.zoneState.flipFastSign
        : 1;
  const gSign = (zone.invert ? -1 : 1) * flipMul;

  if (game.formKey === "wave") {
    const slope = GAME.slopeFactor * (zone.slopeMul ?? 1.0);
    const dy = speed * slope * dt * (input.holding ? -1 : 1) * gSign;
    game.player.y += dy;
    if (zone.key === "magnet") {
      const pull = (here.center - game.player.y) * 0.015;
      game.player.y += pull;
    }
    if (zone.key === "wind") {
      game.player.y += (game.zoneState.windForce * 0.06) * dt;
    }
    if (zone.attractor) {
      const amp = zone.attractor.amp ?? 130;
      const k = zone.attractor.k ?? 0.01;
      const tf = zone.attractor.timeFreq ?? 1.1;
      const target = here.center + amp * Math.sin(game.time * tf + game.player.x * k);
      game.player.y += (target - game.player.y) * 0.02;
    }
  } else if (game.formKey === "ship") {
    const g = GAME.shipGravity * (zone.gravityMul ?? 1.0);
    const thrust = GAME.shipThrust;
    game.player.vy += g * gSign * dt;
    // Smooth thrust ramp (feels less "binary")
    const target = input.holding ? 1 : 0;
    game.controls.shipThrust01 = lerp(game.controls.shipThrust01, target, 10 * dt);
    game.player.vy += -thrust * game.controls.shipThrust01 * gSign * dt;
    // Damping for smoother flight
    const drag = GAME.shipDrag * (zone.dragMul ?? 1.0);
    game.player.vy *= 1 / (1 + drag * dt);
    if (zone.key === "magnet") {
      game.player.vy += (here.center - game.player.y) * 7.5 * dt;
    }
    if (zone.key === "wind") {
      game.player.vy += game.zoneState.windForce * dt;
    }
    if (zone.attractor) {
      const amp = zone.attractor.amp ?? 130;
      const k = zone.attractor.k ?? 0.01;
      const tf = zone.attractor.timeFreq ?? 1.1;
      const force = zone.attractor.force ?? 9.0;
      const target = here.center + amp * Math.sin(game.time * tf + game.player.x * k);
      game.player.vy += (target - game.player.y) * force * dt;
    }
    game.player.vy = clamp(game.player.vy, -GAME.shipMaxVy, GAME.shipMaxVy);
    game.player.y += game.player.vy * dt;

    // Thrust particles
    if (game.controls.shipThrust01 > 0.35) {
      const col = rgbaFromHex(custom.primary, 0.6);
      spawnParticles(game.player.x - 6, game.player.y, 2, 110, 0.25, col, 0.35);
    }
  } else {
    // UFO: impulse on press + gravity.
    const canJump = game.time <= game.controls.ufoBufferedUntil;
    if (canJump) {
      game.player.vy = -GAME.ufoJumpVy * gSign;
      game.controls.ufoBufferedUntil = -1;
      const col = rgbaFromHex(custom.primary, 0.75);
      spawnParticles(game.player.x, game.player.y, 10, 160, 0.35, col, 0.7);
    }
    const g = GAME.ufoGravity * (zone.gravityMul ?? 1.0);
    game.player.vy += g * gSign * dt;
    if (zone.key === "magnet") {
      game.player.vy += (here.center - game.player.y) * 6.0 * dt;
    }
    if (zone.key === "wind") {
      game.player.vy += game.zoneState.windForce * dt;
    }
    if (zone.attractor) {
      const amp = zone.attractor.amp ?? 130;
      const k = zone.attractor.k ?? 0.01;
      const tf = zone.attractor.timeFreq ?? 1.1;
      const force = (zone.attractor.force ?? 9.0) * 0.8;
      const target = here.center + amp * Math.sin(game.time * tf + game.player.x * k);
      game.player.vy += (target - game.player.y) * force * dt;
    }
    game.player.vy = clamp(game.player.vy, -GAME.shipMaxVy, GAME.shipMaxVy);
    game.player.y += game.player.vy * dt;
  }

  // Corridor collision (touch top/bottom = death)
  const r = GAME.radius * (zone.radiusMul ?? 1.0);
  const p1 = corridorSample(game.player.x);
  if (game.player.y - r <= p1.yTop || game.player.y + r >= p1.yBottom) {
    die();
    return;
  }

  // Hazard zones (lasers/gates)
  if (checkHazardsAt(zone, game.player.x, game.time, p1, game.player.y, r)) {
    if (parryActive() && !game.parry.used) {
      game.parry.used = true;
      game.parry.activeUntil = game.time; // consume parry
      triggerShake(7, 0.12);
      const col = rgbaFromHex(custom.trail || custom.primary, 0.85);
      spawnParticles(game.player.x + 8, game.player.y, 26, 320, 0.38, col, 0.8);
    } else {
      die();
      return;
    }
  }

  // Glitch mechanic: occasional backwards "TP" (x rewind) to mess with you.
  if (zone.key === "glitch") {
    game.glitch.cooldown = Math.max(0, game.glitch.cooldown - dt);
    if (game.time >= game.glitch.nextTpT && game.glitch.cooldown <= 0) {
      const rewind = randRange(game.rng, 90, 220);
      game.player.x = Math.max(SPAWN_X, game.player.x - rewind);
      // Keep it visually clean.
      game.trail.length = 0;
      if (game.dualActive) game.trail2.length = 0;
      fxText("GLITCH!", zoneStyle("glitch").stroke, 56, 0.55);
      triggerShake(14, 0.22);

      // Schedule next rewind.
      game.glitch.cooldown = 0.25;
      game.glitch.nextTpT = game.time + randRange(game.rng, 0.35, 0.9);
    }
  }

  if (game.dualActive) {
    // Mirror player around corridor center (simple Dual).
    game.player2.x = game.player.x;
    game.player2.y = p1.center + (p1.center - game.player.y);
    if (game.player2.y - r <= p1.yTop || game.player2.y + r >= p1.yBottom) {
      die();
      return;
    }
  }

  // Trail
  game.trail.push({ x: game.player.x, y: game.player.y });
  const desiredTrail = Math.max(20, Math.floor(GAME.trailMax * (zone.trailMul ?? 1.0)));
  while (game.trail.length > desiredTrail) game.trail.shift();
  if (game.dualActive) {
    game.trail2.push({ x: game.player2.x, y: game.player2.y });
    while (game.trail2.length > desiredTrail) game.trail2.shift();
  }

  const effective = custom.baseSpeed * zone.speedMul * zSpeed * formMul * boostMul;
  $speed.textContent = `${effective.toFixed(2)}x`;
  $dual.textContent = game.dualActive ? "On" : "Off";
  updateScoreHud();

  // Decay shake (fixed timestep).
  if (game.fx.shakeLeft > 0) game.fx.shakeLeft = Math.max(0, game.fx.shakeLeft - dt);
  stepParticles(dt);

  input.prevHolding = input.holding;
}

function render(alpha) {
  const w = view.w;
  const h = view.h;

  // Camera in world-space
  const rx = lerp(game.prev.x, game.player.x, alpha);
  const ry = lerp(game.prev.y, game.player.y, alpha);
  const rvy = lerp(game.prev.vy, game.player.vy, alpha);

  game.render.reverse = game.reverseActive;
  game.render.w = w;

  const baseCamX = game.reverseActive ? rx + GAME.cameraLead - w : rx - GAME.cameraLead;
  let camX = baseCamX;
  let camY = 0;

  // Camera shake + small zone-specific jitter.
  if (game.fx.shakeLeft > 0) {
    const t = game.fx.shakeTotal > 0 ? game.fx.shakeLeft / game.fx.shakeTotal : 0;
    const mag = game.fx.shakeMag * t * t;
    camX += (Math.random() * 2 - 1) * mag;
    camY += (Math.random() * 2 - 1) * mag;
  }
  if (game.activeZoneKey === "glitch") {
    camX += (Math.random() * 2 - 1) * 2.2;
    camY += (Math.random() * 2 - 1) * 1.4;
  }
  const activeZone = getZone(game.activeZoneKey);
  if (activeZone.overlay && activeZone.overlay.type === "shake") {
    const mag = activeZone.overlay.mag ?? 2.0;
    camX += (Math.random() * 2 - 1) * mag;
    camY += (Math.random() * 2 - 1) * mag;
  }

  // Background
  ctx.fillStyle = "#0b0f18";
  ctx.fillRect(0, 0, w, h);

  // Grid (subtle, helps read motion)
  drawGrid(camX, camY, w, h);

  // Corridor
  drawCorridor(camX, camY, w, h);

  // Trail
  drawTrail(camX, camY);

  // Player
  drawPlayerIcon(camX, camY, rx, ry, rvy);

  // Vignette
  drawVignette(w, h);

  // FX overlays (texts / glitch / boost indicators)
  drawBoostMarkers(camX, camY, w, h);
  drawHazards(camX, camY, w, h);
  drawParticles(camX, camY);
  drawFxTextOverlay(w, h);
  if (game.activeZoneKey === "glitch") drawGlitchOverlay(w, h);
  if (game.activeZoneKey === "fog") drawFogOverlay(w, h, rx, ry, camX, camY);
  if (activeZone.overlay && activeZone.overlay.type === "strobe") {
    drawStrobeOverlay(w, h, activeZone.overlay);
  }
  if (activeZone.overlay && activeZone.overlay.type === "fade") {
    drawFadeOverlay(w, h, activeZone.overlay);
  }
  if (game.activeZoneKey === "blackout") {
    drawBlackoutOverlay(w, h, rx, ry, camX, camY);
  }
}

function drawStrobeOverlay(w, h, overlay) {
  const strength = overlay.strength ?? 0.18;
  const freq = overlay.freq ?? 10.0;
  const a = strength * (0.5 + 0.5 * Math.sin(game.time * freq));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawFadeOverlay(w, h, overlay) {
  const strength = overlay.strength ?? 0.55;
  const freq = overlay.freq ?? 1.5;
  const a = strength * (0.5 + 0.5 * Math.sin(game.time * freq));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawBlackoutOverlay(w, h, rx, ry, camX, camY) {
  const p = worldToScreen(rx, ry, camX, camY);
  const radius = 105 + 10 * Math.sin(game.time * 2.2);
  ctx.save();
  const g = ctx.createRadialGradient(p.x, p.y, radius * 0.18, p.x, p.y, radius);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawHazards(camX, camY, w, h) {
  const zone = getZone(game.activeZoneKey);
  if (!zone.hazard) return;

  const x0 = camX - 40;
  const x1 = camX + w + 40;
  const ySamples = 70;
  const dx = (x1 - x0) / ySamples;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = zoneStyle(zone.key).glow;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = zoneStyle(zone.key).stroke;

  // We render by sampling the hazard at each x.
  const lines = [];
  const lastThick = [];
  const band = [];
  for (let i = 0; i <= ySamples; i++) {
    const x = x0 + dx * i;
    const s = corridorSample(x);
    const infos = hazardInfo(zone, x, game.time, s);
    if (!infos) continue;
    for (let k = 0; k < infos.length; k++) {
      if (!lines[k]) lines[k] = [];
      lastThick[k] = infos[k].thick;
      band[k] = !!infos[k].fillBand;
      lines[k].push(worldToScreen(x, infos[k].y, camX, camY));
    }
  }

  for (let k = 0; k < lines.length; k++) {
    const pts = lines[k];
    if (!pts || pts.length < 2) continue;
    const thick = Math.max(6, (lastThick[k] ?? (zone.hazard?.thick ?? 10)) * 0.7);
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Gate band: fill a translucent strip.
    if (band[k]) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = zoneStyle(zone.key).stroke;
      ctx.lineWidth = thick * 3.4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawParticles(camX, camY) {
  if (!game.fx.particles.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of game.fx.particles) {
    const t = p.t / p.life;
    const a = (1 - t) * (1 - t);
    const s = p.size * (0.7 + 0.8 * (1 - t));
    const scr = worldToScreen(p.x, p.y, camX, camY);
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function worldToScreen(x, y, camX, camY) {
  const sx = x - camX;
  const rx = game.render.reverse ? game.render.w - sx : sx;
  return { x: rx, y: y - camY };
}

function drawGrid(camX, camY, w, h) {
  const step = 40; // world/CSS px
  const worldX0 = Math.floor((camX - 80) / step) * step;
  const worldY0 = Math.floor((camY - 80) / step) * step;
  const worldX1 = camX + w + 80;
  const worldY1 = camY + h + 80;

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#b8d4ff";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = worldX0; x <= worldX1; x += step) {
    const sx = game.render.reverse ? w - (x - camX) : x - camX;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let y = worldY0; y <= worldY1; y += step) {
    const sy = y - camY;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }

  ctx.stroke();
  ctx.restore();
}

function drawCorridor(camX, camY, w, h) {
  // Draw top/bottom boundary as thick glowing lines.
  const x0 = camX - 100;
  const x1 = camX + w + 100;

  const samples = 160;
  const dx = (x1 - x0) / samples;

  const top = [];
  const bot = [];
  let hint = 0;
  for (let i = 0; i <= samples; i++) {
    const x = x0 + dx * i;
    const s = corridorSample(x, hint);
    hint = s.hintIndex ?? hint;
    const { yTop, yBottom, zoneKey } = s;
    const tp = worldToScreen(x, yTop, camX, camY);
    const bp = worldToScreen(x, yBottom, camX, camY);
    top.push({ x: tp.x, y: tp.y, key: zoneKey });
    bot.push({ x: bp.x, y: bp.y, key: zoneKey });
  }

  const stActive = zoneStyle(game.activeZoneKey);

  // Fill walls (outside the corridor) so they're not just outlines.
  ctx.save();
  ctx.fillStyle = withAlpha(stActive.fill, 0.55);

  // Top wall
  ctx.beginPath();
  ctx.moveTo(top[0].x, 0);
  for (let i = 0; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  ctx.lineTo(top[top.length - 1].x, 0);
  ctx.closePath();
  ctx.fill();

  // Bottom wall
  ctx.beginPath();
  ctx.moveTo(bot[0].x, h);
  for (let i = 0; i < bot.length; i++) ctx.lineTo(bot[i].x, bot[i].y);
  ctx.lineTo(bot[bot.length - 1].x, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Fill corridor region
  ctx.save();
  ctx.fillStyle = stActive.fill;
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Stroke boundaries in runs so each zone has its own color.
  function strokeRuns(points, lineWidth = 3, shadowBlur = 14) {
    if (!points.length) return;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = lineWidth;

    let start = 0;
    while (start < points.length - 1) {
      const key = points[start].key;
      let end = start + 1;
      while (end < points.length && points[end].key === key) end++;

      const st = zoneStyle(key);
      ctx.shadowColor = st.glow;
      ctx.shadowBlur = shadowBlur;
      ctx.strokeStyle = st.stroke;

      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      for (let i = start + 1; i < end; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();

      // Overlap one point for continuity, but ALWAYS make progress.
      start = Math.max(end - 1, start + 1);
    }

    ctx.restore();
  }

  strokeRuns(top, 3, 14);
  strokeRuns(bot, 3, 14);
}

function drawTrail(camX, camY) {
  if (game.trail.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Two-layer trail (outer glow + inner line)
  const outer = rgbaFromHex(custom.trail, 0.28);
  const inner = rgbaFromHex(custom.trail, 0.82);

  ctx.beginPath();
  for (let i = 0; i < game.trail.length; i++) {
    const p = worldToScreen(game.trail[i].x, game.trail[i].y, camX, 0);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = outer;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < game.trail.length; i++) {
    const p = worldToScreen(game.trail[i].x, game.trail[i].y, camX, 0);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = inner;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  if (!game.dualActive || game.trail2.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const outer2 = rgbaFromHex(custom.accent, 0.24);
  const inner2 = rgbaFromHex(custom.accent, 0.78);

  ctx.beginPath();
  for (let i = 0; i < game.trail2.length; i++) {
    const p = worldToScreen(game.trail2[i].x, game.trail2[i].y, camX, 0);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = outer2;
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < game.trail2.length; i++) {
    const p = worldToScreen(game.trail2[i].x, game.trail2[i].y, camX, 0);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = inner2;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

function drawPlayerIcon(camX, camY, rx, ry, rvy) {
  const p1 = worldToScreen(rx, ry, camX, camY);
  const rot = clamp(rvy / GAME.shipMaxVy, -1, 1) * 0.35;

  // Parry ring (shows timing window).
  if (parryActive()) {
    const t = clamp((game.parry.activeUntil - game.time) / 0.18, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.85 * (0.35 + 0.65 * t);
    ctx.strokeStyle = rgbaFromHex(custom.trail || custom.primary, 0.95);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rgbaFromHex(custom.trail || custom.primary, 0.8);
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, GAME.radius * 3.2 * (1.05 + 0.15 * (1 - t)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawFormIconAt(p1.x, p1.y, game.formKey, rot, false);

  if (!game.dualActive) return;
  // Dual is mirrored around corridor center (computed from current, but good enough visually).
  const p2 = worldToScreen(game.player2.x, game.player2.y, camX, camY);
  if (parryActive()) {
    const t = clamp((game.parry.activeUntil - game.time) / 0.18, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.55 * (0.35 + 0.65 * t);
    ctx.strokeStyle = rgbaFromHex(custom.accent, 0.95);
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rgbaFromHex(custom.accent, 0.75);
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, GAME.radius * 3.2 * (1.05 + 0.15 * (1 - t)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawFormIconAt(p2.x, p2.y, game.formKey, -rot, true);
}

function drawFormIconAt(x, y, formKey, rot, isSecond) {
  const r = GAME.radius;

  const mainHex = isSecond ? custom.accent : custom.primary;
  const main = rgbaFromHex(mainHex, 0.95);
  const shade = rgbaFromHex(mainHex, 0.35);
  const glow = rgbaFromHex(mainHex, 0.7);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(formKey === "ship" ? rot : 0);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;

  const skin = custom.skin || "classic";

  if (skin === "outline") {
    ctx.shadowBlur = 18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = rgbaFromHex(mainHex, 0.95);
    ctx.lineWidth = 3;
  } else if (skin === "neon") {
    ctx.shadowBlur = 26;
  }

  if (formKey === "wave") {
    // Right-facing triangle.
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0);
    ctx.lineTo(-r, -r);
    ctx.lineTo(-r, r);
    ctx.closePath();
    if (skin === "outline") {
      ctx.stroke();
    } else {
      ctx.fillStyle = game.player.alive ? main : "rgba(255, 120, 120, 0.95)";
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(r * 1.0, 0);
      ctx.lineTo(-r * 0.4, -r * 0.6);
      ctx.lineTo(-r * 0.4, r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (formKey === "ship") {
    // Simple ship wedge + thruster flame.
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(r * 0.2, -r * 1.1);
    ctx.lineTo(-r * 1.2, -r * 0.5);
    ctx.lineTo(-r * 1.2, r * 0.5);
    ctx.lineTo(r * 0.2, r * 1.1);
    ctx.closePath();
    if (skin === "outline") {
      ctx.stroke();
    } else {
      ctx.fillStyle = game.player.alive ? main : "rgba(255, 120, 120, 0.95)";
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(r * 1.05, 0);
      ctx.lineTo(-r * 0.25, -r * 0.8);
      ctx.lineTo(-r * 0.95, -r * 0.35);
      ctx.lineTo(-r * 0.95, r * 0.35);
      ctx.lineTo(-r * 0.25, r * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    // Flame when holding (only for primary color set; looks fine for both)
    if (input.holding && game.player.alive) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rgbaFromHex(mainHex, 0.9);
      ctx.beginPath();
      ctx.moveTo(-r * 1.2, 0);
      ctx.lineTo(-r * 2.0, -r * 0.55);
      ctx.lineTo(-r * 1.75, 0);
      ctx.lineTo(-r * 2.0, r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    return;
  }

  // UFO
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.95, 0, 0, Math.PI * 2);
  if (skin === "outline") {
    ctx.stroke();
  } else {
    ctx.fillStyle = game.player.alive ? main : "rgba(255, 120, 120, 0.95)";
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, 0, r * 0.7, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgbaFromHex(mainHex, 0.55);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, -r * 0.25, r * 0.25, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawVignette(w, h) {
  ctx.save();
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.65);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawFxTextOverlay(w, h) {
  if (!game.fx.texts.length) return;
  const now = game.time;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw newest on top.
  for (let idx = game.fx.texts.length - 1; idx >= 0; idx--) {
    const tObj = game.fx.texts[idx];
    const t = (now - tObj.start) / tObj.dur;
    if (t >= 1) continue;

    const e = easeOutCubic(t);
    const alpha = (1 - t) * (1 - t);
    const y = h * 0.22 + (1 - e) * 18;

    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.font = `800 ${tObj.size + 10}px system-ui, Segoe UI, Arial, sans-serif`;
    ctx.fillText(tObj.text, w / 2 + 2, y + 2);

    ctx.globalAlpha = 0.95 * alpha;
    ctx.fillStyle = tObj.color;
    ctx.font = `900 ${tObj.size}px system-ui, Segoe UI, Arial, sans-serif`;
    ctx.fillText(tObj.text, w / 2, y);
    ctx.globalAlpha = 1;
  }

  // Prune expired.
  game.fx.texts = game.fx.texts.filter((tObj) => now - tObj.start < tObj.dur);

  ctx.restore();
}

function drawBoostMarkers(camX, camY, w, h) {
  if (!game.boost.active) return;
  const x = game.boost.nextX;
  if (x < camX - 40 || x > camX + w + 40) return;

  const s = corridorSample(x);
  const centerY = s.center;
  const p = worldToScreen(x, centerY, camX, camY);

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.globalAlpha = 0.9;
  ctx.shadowColor = zoneStyle("boost").glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = zoneStyle("boost").stroke;

  // Simple ">>" arrow marker
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, -r * 0.8);
  ctx.lineTo(r * 0.1, 0);
  ctx.lineTo(-r * 1.1, r * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.8);
  ctx.lineTo(r * 1.05, 0);
  ctx.lineTo(-r * 0.15, r * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGlitchOverlay(w, h) {
  ctx.save();
  ctx.globalAlpha = 0.18;

  // Scanlines
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  const step = 6;
  for (let y = 0; y < h; y += step) {
    ctx.fillRect(0, y, w, 1);
  }

  // Random blocks
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "rgba(180,255,120,1)";
  const blocks = 10;
  for (let i = 0; i < blocks; i++) {
    const bw = 40 + Math.random() * 160;
    const bh = 8 + Math.random() * 40;
    const bx = Math.random() * (w - bw);
    const by = Math.random() * (h - bh);
    ctx.fillRect(bx, by, bw, bh);
  }

  ctx.restore();
}

function drawFogOverlay(w, h, rx, ry, camX, camY) {
  const p = worldToScreen(rx, ry, camX, camY);
  const base = 170;
  const pulse = 24 * Math.sin(game.time * 2.2);
  const radius = Math.max(120, base + pulse);

  ctx.save();
  const g = ctx.createRadialGradient(p.x, p.y, radius * 0.15, p.x, p.y, radius);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.65, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

