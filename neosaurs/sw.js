// Service Worker for Neosaur PWA
const CACHE_NAME = 'neosaur-v10';
const ASSETS = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/appicon.png',
    '/hello.mp3', '/get.mp3', '/Explode.mp3', '/macR.mp3', '/macC.mp3', '/macL.mp3',
    '/BEA.mp3', '/tock.mp3', '/good.mp3', '/last.mp3', '/dm.mp3', '/lost.mp3',
    '/winsong.mp3', '/intro.mp3', '/score.mp3', '/up.mp3', '/nnn.mp3', '/dmm.mp3',
    '/theme.mp3', '/BGM-2.mp3', '/xmen.mp3',
    '/stop.mp3', '/Back.mp3', '/return.mp3',
    '/tap.mp3', '/1st.mp3', '/st.mp3', '/new.mp3', '/8-dm.mp3', '/8-good.mp3',
    '/lock.mp3', '/ccc.mp3', '/64bit-d.mp3', '/star.mp3', '/hel.mp3',
    '/next-c.mp3', '/jump.mp3', '/item-j.mp3', '/8-j.mp3', '/c-hover.mp3',
    '/tung.mp3', '/77-clear.mp3', '/classic.mp3'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Game JS files (.js): stale-while-revalidate for PWA speed
    // Serve cached version immediately (fast launch), then update cache in background
    if (url.pathname.endsWith('.js') && url.pathname !== '/sw.js') {
        e.respondWith(
            caches.match(e.request).then((cached) => {
                const networkFetch = fetch(e.request).then((resp) => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    }
                    return resp;
                }).catch(() => cached);

                // If cached, return immediately (PWA fast launch)
                // Network fetch runs in background to update cache
                return cached || networkFetch;
            })
        );
        return;
    }

    // CSS files: stale-while-revalidate (same pattern)
    if (url.pathname.endsWith('.css')) {
        e.respondWith(
            caches.match(e.request).then((cached) => {
                const networkFetch = fetch(e.request).then((resp) => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    }
                    return resp;
                }).catch(() => cached);
                return cached || networkFetch;
            })
        );
        return;
    }

    // Audio files: cache-first (large, rarely change)
    if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.wav') || url.pathname.endsWith('.aiff')) {
        e.respondWith(
            caches.match(e.request).then((cached) => cached || fetch(e.request).then(resp => {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return resp;
            }))
        );
    } else {
        // HTML/images: network-first with cache fallback
        e.respondWith(
            fetch(e.request).then(resp => {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return resp;
            }).catch(() => caches.match(e.request))
        );
    }
});
