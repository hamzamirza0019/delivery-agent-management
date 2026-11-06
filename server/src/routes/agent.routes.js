import { Router } from "express";
import * as agentController from "../controllers/agent.controller.js";

import { validate } from "../middleware/validate.middleware.js";

import {
  createAgentSchema,
  updateAgentSchema,
  agentIdSchema,
} from "../validators/agent.validator.js";

const router = Router();

router.post(
  "/",
  validate(createAgentSchema),
  agentController.createAgent
);

router.get("/", agentController.getAllAgents);

router.get(
  "/:id",
  validate(agentIdSchema, "params"),
  agentController.getAgentById
);

router.patch(
  "/:id",
  validate(agentIdSchema, "params"),
  validate(updateAgentSchema),
  agentController.updateAgent
);

router.delete(
  "/:id",
  validate(agentIdSchema, "params"),
  agentController.deleteAgent
);

export default router;