import crypto from 'crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const sessions = new Map<string, { userId: string; expiresAt: number }>();

export const createSessionToken = (userId: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
};

export const getUserIdFromToken = (token: string): string | null => {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
};
