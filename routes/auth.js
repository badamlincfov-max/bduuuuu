const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

// Verification questions and answers
const verificationQuestions = [
  { q: 'Mexanika-riyaziyyat fakültəsi hansı korpusda yerləşir?', a: '3' },
  { q: 'Tətbiqi riyaziyyat və kibernetika fakültəsi hansı korpusda yerləşir?', a: '3' },
  { q: 'Fizika fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Kimya fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Biologiya fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Ekologiya və torpaqşünaslıq fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Coğrafiya fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Geologiya fakültəsi hansı korpusda yerləşir?', a: 'əsas' },
  { q: 'Filologiya fakültəsi hansı korpusda yerləşir?', a: '1' },
  { q: 'Tarix fakültəsi hansı korpusda yerləşir?', a: '3' },
  { q: 'Beynəlxalq münasibətlər və iqtisadiyyat fakültəsi hansı korpusda yerləşir?', a: '1' },
  { q: 'Hüquq fakültəsi hansı korpusda yerləşir?', a: '1' },
  { q: 'Jurnalistika fakültəsi hansı korpusda yerləşir?', a: '2' },
  { q: 'İnformasiya və sənəd menecmenti fakültəsi hansı korpusda yerləşir?', a: '2' },
  { q: 'Şərqşünaslıq fakültəsi hansı korpusda yerləşir?', a: '2' },
  { q: 'Sosial elmlər və psixologiya fakültəsi hansı korpusda yerləşir?', a: '2' }
];

// Get random verification questions
router.get('/verification-questions', (req, res) => {
  const shuffled = [...verificationQuestions].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);
  res.json(selected);
});

// Verify answers
router.post('/verify-answers', (req, res) => {
  const { answers } = req.body; // Array of { question, answer }
  
  let correctCount = 0;
  answers.forEach(ans => {
    const question = verificationQuestions.find(q => q.q === ans.question);
    if (question && question.a.toLowerCase() === ans.answer.toLowerCase()) {
      correctCount++;
    }
  });
  
  const passed = correctCount >= 2;
  res.json({ passed, correctCount, total: answers.length });
});

// Register new user
router.post('/register', async (req, res) => {
  const { email, phone, password, fullName, faculty, degree, course, avatar } = req.body;
  
  // Validate email ends with @bsu.edu.az
  if (!email.endsWith('@bsu.edu.az')) {
    return res.status(400).json({ error: 'Email sonluğu @bsu.edu.az olmalıdır' });
  }
  
  // Validate phone format +994XXXXXXXXX
  if (!phone.match(/^\+994\d{9}$/)) {
    return res.status(400).json({ error: 'Nömrə formatı: +994XXXXXXXXX' });
  }
  
  // Validate course (1-6)
  if (course < 1 || course > 6) {
    return res.status(400).json({ error: 'Kurs 1-6 arasında olmalıdır' });
  }
  
  try {
    // Check if email or phone already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Bu email və ya nömrə artıq qeydiyyatdan keçib' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, phone, password, full_name, faculty, degree, course, avatar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, full_name, faculty, degree, course, avatar`,
      [email, phone, hashedPassword, fullName, faculty, degree, course, avatar]
    );
    
    const user = result.rows[0];
    req.session.userId = user.id;
    req.session.userType = 'user';
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Qeydiyyat zamanı xəta baş verdi' });
  }
});

// User login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email və ya şifrə yanlışdır' });
    }
    
    const user = result.rows[0];
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız deaktiv edilib' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Email və ya şifrə yanlışdır' });
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.userType = 'user';
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş zamanı xəta baş verdi' });
  }
});

// Admin login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'İstifadəçi adı və ya şifrə yanlışdır' });
    }
    
    const admin = result.rows[0];
    
    // For super admin, check plain password first (will be hashed after first login)
    let validPassword = false;
    
    if (username === '618ursamajor618' && password === 'majorursa618') {
      validPassword = true;
      // Hash the password for future use
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE admins SET password = $1 WHERE username = $2',
        [hashedPassword, username]
      );
    } else {
      validPassword = await bcrypt.compare(password, admin.password);
    }
    
    if (!validPassword) {
      return res.status(401).json({ error: 'İstifadəçi adı və ya şifrə yanlışdır' });
    }
    
    // Set session
    req.session.adminId = admin.id;
    req.session.userType = 'admin';
    req.session.isSuperAdmin = admin.is_super_admin;
    
    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        isSuperAdmin: admin.is_super_admin
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Giriş zamanı xəta baş verdi' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Çıxış zamanı xəta baş verdi' });
    }
    res.json({ success: true });
  });
});

// Check session
router.get('/check-session', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true, userType: 'user', userId: req.session.userId });
  } else if (req.session.adminId) {
    res.json({ 
      authenticated: true, 
      userType: 'admin', 
      adminId: req.session.adminId,
      isSuperAdmin: req.session.isSuperAdmin 
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
