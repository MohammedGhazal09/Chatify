import xss from 'xss';

export default function sanitization (req, _res, next) {
  const removeMongoDangerousKeys = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
        continue;
      }
      const value = obj[key];
      if (value && typeof value === 'object') removeMongoDangerousKeys(value);
    }
  };

  const sanitizeStringsInPlace = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        obj[key] = xss(value);
      } else if (Array.isArray(value)) {
        obj[key] = value.map((item) => (typeof item === 'string' ? xss(item) : (item && typeof item === 'object' ? (sanitizeStringsInPlace(item), item) : item)));
      } else if (value && typeof value === 'object') {
        sanitizeStringsInPlace(value);
      }
    }
  };

  if (req.body) {
    removeMongoDangerousKeys(req.body);
    sanitizeStringsInPlace(req.body);
  }
  if (req.query) {
    removeMongoDangerousKeys(req.query);
    sanitizeStringsInPlace(req.query);
  }
  if (req.params) {
    removeMongoDangerousKeys(req.params);
    sanitizeStringsInPlace(req.params);
  }
  next();
}