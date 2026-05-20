"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OutputFormat = "mp4" | "webm" | "gif" | "mp3";
type ProcessorStatus = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type DragHandle = "start" | "end";

type VideoResult = {
  fileName: string;
  size: number;
  url: string;
};

const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const FFMPEG_ASSET_BASE_URL = "/ffmpeg";
const MIN_CLIP_DURATION = 0.25;

export default function VideoProcessor() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekFrameRef = useRef<number | null>(null);

  const [status, setStatus] = useState<ProcessorStatus>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("mp4");
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [duration, setDuration] = useState(0);
  const [selection, setSelection] = useState<[number, number]>([0, 0]);
  const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Chọn video để bắt đầu.");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  useEffect(() => {
    return () => {
      if (seekFrameRef.current) cancelAnimationFrame(seekFrameRef.current);
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      ffmpegRef.current?.terminate();
    };
  }, []);

  const canProcess = useMemo(
    () =>
      Boolean(selectedFile) &&
      isFFmpegLoaded &&
      duration > 0 &&
      selection[1] > selection[0] &&
      status !== "processing",
    [duration, isFFmpegLoaded, selectedFile, selection, status],
  );

  const processButtonLabel = useMemo(() => {
    if (status === "loading") return "Đang khởi tạo bộ xử lý...";
    if (status === "processing") return "Đang render...";
    return "Cắt và Tải về";
  }, [status]);

  const clipDuration = Math.max(0, selection[1] - selection[0]);

  const seekPreview = useCallback((time: number) => {
    if (seekFrameRef.current) cancelAnimationFrame(seekFrameRef.current);

    seekFrameRef.current = requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = clamp(time, 0, video.duration || time);
    });
  }, []);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;

    setStatus("loading");
    setError(null);
    setProgress(0);
    setMessage("Đang tải FFmpeg WebAssembly...");

    try {
      const ffmpeg = new FFmpeg();
      const assetBaseUrl = `${window.location.origin}${FFMPEG_ASSET_BASE_URL}`;

      ffmpeg.on("progress", ({ progress: ffmpegProgress }) => {
        setProgress(clamp(ffmpegProgress * 100, 0, 100));
      });

      await ffmpeg.load({
        classWorkerURL: `${assetBaseUrl}/worker.js`,
        coreURL: `${assetBaseUrl}/ffmpeg-core.js`,
        wasmURL: `${assetBaseUrl}/ffmpeg-core.wasm`,
      });

      ffmpegRef.current = ffmpeg;
      setIsFFmpegLoaded(true);
      setStatus("ready");
      setProgress(100);
      setMessage("Bộ xử lý đã sẵn sàng.");
      return ffmpeg;
    } catch (loadError) {
      setStatus("error");
      setIsFFmpegLoaded(false);
      setProgress(0);
      setMessage("Không thể tải FFmpeg.");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải FFmpeg WebAssembly. Vui lòng thử lại.",
      );
      throw loadError;
    }
  }, []);

  const startFFmpegInBackground = useCallback(() => {
    void loadFFmpeg().catch(() => {
      // The error state is set inside loadFFmpeg.
    });
  }, [loadFFmpeg]);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const file = Array.from(fileList)[0];
      if (!file) return;

      setError(null);
      setResult(null);
      setProgress(0);
      setDuration(0);
      setSelection([0, 0]);
      setActiveHandle(null);

      if (!ACCEPTED_VIDEO_TYPES.has(file.type)) {
        setSelectedFile(null);
        setPreviewUrl(null);
        setStatus("error");
        setMessage("File không hợp lệ.");
        setError("Định dạng không hợp lệ. Vui lòng chọn MP4, MOV hoặc WebM.");
        return;
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const nextPreviewUrl = URL.createObjectURL(file);
      previewUrlRef.current = nextPreviewUrl;

      setSelectedFile(file);
      setPreviewUrl(nextPreviewUrl);
      if (isFFmpegLoaded) {
        setStatus("ready");
        setMessage("Bộ xử lý đã sẵn sàng.");
      } else {
        setStatus("loading");
        setMessage("Đang khởi tạo bộ xử lý...");
        startFFmpegInBackground();
      }
    },
    [isFFmpegLoaded, startFFmpegInBackground],
  );

  const handleLoadedMetadata = useCallback(() => {
    const videoDuration = videoRef.current?.duration ?? 0;
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
      setDuration(0);
      setSelection([0, 0]);
      setError("Không đọc được thời lượng video. Hãy thử file khác.");
      return;
    }

    setDuration(videoDuration);
    setSelection([0, videoDuration]);
    seekPreview(0);
  }, [seekPreview]);

  const updateSelection = useCallback(
    (handle: DragHandle, rawValue: number) => {
      if (duration <= 0 || status === "processing") return;

      setActiveHandle(handle);
      setSelection(([currentStart, currentEnd]) => {
        const value = clamp(rawValue, 0, duration);
        const nextSelection: [number, number] =
          handle === "start"
            ? [Math.min(value, currentEnd - MIN_CLIP_DURATION), currentEnd]
            : [currentStart, Math.max(value, currentStart + MIN_CLIP_DURATION)];

        seekPreview(handle === "start" ? nextSelection[0] : nextSelection[1]);
        return nextSelection;
      });
    },
    [duration, seekPreview, status],
  );

  const processVideo = useCallback(async () => {
    if (!selectedFile) {
      setError("Vui lòng chọn video trước khi xử lý.");
      return;
    }

    if (duration <= 0 || selection[1] <= selection[0]) {
      setError("Vùng cắt chưa hợp lệ. Hãy kéo timeline để chọn đoạn video.");
      return;
    }

    setStatus("processing");
    setError(null);
    setResult(null);
    setProgress(0);
    setMessage("Đang chuẩn bị render...");

    const ffmpeg = await loadFFmpeg();
    const inputName = `input.${extensionFromFile(selectedFile)}`;
    const outputName = `medianinja-${Date.now()}.${outputFormat}`;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      const args = buildFFmpegArgs({
        inputName,
        muteAudio: outputFormat !== "mp3" && muteOriginalAudio,
        outputName,
        outputFormat,
        startTime: selection[0],
        endTime: selection[1],
      });

      setMessage(messageForFormat(outputFormat));

      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg kết thúc với mã lỗi ${exitCode}.`);
      }

      const outputData = await ffmpeg.readFile(outputName);
      const outputBytes =
        typeof outputData === "string" ? new TextEncoder().encode(outputData) : outputData;
      const blob = new Blob([toArrayBuffer(outputBytes)], {
        type: mimeTypeForFormat(outputFormat),
      });

      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;

      setResult({
        fileName: outputName,
        size: blob.size,
        url,
      });
      setStatus("done");
      setProgress(100);
      setMessage("Render hoàn tất.");

      await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
    } catch (processError) {
      setStatus("error");
      setProgress(0);
      setMessage("Render thất bại.");
      setError(
        processError instanceof Error
          ? processError.message
          : "Không thể xử lý video. Hãy thử file ngắn hơn hoặc định dạng khác.",
      );
      await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);
    }
  }, [duration, loadFFmpeg, muteOriginalAudio, outputFormat, selectedFile, selection]);

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/10 bg-neutral-900/80 p-4 sm:p-6">
      {status === "processing" ? <RenderingOverlay progress={progress} message={message} /> : null}

      {!previewUrl ? (
        <UploadPanel
          inputRef={inputRef}
          isDraggingFile={isDraggingFile}
          onDragStateChange={setIsDraggingFile}
          onFiles={handleFiles}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-black">
              <video
                className="aspect-video w-full bg-black object-contain"
                controls
                onLoadedMetadata={handleLoadedMetadata}
                ref={videoRef}
                src={previewUrl}
              />
            </div>

            <TimelineEditor
              activeHandle={activeHandle}
              duration={duration}
              endTime={selection[1]}
              onChange={updateSelection}
              onRelease={() => setActiveHandle(null)}
              startTime={selection[0]}
            />

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-neutral-200">{selectedFile?.name}</p>
                <p className="mt-1 text-neutral-500">
                  {selectedFile ? formatBytes(selectedFile.size) : ""} • Đoạn cắt{" "}
                  {formatDuration(clipDuration)}
                </p>
              </div>
              <button
                className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/70 hover:text-cyan-200"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                Đổi video
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-base font-semibold text-white">Xuất file</h3>

            <div className="mt-4">
              <label className="text-sm font-medium text-neutral-300" htmlFor="output-format">
                Định dạng
              </label>
              <select
                className="mt-2 w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                id="output-format"
                onChange={(event) => {
                  const nextFormat = event.target.value as OutputFormat;
                  setOutputFormat(nextFormat);
                  if (nextFormat === "mp3") setMuteOriginalAudio(false);
                }}
                value={outputFormat}
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="gif">GIF (Tạo ảnh động)</option>
                <option value="mp3">MP3 (Chỉ lấy âm thanh)</option>
              </select>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-md bg-neutral-950 p-3 text-sm text-neutral-300">
              <input
                checked={muteOriginalAudio}
                className="h-4 w-4 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={outputFormat === "mp3"}
                onChange={(event) => setMuteOriginalAudio(event.target.checked)}
                type="checkbox"
              />
              <span>Tắt âm thanh gốc</span>
            </label>

            <div className="mt-4 rounded-md bg-neutral-950 p-3 text-sm text-neutral-300">
              <div className="flex items-center justify-between">
                <span>Start</span>
                <span className="font-medium text-white">{formatTimestamp(selection[0])}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>End</span>
                <span className="font-medium text-white">{formatTimestamp(selection[1])}</span>
              </div>
            </div>

            <button
              className="mt-5 w-full rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canProcess}
              onClick={() => void processVideo()}
              type="button"
            >
              {processButtonLabel}
            </button>
          </aside>
        </div>
      )}

      <input
        accept="video/mp4,video/quicktime,video/webm"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <StatusPanel error={error} message={message} progress={progress} status={status} />

      {result ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-100">{result.fileName}</p>
            <p className="mt-1 text-xs text-emerald-200/80">{formatBytes(result.size)}</p>
          </div>
          <a
            className="rounded-md bg-cyan-300 px-4 py-2 text-center text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200"
            download={result.fileName}
            href={result.url}
          >
            Download
          </a>
        </div>
      ) : null}
    </section>
  );
}

function UploadPanel({
  inputRef,
  isDraggingFile,
  onDragStateChange,
  onFiles,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDraggingFile: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  onFiles: (fileList: FileList | File[]) => void;
}) {
  return (
    <div
      className={[
        "flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition",
        isDraggingFile
          ? "border-cyan-300 bg-cyan-300/10"
          : "border-white/15 bg-neutral-950 hover:border-white/30 hover:bg-neutral-950/70",
      ].join(" ")}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragStateChange(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDragStateChange(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
        <VideoIcon />
      </div>
      <p className="text-xl font-semibold text-white">Chọn video để cắt trực quan</p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
        Hỗ trợ MP4, MOV và WebM. Video chạy cục bộ trong trình duyệt bằng FFmpeg.wasm,
        không upload lên server.
      </p>
      <button
        className="mt-7 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-neutral-950"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        Chọn video
      </button>
    </div>
  );
}

function TimelineEditor({
  activeHandle,
  duration,
  endTime,
  onChange,
  onRelease,
  startTime,
}: {
  activeHandle: DragHandle | null;
  duration: number;
  endTime: number;
  onChange: (handle: DragHandle, value: number) => void;
  onRelease: () => void;
  startTime: number;
}) {
  const safeDuration = Math.max(duration, MIN_CLIP_DURATION);
  const startPercent = (startTime / safeDuration) * 100;
  const endPercent = (endTime / safeDuration) * 100;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<DragHandle | null>(null);

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;

      const rect = track.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      return percent * duration;
    },
    [duration],
  );

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement | HTMLDivElement>, handle?: DragHandle) => {
      const pointerValue = valueFromPointer(event.clientX);
      const nextHandle =
        handle ?? (Math.abs(pointerValue - startTime) <= Math.abs(pointerValue - endTime) ? "start" : "end");

      dragHandleRef.current = nextHandle;
      event.currentTarget.setPointerCapture(event.pointerId);
      onChange(nextHandle, pointerValue);
    },
    [endTime, onChange, startTime, valueFromPointer],
  );

  const continueDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragHandleRef.current) return;
      onChange(dragHandleRef.current, valueFromPointer(event.clientX));
    },
    [onChange, valueFromPointer],
  );

  const endDrag = useCallback(() => {
    dragHandleRef.current = null;
    onRelease();
  }, [onRelease]);

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-white">Timeline</span>
        <span className="text-neutral-400">{formatTimestamp(duration)}</span>
      </div>

      <div
        className="relative h-14 touch-none"
        onPointerCancel={endDrag}
        onPointerDown={(event) => beginDrag(event)}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        ref={trackRef}
      >
        <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-neutral-950" />
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-cyan-300"
          style={{
            left: `${startPercent}%`,
            right: `${100 - endPercent}%`,
          }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-8 w-px -translate-y-1/2 bg-white/30"
          style={{ left: `${startPercent}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-8 w-px -translate-y-1/2 bg-white/30"
          style={{ left: `${endPercent}%` }}
        />
        <button
          aria-label="Start trim handle"
          aria-valuemax={Math.max(0, endTime - MIN_CLIP_DURATION)}
          aria-valuemin={0}
          aria-valuenow={Number(startTime.toFixed(2))}
          className="absolute top-1/2 z-20 h-9 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-cyan-300 shadow-lg shadow-cyan-950/50 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") onChange("start", startTime - 0.1);
            if (event.key === "ArrowRight") onChange("start", startTime + 0.1);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            beginDrag(event, "start");
          }}
          role="slider"
          style={{ left: `${startPercent}%` }}
          type="button"
        />
        <button
          aria-label="End trim handle"
          aria-valuemax={duration}
          aria-valuemin={Math.min(duration, startTime + MIN_CLIP_DURATION)}
          aria-valuenow={Number(endTime.toFixed(2))}
          className="absolute top-1/2 z-20 h-9 w-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-cyan-300 shadow-lg shadow-cyan-950/50 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") onChange("end", endTime - 0.1);
            if (event.key === "ArrowRight") onChange("end", endTime + 0.1);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            beginDrag(event, "end");
          }}
          role="slider"
          style={{ left: `${endPercent}%` }}
          type="button"
        />
        <span
          className={[
            "pointer-events-none absolute -top-1 -translate-x-1/2 rounded bg-neutral-800 px-2 py-1 text-xs font-medium text-white shadow",
            activeHandle === "end" ? "z-20" : "z-10",
          ].join(" ")}
          style={{ left: `${activeHandle === "end" ? endPercent : startPercent}%` }}
        >
          {formatTimestamp(activeHandle === "end" ? endTime : startTime)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
        <span>{formatTimestamp(startTime)}</span>
        <span>Đoạn cắt {formatDuration(endTime - startTime)}</span>
        <span>{formatTimestamp(endTime)}</span>
      </div>
    </div>
  );
}

