const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const { OpenAI } = require('openai');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Make sure to set this environment variable
});

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('FlixFluent Proxy Server is running');
});

// Endpoint to get available subtitle languages for a video
app.get('/api/subtitle-languages', async (req, res) => {
  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Get available languages for the video
    const availableLanguages = await YoutubeTranscript.listLanguages(videoId);
    
    // Extract language codes
    const languages = availableLanguages.map(lang => lang.languageCode);
    
    console.log(`Found ${languages.length} subtitle languages for video ${videoId}`);
    
    return res.json({ 
      videoId, 
      languages 
    });
  } catch (error) {
    console.error('Error fetching subtitle languages:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch subtitle languages',
      message: error.message
    });
  }
});

// Endpoint to fetch subtitles for a video
app.get('/api/subtitles', async (req, res) => {
  try {
    const { videoId, lang } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    console.log(`Fetching subtitles for video ${videoId} in language ${lang || 'default'}`);
    
    // Get transcript options
    const options = {};
    if (lang && lang !== 'auto') {
      options.lang = lang;
    }

    // Fetch the transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, options);
    
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: 'No subtitles found for this video' });
    }
    
    return res.json({ 
      videoId, 
      language: lang || 'auto',
      subtitles: transcript 
    });
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch subtitles',
      message: error.message
    });
  }
});

// Endpoint to translate Korean text using OpenAI
app.get('/api/translate-openai', async (req, res) => {
  try {
    const { word } = req.query;
    
    if (!word) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    console.log(`Translating Korean word: "${word}" using OpenAI`);
    
    // Define the prompt
    const prompt = `
I want you to act as a Korean language teacher. I will provide a Korean word or phrase.
Please provide:
1. The English translation
2. The pronunciation in romanized form (if applicable)
3. The part of speech (noun, verb, adjective, etc.)
4. 2-3 example sentences in both Korean and English that use this word

Format your response as a JSON object with these properties:
- translatedText: the English translation
- pronunciation: romanized pronunciation 
- partOfSpeech: part of speech
- examples: array of objects with "korean" and "english" properties for example sentences

The Korean word or phrase is: ${word}
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful Korean language teacher assistant." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Extract and parse the JSON response
    const responseText = completion.choices[0].message.content;
    let translationData;
    
    try {
      translationData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fallback to a basic response
      translationData = {
        translatedText: "Could not parse translation data",
        pronunciation: "",
        partOfSpeech: "",
        examples: []
      };
    }
    
    return res.json({ translation: translationData });
  } catch (error) {
    console.error('Error translating with OpenAI:', error);
    return res.status(500).json({ 
      error: 'Failed to translate text',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
