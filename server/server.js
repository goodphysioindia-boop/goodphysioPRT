require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seed');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const scheduledSessionRoutes = require('./routes/scheduledSessionRoutes');

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'prt-health-app-server', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/scheduled-sessions', scheduledSessionRoutes);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await seedAdmin();

  // Scheduled sessions: drop any stale/legacy indexes left on this collection (e.g. an old
  // unique "scheduledSessionId" index) so they can't block new sessions with a duplicate-key error.
  try {
    await require('./models/ScheduledSession').syncIndexes();
  } catch (err) {
    console.error('⚠️  Could not sync scheduled-session indexes:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Good Physio App API running on http://localhost:${PORT}`);
  });
};

start();