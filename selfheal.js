/*! selfheal.js — small self-healing layer for the Samskar site.
 *  Heals: failed images, failed hero background, failed Google Fonts,
 *  hero content stuck invisible, runtime errors/rejections, offline use.
 *  Never throws, never loops (heal budget), no dependencies.
 *  Recovery switch: add ?nosw to any URL to unregister the service worker and clear caches.
 */
(function () {
  'use strict';
  if (window.SelfHeal) return;

  var PHONE_TEL = '+918088839040', PHONE_TXT = '+91 80888 39040';
  var FALLBACK_IMG = '/icon-192.png';
  var MAX_IMG_RETRIES = 2, MAX_HEALS = 40, MAX_LOGS = 20;
  var heals = 0, logs = 0;

  function log() {
    if (logs++ >= MAX_LOGS) return;
    try { console.warn.apply(console, ['[selfheal]'].concat([].slice.call(arguments))); } catch (e) {}
  }
  function budget() { return ++heals <= MAX_HEALS; }
  function guard(fn, fallback) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) { log('guarded error:', e && e.message); return fallback; }
    };
  }
  function each(sel, fn) {
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  /* ---------- 1. Images: retry with backoff, then fallback, then hide ---------- */
  var healImg = guard(function (img) {
    if (!img || img.dataset.shDone || !budget()) return;
    var n = +img.dataset.shRetry || 0;
    if (!img.dataset.shSrc) img.dataset.shSrc = img.getAttribute('src') || '';
    if (!img.dataset.shSrc) return;

    if (n < MAX_IMG_RETRIES) {
      img.dataset.shRetry = n + 1;
      setTimeout(guard(function () {
        var u = new URL(img.dataset.shSrc, location.href);
        u.searchParams.set('r', Date.now());
        img.src = u.href;
      }), 800 * Math.pow(2, n));
      return;
    }
    if (img.dataset.shSrc.indexOf(FALLBACK_IMG) === -1 && img.alt) {
      img.dataset.shRetry = 0;
      img.dataset.shSrc = FALLBACK_IMG;      // one more cycle using the emblem
      img.src = FALLBACK_IMG;
      return;
    }
    img.dataset.shDone = '1';                // give up quietly, keep layout intact
    img.style.visibility = 'hidden';
    log('image gave up:', img.dataset.shSrc);
  });

  function sweepImages() {
    each('img', function (img) {
      if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src)) healImg(img);
    });
  }

  /* ---------- 2. Hero background photo: drop it, keep the gradient ---------- */
  var healHeroBg = guard(function () {
    var hero = document.querySelector('.hero');
    var bg = hero && hero.style.backgroundImage;
    var m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (!m) return;
    var probe = new Image();
    probe.onerror = guard(function () {
      hero.style.backgroundImage = hero.style.backgroundImage.replace(/,\s*url\([^)]*\)/, '');
      log('hero background failed; using gradient only');
    });
    probe.src = m[1];
  });

  /* ---------- 3. Google Fonts: re-trigger if the stylesheet never applied ---------- */
  var fontsHealed = false;
  var healFonts = guard(function () {
    var link = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    if (!link || link.sheet || fontsHealed || !budget()) return;
    fontsHealed = true;
    if (link.rel === 'preload') { link.rel = 'stylesheet'; return; }  // onload swap never fired
    var fresh = document.createElement('link');
    fresh.rel = 'stylesheet';
    fresh.href = link.href;
    link.parentNode.replaceChild(fresh, link);
  });

  /* ---------- 4. Hero content stuck at opacity:0 (animation blocked/failed) ---------- */
  var healReveal = guard(function () {
    each('.hero-panel, .hero h1, .hero p.lede, .hero-actions, .hero-locations', function (el) {
      if (getComputedStyle(el).opacity === '0') el.style.opacity = '1';
    });
  });

  /* ---------- 5. Offline notice + WhatsApp fallback ---------- */
  var toastEl, toastTimer;
  var toast = guard(function (parts, sticky) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:100;' +
        'max-width:min(92vw,420px);padding:12px 18px;border-radius:14px;background:#4A141C;color:#FBF3E6;' +
        'font:400 14px/1.45 Jost,system-ui,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.25);text-align:center';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (typeof p === 'string') toastEl.appendChild(document.createTextNode(p));
      else {
        var a = document.createElement('a');
        a.href = p.href; a.textContent = p.text;
        a.style.cssText = 'color:#E7C77E;text-decoration:underline';
        toastEl.appendChild(a);
      }
    }
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(hideToast, 7000);
  });
  var hideToast = guard(function () { if (toastEl) toastEl.style.display = 'none'; });

  window.addEventListener('offline', function () {
    toast(['You’re offline. The page still works, but WhatsApp needs a connection.'], true);
  });
  window.addEventListener('online', guard(function () {
    hideToast(); healFonts(); sweepImages();
  }));
  document.addEventListener('click', guard(function (e) {
    if (navigator.onLine !== false) return;
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
    if (!a) return;
    e.preventDefault();
    toast(['No connection right now. Call us on ', { href: 'tel:' + PHONE_TEL, text: PHONE_TXT }, ' or try again shortly.']);
  }));

  /* ---------- 6. Global safety net: log, never crash the page ---------- */
  window.addEventListener('error', guard(function (e) {
    var t = e.target;
    if (t && t !== window) {
      if (t.tagName === 'IMG') healImg(t);
      else if (t.tagName === 'LINK' || t.tagName === 'SCRIPT') log('resource failed:', t.href || t.src);
      return;
    }
    log('runtime error:', e.message, (e.filename || '') + ':' + (e.lineno || 0));
  }), true);
  window.addEventListener('unhandledrejection', guard(function (e) {
    log('unhandled rejection:', e.reason && (e.reason.message || e.reason));
    e.preventDefault();
  }));

  /* ---------- 7. Service worker (offline shell) + recovery switch ---------- */
  var setupSW = guard(function () {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    if (/[?&]nosw\b/.test(location.search)) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(function (err) { log('sw register failed:', err && err.message); });
  });

  /* ---------- boot ---------- */
  function onReady() {
    healHeroBg();
    setTimeout(healReveal, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard(onReady));
  else onReady();

  window.addEventListener('load', guard(function () {
    sweepImages();
    setTimeout(healFonts, 4000);
    setupSW();
  }));

  window.SelfHeal = { guard: guard, log: log };   // wrap future code: SelfHeal.guard(fn)
})();
