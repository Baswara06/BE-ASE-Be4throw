const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Server jalan bro!' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});