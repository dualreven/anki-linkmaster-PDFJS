// Lightweight bootstrap to ensure QWebChannel is available under Qt WebEngine.
// If running inside Qt (window.qt exists) and QWebChannel is missing, try to load
// the official script from the Qt resource scheme.
(function ensureQWebChannel() {
  try {
    if (typeof window === 'undefined') return;
    if (typeof window.QWebChannel !== 'undefined') return;
    if (typeof window.qt === 'undefined' || !window.qt) return;

    var s = document.createElement('script');
    s.src = 'qrc:///qtwebchannel/qwebchannel.js';
    s.async = true;
    s.onload = function () {
      try { console.info('[qwebchannel] Loaded from Qt resource scheme'); } catch (e) {}
    };
    s.onerror = function () {
      try { console.warn('[qwebchannel] Failed to load from Qt resource scheme'); } catch (e) {}
    };
    var current = document.currentScript;
    if (current && current.parentNode) {
      current.parentNode.insertBefore(s, current);
    } else {
      document.head.appendChild(s);
    }
  } catch (e) {
    try { console.warn('[qwebchannel] bootstrap failed:', e && e.message ? e.message : e); } catch (_) {}
  }
})();

