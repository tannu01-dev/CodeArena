
import { apiRequest } from "./api";

export const getCandidateReports = () =>
  apiRequest("/results/candidate");

export const getRecruiterAnalytics = () =>
  apiRequest("/results/recruiter/analytics");

export const getRecruiterSubmissions = () =>
  apiRequest("/results/recruiter/submissions");

export const queueSubmissionEvaluation = (attemptId) =>
  apiRequest(`/results/recruiter/submissions/${attemptId}/re-evaluate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

export const getCandidateProfile = () =>
  apiRequest("/talent/profile");

export const saveCandidateProfile = (body) =>
  apiRequest("/talent/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const updateSearchConsent = (searchable) =>
  apiRequest("/talent/consent", {
    method: "PUT",
    body: JSON.stringify({
      searchable,
      consentVersion: "2026-10",
    }),
  });

export const eraseCandidateProfile = () =>
  apiRequest("/talent/profile", {
    method: "DELETE",
  });

export const listJobs = (mine = false) =>
  apiRequest(`/hiring/jobs${mine ? "?mine=true" : ""}`);

export const createJob = (body) =>
  apiRequest("/hiring/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const applyToJob = (jobId, body) =>
  apiRequest(`/hiring/jobs/${jobId}/apply`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getMyApplications = () =>
  apiRequest("/hiring/applications/mine");

export const getMyInvitations = () =>
  apiRequest("/hiring/invitations/mine");

export const respondInvitation = (id, status) =>
  apiRequest(`/hiring/invitations/${id}/respond`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const searchCandidates = (q, skills) =>
  apiRequest(
    `/talent/search?q=${encodeURIComponent(q)}&skills=${encodeURIComponent(skills)}`
  );

export const getJobMatches = (jobId) =>
  apiRequest(`/talent/match/${jobId}`);

export const getAdminOverview = () =>
  apiRequest("/admin/overview");

export const getAdminUsers = () =>
  apiRequest("/admin/users");

export const getAuditLogs = () =>
  apiRequest("/results/audit");

export async function downloadResultsCsv(assessmentId = "") {
  const base = (
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  const query = assessmentId
    ? `?assessmentId=${encodeURIComponent(assessmentId)}`
    : "";

  const response = await fetch(`${base}/results/export.csv${query}`, {
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Export failed (${response.status})`;

    try {
      message = (await response.json()).message || message;
    } catch {}

    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "codearena-results.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export const updateAdminUser = (id, body) =>
  apiRequest(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const terminateAdminAttempt = (id, reason) =>
  apiRequest(`/admin/attempts/${id}/terminate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const getJobApplications = (jobId) =>
  apiRequest(`/hiring/jobs/${jobId}/applications`);

export const updateApplicationStage = (
  applicationId,
  status,
  note = ""
) =>
  apiRequest(`/hiring/applications/${applicationId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });

export const createHiringInvitation = (body) =>
  apiRequest("/hiring/invitations", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateJob = (jobId, body) =>
  apiRequest(`/hiring/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
