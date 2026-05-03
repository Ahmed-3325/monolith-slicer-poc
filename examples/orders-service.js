const express = require('express');
const app = express();

app.use(express.json());

// Orders routes
app.get('/orders', (req, res) => {
  res.json({
    message: 'Get all orders',
    orders: []
  });
})

app.post('/orders', (req, res) => {
  res.json({
    message: 'Create order',
    order: req.body
  });
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'orders' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Orders service running on port ${PORT}`);
});