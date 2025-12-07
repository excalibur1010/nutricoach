
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Typography, LinearProgress, Box } from '@mui/material';

function Dashboard() {
  const [profile, setProfile] = useState({ calories: 2000, protein: 150, carbs: 200, fats: 70 });
  const [meals, setMeals] = useState([]);
  const [todayStats, setTodayStats] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [recommendation, setRecommendation] = useState('Loading recommendations...');
  const [loading, setLoading] = useState(true);

  const motivationalQuotes = [
    "Stay consistent, you're doing great!",
    "Every healthy choice is a step forward.",
    "Nourish your body, fuel your mind.",
    "Small changes lead to big results.",
    "You've got this! Keep up the great work."
  ];

  const getRandomQuote = () => motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profile
        const profileResponse = await fetch('http://localhost:3001/api/profile');
        const profileData = await profileResponse.json();
        setProfile(profileData);

        // Fetch meals
        const mealsResponse = await fetch('http://localhost:3001/api/meals');
        const mealsData = await mealsResponse.json();
        setMeals(mealsData);

        // Calculate today's stats
        const today = new Date().toISOString().slice(0, 10);
        const filteredMeals = mealsData.filter(meal => {
          const mealDate = new Date(meal.timestamp).toISOString().slice(0, 10);
          return mealDate === today;
        });

        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFats = 0;

        filteredMeals.forEach(meal => {
          meal.foods.forEach(food => {
            totalCalories += food.calories;
            totalProtein += food.protein;
            totalCarbs += food.carbs;
            totalFats += food.fats;
          });
        });
        setTodayStats({ calories: totalCalories, protein: totalProtein, carbs: totalCarbs, fats: totalFats });

        // Get recommendations from Gemini
        const prompt = `Given a daily calorie goal of ${profileData.calories} kcal, protein goal of ${profileData.protein}g, carbs goal of ${profileData.carbs}g, and fats goal of ${profileData.fats}g, and current consumption of ${totalCalories} kcal, ${totalProtein}g protein, ${totalCarbs}g carbs, and ${totalFats}g fats, provide a smart recommendation for the rest of the day.`;
        const geminiResponse = await fetch('http://localhost:3001/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: prompt }),
        });
        const geminiData = await geminiResponse.json();
        setRecommendation(geminiData.responseText);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateProgress = (current, goal) => (goal > 0 ? (current / goal) * 100 : 0);

  if (loading) {
    return (
      <Card sx={{ mt: 4, p: 2 }}>
        <CardHeader title="Loading Dashboard..." />
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 3, mt: 4 }}>
      <Card sx={{ p: 2 }}>
        <CardHeader title="Today's Progress" />
        <CardContent>
          <Typography variant="body1">Calories: {todayStats.calories}/{profile.calories} kcal ({calculateProgress(todayStats.calories, profile.calories).toFixed(0)}%)</Typography>
          <LinearProgress variant="determinate" value={calculateProgress(todayStats.calories, profile.calories)} sx={{ mb: 2 }} />

          <Typography variant="body1">Protein: {todayStats.protein}/{profile.protein}g ({calculateProgress(todayStats.protein, profile.protein).toFixed(0)}%)</Typography>
          <LinearProgress variant="determinate" value={calculateProgress(todayStats.protein, profile.protein)} sx={{ mb: 2 }} />

          <Typography variant="body1">Carbs: {todayStats.carbs}/{profile.carbs}g ({calculateProgress(todayStats.carbs, profile.carbs).toFixed(0)}%)</Typography>
          <LinearProgress variant="determinate" value={calculateProgress(todayStats.carbs, profile.carbs)} sx={{ mb: 2 }} />

          <Typography variant="body1">Fats: {todayStats.fats}/{profile.fats}g ({calculateProgress(todayStats.fats, profile.fats).toFixed(0)}%)</Typography>
          <LinearProgress variant="determinate" value={calculateProgress(todayStats.fats, profile.fats)} sx={{ mb: 2 }} />

          <Typography variant="h6" sx={{ mt: 2 }}>Streak: 0 days (placeholder)</Typography>
        </CardContent>
      </Card>

      <Card sx={{ p: 2 }}>
        <CardHeader title="Smart Recommendations" />
        <CardContent>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{recommendation}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
            "{getRandomQuote()}"
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Dashboard;
