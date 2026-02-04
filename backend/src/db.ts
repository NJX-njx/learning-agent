
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name?: string;
  learnerId: string;
  // Legacy field to support older stored users without breaking logins.
  password?: string;
}

export const getUsers = (): User[] => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

export const saveUser = (user: User): void => {
  const users = getUsers();
  users.push(user);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

export const findUserByEmail = (email: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.email === email);
};

export const createUser = (email: string, password: string): User => {
  const { passwordHash, passwordSalt } = hashPassword(password);
  const newUser: User = {
    id: uuidv4(),
    email,
    passwordHash,
    passwordSalt,
    learnerId: uuidv4(), // Generate a unique learner ID
  };
  saveUser(newUser);
  return newUser;
};

export const hashPassword = (password: string): { passwordHash: string; passwordSalt: string } => {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, passwordSalt, 64).toString('hex');
  return { passwordHash, passwordSalt };
};

export const verifyPassword = (password: string, user: User): boolean => {
  if (user.passwordHash && user.passwordSalt) {
    const derivedKey = crypto.scryptSync(password, user.passwordSalt, 64);
    const storedKey = Buffer.from(user.passwordHash, 'hex');
    if (storedKey.length !== derivedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(storedKey, derivedKey);
  }

  return user.password === password;
};
