
"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function RealtimeAttemptSync({ attemptId }) {
  const [status, setStatus] = useState("connecting");
  const [deadline, setDeadline] = useState(null);
  const [serverTime, setServerTime] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!attemptId) return;

    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
    ).replace(/\/+$/, "");

    const socketOrigin = apiBase.replace(/\/api$/i, "");

    const socket = io(socketOrigin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("attempt:watch", { attemptId });
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", (e) => {
      setStatus("unavailable");
      setNotice(e.message || "Realtime connection unavailable");
    });

    socket.on("attempt:state", (data) => {
      setStatus(data.status);
      setDeadline(data.deadlineAt || null);
      setServerTime(data.serverTime || null);
    });

    socket.on("attempt:deadline", (data) => {
      setDeadline(data.deadlineAt || null);
      setServerTime(data.serverTime || null);
      setNotice(
        "Server deadline reached. The server will enforce expiry."
      );
    });

    socket.on("attempt:terminated", (data) => {
      setStatus("terminated");
      setNotice(`Attempt ended: ${data.reason || "terminated"}`);
    });

    socket.on("realtime:error", (data) => {
      setNotice(data.message || "Realtime update error");
    });

    return () => socket.disconnect();
  }, [attemptId]);

  let remaining = "";

  if (deadline) {
    const ms = Math.max(
      0,
      new Date(deadline).getTime() - Date.now()
    );

    remaining = `${Math.floor(ms / 60000)}:${String(
      Math.floor(ms / 1000) % 60
    ).padStart(2, "0")}`;
  }

  return (
    <aside
      className="my-2 rounded border px-3 py-2 text-sm"
      aria-live="polite"
    >
      <span>Realtime: {status}</span>

      {deadline && (
        <span className="ml-3">
          Server deadline countdown: {remaining}
        </span>
      )}

      {serverTime && (
        <span className="ml-3 text-gray-500">
          Last server sync{" "}
          {new Date(serverTime).toLocaleTimeString()}
        </span>
      )}

      {notice && (
        <p className="mt-1 text-amber-700">{notice}</p>
      )}
    </aside>
  );
}
