/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'datapulse-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// API routes that should work offline (with IndexedDB fallback)
const OFFLINE_API_ROUTES = [
  '/api/forms/',
  '/api/projects/',
  '/api/submissions/'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(PRECACHE_ASSETS.filter(url => !url.includes('/static/')));
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[SW] Cache failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL) || caches.match('/'))
    );
    return;
  }

  // Handle static assets - cache first
  event.respondWith(cacheFirstStrategy(request));
});

// Network first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to get from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ error: 'offline', message: 'You are currently offline' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a fallback for images
    if (request.destination === 'image') {
      return new Response('', { status: 404 });
    }
    throw error;
  }
}

// Handle background sync for offline submissions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-submissions') {
    event.waitUntil(syncOfflineSubmissions());
  }
});

// Sync offline submissions when back online
async function syncOfflineSubmissions() {
  // This will be handled by the main app via IndexedDB
  // Notify clients to sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_SUBMISSIONS' });
  });
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      tag: data.tag || 'datapulse-notification',
      requireInteraction: data.requireInteraction || false,
      data: {
        ...data.data,
        url: data.data?.action_url || '/',
        timestamp: new Date().toISOString()
      },
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'DataPulse', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  let targetUrl = '/';
  
  // Handle specific actions
  if (event.action === 'review') {
    targetUrl = notificationData.action_url || `/quality/review/${notificationData.submission_id}`;
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else if (notificationData.url) {
    targetUrl = notificationData.url;
  } else if (notificationData.action_url) {
    targetUrl = notificationData.action_url;
  }
  
  // Handle different notification categories
  switch (notificationData.category) {
    case 'quality':
      targetUrl = notificationData.action_url || `/quality/review/${notificationData.submission_id}`;
      break;
    case 'submissions':
      targetUrl = `/submissions/${notificationData.submission_id}`;
      break;
    case 'backcheck':
      targetUrl = '/backcheck';
      break;
    case 'devices':
      targetUrl = '/devices';
      break;
    case 'team':
      targetUrl = '/settings?tab=organization';
      break;
    default:
      // Use the provided URL or default to home
      break;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if any client is already at the target URL
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Focus existing window and navigate, or open new one
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      
      // Open new window if no existing window found
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed without interaction');
  // Could send analytics here if needed
});

console.log('[SW] Service worker loaded');
