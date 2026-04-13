const BASE = "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("hr_token");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message || "Request failed"), { status: res.status });
  }
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────
export const auth = {
  login:     (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me:        () => request("/auth/me"),
  updateMe:  (data) => request("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  logout:    () => {
    localStorage.removeItem("hr_token");
    window.location.href = "/login";
  },
};

// ─── Jobs ────────────────────────────────────────────────────
export const jobs = {
  list:   ()         => request("/jobs"),
  get:    (id)       => request(`/jobs/${id}`),
  create: (data)     => request("/jobs",      { method: "POST",   body: JSON.stringify(data) }),
  update: (id, data) => request(`/jobs/${id}`, { method: "PUT",    body: JSON.stringify(data) }),
  delete: (id)       => request(`/jobs/${id}`, { method: "DELETE" }),
};

// ─── Applicants ──────────────────────────────────────────────
export const applicants = {
  list:        ()           => request("/applicants"),
  listByJob:   (jobId)      => request(`/applicants?job_id=${jobId}`),
  get:         (id)         => request(`/applicants/${id}`),
  create:      (data)       => request("/applicants",      { method: "POST",   body: JSON.stringify(data) }),
  bulkCreate:  (data)       => request("/applicants/bulk", { method: "POST",   body: JSON.stringify({ applicants: data }) }),
  update:      (id, data)   => request(`/applicants/${id}`, { method: "PUT",   body: JSON.stringify(data) }),
  delete:      (id)         => request(`/applicants/${id}`, { method: "DELETE" }),
};

// ─── Screening Results ────────────────────────────────────────
export const results = {
  list:              ()            => request("/results"),
  listByJob:         (jobId)       => request(`/results?job_id=${jobId}`),
  listByApplicant:   (applicantId) => request(`/results?applicant_id=${applicantId}`),
  create:            (data)        => request("/results",                  { method: "POST",   body: JSON.stringify(data) }),
  bulkCreate:        (data)        => request("/results/bulk",             { method: "POST",   body: JSON.stringify({ results: data }) }),
  deleteByJob:       (jobId)       => request(`/results/by-job/${jobId}`,          { method: "DELETE" }),
  deleteByApplicant: (applicantId) => request(`/results/by-applicant/${applicantId}`, { method: "DELETE" }),
};

// ─── AI Screening ─────────────────────────────────────────────
export const screening = {
  run: (jobId, weights) =>
    request("/screen", { method: "POST", body: JSON.stringify({ job_id: jobId, weights }) }),
};

// ─── File Upload ──────────────────────────────────────────────
// NOTE: JSON files are handled entirely client-side in ApplicantUpload.jsx
// and JobForm.jsx using the API for normalization.
export const uploads = {
  parseCandidates: async (file, jobId) => {
    const formData = new FormData();
    formData.append("file", file);
    if (jobId) formData.append("job_id", jobId);
    const token = localStorage.getItem("hr_token");
    const res = await fetch(`${BASE}/upload/candidates`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  parseJobs: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("hr_token");
    const res = await fetch(`${BASE}/upload/jobs`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
};
