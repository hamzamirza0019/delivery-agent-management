import prisma from "../config/database.js";

export const createAgent = async (data) => {
  return prisma.deliveryAgent.create({
    data,
  });
};

export const getAllAgents = async () => {
  return prisma.deliveryAgent.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getAgentById = async (id) => {
  const agent = await prisma.deliveryAgent.findUnique({
    where: { id },
  });

  if (!agent) {
    const error = new Error("Delivery agent not found");
    error.statusCode = 404;
    throw error;
  }

  return agent;
};

export const updateAgent = async (id, data) => {
  return prisma.deliveryAgent.update({
    where: { id },
    data,
  });
};

export const deleteAgent = async (id) => {
  return prisma.deliveryAgent.delete({
    where: { id },
  });
};