import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiKeyAuth } from './middleware/auth.js';
import rssRoutes from './routes/rss.js';
import thirdEyeRoutes from './routes/feed.js';
import summarizeRoutes from "./routes/summarize.js";
import transcriptRoutes from "./routes/transcripts.js";
import intelRoutes from './routes/intel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json()); // Must be before routes
app.use(express.urlencoded({ extended: true }));

// Protected Routes (require API key)
app.use('/api/rss', apiKeyAuth, rssRoutes);
app.use('/api/rss/feed', apiKeyAuth, thirdEyeRoutes);
app.use("/api/summarize", apiKeyAuth, summarizeRoutes);
app.use("/api/transcript", apiKeyAuth, transcriptRoutes);
app.use('/api/intel', apiKeyAuth, intelRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
