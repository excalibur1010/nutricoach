import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#86e0b3', // Mint Green
    },
    secondary: {
      main: '#4fcd8e', // Darker Mint Green
    },
    background: {
      default: '#121212', // Charcoal Gray
      paper: '#1e1e1e', // Slightly lighter charcoal for cards
    },
    text: {
      primary: '#ffffff', // White
      secondary: '#b0b0b0', // Light gray for secondary text
    },
  },
  typography: {
    fontFamily: ['Poppins', 'Inter', 'Nunito', 'Roboto', 'sans-serif'].join(','),
    h1: {
      fontFamily: 'Poppins', // Custom font for headings
      fontWeight: 700,
    },
    h2: {
      fontFamily: 'Poppins', // Custom font for headings
      fontWeight: 600,
    },
    // Add other typography variants as needed
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px', // Rounded corners for buttons
          textTransform: 'none', // Prevent uppercase transformation
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px', // More rounded cards
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', // Custom shadow
        },
      },
    },
    // Add other component overrides for custom styling
  },
});

export default theme;
