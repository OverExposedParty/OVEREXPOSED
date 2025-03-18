const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');

const app = express();
const PORT = process.env.PORT || 3000;

// Add security headers using helmet
app.use(helmet());

// Customize specific headers
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://code.responsivevoice.org", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://cdnjs.cloudflare.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise"],
    objectSrc: ["'none'"],
    connectSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://docs.google.com", "https://doc-0g-8s-sheets.googleusercontent.com", "https://script.google.com", "https://script.googleusercontent.com", "https://unpkg.com/compromise"],
    imgSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com"],
    frameSrc: ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://script.google.com", "https://script.googleusercontent.com"],
  }
}));

app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'no-referrer-when-downgrade' }));

// Use permissionsPolicy
app.use(permissionsPolicy({
  features: {
    geolocation: ['self'],  // Correct without quotes here
    microphone: []
  }
}));

// Use CORS middleware
/*app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
})); */

app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) {
      res.set('Content-Type', 'image/svg+xml');
    }
  }
}));

// Define routes for your HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'homepages', 'homepage.html'));
});

app.get('/party-games', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'homepages', 'party-games-homepage.html'));
});

app.get('/what-is-overexposed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'what-is-overexposed', 'what-is-overexposed.html'));
});

app.get('/truth-or-dare-settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/truth-or-dare', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'truth-or-dare', 'truth-or-dare-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/paranoia-settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/paranoia', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'paranoia', 'paranoia-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/never-have-i-ever-settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/never-have-i-ever', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'never-have-i-ever', 'never-have-i-ever-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/most-likely-to-settings', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-settings-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/most-likely-to', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'party-games', 'most-likely-to', 'most-likely-to-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/insights', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blog-landing-page.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/overexposure', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/overexposure/:timestamp', (req, res) => {
  const timestamp = req.params.timestamp; // This will capture the dynamic timestamp part
  const filePath = path.join(__dirname, 'public', 'pages', 'overexposure', 'overexposure.html');
  // Your logic for handling the request
  res.sendFile(filePath);
});


//Blogs
app.get('/insights/final-year-stress', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'final-year-stress.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/insights/new-years-eve-party', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'nye-party.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

app.get('/insights/break-the-ice-not-hearts', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'break-the-ice-not-hearts.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});
app.get('/insights/valentines-day', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'pages', 'blog-section', 'blogs', 'break-the-ice-not-hearts.html');
  console.log(`Attempting to serve file from: ${filePath}`);
  res.sendFile(filePath);
});

// Handle 404 (Page Not Found)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'pages', '404.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
