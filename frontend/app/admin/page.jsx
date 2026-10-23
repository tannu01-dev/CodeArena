
"use client";

import { useEffect, useState } from "react";
import {
  getAdminOverview,
  getAdminUsers,
  getAuditLogs,
  updateAdminUser,
} from "../lib/phase11to14";

export default function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setError("");

    try {
      const [o, u, l] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
        getAuditLogs(),
      ]);

      setOverview(o.overview);
      setUsers(u.users || []);
      setLogs(l.logs || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function change(user, field, value) {
    setBusy(String(user._id));
    setError("");

    try {
      await updateAdminUser(user._id, {
        [field]: value,
      });

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        Admin &amp; system monitoring
      </h1>

      <p className="text-gray-600">
        Live counts are read from MongoDB and current process metrics;
        user records are not mocked.
      </p>

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {overview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(overview)
              .filter(
                ([key, value]) =>
                  typeof value === "number" ||
                  ["database", "nodeVersion"].includes(key)
              )
              .map(([key, value]) => (
                <section
                  className="rounded border p-4"
                  key={key}
                >
                  <p className="text-sm capitalize text-gray-500">
                    {key.replace(/[A-Z]/g, (match) => ` ${match}`)}
                  </p>

                  <p className="break-words text-2xl font-semibold">
                    {value}
                  </p>
                </section>
              ))}
          </div>

          <p className="text-sm text-gray-500">
            Checked: {new Date(overview.checkedAt).toLocaleString()}
            {" · "}
            Uptime: {overview.uptimeSeconds}s
          </p>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          User management
        </h2>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Active</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr className="border-b" key={u._id}>
                  <td className="p-3">
                    {u.name || "—"}

                    <p className="text-gray-500">
                      {u.email || String(u._id)}
                    </p>
                  </td>

                  <td className="p-3">
                    <select
                      disabled={busy === String(u._id)}
                      className="rounded border p-1"
                      value={u.role || "candidate"}
                      onChange={(e) =>
                        change(u, "role", e.target.value)
                      }
                    >
                      <option value="candidate">candidate</option>
                      <option value="recruiter">recruiter</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={
                        u.isActive !== false &&
                        u.status !== "disabled"
                      }
                      disabled={busy === String(u._id)}
                      onChange={(e) =>
                        change(u, "isActive", e.target.checked)
                      }
                    />
                  </td>

                  <td className="p-3">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!users.length && (
            <p className="p-4">No user records found.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Audit trail
        </h2>

        <div className="space-y-2">
          {logs.map((l) => (
            <article
              className="rounded border p-3"
              key={l._id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <b>{l.action}</b>

                <time className="text-sm text-gray-500">
                  {new Date(l.createdAt).toLocaleString()}
                </time>
              </div>

              <p className="text-sm text-gray-600">
                {l.actorId?.email ||
                  l.actorId?.name ||
                  "System"}
                {" · "}
                {l.entityType} {l.entityId}
              </p>
            </article>
          ))}

          {!logs.length && (
            <p>No audit events have been recorded yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
