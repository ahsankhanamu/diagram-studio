/**
 * html-viewer.ts — Self-contained diagram viewer embedded in exported HTML files.
 *
 * Build pipeline:
 *   This TypeScript file is compiled by Vite/SvelteKit as part of `npm run build`.
 *   The VIEWER_JS string (a plain JS IIFE) is embedded verbatim in the <script> tag
 *   of every exported HTML file, making them fully self-contained with zero deps.
 *
 * Viewport-aware controls:
 *   IntersectionObserver watches every .dv element. Controls (toolbar, hints, minimap)
 *   are hidden by default and only activate for the diagram currently in the viewport.
 *   This means in a multi-diagram HTML, only the visible diagram shows its controls.
 *
 * Styling mirrors EditorControls.svelte + app.css from the web app exactly.
 */

// ── SVG icons — Lucide paths, identical to the web app ───────────────
const ICO = (d: string, size = 14) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

// All paths taken verbatim from lucide-svelte v0.575.0 iconNode definitions
export const ICO_FIT      = ICO(`<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>`);
export const ICO_RESET    = ICO(`<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`);
export const ICO_EXPAND   = ICO(`<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>`);
export const ICO_CONTRACT = ICO(`<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>`);
const ICO_MINUS      = ICO(`<path d="M5 12h14"/>`);
const ICO_PLUS       = ICO(`<path d="M5 12h14"/><path d="M12 5v14"/>`);
const ICO_CHEVRON    = ICO(`<path d="m6 9 6 6 6-6"/>`, 10);
const ICO_MAP        = ICO(`<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>`);
const ICO_ARROW_LEFT = ICO(`<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>`);
const ICO_EXT_LINK   = ICO(`<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`);

