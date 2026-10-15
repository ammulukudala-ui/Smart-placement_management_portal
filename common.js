const r = require('express').Router(), db = require('../config/db'), { auth, role } = require('../middleware/auth');
r.get('/drives', auth, async (req, res) => res.json((await db.query("SELECT d.*,c.name company FROM drives d JOIN companies c ON c.id=d.company_id ORDER BY d.deadline"))[0]));
r.get('/notifications', auth, async (req, res) => { // always scoped to the caller
  const [rows] = await db.query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ unread: rows.filter(n => !n.is_read).length, items: rows });
});
r.post('/notifications/read', auth, async (req, res) => {
  if (req.body.id) await db.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.body.id, req.user.id]);
  else await db.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ ok: true });
});
// Admin analytics. "Placed" = DISTINCT students with >=1 selected application (no double counting).
r.get('/admin/analytics', auth, role('admin'), async (req, res) => {
  const q = async s => (await db.query(s))[0];
  const [[t]] = await db.query(`SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM companies) companies,(SELECT COUNT(*) FROM drives) drives,
    (SELECT COUNT(*) FROM applications) applications,(SELECT COUNT(DISTINCT student_id) FROM applications WHERE status='selected') placed,
    (SELECT COUNT(*) FROM applications WHERE status='rejected') rejected,(SELECT COUNT(*) FROM interviews WHERE scheduled_at>NOW()) upcoming_interviews`);
  const pkg = (await q(`SELECT MAX(d.package_lpa) highest,ROUND(AVG(d.package_lpa),2) average FROM applications a JOIN drives d ON d.id=a.drive_id WHERE a.status='selected'`))[0];
  res.json({ totals: { ...t, placement_percentage: t.students ? +(100 * t.placed / t.students).toFixed(1) : 0 }, packages: pkg,
    byBranch: await q(`SELECT s.branch,COUNT(DISTINCT s.user_id) placed FROM applications a JOIN students s ON s.user_id=a.student_id WHERE a.status='selected' GROUP BY s.branch`),
    byCompany: await q(`SELECT c.name,COUNT(*) hires FROM applications a JOIN drives d ON d.id=a.drive_id JOIN companies c ON c.id=d.company_id WHERE a.status='selected' GROUP BY c.name`),
    statusDistribution: await q('SELECT status,COUNT(*) n FROM applications GROUP BY status') });
});
module.exports = r;
