const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// Middleware to check user authentication
const requireUser = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Giriş tələb olunur' });
  }
  next();
};

// Get current user profile
router.get('/profile', requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, phone, full_name, faculty, degree, course, avatar, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Profil məlumatları əldə edilərkən xəta baş verdi' });
  }
});

// Update user profile
router.post('/profile', requireUser, async (req, res) => {
  const { fullName, faculty, degree, course, avatar } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, faculty = $2, degree = $3, course = $4, avatar = $5
       WHERE id = $6
       RETURNING id, email, phone, full_name, faculty, degree, course, avatar`,
      [fullName, faculty, degree, course, avatar, req.session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Profil yenilənərkən xəta baş verdi' });
  }
});

// Get users in same faculty
router.get('/faculty-users', requireUser, async (req, res) => {
  try {
    // Get current user's faculty
    const userResult = await pool.query(
      'SELECT faculty FROM users WHERE id = $1',
      [req.session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    
    const faculty = userResult.rows[0].faculty;
    
    // Get all active users in the same faculty
    const result = await pool.query(
      `SELECT id, full_name, faculty, degree, course, avatar 
       FROM users 
       WHERE faculty = $1 AND is_active = true AND id != $2
       ORDER BY full_name`,
      [faculty, req.session.userId]
    );
    
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get faculty users error:', error);
    res.status(500).json({ error: 'Fakültə istifadəçiləri əldə edilərkən xəta baş verdi' });
  }
});

// Get user by ID
router.get('/user/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT id, full_name, faculty, degree, course, avatar FROM users WHERE id = $1 AND is_active = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'İstifadəçi məlumatları əldə edilərkən xəta baş verdi' });
  }
});

// Check if user is blocked
router.get('/is-blocked/:userId', requireUser, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
      [req.session.userId, userId]
    );
    
    res.json({ blocked: result.rows.length > 0 });
  } catch (error) {
    console.error('Check block error:', error);
    res.status(500).json({ error: 'Əngəl yoxlanılarkən xəta baş verdi' });
  }
});

// Get settings (public)
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('about_text', 'daily_topic')"
    );
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Parametrlər əldə edilərkən xəta baş verdi' });
  }
});

module.exports = router;
