import { useRef, useState } from "react";
import { api } from "../api";

function pickMime() {
  // Chrome records webm, Safari records mp4
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export default function Recorder({ onParsed, onManualAdd }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const recorder = useRef(null);
  const chunks = useRef([]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        await send(() => api.voice(blob));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone is blocked. Allow mic access, or type your expenses below.");
    }
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  async function send(call) {
    setBusy(true);
    setError("");
    try {
      const res = await call();
      if (!res.items.length) {
        setError(`I heard "${res.transcript}" but found no amounts. Try again with an amount, like "120 on lunch".`);
      } else {
        onParsed(res.transcript, res.items);
        setText("");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left text-center">
        <button
          onClick={recording ? stop : start}
          disabled={busy}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-forest text-white transition active:scale-95 hover:bg-leaf disabled:opacity-50 touch-manipulation ${
            recording ? "recording bg-coral hover:bg-coral shadow-lg shadow-coral/30" : "shadow-md shadow-forest/20"
          }`}
        >
          {recording ? (
            <div className="flex items-center gap-1">
              <span className="h-6 w-6 rounded-md bg-white animate-pulse" />
            </div>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h2 className="font-display text-lg sm:text-xl font-bold">
              {busy ? "Analyzing expenses…" : recording ? "Listening… tap to stop" : "Tell me what you spent"}
            </h2>
            {recording && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-coral animate-ping" />
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink/65 leading-relaxed">
            {busy
              ? "Processing your expenses…"
              : recording
              ? "Speak naturally in English (e.g. '120 on lunch and 50 auto')"
              : 'Tap mic or type: "120 on lunch, 50 for bus and 499 for Netflix".'}
          </p>
        </div>
      </div>

      {/* Text Input Row */}
      <div className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && text.trim() && send(() => api.parseText(text))}
            placeholder="Or type here (e.g. 150 coffee)"
            className="w-full rounded-2xl bg-mint px-4 py-3.5 text-base sm:text-sm placeholder:text-ink/40 transition focus:ring-2 focus:ring-leaf/30"
          />
          {text && (
            <button
              onClick={() => setText("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/40 hover:text-ink"
              aria-label="Clear text"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => send(() => api.parseText(text))}
          disabled={busy || !text.trim()}
          className="rounded-2xl bg-forest px-5 py-3.5 text-sm font-semibold text-white transition active:scale-95 hover:bg-leaf disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {/* Quick Example Chips for Mobile */}
      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-ink/60 no-scrollbar">
        {onManualAdd && (
          <button
            type="button"
            onClick={onManualAdd}
            className="shrink-0 rounded-lg bg-forest text-white px-2.5 py-1 text-xs font-bold hover:bg-leaf transition active:scale-95 flex items-center gap-1"
          >
            <span>+ Custom Entry</span>
          </button>
        )}
        <span className="shrink-0 text-ink/40 font-medium">Quick examples:</span>
        {[
          "120 lunch",
          "50 auto",
          "350 groceries",
          "499 netflix"
        ].map((example) => (
          <button
            key={example}
            onClick={() => {
              setText(example);
              send(() => api.parseText(example));
            }}
            className="shrink-0 rounded-lg bg-mint/80 px-2.5 py-1 text-xs font-medium text-forest hover:bg-mint transition active:scale-95"
          >
            +{example}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-2xl bg-coral/10 p-3.5 text-xs sm:text-sm text-coral leading-relaxed">{error}</p>}
    </section>
  );
}
