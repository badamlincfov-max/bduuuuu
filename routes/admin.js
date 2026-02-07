const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// Middleware to check admin authentication
const requireAdmin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Admin girişi tələb olunur' });
  }
  next();
};

// Middleware to check super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.session.isSuperAdmin) {
    return res.status(403).json({ error: 'Bu əməliyyat yalnız super admin üçün əlçatandır' });
  }
  next();
};

// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.phone, u.full_name, u.faculty, u.degree, u.course, u.avatar, u.is_active, u.created_at,
        COUNT(DISTINCT r.id) as report_count
      FROM users u
      LEFT JOIN reports r ON u.id = r.reported_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    const totalUsers = result.rows.length;
    
    res.json({ users: result.rows, totalUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'İstifadəçilər əldə edilərkən xəta baş verdi' });
  }
});

// Toggle user active status
router.post('/users/:id/toggle-status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    
    res.json({ success: true, isActive: result.rows[0].is_active });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Status dəyişdirilərkən xəta baş verdi' });
  }
});

// Get reported users (8+ reports)
router.get('/reported-users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.phone, u.full_name, u.faculty, u.degree, u.course, u.avatar, u.is_active,
        COUNT(r.id) as report_count
      FROM users u
      INNER JOIN reports r ON u.id = r.reported_id
      GROUP BY u.id
      HAVING COUNT(r.id) >= 8
      ORDER BY report_count DESC
    `);
    
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get reported users error:', error);
    res.status(500).json({ error: 'Şikayət edilən istifadəçilər əldə edilərkən xəta baş verdi' });
  }
});

// Get settings
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    
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

// Update setting
router.post('/settings/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  try {
    await pool.query(
      'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
      [value, key]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Parametr yenilənərkən xəta baş verdi' });
  }
});

// Get all sub-admins
router.get('/sub-admins', requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, created_at FROM admins WHERE is_super_admin = false ORDER BY created_at DESC'
    );
    
    res.json({ admins: result.rows });
  } catch (error) {
    console.error('Get sub-admins error:', error);
    res.status(500).json({ error: 'Alt adminlər əldə edilərkən xəta baş verdi' });
  }
});

// Create sub-admin
router.post('/sub-admins', requireSuperAdmin, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'İstifadəçi adı və şifrə tələb olunur' });
  }
  
  try {
    // Check if username exists
    const existing = await pool.query(
      'SELECT id FROM admins WHERE username = $1',
      [username]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert admin
    const result = await pool.query(
      'INSERT INTO admins (username, password, is_super_admin) VALUES ($1, $2, false) RETURNING id, username, created_at',
      [username, hashedPassword]
    );
    
    res.json({ success: true, admin: result.rows[0] });
  } catch (error) {
    console.error('Create sub-admin error:', error);
    res.status(500).json({ error: 'Alt admin yaradılarkən xəta baş verdi' });
  }
});

// Delete sub-admin
router.delete('/sub-admins/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Prevent deletion of super admin
    const admin = await pool.query(
      'SELECT is_super_admin FROM admins WHERE id = $1',
      [id]
    );
    
    if (admin.rows.length === 0) {
      return res.status(404).json({ error: 'Admin tapılmadı' });
    }
    
    if (admin.rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Super admin silinə bilməz' });
    }
    
    await pool.query('DELETE FROM admins WHERE id = $1', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete sub-admin error:', error);
    res.status(500).json({ error: 'Alt admin silinərkən xəta baş verdi' });
  }
});

module.exports = router;
