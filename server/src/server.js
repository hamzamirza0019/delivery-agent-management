import "dotenv/config";
import app from "./app.js";
import prisma from "./config/database.js";
import redis from "./config/redis.js";

const PORT = process.env.PORT || 5000;

redis.on("ready", () => {
  console.log("Redis connected successfully");
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected successfully");

    if (!redis.isOpen) {
      redis.connect().catch((error) => {
        console.warn("Redis connection failed; continuing with PostgreSQL:", error.message);
      });
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();