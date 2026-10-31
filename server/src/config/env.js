// Centralised environment access with validation defaults.
// Missing non-critical keys fall back to dev-safe defaults.

const required = ['JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] WARNING: ${key} is not set — using insecure default for development only.`);
  }
}

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  mongo: {
    uri: process.env.MONGO_URI ||
      'mongodb://localhost:27017/brightloop?replicaSet=rs0&directConnection=true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),

  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@brightloop.com',
  },
};
