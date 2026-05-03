const express = require('express');
const app = express();

app.use(express.json());

// Users routes
app.get('/users', (req, res) => {
  res.json({
    message: 'Get all users',
    users: []
  });
})

app.post('/users', (req, res) => {
  res.json({
    message: 'Create user',
    user: req.body
  });
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'users' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Users service running on port ${PORT}`);
});