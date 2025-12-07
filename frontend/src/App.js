import React, { useState, useEffect } from 'react';
import { Camera, Mic, Upload, Zap, User, Home, X, Check, ChevronRight, FileText, PlusCircle } from 'lucide-react';
//After new Update
const API_URL = 'http://localhost:3001';

const App = () => {
  // --- STATE ---
  const [stats, setStats] = useState({
    calories: { current: 0, target: 2000 },
    protein: { current: 0, target: 150 },
    carbs: { current: 0, target: 200 },
    fats: { current: 0, target: 70 },
  });
  
  const [streak] = useState(1);
  const [aiMessage, setAiMessage] = useState("Loading your plan...");
  const [fullRecs, setFullRecs] = useState(null); 
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [pendingMeal, setPendingMeal] = useState(null); 
  const [menuResults, setMenuResults] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showRecs, setShowRecs] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [profileRes, mealsRes] = await Promise.all([
        fetch(`${API_URL}/api/profile`),
        fetch(`${API_URL}/api/meals`)
      ]);
      const profile = await profileRes.json();
      const meals = await mealsRes.json();

      const today = new Date().toDateString();
      const todaysMeals = meals.filter(m => new Date(m.timestamp).toDateString() === today);
      
      let newStats = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      todaysMeals.forEach(m => m.foods?.forEach(f => {
        newStats.calories += (f.calories || 0);
        newStats.protein += (f.protein || 0);
        newStats.carbs += (f.carbs || 0);
        newStats.fats += (f.fats || 0);
      }));

      setStats({
        calories: { current: newStats.calories, target: profile.goals?.calories || 2000 },
        protein: { current: newStats.protein, target: profile.goals?.protein || 150 },
        carbs: { current: newStats.carbs, target: profile.goals?.carbs || 200 },
        fats: { current: newStats.fats, target: profile.goals?.fats || 70 },
      });

      // Coach message disabled to save API calls while testing
      // getCoachMessage(newStats, profile.goals);
    } catch (e) { console.error(e); setAiMessage("Offline Mode"); }
  };

  const getCoachMessage = async (current, targets) => {
    const timeOfDay = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening";
    const prompt = `User Stats: ${current.calories} / ${targets?.calories} cals. Time: ${timeOfDay}. 1. One sentence summary. 2. Two meal suggestions. JSON Format: { "summary": "...", "meals": [{ "name": "...", "calories": 0, "reason": "..." }] }`;

    try {
      const res = await fetch(`${API_URL}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      if (res.status === 429) return; 
      const data = await res.json();
      let parsed = typeof data.responseText === 'string' ? JSON.parse(data.responseText) : data.responseText;
      setAiMessage(parsed.summary || "Stay on track!");
      setFullRecs(parsed);
    } catch (e) { console.error(e); }
  };

  // --- NEW: VOICE INPUT HANDLER ---
  const handleVoiceInput = () => {
    // 1. Check if browser supports voice
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Fallback for browsers without support
      const text = prompt("Voice not supported in this browser. Type your meal:");
      if (text) handleTextAnalysis(text);
      return;
    }

    // 2. Start Listening
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    
    // UI Feedback
    setLoading(true);
    alert("🎤 Listening... Speak now!"); 

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("You said:", transcript);
      handleTextAnalysis(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech Error", event.error);
      setLoading(false);
      alert("Could not hear you. Please try again.");
    };
  };

  // --- NEW: TEXT ANALYSIS (Converts words to food macros) ---
  const handleTextAnalysis = async (text) => {
    setLoading(true);
    try {
      // We ask Gemini to turn the text into the exact JSON format our app needs
      const prompt = `
        Analyze this meal description: "${text}".
        Estimate the nutrition.
        CRITICAL: Assign a "health_grade" (A, B, C, D, F) and a "health_reason".
        
        Return ONLY raw JSON (no markdown).
        Format:
        {
          "name": "Short Name",
          "calories": 0, "protein": 0, "carbs": 0, "fats": 0,
          "health_grade": "B", "health_reason": "..."
        }
      `;

      const res = await fetch(`${API_URL}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });

      if (res.status === 429) { alert("AI Busy. Wait 1 min."); return; }

      const data = await res.json();
      
      // Parse the response
      let foodData = typeof data.responseText === 'string' ? JSON.parse(data.responseText) : data.responseText;
      
      // Show the Modal
      setPendingMeal({ foods: [foodData] });

    } catch (e) {
      console.error(e);
      alert("Could not understand that meal.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e, isMenu = false) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const endpoint = isMenu ? `${API_URL}/api/vision/menu` : `${API_URL}/api/vision/recognize`;
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      
      if (res.status === 429) { alert("AI Usage Limit Reached. Please wait 1 minute."); setLoading(false); return; }
      
      const data = await res.json();
      if (isMenu) setMenuResults(data);
      else if (data.foods) setPendingMeal(data);
    } catch (e) { alert("Error analyzing image"); }
    finally { setLoading(false); }
  };

  const saveMeal = async (mealData) => {
    const mealToSave = mealData || pendingMeal;
    await fetch(`${API_URL}/api/meals/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal: mealToSave })
    });
    setPendingMeal(null);
    setMenuResults(null);
    setShowRecs(false);
    fetchData(); 
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const goals = { calories: fd.get('calories'), protein: fd.get('protein'), carbs: fd.get('carbs'), fats: fd.get('fats') };
    await fetch(`${API_URL}/api/profile`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ profile: { goals } }) });
    setShowProfile(false);
    fetchData();
  };

  const getGradeColor = (grade) => {
    if (grade === 'A') return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
    if (grade === 'B') return 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10';
    if (grade === 'C') return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
    return 'text-red-400 border-red-500/50 bg-red-500/10';
  };

  return (
    <div className="min-h-screen bg-[#1a1625] text-white font-sans pb-20 selection:bg-purple-500">
      <nav className="flex justify-between p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-black font-bold text-xs">AI</div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">NutriAI</span>
        </div>
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 hover:text-emerald-400 transition"><User size={18} /> Profile</button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-6">
        <h1 className="text-4xl font-bold text-center mb-8">Hello! ☀️ <span className="text-gray-400 text-lg block font-normal mt-2">Let's hit your goals today.</span></h1>

        {/* Stats */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl">
          <div className="flex justify-between mb-8">
            <h2 className="text-lg font-semibold">Daily Progress</h2>
            <div className="flex items-center gap-2 text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full text-xs"><Zap size={12} fill="currentColor"/> Streak: {streak}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Ring label="Calories" current={stats.calories.current} target={stats.calories.target} color="text-purple-400" />
            <Ring label="Protein" current={stats.protein.current} target={stats.protein.target} color="text-emerald-400" unit="g" />
            <Ring label="Carbs" current={stats.carbs.current} target={stats.carbs.target} color="text-blue-400" unit="g" />
            <Ring label="Fats" current={stats.fats.current} target={stats.fats.target} color="text-pink-400" unit="g" />
          </div>
        </div>

        {/* Inputs */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-8 text-center hover:border-pink-500/30 transition relative group">
            <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition"><Camera size={32} className="text-pink-400" /></div>
            <h3 className="font-bold text-xl mb-2">Snap Meal</h3>
            <p className="text-gray-400 text-sm mb-6">Analyze calories & get a grade</p>
            <div className="flex gap-2 justify-center">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, false)} disabled={loading} />
                <div className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition"><Upload size={18} /> {loading ? "Analyzing..." : "Food"}</div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, true)} disabled={loading} />
                <div className="px-6 py-3 bg-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-600 transition border border-white/10"><FileText size={18} /> {loading ? "..." : "Menu"}</div>
              </label>
            </div>
          </div>

          {/* VOICE CARD (NOW ACTIVE) */}
          <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-8 text-center hover:border-violet-500/30 transition group">
            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition"><Mic size={32} className="text-violet-400" /></div>
            <h3 className="font-bold text-xl mb-2">Voice Log</h3>
            <p className="text-gray-400 text-sm mb-6">Tell us what you ate</p>
            
            <button onClick={handleVoiceInput} disabled={loading} className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl font-bold flex justify-center gap-2 hover:opacity-90 transition">
              <Mic size={18} /> {loading ? "Listening..." : "Start Speaking"}
            </button>
          </div>
        </div>

        {/* AI Coach */}
        <div onClick={() => setShowRecs(true)} className="bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover:border-emerald-500/30 transition">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">AI</div>
          <div className="flex-1">
            <div className="flex justify-between mb-1"><span className="text-gray-400 text-sm font-bold">COACH SAYS:</span><ChevronRight size={16} className="text-gray-500"/></div>
            <p className="italic text-gray-200">"{aiMessage}"</p>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {pendingMeal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Meal Detected! 🥗</h2>
            {pendingMeal.foods.map((f, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded-xl mb-4 border border-white/5 relative overflow-hidden">
                <div className="flex justify-between font-bold text-lg mb-1"><span>{f.name}</span><span className="text-emerald-400">{f.calories} cal</span></div>
                <div className="text-sm text-gray-400 mb-3">P: {f.protein}g • C: {f.carbs}g • F: {f.fats}g</div>
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${getGradeColor(f.health_grade)}`}>
                  <div className="text-2xl font-black">{f.health_grade || "?"}</div>
                  <div className="text-sm opacity-90 leading-tight">{f.health_reason || "No analysis available."}</div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setPendingMeal(null)} className="flex-1 py-3 bg-gray-800 rounded-xl font-bold hover:bg-gray-700">Cancel</button>
              <button onClick={() => saveMeal(null)} className="flex-1 py-3 bg-emerald-500 rounded-xl font-bold hover:bg-emerald-600">Log Meal</button>
            </div>
          </div>
        </div>
      )}

      {menuResults && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold mb-1">Top Healthy Picks 📄</h2>
            <div className="space-y-3 mb-6">
              {menuResults.options?.map((item, i) => (
                <div key={i} className="bg-slate-800 p-4 rounded-xl border border-white/5 hover:border-emerald-500/50 transition cursor-pointer group" onClick={() => saveMeal({ foods: [item] })}>
                  <div className="flex justify-between font-bold text-emerald-300"><span>{item.name}</span><span>{item.calories} cal</span></div>
                  <p className="text-xs text-gray-400 my-1">{item.description}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setMenuResults(null)} className="w-full py-3 bg-gray-800 rounded-xl font-bold">Close</button>
          </div>
        </div>
      )}

      {showRecs && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md max-h-[80vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between mb-6"><h2 className="text-xl font-bold">Coach's Plan</h2><X onClick={() => setShowRecs(false)} className="cursor-pointer"/></div>
            <p className="text-gray-300 mb-6 italic">"{fullRecs?.summary || aiMessage}"</p>
            <div className="space-y-3">
              {fullRecs?.meals?.map((meal, i) => (
                <div key={i} className="bg-slate-800 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
                  <div className="flex justify-between font-bold text-lg"><span>{meal.name}</span><span className="text-purple-400">{meal.calories} cal</span></div>
                  <button onClick={() => saveMeal({ foods: [meal] })} className="mt-2 py-2 w-full bg-white/5 hover:bg-emerald-500 hover:text-white transition rounded-lg font-bold text-sm flex items-center justify-center gap-2"><PlusCircle size={14} /> Eat This</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {showProfile && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateProfile} className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm">
            <div className="flex justify-between mb-6"><h2 className="text-xl font-bold">Edit Goals</h2><X onClick={() => setShowProfile(false)} className="cursor-pointer"/></div>
            {['calories', 'protein', 'carbs', 'fats'].map(key => (
              <div key={key} className="mb-4"><label className="block text-xs uppercase font-bold text-gray-500 mb-1">{key}</label><input name={key} type="number" defaultValue={stats[key].target} className="w-full bg-slate-800 rounded-xl p-3 border border-white/10 text-white" /></div>
            ))}
            <button className="w-full py-3 bg-purple-600 rounded-xl font-bold mt-2">Save</button>
          </form>
        </div>
      )}
    </div>
  );
};

const Ring = ({ label, current, target, color, unit="" }) => {
  const pct = Math.min(100, (current / (target || 1)) * 100);
  const r = 30; const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24 mb-2">
        <svg className="w-full h-full -rotate-90"><circle cx="48" cy="48" r={r} stroke="#334155" strokeWidth="6" fill="transparent" /><circle cx="48" cy="48" r={r} stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={c} strokeDashoffset={c - (pct/100)*c} className={`${color} transition-all duration-1000`} /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-bold">{Math.round(current)}</span><span className="text-[10px] text-gray-500">/ {target}{unit}</span></div>
      </div>
      <span className="text-sm font-bold text-gray-400">{label}</span>
    </div>
  );
};

export default App;