// ── CSS — colors from app.css light theme, layout from EditorControls.svelte ──
export const VIEWER_CSS = `
  /* ── Canvas container ─────────────────────────────────────────── */
  .dv {
    position: relative;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  /* Canvas area — dot-grid matches web app (--color-canvas-bg + --color-canvas-grid) */
  .dv-canvas {
    height: calc(100vh - 200px);
    min-height: 420px;
    overflow: hidden;
    position: relative;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    background: #f7f6f3;
    background-image: radial-gradient(circle, rgba(0,0,0,.07) .8px, transparent .8px);
    background-size: 24px 24px;
  }
  .dv-canvas:active { cursor: grabbing; }
  .dv-inner { position: absolute; top: 0; left: 0; transform-origin: 0 0; }

  /* ── Controls: hidden by default, shown only when .dv is in the viewport ── */
  /* This is enforced by IntersectionObserver adding/removing .dv-in-view     */
  .dv-bar,
  .dv-hints,
  .dv-mm {
    opacity: 0;
    transition: opacity .2s;
    pointer-events: none;
  }

  /* ── Floating toolbar — pill, centered bottom ─────────────────── */
  /* Mirrors: absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full in EditorControls.svelte */
  .dv-bar {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 9999px;
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
    background: rgba(255,255,255,.85);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 12px rgba(0,0,0,.1);
    white-space: nowrap;
  }

  /* ── Control visibility — each element independently fades on its own hover ── */
  /* Matches EditorControls.svelte: opacity-40 idle, hover:opacity-100, duration-200 */
  .dv.dv-in-view .dv-bar   { opacity: .4; pointer-events: auto; }
  .dv.dv-in-view .dv-hints { opacity: .4; pointer-events: auto; }
  .dv.dv-in-view .dv-mm    { opacity: .4; pointer-events: auto; }

  .dv.dv-in-view .dv-bar:hover,
  .dv.dv-in-view .dv-hints:hover,
  .dv.dv-in-view .dv-mm:hover { opacity: 1; }

  /* Toolbar icon buttons — h-6 w-6 rounded-md from EditorControls */
  .dv-btn {
    border: none;
    background: transparent;
    color: #4b5563;
    border-radius: 6px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background .1s, color .1s;
    flex-shrink: 0;
    padding: 0;
  }
  .dv-btn:hover { background: rgba(0,0,0,.05); }
  .dv-btn svg   { pointer-events: none; }
  .dv-btn.dv-active { color: #3b82f6; }

  /* Separator — mx-1 h-5 w-px */
  .dv-sep { width: 1px; height: 20px; background: #e5e7eb; margin: 0 4px; flex-shrink: 0; }

  /* Zoom % button with dropdown — min-w-[56px] text-xs font-medium */
  .dv-pct-wrap { position: relative; }
  .dv-pct-btn {
    border: none;
    background: transparent;
    color: #4b5563;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    min-width: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: background .1s;
    font-variant-numeric: tabular-nums;
  }
  .dv-pct-btn:hover { background: rgba(0,0,0,.05); }
  .dv-chev { line-height: 1; transition: transform .15s; flex-shrink: 0; }
  .dv-chev.open { transform: rotate(180deg); }

  /* Zoom dropdown */
  .dv-dd {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px 0;
    min-width: 110px;
    box-shadow: 0 4px 16px rgba(0,0,0,.12);
    display: none;
    z-index: 50;
  }
  .dv-dd button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 12px;
    font-size: 12px;
    border: none;
    background: transparent;
    color: #4b5563;
    cursor: pointer;
    transition: background .1s;
    text-align: left;
  }
  .dv-dd button:hover  { background: rgba(0,0,0,.05); }
  .dv-dd button.dv-active { color: #3b82f6; }
  .dv-dd hr            { margin: 3px 0; border: none; border-top: 1px solid #e5e7eb; }
  .dv-dd-dot           { width: 6px; height: 6px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }

  /* ── Keyboard hints — bottom-left (left-14 = 56px) ──────────────── */
  /* Mirrors: absolute bottom-4 left-14 text-[10px] opacity-40 in EditorControls.svelte */
  .dv-hints {
    position: absolute;
    bottom: 16px;
    left: 56px;
    z-index: 20;
    font-size: 10px;
    color: #6b7280;
    background: rgba(255,255,255,.85);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 6px 10px;
    white-space: nowrap;
  }

  /* kbd-key — copied verbatim from app.css .kbd-key */
  .kbd-key {
    display: inline-block;
    padding: 1px 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 500;
    border-radius: 4px;
    background-color: #f3f4f6;
    border: 1px solid #e5e7eb;
    color: #4b5563;
    box-shadow: 0 1px 1px rgba(0,0,0,.1);
  }

  /* ── Minimap — bottom-right ─────────────────────────────────────── */
  .dv-mm {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 190px;
    height: 120px;
    background: rgba(255,255,255,.97);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
    cursor: crosshair;
    z-index: 10;
  }

  .dv-mm svg   { display: block; pointer-events: none; opacity: .9; }
  .dv-mm-vp {
    position: absolute;
    border: 2px solid #3b82f6;
    background: rgba(59,130,246,.08);
    border-radius: 4px;
    pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(0,0,0,.35);
    top: 0; left: 0;
  }
  .dv-empty { padding: 48px; text-align: center; color: #9ca3af; font-size: 14px; }

  /* ── Back bar — shown when a diagram is in expanded/maximized mode ── */
  .dv-back-bar {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    height: 52px;
    background: rgba(255,255,255,.96);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
    flex-shrink: 0;
  }
  .dv-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: transparent;
    color: #3b82f6;
    font-size: 13px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background .1s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .dv-back-btn:hover { background: #eff6ff; }
  .dv-back-btn svg   { pointer-events: none; flex-shrink: 0; }
  .dv-back-sep       { width: 1px; height: 20px; background: #e5e7eb; flex-shrink: 0; }
  .dv-back-info      { display: flex; flex-direction: column; justify-content: center; overflow: hidden; min-width: 0; gap: 1px; }
  .dv-back-title     { font-size: 14px; font-weight: 600; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
  .dv-back-desc      { font-size: 11px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }

  /* ── Maximize / minimize ────────────────────────────────────────── */
  .dv-fs-on { display: none; }

  /* Multi-diagram expanded: cover full viewport, hide sidebar + other sections */
  body.dv-expanded aside,
  body.dv-expanded section:not(.dv-expanded-section) { display: none; }
  body.dv-expanded .layout { grid-template-columns: 1fr; }
  body.dv-expanded .dv-expanded-section {
    position: fixed; inset: 0; z-index: 1000;
    background: #fff; margin: 0; padding: 0;
    display: flex; flex-direction: column;
  }
  /* Hide the section's own h2/blurb — back bar carries the title + desc */
  body.dv-expanded .dv-expanded-section > h2,
  body.dv-expanded .dv-expanded-section > .blurb { display: none; }
  body.dv-expanded .dv {
    flex: 1; min-height: 0;
    border-radius: 0; border: none;
    display: flex; flex-direction: column;
  }
  body.dv-expanded .dv-expanded-section .dv-back-bar { display: flex; }
  body.dv-expanded .dv-canvas { flex: 1; height: auto !important; min-height: 0 !important; }
  body.dv-expanded .dv-fs-off { display: none; }
  body.dv-expanded .dv-fs-on  { display: inline-flex; }

  /* Single-diagram expanded: fix the .dv itself to cover viewport */
  body.dv-expanded-single { padding: 0 !important; max-width: none !important; }
  body.dv-expanded-single .dv {
    position: fixed; inset: 0; z-index: 1000;
    border-radius: 0; border: none;
    display: flex; flex-direction: column;
  }
  body.dv-expanded-single .dv-back-bar { display: flex; }
  body.dv-expanded-single .dv-canvas   { flex: 1; height: auto !important; min-height: 0 !important; }
  body.dv-expanded-single .dv-fs-off   { display: none; }
  body.dv-expanded-single .dv-fs-on    { display: inline-flex; }
  body.dv-expanded-single > h1,
  body.dv-expanded-single > p.blurb,
  body.dv-expanded-single > p.meta     { display: none; }
`;

