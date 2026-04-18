// Camera color sampler — adds a "Find a color with the camera" feature.
// Self-contained: builds its own DOM and styles, exposes window.openCameraSampler().
// Reuses globals from index.html: nameColor(), mixbox, getSaved(), setSaved(), renderSaved().

(function () {
  'use strict';

  const BASE_PAINTS = [
    { name: 'Red',    hex: '#e50000' },
    { name: 'Blue',   hex: '#0343df' },
    { name: 'Yellow', hex: '#ffff14' },
    { name: 'White',  hex: '#ffffff' },
    { name: 'Black',  hex: '#000000' },
  ];

  const hexToRgb = (h) => {
    const v = h.replace('#', '');
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  };
  const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const colorDist = (a, b) => {
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
  };

  // --- Recipe: split 6 parts across base paints, ≤3 non-zero, minimize mixbox distance.
  function mixboxMix(weights) {
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const latent = new Array(window.mixbox.LATENT_SIZE).fill(0);
    BASE_PAINTS.forEach((p, i) => {
      const w = weights[i] / total;
      if (w === 0) return;
      const { r, g, b } = hexToRgb(p.hex);
      const lat = window.mixbox.rgbToLatent([r, g, b]);
      for (let k = 0; k < latent.length; k++) latent[k] += lat[k] * w;
    });
    const [r, g, b] = window.mixbox.latentToRgb(latent);
    return { r, g, b };
  }

  function findRecipe(targetHex) {
    const target = hexToRgb(targetHex);
    const TOTAL = 6;
    const N = BASE_PAINTS.length;
    let best = null, bestD = Infinity;
    function rec(idx, left, arr) {
      if (idx === N - 1) {
        arr[idx] = left;
        const nonZero = arr.filter(x => x > 0).length;
        if (nonZero >= 1 && nonZero <= 3) {
          const mixed = mixboxMix(arr);
          const d = colorDist(target, mixed);
          if (d < bestD) { bestD = d; best = { parts: [...arr], mixed }; }
        }
        return;
      }
      for (let i = 0; i <= left; i++) {
        arr[idx] = i;
        rec(idx + 1, left - i, arr);
      }
    }
    rec(0, TOTAL, new Array(N).fill(0));
    return best;
  }

  // --- Styles (injected once on first open) ---
  const STYLES = `
    .cam-screen, .cam-result {
      position: fixed; inset: 0; z-index: 9999;
      font-family: 'Nunito', system-ui, sans-serif;
      animation: cam-fade 220ms ease;
    }
    @keyframes cam-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cam-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .cam-screen { background: #000; color: #fff; display: flex; flex-direction: column; }
    .cam-topbar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 3;
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0));
    }
    .cam-iconbtn {
      width: 40px; height: 40px; border-radius: 50%; border: none;
      background: rgba(0,0,0,0.4); color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    }
    .cam-title { font-size: 15px; font-weight: 800; letter-spacing: 0.3px; }

    .cam-viewfinder {
      flex: 1; position: relative; overflow: hidden;
      cursor: crosshair; touch-action: none; background: #111;
    }
    .cam-video, .cam-sample-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; pointer-events: none;
    }
    .cam-sample-canvas { visibility: hidden; }

    .cam-permission {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 32px; text-align: center;
      background: rgba(0,0,0,0.85); gap: 16px;
    }
    .cam-permission .cam-perm-icon { font-size: 56px; }
    .cam-permission .cam-perm-msg { font-size: 16px; font-weight: 700; line-height: 1.4; max-width: 320px; }
    .cam-permission button {
      margin-top: 8px; padding: 12px 24px; border-radius: 999px; border: none;
      background: linear-gradient(135deg, #6c5ce7, #ec4899); color: #fff;
      font-family: inherit; font-weight: 900; font-size: 14px; cursor: pointer;
      box-shadow: 0 6px 18px rgba(108,92,231,0.45);
    }

    .cam-reticle {
      position: absolute; pointer-events: none;
      width: 108px; height: 108px;
      transition: left 80ms linear, top 80ms linear;
    }
    .cam-reticle.dragging { transition: none; }
    .cam-reticle .ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.85);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.35),
        inset 0 0 0 1px rgba(0,0,0,0.25),
        0 6px 18px rgba(0,0,0,0.45);
    }
    .cam-reticle .disc {
      position: absolute; inset: 26%; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.95);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
      transition: background 120ms ease;
    }
    .cam-reticle .cross-v {
      position: absolute; left: 50%; top: 2px; bottom: 2px; width: 1px;
      background: rgba(255,255,255,0.6); transform: translateX(-0.5px);
    }
    .cam-reticle .cross-h {
      position: absolute; top: 50%; left: 2px; right: 2px; height: 1px;
      background: rgba(255,255,255,0.6); transform: translateY(-0.5px);
    }
    .cam-reticle .corner {
      position: absolute; width: 12px; height: 12px;
    }
    .cam-reticle .corner.tl { top: -6px; left: -6px; border-top: 2px solid #fff; border-left: 2px solid #fff; }
    .cam-reticle .corner.tr { top: -6px; right: -6px; border-top: 2px solid #fff; border-right: 2px solid #fff; }
    .cam-reticle .corner.bl { bottom: -6px; left: -6px; border-bottom: 2px solid #fff; border-left: 2px solid #fff; }
    .cam-reticle .corner.br { bottom: -6px; right: -6px; border-bottom: 2px solid #fff; border-right: 2px solid #fff; }

    .cam-chip {
      position: absolute; pointer-events: none;
      width: 168px; padding: 10px 12px; border-radius: 14px;
      box-shadow: 0 6px 22px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.25);
      transition: background 150ms ease, color 150ms ease, left 80ms linear, top 80ms linear;
      font-size: 15px; font-weight: 900; line-height: 1.15;
      text-transform: capitalize; text-align: center;
    }
    .cam-chip .arrow {
      position: absolute; width: 12px; height: 12px;
      transform: rotate(45deg); background: inherit;
    }

    .cam-hint {
      position: absolute; left: 16px; right: 16px; bottom: 128px;
      padding: 10px 14px; border-radius: 14px;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      font-size: 12px; font-weight: 700; text-align: center; color: rgba(255,255,255,0.92);
      transition: opacity 250ms ease;
    }
    .cam-hint.hidden { opacity: 0; pointer-events: none; }

    .cam-shutter-bar {
      position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
      padding: 22px 18px 24px;
      background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0));
      display: flex; align-items: center; justify-content: center;
    }
    .cam-shutter {
      width: 82px; height: 82px; border-radius: 50%;
      border: 4px solid #fff; background: transparent; padding: 0;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 18px rgba(0,0,0,0.4);
      -webkit-tap-highlight-color: transparent;
    }
    .cam-shutter:active { transform: scale(0.94); }
    .cam-shutter .fill {
      width: 62px; height: 62px; border-radius: 50%;
      border: 2px solid #fff; transition: background 120ms ease;
    }

    /* Flash on capture */
    .cam-flash {
      position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none;
      animation: cam-flash 280ms ease;
    }
    @keyframes cam-flash {
      0% { opacity: 0; } 30% { opacity: 0.85; } 100% { opacity: 0; }
    }

    /* --- Result screen --- */
    .cam-result {
      background: #f0f4ff; color: #2d3250;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .cam-result-header {
      padding: 14px 16px 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .cam-result-back {
      width: 40px; height: 40px; border-radius: 50%; border: none;
      background: #fff; color: #2d3250; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(100,120,200,0.18);
    }
    .cam-result-title {
      font-size: 18px; font-weight: 900; letter-spacing: -0.3px;
    }
    .cam-result-title .gradient {
      background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #5f27cd);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cam-result-body { flex: 1; overflow-y: auto; padding: 6px 16px 20px; animation: cam-pop 280ms ease; }

    .cam-found-card {
      background: #fff; border-radius: 24px;
      box-shadow: 0 2px 16px rgba(100,120,200,0.08);
      padding: 18px 14px;
      display: flex; flex-direction: column; align-items: center;
    }
    .cam-found-row { display: flex; align-items: center; gap: 14px; }
    .cam-found-swatch {
      width: 110px; height: 110px; border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.06);
    }
    .cam-found-name {
      margin-top: 14px; font-size: 28px; font-weight: 900; line-height: 1.05;
      text-transform: capitalize; text-align: center;
    }
    .cam-speak-btn, .cam-heart-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none; padding: 0;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(100,120,200,0.18);
    }
    .cam-speak-btn { background: #f59e0b; color: #fff; box-shadow: 0 2px 8px rgba(245,158,11,0.4); }
    .cam-speak-btn.speaking { background: #ea580c; }
    .cam-heart-btn { background: #fff; }
    .cam-heart-btn.saved { background: #fce7f3; }

    .cam-recipe-card {
      background: #fff; border-radius: 24px; margin-top: 12px; padding: 18px;
      box-shadow: 0 2px 16px rgba(100,120,200,0.08);
    }
    .cam-recipe-eyebrow {
      font-size: 13px; font-weight: 800; color: #7a7fa0;
      text-transform: uppercase; letter-spacing: 1px; margin: 0 4px 4px;
    }
    .cam-recipe-title { font-size: 19px; font-weight: 900; margin: 0 4px 2px; }
    .cam-recipe-equation {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px; margin: 16px 0 14px;
    }
    .cam-paint-chip { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .cam-paint-chip .swatch {
      width: 48px; height: 48px; border-radius: 50%;
      border: 3px solid #fff; position: relative;
      box-shadow: 0 3px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
    }
    .cam-paint-chip .badge {
      position: absolute; bottom: -4px; right: -4px;
      min-width: 22px; height: 22px; padding: 0 5px;
      border-radius: 11px; background: #6c5ce7; color: #fff;
      font-size: 12px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }
    .cam-paint-chip .label { font-size: 10px; font-weight: 800; color: #2d3250; }
    .cam-recipe-plus { font-size: 20px; font-weight: 900; color: #7a7fa0; }
    .cam-recipe-equals { font-size: 22px; font-weight: 900; color: #6c5ce7; }
    .cam-recipe-target {
      width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff;
      box-shadow: 0 3px 10px rgba(0,0,0,0.15), 0 0 0 2px rgba(108,92,231,0.25);
    }
    .cam-recipe-line {
      text-align: center; font-size: 15px; font-weight: 700; color: #2d3250;
      padding: 10px 4px 0; line-height: 1.4;
      border-top: 1px dashed rgba(108,92,231,0.2);
    }
    .cam-recipe-line b { color: #6c5ce7; }
    .cam-recipe-caption {
      font-size: 11px; font-weight: 700; color: #7a7fa0;
      margin-top: 6px; letter-spacing: 0.3px;
    }

    .cam-result-actions { display: flex; gap: 10px; margin-top: 16px; }
    .cam-result-actions button {
      padding: 14px 10px; border-radius: 14px;
      font-family: inherit; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .cam-btn-retry {
      flex: 1; border: 2px solid rgba(108,92,231,0.25); background: #fff;
      color: #6c5ce7; font-weight: 800;
    }
    .cam-btn-save {
      flex: 1.3; border: none; background: #6c5ce7; color: #fff; font-weight: 900;
      box-shadow: 0 6px 16px rgba(108,92,231,0.35);
    }
    .cam-btn-save.done { background: #10b981; box-shadow: 0 6px 16px rgba(16,185,129,0.35); }

    /* --- CTA on home --- */
    .camera-cta {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      margin: 4px 16px 12px; padding: 13px 20px; width: calc(100% - 32px);
      border-radius: 999px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6c5ce7, #ec4899); color: #fff;
      font-family: inherit; font-weight: 900; font-size: 14px;
      box-shadow: 0 6px 18px rgba(108,92,231,0.35);
      -webkit-tap-highlight-color: transparent;
    }
    .camera-cta:active { transform: scale(0.98); }
  `;

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    const s = document.createElement('style');
    s.id = 'camera-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
    stylesInjected = true;
  }

  // --- Camera screen state ---
  let camRoot = null;
  let video = null;
  let sampleCanvas = null;
  let sampleCtx = null;
  let stream = null;
  let viewfinder = null;
  let reticleEl = null;
  let chipEl = null;
  let shutterFill = null;
  let hintEl = null;
  let permissionEl = null;
  let pos = { x: 0, y: 0 };
  let currentSample = { r: 128, g: 128, b: 128, hex: '#808080' };
  let rafPending = false;
  let lastSampleAt = 0;
  let hintDismissed = false;

  function buildCameraScreen() {
    if (camRoot) return;
    camRoot = document.createElement('div');
    camRoot.className = 'cam-screen';
    camRoot.innerHTML = `
      <div class="cam-topbar">
        <button class="cam-iconbtn" data-action="close" aria-label="Close camera">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="cam-title">🎯 Find a Color</div>
        <div style="width:40px"></div>
      </div>
      <div class="cam-viewfinder">
        <video class="cam-video" autoplay playsinline muted></video>
        <canvas class="cam-sample-canvas"></canvas>
        <div class="cam-reticle">
          <div class="ring"></div>
          <div class="disc"></div>
          <div class="cross-v"></div>
          <div class="cross-h"></div>
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
        </div>
        <div class="cam-chip"><span class="cam-chip-text">…</span><div class="arrow"></div></div>
        <div class="cam-hint"><span style="font-size:14px">☝️</span> Move the circle onto a color, then tap the big button</div>
      </div>
      <div class="cam-shutter-bar">
        <button class="cam-shutter" data-action="capture" aria-label="Capture color">
          <div class="fill"></div>
        </button>
      </div>
    `;
    document.body.appendChild(camRoot);

    video = camRoot.querySelector('.cam-video');
    sampleCanvas = camRoot.querySelector('.cam-sample-canvas');
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    viewfinder = camRoot.querySelector('.cam-viewfinder');
    reticleEl = camRoot.querySelector('.cam-reticle');
    chipEl = camRoot.querySelector('.cam-chip');
    shutterFill = camRoot.querySelector('.cam-shutter .fill');
    hintEl = camRoot.querySelector('.cam-hint');

    camRoot.querySelector('[data-action="close"]').addEventListener('click', closeCamera);
    camRoot.querySelector('[data-action="capture"]').addEventListener('click', onCapture);

    // Reticle drag (uses pointer events on the viewfinder, anywhere-tap moves reticle)
    let dragging = false;
    const onPointer = (e) => {
      const rect = viewfinder.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      pos.x = Math.max(0, Math.min(rect.width, cx));
      pos.y = Math.max(0, Math.min(rect.height, cy));
      reticleEl.classList.add('dragging');
      scheduleSample();
    };
    viewfinder.addEventListener('pointerdown', (e) => {
      dragging = true;
      viewfinder.setPointerCapture(e.pointerId);
      onPointer(e);
      dismissHint();
    });
    viewfinder.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      onPointer(e);
    });
    const endDrag = () => {
      dragging = false;
      reticleEl.classList.remove('dragging');
    };
    viewfinder.addEventListener('pointerup', endDrag);
    viewfinder.addEventListener('pointercancel', endDrag);
  }

  function dismissHint() {
    if (hintDismissed || !hintEl) return;
    hintDismissed = true;
    hintEl.classList.add('hidden');
  }

  function scheduleSample() {
    positionReticle();
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const now = performance.now();
      if (now - lastSampleAt < 90) return; // ~10Hz cap
      lastSampleAt = now;
      sampleNow();
    });
  }

  function positionReticle() {
    reticleEl.style.left = (pos.x - 54) + 'px';
    reticleEl.style.top = (pos.y - 54) + 'px';
    positionChip();
  }

  function positionChip() {
    const above = pos.y > 140;
    const top = above ? (pos.y - 118) : (pos.y + 82);
    const wrapW = viewfinder.clientWidth;
    const left = Math.max(12, Math.min(wrapW - 180, pos.x - 84));
    chipEl.style.left = left + 'px';
    chipEl.style.top = top + 'px';
    const arrow = chipEl.querySelector('.arrow');
    arrow.style.left = (pos.x - left - 6) + 'px';
    if (above) {
      arrow.style.bottom = '-6px'; arrow.style.top = '';
    } else {
      arrow.style.top = '-6px'; arrow.style.bottom = '';
    }
  }

  function sampleNow() {
    if (!video.videoWidth) return;
    // Map viewfinder coords to video coords (object-fit: cover scaling).
    const vw = viewfinder.clientWidth;
    const vh = viewfinder.clientHeight;
    const videoAspect = video.videoWidth / video.videoHeight;
    const wrapAspect = vw / vh;

    // object-fit: cover — video fills the viewfinder, center-cropped on the long axis.
    let drawW, drawH, offsetX, offsetY;
    if (videoAspect > wrapAspect) {
      drawH = video.videoHeight;
      drawW = drawH * wrapAspect;
      offsetX = (video.videoWidth - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = video.videoWidth;
      drawH = drawW / wrapAspect;
      offsetX = 0;
      offsetY = (video.videoHeight - drawH) / 2;
    }
    const sx = offsetX + (pos.x / vw) * drawW;
    const sy = offsetY + (pos.y / vh) * drawH;
    const R = 6;

    sampleCanvas.width = R * 2;
    sampleCanvas.height = R * 2;
    try {
      sampleCtx.drawImage(video, sx - R, sy - R, R * 2, R * 2, 0, 0, R * 2, R * 2);
      const data = sampleCtx.getImageData(0, 0, R * 2, R * 2).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      currentSample = { r, g, b, hex: rgbToHex(r, g, b) };
      paintLiveUI(currentSample);
    } catch (e) { /* drawImage can throw before video is ready */ }
  }

  function paintLiveUI(s) {
    const disc = reticleEl.querySelector('.disc');
    disc.style.background = s.hex;
    shutterFill.style.background = s.hex;

    const name = (window.nameColor ? window.nameColor(s.r, s.g, s.b) : '');
    const lum = luminance(s.r, s.g, s.b);
    const textColor = lum > 140 ? '#1a1a1a' : '#ffffff';
    chipEl.style.background = s.hex;
    chipEl.style.color = textColor;
    const txt = chipEl.querySelector('.cam-chip-text');
    txt.textContent = name ? name.toLowerCase() : '';
  }

  // --- Permission handling ---
  function showPermissionState(message, retry) {
    if (permissionEl) permissionEl.remove();
    permissionEl = document.createElement('div');
    permissionEl.className = 'cam-permission';
    permissionEl.innerHTML = `
      <div class="cam-perm-icon">📷</div>
      <div class="cam-perm-msg">${message}</div>
      ${retry ? '<button data-action="retry">Try again</button>' : ''}
    `;
    if (retry) permissionEl.querySelector('[data-action="retry"]').addEventListener('click', () => {
      permissionEl.remove();
      permissionEl = null;
      startCameraStream();
    });
    viewfinder.appendChild(permissionEl);
  }

  async function startCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showPermissionState('Your browser does not support camera access.', false);
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      // Center reticle once we know the size
      requestAnimationFrame(() => {
        const rect = viewfinder.getBoundingClientRect();
        pos = { x: rect.width / 2, y: rect.height / 2 };
        positionReticle();
        sampleNow();
      });
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      const msg = denied
        ? 'Please allow camera access so we can find colors!'
        : 'Could not start the camera. Make sure no other app is using it.';
      showPermissionState(msg, true);
    }
  }

  function stopCameraStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (video) {
      video.srcObject = null;
    }
  }

  function openCamera() {
    injectStyles();
    buildCameraScreen();
    hintDismissed = false;
    if (hintEl) hintEl.classList.remove('hidden');
    camRoot.style.display = 'flex';
    startCameraStream();
  }

  function closeCamera() {
    stopCameraStream();
    if (camRoot) camRoot.style.display = 'none';
    if (permissionEl) { permissionEl.remove(); permissionEl = null; }
  }

  function onCapture() {
    // Quick flash for feedback
    const flash = document.createElement('div');
    flash.className = 'cam-flash';
    viewfinder.appendChild(flash);
    setTimeout(() => flash.remove(), 300);

    const captured = { ...currentSample };
    closeCamera();
    showResult(captured);
  }

  // --- Result screen ---
  let resultRoot = null;

  function buildResultScreen() {
    if (resultRoot) return;
    resultRoot = document.createElement('div');
    resultRoot.className = 'cam-result';
    resultRoot.style.display = 'none';
    resultRoot.innerHTML = `
      <div class="cam-result-header">
        <button class="cam-result-back" data-action="back" aria-label="Back to camera">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d3250" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div class="cam-result-title">🎨 <span class="gradient">Color Mixer</span></div>
        <div style="width:40px"></div>
      </div>
      <div class="cam-result-body">
        <div class="cam-found-card">
          <div class="cam-found-row">
            <button class="cam-speak-btn" data-action="speak" aria-label="Hear name">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
            </button>
            <div class="cam-found-swatch"></div>
            <button class="cam-heart-btn" data-action="heart" aria-label="Save to favorites">
              <svg class="cam-heart-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            </button>
          </div>
          <div class="cam-found-name"></div>
        </div>

        <div class="cam-recipe-card">
          <div class="cam-recipe-eyebrow">How to make it</div>
          <div class="cam-recipe-title">Mix these paints!</div>
          <div class="cam-recipe-equation"></div>
          <div class="cam-recipe-line"></div>
        </div>

        <div class="cam-result-actions">
          <button class="cam-btn-retry" data-action="retry">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 113 6.7"/><polyline points="3 7 3 13 9 13"/></svg>
            Try Again
          </button>
          <button class="cam-btn-save" data-action="save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(resultRoot);
    resultRoot.querySelector('[data-action="back"]').addEventListener('click', () => closeResult(true));
    resultRoot.querySelector('[data-action="retry"]').addEventListener('click', () => closeResult(true));
  }

  let resultState = { sample: null, name: '', isFavorited: false, speaking: false };

  function showResult(sample) {
    injectStyles();
    buildResultScreen();
    const name = (window.nameColor ? window.nameColor(sample.r, sample.g, sample.b) : '') || 'unknown';
    const recipe = findRecipe(sample.hex);

    // Check if already in saved colors
    const saved = (typeof window.getSaved === 'function') ? window.getSaved() : [];
    const isFavorited = saved.some(c => c.hex.toLowerCase() === sample.hex.toLowerCase());

    resultState = { sample, name, isFavorited, speaking: false, recipe };

    // Paint UI
    resultRoot.querySelector('.cam-found-swatch').style.background = sample.hex;
    resultRoot.querySelector('.cam-found-name').textContent = name.toLowerCase();

    const heartBtn = resultRoot.querySelector('.cam-heart-btn');
    const heartIcon = heartBtn.querySelector('.cam-heart-icon');
    heartBtn.classList.toggle('saved', isFavorited);
    heartIcon.setAttribute('fill', isFavorited ? '#ec4899' : 'none');
    heartBtn.onclick = () => toggleFavorite();

    const speakBtn = resultRoot.querySelector('.cam-speak-btn');
    speakBtn.onclick = () => speakName();

    const saveBtn = resultRoot.querySelector('.cam-btn-save');
    saveBtn.classList.remove('done');
    saveBtn.textContent = isFavorited ? 'Saved ✓' : 'Save';
    saveBtn.onclick = () => saveAndClose();

    // Recipe equation
    renderRecipe(sample, recipe);

    resultRoot.style.display = 'flex';
  }

  function renderRecipe(sample, recipe) {
    const eqEl = resultRoot.querySelector('.cam-recipe-equation');
    const lineEl = resultRoot.querySelector('.cam-recipe-line');
    if (!recipe) {
      eqEl.innerHTML = '<span style="color:#7a7fa0;font-weight:700">No recipe available</span>';
      lineEl.innerHTML = '';
      return;
    }
    const nonZero = recipe.parts
      .map((v, i) => ({ v, ...BASE_PAINTS[i] }))
      .filter(p => p.v > 0);

    eqEl.innerHTML = '';
    nonZero.forEach((p, i) => {
      if (i > 0) {
        const plus = document.createElement('span');
        plus.className = 'cam-recipe-plus';
        plus.textContent = '+';
        eqEl.appendChild(plus);
      }
      const chip = document.createElement('div');
      chip.className = 'cam-paint-chip';
      chip.innerHTML = `
        <div class="swatch" style="background:${p.hex}">
          <div class="badge">${p.v}</div>
        </div>
        <div class="label">${p.name}</div>
      `;
      eqEl.appendChild(chip);
    });
    const equals = document.createElement('span');
    equals.className = 'cam-recipe-equals';
    equals.textContent = '=';
    eqEl.appendChild(equals);
    const target = document.createElement('div');
    target.className = 'cam-recipe-target';
    target.style.background = sample.hex;
    eqEl.appendChild(target);

    // Plain-english line
    const parts = nonZero.map((p) =>
      `<span><b>${p.v}</b> part${p.v > 1 ? 's' : ''} ${p.name.toLowerCase()}</span>`
    );
    let joined = '';
    if (parts.length === 1) joined = parts[0];
    else if (parts.length === 2) joined = parts.join(' + ');
    else joined = parts.slice(0, -1).join(', ') + ' + ' + parts[parts.length - 1];
    lineEl.innerHTML = `${joined}<div class="cam-recipe-caption">a spoonful = 1 part</div>`;
  }

  function speakName() {
    if (!('speechSynthesis' in window) || !resultState.name) return;
    const btn = resultRoot.querySelector('.cam-speak-btn');
    speechSynthesis.cancel();
    btn.classList.add('speaking');
    // Reuse the word-by-word slow style from the existing app
    const words = resultState.name.split(/\s+/);
    const pause = 400;
    words.forEach((word, i) => {
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(word);
        u.rate = 0.7;
        if (i === words.length - 1) {
          u.onend = () => btn.classList.remove('speaking');
          u.onerror = () => btn.classList.remove('speaking');
        }
        speechSynthesis.speak(u);
      }, i * pause);
    });
  }

  function toggleFavorite() {
    if (typeof window.getSaved !== 'function' || typeof window.setSaved !== 'function') return;
    const saved = window.getSaved();
    const hexLower = resultState.sample.hex.toLowerCase();
    const exists = saved.some(c => c.hex.toLowerCase() === hexLower);
    let next;
    if (exists) {
      next = saved.filter(c => c.hex.toLowerCase() !== hexLower);
      resultState.isFavorited = false;
    } else {
      next = [...saved, { name: resultState.name, hex: resultState.sample.hex }];
      resultState.isFavorited = true;
    }
    window.setSaved(next);
    const heartBtn = resultRoot.querySelector('.cam-heart-btn');
    const heartIcon = heartBtn.querySelector('.cam-heart-icon');
    heartBtn.classList.toggle('saved', resultState.isFavorited);
    heartIcon.setAttribute('fill', resultState.isFavorited ? '#ec4899' : 'none');
    const saveBtn = resultRoot.querySelector('.cam-btn-save');
    saveBtn.textContent = resultState.isFavorited ? 'Saved ✓' : 'Save';
  }

  function saveAndClose() {
    if (typeof window.getSaved === 'function' && typeof window.setSaved === 'function') {
      const saved = window.getSaved();
      const hexLower = resultState.sample.hex.toLowerCase();
      if (!saved.some(c => c.hex.toLowerCase() === hexLower)) {
        window.setSaved([...saved, { name: resultState.name, hex: resultState.sample.hex }]);
      }
    }
    const saveBtn = resultRoot.querySelector('.cam-btn-save');
    saveBtn.classList.add('done');
    saveBtn.textContent = 'Saved ✓';
    setTimeout(() => closeResult(false), 350);
  }

  function closeResult(reopenCamera) {
    if (resultRoot) resultRoot.style.display = 'none';
    speechSynthesis && speechSynthesis.cancel();
    if (reopenCamera) openCamera();
  }

  window.openCameraSampler = openCamera;
})();
