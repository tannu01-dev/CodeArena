
import { apiRequest } from "./api";

export const codeArenaApi = {
  getWorkspace: (attemptId) =>
    apiRequest(`/workspace/${attemptId}`),

  saveDraft: (attemptId, payload) =>
    apiRequest(`/workspace/${attemptId}/draft`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  submitAttempt: (attemptId, requestId) =>
    apiRequest(`/workspace/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ requestId }),
    }),

  createJob: (payload) =>
    apiRequest("/judge/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getJob: (jobId) =>
    apiRequest(`/judge/jobs/${jobId}`),

  reportViolation: (attemptId, payload) =>
    apiRequest(`/integrity/${attemptId}/violations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
