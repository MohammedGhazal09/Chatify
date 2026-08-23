const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_BROWSER_URL_LENGTH = 2_048;
const AUTH_ENTRY_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
]);

const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();

  if (normalized === 'localhost' || normalized === '::1' || normalized === '[::1]') {
    return true;
  }

  const match = normalized.match(/^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return Boolean(match && match.slice(1).every((part) => Number(part) <= 255));
};

const normalizeFallbackPath = (value: string) => (
  typeof value === 'string'
  && value.startsWith('/')
  && !value.startsWith('//')
  && !value.includes('\\')
  && !CONTROL_CHARACTERS.test(value)
    ? value
    : '/'
);

export const normalizeInternalAppPath = (
  value: unknown,
  fallback = '/'
) => {
  const safeFallback = normalizeFallbackPath(fallback);

  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_BROWSER_URL_LENGTH
    || value !== value.trim()
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || CONTROL_CHARACTERS.test(value)
  ) {
    return safeFallback;
  }

  try {
    const base = new URL('https://chatify.invalid');
    const parsed = new URL(value, base);

    if (parsed.origin !== base.origin || AUTH_ENTRY_PATHS.has(parsed.pathname)) {
      return safeFallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
};

type TrustedOriginOptions = {
  production: boolean;
  fallbackOrigin: string;
};

const parseOrigin = (
  value: unknown,
  { production, allowFallback = false }: { production: boolean; allowFallback?: boolean }
) => {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_BROWSER_URL_LENGTH
    || value !== value.trim()
    || CONTROL_CHARACTERS.test(value)
    || !/^https?:\/\//i.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const isHttp = parsed.protocol === 'http:';
    const isHttps = parsed.protocol === 'https:';

    if (
      (!isHttp && !isHttps)
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname && parsed.pathname !== '/')
    ) {
      return null;
    }

    if (production && !isHttps) {
      return null;
    }

    if (!production && isHttp && !isLoopbackHostname(parsed.hostname) && !allowFallback) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

export const resolveTrustedHttpOrigin = (
  value: unknown,
  options: TrustedOriginOptions
) => {
  const fallback = parseOrigin(options.fallbackOrigin, {
    production: options.production,
    allowFallback: true,
  }) ?? (options.production ? 'https://localhost' : 'http://localhost');

  return parseOrigin(value, { production: options.production }) ?? fallback;
};

type SafeApiRequestOptions = {
  baseURL: string;
  runtimeOrigin: string;
  requestBaseURL?: string;
};

const unsafeApiTarget = () => new Error('Unsafe API request target');

export const assertSafeApiRequestTarget = (
  target: unknown,
  options: SafeApiRequestOptions
) => {
  if (
    typeof target !== 'string'
    || target.length === 0
    || target.length > MAX_BROWSER_URL_LENGTH
    || target !== target.trim()
    || target.startsWith('//')
    || target.includes('\\')
    || CONTROL_CHARACTERS.test(target)
  ) {
    throw unsafeApiTarget();
  }

  let trustedBase: URL;
  let requestBase: URL;
  let resolved: URL;

  try {
    trustedBase = new URL(options.baseURL, options.runtimeOrigin);
    requestBase = new URL(options.requestBaseURL ?? options.baseURL, options.runtimeOrigin);
    resolved = new URL(target, requestBase);
  } catch {
    throw unsafeApiTarget();
  }

  if (
    !['http:', 'https:'].includes(trustedBase.protocol)
    || trustedBase.username
    || trustedBase.password
    || requestBase.origin !== trustedBase.origin
    || resolved.origin !== trustedBase.origin
    || resolved.username
    || resolved.password
    || !(resolved.pathname === '/api' || resolved.pathname.startsWith('/api/'))
  ) {
    throw unsafeApiTarget();
  }

  return resolved;
};
