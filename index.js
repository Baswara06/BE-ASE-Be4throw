require('dotenv').config(); // load .env first, before anything reads process.env

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { success } = require('./utils/response');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middlewares
app.use(helmet()); // adds secure HTTP headers
app.use(cors({ origin: process.env.FRONTEND_URL })); // only allow our front-end
app.use(express.json({ limit: '1mb' })); // parse JSON body, max 1mb

// Health check
app.get('/', (req, res) => {
  return success(res, 200, 'Server Be4Throw berjalan');
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Must be last: 404 then error handler
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});