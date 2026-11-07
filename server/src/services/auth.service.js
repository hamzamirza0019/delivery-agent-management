import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";
import { env } from "../config/env.js";

const publicFields = { id: true, name: true, email: true };
const authError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const session = (user) => ({
  token: jwt.sign({}, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: "agent-hub",
    audience: "agent-hub",
  }),
  user: { id: user.id, name: user.name, email: user.email },
});

export const register = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: publicFields,
    });
    return session(user);
  } catch (error) {
    if (error.code === "P2002") throw authError("Email already registered", 409);
    throw error;
  }
};

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw authError("Invalid email or password", 401);
  }
  return session(user);
};

export const getUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id }, select: publicFields });
  if (!user) throw authError("Invalid or expired token", 401);
  return user;
};