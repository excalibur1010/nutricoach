require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');

const app = express();
const port = 3001;

// --- CONFIGURATION ---
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' }));
const upload = multer({ storage: multer.memoryStorage() });

// --- GEMINI SETUP ---
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is missing in .env file");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Using Flash Lite as per your quota
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

app.get('/', (req, res) => {
  res.send('Hello from the new Gemini-powered backend!');
});

// --- 1. IMAGE ANALYSIS ENDPOINT (With Health Grading) ---
app.post('/api/vision/recognize', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  try {
    console.log("📸 Image received! Sending to Gemini Vision...");

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    // UPDATED PROMPT: Asks for Health Grade
    const prompt = `
      Analyze the food items in this image. 
      For each item:
      1. Identify the Name.
      2. Estimate calories, protein, carbs, and fats.
      3. CRITICAL: Assign a "health_grade" (A, B, C, D, or F).
         - A: Very Healthy (Veg, Lean Protein)
         - C: Moderate (Sandwich, Pasta)
         - F: Unhealthy (Soda, Candy, Fried)
      4. Provide a short "health_reason".

      Return ONLY a raw JSON array (no markdown).
      Format:
      [
        {
          "name": "Item Name",
          "calories": 0,
          "protein": 0, 
          "carbs": 0, 
          "fats": 0,
          "health_grade": "B",
          "health_reason": "Good protein but high sodium."
        }
      ]
      
      If NOT food, return object: { "error": "not_food" }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    // Clean up markdown
    if (text.includes('```')) {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    console.log("🧠 Gemini Analysis:", text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    // Handle "Not Food"
    if (data.error === "not_food") {
      return res.json({ foods: [] });
    }

    // Normalize to Array
    let foodArray = Array.isArray(data) ? data : [data];

    // --- FALLBACK LOGIC ---
    // If Flash Lite forgets the grade, we calculate it manually
    foodArray = foodArray.map(item => {
      if (!item.health_grade) {
        // Simple logic: High sugar/fat = Bad Grade
        if (item.calories > 500 || (item.carbs > 50 && item.protein < 5)) {
          item.health_grade = "D";
          item.health_reason = "High calorie density (Auto-graded)";
        } else if (item.protein > 20) {
          item.health_grade = "A";
          item.health_reason = "High protein source (Auto-graded)";
        } else {
          item.health_grade = "B";
          item.health_reason = "Balanced meal (Auto-graded)";
        }
      }
      return item;
    });

    res.json({ foods: foodArray });

  } catch (error) {
    console.error('Error with Gemini Vision:', error);
    if (error.message.includes('429')) return res.status(429).json({ error: "Rate Limit Reached" });
    res.status(500).json({ error: 'Failed to analyze image.' });
  }
});

// --- 2. TEXT CHAT ENDPOINT ---
app.post('/api/llm/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await model.generateContent(message);
    let text = result.response.text();

    if (text.startsWith('```json')) {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    try {
      const jsonResponse = JSON.parse(text);
      res.json({ responseText: jsonResponse });
    } catch (e) {
      res.json({ responseText: text });
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- 3. VOICE (ELEVENLABS) ---
app.post('/api/elevenlabs/speak', async (req, res) => {
  const { text } = req.body;
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; 

  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: 'No ElevenLabs Key' });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 },
      }),
    });

    if (!response.ok) throw new Error("ElevenLabs API Error");
    const audioBuffer = await response.buffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error calling ElevenLabs API:', error);
    res.status(500).json({ error: 'TTS Failed' });
  }
});

// --- 4. MEAL LOGGING & PROFILE ---
const LOG_FILE = 'meals.json';
const PROFILE_FILE = 'profile.json';

app.post('/api/meals/log', (req, res) => {
  try {
    const { meal } = req.body;
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]');
    const meals = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    meals.push({ ...meal, timestamp: new Date() });
    fs.writeFileSync(LOG_FILE, JSON.stringify(meals, null, 2));
    res.json({ message: 'Meal logged successfully!' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not save meal" });
  }
});

app.get('/api/meals', (req, res) => {
  if (!fs.existsSync(LOG_FILE)) return res.json([]);
  const meals = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  res.json(meals);
});

app.get('/api/profile', (req, res) => {
  if (!fs.existsSync(PROFILE_FILE)) {
    return res.json({ goals: { calories: 2000, protein: 150, carbs: 200, fats: 70 } });
  }
  const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
  res.json(profile);
});

app.post('/api/profile', (req, res) => {
  const { profile } = req.body;
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
  res.json({ message: 'Profile updated successfully!' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});