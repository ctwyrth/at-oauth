// login form for authenticating with the OAuth server
"use client";

import { useState } from "react";

export function LoginForm() {
   const [handle, setHandle] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);

   async function handleSubmit(e: React.SubmitEvent) {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
         const response = await fetch("/oauth/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ handle }),
         });

         const data = await response.json();

         if (!response.ok) {
            throw new Error(data.error || "Login failed");
         }

         // Redirect to the authorization URL
         window.location.href = data.redirectUrl;
      } catch (err) {
         setError(err instanceof Error ? err.message : "Login failed");
         setLoading(false);
      }
   }

   return (
      <form onSubmit={handleSubmit} className="space-y-4">
         <div>
         <label htmlFor="handle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Handle
         </label>
         <input type="text" id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" placeholder="user.example.com" disabled={loading} />
         </div>

         {error && <p className="text-red-500 text-sm">{error}</p>}

         <button type="submit" disabled={loading || !handle.trim()} className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
         {loading ? "Logging in..." : "Login"}
         </button>
      </form>
   );
}