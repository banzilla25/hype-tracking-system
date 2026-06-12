"use client";

import { useTransition } from "react";
import { approveAccount, rejectAccount } from "@/lib/actions/auth";

export function ApproveButtons({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 flex-shrink-0">
      <button
        onClick={() =>
          startTransition(async () => {
            await approveAccount(userId);
          })
        }
        disabled={isPending}
        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        Approve
      </button>
      <button
        onClick={() =>
          startTransition(async () => {
            await rejectAccount(userId);
          })
        }
        disabled={isPending}
        className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
      >
        Tolak
      </button>
    </div>
  );
}
