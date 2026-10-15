const r = require('express').Router(), db = require('../config/db'), { auth, role } = require('../middleware/auth');
const E = require('../services/eligibility'), multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const dir = path.join(__dirname, '..', 'uploads');
const up = multer({ storage: multer.diskStorage({ destination: dir, filename: (q, f, cb) => cb(null, crypto.randomUUID() + '.pdf') }),
  limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, f.mimetype === 'application/pdf') }).single('resume');
const S = [auth, role('student')];
const skillsOf = async id => (await db.query('SELECT skill FROM student_skills WHERE student_id=?', [id]))[0].map(x => x.skill);
const dSkills = async id => (await db.query('SELECT skill FROM drive_skills WHERE drive_id=?', [id]))[0].map(x => x.skill);
const stud = async id => (await db.query('SELECT * FROM students WHERE user_id=?', [id]))[0][0];
const isPdf = f => { const fd = fs.openSync(f, 'r'), b = Buffer.alloc(5); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === '%PDF-'; };

r.get('/student/profile', S, async (req, res) => {
  const [[u]] = await db.query('SELECT full_name,email FROM users WHERE id=?', [req.user.id]);
  res.json({ ...u, ...(await stud(req.user.id)), skills: await skillsOf(req.user.id) });
});
// ---- Resume ----
r.post('/student/resume', S, (req, res) => up(req, res, async err => {
  if (err || !req.file) return res.status(400).json({ error: err ? err.message : 'Upload a PDF file (max 2 MB)' });
  if (!isPdf(req.file.path)) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'File is not a valid PDF' }); }
  const s = await stud(req.user.id);
  if (s.resume_path) fs.rm(path.join(dir, path.basename(s.resume_path)), () => {});
  await db.query('UPDATE students SET resume_path=? WHERE user_id=?', [req.file.filename, req.user.id]);
  res.status(201).json({ ok: true });
}));
r.get('/student/resume/analysis', S, async (req, res) => {
  const s = await stud(req.user.id), tips = [];
  if (!s.resume_path) return res.json({ exists: false, suggestions: ['Upload your resume as a PDF.'] });
  const f = path.join(dir, path.basename(s.resume_path)), size = fs.statSync(f).size, valid = isPdf(f);
  if (!valid) tips.push('File header is not a valid PDF; re-upload.');
  if (size < 20 * 1024) tips.push('File is very small; check it is not blank or image-only.');
  tips.push('Make sure Education, Skills and Projects sections are clearly present and your listed skills match target drives.');
  res.json({ exists: true, validPdf: valid, sizeKB: Math.round(size / 1024), sizeOk: size <= 2 * 1024 * 1024,
    textAnalysis: 'Not performed: PDF text extraction is not implemented, so section/skill checks cannot be verified automatically.',
    suggestions: tips, disclaimer: 'Basic file checks only; not ATS certification.' });
});
r.get('/resume/:studentId', auth, async (req, res) => { // owner, admin, or recruiter who has an applicant from that student
  const sid = +req.params.studentId; let ok = req.user.role === 'admin' || req.user.id === sid;
  if (!ok && req.user.role === 'recruiter') ok = (await db.query(`SELECT 1 FROM applications a JOIN drives d ON d.id=a.drive_id JOIN companies c ON c.id=d.company_id WHERE a.student_id=? AND c.user_id=? LIMIT 1`, [sid, req.user.id]))[0].length > 0;
  if (!ok) return res.status(403).json({ error: 'Not allowed' });
  const s = await stud(sid); if (!s || !s.resume_path) return res.status(404).json({ error: 'No resume' });
  res.type('application/pdf').sendFile(path.join(dir, path.basename(s.resume_path)));
});
// ---- Interview prep ----
r.get('/student/prep/questions', S, async (req, res) => {
  const c = req.query.category;
  res.json((await db.query(`SELECT id,category,topic,question FROM prep_questions ${c ? 'WHERE category=?' : ''}`, c ? [c] : []))[0]);
});
r.post('/student/prep/answer', S, async (req, res) => {
  const { question_id, answer = '' } = req.body;
  const [[q]] = await db.query('SELECT * FROM prep_questions WHERE id=?', [question_id]);
  if (!q || !answer.trim()) return res.status(400).json({ error: 'Valid question and non-empty answer required' });
  const kws = q.keywords.split(','), low = answer.toLowerCase(), hit = kws.filter(k => low.includes(k.trim()));
  const cov = Math.round(100 * hit.length / kws.length), words = answer.trim().split(/\s+/).length;
  await db.query('INSERT INTO practice_attempts(user_id,question_id,answer,keyword_coverage) VALUES(?,?,?,?)', [req.user.id, q.id, answer, cov]);
  res.json({ keyword_coverage: cov, covered: hit, missed: kws.filter(k => !hit.includes(k)),
    checklist: [{ item: 'Answer has at least 30 words (or is a short numeric answer)', ok: words >= 30 || q.category === 'aptitude' }, { item: 'Covers key concepts', ok: cov >= 60 }],
    disclaimer: 'Rule-based keyword rubric for practice only; not an official or human evaluation.' });
});
r.get('/student/prep/history', S, async (req, res) => {
  const [h] = await db.query(`SELECT p.id,q.category,q.topic,q.question,p.keyword_coverage,p.created_at FROM practice_attempts p JOIN prep_questions q ON q.id=p.question_id WHERE p.user_id=? ORDER BY p.created_at DESC LIMIT 50`, [req.user.id]);
  const [pr] = await db.query(`SELECT q.category,COUNT(DISTINCT p.question_id) done,(SELECT COUNT(*) FROM prep_questions x WHERE x.category=q.category) total FROM practice_attempts p JOIN prep_questions q ON q.id=p.question_id WHERE p.user_id=? GROUP BY q.category`, [req.user.id]);
  res.json({ history: h, progress: pr });
});
// ---- Compare ----
r.get('/student/compare', S, async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean).slice(0, 4);
  if (ids.length < 2) return res.status(400).json({ error: 'Choose 2-4 drives' });
  const s = await stud(req.user.id), mine = await skillsOf(req.user.id), out = [];
  for (const id of ids) {
    const [[d]] = await db.query('SELECT d.*,c.name company FROM drives d JOIN companies c ON c.id=d.company_id WHERE d.id=?', [id]); if (!d) continue;
    const req_ = await dSkills(id), e = E.checkEligibility(s, d);
    out.push({ ...d, requiredSkills: req_, eligible: e.eligible, reasons: e.failed, skillMatch: E.skillGap(mine, req_) });
  }
  res.json(out);
});
// ---- Roadmap (rule-based; each step has a reason from real data) ----
r.get('/student/roadmap', S, async (req, res) => {
  const s = await stud(req.user.id), mine = await skillsOf(req.user.id), steps = [];
  const missing = ['college_id', 'branch', 'cgpa', 'grad_year', 'phone'].filter(k => !s[k]);
  if (missing.length || !mine.length) steps.push({ step: 'Complete your profile', why: `Missing: ${[...missing, ...(mine.length ? [] : ['skills'])].join(', ')}. Eligibility needs these.` });
  if (!s.resume_path) steps.push({ step: 'Upload your resume (PDF)', why: 'No resume on file.' });
  const [ds] = await db.query("SELECT d.*,c.name company FROM drives d JOIN companies c ON c.id=d.company_id WHERE d.status='open' AND d.deadline>=CURDATE() ORDER BY d.deadline");
  const freq = {}, applied = new Set((await db.query('SELECT drive_id FROM applications WHERE student_id=?', [req.user.id]))[0].map(a => a.drive_id));
  for (const d of ds) {
    for (const m of E.skillGap(mine, await dSkills(d.id)).missing) freq[m] = (freq[m] || 0) + 1;
    if (s.branch && !applied.has(d.id) && E.checkEligibility(s, d).eligible) steps.push({ step: `Apply to ${d.company} – ${d.job_role}`, why: `You are eligible; deadline ${new Date(d.deadline).toDateString()}.` });
  }
  Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([k, n]) => steps.splice(2, 0, { step: `Improve ${k}`, why: `Required by ${n} open drive(s) and missing from your skills.` }));
  const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM practice_attempts WHERE user_id=?', [req.user.id]);
  if (n < 5) steps.push({ step: 'Practise interview questions', why: `You have ${n} practice attempt(s) recorded.` });
  res.json({ steps, disclaimer: 'Suggestions from your data; no guarantee of placement.' });
});
// ---- Calendar (role-scoped) ----
r.get('/calendar', auth, async (req, res) => {
  const ev = [], u = req.user;
  const own = u.role === 'recruiter' ? 'AND c.user_id=?' : '', p = u.role === 'recruiter' ? [u.id] : [];
  const [ds] = await db.query(`SELECT d.deadline,d.job_role,c.name FROM drives d JOIN companies c ON c.id=d.company_id WHERE d.status='open' AND d.deadline>=CURDATE() ${own}`, p);
  ds.forEach(d => ev.push({ date: d.deadline, type: 'deadline', title: `Deadline: ${d.name} – ${d.job_role}` }));
  const [iv] = await db.query(`SELECT i.scheduled_at,i.mode,d.job_role,c.name,uu.full_name FROM interviews i JOIN applications a ON a.id=i.application_id JOIN drives d ON d.id=a.drive_id JOIN companies c ON c.id=d.company_id JOIN users uu ON uu.id=a.student_id WHERE i.scheduled_at>=NOW() ${u.role === 'student' ? 'AND a.student_id=?' : own}`, u.role === 'student' ? [u.id] : p);
  iv.forEach(i => ev.push({ date: i.scheduled_at, type: 'interview', title: `Interview (${i.mode}): ${i.name} – ${i.job_role}${u.role !== 'student' ? ' / ' + i.full_name : ''}` }));
  res.json(ev.sort((a, b) => new Date(a.date) - new Date(b.date)));
});
// ---- Admin reports ----
const REP = {
  'placement-summary': `SELECT s.branch,COUNT(*) students,COUNT(DISTINCT CASE WHEN a.status='selected' THEN s.user_id END) placed FROM students s LEFT JOIN applications a ON a.student_id=s.user_id WHERE (? IS NULL OR s.branch=?) GROUP BY s.branch`,
  'company-hiring': `SELECT c.name company,COUNT(a.id) applications,SUM(a.status='selected') selected FROM companies c LEFT JOIN drives d ON d.company_id=c.id LEFT JOIN applications a ON a.drive_id=d.id GROUP BY c.name`,
  'drive-applications': `SELECT d.id drive_id,c.name company,d.job_role,COUNT(a.id) applications FROM drives d JOIN companies c ON c.id=d.company_id LEFT JOIN applications a ON a.drive_id=d.id GROUP BY d.id,c.name,d.job_role`,
  'selection-rejection': `SELECT s.branch,SUM(a.status='selected') selected,SUM(a.status='rejected') rejected FROM applications a JOIN students s ON s.user_id=a.student_id WHERE (? IS NULL OR s.branch=?) GROUP BY s.branch` };
r.get('/admin/reports/:type', auth, role('admin'), async (req, res) => {
  const sql = REP[req.params.type]; if (!sql) return res.status(404).json({ error: 'Unknown report' });
  const b = req.query.branch || null, [rows] = await db.query(sql, sql.includes('?') ? [b, b] : []);
  if (req.query.format !== 'csv') return res.json(rows);
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  res.type('text/csv').send([cols.join(','), ...rows.map(x => cols.map(k => `"${E.csvSafe(x[k]).replace(/"/g, '""')}"`).join(','))].join('\n'));
});
module.exports = r;
