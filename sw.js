// Nombre de la caché (cámbialo si haces una actualización grande)
const CACHE_NAME = 'control-produccion-cache-v1';

// Archivos y URLs a guardar en caché para que la app funcione offline
const urlsToCache = [
  'index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tinos&display=swap'
];

// Evento 'install': se dispara cuando el Service Worker se instala.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caché abierta y archivos principales guardados.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': intercepta todas las peticiones de red.
// Estrategia: "Cache first, then network". Intenta servir desde la caché, y si no puede, va a la red.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en la caché, lo devolvemos.
        if (response) {
          return response;
        }

        // Si no, lo pedimos a la red.
        return fetch(event.request).then(
          networkResponse => {
            // Si la petición fue exitosa, la guardamos en caché para la próxima vez.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              // No cacheamos respuestas de error o de tipos no básicos (como las de extensiones).
              return networkResponse;
            }

            // Clonamos la respuesta porque es un "stream" y solo se puede consumir una vez.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});

// Evento 'activate': se dispara cuando el Service Worker se activa.
// Sirve para limpiar cachés antiguas y mantener todo actualizado.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
