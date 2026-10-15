// Pure, rule-based logic (no DB) so it is testable and explainable in viva.
const norm = s => String(s).trim().toLowerCase();

function checkEligibility(st, d, now = new Date()) {
  const passed = [], failed = [];
  const rule = (ok, okMsg, failMsg) => (ok ? passed : failed).push(ok ? okMsg : failMsg);
  const branches = d.eligible_branches.split(',').map(norm);
  rule(branches.includes(norm(st.branch)), `Branch ${st.branch} is eligible`, `Branch ${st.branch} not in [${d.eligible_branches}]`);
  rule(+st.cgpa >= +d.min_cgpa, `CGPA ${st.cgpa} >= ${d.min_cgpa}`, `CGPA ${st.cgpa} is below required ${d.min_cgpa}`);
  rule(+st.backlogs <= +d.max_backlogs, `Backlogs ${st.backlogs} <= ${d.max_backlogs}`, `Backlogs ${st.backlogs} exceed allowed ${d.max_backlogs}`);
  rule(+st.grad_year === +d.grad_year, `Graduation year ${d.grad_year} matches`, `Drive is for ${d.grad_year} batch, you graduate in ${st.grad_year}`);
  const open = d.status === 'open' && new Date(d.deadline) >= new Date(now.toDateString());
  rule(open, 'Drive is open', 'Drive is closed or deadline has passed');
  return { eligible: failed.length === 0, passed, failed, canApply: failed.length === 0 };
}

function skillGap(studentSkills, required) {
  const have = new Set(studentSkills.map(norm));
  const matched = required.filter(s => have.has(norm(s)));
  const missing = required.filter(s => !have.has(norm(s)));
  const percent = required.length ? Math.round(100 * matched.length / required.length) : 100;
  return { matched, missing, percent, priorities: missing.slice() };
}

// Weights: branch 20, cgpa 20, year 15, backlogs 15, skills 30 (sum 100). Transparent, NOT machine learning.
function matchScore(st, d, studentSkills, required) {
  const e = checkEligibility(st, d), g = skillGap(studentSkills, required);
  const has = t => e.passed.some(p => p.startsWith(t));
  const score = (has('Branch') ? 20 : 0) + (has('CGPA') ? 20 : 0) + (has('Graduation') ? 15 : 0) + (has('Backlogs') ? 15 : 0) + Math.round(0.3 * g.percent);
  return { score, eligible: e.eligible, ...g, explanation: `${e.passed.length}/5 mandatory criteria met; skill match ${g.percent}%.` };
}

// Rule-based readiness indicator (not a prediction of placement).
function readiness(st, skills, hasResume, avgSkillPct) {
  const fields = [st.college_id, st.branch, st.cgpa, st.grad_year, st.phone, skills.length ? 1 : 0];
  const profile = Math.round(20 * fields.filter(Boolean).length / fields.length);
  const academic = (+st.cgpa >= 6 ? 15 : 7) + (+st.backlogs === 0 ? 10 : 0);
  const skillsScore = Math.round(30 * avgSkillPct / 100);
  const resume = hasResume ? 25 : 0;
  return { total: profile + academic + skillsScore + resume, components: { profile: `${profile}/20`, academic: `${academic}/25`, skills: `${skillsScore}/30`, resume: `${resume}/25` } };
}
const csvSafe = v => { v = String(v ?? ''); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
module.exports = { checkEligibility, skillGap, matchScore, readiness, csvSafe };
