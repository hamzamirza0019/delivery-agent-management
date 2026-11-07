import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { agentIdSchema } from "../validators/agent.validator.js";

export const authenticate = (req, res, next) => {
  const token = req.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "agent-hub",
      audience: "agent-hub",
    });
    if (!agentIdSchema.safeParse({ id: payload.sub }).success) throw new Error("Invalid token subject");
    req.userId = payload.sub;
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
  next();
};