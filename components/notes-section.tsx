"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/lib/actions/notes";

type Note = {
  note_id: number;
  author_id: string;
  phase: string;
  is_internal_only: boolean;
  note_text: string;
  created_at: string;
  profiles: { nickname: string } | null;
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotesSection({
  claimId,
  notes,
  canAdd,
  isInternal,
}: {
  claimId: number;
  notes: Note[];
  canAdd: boolean;
  isInternal: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addNote(claimId, text, internalOnly);
      if (res.error) {
        setError(res.error);
        return;
      }
      setText("");
      setInternalOnly(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Belum ada catatan.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.note_id}
              className={`rounded-xl px-3 py-2.5 ${
                note.is_internal_only
                  ? "bg-amber-50 border border-amber-100"
                  : "bg-gray-50 border border-gray-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {note.profiles?.nickname ?? "—"}
                </span>
                {note.is_internal_only && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    Internal
                  </span>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">
                  {formatDateTime(note.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note_text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add note form */}
      {canAdd && (
        <div className="space-y-2 pt-1">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis catatan..."
            rows={2}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <div className="flex items-center justify-between">
            {isInternal ? (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={internalOnly}
                  onChange={(e) => setInternalOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-amber-500"
                />
                Catatan internal saja
              </label>
            ) : (
              <span />
            )}
            <button
              onClick={handleSubmit}
              disabled={isPending || !text.trim()}
              className="px-4 py-1.5 bg-gray-800 text-white text-xs font-semibold rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
