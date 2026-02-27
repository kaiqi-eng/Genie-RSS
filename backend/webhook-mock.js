import express from 'express';

const app = express();
app.use(express.json());

// In-memory storage for testing
const intelUrls = new Set();

app.post('/addintelurl', (req, res) => {
  const { url } = req.body;
  console.log('📥 Add URL:', url);
  intelUrls.add(url);
  res.json({
    success: true,
    message: 'URL added to intelligence tracking',
    url
  });
});

app.post('/deleteintelurl', (req, res) => {
  const { url } = req.body;
  console.log('🗑️  Delete URL:', url);
  intelUrls.delete(url);
  res.json({
    success: true,
    message: 'URL removed from intelligence tracking',
    url
  });
});

app.post('/getdailyintel', (req, res) => {
  const { params } = req.body;
  const date = params?.date || new Date().toISOString().split('T')[0];
  console.log('📊 Get daily intel for:', date);

  // Return mock RSS feed data
  res.json({
    success: true,
    date,
    totalUrls: intelUrls.size,
    items: Array.from(intelUrls).map((url, i) => ({
      title: `Intel Item ${i + 1}`,
      link: url,
      pubDate: new Date().toISOString(),
      description: `Intelligence gathered from ${url}`
    }))
  });
});

// Status endpoint to see current state
app.get('/status', (req, res) => {
  res.json({
    totalUrls: intelUrls.size,
    urls: Array.from(intelUrls)
  });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\n🎯 Mock Webhook Server running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  POST /addintelurl    - Add URL to tracking');
  console.log('  POST /deleteintelurl - Remove URL from tracking');
  console.log('  POST /getdailyintel  - Get daily intelligence');
  console.log('  GET  /status         - View tracked URLs\n');
});
