async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getProfile: () => request("/api/profile").then((d) => d.profile),
  saveProfile: (profile, json_data) =>
    request("/api/profile", { method: "PUT", body: JSON.stringify({ profile, json_data }) }),
  parseProfile: () => request("/api/profile/parse", { method: "POST" }).then((d) => d.profile),
  getJobs: () => request("/api/jobs").then((d) => d.jobs),
  addJob: (job) =>
    request("/api/jobs", { method: "POST", body: JSON.stringify(job) }).then((d) => d.job),
  patchJob: (id, patch) =>
    request(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(
      (d) => d.job
    ),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: "DELETE" }),
  generate: (jobId, kind) =>
    request("/api/generate", { method: "POST", body: JSON.stringify({ jobId, kind }) }).then(
      (d) => d.job
    ),
  sendChat: (jobId, message) => 
    request(`/api/jobs/${jobId}/chat`, { method: "POST", body: JSON.stringify({ message }) }).then((d) => d.chat),
  autoApply: (jobId) => request(`/api/jobs/${jobId}/apply`, { method: "POST" }),
  getCompanies: () => request("/api/companies").then((d) => d.companies),
  addCompany: (company) =>
    request("/api/companies", { method: "POST", body: JSON.stringify(company) }).then(
      (d) => d.company
    ),
  setCompanyActive: (id, active) =>
    request(`/api/companies/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deleteCompany: (id) => request(`/api/companies/${id}`, { method: "DELETE" }),
  getSettings: () => request("/api/settings").then((d) => d.settings),
  saveSettings: (settings) =>
    request("/api/settings", { method: "PUT", body: JSON.stringify({ settings }) }).then(
      (d) => d.settings
    ),
  scan: () => request("/api/scan", { method: "POST" }),
  estimate: (jobId, kind) =>
    request("/api/estimate", { method: "POST", body: JSON.stringify({ jobId, kind }) }),
  getConfig: () => request("/api/config"),
  getAnalytics: () => request("/api/analytics"),
  getInbox: () => request("/api/inbox").then((d) => d.postings),
  acceptPosting: (id) =>
    request(`/api/inbox/${id}/accept`, { method: "POST" }).then((d) => d.job),
  dismissPosting: (id) => request(`/api/inbox/${id}/dismiss`, { method: "POST" }),
};
