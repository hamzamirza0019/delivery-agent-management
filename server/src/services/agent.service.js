
import prisma from "../config/database.js";
import redis from "../config/redis.js";

const CACHE_TTL = 60;

const requireUserId = (userId) => {
  if (!userId) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return userId;
};

const getAgentListKey = (userId) => `agents:list:${requireUserId(userId)}`;
const getAgentCacheKey = (id, userId) => `agents:${requireUserId(userId)}:${id}`;

export const createAgent = async (data, userId) => {
  const agent = await prisma.deliveryAgent.create({
    data: { ...data, userId: requireUserId(userId) },
  });

  // Invalidate cached agent list
  await invalidateCache(getAgentListKey(userId));

  return agent;
};

export const getAllAgents = async (userId) => {
  const cacheKey = getAgentListKey(userId);
  // 1. Check Redis first
  const cachedAgents = await getCache(cacheKey);

  if (cachedAgents) {
    console.log(`Redis cache HIT: ${cacheKey}`);
    return cachedAgents;
  }

  console.log(`Redis cache MISS: ${cacheKey}`);

  // 2. Fetch from PostgreSQL
  const agents = await prisma.deliveryAgent.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });

  // 3. Store result in Redis for 60 seconds
  await setCache(cacheKey, agents);

  return agents;
};

export const getAgentById = async (id, userId) => {
  const cacheKey = getAgentCacheKey(id, userId);

  // 1. Check Redis
  const cachedAgent = await getCache(cacheKey);

  if (cachedAgent) {
    console.log(`Redis cache HIT: ${cacheKey}`);
    return cachedAgent;
  }

  console.log(`Redis cache MISS: ${cacheKey}`);

  // 2. Fetch from PostgreSQL
  const agent = await prisma.deliveryAgent.findUnique({
    where: { id, userId },
  });

  if (!agent) {
    const error = new Error("Delivery agent not found");
    error.statusCode = 404;
    throw error;
  }

  // 3. Store in Redis
  await setCache(cacheKey, agent);

  return agent;
};

export const updateAgent = async (id, data, userId) => {
  const agent = await prisma.deliveryAgent.update({
    where: { id, userId: requireUserId(userId) },
    data,
  });

  // Invalidate both list and individual agent cache
  await invalidateCache(getAgentListKey(userId), getAgentCacheKey(id, userId));

  return agent;
};

export const deleteAgent = async (id, userId) => {
  const agent = await prisma.deliveryAgent.delete({
    where: { id, userId: requireUserId(userId) },
  });

  // Invalidate both caches
  await invalidateCache(getAgentListKey(userId), getAgentCacheKey(id, userId));

  return agent;
};

const getCache = async (key) => {
  if (!redis.isReady) {
    return null;
  }

  try {
    const value = await redis.get(key);
    return value === null ? null : JSON.parse(value);
  } catch (error) {
    console.error("Redis GET failed:", error.message);
    return null;
  }
};

const setCache = async (key, value) => {
  if (!redis.isReady) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), { EX: CACHE_TTL });
    console.log(`[REDIS] CACHE SET - ${key} - TTL: ${CACHE_TTL}s`);
  } catch (error) {
    console.error("Redis SET failed:", error.message);
  }
};

const invalidateCache = async (...keys) => {
  if (!redis.isReady) {
    return;
  }

  try {
    await redis.del(keys);
    for (const key of keys) console.log(`[REDIS] CACHE INVALIDATED - ${key}`);
  } catch (error) {
    console.error("Redis DELETE failed:", error.message);
  }
};
