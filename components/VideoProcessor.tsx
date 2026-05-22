"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

type OutputFormat = "mp4" | "webm" | "gif" | "mp3";
type ProcessorStatus = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type DragHandle = "start" | "end";

type ErrorState = string | { key: string; variables?: Record<string, string | number> } | null;

export type BlurBox = {
  id: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w: number; // percentage (0-100)
  h: number; // percentage (0-100)
  start: number; // seconds
  end: number; // seconds
};

type ProcessedVideo = {
  id: string;
  originalFile: File;
  displayName: string;
  previewUrl: string;
  status: ProcessorStatus;
  progress: number;
  duration: number;
  selection: [number, number];
  outputFormat: OutputFormat;
  muteAudio: boolean;
  useFastCut: boolean;
  outputSize?: number;
  outputFile?: File;
  downloadUrl?: string;
  error?: string | null;
  videoWarning?: string | null;
  aspectRatio?: "original" | "9:16-center" | "9:16-left" | "9:16-right" | "1:1";
  denoiseAudio?: boolean;
  blurBoxes?: BlurBox[];
};

const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const FFMPEG_ASSET_BASE_URL = "/ffmpeg";
const MIN_CLIP_DURATION = 0.25;

export default function VideoProcessor() {
  const { t, language } = useLanguage();
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekFrameRef = useRef<number | null>(null);
  const createdUrlsRef = useRef<Set<string>>(new Set());
  const currentProcessingVideoIdRef = useRef<string | null>(null);

  const [videos, setVideos] = useState<ProcessedVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // FFmpeg status
  const [status, setStatus] = useState<ProcessorStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("vid_status_select");
  const [error, setError] = useState<ErrorState>(null);
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  // Interaction status
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null);
  const [isPlayingSelection, setIsPlayingSelection] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);

  // Crop & Blur interactive overlays
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const activeVideo = useMemo(() => {
    if (activeIndex === null || activeIndex >= videos.length) return null;
    return videos[activeIndex];
  }, [videos, activeIndex]);

  const isSameFormat = useMemo(() => {
    if (!activeVideo) return false;
    const ext = extensionFromFile(activeVideo.originalFile);
    return ext === activeVideo.outputFormat;
  }, [activeVideo]);

  const updateVideoRect = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setVideoRect(null);
      return;
    }
    const containerWidth = video.clientWidth;
    const containerHeight = video.clientHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = containerWidth / containerHeight;

    let width = containerWidth;
    let height = containerHeight;
    let left = 0;
    let top = 0;

    if (videoRatio > containerRatio) {
      height = containerWidth / videoRatio;
      top = (containerHeight - height) / 2;
    } else {
      width = containerHeight * videoRatio;
      left = (containerWidth - width) / 2;
    }
    setVideoRect({ left, top, width, height });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleResize = () => {
      updateVideoRect();
    };

    window.addEventListener("resize", handleResize);
    video.addEventListener("loadedmetadata", updateVideoRect);

    return () => {
      window.removeEventListener("resize", handleResize);
      video.removeEventListener("loadedmetadata", updateVideoRect);
    };
  }, [activeVideo?.id, updateVideoRect]);

  // Helper track created object URLs for cleanup
  const trackUrl = (url: string) => {
    createdUrlsRef.current.add(url);
  };

  useEffect(() => {
    const urls = createdUrlsRef.current;
    const ffmpeg = ffmpegRef.current;
    return () => {
      if (seekFrameRef.current) cancelAnimationFrame(seekFrameRef.current);
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      ffmpeg?.terminate();
    };
  }, []);


  const updateActiveVideo = useCallback((patch: Partial<ProcessedVideo>) => {
    if (activeIndex === null) return;
    setVideos((currentItems) =>
      currentItems.map((item, idx) => (idx === activeIndex ? { ...item, ...patch } : item)),
    );
  }, [activeIndex]);

  const togglePlaySelection = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeVideo) return;

    if (isPlayingSelection) {
      video.pause();
      setIsPlayingSelection(false);
    } else {
      video.currentTime = activeVideo.selection[0];
      void video.play().then(() => {
        setIsPlayingSelection(true);
      }).catch(() => {
        setIsPlayingSelection(false);
      });
    }
  }, [isPlayingSelection, activeVideo]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeVideo) return;

    setCurrentTime(video.currentTime);

    if (!isPlayingSelection) return;

    if (video.currentTime >= activeVideo.selection[1] || video.currentTime < activeVideo.selection[0]) {
      if (loopSelection) {
        video.currentTime = activeVideo.selection[0];
      } else {
        video.pause();
        setIsPlayingSelection(false);
        video.currentTime = activeVideo.selection[0];
      }
    }
  }, [isPlayingSelection, activeVideo, loopSelection]);

  const handlePause = useCallback(() => {
    setIsPlayingSelection(false);
  }, []);

  // Blur boxes action handlers
  const updateBlurBox = useCallback((boxId: string, patch: Partial<BlurBox>) => {
    if (activeIndex === null || !activeVideo || !activeVideo.blurBoxes) return;
    const updatedBoxes = activeVideo.blurBoxes.map((box) =>
      box.id === boxId ? { ...box, ...patch } : box
    );
    updateActiveVideo({ blurBoxes: updatedBoxes });
  }, [activeIndex, activeVideo, updateActiveVideo]);

  const handleBlurBoxDragStart = useCallback((e: React.PointerEvent, boxId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!videoRect || !activeVideo?.blurBoxes) return;

    const box = activeVideo.blurBoxes.find((b) => b.id === boxId);
    if (!box) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialBoxX = box.x;
    const initialBoxY = box.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / videoRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / videoRect.height) * 100;

      const nextX = clamp(initialBoxX + deltaX, 0, 100 - box.w);
      const nextY = clamp(initialBoxY + deltaY, 0, 100 - box.h);

      updateBlurBox(boxId, { x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [videoRect, activeVideo, updateBlurBox]);

  const handleBlurBoxResizeStart = useCallback((e: React.PointerEvent, boxId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!videoRect || !activeVideo?.blurBoxes) return;

    const box = activeVideo.blurBoxes.find((b) => b.id === boxId);
    if (!box) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = box.w;
    const initialH = box.h;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / videoRect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / videoRect.height) * 100;

      const nextW = clamp(initialW + deltaX, 5, 100 - box.x);
      const nextH = clamp(initialH + deltaY, 5, 100 - box.y);

      updateBlurBox(boxId, { w: nextW, h: nextH });
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [videoRect, activeVideo, updateBlurBox]);

  const addBlurBox = useCallback(() => {
    if (!activeVideo) return;
    const newBox: BlurBox = {
      id: crypto.randomUUID(),
      x: 25,
      y: 25,
      w: 30,
      h: 30,
      start: activeVideo.selection[0],
      end: activeVideo.selection[1],
    };
    const updatedBoxes = [...(activeVideo.blurBoxes || []), newBox];
    updateActiveVideo({ blurBoxes: updatedBoxes });
  }, [activeVideo, updateActiveVideo]);

  const removeBlurBox = useCallback((boxId: string) => {
    if (!activeVideo || !activeVideo.blurBoxes) return;
    const updatedBoxes = activeVideo.blurBoxes.filter((box) => box.id !== boxId);
    updateActiveVideo({ blurBoxes: updatedBoxes });
  }, [activeVideo, updateActiveVideo]);

  const clipDuration = useMemo(() => {
    if (!activeVideo) return 0;
    return Math.max(0, activeVideo.selection[1] - activeVideo.selection[0]);
  }, [activeVideo]);

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
    setMessage("vid_status_loading");

    try {
      const ffmpeg = new FFmpeg();
      const assetBaseUrl = `${window.location.origin}${FFMPEG_ASSET_BASE_URL}`;

      ffmpeg.on("progress", ({ progress: ffmpegProgress }) => {
        const pct = clamp(ffmpegProgress * 100, 0, 100);
        setProgress(pct);
        if (currentProcessingVideoIdRef.current) {
          const vidId = currentProcessingVideoIdRef.current;
          setVideos((current) =>
            current.map((v) => (v.id === vidId ? { ...v, progress: pct } : v))
          );
        }
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
      setMessage("vid_status_ready");
      return ffmpeg;
    } catch (loadError) {
      setStatus("error");
      setIsFFmpegLoaded(false);
      setProgress(0);
      setMessage("vid_status_error");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "vid_err_ffmpeg_load_failed",
      );
      throw loadError;
    }
  }, []);

  const startFFmpegInBackground = useCallback(() => {
    void loadFFmpeg().catch(() => {
      // Handled inside loadFFmpeg
    });
  }, [loadFFmpeg]);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const selectedFiles = Array.from(fileList);
      if (selectedFiles.length === 0) return;

      setError(null);
      const newProcessedVideos: ProcessedVideo[] = [];

      for (const file of selectedFiles) {
        if (!ACCEPTED_VIDEO_TYPES.has(file.type)) {
          setError("vid_err_invalid_type");
          continue;
        }

        // Size check >300MB
        if (file.size > 300 * 1024 * 1024) {
          setError({ key: "vid_err_too_large", variables: { name: file.name } });
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        trackUrl(previewUrl);

        let videoWarning = null;
        if (file.size > 150 * 1024 * 1024) {
          videoWarning = "vid_editor_warning_150mb";
        }

        newProcessedVideos.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          originalFile: file,
          displayName: file.name,
          previewUrl,
          status: "idle",
          progress: 0,
          duration: 0,
          selection: [0, 0],
          outputFormat: "mp4",
          muteAudio: false,
          useFastCut: true,
          videoWarning,
          aspectRatio: "original",
          denoiseAudio: false,
          blurBoxes: [],
        });
      }

      if (newProcessedVideos.length === 0) return;

      setVideos((current) => {
        const next = [...current, ...newProcessedVideos];
        if (activeIndex === null) {
          setActiveIndex(current.length);
        }
        return next;
      });

      if (!isFFmpegLoaded) {
        startFFmpegInBackground();
      }
    },
    [activeIndex, isFFmpegLoaded, startFFmpegInBackground],
  );

  const handleLoadedMetadata = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || activeIndex === null) return;

    const videoDuration = videoElement.duration ?? 0;
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
      updateActiveVideo({ error: "vid_err_duration_failed" });
      return;
    }

    let targetSeek = 0;
    setVideos((current) =>
      current.map((v, i) => {
        if (i === activeIndex) {
          const nextDuration = v.duration || videoDuration;
          const nextSelection = v.selection[1] === 0 ? [0, videoDuration] as [number, number] : v.selection;
          targetSeek = nextSelection[0];
          return {
            ...v,
            duration: nextDuration,
            selection: nextSelection,
          };
        }
        return v;
      })
    );
    seekPreview(targetSeek);
  }, [activeIndex, seekPreview, updateActiveVideo]);

  const updateSelection = useCallback(
    (handle: DragHandle, rawValue: number) => {
      if (activeIndex === null || !activeVideo) return;
      if (activeVideo.duration <= 0 || activeVideo.status === "processing" || isProcessingQueue) return;

      setIsPlayingSelection(false);
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }

      setActiveHandle(handle);
      const value = clamp(rawValue, 0, activeVideo.duration);
      const currentStart = activeVideo.selection[0];
      const currentEnd = activeVideo.selection[1];

      const nextSelection: [number, number] =
        handle === "start"
          ? [Math.min(value, currentEnd - MIN_CLIP_DURATION), currentEnd]
          : [currentStart, Math.max(value, currentStart + MIN_CLIP_DURATION)];

      seekPreview(handle === "start" ? nextSelection[0] : nextSelection[1]);
      updateActiveVideo({ selection: nextSelection });
    },
    [activeIndex, activeVideo, seekPreview, updateActiveVideo, isProcessingQueue],
  );

  const removeVideo = useCallback((index: number) => {
    setVideos((current) => {
      const next = current.filter((_, i) => i !== index);
      const removedVideo = current[index];
      if (removedVideo) {
        URL.revokeObjectURL(removedVideo.previewUrl);
        if (removedVideo.downloadUrl) URL.revokeObjectURL(removedVideo.downloadUrl);
        createdUrlsRef.current.delete(removedVideo.previewUrl);
        if (removedVideo.downloadUrl) createdUrlsRef.current.delete(removedVideo.downloadUrl);
      }

      if (next.length === 0) {
        setActiveIndex(null);
      } else if (activeIndex === index) {
        setActiveIndex(Math.max(0, index - 1));
      } else if (activeIndex !== null && activeIndex > index) {
        setActiveIndex(activeIndex - 1);
      }
      return next;
    });
  }, [activeIndex]);

  const clearAllVideos = useCallback(() => {
    videos.forEach((video) => {
      URL.revokeObjectURL(video.previewUrl);
      if (video.downloadUrl) URL.revokeObjectURL(video.downloadUrl);
    });
    createdUrlsRef.current.clear();
    setVideos([]);
    setActiveIndex(null);
    setError(null);
  }, [videos]);

  const processQueue = useCallback(async () => {
    if (videos.length === 0) return;

    setIsProcessingQueue(true);
    setError(null);

    try {
      const ffmpeg = await loadFFmpeg();

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        if (video.status === "done") continue;

        currentProcessingVideoIdRef.current = video.id;

        setVideos((current) =>
          current.map((v) =>
            v.id === video.id
              ? { ...v, status: "processing", progress: 0, error: null }
              : v
          )
        );

        const ext = extensionFromFile(video.originalFile);
        const inputName = `input_${video.id}.${ext}`;
        const outputName = `output_${video.id}_${Date.now()}.${video.outputFormat}`;

        try {
          await ffmpeg.writeFile(inputName, await fetchFile(video.originalFile));

          const isSameExt = ext === video.outputFormat;
          const hasFilters = (video.aspectRatio && video.aspectRatio !== "original") || video.denoiseAudio || (video.blurBoxes && video.blurBoxes.length > 0);
          const isFastCutActive = isSameExt && video.useFastCut && !hasFilters;

          const args = buildFFmpegArgs({
            inputName,
            muteAudio: video.outputFormat !== "mp3" && video.muteAudio,
            outputName,
            outputFormat: video.outputFormat,
            startTime: video.selection[0],
            endTime: video.selection[1],
            useFastCut: isFastCutActive,
            aspectRatio: video.aspectRatio,
            denoiseAudio: video.denoiseAudio,
            blurBoxes: video.blurBoxes,
          });

          const exitCode = await ffmpeg.exec(args);
          if (exitCode !== 0) {
            throw new Error(`FFmpeg exited with error code ${exitCode}`);
          }

          const outputData = await ffmpeg.readFile(outputName);
          const outputBytes =
            typeof outputData === "string" ? new TextEncoder().encode(outputData) : outputData;
          const blob = new Blob([toArrayBuffer(outputBytes)], {
            type: mimeTypeForFormat(video.outputFormat),
          });

          const downloadUrl = URL.createObjectURL(blob);
          trackUrl(downloadUrl);

          setVideos((current) =>
            current.map((v) =>
              v.id === video.id
                ? {
                    ...v,
                    status: "done",
                    progress: 100,
                    outputSize: blob.size,
                    outputFile: new File([blob], withSuffix(video.originalFile.name, `trimmed.${video.outputFormat}`), { type: blob.type }),
                    downloadUrl,
                  }
                : v
            )
          );

          await Promise.allSettled([
            ffmpeg.deleteFile(inputName),
            ffmpeg.deleteFile(outputName),
          ]);
        } catch (videoError) {
          console.error(videoError);
          const errMsg = videoError instanceof Error ? videoError.message : "vid_err_failed";
          setVideos((current) =>
            current.map((v) =>
              v.id === video.id
                ? { ...v, status: "error", progress: 0, error: errMsg }
                : v
            )
          );

          await Promise.allSettled([
            ffmpeg.deleteFile(inputName),
            ffmpeg.deleteFile(outputName),
          ]);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "vid_err_startup");
    } finally {
      currentProcessingVideoIdRef.current = null;
      setIsProcessingQueue(false);
    }
  }, [videos, loadFFmpeg]);

  const downloadAllZip = useCallback(async () => {
    const doneVideos = videos.filter((v) => v.status === "done" && v.outputFile);
    if (doneVideos.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      doneVideos.forEach((v) => {
        if (v.outputFile) {
          zip.file(v.outputFile.name, v.outputFile);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      trackUrl(url);

      const link = document.createElement("a");
      link.href = url;
      link.download = "medianinja-videos.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (zipErr) {
      console.error(zipErr);
    } finally {
      setIsZipping(false);
    }
  }, [videos]);

  const currentProcessingVideo = useMemo(() => {
    return videos.find((v) => v.status === "processing");
  }, [videos]);

  const getCropOverlayStyle = useCallback(() => {
    if (!videoRect || !activeVideo?.aspectRatio || activeVideo.aspectRatio === "original") return {};

    const { left, top, width, height } = videoRect;
    let cropWidth = width;
    let cropHeight = height;
    let cropLeft = left;
    let cropTop = top;

    if (activeVideo.aspectRatio === "9:16-center") {
      cropWidth = height * 9 / 16;
      cropLeft = left + (width - cropWidth) / 2;
    } else if (activeVideo.aspectRatio === "9:16-left") {
      cropWidth = height * 9 / 16;
      cropLeft = left;
    } else if (activeVideo.aspectRatio === "9:16-right") {
      cropWidth = height * 9 / 16;
      cropLeft = left + width - cropWidth;
    } else if (activeVideo.aspectRatio === "1:1") {
      const minDim = Math.min(width, height);
      cropWidth = minDim;
      cropHeight = minDim;
      cropLeft = left + (width - minDim) / 2;
      cropTop = top + (height - minDim) / 2;
    }

    return {
      left: `${cropLeft}px`,
      top: `${cropTop}px`,
      width: `${cropWidth}px`,
      height: `${cropHeight}px`,
    };
  }, [videoRect, activeVideo]);

  const renderError = (err: ErrorState) => {
    if (!err) return null;
    if (typeof err === "string") {
      return err.startsWith("vid_") ? t(err) : err;
    }
    return t(err.key, err.variables);
  };

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/10 bg-neutral-900/80 p-4 sm:p-6">
      
      {/* Global processing warning or error banner */}
      {error && (
        <div className="mb-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200 flex justify-between items-center">
          <span>{renderError(error)}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-200">{t("vid_err_global_close")}</button>
        </div>
      )}

      {/* Global Queue Actions */}
      {videos.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between shadow-inner">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{t("vid_batch_title", { count: videos.length })}</h3>
            <p className="mt-1 text-xs text-neutral-400">
              {t("vid_batch_completed", { done: videos.filter((v) => v.status === "done").length, total: videos.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isProcessingQueue || videos.filter((v) => v.status !== "done").length === 0}
              onClick={processQueue}
              className="flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isProcessingQueue ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-neutral-950 border-t-transparent inline-block" />
                  <span>{t("vid_btn_rendering_queue")}</span>
                </>
              ) : (
                <span>{t("vid_btn_start")}</span>
              )}
            </button>
            <button
              type="button"
              disabled={isZipping || videos.filter((v) => v.status === "done").length === 0}
              onClick={downloadAllZip}
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isZipping ? t("vid_btn_zipping") : t("vid_btn_download_zip")}
            </button>
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <UploadPanel
          inputRef={inputRef}
          isDraggingFile={isDraggingFile}
          onDragStateChange={setIsDraggingFile}
          onFiles={handleFiles}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          {/* Left panel: Queue Sidebar List */}
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">{t("vid_queue_title")}</h3>
              <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
                {t("vid_queue_count", { count: videos.length })}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[350px] xl:max-h-[500px] space-y-2 pr-1 custom-scrollbar">
              {videos.map((video, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <div
                    key={video.id}
                    className={[
                      "group relative flex items-center justify-between gap-2 rounded-lg border p-3 cursor-pointer transition text-left",
                      isActive
                        ? "border-cyan-300/50 bg-cyan-300/[0.05]"
                        : "border-white/5 bg-neutral-950/40 hover:border-white/15 hover:bg-neutral-900/40",
                    ].join(" ")}
                    onClick={() => {
                      if (isProcessingQueue) return;
                      setActiveIndex(idx);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-50 font-mono">#{idx + 1}</span>
                        <p className="truncate text-xs font-semibold text-white group-hover:text-cyan-200 transition">
                          {video.displayName}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                        <span>{formatBytes(video.originalFile.size)}</span>
                        <span>•</span>
                        <span>{video.duration > 0 ? formatDuration(video.duration) : t("vid_queue_reading")}</span>
                      </div>

                      {/* Status and Progress bar */}
                      <div className="mt-2 flex items-center gap-1.5">
                        {video.status === "processing" && (
                          <div className="w-full">
                            <div className="flex justify-between text-[8px] text-cyan-300 font-medium mb-1">
                              <span>{t("vid_queue_rendering")}</span>
                              <span>{Math.round(video.progress)}%</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-neutral-900">
                              <div
                                className="h-full rounded-full bg-cyan-300 transition-all duration-100"
                                style={{ width: `${video.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {video.status === "done" && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-400">
                            <CheckIcon /> {t("vid_queue_done", { size: formatBytes(video.outputSize || 0) })}
                          </span>
                        )}
                        {video.status === "error" && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-red-400">
                            <ErrorIcon /> {t("vid_queue_error")}
                          </span>
                        )}
                        {video.status === "idle" && (
                          <span className="text-[9px] text-neutral-400">{t("vid_queue_pending")}</span>
                        )}
                      </div>
                    </div>

                    {/* Delete item button */}
                    {!isProcessingQueue && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded bg-neutral-900 hover:bg-red-950/50 hover:text-red-300 text-neutral-400 transition cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVideo(idx);
                        }}
                        aria-label={t("vid_queue_btn_remove")}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                disabled={isProcessingQueue}
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded bg-white/5 border border-white/15 px-2 py-2 text-xs font-semibold text-white hover:bg-white/10 transition cursor-pointer"
              >
                <PlusIcon /> {t("vid_queue_btn_add")}
              </button>
              <button
                type="button"
                disabled={isProcessingQueue || videos.length === 0}
                onClick={clearAllVideos}
                className="rounded bg-neutral-950 border border-white/5 px-2 py-2 text-xs font-semibold text-neutral-400 hover:border-red-950 hover:text-red-300 transition cursor-pointer"
              >
                {t("vid_queue_btn_clear")}
              </button>
            </div>
          </div>

          {/* Right panel: Active Video Editor */}
          <div className="relative min-w-0">
            {isProcessingQueue && currentProcessingVideo && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-neutral-950/80 p-6 backdrop-blur-sm rounded-lg">
                <div className="w-full max-w-sm rounded-lg border border-white/10 bg-neutral-900 p-5 text-center shadow-2xl">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  <p className="mt-4 text-sm font-semibold text-white">{t("vid_editor_overlay_rendering")}</p>
                  <p className="mt-1 text-xs text-neutral-400">{t("vid_editor_overlay_rendering_video", { name: currentProcessingVideo.displayName })}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-950">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-all duration-100"
                      style={{ width: `${currentProcessingVideo.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">{Math.round(currentProcessingVideo.progress)}%</p>
                </div>
              </div>
            )}

            {activeVideo ? (
              <div className="grid gap-5 xl:grid-cols-[1fr_240px]">
                <div className="min-w-0">
                  <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-black">
                    <video
                      key={activeVideo.id}
                      className="aspect-video w-full bg-black object-contain"
                      controls
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onPause={handlePause}
                      ref={videoRef}
                      src={activeVideo.previewUrl}
                    />

                    {/* Crop Overlay */}
                    {videoRect && activeVideo.aspectRatio && activeVideo.aspectRatio !== "original" && (
                      <div
                        className="absolute pointer-events-none border-2 border-dashed border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] z-10"
                        style={getCropOverlayStyle()}
                      />
                    )}

                    {/* Blur Boxes Overlay */}
                    {videoRect && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${videoRect.left}px`,
                          top: `${videoRect.top}px`,
                          width: `${videoRect.width}px`,
                          height: `${videoRect.height}px`,
                          zIndex: 20,
                        }}
                      >
                        {activeVideo.blurBoxes?.map((box, index) => {
                          const isActive = currentTime >= box.start && currentTime <= box.end;
                          return (
                            <div
                              key={box.id}
                              className={[
                                "absolute pointer-events-auto border group select-none transition-colors",
                                isActive
                                  ? "border-cyan-400 bg-cyan-400/20 backdrop-blur-[8px]"
                                  : "border-red-400/40 bg-red-400/5 opacity-60 border-dashed",
                              ].join(" ")}
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.w}%`,
                                height: `${box.h}%`,
                                cursor: "move",
                              }}
                              onPointerDown={(e) => handleBlurBoxDragStart(e, box.id)}
                            >
                              {/* Label */}
                              <div className="absolute top-1 left-1 bg-neutral-900/80 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-white pointer-events-none">
                                {index + 1}
                              </div>

                              {/* Resize Handle at Bottom-Right */}
                              <div
                                className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-cyan-400 cursor-se-resize flex items-center justify-center rounded-tl-sm border-t border-l border-white/20 hover:scale-110 active:scale-95 transition-transform"
                                onPointerDown={(e) => handleBlurBoxResizeStart(e, box.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Play Selection Controls */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-cyan-200 cursor-pointer"
                        onClick={togglePlaySelection}
                        type="button"
                        disabled={isProcessingQueue}
                      >
                        {isPlayingSelection ? (
                          <>
                            <PauseIcon />
                            <span>{t("vid_btn_pause_preview")}</span>
                          </>
                        ) : (
                          <>
                            <PlayIcon />
                            <span>{t("vid_btn_play_preview")}</span>
                          </>
                        )}
                      </button>

                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          checked={loopSelection}
                          className="h-3.5 w-3.5 accent-cyan-300 rounded"
                          onChange={(event) => setLoopSelection(event.target.checked)}
                          type="checkbox"
                          disabled={isProcessingQueue}
                        />
                        <span>{t("vid_editor_loop")}</span>
                      </label>
                    </div>

                    <div className="text-xs text-neutral-400">
                      {t("vid_editor_range", { start: formatTimestamp(activeVideo.selection[0]), end: formatTimestamp(activeVideo.selection[1]) })}
                    </div>
                  </div>

                  <TimelineEditor
                    activeHandle={activeHandle}
                    duration={activeVideo.duration}
                    endTime={activeVideo.selection[1]}
                    onChange={updateSelection}
                    onRelease={() => setActiveHandle(null)}
                    startTime={activeVideo.selection[0]}
                  />

                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-neutral-200">{activeVideo.displayName}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatBytes(activeVideo.originalFile.size)} • {t("vid_editor_trimmed_output", { duration: formatDuration(clipDuration) })}
                      </p>
                    </div>
                  </div>

                  {activeVideo.error && (
                    <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                      {activeVideo.error.startsWith("vid_") ? t(activeVideo.error) : activeVideo.error}
                    </p>
                  )}
                  {activeVideo.videoWarning && (
                    <p className="mt-4 rounded-md border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200">
                      {t(activeVideo.videoWarning)}
                    </p>
                  )}

                  {activeVideo.status === "done" && activeVideo.downloadUrl && (
                    <div className="mt-4 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-xs">
                          {withSuffix(activeVideo.originalFile.name, `trimmed.${activeVideo.outputFormat}`)}
                        </span>
                        <a
                          className="shrink-0 rounded bg-cyan-300 px-3 py-1 text-xs font-bold text-neutral-950 hover:bg-cyan-200 transition cursor-pointer"
                          download={withSuffix(activeVideo.originalFile.name, `trimmed.${activeVideo.outputFormat}`)}
                          href={activeVideo.downloadUrl}
                        >
                          {t("vid_editor_btn_download")}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{t("vid_config_title")}</h3>

                    <div className="mt-4">
                      <label className="text-xs font-medium text-neutral-300" htmlFor="output-format">
                        {t("vid_config_format")}
                      </label>
                      <select
                        className="mt-2 w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300"
                        id="output-format"
                        disabled={isProcessingQueue}
                        onChange={(event) => {
                          const nextFormat = event.target.value as OutputFormat;
                          handleFormatChange(nextFormat);
                        }}
                        value={activeVideo.outputFormat}
                      >
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                        <option value="gif">GIF {language === "vi" ? "(Tạo ảnh động)" : "(Animated)"}</option>
                        <option value="mp3">MP3 {language === "vi" ? "(Chỉ lấy âm thanh)" : "(Audio only)"}</option>
                      </select>
                    </div>

                    {/* Aspect Ratio (Crop) dropdown */}
                    {activeVideo.outputFormat !== "mp3" && (
                      <div className="mt-4">
                        <label className="text-xs font-medium text-neutral-300" htmlFor="aspect-ratio">
                          {t("vid_config_crop")}
                        </label>
                        <select
                          className="mt-2 w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300"
                          id="aspect-ratio"
                          disabled={isProcessingQueue}
                          onChange={(event) => {
                            updateActiveVideo({
                              aspectRatio: event.target.value as ProcessedVideo["aspectRatio"]
                            });
                          }}
                          value={activeVideo.aspectRatio || "original"}
                        >
                          <option value="original">{t("vid_config_crop_original")}</option>
                          <option value="9:16-center">{t("vid_config_crop_916_center")}</option>
                          <option value="9:16-left">{t("vid_config_crop_916_left")}</option>
                          <option value="9:16-right">{t("vid_config_crop_916_right")}</option>
                          <option value="1:1">{t("vid_config_crop_11")}</option>
                        </select>
                      </div>
                    )}

                    {activeVideo.outputFormat !== "mp3" && (
                      <label className="mt-4 flex items-center gap-3 rounded-md bg-neutral-950 p-3 text-xs text-neutral-300 cursor-pointer">
                        <input
                          checked={activeVideo.muteAudio}
                          className="h-4 w-4 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isProcessingQueue}
                          onChange={(event) => handleMuteChange(event.target.checked)}
                          type="checkbox"
                        />
                        <span>{t("vid_config_mute")}</span>
                      </label>
                    )}

                    {/* Audio Denoise checkbox */}
                    {activeVideo.outputFormat !== "gif" && (
                      <label className="mt-2 flex items-center gap-3 rounded-md bg-neutral-950 p-3 text-xs text-neutral-300 cursor-pointer">
                        <input
                          checked={!!activeVideo.denoiseAudio}
                          className="h-4 w-4 accent-cyan-300"
                          disabled={isProcessingQueue}
                          onChange={(event) => updateActiveVideo({ denoiseAudio: event.target.checked })}
                          type="checkbox"
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-cyan-200">{t("vid_config_denoise")}</span>
                          <span className="text-[9px] text-neutral-400 leading-tight mt-0.5">{t("vid_config_denoise_desc")}</span>
                        </div>
                      </label>
                    )}

                    {/* Fast Cut configuration */}
                    {isSameFormat && (
                      <div className="mt-2">
                        <label className={[
                          "flex items-center gap-3 rounded-md bg-neutral-950 p-3 text-xs text-neutral-300",
                          ((activeVideo.aspectRatio && activeVideo.aspectRatio !== "original") || activeVideo.denoiseAudio || (activeVideo.blurBoxes && activeVideo.blurBoxes.length > 0))
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        ].join(" ")}>
                          <input
                            checked={!((activeVideo.aspectRatio && activeVideo.aspectRatio !== "original") || activeVideo.denoiseAudio || (activeVideo.blurBoxes && activeVideo.blurBoxes.length > 0)) && activeVideo.useFastCut}
                            className="h-4 w-4 accent-cyan-300"
                            disabled={isProcessingQueue || ((activeVideo.aspectRatio && activeVideo.aspectRatio !== "original") || activeVideo.denoiseAudio || (activeVideo.blurBoxes && activeVideo.blurBoxes.length > 0))}
                            onChange={(event) => handleFastCutChange(event.target.checked)}
                            type="checkbox"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-cyan-200 text-xs">{t("vid_config_fast_cut")}</span>
                            <span className="text-[9px] text-neutral-400 leading-tight mt-0.5">{t("vid_config_fast_cut_desc")}</span>
                          </div>
                        </label>
                        {((activeVideo.aspectRatio && activeVideo.aspectRatio !== "original") || activeVideo.denoiseAudio || (activeVideo.blurBoxes && activeVideo.blurBoxes.length > 0)) && (
                          <p className="mt-1 text-[10px] text-red-400 leading-tight">
                            {t("vid_config_fast_cut_disabled")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-4 rounded-md bg-neutral-950 p-3 text-xs text-neutral-300">
                      <div className="flex items-center justify-between">
                        <span>{t("vid_config_start")}</span>
                        <span className="font-medium text-white">{formatTimestamp(activeVideo.selection[0])}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>{t("vid_config_end")}</span>
                        <span className="font-medium text-white">{formatTimestamp(activeVideo.selection[1])}</span>
                      </div>
                    </div>
                  </div>

                  {/* Redaction / Blur Boxes control panel section */}
                  {activeVideo.outputFormat !== "mp3" && (
                    <div className="border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">{t("vid_blur_title")}</h4>
                        <button
                          type="button"
                          disabled={isProcessingQueue}
                          onClick={addBlurBox}
                          className="rounded bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-300/20 transition cursor-pointer disabled:opacity-50"
                        >
                          + {t("vid_blur_add_btn")}
                        </button>
                      </div>

                      <p className="mt-1.5 text-[9px] text-neutral-500 leading-normal">{t("vid_blur_helper")}</p>

                      <div className="mt-3 space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {!activeVideo.blurBoxes || activeVideo.blurBoxes.length === 0 ? (
                          <p className="text-[10px] text-neutral-500 italic text-center py-2">{t("vid_blur_empty")}</p>
                        ) : (
                          activeVideo.blurBoxes.map((box, index) => (
                            <div key={box.id} className="rounded-md bg-neutral-950 p-2 border border-white/5 relative">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-300 mb-1">
                                <span>{t("vid_blur_box_label", { index: index + 1 })}</span>
                                <button
                                  type="button"
                                  disabled={isProcessingQueue}
                                  onClick={() => removeBlurBox(box.id)}
                                  className="text-red-400 hover:text-red-300 transition cursor-pointer disabled:opacity-50"
                                >
                                  {t("vid_blur_remove_btn")}
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                <div>
                                  <label className="text-[9px] text-neutral-400">{t("vid_blur_start_time")}</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={activeVideo.duration}
                                    disabled={isProcessingQueue}
                                    value={Number(box.start.toFixed(1))}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(activeVideo.duration, parseFloat(e.target.value) || 0));
                                      updateBlurBox(box.id, { start: val });
                                    }}
                                    className="w-full rounded bg-neutral-900 border border-white/10 px-1 py-0.5 text-[10px] text-white outline-none focus:border-cyan-300"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-neutral-400">{t("vid_blur_end_time")}</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={activeVideo.duration}
                                    disabled={isProcessingQueue}
                                    value={Number(box.end.toFixed(1))}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(activeVideo.duration, parseFloat(e.target.value) || 0));
                                      updateBlurBox(box.id, { end: val });
                                    }}
                                    className="w-full rounded bg-neutral-900 border border-white/10 px-1 py-0.5 text-[10px] text-white outline-none focus:border-cyan-300"
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            ) : (
              <div className="grid h-[300px] place-items-center rounded-lg border border-dashed border-white/10 bg-neutral-950/40 text-neutral-400 p-6 text-center">
                {t("vid_editor_empty")}
              </div>
            )}
          </div>
        </div>
      )}

      <input
        accept="video/mp4,video/quicktime,video/webm"
        className="sr-only"
        multiple
        onChange={(event) => {
          if (event.target.files) handleFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      {/* Global loading status (primarily for FFmpeg WebAssembly init) */}
      {(status === "loading" || status === "error") && (
        <div className="mt-4">
          <StatusPanel error={error} message={message} progress={progress} status={status} />
        </div>
      )}
    </section>
  );

  function handleFormatChange(nextFormat: OutputFormat) {
    if (activeIndex === null) return;
    updateActiveVideo({
      outputFormat: nextFormat,
      muteAudio: nextFormat === "mp3" ? false : videos[activeIndex].muteAudio,
    });
  }

  function handleMuteChange(checked: boolean) {
    updateActiveVideo({ muteAudio: checked });
  }

  function handleFastCutChange(checked: boolean) {
    updateActiveVideo({ useFastCut: checked });
  }
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
  const { t } = useLanguage();
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
      <p className="text-xl font-semibold text-white">{t("vid_upload_title")}</p>
      <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
        {t("vid_upload_desc")}
      </p>
      <button
        className="mt-7 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-neutral-950 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {t("vid_upload_btn")}
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
  const { t } = useLanguage();
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
        <span className="font-medium text-white">{t("vid_editor_timeline")}</span>
        <span className="text-neutral-400 font-mono">{formatTimestamp(duration)}</span>
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
        {/* Tooltip Start */}
        <div
          className={[
            "pointer-events-none absolute -top-9 -translate-x-1/2 rounded bg-cyan-300 px-2 py-0.5 text-[10px] font-bold text-neutral-950 shadow-md transition-all duration-75 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-cyan-300",
            activeHandle === "start" ? "scale-110 ring-2 ring-cyan-200/50" : "opacity-80",
          ].join(" ")}
          style={{ left: `${startPercent}%` }}
        >
          {formatTimestamp(startTime)}
        </div>
        {/* Tooltip End */}
        <div
          className={[
            "pointer-events-none absolute -top-9 -translate-x-1/2 rounded bg-cyan-300 px-2 py-0.5 text-[10px] font-bold text-neutral-950 shadow-md transition-all duration-75 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-cyan-300",
            activeHandle === "end" ? "scale-110 ring-2 ring-cyan-200/50" : "opacity-80",
          ].join(" ")}
          style={{ left: `${endPercent}%` }}
        >
          {formatTimestamp(endTime)}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-mono">{formatTimestamp(startTime)}</span>
        <span>{t("vid_editor_selected_duration", { duration: formatDuration(endTime - startTime) })}</span>
        <span className="font-mono">{formatTimestamp(endTime)}</span>
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
  error: ErrorState;
  message: string;
  progress: number;
  status: ProcessorStatus;
}) {
  const { t } = useLanguage();

  const renderError = (err: ErrorState) => {
    if (!err) return null;
    if (typeof err === "string") {
      return err.startsWith("vid_") ? t(err) : err;
    }
    return t(err.key, err.variables);
  };

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-white">{t(message)}</p>
        <p className="text-sm text-neutral-400">{Math.round(progress)}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-950">
        <div
          className={[
            "h-full rounded-full transition-all duration-100",
            status === "error" ? "bg-red-300" : "bg-cyan-300",
          ].join(" ")}
          style={{ width: `${clamp(progress, 0, 100)}%` }}
        />
      </div>
      {error ? (
        <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {renderError(error)}
        </p>
      ) : null}
    </div>
  );
}

function buildVideoFilters(aspectRatio: string = "original", blurBoxes: BlurBox[] = []) {
  if (aspectRatio === "original" && blurBoxes.length === 0) {
    return null;
  }

  let filterComplex = "";
  let lastLabel = "[0:v]";

  // 1. Process all blur boxes
  if (blurBoxes.length > 0) {
    blurBoxes.forEach((box, index) => {
      const nextLabel = `[v_blur_${index}]`;
      
      const wExpr = `trunc((${box.w}*iw/100)/2)*2`;
      const hExpr = `trunc((${box.h}*ih/100)/2)*2`;
      const xExpr = `trunc((${box.x}*iw/100)/2)*2`;
      const yExpr = `trunc((${box.y}*ih/100)/2)*2`;

      // Crop the blur area, apply boxblur, overlay it back with the time enable condition
      filterComplex += `${lastLabel}crop=${wExpr}:${hExpr}:${xExpr}:${yExpr},boxblur=25[b${index}]; `;
      filterComplex += `${lastLabel}[b${index}]overlay=${xExpr}:${yExpr}:enable='between(t,${box.start.toFixed(2)},${box.end.toFixed(2)})'${nextLabel}; `;
      
      lastLabel = nextLabel;
    });
  }

  // 2. Process crop if any
  if (aspectRatio !== "original") {
    let cropFilter = "";
    if (aspectRatio === "9:16-center") {
      cropFilter = `crop=trunc(ih*9/16/2)*2:trunc(ih/2)*2`;
    } else if (aspectRatio === "9:16-left") {
      cropFilter = `crop=trunc(ih*9/16/2)*2:trunc(ih/2)*2:0:trunc((ih-oh)/2)`;
    } else if (aspectRatio === "9:16-right") {
      cropFilter = `crop=trunc(ih*9/16/2)*2:trunc(ih/2)*2:iw-ow:trunc((ih-oh)/2)`;
    } else if (aspectRatio === "1:1") {
      cropFilter = `crop=trunc(min(iw\\,ih)/2)*2:trunc(min(iw\\,ih)/2)*2`;
    }

    const finalLabel = "[out_v]";
    filterComplex += `${lastLabel}${cropFilter}${finalLabel}`;
    return {
      type: "complex" as const,
      filter: filterComplex,
      outputLabel: "[out_v]"
    };
  }

  return {
    type: "complex" as const,
    filter: filterComplex.trim().replace(/;\s*$/, ""),
    outputLabel: lastLabel
  };
}

function buildFFmpegArgs({
  inputName,
  muteAudio,
  outputName,
  outputFormat,
  startTime,
  endTime,
  useFastCut,
  aspectRatio = "original",
  denoiseAudio = false,
  blurBoxes = [],
}: {
  inputName: string;
  muteAudio: boolean;
  outputName: string;
  outputFormat: OutputFormat;
  startTime: number;
  endTime: number;
  useFastCut: boolean;
  aspectRatio?: string;
  denoiseAudio?: boolean;
  blurBoxes?: BlurBox[];
}) {
  const args = ["-ss", startTime.toFixed(2), "-i", inputName, "-t", (endTime - startTime).toFixed(2)];

  const hasFilters = aspectRatio !== "original" || denoiseAudio || blurBoxes.length > 0;
  const isFastCutActive = useFastCut && !hasFilters;

  if (isFastCutActive) {
    args.push("-c:v", "copy");
    if (muteAudio) {
      args.push("-an");
    } else {
      args.push("-c:a", "copy");
    }
    if (outputFormat === "mp4") {
      args.push("-movflags", "faststart");
    }
    args.push("-f", outputFormat, outputName);
    return args;
  }

  if (outputFormat === "mp3") {
    if (denoiseAudio) {
      args.push("-af", "afftdn");
    }
    args.push("-vn", "-acodec", "libmp3lame", "-b:a", "192k", "-f", "mp3", outputName);
    return args;
  }

  const videoFilters = buildVideoFilters(aspectRatio, blurBoxes);

  if (videoFilters && videoFilters.filter) {
    if (outputFormat === "gif") {
      let filterComplexStr = videoFilters.filter;
      const finalLabel = videoFilters.outputLabel;
      filterComplexStr += `; ${finalLabel}fps=15,scale=480:-1:flags=lanczos[gif_out]`;
      args.push("-filter_complex", filterComplexStr, "-map", "[gif_out]");
    } else {
      args.push("-filter_complex", videoFilters.filter, "-map", videoFilters.outputLabel);
      if (!muteAudio) {
        args.push("-map", "0:a?");
      }
    }
  } else if (outputFormat === "gif") {
    args.push("-vf", "fps=15,scale=480:-1:flags=lanczos");
  }

  // Audio filter: Denoise (ignore if muted or format is GIF)
  if (!muteAudio && denoiseAudio && outputFormat !== "gif") {
    // If we already have filter_complex, we cannot pass -af separately sometimes depending on FFmpeg version,
    // but in modern FFmpeg we can pass -af along with -filter_complex, or apply it inside the filter graph.
    // Specifying -af afftdn is standard and fully works.
    args.push("-af", "afftdn");
  }

  if (outputFormat === "gif") {
    args.push("-an", "-loop", "0", "-f", "gif", outputName);
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

  // WebM fallback
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

// Math/helpers
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

function withSuffix(filename: string, suffix: string) {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) return `${filename}-${suffix}`;
  return `${filename.slice(0, lastDotIndex)}-${suffix}${filename.slice(lastDotIndex)}`;
}

// Icons
function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="h-3 w-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
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

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
