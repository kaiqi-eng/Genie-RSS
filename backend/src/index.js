import express from "express";
import dotenv from "dotenv";
import mcpRoutes from "./routes/mcp.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(express.json());

/**
 * Root health
 */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
  });
});

/**
 * Preferred MCP route
 */
app.use("/mcp", mcpRoutes);

/**
 * Auth route
 */
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});