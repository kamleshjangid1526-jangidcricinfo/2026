/* Jangid Cricinfo GitHub Pages API compatibility layer.
   Keeps the existing Control Board API calls while routing them to Firebase. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  let resolveBridge;
  let rejectBridge;
  const ready = new Promise((resolve, reject) => { resolveBridge = resolve; rejectBridge = reject; });
  window.__JC_FIREBASE_BRIDGE_READY__ = ready;
  window.__JC_FIREBASE_BRIDGE_RESOLVE__ = resolveBridge;
  window.__JC_FIREBASE_BRIDGE_REJECT__ = rejectBridge;
  window.__JC_FIREBASE_EVENTS__ = new Set();
  window.__JC_LAST_PUBLIC_PAYLOAD__ = null;
  window.__JC_FIREBASE_INIT_ERROR__ = null;
  window.__JC_EMIT_PUBLIC__ = payload => {
    window.__JC_LAST_PUBLIC_PAYLOAD__ = payload;
    const event = { data: JSON.stringify(payload) };
    for (const source of window.__JC_FIREBASE_EVENTS__) {
      try { source.onmessage?.(event); } catch (error) { console.error('Jangid realtime listener:', error); }
      try { source.dispatchEvent?.(new MessageEvent('message', { data: event.data })); } catch {}
    }
  };

  window.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, window.location.href); }
    catch { return nativeFetch(input, init); }
    if (url.pathname === '/events') {
      return new Response('Firebase realtime listener is active in this page.', {
        status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    try {
      const bridge = await ready;
      const result = await bridge.handleApi(url, init);
      return new Response(JSON.stringify(result.body ?? {}), {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    } catch (error) {
      const message = error?.message || 'Firebase connection could not be started.';
      window.__JC_FIREBASE_INIT_ERROR__ = message;
      try {
        const show = () => {
          if (!document.body || document.getElementById('jcFirebaseSetupNotice')) return;
          const notice = document.createElement('div');
          notice.id = 'jcFirebaseSetupNotice';
          notice.setAttribute('role', 'alert');
          notice.style.cssText = 'position:relative;z-index:99999;margin:10px;padding:12px 15px;border:1px solid #b45309;border-radius:12px;background:#fff7ed;color:#7c2d12;font:600 14px/1.5 system-ui,sans-serif;';
          notice.textContent = `Online Firebase setup अभी पूरी नहीं है: ${message}`;
          document.body.prepend(notice);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once:true }); else show();
      } catch {}
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: error?.status || 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
  };

  class FirebaseEventSource {
    constructor(url) {
      this.url = url;
      this.onmessage = null;
      this.onerror = null;
      this.onopen = null;
      this.listeners = new Map();
      this.closed = false;
      this.readyState = 0;
      window.__JC_FIREBASE_EVENTS__?.add(this);
      window.__JC_FIREBASE_BRIDGE_READY__.then(() => {
        if (this.closed) return;
        this.readyState = 1;
        const event = new Event('open');
        try { this.onopen?.(event); } catch {}
        for (const fn of this.listeners.get('open') || []) { try { fn(event); } catch {} }
      }).catch(error => {
        this.readyState = 2;
        const event = new Event('error'); event.error = error;
        try { this.onerror?.(event); } catch {}
        for (const fn of this.listeners.get('error') || []) { try { fn(event); } catch {} }
      });
    }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
    dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) { try { fn(event); } catch (error) { console.error(error); } } return true; }
    close() { this.closed = true; this.readyState = 2; window.__JC_FIREBASE_EVENTS__?.delete(this); }
  }
  window.EventSource = FirebaseEventSource;
})();
