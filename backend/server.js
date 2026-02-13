// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const customerRoutes = require('./routes/customers');
const letterRoutes = require('./routes/letters');
const emailRoutes = require('./routes/email');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// -------------------- Security: Content Security Policy --------------------
// Strict CSP: no inline scripts or inline event handlers allowed.
// We assume frontend uses external scripts and no inline attributes.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "blob:"
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // allow inline styles (commonly needed for some UI libs)
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com"
  ],
  fontSrc: [
    "'self'",
    "https://cdnjs.cloudflare.com",
    "https://fonts.gstatic.com"
  ],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com"
  ],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives
    },
    // other helmet defaults are fine
  })
);

// -------------------- Middleware --------------------
app.use(morgan(isProd ? 'combined' : 'dev'));

app.use(cors({
  origin: isProd ? process.env.FRONTEND_URL : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900
  }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static front-end
app.use(express.static(path.join(__dirname, '../frontend')));

// -------------------- Routes --------------------
app.use('/api', apiRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/email', emailRoutes);

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: NODE_ENV
  });
});

// -------------------- Error handling --------------------
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'Please upload files smaller than 10MB'
    });
  }

  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Invalid file upload',
      message: 'Only Excel files are allowed'
    });
  }

  res.status(err && err.status ? err.status : 500).json({
    error: err && err.name ? err.name : 'Internal server error',
    message: NODE_ENV === 'development' ? (err && err.message ? err.message : '') : 'Something went wrong'
  });
});

// 404 handler (any unmatched route)
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// -------------------- Start server --------------------
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🏦 SBI Letter Automation System');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`💡 Environment: ${NODE_ENV}`);
  console.log('='.repeat(60) + '\n');
});

module.exports = app;
