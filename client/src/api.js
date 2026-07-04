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
  saveProfile: (profile) =>
    request("/api/profile", { method: "PUT", body: JSON.stringify({ profile }) }),
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
};
