const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) { console.error('❌ MongoDB failed:', err.message); throw err; }
};
module.exports = { connectDB };
