import { buildSecureUploadHeaders } from '../Utils/uploadContentSecurity.mjs';

const HEADER_NAMES = Object.freeze({
  'cache-control': 'Cache-Control',
  'content-disposition': 'Content-Disposition',
  'content-security-policy': 'Content-Security-Policy',
  'cross-origin-resource-policy': 'Cross-Origin-Resource-Policy',
  'referrer-policy': 'Referrer-Policy',
  'x-content-type-options': 'X-Content-Type-Options',
});

const extractFilename = (value) => {
  const input = String(value ?? '');
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(input)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return /filename="?([^";]+)"?/i.exec(input)?.[1] ?? 'attachment';
};

export const enforceSecureUploadDelivery = (mode = 'download') => (req, res, next) => {
  const originalSetHeader = res.setHeader.bind(res);
  let mimeType = 'application/octet-stream';
  let displayName = 'attachment';

  const refreshSecurityHeaders = () => {
    const headers = buildSecureUploadHeaders({ mimeType, displayName, mode });
    for (const [name, value] of Object.entries(headers)) {
      originalSetHeader(name, value);
    }
  };

  res.setHeader = (name, value) => {
    const normalizedName = String(name).toLowerCase();
    if (normalizedName === 'content-type') {
      mimeType = String(value).split(';')[0].trim().toLowerCase();
      const result = originalSetHeader(name, value);
      refreshSecurityHeaders();
      return result;
    }
    if (normalizedName === 'content-disposition') {
      displayName = extractFilename(value);
      const headers = buildSecureUploadHeaders({ mimeType, displayName, mode });
      return originalSetHeader(HEADER_NAMES[normalizedName], headers['Content-Disposition']);
    }
    if (HEADER_NAMES[normalizedName]) {
      const headers = buildSecureUploadHeaders({ mimeType, displayName, mode });
      return originalSetHeader(HEADER_NAMES[normalizedName], headers[HEADER_NAMES[normalizedName]]);
    }
    return originalSetHeader(name, value);
  };

  refreshSecurityHeaders();
  next();
};
