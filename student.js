const r = require('express').Router(), db = require('../config/db'), { auth, role } = require('../middleware/auth');
const E = require('../services/eligibility');
r.use(auth, role('student'));
const notify = (uid, msg) => db.query('INSERT INTO notifications(user_id,message) VALUES(?,?)', [uid, msg]);

async function load(uid) {
  const [[st]] = await db.query('SELECT * FROM students WHERE user_id=?', [uid]);
  const [sk] = await db.query('SELECT skill FROM student_skills WHERE student_id=?', [uid]);
  return { st, skills: sk.map(x => x.skill) };
}
const driveSkills = async id => (await db.query('SELECT skill FROM drive_skills WHERE drive_id=?', [id]))[0].map(x => x.skill);

r.put('/profile', async (req, res) => {
  const { college_id, branch, cgpa, grad_year, backlogs, phone, skills = [] } = req.body;
  if (cgpa < 0 || cgpa > 10 || backlogs < 0) return res.status(400).json({ error: 'Invalid CGPA or backlogs' });
  await db.query('UPDATE students SET college_id=?,branch=?,cgpa=?,grad_year=?,backlogs=?,phone=? WHERE user_id=?', [college_id, branch, cgpa, grad_year, backlogs, phone, req.user.id]);
  await db.query('DELETE FROM student_skills WHERE student_id=?', [req.user.id]);
  for (const s of [...new Set(skills.map(x => String(x).trim()).filter(Boolean))]) await db.query('INSERT INTO student_skills VALUES(?,?)', [req.user.id, s]);
  res.json({ ok: true });
});
r.get('/drives/:id/eligibility', async (req, res) => {
  const { st, skills } = await load(req.user.id);
  const [[d]] = await db.query('SELECT * FROM drives WHERE id=?', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'Drive not found' });
  res.json({ ...E.checkEligibility(st, d), skillGap: E.skillGap(skills, await driveSkills(d.id)) });
});
r.get('/recommendations', async (req, res) => {
  const { st, skills } = await load(req.user.id);
  const [ds] = await db.query("SELECT d.*,c.name company FROM drives d JOIN companies c ON c.id=d.company_id WHERE d.status='open' AND d.deadline>=CURDATE()");
  const out = [];
  for (const d of ds) out.push({ drive_id: d.id, company: d.company, role: d.job_role, ...E.matchScore(st, d, skills, await driveSkills(d.id)) });
  res.json(out.sort((a, b) => b.score - a.score));
});
r.post('/apply/:driveId', async (req, res) => { // eligibility ALWAYS re-checked server-side
  const { st, skills } = await load(req.user.id);
  const [[d]] = await db.query('SELECT d.*,c.user_id recruiter FROM drives d JOIN companies c ON c.id=d.company_id WHERE d.id=?', [req.params.driveId]);
  if (!d) return res.status(404).json({ error: 'Drive not found' });
  const e = E.checkEligibility(st, d);
  if (!e.eligible) return res.status(422).json({ error: 'Not eligible', reasons: e.failed });
  try { await db.query('INSERT INTO applications(student_id,drive_id) VALUES(?,?)', [req.user.id, d.id]); }
  catch (x) { if (x.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Already applied' }); throw x; }
  await notify(req.user.id, `Application submitted for ${d.job_role}`);
  await notify(d.recruiter, `New applicant for ${d.job_role}`);
  res.status(201).json({ ok: true });
});
r.get('/applications', async (req, res) => {
  const [a] = await db.query(`SELECT a.id,a.status,a.applied_at,a.updated_at,d.job_role,c.name company,
    (SELECT MIN(scheduled_at) FROM interviews i WHERE i.application_id=a.id AND i.scheduled_at>NOW()) next_interview
    FROM applications a JOIN drives d ON d.id=a.drive_id JOIN companies c ON c.id=d.company_id WHERE a.student_id=? ORDER BY a.applied_at DESC`, [req.user.id]);
  res.json(a);
});
r.get('/readiness', async (req, res) => {
  const { st, skills } = await load(req.user.id);
  const [ds] = await db.query("SELECT id FROM drives WHERE status='open'");
  let sum = 0; for (const d of ds) sum += E.skillGap(skills, await driveSkills(d.id)).percent;
  res.json({ ...E.readiness(st, skills, !!st.resume_path, ds.length ? sum / ds.length : 0), note: 'Rule-based indicator, not a placement prediction.' });
});
module.exports = r;
