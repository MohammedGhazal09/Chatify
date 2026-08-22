import mongoose from 'mongoose';

const CONFIGURED = Symbol.for('chatify.databaseSecurity.configured');
const TRUSTED_UPDATE = Symbol.for('chatify.databaseSecurity.trustedUpdate');
const FORBIDDEN_PROPERTY_NAMES = new Set(['__proto__', 'prototype', 'constructor']);
const UPDATE_OPERATIONS = ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'];
const READ_OPERATIONS = ['find', 'findOne', 'countDocuments', 'estimatedDocumentCount', 'distinct'];
const BUDGETED_OPERATIONS = [
  ...READ_OPERATIONS,
  ...UPDATE_OPERATIONS,
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndReplace',
];

const DEFAULT_INPUT_LIMITS = Object.freeze({
  maxDepth: 10,
  maxKeys: 256,
  maxArrayLength: 100,
});

const INTEGER_LIMITS = Object.freeze({
  maxPoolSize: { name: 'MONGODB_MAX_POOL_SIZE', defaultValue: 20, min: 1, max: 100 },
  minPoolSize: { name: 'MONGODB_MIN_POOL_SIZE', defaultValue: 0, min: 0, max: 20 },
  maxConnecting: { name: 'MONGODB_MAX_CONNECTING', defaultValue: 2, min: 1, max: 10 },
  waitQueueTimeoutMS: { name: 'MONGODB_WAIT_QUEUE_TIMEOUT_MS', defaultValue: 5_000, min: 1_000, max: 30_000 },
  serverSelectionTimeoutMS: { name: 'MONGODB_SERVER_SELECTION_TIMEOUT_MS', defaultValue: 5_000, min: 1_000, max: 15_000 },
  connectTimeoutMS: { name: 'MONGODB_CONNECT_TIMEOUT_MS', defaultValue: 10_000, min: 1_000, max: 30_000 },
  socketTimeoutMS: { name: 'MONGODB_SOCKET_TIMEOUT_MS', defaultValue: 45_000, min: 5_000, max: 120_000 },
  maxIdleTimeMS: { name: 'MONGODB_MAX_IDLE_TIME_MS', defaultValue: 60_000, min: 1_000, max: 300_000 },
});


export class DatabaseConfigurationError extends Error {
  constructor(issues) {
    super(`Database configuration invalid: ${issues.join('; ')}`);
    this.name = 'DatabaseConfigurationError';
    this.code = 'DATABASE_CONFIGURATION_INVALID';
    this.issues = [...issues];
  }
}

export class DatabaseInputValidationError extends Error {
  constructor(message, path = '$') {
    super(message);
    this.name = 'DatabaseInputValidationError';
    this.code = 'INVALID_DATABASE_INPUT';
    this.path = path;
    this.statusCode = 400;
  }
}

const parseBoundedInteger = (value, { defaultValue, min, max }) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = typeof value === 'number'
    ? value
    : /^-?\d+$/.test(String(value).trim())
      ? Number.parseInt(String(value).trim(), 10)
      : Number.NaN;

  if (!Number.isSafeInteger(normalized) || normalized < min) {
    return defaultValue;
  }

  return Math.min(normalized, max);
};

const appendPath = (path, key) => `${path}.${String(key)}`;

const assertSafeKey = (key, path) => {
  if (
    FORBIDDEN_PROPERTY_NAMES.has(key)
    || key.includes('$')
    || key.includes('.')
    || key.includes('\0')
  ) {
    throw new DatabaseInputValidationError(
      'Request contains a forbidden database key',
      appendPath(path, key)
    );
  }
};

export const assertSafeMongoInput = (value, options = {}) => {
  const limits = {
    ...DEFAULT_INPUT_LIMITS,
    ...options,
  };
  const seen = new WeakSet();
  let keyCount = 0;

  const visit = (current, path, depth) => {
    if (current === null || typeof current !== 'object') {
      return;
    }

    if (depth > limits.maxDepth) {
      throw new DatabaseInputValidationError('Request database input is too deeply nested', path);
    }

    if (seen.has(current)) {
      throw new DatabaseInputValidationError('Request database input contains a cycle', path);
    }
    seen.add(current);

    if (Array.isArray(current)) {
      if (current.length > limits.maxArrayLength) {
        throw new DatabaseInputValidationError('Request database array is too large', path);
      }

      current.forEach((entry, index) => visit(entry, `${path}[${index}]`, depth + 1));
      return;
    }

    for (const key of Object.keys(current)) {
      keyCount += 1;
      if (keyCount > limits.maxKeys) {
        throw new DatabaseInputValidationError('Request database input has too many keys', path);
      }

      assertSafeKey(key, path);
      visit(current[key], appendPath(path, key), depth + 1);
    }
  };

  visit(value, options.path ?? '$', 0);
  return value;
};

export const normalizeDatabaseLimit = (value, {
  defaultLimit = 50,
  minLimit = 1,
  maxLimit = 100,
} = {}) => parseBoundedInteger(value, {
  defaultValue: defaultLimit,
  min: minLimit,
  max: maxLimit,
});


