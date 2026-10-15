import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate } from 'react-router-dom';
import { api, useApi, errMsg } from './api.js';
import * as P from './pages.jsx';
const Ctx = createContext(); export const useAuth = () => useContext(Ctx);
export const ToastCtx = createContext(() => {}); export const useToast = () => useContext(ToastCtx);

function Bell() {
  const [open, setOpen] = useState(false); const { data, reload } = useApi('/notifications');
  useEffect(() => { const t = setInterval(reload, 30000); return () => clearInterval(t); }, [reload]);
  const read = async id => { await api.post('/notifications/read', id ? { id } : {}); reload(); };
  return <div className="bell"><button onClick={() => setOpen(!open)} aria-label="Notifications">🔔{data?.unread > 0 && <span className="badge">{data.unread}</span>}</button>
    {open && <div className="dropdown"><div className="row"><b>Notifications</b><button className="link" onClick={() => read()}>Mark all read</button></div>
      {!data?.items.length && <p className="muted">No notifications yet.</p>}
      {data?.items.map(n => <div key={n.id} className={'note ' + (n.is_read ? '' : 'unread')} onClick={() => !n.is_read && read(n.id)}>{n.message}<small>{new Date(n.created_at).toLocaleString()}</small></div>)}</div>}</div>;
}
const NAV = {
  student: [['', 'Dashboard'], ['profile', 'Profile'], ['drives', 'Drives'], ['compare', 'Compare'], ['resume', 'Resume'], ['prep', 'Interview Prep'], ['calendar', 'Calendar'], ['roadmap', 'Roadmap']],
  recruiter: [['', 'Applicants & Drives'], ['calendar', 'Calendar']], admin: [['', 'Analytics'], ['reports', 'Reports']] };
function Shell({ role, children }) {
  const { user, logout } = useAuth(); const [menu, setMenu] = useState(false);
  return <div className="shell"><aside className={menu ? 'side open' : 'side'}><h3>🎓 Placement Portal</h3>
    {NAV[role].map(([p, l]) => <NavLink key={p} end to={`/${role}/${p}`} onClick={() => setMenu(false)}>{l}</NavLink>)}</aside>
    <div className="main"><header><button className="burger" onClick={() => setMenu(!menu)}>☰</button><span>{user.name} <span className="tag">{role}</span></span><span className="row"><Bell /><button className="btn sm" onClick={logout}>Logout</button></span></header>
      <section>{children}</section></div></div>;
}
function Guard({ role, children }) { const { user } = useAuth(); return !user ? <Navigate to="/login" /> : user.role !== role ? <Navigate to={`/${user.role}/`} /> : <Shell role={role}>{children}</Shell>; }

export default function App() {
  const nav = useNavigate(); const [toast, setToast] = useState(null);
  const [user, setUser] = useState(() => localStorage.token ? { role: localStorage.role, name: localStorage.name } : null);
  const login = d => { localStorage.token = d.token; localStorage.role = d.role; localStorage.name = d.name || ''; setUser({ role: d.role, name: d.name || '' }); nav(`/${d.role}/`); };
  const logout = () => { localStorage.clear(); setUser(null); nav('/'); };
  const show = (m, bad) => { setToast({ m, bad }); setTimeout(() => setToast(null), 3500); };
  const S = (path, el) => <Route path={path} element={el} />;
  return <Ctx.Provider value={{ user, login, logout }}><ToastCtx.Provider value={show}>
    {toast && <div className={'toast ' + (toast.bad ? 'bad' : '')}>{toast.m}</div>}
    <Routes>
      <Route path="/" element={<P.Landing />} /><Route path="/login" element={<P.Auth mode="login" />} /><Route path="/register" element={<P.Auth mode="register" />} />
      {S('/student/', <Guard role="student"><P.StudentDash /></Guard>)}{S('/student/profile', <Guard role="student"><P.Profile /></Guard>)}
      {S('/student/drives', <Guard role="student"><P.Drives /></Guard>)}{S('/student/compare', <Guard role="student"><P.Compare /></Guard>)}
      {S('/student/resume', <Guard role="student"><P.Resume /></Guard>)}{S('/student/prep', <Guard role="student"><P.Prep /></Guard>)}
      {S('/student/calendar', <Guard role="student"><P.Calendar /></Guard>)}{S('/student/roadmap', <Guard role="student"><P.Roadmap /></Guard>)}
      {S('/recruiter/', <Guard role="recruiter"><P.Recruiter /></Guard>)}{S('/recruiter/calendar', <Guard role="recruiter"><P.Calendar /></Guard>)}
      {S('/admin/', <Guard role="admin"><P.Admin /></Guard>)}{S('/admin/reports', <Guard role="admin"><P.Reports /></Guard>)}
      <Route path="*" element={<Navigate to="/" />} /></Routes></ToastCtx.Provider></Ctx.Provider>;
}