// ── Viewer JS — IIFE, zero framework deps ─────────────────────────────
// Written as plain readable JS. Vite compiles this TypeScript file but the
// string content is embedded verbatim in exported HTML <script> tags.
const VIEWER_JS = `(function () {
  'use strict';

  // Per-diagram state: { s, x, y, drag, sx, sy, svgW, svgH, mmScale, mmW, mmH }
  var V = {};
  var PRESETS = [25, 50, 75, 100, 125, 150, 200];

  // Space key state — held = pan-mode cursor, same as web app Space+Drag behaviour
  var _spaceDown = false;

  // Apply current transform + update zoom % label + minimap viewport rect
  function ap(id) {
    var v = V[id], el = document.getElementById(id);
    if (!el || !v) return;
    el.querySelector('.dv-inner').style.transform =
      'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.s + ')';
    var pct = el.querySelector('[data-dvpct]');
    if (pct) pct.textContent = Math.round(v.s * 100) + '%';
    updateDdActive(id);
    umm(id);
  }

  // Fit diagram to canvas with 92% padding (same as web app)
  function fit(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var c = el.querySelector('.dv-canvas');
    var svg = el.querySelector('.dv-inner svg');
    if (!svg) {
      V[id] = Object.assign(V[id] || {}, { s: 1, x: 0, y: 0, drag: false, sx: 0, sy: 0 });
      ap(id);
      return;
    }
    var sw = parseFloat(svg.getAttribute('width') || 800);
    var sh = parseFloat(svg.getAttribute('height') || 600);
    var cw = c.clientWidth, ch = c.clientHeight;
    var s = Math.min(cw / sw, ch / sh) * 0.92;
    // Object.assign preserves mmScale/mmW/mmH so minimap doesn't reset
    V[id] = Object.assign(V[id] || {}, {
      s: s, x: (cw - sw * s) / 2, y: (ch - sh * s) / 2,
      drag: false, sx: 0, sy: 0, svgW: sw, svgH: sh
    });
    ap(id);
  }

  // Zoom around a point (cx, cy in canvas-local coords); defaults to center
  function zoom(id, delta, cx, cy) {
    var v = V[id];
    if (!v) return;
    if (cx === undefined) {
      var c2 = document.getElementById(id).querySelector('.dv-canvas');
      cx = c2.clientWidth / 2; cy = c2.clientHeight / 2;
    }
    var ns = Math.min(Math.max(v.s * delta, 0.05), 8);
    v.x = cx - (cx - v.x) * (ns / v.s);
    v.y = cy - (cy - v.y) * (ns / v.s);
    v.s = ns;
    ap(id);
  }

  // Highlight the active preset in the dropdown
  function updateDdActive(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var v = V[id];
    if (!v) return;
    var cur = Math.round(v.s * 100);
    el.querySelectorAll('.dv-dd button[data-p]').forEach(function (btn) {
      var active = parseInt(btn.getAttribute('data-p')) === cur;
      btn.classList.toggle('dv-active', active);
      var dot = btn.querySelector('.dv-dd-dot');
      if (dot) dot.style.display = active ? 'inline-block' : 'none';
    });
  }

  // Update minimap viewport rectangle
  function umm(id) {
    var v = V[id];
    if (!v || !v.mmScale) return;
    var el = document.getElementById(id);
    var vp = el.querySelector('.dv-mm-vp');
    var c = el.querySelector('.dv-canvas');
    if (!vp || !c) return;
    var cw = c.clientWidth, ch = c.clientHeight, ms = v.mmScale;
    var rx = (-v.x / v.s) * ms, ry = (-v.y / v.s) * ms;
    var rw = (cw / v.s) * ms, rh = (ch / v.s) * ms;
    var x1 = Math.max(0, rx), y1 = Math.max(0, ry);
    var x2 = Math.min(v.mmW, rx + rw), y2 = Math.min(v.mmH, ry + rh);
    if (x2 > x1 && y2 > y1) {
      vp.style.display = 'block';
      vp.style.left = x1 + 'px'; vp.style.top = y1 + 'px';
      vp.style.width = (x2 - x1) + 'px'; vp.style.height = (y2 - y1) + 'px';
    } else {
      vp.style.display = 'none';
    }
  }

  // Initialise minimap: clone SVG, compute scale, wire up drag-to-navigate
  function initMM(id) {
    var el = document.getElementById(id);
    var mm = el.querySelector('.dv-mm');
    var svg = el.querySelector('.dv-inner svg');
    if (!mm || !svg) return;
    var mmW = mm.clientWidth || 190, mmH = mm.clientHeight || 120;
    var sw = parseFloat(svg.getAttribute('width') || 800);
    var sh = parseFloat(svg.getAttribute('height') || 600);
    var ms = Math.min(mmW / sw, mmH / sh);
    var clone = svg.cloneNode(true);
    var cw2 = sw * ms, ch2 = sh * ms;
    clone.setAttribute('width', cw2);
    clone.setAttribute('height', ch2);
    clone.style.position = 'absolute';
    clone.style.left = ((mmW - cw2) / 2) + 'px';
    clone.style.top  = ((mmH - ch2) / 2) + 'px';
    mm.insertBefore(clone, mm.firstChild);
    V[id].mmScale = ms; V[id].mmW = mmW; V[id].mmH = mmH;
    umm(id);
    // Drag minimap to navigate
    var dragging = false;
    function nav(e) {
      var r = mm.getBoundingClientRect();
      var mx = (e.clientX - r.left) / ms, my = (e.clientY - r.top) / ms;
      var c3 = el.querySelector('.dv-canvas');
      V[id].x = c3.clientWidth  / 2 - mx * V[id].s;
      V[id].y = c3.clientHeight / 2 - my * V[id].s;
      ap(id);
    }
    mm.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation(); dragging = true; nav(e);
    });
    document.addEventListener('mousemove', function (e) { if (dragging) nav(e); });
    document.addEventListener('mouseup',   function ()  { dragging = false; });
  }

  // ── Public API (called from inline onclick attributes in the HTML) ──

  window.dvFit     = function (id) { fit(id); };
  window.dvZoomIn  = function (id) { zoom(id, 1.2); };
  window.dvZoomOut = function (id) { zoom(id, 1 / 1.2); };

  window.dvSetZoom = function (id, pct) {
    var v = V[id]; if (!v) return;
    var el = document.getElementById(id), c = el.querySelector('.dv-canvas');
    var cx = c.clientWidth / 2, cy = c.clientHeight / 2, ns = pct / 100;
    v.x = cx - (cx - v.x) * (ns / v.s);
    v.y = cy - (cy - v.y) * (ns / v.s);
    v.s = ns;
    ap(id);
    var dd = document.getElementById(id + '-dd'); if (dd) dd.style.display = 'none';
    var ch = document.getElementById(id + '-chev'); if (ch) ch.classList.remove('open');
  };

  window.dvReset = function (id) {
    var v = V[id]; if (!v) return;
    var el = document.getElementById(id), c = el.querySelector('.dv-canvas');
    Object.assign(v, {
      s: 1,
      x: (c.clientWidth  - (v.svgW || 800)) / 2,
      y: (c.clientHeight - (v.svgH || 600)) / 2
    });
    ap(id);
  };

  window.dvTogglePcts = function (e, id) {
    e.stopPropagation();
    var dd = document.getElementById(id + '-dd'); if (!dd) return;
    var open = dd.style.display === 'block';
    // Close all other dropdowns first
    document.querySelectorAll('.dv-dd').forEach(function (d) { d.style.display = 'none'; });
    document.querySelectorAll('.dv-chev').forEach(function (c) { c.classList.remove('open'); });
    if (!open) {
      dd.style.display = 'block';
      var chev = document.getElementById(id + '-chev'); if (chev) chev.classList.add('open');
      updateDdActive(id);
    }
  };

  window.dvToggleMinimap = function (id) {
    var el = document.getElementById(id); if (!el) return;
    var mm  = el.querySelector('.dv-mm');
    var btn = document.getElementById(id + '-mm-btn');
    if (!mm) return;
    var hidden = mm.style.display === 'none';
    mm.style.display = hidden ? '' : 'none';
    if (btn) btn.classList.toggle('dv-active', hidden);
  };

  window.dvOpenInStudio = function (id) {
    var s = document.querySelector('script[data-diag="' + id + '"]');
    if (!s) return;
    try {
      var json = s.textContent || '{}';
      var bytes = new TextEncoder().encode(json);
      var binary = '';
      bytes.forEach(function (b) { binary += String.fromCharCode(b); });
      var encoded = btoa(binary);
      window.open('https://diagram-studio.vercel.app/#import=' + encoded, '_blank');
    } catch (e) {}
  };

  window.dvToggleMax = function (id) {
    var el = document.getElementById(id); if (!el) return;
    var sec = el.closest('section');
    var backTitle = el.querySelector('.dv-back-title');
    var backDesc  = el.querySelector('.dv-back-desc');
    if (sec) {
      var exp = document.body.classList.contains('dv-expanded');
      if (exp) {
        document.body.classList.remove('dv-expanded');
        sec.classList.remove('dv-expanded-section');
      } else {
        if (backTitle) {
          var h2 = sec.querySelector('h2');
          backTitle.textContent = h2 ? h2.textContent.trim() : '';
        }
        if (backDesc) {
          var blurb = sec.querySelector('.blurb');
          backDesc.textContent = blurb ? blurb.textContent.trim() : '';
          backDesc.style.display = backDesc.textContent ? '' : 'none';
        }
        document.body.classList.add('dv-expanded');
        sec.classList.add('dv-expanded-section');
        sec.scrollIntoView();
      }
    } else {
      var isSingle = document.body.classList.contains('dv-expanded-single');
      if (!isSingle) {
        if (backTitle) {
          var h1 = document.querySelector('h1');
          backTitle.textContent = h1 ? h1.textContent.trim() : '';
        }
        if (backDesc) {
          var pg = document.querySelector('p.blurb');
          backDesc.textContent = pg ? pg.textContent.trim() : '';
          backDesc.style.display = backDesc.textContent ? '' : 'none';
        }
      }
      document.body.classList.toggle('dv-expanded-single');
    }
    setTimeout(function () { fit(id); }, 60);
  };

  // Close dropdowns when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dv-pct-wrap')) {
      document.querySelectorAll('.dv-dd').forEach(function (d) { d.style.display = 'none'; });
      document.querySelectorAll('.dv-chev').forEach(function (c) { c.classList.remove('open'); });
    }
  });

  // ── Initialisation ────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {

    // Per-diagram: wire up pan / zoom / touch interactions
    document.querySelectorAll('.dv').forEach(function (el) {
      var id = el.id;
      var c = el.querySelector('.dv-canvas');
      V[id] = { s: 1, x: 0, y: 0, drag: false, sx: 0, sy: 0 };

      // Wheel: pinch (ctrlKey=true on macOS trackpad) → zoom; scroll → pan
      c.addEventListener('wheel', function (e) {
        e.preventDefault();
        var r = c.getBoundingClientRect();
        if (e.ctrlKey) {
          // Pinch gesture or Ctrl+scroll — same formula as xyflow (10x factor on macOS, matching isMacOs() in @xyflow/system)
          var factor = /Mac/.test(navigator.userAgent) ? 10 : 1;
          var zf = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002;
          zoom(id, Math.pow(2, -e.deltaY * zf * factor), e.clientX - r.left, e.clientY - r.top);
        } else {
          // Two-finger scroll → pan
          var v = V[id]; if (!v) return;
          v.x -= e.deltaX;
          v.y -= e.deltaY;
          ap(id);
        }
      }, { passive: false });

      // Mouse-drag pan. Space+Drag allows starting from anywhere on the canvas;
      // without Space, minimap and toolbar clicks are ignored so their own
      // handlers can fire.
      c.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        if (!_spaceDown) {
          var mm  = el.querySelector('.dv-mm');
          var bar = el.querySelector('.dv-bar');
          if ((mm && mm.contains(e.target)) || (bar && bar.contains(e.target))) return;
        }
        V[id].drag = true;
        V[id].sx = e.clientX - V[id].x;
        V[id].sy = e.clientY - V[id].y;
        c.style.cursor = 'grabbing';
        e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        var v = V[id]; if (!v || !v.drag) return;
        v.x = e.clientX - v.sx; v.y = e.clientY - v.sy;
        ap(id);
      });
      document.addEventListener('mouseup', function () {
        var v = V[id]; if (v) v.drag = false;
        c.style.cursor = _spaceDown ? 'grab' : '';
      });

      // Touch: single-finger pan, two-finger pinch-zoom
      c.addEventListener('touchstart', function (e) {
        var v = V[id];
        if (e.touches.length === 1) {
          v.drag = true;
          v.sx = e.touches[0].clientX - v.x;
          v.sy = e.touches[0].clientY - v.y;
        }
        if (e.touches.length === 2) {
          var t = e.touches;
          v._pd = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        }
      }, { passive: true });
      c.addEventListener('touchmove', function (e) {
        var v = V[id];
        if (e.touches.length === 1 && v.drag) {
          v.x = e.touches[0].clientX - v.sx;
          v.y = e.touches[0].clientY - v.sy;
          ap(id);
        }
        if (e.touches.length === 2) {
          var t = e.touches;
          var d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
          if (v._pd) {
            var r2 = c.getBoundingClientRect();
            var mx2 = (t[0].clientX + t[1].clientX) / 2 - r2.left;
            var my2 = (t[0].clientY + t[1].clientY) / 2 - r2.top;
            // Dampen raw pinch ratio: 1 + (ratio-1)*0.55 reduces sensitivity ~45%
            // while preserving direction and preventing jumpy zooming.
            var rawRatio = d / v._pd;
            var dampedRatio = 1 + (rawRatio - 1) * 0.55;
            zoom(id, dampedRatio, mx2, my2);
          }
          v._pd = d;
        }
        e.preventDefault();
      }, { passive: false });
      c.addEventListener('touchend', function () {
        var v = V[id]; if (v) { v.drag = false; delete v._pd; }
      });
    });

    // Space+Drag pan — prevent page scroll when Space is held over a diagram,
    // show grab cursor to signal pan mode, same as web app behaviour.
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space') return;
      var t = e.target;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      if (_spaceDown) return;
      _spaceDown = true;
      document.querySelectorAll('.dv-canvas').forEach(function (c) {
        var id = c.closest('.dv').id;
        if (!V[id] || !V[id].drag) c.style.cursor = 'grab';
      });
    }, { capture: true });

    document.addEventListener('keyup', function (e) {
      if (e.code !== 'Space') return;
      _spaceDown = false;
      document.querySelectorAll('.dv-canvas').forEach(function (c) {
        var id = c.closest('.dv').id;
        if (!V[id] || !V[id].drag) c.style.cursor = '';
      });
    });

    // Initial fit + minimap: deferred via double rAF so grid/flex layout is
    // fully painted before we read clientWidth/clientHeight. Without this,
    // diagrams already in the viewport on load (e.g. dv0) may fit against
    // dimensions that haven't yet been resolved by the browser.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.querySelectorAll('.dv').forEach(function (el) {
          var id = el.id;
          fit(id);
          initMM(id);
          V[id].fittedInView = true; // Prevent IO re-fit for on-load visible diagrams
        });
      });
    });

    // Viewport-aware controls via IntersectionObserver.
    // threshold: 0.15 — controls appear once 15% of the diagram is visible.
    // rootMargin: '-40px 0px' — slight inset so controls don't flash at edge.
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add('dv-in-view');
            // Fit diagrams that scroll into view after initial load
            var id = el.id;
            if (V[id] && !V[id].fittedInView) {
              V[id].fittedInView = true;
              fit(id);
              initMM(id);
            }
          } else {
            el.classList.remove('dv-in-view');
          }
        });
      }, { threshold: 0.15, rootMargin: '-40px 0px' });

      document.querySelectorAll('.dv').forEach(function (el) {
        io.observe(el);
      });
    } else {
      document.querySelectorAll('.dv').forEach(function (el) {
        el.classList.add('dv-in-view');
      });
    }
  });

})();`;

