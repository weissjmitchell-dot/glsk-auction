import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const WEBSITE = 'https://glsk-auction.vercel.app';
export function nativeRoute(path) {
  return ({ '/': '/auction.html', '/index.html': '/auction.html', '/league': '/league.html', '/league/': '/league.html', '/supplemental': '/supplemental.html', '/supplemental/': '/supplemental.html', '/phase3': '/phase3.html', '/phase3/': '/phase3.html' })[path] || path;
}
if (Capacitor.isNativePlatform()) {
  // The Capacitor HTTP bridge handles the HTTPS requests without weakening server CORS.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, location.href);
    if (url.protocol === 'capacitor:' && url.hostname === 'localhost' && url.pathname.startsWith('/api/')) {
      const remote = WEBSITE + url.pathname + url.search;
      return originalFetch(input instanceof Request ? new Request(remote, input) : remote, init);
    }
    return originalFetch(input, init);
  };
  // Existing CSV exporters click detached anchors; attach briefly so the handler receives them.
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const attach = !this.isConnected && this.download && this.href.startsWith('blob:');
    if (attach) { this.hidden = true; document.body.appendChild(this); }
    originalClick.call(this);
    if (attach) this.remove();
  };
  document.addEventListener('click', async event => {
    const a = event.target.closest?.('a[href]');
    if (!a) return;
    if (/^[?#]/.test(a.getAttribute('href'))) return;
    const url = new URL(a.href, location.href);
    if (a.download && url.protocol === 'blob:') {
      event.preventDefault();
      try {
        const blob = await (await originalFetch(url.href)).blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reject; reader.readAsDataURL(blob);
        });
        const path = 'glsk-export-' + Date.now() + '-' + a.download.replace(/[^a-zA-Z0-9._-]/g, '_');
        const file = await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
        try { await Share.share({ title: 'GLSK export', files: [file.uri] }); }
        finally { await Filesystem.deleteFile({path, directory: Directory.Cache}).catch(() => {}); }
      } catch { window.alert('The export could not be shared. You can also download it from GLSK in Safari.'); }
      return;
    }
    if (url.protocol === 'capacitor:' && url.hostname === 'localhost') {
      const route = nativeRoute(url.pathname);
      if (route !== url.pathname) {
        event.preventDefault(); location.assign(route + url.search + url.hash);
      }
    } else if (['https:', 'http:'].includes(url.protocol)) {
      event.preventDefault();
      await Browser.open({ url: url.href }).catch(() => window.alert('Unable to open this link. Please try again.'));
    }
  }, true);
  // An explicit refresh is useful in the native window, which has no browser toolbar.
  const refresh = document.createElement('button');
  refresh.textContent = 'Refresh GLSK'; refresh.type = 'button';
  refresh.setAttribute('aria-label', 'Refresh GLSK');
  refresh.style.cssText = 'position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:1000;border:1px solid #ccd5e0;border-radius:20px;padding:8px 12px;background:#fff;color:#17263f;font:600 12px system-ui;box-shadow:0 2px 8px #0002';
  refresh.onclick = () => { if (confirm('Reload GLSK? Any unsaved entries on this screen will be lost.')) location.reload(); };
  document.body.appendChild(refresh);
}
