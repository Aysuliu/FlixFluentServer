const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const xml2js = require('xml2js'); // You'll need to install this: npm install xml2js

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

    // Get the list of available languages for this video
    const response = await axios.get(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`);
    
    // The response is in XML format, so we need to parse it
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);
    
    let languages = [];
    
    // Check if there are any caption tracks
    if (result && result.transcript_list && result.transcript_list.track) {
      // If there's only one track, it will be an object, not an array
      const tracks = Array.isArray(result.transcript_list.track) 
        ? result.transcript_list.track 
        : [result.transcript_list.track];
      
      languages = tracks.map(track => ({
        languageCode: track.$.lang_code,
        name: track.$.lang_original || track.$.lang_translated || track.$.lang_code
      }));
    }
    
    // Check specifically for English and Korean
    const hasEnglish = languages.some(lang => lang.languageCode === 'en');
    const hasKorean = languages.some(lang => lang.languageCode === 'ko');
    
    console.log(`Found ${languages.length} subtitle languages for video ${videoId}`);
    console.log(`English available: ${hasEnglish}, Korean available: ${hasKorean}`);
    
    return res.json({ 
      videoId, 
      languages: languages.map(lang => lang.languageCode),
      hasEnglish,
      hasKorean
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

    const langCode = lang || 'en';
    console.log(`Fetching subtitles for video ${videoId} in language ${langCode}`);
    
    // Fetch subtitles using the unofficial API
    const response = await axios.get(`https://www.youtube.com/api/timedtext?lang=${langCode}&v=${videoId}`);
    
    // Parse the XML response
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    if (!result || !result.transcript || !result.transcript.text) {
      return res.status(404).json({ error: `No ${langCode} subtitles found for this video` });
    }
    
    // Convert the XML structure to our expected format
    const subtitles = result.transcript.text.map(item => ({
      start: parseFloat(item.$.start),
      dur: parseFloat(item.$.dur),
      text: item._ || ''
    }));
    
    return res.json({ 
      videoId, 
      language: langCode,
      subtitles: subtitles
    });
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch subtitles',
      message: error.message
    });
  }
});

// Endpoint to fetch both English and Korean subtitles simultaneously
app.get('/api/dual-subtitles', async (req, res) => {
  try {
    const { videoId } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    console.log(`Fetching both English and Korean subtitles for video ${videoId}`);
    
    // Fetch English subtitles
    let englishSubtitles = [];
    try {
      const enResponse = await axios.get(`https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`);
      const parser = new xml2js.Parser();
      const enResult = await parser.parseStringPromise(enResponse.data);
      
      if (enResult && enResult.transcript && enResult.transcript.text) {
        englishSubtitles = enResult.transcript.text.map(item => ({
          start: parseFloat(item.$.start),
          dur: parseFloat(item.$.dur),
          text: item._ || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching English subtitles:', error);
    }
    
    // Fetch Korean subtitles
    let koreanSubtitles = [];
    try {
      const koResponse = await axios.get(`https://www.youtube.com/api/timedtext?lang=ko&v=${videoId}`);
      const parser = new xml2js.Parser();
      const koResult = await parser.parseStringPromise(koResponse.data);
      
      if (koResult && koResult.transcript && koResult.transcript.text) {
        koreanSubtitles = koResult.transcript.text.map(item => ({
          start: parseFloat(item.$.start),
          dur: parseFloat(item.$.dur),
          text: item._ || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching Korean subtitles:', error);
    }
    
    // If neither language has subtitles, return an error
    if (englishSubtitles.length === 0 && koreanSubtitles.length === 0) {
      return res.status(404).json({ error: 'No English or Korean subtitles found for this video' });
    }
    
    return res.json({ 
      videoId,
      english: {
        available: englishSubtitles.length > 0,
        subtitles: englishSubtitles
      },
      korean: {
        available: koreanSubtitles.length > 0,
        subtitles: koreanSubtitles
      }
    });
  } catch (error) {
    console.error('Error fetching dual subtitles:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch dual subtitles',
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