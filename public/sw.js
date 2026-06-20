const CACHE_NAME = 'fortegado-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-pwa.jpg',
  '/favicon.svg',
  '/icons.svg'
];

// Instalação: cachear assets iniciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando assets fundamentais');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Falha ao cachear algum asset na inicialização:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // Não interceptar requisições que não sejam GET ou que sejam para APIs externas
  if (
    event.request.method !== 'GET' ||
    !requestUrl.startsWith(self.location.origin) ||
    requestUrl.includes('supabase.co') || 
    requestUrl.includes('supabase.com') ||
    requestUrl.includes('googleapis.com')
  ) {
    return;
  }

  const isHashedAsset = requestUrl.includes('/assets/');

  if (isHashedAsset) {
    // Cache-First (arquivos compilados pelo Vite contêm hash no nome e nunca mudam)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        });
      })
    );
  } else {
    // Stale-While-Revalidate para outros recursos locais (index.html, manifest, icons, etc.)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Se falhar a rede (offline) e for navegação de página, retorna index.html
            if (event.request.mode === 'navigate') {
              return cache.match('/index.html');
            }
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
