import { z } from "zod";

const email = z.string().trim().email("Invalid email address").max(254).toLowerCase();
const password = z.string().min(8, "Password must contain at least 8 characters")
  .max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Password must not exceed 72 UTF-8 bytes",
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
}).strict();