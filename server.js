const express = require('express');
const cors = require('cors');
const { getSubtitles } = require('youtube-caption-extractor');
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend domain
app.use(cors({
  origin: '*', // Change this to your frontend URL in production
  methods: ['GET', 'POST']
}));

// Basic route to test server
app.get('/', (req, res) => {
  res.send('YouTube Subtitle Proxy Server is running');
});

// Route to get subtitles
app.get('/api/subtitles', async (req, res) => {
  const { videoId, lang = 'ko' } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }
  
  try {
    const subtitles = await getSubtitles({ videoID: videoId, lang });
    res.json({ subtitles });
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch subtitles' });
  }
});

// Simple translation endpoint (you'd integrate with a real translation API)
app.get('/api/translate', async (req, res) => {
  const { word } = req.query;
  
  if (!word) {
    return res.status(400).json({ error: 'Missing word parameter' });
  }
  
  // This is a mock implementation - replace with real translation API
  res.json({
    translation: {
      translatedText: `Translation of "${word}"`,
      pronunciation: `[Pronunciation of ${word}]`,
      partOfSpeech: 'noun',
      examples: [
        { korean: `${word}는 중요합니다.`, english: `${word} is important.` },
        { korean: `저는 ${word}를 좋아해요.`, english: `I like ${word}.` }
      ]
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
