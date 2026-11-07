import { z } from "zod";
import { createClient } from "redis";
import prisma from "../src/config/database.js";

const [emailInput, confirmation] = process.argv.slice(2);

try {
  const email = z.string().trim().email().toLowerCase().parse(emailInput);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error("Register the intended owner's account first; no records were changed");
  const count = await prisma.deliveryAgent.count({ where: { userId: null } });
  if (confirmation !== "--confirm") {
    console.log(`${count} unassigned agents would be assigned to ${email}. Rerun with --confirm to apply.`);
  } else {
    const changed = await prisma.$transaction(async (transaction) =>
      transaction.$executeRaw`UPDATE "DeliveryAgent" SET "userId" = ${user.id} WHERE "userId" IS NULL`
    );
    console.log(`Assigned ${changed} existing agents to ${email}; existing fields and timestamps were preserved.`);
    const cache = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      socket: { connectTimeout: 1000, reconnectStrategy: false },
    });
    cache.on("error", () => {});
    try {
      await cache.connect();
      await cache.del(`agents:list:${user.id}`);
    } catch {
      console.warn("Assignment succeeded; Redis invalidation unavailable. Any existing list cache expires after 60 seconds.");
    } finally {
      cache.destroy();
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}