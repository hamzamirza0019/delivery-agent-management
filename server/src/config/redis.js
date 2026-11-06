import "dotenv/config";
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 1000,
    socketTimeout: 2000,
    reconnectStrategy: (retries) =>
      Math.min(50 * 2 ** retries, 2000) + Math.floor(Math.random() * 200),
  },
  pingInterval: 1000,
});

redis.on("error", (error) => {
  console.warn("Redis unavailable; continuing with PostgreSQL:", error.message);
});

export default redis;