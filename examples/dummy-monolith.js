const express = require('express');
const app = express();

app.use(express.json());

// User routes
app.get('/users', (req, res) => {
  res.json({ message: 'Get all users', users: [] });
});

app.post('/users', (req, res) => {
  res.json({ message: 'Create user', user: req.body });
});

// Order routes
app.get('/orders', (req, res) => {
  res.json({ message: 'Get all orders', orders: [] });
});

app.post('/orders', (req, res) => {
  res.json({ message: 'Create order', order: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Made with Bob
