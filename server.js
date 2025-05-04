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

// Add to your server.js file:
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Set this in your environment variables
});

// Add this new endpoint to your Express server
app.get('/api/translate-openai', async (req, res) => {
  const word = req.query.word;
  
  if (!word) {
    return res.status(400).json({ error: 'No word provided' });
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // or any other model you prefer
      messages: [
        {
          role: "system",
          content: "You are a Korean-English translator. Provide translations for Korean words with pronunciation, part of speech, and example sentences. Format the response as JSON with properties: translatedText, pronunciation, partOfSpeech, and examples (array of {korean, english} pairs)."
        },
        {
          role: "user",
          content: `Translate this Korean word or phrase: "${word}"`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON from the response
    const translation = JSON.parse(response.choices[0].message.content);
    
    res.json({ translation });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Error translating word with OpenAI' });
  }
});

