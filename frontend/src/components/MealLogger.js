
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, Typography, Button, TextField, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const VisuallyHiddenInput = styled('input')({ clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', height: 1, overflow: 'hidden', position: 'absolute', bottom: 0, left: 0, whiteSpace: 'nowrap', width: 1, });

function MealLogger() {
  const [mealText, setMealText] = useState('');
  const [mealImage, setMealImage] = useState(null);
  const [parsedMeal, setParsedMeal] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleParseMeal = async () => {
    setLoading(true);
    try {
      let data;
      if (mealImage) {
        const formData = new FormData();
        formData.append('image', mealImage);
        const response = await fetch('http://localhost:3001/api/vision/recognize', {
          method: 'POST',
          body: formData,
        });
        data = await response.json();
      } else if (mealText) {
        const prompt = `Analyze the following meal description and return a JSON object with the estimated calories, protein, carbs, and fats. If you cannot determine a value, use 0. Example: { "foods": [ { "name": "Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fats": 3.6 } ] }. Meal: ${mealText}`;
        const response = await fetch('http://localhost:3001/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: prompt }),
        });
        const geminiResponse = await response.json();
        if (typeof geminiResponse.responseText === 'object' && geminiResponse.responseText !== null) {
          data = geminiResponse.responseText;
        } else {
          alert('Gemini did not return valid meal data: ' + geminiResponse.responseText);
          setLoading(false);
          return;
        }
      } else {
        alert('Please provide a meal description or an image.');
        setLoading(false);
        return;
      }
      setParsedMeal(data);
    } catch (error) {
      console.error('Error parsing meal:', error);
      alert('Could not parse meal. Please try again or be more specific.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMeal = async () => {
    if (!parsedMeal) return;
    try {
      const response = await fetch('http://localhost:3001/api/meals/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meal: parsedMeal }),
      });
      const data = await response.json();
      alert(data.message);
      setMealText('');
      setMealImage(null);
      setParsedMeal(null);
    } catch (error) {
      console.error('Error logging meal:', error);
      alert('Could not log meal. Please try again.');
    }
  };

  return (
    <Card sx={{ mt: 4, p: 2 }}>
      <CardHeader title="Log Your Meal" />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button component="label" variant="contained" startIcon={<i className="material-icons">cloud_upload</i>}>
            Upload Image
            <VisuallyHiddenInput
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                setMealImage(e.target.files[0]);
                setMealText('');
              }}
            />
          </Button>
          {mealImage && <Typography variant="body2">Selected: {mealImage.name}</Typography>}
          <Typography variant="body1" align="center">Or</Typography>
          <TextField
            label="Meal Description"
            variant="outlined"
            fullWidth
            value={mealText}
            onChange={(e) => {
              setMealText(e.target.value);
              setMealImage(null);
            }}
            placeholder="E.g., chicken breast, rice, broccoli"
          />
          <Button variant="contained" onClick={handleParseMeal} disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Meal'}
          </Button>
        </Box>

        {parsedMeal && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: '8px' }}>
            <Typography variant="h6" gutterBottom>Parsed Meal:</Typography>
            {parsedMeal.foods.map((food, index) => (
              <Typography key={index} variant="body2">
                {food.name}: {food.calories} kcal, {food.protein}g P, {food.carbs}g C, {food.fats}g F
              </Typography>
            ))}
            <Button variant="contained" color="secondary" onClick={handleLogMeal} sx={{ mt: 2 }}>Confirm & Log Meal</Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default MealLogger;
