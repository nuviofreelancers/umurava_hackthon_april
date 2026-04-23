const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function handleUnauthorized() {
  localStorage.removeItem("hr_token");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?session=expired";
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("hr_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
    ...options,
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message || "Request failed"), { status: res.status });
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; full_name: string; email: string } }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me:       () => request<{ id: string; full_name: string; email: string }>("/auth/me"),
  updateMe: (data: Partial<{ full_name: string; email: string; password: string; phone_number?: string; specialisation?: string; bio?: string }>) =>
    request("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  logout: () => {
    localStorage.removeItem("hr_token");
    window.location.href = "/login";
  },
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = {
  list:   ()                          => request<unknown[]>("/jobs"),
  get:    (id: string)                => request<unknown>(`/jobs/${id}`),
  create: (data: unknown)             => request<unknown>("/jobs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request<unknown>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string)                => request<unknown>(`/jobs/${id}`, { method: "DELETE" }),
};

// ─── Applicants ───────────────────────────────────────────────────────────────
export const applicants = {
  list:      (page = 1, limit = 30) => request<unknown[]>(`/applicants?page=${page}&limit=${limit}`),
  listByJob: (jobId: string, page = 1, limit = 50) =>
    request<unknown[]>(`/applicants?job_id=${jobId}&page=${page}&limit=${limit}`),
  get:    (id: string)            => request<unknown>(`/applicants/${id}`),
  create: (data: unknown)         => request<unknown>("/applicants", { method: "POST", body: JSON.stringify(data) }),
  bulkCreate: (data: unknown[], jobId?: string, sourceType?: string) =>
    request<unknown>("/applicants/bulk", {
      method: "POST",
      body: JSON.stringify({ applicants: data, job_id: jobId, sourceType }),
    }),
  update:  (id: string, data: unknown) => request<unknown>(`/applicants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete:  (id: string)                => request<unknown>(`/applicants/${id}`, { method: "DELETE" }),
  // FIX: restore endpoint for undo-delete
  restore: (id: string)                => request<unknown>(`/applicants/${id}/restore`, { method: "POST" }),
};

// ─── Screening Results ────────────────────────────────────────────────────────
export const results = {
  list:              ()                    => request<unknown[]>("/results"),
  listByJob:         (jobId: string)       => request<unknown[]>(`/results?job_id=${jobId}`),
  listByApplicant:   (applicantId: string) => request<unknown[]>(`/results?applicant_id=${applicantId}`),
  deleteByJob:       (jobId: string)       => request<unknown>(`/results/by-job/${jobId}`, { method: "DELETE" }),
  deleteByApplicant: (applicantId: string) => request<unknown>(`/results/by-applicant/${applicantId}`, { method: "DELETE" }),
};

// ─── AI Screening ─────────────────────────────────────────────────────────────
export const screening = {
  run: (jobId: string, weights: Record<string, number>, shortlistSize?: number) =>
    request<unknown[]>("/screen", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, weights, shortlistSize }),
    }),
};

// ─── File Upload ──────────────────────────────────────────────────────────────
async function uploadFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    handleUnauthorized();
    throw Object.assign(new Error("Session expired."), { status: 401 });
  }
  return res;
}

export const uploads = {
  parseCandidates: async (file: File, jobId?: string): Promise<unknown> => {
    const formData = new FormData();
    formData.append("file", file);
    if (jobId) formData.append("job_id", jobId);
    const token = localStorage.getItem("hr_token");
    const res = await uploadFetch(`${API_BASE}/upload/candidates`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
  const err = await res.json().catch(() => ({ message: "Upload failed" }));
  
      // Show contextual messages based on status code
      if (res.status === 429) {
        throw new Error("AI service is busy — please wait 30 seconds before uploading again");
      }
      if (res.status === 503) {
        throw new Error("AI service temporarily unavailable — please try again shortly");
      }
      if (res.status === 422) {
        throw new Error(err.message || "Could not parse resume — please check the file");
      }
      
      throw new Error(err.message || "Upload failed");
    }
    return res.json();
  },

  parseJobs: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("hr_token");
    const res = await uploadFetch(`${API_BASE}/upload/jobs`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(err.message || "Upload failed");
    }
    return res.json();
  },

  // FIX: URL parsing sends JSON body — do NOT use FormData for this call
  parseCandidateFromUrl: async (url: string, jobId?: string): Promise<unknown> => {
    const token = localStorage.getItem("hr_token");
    const res = await uploadFetch(`${API_BASE}/upload/candidates`, {
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
