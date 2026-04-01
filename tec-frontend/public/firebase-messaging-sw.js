importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAaSCelo0yBP2hCHbgJVydDGLVxazwITEB',
  authDomain:        'tec-ecosystem.firebaseapp.com',
  projectId:         'tec-ecosystem',
  messagingSenderId: '275871289568',
  appId:             '1:275871289568:web:5f01875355886985128885',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'TEC', {
    body:  body ?? '',
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
  });
});
