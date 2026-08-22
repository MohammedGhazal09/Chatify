import xss from 'xss';
import {
  DatabaseInputValidationError,
  assertSafeMongoInput,
} from '../Utils/databaseSecurity.mjs';

const sanitizeStringsInPlace = (obj) => {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    if (typeof value === 'string') {
      obj[key] = xss(value);
    } else if (Array.isArray(value)) {
      obj[key] = value.map((item) => (
        typeof item === 'string'
          ? xss(item)
          : item && typeof item === 'object'
            ? (sanitizeStringsInPlace(item), item)
            : item
      ));
    } else if (value && typeof value === 'object') {
      sanitizeStringsInPlace(value);
    }
  }
};

export default function sanitization(req, res, next) {
  try {
    if (req.body) assertSafeMongoInput(req.body, { path: '$.body' });
    if (req.query) assertSafeMongoInput(req.query, { path: '$.query' });
    if (req.params) assertSafeMongoInput(req.params, { path: '$.params' });

    if (req.body) sanitizeStringsInPlace(req.body);
    if (req.query) sanitizeStringsInPlace(req.query);
    if (req.params) sanitizeStringsInPlace(req.params);

    next();
  } catch (error) {
    if (error instanceof DatabaseInputValidationError) {
      res.status(400).json({
        status: 'fail',
        code: error.code,
        message: 'Request contains invalid database input',
      });
      return;
    }

    next(error);
  }
}
