import "dotenv/config";
import { randomBytes } from "node:crypto";

process.env.JWT_SECRET ||= randomBytes(32).toString("hex");
process.env.JWT_EXPIRES_IN ||= "1h";
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused?connect_timeout=1";
process.env.REDIS_URL ||= "redis://127.0.0.1:1";