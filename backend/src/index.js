import express from 'express';
import cors from 'cors';
import rssRoutes from './routes/rss.js';
import thirdEyeRoutes from './routes/feed.js';
import summarizeRoutes from "./routes/summarize.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json()); // Must be before routes
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/rss', rssRoutes);

// New route For RSS feeds(new code)
app.use('/api/rss/feed', thirdEyeRoutes);

// Route for summarization(new code)
app.use("/api/summarize", summarizeRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
