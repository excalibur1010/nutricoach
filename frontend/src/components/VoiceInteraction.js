
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, Typography, Button, Box } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import StorageIcon from '@mui/icons-material/Storage';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

function VoiceInteraction() {
  const [transcribedText, setTranscribedText] = useState('');
  const [llmResponse, setLlmResponse] = useState('AI Voice: "Good morning! Your goal today is 2,000 calories..."');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const playAudio = async (text) => {
    setSpeaking(true);
    try {
      const response = await fetch('http://localhost:3001/api/elevenlabs/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => setSpeaking(false);
      audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setSpeaking(false);
    }
  };

  const handleListen = () => {
    setListening(true);
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setTranscribedText(transcript);
      sendToLlm(transcript);
      setListening(false);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
  };

  const sendToLlm = async (message) => {
    const response = await fetch('http://localhost:3001/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    setLlmResponse(data.responseText);
    playAudio(data.responseText);
  };

  const testGemini = () => {
    sendToLlm("Hello, Gemini! This is a test.");
  }

  const testBackend = async () => {
    const response = await fetch('http://localhost:3001/api/test');
    const data = await response.json();
    console.log('Test backend response:', data);
  }

  return (
    <Card sx={{ mt: 4, p: 2 }}>
      <CardHeader title="Voice Interaction" />
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
          <Button variant="contained" startIcon={<MicIcon />} onClick={handleListen} disabled={listening || speaking}>
            {listening ? 'Listening...' : 'Start Listening'}
          </Button>
          <Button variant="outlined" startIcon={<SmartToyIcon />} onClick={testGemini} disabled={listening || speaking}>
            Test Gemini
          </Button>
          <Button variant="outlined" startIcon={<StorageIcon />} onClick={testBackend} disabled={listening || speaking}>
            Test Backend
          </Button>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1">You said: {transcribedText}</Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>AI Response: {speaking ? 'Speaking...' : llmResponse}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default VoiceInteraction;
