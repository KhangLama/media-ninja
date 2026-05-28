"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useEffect, useRef, useState, useMemo } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { getSharedFile, clearSharedFile, setSharedFile } from "@/lib/sharedFileStore";
import { useRouter } from "next/navigation";

export type SubtitleSegment = {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
};

type TranscriptionStatus = "idle" | "decoding" | "loading_model" | "transcribing" | "done" | "error";
type BurnInStatus = "idle" | "processing" | "done" | "error";

const FFMPEG_ASSET_BASE_URL = "/ffmpeg";

function getUniqueFileNames(ext: string) {
  const timestamp = Date.now();
  return {
    inputName: `input_${timestamp}.${ext}`,
    outputName: `output_burned_${timestamp}.mp4`,
  };
}

export default function SubtitleProcessor() {
  const { t } = useLanguage();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");

  // Transcription states
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);

  // Burn-in states
  const [burnInStatus, setBurnInStatus] = useState<BurnInStatus>("idle");
  const [burnInProgress, setBurnInProgress] = useState<number>(0);
  const [burnInError, setBurnInError] = useState<string | null>(null);
  const [burnedVideoUrl, setBurnedVideoUrl] = useState<string>("");

  const videoRef = useRef<HTMLMediaElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== "undefined") {
      workerRef.current = new Worker(
        new URL("./transcribe.worker.ts", import.meta.url)
      );

      workerRef.current.onmessage = (event) => {
        const { status: workerStatus, progress: workerProgress, result, error: workerError } = event.data;

        if (workerStatus === "loading_progress") {
          setStatus("loading_model");
          setProgress(workerProgress || 0);
        } else if (workerStatus === "transcribing") {
          setStatus("transcribing");
          setProgress(0);
        } else if (workerStatus === "done") {
          setStatus("done");
          setProgress(100);

          if (result && result.chunks) {
            const mappedSegments: SubtitleSegment[] = result.chunks.map((chunk: { timestamp: [number | null, number | null] | null; text: string }) => {
              const start = typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : 0;
              const end = typeof chunk.timestamp?.[1] === "number" ? chunk.timestamp[1] : start + 3;
              return {
                id: crypto.randomUUID(),
                start,
                end,
                text: chunk.text.trim(),
              };
            });
            setSegments(mappedSegments);
          }
        } else if (workerStatus === "error") {
          setStatus("error");
          setError(workerError || "Failed to transcribe audio.");
        }
      };
    }

    return () => {
      workerRef.current?.terminate();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (burnedVideoUrl) URL.revokeObjectURL(burnedVideoUrl);
    };
  }, [previewUrl, burnedVideoUrl]);

  useEffect(() => {
    const sharedFile = getSharedFile();
    if (sharedFile) {
      setFile(sharedFile);
      setPreviewUrl(URL.createObjectURL(sharedFile));
      setTimeout(clearSharedFile, 100);
    }
  }, []);

  // Track playback time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selected));
      
      // Reset states
      setSegments([]);
      setStatus("idle");
      setProgress(0);
      setError(null);
      setBurnInStatus("idle");
      setBurnedVideoUrl("");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selected));
      
      // Reset states
      setSegments([]);
      setStatus("idle");
      setProgress(0);
      setError(null);
      setBurnInStatus("idle");
      setBurnedVideoUrl("");
    }
  };

  // Perform Audio Decoding and Transcription
  const handleTranscribe = async () => {
    if (!file) return;

    setStatus("decoding");
    setProgress(0);
    setError(null);
    setSegments([]);

    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      let originalBuffer: AudioBuffer;
      
      const arrayBuffer = await file.arrayBuffer();
      let promise: Promise<AudioBuffer> | undefined;
      try {
        promise = audioCtx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn("Synchronous error during decodeAudioData:", e);
      }

      if (promise && typeof promise.then === "function") {
        try {
          originalBuffer = await promise;
        } catch (promiseErr) {
          console.error("Promise-based decodeAudioData failed, trying callback fallback:", promiseErr);
          const freshArrayBuffer = await file.arrayBuffer();
          originalBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            audioCtx.decodeAudioData(freshArrayBuffer, resolve, reject);
          });
        }
      } else {
        const freshArrayBuffer = await file.arrayBuffer();
        originalBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          audioCtx.decodeAudioData(freshArrayBuffer, resolve, reject);
        });
      }

      // Resample to 16000Hz mono
      const targetSampleRate = 16000;
      const numberOfChannels = 1;
      const offlineCtx = new OfflineAudioContext(
        numberOfChannels,
        Math.round(originalBuffer.duration * targetSampleRate),
        targetSampleRate
      );

      const bufferSource = offlineCtx.createBufferSource();
      bufferSource.buffer = originalBuffer;
      bufferSource.connect(offlineCtx.destination);
      bufferSource.start();

      const resampledBuffer = await offlineCtx.startRendering();
      const float32Data = resampledBuffer.getChannelData(0);

      // Send Float32Array to Whisper worker
      setStatus("loading_model");
      workerRef.current?.postMessage({
        audio: float32Data,
        language: selectedLanguage === "auto" ? null : selectedLanguage,
        task: "transcribe",
      });
    } catch (err) {
      console.error("Transcription audio processing failed:", err);
      setStatus("error");
      
      const errorMsg = err instanceof Error ? err.message : "";
      const errorName = err instanceof Error ? err.name : "";
      
      if (
        errorName === "EncodingError" ||
        errorMsg.includes("decode") ||
        errorMsg.includes("detached") ||
        errorMsg.includes("track") ||
        errorMsg.includes("channel")
      ) {
        setError(t("sub_err_decode"));
      } else {
        setError(err instanceof Error ? err.message : t("sub_status_error"));
      }
    }
  };

  // Load FFmpeg instance for burn-in
  const loadFFmpeg = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    const assetBaseUrl = `${window.location.origin}${FFMPEG_ASSET_BASE_URL}`;

    ffmpeg.on("progress", ({ progress: p }) => {
      setBurnInProgress(Math.round(p * 100));
    });

    await ffmpeg.load({
      classWorkerURL: `${assetBaseUrl}/worker.js`,
      coreURL: `${assetBaseUrl}/ffmpeg-core.js`,
      wasmURL: `${assetBaseUrl}/ffmpeg-core.wasm`,
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  // Hardcode Subtitles into Video via FFmpeg
  const handleBurnInSubtitles = async () => {
    if (!file || segments.length === 0) return;

    setBurnInStatus("processing");
    setBurnInProgress(0);
    setBurnInError(null);
    setBurnedVideoUrl("");

    try {
      const ffmpeg = await loadFFmpeg();

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const { inputName, outputName } = getUniqueFileNames(ext);
      const srtName = "subtitles.srt";

      // Write video file to MemFS
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Generate SRT and write to MemFS
      const srtContent = generateSRT();
      await ffmpeg.writeFile(srtName, new TextEncoder().encode(srtContent));

      // Build FFmpeg command to apply subtitles
      // In web, fonts are not loaded by default, but standard wasm core handles default drawing
      const exitCode = await ffmpeg.exec([
        "-i", inputName,
        "-vf", `subtitles=${srtName}:force_style='FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2'`,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "24",
        "-c:a", "aac",
        "-b:a", "128k",
        outputName
      ]);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg processing failed with exit code ${exitCode}`);
      }

      // Read output
      const outputData = await ffmpeg.readFile(outputName);
      const outputBytes = typeof outputData === "string" ? new TextEncoder().encode(outputData) : outputData;
      const cleanBuffer = new ArrayBuffer(outputBytes.byteLength);
      new Uint8Array(cleanBuffer).set(outputBytes);
      const blob = new Blob([cleanBuffer], { type: "video/mp4" });

      if (burnedVideoUrl) URL.revokeObjectURL(burnedVideoUrl);
      const url = URL.createObjectURL(blob);
      setBurnedVideoUrl(url);
      setBurnInStatus("done");

      // Cleanup MemFS
      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(srtName),
        ffmpeg.deleteFile(outputName),
      ]);
    } catch (err) {
      console.error(err);
      setBurnInStatus("error");
      setBurnInError(err instanceof Error ? err.message : "Failed to burn subtitles into video. Please download SRT instead.");
    }
  };

  // Subtitle editors helpers
  const handleAddSegment = () => {
    const nextStart = segments.length > 0 ? segments[segments.length - 1].end : 0;
    const newSeg: SubtitleSegment = {
      id: crypto.randomUUID(),
      start: nextStart,
      end: nextStart + 3,
      text: "New subtitle segment",
    };
    setSegments([...segments, newSeg]);
  };

  const handleUpdateSegment = (id: string, patch: Partial<SubtitleSegment>) => {
    setSegments(segments.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)));
  };

  const handleDeleteSegment = (id: string) => {
    setSegments(segments.filter((seg) => seg.id !== id));
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  // Formatter helpers
  const formatTimeSRT = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  const formatTimeVTT = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };

  const generateSRT = (): string => {
    return segments
      .map((seg, idx) => `${idx + 1}\n${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n${seg.text}\n`)
      .join("\n");
  };

  const generateVTT = (): string => {
    return "WEBVTT\n\n" + segments
      .map((seg, idx) => `${idx + 1}\n${formatTimeVTT(seg.start)} --> ${formatTimeVTT(seg.end)}\n${seg.text}\n`)
      .join("\n");
  };

  const generateTXT = (): string => {
    return segments.map((seg) => seg.text).join(" ");
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Find active segment
  const activeSegment = useMemo(() => {
    return segments.find((seg) => currentTime >= seg.start && currentTime <= seg.end);
  }, [segments, currentTime]);

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/10 bg-neutral-900/80 p-4 sm:p-6">
      {!file ? (
        <div
          className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-neutral-950 hover:border-white/30 hover:bg-neutral-950/70 p-6 text-center transition"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
            <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </div>
          <p className="text-xl font-semibold text-white">{t("sub_upload_title")}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
            {t("sub_upload_desc")}
          </p>
          <button
            className="mt-7 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-neutral-950 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {t("sub_upload_btn")}
          </button>
          <input
            accept="video/*,audio/*"
            className="sr-only"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr] xl:grid-cols-[1.1fr_1.9fr]">
          {/* Left Column: Player & Core Controls */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
              {file.type.startsWith("video/") ? (
                <video
                  className="aspect-video w-full rounded-lg border border-white/10 bg-black outline-none"
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  ref={(el) => { videoRef.current = el; }}
                  src={previewUrl}
                />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center bg-neutral-950 p-6 text-center">
                  <svg className="h-12 w-12 text-cyan-300 animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v1.5m0-1.5L9 12m0 0v8.25m0-8.25L3 14.25M9 20.25a3 3 0 100-6 3 3 0 000 6zm10.5-3a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  <p className="mt-4 text-xs font-semibold text-white truncate max-w-full px-4">{file.name}</p>
                  <audio
                    className="mt-4 w-full"
                    controls
                    onTimeUpdate={handleTimeUpdate}
                    ref={(el) => { videoRef.current = el; }}
                    src={previewUrl}
                  />
                </div>
              )}
            </div>

            {/* Active Subtitle Preview Overlay */}
            {activeSegment && (
              <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.03] p-3 text-center text-sm font-semibold text-cyan-200">
                &quot;{activeSegment.text}&quot;
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-neutral-950 p-4 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-white">{t("sub_title")}</h3>
              
              <div>
                <label className="text-xs font-medium text-neutral-300" htmlFor="lang-select">
                  Ngôn ngữ phát hiện (Language)
                </label>
                <select
                  className="mt-2 w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300"
                  id="lang-select"
                  disabled={status !== "idle" && status !== "done" && status !== "error"}
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  <option value="auto">Auto Detect (Tự động nhận diện)</option>
                  <option value="en">English (Tiếng Anh)</option>
                  <option value="vi">Vietnamese (Tiếng Việt)</option>
                  <option value="zh">Chinese (Tiếng Trung)</option>
                  <option value="ja">Japanese (Tiếng Nhật)</option>
                  <option value="ko">Korean (Tiếng Hàn)</option>
                  <option value="fr">French (Tiếng Pháp)</option>
                  <option value="de">German (Tiếng Đức)</option>
                  <option value="es">Spanish (Tiếng Tây Ban Nha)</option>
                </select>
              </div>

              {/* Status and Progress bar */}
              {status !== "idle" && (
                <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-300 mb-1">
                    <span>
                      {status === "decoding" && t("sub_status_decoding_audio")}
                      {status === "loading_model" && t("sub_status_loading_model")}
                      {status === "transcribing" && t("sub_status_transcribing", { percent: Math.round(progress) })}
                      {status === "done" && t("sub_status_done")}
                      {status === "error" && t("sub_status_error")}
                    </span>
                    {status !== "done" && status !== "error" && (
                      <span className="font-mono">{Math.round(progress)}%</span>
                    )}
                  </div>
                  {(status === "loading_model" || status === "transcribing" || status === "decoding") && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900 mt-2">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-all duration-300"
                        style={{
                          width: `${status === "decoding" ? 25 : progress || 5}%`,
                        }}
                      />
                    </div>
                  )}
                  {error && (
                    <p className="mt-2 text-[10px] text-red-400 leading-normal">{error}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTranscribe}
                  disabled={status !== "idle" && status !== "done" && status !== "error"}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-300 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-cyan-200 transition disabled:opacity-50 cursor-pointer"
                >
                  {status === "decoding" || status === "loading_model" || status === "transcribing" ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border border-neutral-950 border-t-transparent inline-block" />
                      <span>{t("sub_btn_burn_in_rendering")}</span>
                    </>
                  ) : (
                    <span>{t("sub_btn_transcribe")}</span>
                  )}
                </button>

                {file && file.type.startsWith("video/") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSharedFile(file);
                      router.push("/video-processor");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-cyan-500/30 bg-neutral-900/60 hover:bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-400 transition cursor-pointer"
                  >
                    ✂️ {t("video_choice_cutter") || "Cắt Video"}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setFile(null);
                    setSegments([]);
                    setStatus("idle");
                  }}
                  className="w-full text-center py-2 text-xs text-neutral-500 hover:text-neutral-300 transition cursor-pointer"
                >
                  {t("sub_btn_change_file") || "Hủy và tải file khác"}
                </button>
              </div>
            </div>

            {/* Burn-in Subtitles Section */}
            {segments.length > 0 && file.type.startsWith("video/") && (
              <div className="rounded-lg border border-white/10 bg-neutral-950 p-4 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Chèn phụ đề vào video (Burn-in)
                </h4>
                <p className="text-[10px] text-neutral-500 leading-normal">
                  Chèn cứng phụ đề trực tiếp vào video bằng FFmpeg.wasm. Video xuất ra sẽ tự động đính kèm chữ.
                </p>

                {burnInStatus !== "idle" && (
                  <div className="rounded-md border border-white/5 bg-white/[0.02] p-3 text-xs">
                    <div className="flex items-center justify-between text-neutral-300 mb-1">
                      <span>
                        {burnInStatus === "processing" && t("sub_btn_burn_in_rendering")}
                        {burnInStatus === "done" && "Hoàn thành ghép phụ đề!"}
                        {burnInStatus === "error" && "Không thể chèn phụ đề."}
                      </span>
                      {burnInStatus === "processing" && <span className="font-mono">{burnInProgress}%</span>}
                    </div>
                    {burnInStatus === "processing" && (
                      <div className="h-1 overflow-hidden rounded-full bg-neutral-900 mt-1">
                        <div className="h-full bg-cyan-300 transition-all duration-300" style={{ width: `${burnInProgress}%` }} />
                      </div>
                    )}
                    {burnInError && <p className="text-[9px] text-red-400 mt-1">{burnInError}</p>}
                  </div>
                )}

                {burnedVideoUrl && (
                  <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">
                      {file.name.replace(/\.[^/.]+$/, "")}_subbed.mp4
                    </span>
                    <a
                      href={burnedVideoUrl}
                      download={`${file.name.replace(/\.[^/.]+$/, "")}_subbed.mp4`}
                      className="shrink-0 rounded bg-cyan-300 px-3 py-1 text-[10px] font-bold text-neutral-950 hover:bg-cyan-200 transition cursor-pointer"
                    >
                      Tải Video
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleBurnInSubtitles}
                  disabled={burnInStatus === "processing"}
                  className="rounded border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:border-cyan-300 hover:text-cyan-200 transition disabled:opacity-50 cursor-pointer"
                >
                  {t("sub_btn_burn_in")}
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Subtitle Segment List & Exporter */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{t("sub_editor_title", { count: segments.length })}</h3>
                <p className="text-[10px] text-neutral-400 mt-0.5">Bấm vào câu phụ đề để nhảy player đến mốc phát</p>
              </div>
              <button
                type="button"
                onClick={handleAddSegment}
                className="rounded bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-300/20 transition cursor-pointer"
              >
                + {t("sub_editor_add_btn")}
              </button>
            </div>

            {/* List scrollbox */}
            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-3 pr-1 custom-scrollbar">
              {segments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/5 rounded-lg bg-neutral-950/20 text-neutral-500">
                  <svg className="h-8 w-8 mb-2 opacity-45" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                  </svg>
                  <p className="text-xs">{t("sub_editor_no_segments")}</p>
                </div>
              ) : (
                segments.map((seg, idx) => {
                  const isActive = activeSegment?.id === seg.id;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => seekTo(seg.start)}
                      className={[
                        "group relative rounded-lg border p-3 cursor-pointer transition flex flex-col gap-2.5",
                        isActive
                          ? "border-cyan-300/50 bg-cyan-300/[0.04] ring-1 ring-cyan-300/20"
                          : "border-white/5 bg-neutral-950/40 hover:border-white/15 hover:bg-neutral-900/40",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-neutral-500">
                          #{idx + 1} • <span className={isActive ? "text-cyan-300 font-bold" : ""}>{formatTimeVTT(seg.start)}</span>
                        </span>
                        
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => seekTo(seg.start)}
                            className="text-[9px] text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1"
                          >
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span>{t("sub_editor_sync_player")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 transition"
                          >
                            {t("sub_editor_btn_delete")}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <label className="text-[9px] text-neutral-500">Start (sec)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={Number(seg.start.toFixed(1))}
                            onChange={(e) => handleUpdateSegment(seg.id, { start: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full rounded bg-neutral-900 border border-white/10 px-2 py-0.5 text-xs text-white outline-none focus:border-cyan-300"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-neutral-500">End (sec)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={Number(seg.end.toFixed(1))}
                            onChange={(e) => handleUpdateSegment(seg.id, { end: Math.max(0, parseFloat(e.target.value) || 0) })}
                            className="w-full rounded bg-neutral-900 border border-white/10 px-2 py-0.5 text-xs text-white outline-none focus:border-cyan-300"
                          />
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <textarea
                          rows={2}
                          value={seg.text}
                          onChange={(e) => handleUpdateSegment(seg.id, { text: e.target.value })}
                          className="w-full rounded bg-neutral-900 border border-white/10 p-2 text-xs text-white outline-none focus:border-cyan-300 resize-none"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Export buttons */}
            {segments.length > 0 && (
              <div className="border-t border-white/10 pt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadFile(generateSRT(), `${file.name.replace(/\.[^/.]+$/, "")}.srt`, "text/srt")}
                  className="rounded bg-cyan-300 px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-cyan-200 cursor-pointer"
                >
                  {t("sub_btn_download_srt")}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(generateVTT(), `${file.name.replace(/\.[^/.]+$/, "")}.vtt`, "text/vtt")}
                  className="rounded border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  {t("sub_btn_download_vtt")}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(generateTXT(), `${file.name.replace(/\.[^/.]+$/, "")}.txt`, "text/plain")}
                  className="rounded border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  {t("sub_btn_download_txt")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
