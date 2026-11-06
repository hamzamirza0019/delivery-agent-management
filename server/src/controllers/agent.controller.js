import * as agentService from "../services/agent.service.js";

export const createAgent = async (req, res) => {
  const agent = await agentService.createAgent(req.body);

  res.status(201).json({
    success: true,
    message: "Delivery agent created successfully",
    data: agent,
  });
};

export const getAllAgents = async (req, res) => {
  const agents = await agentService.getAllAgents();

  res.status(200).json({
    success: true,
    count: agents.length,
    data: agents,
  });
};

export const getAgentById = async (req, res) => {
  const agent = await agentService.getAgentById(req.params.id);

  res.status(200).json({
    success: true,
    data: agent,
  });
};

export const updateAgent = async (req, res) => {
  const agent = await agentService.updateAgent(
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: "Delivery agent updated successfully",
    data: agent,
  });
};

export const deleteAgent = async (req, res) => {
  await agentService.deleteAgent(req.params.id);

  res.status(200).json({
    success: true,
    message: "Delivery agent deleted successfully",
  });
};