const r = require('express').Router(), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'), rateLimit = require('express-rate-limit'), db = require('../config/db');
const strong = body('password').matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).withMessage('Password needs 8+ chars with a letter and a number');
const sign = u => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
const bad = (req, res) => { const e = validationResult(req); if (!e.isEmpty()) { res.status(400).json({ errors: e.array().map(x => x.msg) }); return true; } };

// Public registration: student or recruiter ONLY. Admin comes from scripts/seed.js.
r.post('/register', [body('email').isEmail(), strong, body('full_name').trim().notEmpty(), body('role').isIn(['student', 'recruiter'])], async (req, res) => {
  if (bad(req, res)) return;
  const { email, password, full_name, role, company_name } = req.body;
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [u] = await c.query('INSERT INTO users(email,password_hash,role,full_name) VALUES(?,?,?,?)', [email, await bcrypt.hash(password, 10), role, full_name]);
    if (role === 'student') await c.query('INSERT INTO students(user_id) VALUES(?)', [u.insertId]);
    else await c.query('INSERT INTO companies(user_id,name) VALUES(?,?)', [u.insertId, company_name || full_name]);
    await c.commit(); res.status(201).json({ token: sign({ id: u.insertId, role }), role });
  } catch (e) { await c.rollback(); res.status(e.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: e.code === 'ER_DUP_ENTRY' ? 'Email already registered' : 'Registration failed' }); }
  finally { c.release(); }
});
r.post('/login', rateLimit({ windowMs: 15 * 60e3, max: 10 }), [body('email').isEmail(), body('password').notEmpty()], async (req, res) => {
  if (bad(req, res)) return;
  const [[u]] = await db.query('SELECT * FROM users WHERE email=?', [req.body.email]);
  if (!u || !(await bcrypt.compare(req.body.password, u.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), role: u.role, name: u.full_name });
});
module.exports = r;
