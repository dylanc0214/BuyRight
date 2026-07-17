const BASE = import.meta.env.VITE_API_BASE || '';

function authHeaders() {
  const token = localStorage.getItem('br_token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'request_failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const get   = (path)        => req('GET',   path);
const post  = (path, body)  => req('POST',  path, body);
const patch = (path, body)  => req('PATCH', path, body);

export const registerApi = (body) => post('/api/auth/register', body);
export const loginApi    = (body) => post('/api/auth/login', body);
export const getMe       = ()     => get('/api/auth/me');

export const getCars = (params = {}) =>
  get(`/api/cars?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)))}`);
export const getCar  = (id) => get(`/api/cars/${id}`);

export const postChat = (body) => post('/api/chat', body);

export const getSellEstimate  = (params)     => get(`/api/submissions/estimate?${new URLSearchParams(params)}`);
export const createSubmission = (body)       => post('/api/submissions', body);
export const getMySubmissions = ()           => get('/api/submissions/mine');
export const bookInspection   = (id, body)   => post(`/api/submissions/${id}/inspection`, body);

export const respondToOffer = (id, decision) => patch(`/api/offers/${id}/respond`, { decision });

export const createEnquiry  = (body) => post('/api/enquiries', body);
export const getMyEnquiries = ()     => get('/api/enquiries/mine');

export const adminOverview         = ()       => get('/api/admin/overview');
export const adminGetSubmissions   = ()       => get('/api/admin/submissions');
export const adminUpdateSubmission = (id, b)  => patch(`/api/admin/submissions/${id}`, b);
export const adminGetInspections   = ()       => get('/api/admin/inspections');
export const adminUpdateInspection = (id, b)  => patch(`/api/admin/inspections/${id}`, b);
export const adminSendOffer        = (body)   => post('/api/admin/offers', body);
export const adminGetBuyers        = ()       => get('/api/admin/buyers');
export const adminGetEnquiries     = ()       => get('/api/admin/enquiries');
export const adminUpdateEnquiry    = (id, b)  => patch(`/api/admin/enquiries/${id}`, b);
export const adminGetCars          = ()       => get('/api/admin/cars');
export const adminAddCar           = (body)   => post('/api/admin/cars', body);
export const adminUpdateCar        = (id, b)  => patch(`/api/admin/cars/${id}`, b);