function StatusPanel({
  error,
  message,
  progress,
  status,
}: {
  error: string | null;
  message: string;
  progress: number;
  status: ProcessorStatus;
}) {
  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-white">{message}</p>
        <p className="text-sm text-neutral-400">{Math.round(progress)}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-950">
        <div
          className={[
            "h-full rounded-full transition-all",
            status === "error" ? "bg-red-300" : "bg-cyan-300",
          ].join(" ")}
          style={{ width: `${clamp(progress, 0, 100)}%` }}
        />
      </div>
      {error ? (
        <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RenderingOverlay({ message, progress }: { message: string; progress: number }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-neutral-950/80 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-neutral-900 p-5 text-center shadow-2xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-white">{message}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-950">
          <div
            className="h-full rounded-full bg-cyan-300 transition-all"
            style={{ width: `${clamp(progress, 0, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-400">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

function buildFFmpegArgs({
  inputName,
  muteAudio,
  outputName,
  outputFormat,
  startTime,
  endTime,
}: {
  inputName: string;
  muteAudio: boolean;
  outputName: string;
  outputFormat: OutputFormat;
  startTime: number;
  endTime: number;
}) {
  const args = ["-ss", startTime.toFixed(2), "-i", inputName, "-t", (endTime - startTime).toFixed(2)];

  if (outputFormat === "mp3") {
    args.push("-vn", "-acodec", "libmp3lame", "-b:a", "192k", "-f", "mp3", outputName);
    return args;
  }

  if (outputFormat === "gif") {
    args.push(
      "-vf",
      "fps=15,scale=480:-1:flags=lanczos",
      "-an",
      "-loop",
      "0",
      "-f",
      "gif",
      outputName,
    );
    return args;
  }

  if (outputFormat === "mp4") {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23");
    if (muteAudio) {
      args.push("-an");
    } else {
      args.push("-c:a", "aac", "-b:a", "128k");
    }
    args.push("-movflags", "faststart", "-f", "mp4", outputName);
    return args;
  }

  args.push("-c:v", "libvpx-vp9", "-b:v", "1M");
  if (muteAudio) {
    args.push("-an");
  } else {
    args.push("-c:a", "libopus", "-b:a", "96k");
  }
  args.push("-f", "webm", outputName);
  return args;
}

function extensionFromFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension) return extension.replace(/[^a-z0-9]/g, "") || "mp4";
  if (file.type === "video/webm") return "webm";
  if (file.type === "video/quicktime") return "mov";
  return "mp4";
}

function mimeTypeForFormat(format: OutputFormat) {
  if (format === "gif") return "image/gif";
  if (format === "mp3") return "audio/mpeg";
  if (format === "mp4") return "video/mp4";
  return "video/webm";
}

function messageForFormat(format: OutputFormat) {
  if (format === "gif") return "Đang render GIF 15fps...";
  if (format === "mp3") return "Đang trích xuất âm thanh MP3...";
  if (format === "mp4") return "Đang render MP4...";
  return "Đang render WebM...";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTimestamp(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.0";

  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${tenths}`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

function VideoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m15 10 4.5-2.5v9L15 14" />
      <rect height="12" rx="2" width="13" x="3" y="6" />
    </svg>
  );
}
