require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool, initDatabase } = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'bsu-chat-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory storage for messages (RAM only)
const groupMessages = {}; // { faculty: [messages] }
const privateMessages = {}; // { roomId: [messages] }
const onlineUsers = {}; // { userId: socketId }

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User joins with authentication
  socket.on('join', async (data) => {
    const { userId, faculty } = data;
    
    // Store user's socket connection
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    socket.faculty = faculty;

    // Join faculty room
    socket.join(`faculty_${faculty}`);
    
    // Get user info from database
    const result = await pool.query(
      'SELECT id, full_name, faculty, degree, course, avatar FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Send existing group messages for this faculty
      if (!groupMessages[faculty]) {
        groupMessages[faculty] = [];
      }
      socket.emit('groupMessages', groupMessages[faculty]);
      
      // Notify others in the room
      socket.to(`faculty_${faculty}`).emit('userJoined', {
        userId: user.id,
        fullName: user.full_name,
        avatar: user.avatar
      });
    }
  });

  // Send group message
  socket.on('sendGroupMessage', async (data) => {
    const { userId, faculty, message } = data;
    
    // Check if user is blocked by others (they won't see this message)
    const blocks = await pool.query(
      'SELECT blocker_id FROM blocks WHERE blocked_id = $1',
      [userId]
    );
    const blockerIds = blocks.rows.map(b => b.blocker_id);
    
    // Get user info
    const userResult = await pool.query(
      'SELECT full_name, faculty, degree, course, avatar FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      // Get filter words
      const filterResult = await pool.query(
        "SELECT value FROM settings WHERE key = 'filter_words'"
      );
      const filterWords = filterResult.rows[0]?.value || '';
      let filteredMessage = message;
      
      // Apply filter
      if (filterWords) {
        const words = filterWords.split(',').map(w => w.trim()).filter(w => w);
        words.forEach(word => {
          const regex = new RegExp(word, 'gi');
          filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
        });
      }
      
      const messageData = {
        id: Date.now(),
        userId,
        fullName: user.full_name,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        avatar: user.avatar,
        message: filteredMessage,
        timestamp: new Date().toISOString()
      };
      
      // Store in RAM
      if (!groupMessages[faculty]) {
        groupMessages[faculty] = [];
      }
      groupMessages[faculty].push(messageData);
      
      // Broadcast to all in the faculty room except blockers
      const roomSockets = await io.in(`faculty_${faculty}`).fetchSockets();
      roomSockets.forEach(s => {
        // Don't send to users who blocked this sender
        if (!blockerIds.includes(parseInt(s.userId))) {
          s.emit('newGroupMessage', messageData);
        }
      });
    }
  });

  // Join private chat
  socket.on('joinPrivateChat', async (data) => {
    const { userId, otherUserId } = data;
    
    // Check if blocked
    const blockCheck = await pool.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [userId, otherUserId]
    );
    
    if (blockCheck.rows.length > 0) {
      socket.emit('chatBlocked');
      return;
    }
    
    // Create room ID (sorted to ensure same room for both users)
    const roomId = [userId, otherUserId].sort().join('_');
    socket.join(`private_${roomId}`);
    
    // Send existing private messages
    if (!privateMessages[roomId]) {
      privateMessages[roomId] = [];
    }
    socket.emit('privateMessages', privateMessages[roomId]);
  });

  // Send private message
  socket.on('sendPrivateMessage', async (data) => {
    const { senderId, receiverId, message } = data;
    
    // Check if blocked
    const blockCheck = await pool.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [senderId, receiverId]
    );
    
    if (blockCheck.rows.length > 0) {
      socket.emit('messageBlocked');
      return;
    }
    
    // Get sender info
    const userResult = await pool.query(
      'SELECT full_name, avatar FROM users WHERE id = $1 AND is_active = true',
      [senderId]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const roomId = [senderId, receiverId].sort().join('_');
      
      const messageData = {
        id: Date.now(),
        senderId,
        receiverId,
        senderName: user.full_name,
        avatar: user.avatar,
        message,
        timestamp: new Date().toISOString()
      };
      
      // Store in RAM
      if (!privateMessages[roomId]) {
        privateMessages[roomId] = [];
      }
      privateMessages[roomId].push(messageData);
      
      // Send to both users in the private room
      io.to(`private_${roomId}`).emit('newPrivateMessage', messageData);
    }
  });

  // Block user
  socket.on('blockUser', async (data) => {
    const { blockerId, blockedId } = data;
    
    try {
      await pool.query(
        'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [blockerId, blockedId]
      );
      socket.emit('userBlocked', { success: true });
    } catch (error) {
      socket.emit('userBlocked', { success: false, error: error.message });
    }
  });

  // Report user
  socket.on('reportUser', async (data) => {
    const { reporterId, reportedId } = data;
    
    try {
      await pool.query(
        'INSERT INTO reports (reporter_id, reported_id) VALUES ($1, $2)',
        [reporterId, reportedId]
      );
      socket.emit('userReported', { success: true });
    } catch (error) {
      socket.emit('userReported', { success: false, error: error.message });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
    }
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Message cleanup job (runs every hour)
setInterval(async () => {
  try {
    const settings = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('group_message_lifetime_hours', 'private_message_lifetime_hours')"
    );
    
    const groupLifetime = parseInt(settings.rows.find(s => s.key === 'group_message_lifetime_hours')?.value || '48');
    const privateLifetime = parseInt(settings.rows.find(s => s.key === 'private_message_lifetime_hours')?.value || '24');
    
    const now = Date.now();
    const groupCutoff = now - (groupLifetime * 60 * 60 * 1000);
    const privateCutoff = now - (privateLifetime * 60 * 60 * 1000);
    
    // Clean group messages
    Object.keys(groupMessages).forEach(faculty => {
      groupMessages[faculty] = groupMessages[faculty].filter(msg => {
        return new Date(msg.timestamp).getTime() > groupCutoff;
      });
    });
    
    // Clean private messages
    Object.keys(privateMessages).forEach(roomId => {
      privateMessages[roomId] = privateMessages[roomId].filter(msg => {
        return new Date(msg.timestamp).getTime() > privateCutoff;
      });
    });
    
    console.log('🧹 Message cleanup completed');
  } catch (error) {
    console.error('❌ Message cleanup error:', error);
  }
}, 60 * 60 * 1000); // Every hour

// Initialize database and start server
const PORT = process.env.PORT || 3000;

initDatabase()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 BSU Chat Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end();
  });
});

module.exports = { app, server, io };
