const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session management
const sessions = new Map();
app.set('sessions', sessions);

// Custom cookie parser middleware
app.use((req, res, next) => {
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        req.cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
      }
    });
  }
  next();
});

// Routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);

// Serve index.html for all HTML pages to support Single Page Application (SPA) routing
const routes = ['/', '/home', '/login', '/register', '/vehicles', '/dashboard', '/admin', '/score', '/profile', '/questionnaire'];
routes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route Not Found',
    path: req.path
  });
});

function startServer(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════════╗
    ║                                                                ║
    ║   🚗 ROAD WARRIOR PRO - Delivery Management System             ║
    ║   ═══════════════════════════════════════════════════════════  ║
    ║                                                                ║
    ║   Server is running at: http://localhost:${port}                  
    ║   Environment: ${process.env.NODE_ENV || 'development'}                        
    ║   Version: 2.0.0                                              ║
    ║                                                                ║
    ╚════════════════════════════════════════════════════════════════╝
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${port} is already in use. Trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

startServer(Number(PORT));

module.exports = app;
