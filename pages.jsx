import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, useApi, errMsg, download } from './api.js';
import { useAuth, useToast } from './App.jsx';

const FLOW = ['applied', 'shortlisted', 'interview_scheduled', 'interview_completed', 'selected'];
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];
const fd = d => d ? new Date(d).toLocaleDateString() : '-';
function Async({ q, empty, children }) {
  if (q.loading) return <p className="muted">Loading…</p>;
  if (q.error) return <p className="err">⚠ {q.error} <button className="link" onClick={q.reload}>Retry</button></p>;
  if (empty && (!q.data || (Array.isArray(q.data) && !q.data.length))) return <p className="muted">{empty}</p>;
  return children(q.data);
}
const Bar_ = ({ v }) => <div className="bar"><i style={{ width: Math.min(100, v) + '%' }} /></div>;
const Modal = ({ onClose, children }) => <div className="modal" onClick={onClose}><div onClick={e => e.stopPropagation()}>{children}<p><button className="btn alt sm" onClick={onClose}>Close</button></p></div></div>;
const Field = ({ label, ...p }) => <><label>{label}</label><input {...p} /></>;

export function Landing() {
  return <><div className="hero"><h1>Smart Placement Management Portal</h1><p>One platform for students, recruiters and placement officers – transparent eligibility, skill-gap insights and live analytics.</p>
    <Link className="btn" style={{ background: '#fff', color: '#1d4ed8' }} to="/register">Get started</Link> <Link className="btn alt" to="/login">Login</Link></div>
    <div className="land grid">{[['Students', 'Check eligibility with clear reasons, see skill gaps, track every application, practise interviews.'], ['Recruiters', 'Post drives, filter applicants, shortlist in bulk, schedule interviews, export CSV.'], ['Placement Officers', 'Database-driven analytics and reports across branches and companies.']].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p className="muted">{d}</p></div>)}</div></>;
}
export function Auth({ mode }) {
  const { login } = useAuth(), toast = useToast(), nav = useNavigate(); const [f, setF] = useState({ role: 'student' }); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); setBusy(true); try {
    const r = await api.post('/auth/' + mode, f); login({ ...r.data, name: r.data.name || f.full_name }); } catch (x) { toast(errMsg(x), true); } setBusy(false); };
  return <form className="card auth" onSubmit={submit}><h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
    {mode === 'register' && <><label>I am a</label><select value={f.role} onChange={set('role')}><option value="student">Student</option><option value="recruiter">Recruiter</option></select>
      <Field label="Full name" required onChange={set('full_name')} />{f.role === 'recruiter' && <Field label="Company name" required onChange={set('company_name')} />}</>}
    <Field label="Email" type="email" required onChange={set('email')} /><Field label="Password (8+ chars, letter + number)" type="password" required onChange={set('password')} />
    <p><button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button></p>
    <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}</Link></form>;
}

