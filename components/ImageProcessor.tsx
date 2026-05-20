"use client";

import EXIF from "exif-js";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProcessorMode = "compress" | "metadata";
type ProcessingStatus = "processing" | "ready" | "error";

type ImageProcessorProps = {
  mode?: ProcessorMode;
};

type ExifSummary = {
  camera: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  capturedAt: string;
};

type ExifTagMap = Partial<{
  Make: unknown;
  Model: unknown;
  FNumber: unknown;
  ExposureTime: unknown;
  ISOSpeedRatings: unknown;
  DateTimeOriginal: unknown;
  DateTime: unknown;
}>;

type ProcessedImage = {
  id: string;
  originalFile: File;
  displayName: string;
  status: ProcessingStatus;
  progress: number;
  originalSize: number;
  outputSize?: number;
  outputFile?: File;
  downloadUrl?: string;
  exif?: ExifSummary;
  error?: string;
  metadataCleared: boolean;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXIF_TYPES = new Set(["image/jpeg", "image/tiff"]);
const MAX_SIZE_MB = 1.5;
const MAX_WIDTH_OR_HEIGHT = 2400;

export default function ImageProcessor({ mode = "compress" }: ImageProcessorProps) {
  const [items, setItems] = useState<ProcessedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const readyItems = useMemo(
    () => items.filter((item) => item.status === "ready" && item.outputFile),
    [items],
  );

  const updateImageItem = useCallback((id: string, patch: Partial<ProcessedImage>) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const selectedFiles = Array.from(fileList);
      if (selectedFiles.length === 0) return;

      const queuedItems = selectedFiles.map((file) => createQueuedItem(file));
      setItems((currentItems) => [...queuedItems, ...currentItems]);

      await Promise.all(
        queuedItems.map(async (queuedItem) => {
          try {
            if (!ACCEPTED_TYPES.has(queuedItem.originalFile.type)) {
              throw new Error(
                "Định dạng không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
              );
            }

            const exif = await readExifSummary(queuedItem.originalFile);
            const outputFile =
              mode === "metadata"
                ? await clearMetadataFile(queuedItem.originalFile)
                : await compressImageFile(queuedItem.originalFile, (progress) => {
                    updateImageItem(queuedItem.id, { progress });
                  });
            const downloadUrl = URL.createObjectURL(outputFile);
            objectUrlsRef.current.add(downloadUrl);

            updateImageItem(queuedItem.id, {
              status: "ready",
              progress: 100,
              outputFile,
              outputSize: outputFile.size,
              downloadUrl,
              exif,
              metadataCleared: mode === "metadata",
            });
          } catch (error) {
            updateImageItem(queuedItem.id, {
              status: "error",
              progress: 0,
              error:
                error instanceof Error
                  ? error.message
                  : "Không thể xử lý file này. Vui lòng thử ảnh khác.",
            });
          }
        }),
      );
    },
    [mode, updateImageItem],
  );

  const clearMetadata = useCallback(async (item: ProcessedImage) => {
    if (!ACCEPTED_TYPES.has(item.originalFile.type)) {
      updateImageItem(item.id, {
        status: "error",
        error: "Không thể xóa metadata cho định dạng file này.",
      });
      return;
    }

    updateImageItem(item.id, { status: "processing", progress: 10, error: undefined });

    try {
      const cleanFile = await clearMetadataFile(item.originalFile);
      const downloadUrl = URL.createObjectURL(cleanFile);
      objectUrlsRef.current.add(downloadUrl);

      if (item.downloadUrl) {
        URL.revokeObjectURL(item.downloadUrl);
        objectUrlsRef.current.delete(item.downloadUrl);
      }

      updateImageItem(item.id, {
        status: "ready",
        progress: 100,
        outputFile: cleanFile,
        outputSize: cleanFile.size,
        downloadUrl,
        metadataCleared: true,
      });
    } catch (error) {
      updateImageItem(item.id, {
        status: "error",
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xóa metadata. Ảnh có thể đang bị lỗi hoặc không được trình duyệt hỗ trợ.",
      });
    }
  }, [updateImageItem]);

  const downloadAll = useCallback(async () => {
    if (readyItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      readyItems.forEach((item) => {
        if (item.outputFile) {
          zip.file(item.outputFile.name, item.outputFile);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      triggerDownload(url, "medianinja-images.zip");
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsZipping(false);
    }
  }, [readyItems]);

  return (
    <section className="rounded-lg border border-white/10 bg-neutral-900/80 p-4 sm:p-6">
      <div
        className={[
          "flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition sm:min-h-[360px]",
          isDragging
            ? "border-cyan-300 bg-cyan-300/10"
            : "border-white/15 bg-neutral-950 hover:border-white/30 hover:bg-neutral-950/70",
        ].join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void processFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          multiple
          onChange={(event) => {
            if (event.target.files) void processFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <div className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
          <UploadIcon />
        </div>
        <p className="text-xl font-semibold text-white">
          {mode === "metadata" ? "Kiểm tra và xóa metadata ảnh" : "Nén ảnh trong trình duyệt"}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
          Chọn hoặc kéo thả ảnh JPEG, PNG, WebP. File được xử lý cục bộ trên thiết bị,
          không gửi lên server.
        </p>
        <button
          className="mt-7 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-neutral-950"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Chọn ảnh
        </button>
      </div>

      {items.length > 0 ? (
        <div className="mt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Kết quả xử lý</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {readyItems.length}/{items.length} file đã sẵn sàng tải về.
              </p>
            </div>
            <button
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={readyItems.length === 0 || isZipping}
              onClick={() => void downloadAll()}
              type="button"
            >
              {isZipping ? "Đang tạo ZIP..." : "Download All"}
            </button>
          </div>

          <div className="grid gap-3">
            {items.map((item) => (
              <article
                className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                key={item.id}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">
                      {item.displayName}
                    </h4>
                    <p className="mt-1 text-xs text-neutral-500">
                      Gốc {formatBytes(item.originalSize)}
                      {item.outputSize ? ` -> ${formatBytes(item.outputSize)}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={item.status === "processing"}
                      onClick={() => void clearMetadata(item)}
                      type="button"
                    >
                      Clear Metadata
                    </button>
                    {item.downloadUrl ? (
                      <a
                        className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-cyan-200"
                        download={item.outputFile?.name ?? item.displayName}
                        href={item.downloadUrl}
                      >
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>

                {item.status === "processing" ? (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-950">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-all"
                        style={{ width: `${Math.max(item.progress, 8)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">Đang xử lý...</p>
                  </div>
                ) : null}

                {item.error ? (
                  <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    {item.error}
                  </p>
                ) : null}

                {item.exif ? (
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <ExifField label="Máy ảnh" value={item.exif.camera} />
                    <ExifField label="Khẩu độ" value={item.exif.aperture} />
                    <ExifField label="Tốc độ" value={item.exif.shutterSpeed} />
                    <ExifField label="ISO" value={item.exif.iso} />
                    <ExifField label="Ngày chụp" value={item.exif.capturedAt} />
                  </dl>
                ) : null}

                {item.metadataCleared ? (
                  <p className="mt-3 text-xs text-emerald-300">
                    Metadata thiết bị và vị trí đã được loại bỏ khỏi file tải về.
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function createQueuedItem(file: File): ProcessedImage {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    originalFile: file,
    displayName: file.name,
    status: "processing",
    progress: 5,
    originalSize: file.size,
    metadataCleared: false,
  };
}

function ExifField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-950 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 truncate text-sm text-neutral-200">{value}</dd>
    </div>
  );
}

function UploadIcon() {
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
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M20 16.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.5" />
    </svg>
  );
}

async function compressImageFile(file: File, onProgress: (progress: number) => void) {
  return imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    preserveExif: false,
    useWebWorker: false,
    onProgress,
  });
}

async function clearMetadataFile(file: File) {
  try {
    const cleanFile = await imageCompression(file, {
      alwaysKeepResolution: true,
      initialQuality: 0.96,
      maxIteration: 1,
      maxSizeMB: Math.max(file.size / 1024 / 1024 + 1, 4),
      preserveExif: false,
      useWebWorker: false,
    });

    return new File([cleanFile], withSuffix(file.name, "private"), {
      type: cleanFile.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    throw new Error(
      "Không thể xóa metadata. Ảnh có thể bị hỏng hoặc định dạng này chưa được trình duyệt hỗ trợ.",
    );
  }
}

async function readExifSummary(file: File): Promise<ExifSummary> {
  if (!EXIF_TYPES.has(file.type)) {
    return emptyExifSummary();
  }

  try {
    const exif = EXIF.readFromBinaryFile(await file.arrayBuffer()) as ExifTagMap;

    return {
      camera: [formatExifValue(exif.Make), formatExifValue(exif.Model)]
        .filter((value) => value !== "Không có")
        .join(" ")
        .trim() || "Không có",
      aperture: exif.FNumber ? `f/${formatExifNumber(exif.FNumber)}` : "Không có",
      shutterSpeed: formatShutterSpeed(exif.ExposureTime),
      iso: exif.ISOSpeedRatings ? `ISO ${formatExifValue(exif.ISOSpeedRatings)}` : "Không có",
      capturedAt: formatExifValue(exif.DateTimeOriginal ?? exif.DateTime),
    };
  } catch {
    return emptyExifSummary();
  }
}

function emptyExifSummary(): ExifSummary {
  return {
    camera: "Không có",
    aperture: "Không có",
    shutterSpeed: "Không có",
    iso: "Không có",
    capturedAt: "Không có",
  };
}

function formatExifValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "Không có";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (typeof value === "object" && "numerator" in value && "denominator" in value) {
    const rational = value as { numerator: number; denominator: number };
    if (!rational.denominator) return String(rational.numerator);
    return formatExifNumber(rational.numerator / rational.denominator);
  }
  return String(value);
}

function formatExifNumber(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "Không có";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
}

function formatShutterSpeed(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Không có";
  if (seconds >= 1) return `${formatExifNumber(seconds)}s`;
  return `1/${Math.round(1 / seconds)}s`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function withSuffix(filename: string, suffix: string) {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex <= 0) return `${filename}-${suffix}`;
  return `${filename.slice(0, lastDotIndex)}-${suffix}${filename.slice(lastDotIndex)}`;
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
