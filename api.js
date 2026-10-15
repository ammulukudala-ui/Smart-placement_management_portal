import axios from 'axios'; import { useState, useEffect, useCallback } from 'react';
export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
export const errMsg = e => e?.response?.data?.error || e?.response?.data?.errors?.join(', ') || (e?.response?.data?.reasons || []).join('; ') || e.message;
export function useApi(url) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => { if (!url) return; set(x => ({ ...x, loading: true })); api.get(url).then(r => set({ data: r.data, error: null, loading: false })).catch(e => set({ data: null, error: errMsg(e), loading: false })); }, [url]);
  useEffect(load, [load]); return { ...s, reload: load };
}
export async function download(url, name) { const r = await api.get(url, { responseType: 'blob' }); const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = name; a.click(); }