export function StudentDash() {
  const rd = useApi('/student/readiness'), rec = useApi('/student/recommendations'), ap = useApi('/student/applications');
  return <><h2>Student Dashboard</h2>
    <div className="card"><h3>Placement Readiness</h3><Async q={rd}>{d => <><div className="big">{d.total}/100</div><Bar_ v={d.total} />
      <p className="muted">{Object.entries(d.components).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p><small className="muted">{d.note}</small></>}</Async></div>
    <div className="card"><h3>Recommended drives</h3><Async q={rec} empty="No open drives yet.">{d => d.slice(0, 5).map(x => <div key={x.drive_id} className="row card"><div><b>{x.role}</b> – {x.company}<br /><small className="muted">{x.explanation} Matching: {x.matched.join(', ') || 'none'} · Missing: {x.missing.join(', ') || 'none'}</small></div>
      <div><span className="big">{x.score}%</span> <span className={'tag ' + (x.eligible ? 'ok' : 'no')}>{x.eligible ? 'Eligible' : 'Not eligible'}</span></div></div>)}</Async></div>
    <div className="card"><h3>My applications</h3><Async q={ap} empty="You have not applied yet. Browse Drives.">{d => d.map(a => <div key={a.id} className="card"><b>{a.job_role}</b> – {a.company} <small className="muted">applied {fd(a.applied_at)}, updated {fd(a.updated_at)}</small>
      <div className="steps">{FLOW.map(s => <span key={s} className={FLOW.indexOf(s) <= FLOW.indexOf(a.status) ? 'on' : ''}>{s.replace('_', ' ')}</span>)}{a.status === 'rejected' && <span className="on" style={{ background: '#dc2626' }}>rejected</span>}</div>
      {a.next_interview && <p>Next interview: {new Date(a.next_interview).toLocaleString()}</p>}</div>)}</Async></div></>;
}
export function Profile() {
  const toast = useToast(), q = useApi('/student/profile'); const [f, setF] = useState(null);
  const v = f || (q.data && { ...q.data, skills: (q.data.skills || []).join(', ') });
  const save = async e => { e.preventDefault(); try { await api.put('/student/profile', { ...v, skills: String(v.skills).split(',').map(s => s.trim()).filter(Boolean) }); toast('Profile saved'); q.reload(); } catch (x) { toast(errMsg(x), true); } };
  const set = k => e => setF({ ...v, [k]: e.target.value });
  return <><h2>Profile</h2><Async q={q}>{() => <form className="card" onSubmit={save}>
    {[['college_id', 'College ID'], ['branch', 'Branch (e.g. CSE)'], ['cgpa', 'CGPA'], ['grad_year', 'Graduation year'], ['backlogs', 'Backlogs'], ['phone', 'Phone'], ['skills', 'Skills (comma separated)']].map(([k, l]) => <Field key={k} label={l} value={v[k] ?? ''} onChange={set(k)} />)}
    <p><button className="btn">Save</button></p></form>}</Async></>;
}
export function Drives() {
  const q = useApi('/drives'), toast = useToast(), nav = useNavigate(); const [sel, setSel] = useState([]); const [m, setM] = useState(null);
  const check = async d => { try { setM({ d, ...(await api.get(`/student/drives/${d.id}/eligibility`)).data }); } catch (x) { toast(errMsg(x), true); } };
  const apply = async () => { try { await api.post('/student/apply/' + m.d.id); toast('Applied!'); setM(null); } catch (x) { toast(errMsg(x), true); } };
  return <><div className="row"><h2>Placement Drives</h2><button className="btn" disabled={sel.length < 2} onClick={() => nav('/student/compare?ids=' + sel.join(','))}>Compare selected ({sel.length})</button></div>
    <Async q={q} empty="No drives posted yet.">{d => <div className="card scroll"><table><thead><tr><th></th><th>Company</th><th>Role</th><th>Package</th><th>Min CGPA</th><th>Deadline</th><th></th></tr></thead><tbody>
      {d.map(x => <tr key={x.id}><td><input type="checkbox" style={{ width: 'auto' }} checked={sel.includes(x.id)} onChange={e => setSel(e.target.checked ? [...sel, x.id].slice(-4) : sel.filter(i => i !== x.id))} /></td><td>{x.company}</td><td>{x.job_role}</td><td>{x.package_lpa} LPA</td><td>{x.min_cgpa}</td><td>{fd(x.deadline)}</td><td><button className="btn sm" onClick={() => check(x)}>Check eligibility</button></td></tr>)}</tbody></table></div>}</Async>
    {m && <Modal onClose={() => setM(null)}><h3>{m.d.company} – {m.d.job_role}</h3><span className={'tag ' + (m.eligible ? 'ok' : 'no')}>{m.eligible ? 'Eligible' : 'Not eligible'}</span>
      {m.passed.map(p => <p key={p}>✅ {p}</p>)}{m.failed.map(p => <p key={p} className="err">❌ {p}</p>)}
      <p>Skill match {m.skillGap.percent}% · Missing: {m.skillGap.missing.join(', ') || 'none'}</p><button className="btn" disabled={!m.canApply} onClick={apply}>Apply</button></Modal>}</>;
}
export function Compare() {
  const [sp] = useSearchParams(); const ids = sp.get('ids'); const q = useApi(ids ? '/student/compare?ids=' + ids : null);
  if (!ids) return <><h2>Compare</h2><p className="muted">Select 2–4 drives on the Drives page, then click “Compare selected”.</p></>;
  const rows = [['Role', d => d.job_role], ['Package (LPA)', d => d.package_lpa], ['Min CGPA', d => d.min_cgpa], ['Branches', d => d.eligible_branches], ['Max backlogs', d => d.max_backlogs], ['Required skills', d => d.requiredSkills.join(', ')], ['Deadline', d => fd(d.deadline)],
    ['Eligibility', d => d.eligible ? '✅ Eligible' : '❌ ' + d.reasons.join('; ')], ['Skill match', d => d.skillMatch.percent + '% (missing: ' + (d.skillMatch.missing.join(', ') || 'none') + ')']];
  return <><h2>Compare Drives</h2><Async q={q} empty="Nothing to compare.">{d => <div className="card scroll"><table><thead><tr><th></th>{d.map(x => <th key={x.id}>{x.company}</th>)}</tr></thead><tbody>{rows.map(([l, fn]) => <tr key={l}><th>{l}</th>{d.map(x => <td key={x.id}>{fn(x)}</td>)}</tr>)}</tbody></table></div>}</Async></>;
}
export function Resume() {
  const toast = useToast(), q = useApi('/student/resume/analysis'), { } = useAuth(); const [busy, setBusy] = useState(false);
  const upload = async e => { const file = e.target.files[0]; if (!file) return; const fm = new FormData(); fm.append('resume', file); setBusy(true);
    try { await api.post('/student/resume', fm); toast('Resume uploaded'); q.reload(); } catch (x) { toast(errMsg(x), true); } setBusy(false); };
  const view = async () => { const me = (await api.get('/student/profile')).data; const r = await api.get('/resume/' + me.user_id, { responseType: 'blob' }); window.open(URL.createObjectURL(r.data)); };
  return <><h2>Resume</h2><div className="card"><label>Upload or replace (PDF, max 2 MB)</label><input type="file" accept="application/pdf" onChange={upload} disabled={busy} /></div>
    <div className="card"><h3>Quality checks</h3><Async q={q}>{d => !d.exists ? <p className="muted">{d.suggestions[0]}</p> : <><p>Valid PDF: {d.validPdf ? '✅' : '❌'} · Size: {d.sizeKB} KB {d.sizeOk ? '✅' : '❌'}</p><p className="muted">{d.textAnalysis}</p>
      <ul>{d.suggestions.map(s => <li key={s}>{s}</li>)}</ul><small className="muted">{d.disclaimer}</small><p><button className="btn sm" onClick={() => view().catch(x => toast(errMsg(x), true))}>View resume</button></p></>}</Async></div></>;
}
export function Prep() {
  const toast = useToast(); const [cat, setCat] = useState(''); const q = useApi('/student/prep/questions' + (cat ? '?category=' + cat : '')), h = useApi('/student/prep/history');
  const [cur, setCur] = useState(null), [ans, setAns] = useState(''), [res, setRes] = useState(null);
  const submit = async () => { try { setRes((await api.post('/student/prep/answer', { question_id: cur.id, answer: ans })).data); h.reload(); } catch (x) { toast(errMsg(x), true); } };
  return <><h2>Interview Preparation</h2><div className="row">{['', 'aptitude', 'technical', 'hr'].map(c => <button key={c} className={'btn sm ' + (cat === c ? '' : 'alt')} onClick={() => setCat(c)}>{c || 'all'}</button>)}</div><br />
    <Async q={h}>{d => <div className="grid">{d.progress.map(p => <div className="card" key={p.category}><b>{p.category}</b><Bar_ v={100 * p.done / p.total} /><small>{p.done}/{p.total} practised</small></div>)}</div>}</Async>
    <div className="card"><h3>Questions (practice mode)</h3><Async q={q} empty="No questions. Run npm run seed in backend.">{d => d.map(x => <div className="row" key={x.id}><span><span className="tag">{x.category}</span> {x.topic}: {x.question}</span><button className="btn sm" onClick={() => { setCur(x); setAns(''); setRes(null); }}>Practise</button></div>)}</Async></div>
    <div className="card"><h3>Practice history</h3><Async q={h}>{d => !d.history.length ? <p className="muted">No attempts yet.</p> : <table><tbody>{d.history.map(x => <tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td>{x.topic}</td><td>{x.keyword_coverage}% keyword coverage</td></tr>)}</tbody></table>}</Async></div>
    {cur && <Modal onClose={() => setCur(null)}><h3>{cur.question}</h3><textarea rows="5" value={ans} onChange={e => setAns(e.target.value)} placeholder="Type your answer" /><p><button className="btn" disabled={!ans.trim()} onClick={submit}>Submit for self-review</button></p>
      {res && <><p><b>Keyword coverage {res.keyword_coverage}%</b> · covered: {res.covered.join(', ') || 'none'} · missed: {res.missed.join(', ') || 'none'}</p>{res.checklist.map(c => <p key={c.item}>{c.ok ? '✅' : '⬜'} {c.item}</p>)}<small className="muted">{res.disclaimer}</small></>}</Modal>}</>;
}
export function Calendar() {
  const q = useApi('/calendar');
  return <><h2>Placement Calendar</h2><p className="muted">Agenda view of upcoming deadlines and interviews. In-app only – no email/SMS reminders.</p><Async q={q} empty="No upcoming events.">{d => d.map((e, i) => <div className="card row" key={i}><span>{e.type === 'interview' ? '🎤' : '⏰'} {e.title}</span><b>{new Date(e.date).toLocaleString()}</b></div>)}</Async></>;
}
export function Roadmap() {
  const q = useApi('/student/roadmap');
  return <><h2>Preparation Roadmap</h2><Async q={q} empty="Nothing to suggest right now.">{d => <>{d.steps.map((s, i) => <div className="card" key={i}><b>{i + 1}. {s.step}</b><br /><small className="muted">Why: {s.why}</small></div>)}<small className="muted">{d.disclaimer}</small></>}</Async></>;
}

export function Recruiter() {
  const toast = useToast(); const [f, setF] = useState({}); const [sel, setSel] = useState([]); const [d, setD] = useState({});
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(); const q = useApi('/recruiter/applicants?' + qs);
  const bulk = async status => { if (status === 'rejected' && !window.confirm(`Reject ${sel.length} applicant(s)?`)) return;
    try { const r = (await api.post('/recruiter/applications/status', { ids: sel, status })).data; toast(`Updated ${r.updated}, skipped ${r.skipped.length}`, r.updated === 0); setSel([]); q.reload(); } catch (x) { toast(errMsg(x), true); } };
  const sched = async id => { const t = window.prompt('Interview date/time (YYYY-MM-DD HH:MM)'); if (!t) return; try { await api.post(`/recruiter/applications/${id}/interview`, { scheduled_at: t }); toast('Interview scheduled'); q.reload(); } catch (x) { toast(errMsg(x), true); } };
  const post = async e => { e.preventDefault(); try { await api.post('/recruiter/drives', { ...d, skills: (d.skills || '').split(',').map(s => s.trim()).filter(Boolean) }); toast('Drive created'); setD({}); } catch (x) { toast(errMsg(x), true); } };
  const resume = async id => { try { window.open(URL.createObjectURL((await api.get('/resume/' + id, { responseType: 'blob' })).data)); } catch (x) { toast('No resume available', true); } };
  const sd = k => e => setD({ ...d, [k]: e.target.value }), sf = k => e => setF({ ...f, [k]: e.target.value });
  return <><h2>Recruiter Dashboard</h2>
    <form className="card" onSubmit={post}><h3>Post a drive</h3><div className="grid">{[['job_role', 'Job role'], ['eligible_branches', 'Branches (CSE,IT)'], ['min_cgpa', 'Min CGPA'], ['max_backlogs', 'Max backlogs'], ['grad_year', 'Graduation year'], ['package_lpa', 'Package (LPA)'], ['deadline', 'Deadline', 'date'], ['skills', 'Required skills (comma)']].map(([k, l, t]) => <Field key={k} label={l} type={t || 'text'} value={d[k] || ''} onChange={sd(k)} required={['job_role', 'eligible_branches', 'deadline', 'grad_year'].includes(k)} />)}</div><p><button className="btn">Create drive</button></p></form>
    <div className="card"><h3>Applicants</h3><div className="grid"><Field label="Search name" onChange={sf('q')} /><Field label="Branch" onChange={sf('branch')} /><Field label="Min CGPA" type="number" onChange={sf('min_cgpa')} />
      <div><label>Status</label><select onChange={sf('status')}><option value="">any</option>{[...FLOW, 'rejected'].map(s => <option key={s}>{s}</option>)}</select></div></div><br />
      <div className="row"><button className="btn sm" disabled={!sel.length} onClick={() => bulk('shortlisted')}>Shortlist ({sel.length})</button><button className="btn sm danger" disabled={!sel.length} onClick={() => bulk('rejected')}>Reject</button>
        <button className="btn sm alt" onClick={() => download('/recruiter/applicants?format=csv&' + qs, 'applicants.csv').catch(x => toast(errMsg(x), true))}>Export CSV</button></div>
      <Async q={q} empty="No applicants match.">{rows => <div className="scroll"><table><thead><tr><th></th><th>Name</th><th>Branch</th><th>CGPA</th><th>Backlogs</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(a => <tr key={a.id}>
        <td><input type="checkbox" style={{ width: 'auto' }} checked={sel.includes(a.id)} onChange={e => setSel(e.target.checked ? [...sel, a.id] : sel.filter(i => i !== a.id))} /></td><td>{a.full_name}</td><td>{a.branch}</td><td>{a.cgpa}</td><td>{a.backlogs}</td><td>{a.job_role}</td><td><span className="tag">{a.status}</span></td>
        <td><button className="link" onClick={() => resume(a.student_id)}>Resume</button>{a.status === 'shortlisted' && <button className="link" onClick={() => sched(a.id)}>Schedule</button>}</td></tr>)}</tbody></table></div>}</Async>
      <p className="muted">Bulk actions: Shortlist works on “applied”. For later stages (interview completed → selected/rejected) select rows with that status and use Reject; selection/completion buttons appear below.</p>
      <div className="row"><button className="btn sm alt" disabled={!sel.length} onClick={() => bulk('interview_completed')}>Mark interview completed</button><button className="btn sm" disabled={!sel.length} onClick={() => bulk('selected')}>Mark selected</button></div></div></>;
}
export function Admin() {
  const q = useApi('/admin/analytics');
  return <><h2>Placement Analytics</h2><Async q={q}>{d => { const t = d.totals, top = [...d.byCompany].sort((a, b) => b.hires - a.hires)[0]; return <>
    <div className="grid">{[['Students', t.students], ['Companies', t.companies], ['Drives', t.drives], ['Applications', t.applications], ['Unique students placed', t.placed], ['Rejected', t.rejected], ['Upcoming interviews', t.upcoming_interviews], ['Placement %', t.placement_percentage + '%'], ['Highest LPA', d.packages?.highest ?? '-'], ['Average LPA', d.packages?.average ?? '-']].map(([l, v]) => <div className="card" key={l}><small className="muted">{l}</small><div className="big">{v}</div></div>)}</div>
    <p className="card">💡 {t.students ? `${t.placed} of ${t.students} students (${t.placement_percentage}%) have at least one selection.` : 'No students yet.'} {top ? `Top hiring company: ${top.name} (${top.hires}).` : 'No selections recorded yet.'}</p>
    <div className="grid"><div className="card"><h4>Placed by branch</h4>{d.byBranch.length ? <ResponsiveContainer height={220}><BarChart data={d.byBranch}><XAxis dataKey="branch" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="placed" fill="#2563eb" /></BarChart></ResponsiveContainer> : <p className="muted">No data yet.</p>}</div>
      <div className="card"><h4>Hires by company</h4>{d.byCompany.length ? <ResponsiveContainer height={220}><BarChart data={d.byCompany}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="hires" fill="#16a34a" /></BarChart></ResponsiveContainer> : <p className="muted">No data yet.</p>}</div>
      <div className="card"><h4>Application status</h4>{d.statusDistribution.length ? <ResponsiveContainer height={220}><PieChart><Pie data={d.statusDistribution} dataKey="n" nameKey="status" outerRadius={70}>{d.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % 6]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="muted">No data yet.</p>}</div></div></>; }}</Async>
    <small className="muted">Placed = distinct students with ≥1 selected application. Placement % = placed ÷ total students.</small></>;
}
export function Reports() {
  const toast = useToast(); const [type, setType] = useState('placement-summary'), [branch, setBranch] = useState('');
  const url = `/admin/reports/${type}?` + (branch ? 'branch=' + encodeURIComponent(branch) : ''); const q = useApi(url);
  return <><h2>Reports</h2><div className="card row"><select style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value)}>{['placement-summary', 'company-hiring', 'drive-applications', 'selection-rejection'].map(t => <option key={t}>{t}</option>)}</select>
    <input style={{ width: 160 }} placeholder="Branch filter" value={branch} onChange={e => setBranch(e.target.value)} /><button className="btn" onClick={() => download(url + '&format=csv', type + '.csv').catch(x => toast(errMsg(x), true))}>Export CSV</button></div>
    <Async q={q} empty="No rows for this report.">{d => <div className="card scroll"><table><thead><tr>{Object.keys(d[0]).map(k => <th key={k}>{k}</th>)}</tr></thead><tbody>{d.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table></div>}</Async><small className="muted">Branch filter applies to the placement-summary and selection-rejection reports.</small></>;
}
