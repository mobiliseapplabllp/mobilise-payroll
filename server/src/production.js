// Production server: serves API + static frontend
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });
const path = require('path');
const app = require('./index');

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(require('express').static(clientBuild));
  // All non-API routes serve the React app
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuild, 'index.html'));
    }
  });
}
