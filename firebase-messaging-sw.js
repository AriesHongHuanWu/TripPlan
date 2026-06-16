// FCM background messages handler (separate from the PWA service worker sw.js).
// Only used when push is enabled + the app is in the background.
/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCzS3b9OtXOABiTt-xihcKv2riKNEaZf7A',
  authDomain: 'planaiid.firebaseapp.com',
  projectId: 'planaiid',
  messagingSenderId: '211797227663',
  appId: '1:211797227663:web:220bd756e64c3f549598fa',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || '旅程提醒', {
    body: n.body || '',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
