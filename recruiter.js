const r = require('express').Router(), db = require('../config/db'), { auth, role } = require('../middleware/auth'), { csvSafe } = require('../services/eligibility');
r.use(auth, role('recruiter'));
const company = async uid => (await db.query('SELECT id FROM companies WHERE user_id=?', [uid]))[0][0];
const FLOW = { applied: ['shortlisted', 'rejected'], shortlisted: ['interview_scheduled', 'rejected'], interview_scheduled: ['interview_completed'], interview_completed: ['selected', 'rejected'] };

r.post('/drives', async (req, res) => {
  const c = await company(req.user.id), b = req.body;
  if (!b.job_role || !b.eligible_branches || !b.deadline) return res.status(400).json({ error: 'job_role, eligible_branches, deadline required' });
  const [d] = await db.query('INSERT INTO drives(company_id,job_role,description,eligible_branches,min_cgpa,max_backlogs,grad_year,package_lpa,deadline) VALUES(?,?,?,?,?,?,?,?,?)',
    [c.id, b.job_role, b.description, b.eligible_branches, b.min_cgpa ?? 0, b.max_backlogs ?? 0, b.grad_year, b.package_lpa, b.deadline]);
  for (const s of b.skills || []) await db.query('INSERT IGNORE INTO drive_skills VALUES(?,?)', [d.insertId, s.trim()]);
  res.status(201).json({ id: d.insertId });
});
const owned = `FROM applications a JOIN drives d ON d.id=a.drive_id JOIN companies c ON c.id=d.company_id JOIN students s ON s.user_id=a.student_id JOIN users u ON u.id=s.user_id WHERE c.user_id=?`;
r.get('/applicants', async (req, res) => { // no password/token fields selected
  const f = [req.user.id]; let w = '';
  if (req.query.status) { w += ' AND a.status=?'; f.push(req.query.status); }
  if (req.query.branch) { w += ' AND s.branch=?'; f.push(req.query.branch); }
  if (req.query.min_cgpa) { w += ' AND s.cgpa>=?'; f.push(+req.query.min_cgpa); }
  if (req.query.q) { w += ' AND u.full_name LIKE ?'; f.push(`%${req.query.q}%`); }
  const [rows] = await db.query(`SELECT a.id,a.student_id,u.full_name,s.branch,s.cgpa,s.backlogs,s.grad_year,d.job_role,a.status ${owned}${w}`, f);
  if (req.query.format === 'csv') {
    res.type('text/csv').send(['name,branch,cgpa,backlogs,grad_year,role,status', ...rows.map(x => [x.full_name, x.branch, x.cgpa, x.backlogs, x.grad_year, x.job_role, x.status].map(csvSafe).map(v => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n'));
  } else res.json(rows);
});
r.post('/applications/status', async (req, res) => { // bulk; every id verified as belonging to this recruiter
  const { ids = [], status } = req.body; let done = 0, skipped = [];
  for (const id of ids) {
    const [[a]] = await db.query(`SELECT a.id,a.status,a.student_id,d.job_role ${owned} AND a.id=?`, [req.user.id, id]);
    if (!a || !(FLOW[a.status] || []).includes(status)) { skipped.push(id); continue; }
    await db.query('UPDATE applications SET status=? WHERE id=?', [status, id]);
    await db.query('INSERT INTO notifications(user_id,message) VALUES(?,?)', [a.student_id, `${a.job_role}: status changed to ${status.replace('_', ' ')}`]);
    done++;
  }
  res.json({ updated: done, skipped });
});
r.post('/applications/:id/interview', async (req, res) => {
  const [[a]] = await db.query(`SELECT a.id,a.status,a.student_id ${owned} AND a.id=?`, [req.user.id, req.params.id]);
  if (!a || a.status !== 'shortlisted') return res.status(409).json({ error: 'Application must be shortlisted and yours' });
  await db.query('INSERT INTO interviews(application_id,scheduled_at,mode) VALUES(?,?,?)', [a.id, req.body.scheduled_at, req.body.mode || 'online']);
  await db.query("UPDATE applications SET status='interview_scheduled' WHERE id=?", [a.id]);
  await db.query('INSERT INTO notifications(user_id,message) VALUES(?,?)', [a.student_id, `Interview scheduled for ${req.body.scheduled_at}`]);
  res.status(201).json({ ok: true });
});
module.exports = r;
