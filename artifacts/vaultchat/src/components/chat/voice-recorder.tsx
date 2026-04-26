import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderProps {
  onRecorded: (file: File) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function VoiceRecorder({ onRecorded, onRecordingChange, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAt = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const { toast } = useToast();

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);

  const start = async () => {
    if (recording || requesting) return;
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = mr;
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const wasCancelled = cancelledRef.current;
        const totalMs = Date.now() - startedAt.current;
        cleanup();
        setRecording(false);
        onRecordingChange?.(false);
        setElapsed(0);
        setLevel(0);
        if (wasCancelled) return;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "audio/webm").includes("webm") ? "webm" : "ogg";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        const seconds = Math.max(1, Math.round(totalMs / 1000));
        if (seconds < 1) {
          toast({
            title: "Recording too short",
            description: "Hold to record a longer voice note.",
            variant: "destructive",
          });
          return;
        }
        onRecorded(file);
      };
      mr.start();
      startedAt.current = Date.now();
      setRecording(true);
      onRecordingChange?.(true);

      // Audio level meter
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      tickRef.current = setInterval(() => {
        const t = Date.now() - startedAt.current;
        setElapsed(t);
        if (t >= MAX_DURATION_MS) stop();
      }, 200);
    } catch (err) {
      toast({
        title: "Microphone unavailable",
        description: err instanceof Error ? err.message : "Permission denied",
        variant: "destructive",
      });
      cleanup();
    } finally {
      setRequesting(false);
    }
  };

  const stop = () => {
    const mr = recRef.current;
    if (!mr || mr.state === "inactive") return;
    mr.stop();
  };

  const cancel = () => {
    cancelledRef.current = true;
    const mr = recRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    } else {
      cleanup();
      setRecording(false);
      onRecordingChange?.(false);
      setElapsed(0);
    }
  };

  if (!recording) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={start}
        disabled={disabled || requesting}
        title="Record voice note"
        aria-label="Record voice note"
      >
        {requesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
      </Button>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-2 px-2">
      <button
        type="button"
        onClick={cancel}
        className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="Cancel recording"
        title="Cancel"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex-1 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-full px-3 py-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-rose-500/50 animate-ping" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <span className="text-sm font-mono text-rose-700 dark:text-rose-300 tabular-nums">
          {fmt(elapsed)}
        </span>
        <div className="flex-1 h-1.5 bg-rose-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white"
        onClick={stop}
        title="Stop and send"
        aria-label="Stop and send"
      >
        <Send className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={stop}
        className="hidden"
      >
        <Square className="h-4 w-4" />
      </button>
    </div>
  );
}
