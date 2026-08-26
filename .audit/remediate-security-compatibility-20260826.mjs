import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = new Set();
const target = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(target(relativePath), 'utf8');
const write = (relativePath, value) => {
  const output = value.endsWith('\n') ? value : `${value}\n`;
  fs.mkdirSync(path.dirname(target(relativePath)), { recursive: true });
  if (!fs.existsSync(target(relativePath)) || read(relativePath) !== output) {
    fs.writeFileSync(target(relativePath), output);
    changed.add(relativePath);
  }
};

write('Frontend/Chatify/src/api/apiOrigin.ts', `type RuntimeEnv = {
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
  VITE_BACKEND_URL?: string;
  VITE_SOCKET_URL?: string;
  VITE_USE_SAME_ORIGIN_API?: string;
};

type RuntimeLocation = { origin: string };
const LOCAL_BACKEND_URL = 'http://localhost:3000';

const getRuntimeLocation = (): RuntimeLocation | undefined => (
  typeof window === 'undefined' ? undefined : window.location
);

const parseOrigin = (value: string, { production = false } = {}) => {
  const parsed = new URL(value);
  if (
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    (parsed.pathname && parsed.pathname !== '/') ||
    !['http:', 'https:'].includes(parsed.protocol)
  ) {
    throw new Error('API and socket URLs must be plain HTTP(S) origins');
  }
  if (production && parsed.protocol !== 'https:') {
    throw new Error('Production API and socket URLs must use HTTPS');
  }
  return parsed.origin;
};

const configuredOrigin = (value: string | undefined, env: RuntimeEnv) => {
  const normalized = value?.trim();
  return normalized ? parseOrigin(normalized, { production: env.PROD === true }) : undefined;
};

const shouldUseSameOriginApi = (env: RuntimeEnv, location?: RuntimeLocation) => Boolean(
  env.PROD && location && env.VITE_USE_SAME_ORIGIN_API !== 'false'
);

export const resolveApiBaseUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  const explicit = configuredOrigin(env.VITE_API_BASE_URL ?? env.VITE_BACKEND_URL, env);
  if (explicit) return explicit;
  if (shouldUseSameOriginApi(env, location) && location) return location.origin;
  return LOCAL_BACKEND_URL;
};

export const resolveSocketUrl = (
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => {
  const explicitSocket = configuredOrigin(env.VITE_SOCKET_URL, env);
  if (explicitSocket) return explicitSocket;
  if (shouldUseSameOriginApi(env, location) && location) return location.origin;
  return resolveApiBaseUrl(env, location);
};

export const resolveSocketBaseUrl = resolveSocketUrl;

export const resolveOAuthUrl = (
  provider: 'google' | 'github' | 'discord',
  env: RuntimeEnv = import.meta.env,
  location = getRuntimeLocation()
) => `${resolveApiBaseUrl(env, location)}/api/auth/${provider}`;
`);

write('Frontend/Chatify/vercel.json', `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' blob: https:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests"
        },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-site" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
`);

write('Frontend/Chatify/public/chatify-service-worker.js', `const safeNavigationTarget = (value) => {
  try {
    const target = new URL(typeof value === 'string' ? value : '/chat', self.location.origin);
    return target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/chat';
  } catch {
    return '/chat';
  }
};

self.addEventListener('push', (event) => {
  let payload = { title: 'New Chatify message', body: 'Open Chatify to read it.', url: '/chat' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : payload.title,
        body: typeof parsed.body === 'string' ? parsed.body : payload.body,
        url: safeNavigationTarget(parsed.url),
      };
    }
  } catch {
    payload = { title: 'New Chatify message', body: 'Open Chatify to read it.', url: '/chat' };
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: 'chatify-message',
    data: { url: safeNavigationTarget(payload.url) },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = safeNavigationTarget(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
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
  }));
});
`);

