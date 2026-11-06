import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import agentRoutes from "./routes/agent.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Delivery Agent Management API is running",
  });
});

app.use("/api/agents", agentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;