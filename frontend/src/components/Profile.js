
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Typography, TextField, Button, Box } from '@mui/material';

function Profile() {
  const [profile, setProfile] = useState({ calories: 2000, protein: 150, carbs: 200, fats: 70 });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/profile');
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile }),
      });
      const data = await response.json();
      alert(data.message);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Could not save profile. Please try again.');
    }
  };

  return (
    <Card sx={{ mt: 4, p: 2 }}>
      <CardHeader title="Your Profile" />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Daily Calories"
            type="number"
            variant="outlined"
            fullWidth
            value={profile.calories}
            onChange={(e) => setProfile({ ...profile, calories: parseInt(e.target.value) })}
          />
          <TextField
            label="Protein (g)"
            type="number"
            variant="outlined"
            fullWidth
            value={profile.protein}
            onChange={(e) => setProfile({ ...profile, protein: parseInt(e.target.value) })}
          />
          <TextField
            label="Carbs (g)"
            type="number"
            variant="outlined"
            fullWidth
            value={profile.carbs}
            onChange={(e) => setProfile({ ...profile, carbs: parseInt(e.target.value) })}
          />
          <TextField
            label="Fats (g)"
            type="number"
            variant="outlined"
            fullWidth
            value={profile.fats}
            onChange={(e) => setProfile({ ...profile, fats: parseInt(e.target.value) })}
          />
          <Button variant="contained" onClick={handleSave}>Save Profile</Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default Profile;