const encryptedPath = 'Frontend/Chatify/src/utils/encryptedMessages.ts';
if (fs.existsSync(target(encryptedPath))) {
  let encrypted = read(encryptedPath);
  if (encrypted.includes("const ENCRYPTION_KEYRING_DB = 'chatify-e2ee-keyring-v1';")) {
    encrypted = encrypted.replace(
      /const synchronizeCacheMarker = \(\) => \{[\s\S]*?\n\};\n/,
      `const synchronizeCacheMarker = () => {\n  if (!hasStorage()) return;\n  const current = window.localStorage.getItem('chatify:e2ee:keyring-session');\n  if (cacheMarker && current !== cacheMarker) secretCache.clear();\n  if (!cacheMarker) {\n    cacheMarker = current || crypto.randomUUID();\n    window.localStorage.setItem('chatify:e2ee:keyring-session', cacheMarker);\n  } else {\n    cacheMarker = current;\n  }\n};\n`
    );
    if (!encrypted.includes('const deletePersistedSecret = async')) {
      const anchor = `const synchronizeCacheMarker = () => {`;
      const position = encrypted.indexOf(anchor);
      const end = encrypted.indexOf('\n};\n', position) + 4;
      const helper = `\nconst deletePersistedSecret = async (accountId: string, chatId: string) => {\n  const db = await openKeyring();\n  if (!db) return;\n  try {\n    const transaction = db.transaction(ENCRYPTION_KEYRING_STORE, 'readwrite');\n    transaction.objectStore(ENCRYPTION_KEYRING_STORE).delete(\`\${accountId}:\${chatId}\`);\n    await transactionComplete(transaction);\n  } finally {\n    db.close();\n  }\n};\n`;
      encrypted = `${encrypted.slice(0, end)}${helper}${encrypted.slice(end)}`;
    }
    encrypted = encrypted.replace(
      /export const clearConversationSecret = \(chatId: string\) => \{\s*secretCache\.delete\(chatId\);\s*\};/,
      `export const clearConversationSecret = (chatId: string) => {\n  secretCache.delete(chatId);\n  if (activeEncryptionAccountId) void deletePersistedSecret(activeEncryptionAccountId, chatId);\n};`
    );
    write(encryptedPath, encrypted);
  }
}

const authHookPath = 'Frontend/Chatify/src/hooks/useAuthQuery.ts';
if (fs.existsSync(target(authHookPath))) {
  let hook = read(authHookPath);
  if (hook.includes('lockConversationSecrets')) {
    hook = hook.replace(
      /clearPresenceState\(\)\n\s*lockConversationSecrets\(\)\n\s*lockConversationSecrets\(\)/g,
      'clearPresenceState()\n      lockConversationSecrets()'
    );
    write(authHookPath, hook);
  }
}

const callStatePath = 'Backend/Chatify/Utils/callSessionState.mjs';
if (fs.existsSync(target(callStatePath))) {
  let callState = read(callStatePath);
  const terminalStatuses = ['REJECTED', 'MISSED', 'ENDED', 'FAILED', 'CANCELED', 'BLOCKED'];
  for (const name of terminalStatuses) {
    const pattern = new RegExp(`status:\\s*CALL_STATUS\\.${name}([\\s\\S]{0,220}?)\\$set:\\s*\\{`, 'g');
    callState = callState.replace(pattern, (match) => match);
  }
  write(callStatePath, callState);
}

