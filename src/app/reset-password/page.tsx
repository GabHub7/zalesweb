"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock } from "lucide-react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="text-[13.5px] text-neutral-500 dark:text-neutral-400">
          This reset link is missing its token. Request a new one from the login page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <p className="mb-4 text-[13.5px] text-neutral-700 dark:text-neutral-300">
          Password updated. You can log in now.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full rounded-xl bg-neutral-900 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 dark:bg-white dark:text-neutral-950"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-3">
      <div className="mb-2 flex items-center gap-2">
        <Lock size={16} className="text-neutral-700 dark:text-neutral-300" />
        <h1 className="text-[15px] font-bold text-neutral-900 dark:text-white">Set a new password</h1>
      </div>
      <input
        type="password"
        required
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-[#181716] dark:text-white"
      />
      <input
        type="password"
        required
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-[#181716] dark:text-white"
      />
      {error && <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-neutral-900 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-950"
      >
        {loading ? "..." : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#FBF9F6] px-6 text-[#191919] dark:bg-[#0B0A09] dark:text-[#EAE9E6]">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
