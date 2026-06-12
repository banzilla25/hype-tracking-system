"use client";

import { useState, useTransition } from "react";
import { createProfile } from "@/lib/actions/auth";

export default function SetupProfileForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProfile(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      <div>
        <label
          htmlFor="nickname"
          className="block text-sm font-medium text-gray-700 mb-1.5"
        >
          Nama Panggilan
        </label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          required
          minLength={2}
          maxLength={50}
          placeholder="Contoh: Andi"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Menyimpan..." : "Lanjutkan"}
      </button>
    </form>
  );
}
