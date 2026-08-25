const CHATIFY_CACHE_PREFIX = 'chatify-';
const DEFAULT_NOTIFICATION_TITLE = 'New Chatify message';
const DEFAULT_NOTIFICATION_BODY = 'Open Chatify to read it.';
const DEFAULT_NOTIFICATION_PATH = '/';
const MAX_NOTIFICATION_TITLE_LENGTH = 80;
const MAX_NOTIFICATION_BODY_LENGTH = 180;
const MAX_NOTIFICATION_PATH_LENGTH = 2_048;

const containsControlCharacters = (value) => Array.from(value).some((character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint <= 0x1f || codePoint === 0x7f;
});

const sanitizeNotificationText = (value, fallback, maxLength) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const cleaned = Array.from(value)
    .map((character) => containsControlCharacters(character) ? ' ' : character)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || fallback).slice(0, maxLength);
};

const normalizeNotificationPath = (value) => {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_NOTIFICATION_PATH_LENGTH
    || value !== value.trim()
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || containsControlCharacters(value)
  ) {
    return DEFAULT_NOTIFICATION_PATH;
  }

  try {
    const parsed = new URL(value, self.location.origin);

    if (parsed.origin !== self.location.origin) {
      return DEFAULT_NOTIFICATION_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_NOTIFICATION_PATH;
  }
};

const clearChatifyPrivateCaches = async () => {
  const cacheNames = await caches.keys();
  const ownedCacheNames = cacheNames.filter((cacheName) => (
    typeof cacheName === 'string' && cacheName.startsWith(CHATIFY_CACHE_PREFIX)
  ));

  await Promise.all(ownedCacheNames.map((cacheName) => caches.delete(cacheName)));
};

const readPushPayload = (event) => {
  let parsed = {};

  try {
    if (event.data) {
      parsed = event.data.json();
    }
  } catch {
    parsed = {};
  }

  return {
    title: sanitizeNotificationText(
      parsed?.title,
      DEFAULT_NOTIFICATION_TITLE,
      MAX_NOTIFICATION_TITLE_LENGTH
    ),
    body: sanitizeNotificationText(
      parsed?.body,
      DEFAULT_NOTIFICATION_BODY,
      MAX_NOTIFICATION_BODY_LENGTH
    ),
    url: normalizeNotificationPath(parsed?.url),
  };
};

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.resolve(self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    clearChatifyPrivateCaches(),
    self.clients.claim(),
  ]));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHATIFY_CLEAR_PRIVATE_STATE') {
    return;
  }

  event.waitUntil(clearChatifyPrivateCaches());
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: 'chatify-message',
      data: {
        url: payload.url,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = normalizeNotificationPath(event.notification.data?.url);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const sameOriginClient = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (sameOriginClient) {
        const navigatedClient = 'navigate' in sameOriginClient
          ? await sameOriginClient.navigate(targetUrl)
          : sameOriginClient;
        const focusTarget = navigatedClient || sameOriginClient;

        if ('focus' in focusTarget) {
          return focusTarget.focus();
        }

        return focusTarget;
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
