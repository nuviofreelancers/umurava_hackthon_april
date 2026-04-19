const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("hr_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const error = Object.assign(new Error(err.message || "Request failed"), { status: res.status });
    throw error;
  }

  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────
export const auth = {
  login:    (email: string, password: string) =>
    request<{ token: string; user: { id: string; full_name: string; email: string } }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me:       () => request<{ id: string; full_name: string; email: string }>("/auth/me"),
  updateMe: (data: Partial<{ full_name: string; email: string; password: string }>) =>
    request("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  logout: () => {
    localStorage.removeItem("hr_token");
    window.location.href = "/login";
  },
};

// ─── Jobs ────────────────────────────────────────────────────
export const jobs = {
  list:   ()                          => request<unknown[]>("/jobs"),
  get:    (id: string)                => request<unknown>(`/jobs/${id}`),
  create: (data: unknown)             => request<unknown>("/jobs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request<unknown>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string)                => request<unknown>(`/jobs/${id}`, { method: "DELETE" }),
};

// ─── Applicants ──────────────────────────────────────────────
export const applicants = {
  list:       ()                                                         => request<unknown[]>("/applicants"),
  listByJob:  (jobId: string)                                            => request<unknown[]>(`/applicants?job_id=${jobId}`),
  get:        (id: string)                                               => request<unknown>(`/applicants/${id}`),
  create:     (data: unknown)                                            => request<unknown>("/applicants", { method: "POST", body: JSON.stringify(data) }),
  bulkCreate: (data: unknown[], jobId?: string, sourceType?: string)     => request<unknown[]>("/applicants/bulk", {
    method: "POST",
    body: JSON.stringify({ applicants: data, job_id: jobId, sourceType }),
  }),
  update:     (id: string, data: unknown)                                => request<unknown>(`/applicants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete:     (id: string)                                               => request<unknown>(`/applicants/${id}`, { method: "DELETE" }),
};

// ─── Screening Results ────────────────────────────────────────
export const results = {
  list:              ()                    => request<unknown[]>("/results"),
  listByJob:         (jobId: string)       => request<unknown[]>(`/results?job_id=${jobId}`),
  listByApplicant:   (applicantId: string) => request<unknown[]>(`/results?applicant_id=${applicantId}`),
  deleteByJob:       (jobId: string)       => request<unknown>(`/results/by-job/${jobId}`, { method: "DELETE" }),
  deleteByApplicant: (applicantId: string) => request<unknown>(`/results/by-applicant/${applicantId}`, { method: "DELETE" }),
};

// ─── AI Screening ─────────────────────────────────────────────
export const screening = {
  run: (jobId: string, weights: Record<string, number>, shortlistSize?: number) =>
    request<unknown[]>("/screen", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, weights, shortlistSize }),
    }),
};

// ─── File Upload ──────────────────────────────────────────────
export const uploads = {
  parseCandidates: async (file: File, jobId?: string): Promise<unknown> => {
    const formData = new FormData();
    formData.append("file", file);
    if (jobId) formData.append("job_id", jobId);
    const token = localStorage.getItem("hr_token");
    const res = await fetch(`${API_BASE}/upload/candidates`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  parseJobs: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("hr_token");
    const res = await fetch(`${API_BASE}/upload/jobs`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  parseCandidateFromUrl: async (url: string, jobId?: string): Promise<unknown> => {
    const token = localStorage.getItem("hr_token");
    const res = await fetch(`${API_BASE}/upload/candidates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ cv_url: url, job_id: jobId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "URL parsing failed" }));
      throw new Error(err.message || "URL parsing failed");
    }
    return res.json();
  },
};

