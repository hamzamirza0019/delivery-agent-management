import { z } from "zod";

const agentFields = {
  name: z.string().trim().min(2, "Name must contain at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().min(10, "Phone number must contain at least 10 characters"),
  serviceArea: z.string().trim().min(2, "Service area is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
};

export const createAgentSchema = z.object(agentFields).strict();

export const updateAgentSchema = z
  .object(agentFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required for update",
  });

export const agentIdSchema = z.object({
  id: z.uuid("Invalid agent ID"),
});