export const VIEWER_SCRIPT = `<script>${VIEWER_JS}<\/script>`;

// ── Viewer HTML builder ───────────────────────────────────────────────
const PRESETS = [25, 50, 75, 100, 125, 150, 200];

export function viewerHtml(id: string, svgContent: string | null): string {
	const presetBtns = PRESETS.map((p) =>
		`<button onclick="dvSetZoom('${id}',${p})" data-p="${p}">${p}%<span class="dv-dd-dot" style="display:none"></span></button>`
	).join('');

	return `<div class="dv" id="${id}">
  <!-- Back bar: hidden by default, shown in expanded/maximized mode -->
  <div class="dv-back-bar">
    <button class="dv-back-btn" onclick="dvToggleMax('${id}')">${ICO_ARROW_LEFT} Back</button>
    <span class="dv-back-sep"></span>
    <div class="dv-back-info">
      <span class="dv-back-title"></span>
      <span class="dv-back-desc" style="display:none"></span>
    </div>
  </div>
  <div class="dv-canvas">
    <div class="dv-inner" id="di-${id}">${svgContent ?? ''}</div>

    <!-- Floating toolbar: centered bottom, pill shape, ghost opacity → 1 on hover -->
    <div class="dv-bar">
      <button class="dv-btn" onclick="dvZoomOut('${id}')" title="Zoom out">${ICO_MINUS}</button>
      <div class="dv-pct-wrap">
        <button class="dv-pct-btn" onclick="dvTogglePcts(event,'${id}')">
          <span data-dvpct>100%</span>
          <span class="dv-chev" id="${id}-chev">${ICO_CHEVRON}</span>
        </button>
        <div class="dv-dd" id="${id}-dd">
          ${presetBtns}
          <hr>
          <button onclick="dvFit('${id}');document.getElementById('${id}-dd').style.display='none';document.getElementById('${id}-chev').classList.remove('open')">Fit to screen</button>
        </div>
      </div>
      <button class="dv-btn" onclick="dvZoomIn('${id}')" title="Zoom in">${ICO_PLUS}</button>
      <div class="dv-sep"></div>
      <button class="dv-btn" onclick="dvFit('${id}')" title="Fit to screen">${ICO_FIT}</button>
      <button class="dv-btn" onclick="dvReset('${id}')" title="Reset to 100%">${ICO_RESET}</button>
      <button class="dv-btn dv-active" id="${id}-mm-btn" onclick="dvToggleMinimap('${id}')" title="Toggle minimap">${ICO_MAP}</button>
      <div class="dv-sep"></div>
      <button class="dv-btn" onclick="dvToggleMax('${id}')" title="Maximize / restore">
        <span class="dv-fs-off">${ICO_EXPAND}</span>
        <span class="dv-fs-on">${ICO_CONTRACT}</span>
      </button>
      <div class="dv-sep"></div>
      <button class="dv-btn" onclick="dvOpenInStudio('${id}')" title="Open in Diagram Studio">${ICO_EXT_LINK}</button>
    </div>

    <!-- Keyboard hints: bottom-left (left-14 = 56px), ghost opacity -->
    <div class="dv-hints">
      <kbd class="kbd-key">Space</kbd>+<kbd class="kbd-key">Drag</kbd> pan &middot;
      <kbd class="kbd-key">Scroll</kbd> pan &middot;
      <kbd class="kbd-key">Cmd</kbd>+<kbd class="kbd-key">Scroll</kbd> zoom &middot;
      <kbd class="kbd-key">Pinch</kbd> zoom
    </div>

    <!-- Minimap: bottom-right, drag to navigate -->
    <div class="dv-mm"><div class="dv-mm-vp"></div></div>
  </div>
</div>`;
}
