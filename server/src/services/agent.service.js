
import prisma from "../config/database.js";
import redis from "../config/redis.js";

const CACHE_TTL = 60;

const AGENT_LIST_KEY = "agents:list";

const getAgentCacheKey = (id) => `agents:${id}`;

export const createAgent = async (data) => {
  const agent = await prisma.deliveryAgent.create({
    data,
  });

  // Invalidate cached agent list
  await invalidateCache(AGENT_LIST_KEY);

  return agent;
};

export const getAllAgents = async () => {
  // 1. Check Redis first
  const cachedAgents = await getCache(AGENT_LIST_KEY);

  if (cachedAgents) {
    console.log("Redis cache HIT: agents:list");
    return cachedAgents;
  }

  console.log("Redis cache MISS: agents:list");

  // 2. Fetch from PostgreSQL
  const agents = await prisma.deliveryAgent.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  // 3. Store result in Redis for 60 seconds
  await setCache(AGENT_LIST_KEY, agents);

  return agents;
};

export const getAgentById = async (id) => {
  const cacheKey = getAgentCacheKey(id);

  // 1. Check Redis
  const cachedAgent = await getCache(cacheKey);

  if (cachedAgent) {
    console.log(`Redis cache HIT: ${cacheKey}`);
    return cachedAgent;
  }

  console.log(`Redis cache MISS: ${cacheKey}`);

  // 2. Fetch from PostgreSQL
  const agent = await prisma.deliveryAgent.findUnique({
    where: { id },
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

export const updateAgent = async (id, data) => {
  const agent = await prisma.deliveryAgent.update({
    where: { id },
    data,
  });

  // Invalidate both list and individual agent cache
  await invalidateCache(AGENT_LIST_KEY, getAgentCacheKey(id));

  return agent;
};

export const deleteAgent = async (id) => {
  const agent = await prisma.deliveryAgent.delete({
    where: { id },
  });

  // Invalidate both caches
  await invalidateCache(AGENT_LIST_KEY, getAgentCacheKey(id));

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
  } catch (error) {
    console.error("Redis DELETE failed:", error.message);
  }
};
