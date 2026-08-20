self.addEventListener('push', (event) => {
  let payload = {
    title: 'New Chatify message',
    body: 'Open Chatify to read it.',
    url: '/chat',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : payload.title,
        body: typeof parsed.body === 'string' ? parsed.body : payload.body,
        url: typeof parsed.url === 'string' ? parsed.url : payload.url,
      };
    }
  } catch {
    payload = {
      title: 'New Chatify message',
      body: 'Open Chatify to read it.',
      url: '/chat',
    };
  }

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
  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((navigatedClient) => (
              navigatedClient ? navigatedClient.focus() : client.focus()
            ));
          }

          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
