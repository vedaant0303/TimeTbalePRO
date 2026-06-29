const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
require('dotenv').config();
const passport = require('./config/passport');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const subjectRoutes = require('./routes/subjects');
const roomRoutes = require('./routes/rooms');
const timeslotRoutes = require('./routes/timeslots');
const timetableRoutes = require('./routes/timetable');
const calendarRoutes = require('./routes/calendar');
const workloadRoutes = require('./routes/workload');
const reportRoutes = require('./routes/reports');
const semesterRoutes = require('./routes/semester');
const roomAllocationRoutes = require('./routes/roomAllocation');
const subjectConfigRoutes = require('./routes/subjectConfig');
const exportRoutes = require('./routes/export');
const leaveRoutes = require('./routes/leaves');
const classRoutes = require('./routes/classes');
const setupRoutes = require('./routes/setup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Middleware
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'timetable_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timeslots', timeslotRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/workload', workloadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/semester', semesterRoutes);
app.use('/api/room-allocation', roomAllocationRoutes);
app.use('/api/subject-config', subjectConfigRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/setup', setupRoutes);

// Global error handler - log all unhandled errors
app.use((err, req, res, next) => {
  console.error('=== GLOBAL ERROR ===');
  console.error('URL:', req.method, req.originalUrl);
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ message: 'Internal server error.', error: err.message });
  }
});

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-department', (deptId) => {
    socket.join(`dept-${deptId}`);
  });

  socket.on('join-role', (role) => {
    socket.join(`role-${role}`);
  });

  socket.on('join-semester', ({ semesterId }) => {
    socket.join(`semester-${semesterId}`);
  });

  socket.on('check-conflict', async (data) => {
    try {
      const TimetableSlot = require('./models/TimetableSlot');
      const filter = {
        day: data.day,
        startTime: data.timeSlot,
        semesterId: data.semesterId
      };
      if (data.excludeSlotId) filter._id = { $ne: data.excludeSlotId };

      const conflicts = [];
      if (data.facultyId) {
        const fc = await TimetableSlot.findOne({ ...filter, facultyId: data.facultyId });
        if (fc) conflicts.push({ type: 'faculty', details: fc });
      }
      if (data.roomId) {
        const rc = await TimetableSlot.findOne({ ...filter, roomId: data.roomId });
        if (rc) conflicts.push({ type: 'room', details: rc });
      }

      socket.emit('conflict-result', {
        hasConflict: conflicts.length > 0,
        type: conflicts.map(c => c.type).join(', '),
        details: conflicts
      });
    } catch (err) {
      socket.emit('conflict-result', { hasConflict: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Sync indexes for models that have changed their index definitions
    try {
      const TimeSlot = require('./models/TimeSlot');
      await TimeSlot.syncIndexes();
      console.log('TimeSlot indexes synced');
    } catch (err) {
      console.warn('Index sync warning (non-fatal):', err.message);
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { app, io };