export const validateMongoTransportSecurity = (env = process.env) => {
  if (env.NODE_ENV !== 'production') {
    return { required: false, secure: true };
  }

  const issues = [];
  const rawUrl = String(env.MONGODB_URL ?? '').trim();

  if (!rawUrl) {
    issues.push('MONGODB_URL is required in production');
  } else {
    try {
      const url = new URL(rawUrl);
      const tlsValue = (url.searchParams.get('tls') ?? url.searchParams.get('ssl'))?.toLowerCase();
      const allowInvalidCertificates = url.searchParams.get('tlsAllowInvalidCertificates')?.toLowerCase();
      const allowInvalidHostnames = url.searchParams.get('tlsAllowInvalidHostnames')?.toLowerCase();

      if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol)) {
        issues.push('MONGODB_URL must use mongodb or mongodb+srv');
      }

      if (url.protocol === 'mongodb:' && tlsValue !== 'true') {
        issues.push('mongodb URLs must explicitly enable TLS in production');
      }

      if (url.protocol === 'mongodb+srv:' && tlsValue === 'false') {
        issues.push('mongodb+srv URLs must not disable TLS in production');
      }

      if (allowInvalidCertificates === 'true') {
        issues.push('MONGODB_URL must not allow invalid TLS certificates');
      }

      if (allowInvalidHostnames === 'true') {
        issues.push('MONGODB_URL must not allow invalid TLS hostnames');
      }
    } catch {
      issues.push('MONGODB_URL must be a valid database URL');
    }
  }

  if (issues.length > 0) {
    throw new DatabaseConfigurationError(issues);
  }

  return { required: true, secure: true };
};

export const getDatabaseQueryMaxTimeMS = (env = process.env) => parseBoundedInteger(
  env.MONGODB_QUERY_MAX_TIME_MS,
  { defaultValue: 5_000, min: 250, max: 30_000 }
);

export const buildMongoConnectionOptions = (env = process.env) => {
  const options = {
    appName: 'chatify-api',
    autoIndex: env.NODE_ENV !== 'production',
    retryWrites: true,
  };

  for (const [optionName, policy] of Object.entries(INTEGER_LIMITS)) {
    options[optionName] = parseBoundedInteger(env[policy.name], policy);
  }

  options.minPoolSize = Math.min(options.minPoolSize, options.maxPoolSize);

  if (env.NODE_ENV === 'production') {
    options.tlsAllowInvalidCertificates = false;
    options.tlsAllowInvalidHostnames = false;
  }

  return options;
};

const applyDatabaseSchemaPolicy = (schema, { queryMaxTimeMS }) => {
  schema.set('strict', 'throw');
  schema.set('strictQuery', 'throw');

  schema.pre(UPDATE_OPERATIONS, function enforceUpdateValidation() {
    if (this[TRUSTED_UPDATE] !== true) {
      this.setOptions({
        runValidators: true,
        context: 'query',
      });
    }
  });

  schema.pre(BUDGETED_OPERATIONS, function enforceQueryBudget() {
    const options = this.getOptions();
    if (options.maxTimeMS === undefined || options.maxTimeMS === null) {
      this.maxTimeMS(queryMaxTimeMS);
    }
  });

  schema.pre('aggregate', function enforceAggregateBudget() {
    if (this.options?.maxTimeMS === undefined || this.options?.maxTimeMS === null) {
      this.option({ maxTimeMS: queryMaxTimeMS });
    }
  });
};

export const configureMongooseSecurity = ({
  mongooseInstance = mongoose,
  env = process.env,
} = {}) => {
  if (mongooseInstance[CONFIGURED]) {
    return mongooseInstance[CONFIGURED];
  }

  const state = Object.freeze({
    strict: 'throw',
    strictQuery: 'throw',
    queryMaxTimeMS: getDatabaseQueryMaxTimeMS(env),
    updateValidators: true,
  });

  mongooseInstance.set('strict', state.strict);
  mongooseInstance.set('strictQuery', state.strictQuery);
  mongooseInstance.plugin((schema) => applyDatabaseSchemaPolicy(schema, state));
  Object.defineProperty(mongooseInstance, CONFIGURED, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: state,
  });

  return state;
};

export const getMongooseSecurityState = (mongooseInstance = mongoose) => (
  mongooseInstance[CONFIGURED] ?? null
);


export const markTrustedDatabaseUpdate = (query, reason) => {
  if (!query || typeof query.exec !== 'function') {
    throw new TypeError('markTrustedDatabaseUpdate requires a Mongoose query');
  }

  if (typeof reason !== 'string' || reason.trim().length < 12) {
    throw new TypeError('Trusted database updates require a documented reason');
  }

  Object.defineProperty(query, TRUSTED_UPDATE, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true,
  });

  return query;
};

export const withDatabaseTransaction = async (work, {
  connection = mongoose.connection,
  transactionOptions = {},
} = {}) => {
  if (typeof work !== 'function') {
    throw new TypeError('withDatabaseTransaction requires a callback');
  }

  if (!connection || typeof connection.transaction !== 'function') {
    throw new Error('MongoDB connection does not support transactions');
  }

  return connection.transaction(
    async (session) => work(session),
    {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      ...transactionOptions,
    }
  );
};
