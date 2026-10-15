// Creates the admin + fictional demo data. Passwords come from .env (never hardcoded). Idempotent.
require('dotenv').config(); const bcrypt = require('bcryptjs'), db = require('../config/db');
(async () => {
  const mk = async (email, name, role, pw) => { const [r] = await db.query('INSERT IGNORE INTO users(email,password_hash,role,full_name) VALUES(?,?,?,?)', [email, await bcrypt.hash(pw, 10), role, name]);
    return r.insertId || (await db.query('SELECT id FROM users WHERE email=?', [email]))[0][0].id; };
  if (!process.env.ADMIN_PASSWORD || !process.env.DEMO_PASSWORD) throw new Error('Set ADMIN_PASSWORD and DEMO_PASSWORD in .env');
  await mk(process.env.ADMIN_EMAIL, 'Placement Officer', 'admin', process.env.ADMIN_PASSWORD);
  const s = await mk('demo.student@example.com', 'Demo Student', 'student', process.env.DEMO_PASSWORD);
  await db.query("INSERT IGNORE INTO students VALUES(?,?,?,?,?,?,?,NULL)", [s, 'CSE2027001', 'CSE', 7.8, 2027, 0, '9000000000']);
  for (const k of ['SQL', 'Excel', 'Python']) await db.query('INSERT IGNORE INTO student_skills VALUES(?,?)', [s, k]);
  const r = await mk('hr@democorp.example', 'Demo HR', 'recruiter', process.env.DEMO_PASSWORD);
  await db.query('INSERT IGNORE INTO companies(user_id,name,location) VALUES(?,?,?)', [r, 'DemoCorp Analytics', 'Hyderabad']);
  const [[c]] = await db.query('SELECT id FROM companies WHERE user_id=?', [r]);
  const [[ex]] = await db.query('SELECT id FROM drives WHERE company_id=? LIMIT 1', [c.id]);
  if (!ex) { const [d] = await db.query("INSERT INTO drives(company_id,job_role,eligible_branches,min_cgpa,max_backlogs,grad_year,package_lpa,deadline) VALUES(?,?,?,?,?,?,?,DATE_ADD(CURDATE(),INTERVAL 30 DAY))", [c.id, 'Data Analyst', 'CSE,IT,DS', 7, 0, 2027, 6]);
    for (const k of ['SQL', 'Excel', 'Power BI', 'Python']) await db.query('INSERT INTO drive_skills VALUES(?,?)', [d.insertId, k]); }
  console.log('Seeded.'); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
