require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;

async function getModels() {
  if (!API_KEY) {
    console.log("❌ Error: GEMINI_API_KEY is missing from .env");
    return;
  }

  console.log("🔍 Checking available models for your Key...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();

    if (data.error) {
      console.error("❌ API Error:", data.error.message);
      return;
    }

    if (!data.models) {
      console.log("❌ No models found. Your key might be invalid or restricted.");
      return;
    }

    console.log("\n✅ SUCCESS! You have access to these models:");
    // Filter for models that support 'generateContent'
    const available = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));
      
    available.forEach(name => console.log(` - "${name}"`));

    console.log("\n👉 Pick one of the names above and put it in your server.js!");
  } catch (error) {
    console.error("Connection Error:", error);
  }
}

getModels();