write('Backend/Chatify/test/security/call-ice-credentials.test.mjs', `import { describe, expect, it } from 'vitest';
import { getCallIceConfig } from '../../Utils/callIceConfig.mjs';

describe('call ICE credential isolation', () => {
  const env = {
    NODE_ENV: 'production',
    CALL_STUN_URLS: 'stun:stun.example.test:3478',
    CALL_TURN_URLS: 'turn:turn.example.test:3478',
    CALL_TURN_SECRET: 'test-turn-rest-secret',
    CALL_TURN_CREDENTIAL_TTL_SECONDS: '600',
  };

  it('does not disclose TURN credentials in readiness configuration', () => {
    const configuration = getCallIceConfig({ includeCredentials: false }, env);
    expect(configuration.turnReady).toBe(true);
    expect(configuration.productionReady).toBe(true);
    expect(configuration.iceServers).toEqual([{ urls: 'stun:stun.example.test:3478' }]);
    expect(JSON.stringify(configuration)).not.toContain('test-turn-rest-secret');
  });

  it('issues call-bound short-lived TURN REST credentials', () => {
    const configuration = getCallIceConfig({
      includeCredentials: true,
      subject: 'user-123',
      callId: 'call-456',
      now: new Date('2026-08-26T00:00:00.000Z'),
    }, env);
    const turn = configuration.iceServers.find((server) => String(server.urls).startsWith('turn:'));
    expect(turn).toMatchObject({ urls: 'turn:turn.example.test:3478' });
    expect(turn.username).toContain('user-123:call-456');
    expect(turn.credential).toEqual(expect.any(String));
    expect(turn.credential).not.toBe(env.CALL_TURN_SECRET);
    expect(configuration.credentialExpiresAt).toBe('2026-08-26T00:10:00.000Z');
  });
});
`);

write('Backend/Chatify/test/security/database-startup-policy.test.mjs', `import { describe, expect, it } from 'vitest';
import { buildMongoConnectionOptions, validateMongoConnectionUrl } from '../../Config/DBConfig.mjs';

describe('database startup policy', () => {
  it('fails closed without a valid MongoDB URL', () => {
    expect(() => validateMongoConnectionUrl('', { NODE_ENV: 'production' })).toThrow('MONGODB_URL is required');
    expect(() => validateMongoConnectionUrl('https://db.example', { NODE_ENV: 'production' })).toThrow(/mongodb/i);
    expect(() => validateMongoConnectionUrl('mongodb://db.example/chatify?tls=false', { NODE_ENV: 'production' })).toThrow(/TLS/i);
  });

  it('uses bounded production connection settings', () => {
    expect(buildMongoConnectionOptions({ NODE_ENV: 'production' })).toMatchObject({
      tls: true,
      maxPoolSize: 20,
      waitQueueTimeoutMS: 5000,
      serverSelectionTimeoutMS: 10000,
    });
  });
});
`);

write('Frontend/Chatify/src/security/apiOrigin.security.test.ts', `// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, resolveOAuthUrl, resolveSocketUrl } from '../api/apiOrigin';

describe('deployment-specific API origins', () => {
  it('uses the application origin by default in production', () => {
    const env = { PROD: true };
    const location = { origin: 'https://chatify.example' };
    expect(resolveApiBaseUrl(env, location)).toBe(location.origin);
    expect(resolveSocketUrl(env, location)).toBe(location.origin);
  });

  it('accepts an explicit HTTPS origin and rejects credentialed or insecure production URLs', () => {
    expect(resolveApiBaseUrl({ PROD: true, VITE_API_BASE_URL: 'https://api.chatify.example/' }, { origin: 'https://chatify.example' }))
      .toBe('https://api.chatify.example');
    expect(() => resolveApiBaseUrl({ PROD: true, VITE_API_BASE_URL: 'http://api.chatify.example' }, { origin: 'https://chatify.example' }))
      .toThrow(/HTTPS/);
    expect(() => resolveApiBaseUrl({ PROD: true, VITE_API_BASE_URL: 'https://user:pass@api.chatify.example' }, { origin: 'https://chatify.example' }))
      .toThrow(/origins/);
  });

  it('builds OAuth URLs from the same validated API boundary', () => {
    expect(resolveOAuthUrl('google', { PROD: true }, { origin: 'https://chatify.example' }))
      .toBe('https://chatify.example/api/auth/google');
  });
});
`);

console.log(`Compatibility remediation changed ${changed.size} file(s).`);
for (const relativePath of [...changed].sort()) console.log(`- ${relativePath}`);
