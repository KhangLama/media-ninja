"use client";

import EXIF from "exif-js";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProcessingStatus = "processing" | "ready" | "error";

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

export default function ImageProcessor() {
  const [items, setItems] = useState<ProcessedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Cấu hình nén ảnh
  const [quality, setQuality] = useState(80);
  const [maxWidthHeight, setMaxWidthHeight] = useState<number | "original">("original");
  const [outputFormat, setOutputFormat] = useState<"original" | "image/jpeg" | "image/png" | "image/webp">("original");
  const [autoClearMetadata, setAutoClearMetadata] = useState(true);

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
            let outputFile = await compressImageFile(
              queuedItem.originalFile,
              quality,
              maxWidthHeight,
              outputFormat,
              !autoClearMetadata,
              (progress) => {
                updateImageItem(queuedItem.id, { progress });
              }
            );

            if (autoClearMetadata && (outputFile.type === "image/jpeg" || outputFile.type === "image/jpg")) {
              outputFile = await clearMetadataFile(outputFile, outputFile.name);
            }

            const downloadUrl = URL.createObjectURL(outputFile);
            objectUrlsRef.current.add(downloadUrl);

            updateImageItem(queuedItem.id, {
              status: "ready",
              progress: 100,
              outputFile,
              outputSize: outputFile.size,
              downloadUrl,
              exif,
              metadataCleared: autoClearMetadata,
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
    [autoClearMetadata, updateImageItem, quality, maxWidthHeight, outputFormat],
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
      const fileToClear = item.outputFile ?? item.originalFile;
      const cleanFile = await clearMetadataFile(fileToClear);
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
      <div className="mb-5 rounded-lg border border-white/10 bg-neutral-950 p-4 shadow-inner">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <SettingsIcon /> Cấu hình nén ảnh
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>Chất lượng (Quality)</span>
              <span className="font-semibold text-cyan-300">{quality}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-300"
            />
          </div>
          
          <div>
            <label className="text-xs text-neutral-400 block mb-2">Kích thước ảnh tối đa</label>
            <select
              value={maxWidthHeight}
              onChange={(e) => setMaxWidthHeight(e.target.value === "original" ? "original" : Number(e.target.value))}
              className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
            >
              <option value="original">Giữ nguyên độ phân giải</option>
              <option value="3840">4K UHD (3840px)</option>
              <option value="2048">2K (2048px)</option>
              <option value="1920">Full HD 1080p (1920px)</option>
              <option value="1280">HD 720p (1280px)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-2">Định dạng xuất</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as any)}
              className="w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
            >
              <option value="original">Giữ nguyên định dạng gốc</option>
              <option value="image/webp">Chuyển sang WebP (Khuyên dùng)</option>
              <option value="image/jpeg">Chuyển sang JPEG</option>
              <option value="image/png">Chuyển sang PNG</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="relative inline-flex items-center cursor-pointer select-none py-1.5">
              <input
                type="checkbox"
                checked={autoClearMetadata}
                onChange={(e) => setAutoClearMetadata(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-neutral-800 border border-white/10 peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/40 transition-all duration-300 relative shrink-0 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all after:duration-300 peer-checked:after:translate-x-4"></div>
              <div className="ms-3">
                <span className="block text-xs font-semibold text-white">Tự động xóa Metadata</span>
                <span className="text-[10px] text-neutral-500">Xóa EXIF & GPS bảo vệ riêng tư</span>
              </div>
            </label>
          </div>
        </div>
      </div>

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
          Nén ảnh trong trình duyệt
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
                      {item.outputSize ? (
                        <>
                          {" -> "}{formatBytes(item.outputSize)}
                          {" • "}
                          {(() => {
                            const diff = item.originalSize - item.outputSize;
                            const percent = Math.round((diff / item.originalSize) * 100);
                            if (percent > 0) {
                              return <span className="text-emerald-400 font-medium">Giảm {percent}%</span>;
                            } else if (percent < 0) {
                              return <span className="text-amber-400 font-medium">Tăng {Math.abs(percent)}%</span>;
                            } else {
                              return <span className="text-neutral-400">Không đổi</span>;
                            }
                          })()}
                        </>
                      ) : null}
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

async function compressImageFile(
  file: File,
  quality: number,
  maxWidthHeight: number | "original",
  format: "original" | "image/jpeg" | "image/png" | "image/webp",
  preserveExif: boolean,
  onProgress: (progress: number) => void
) {
  const options: any = {
    maxSizeMB: 30, // Đặt giới hạn dung lượng lớn để nén theo chất lượng
    initialQuality: quality / 100,
    preserveExif,
    useWebWorker: true,
    onProgress,
  };

  if (maxWidthHeight !== "original") {
    options.maxWidthOrHeight = maxWidthHeight;
  } else {
    options.alwaysKeepResolution = true;
  }

  if (format !== "original") {
    options.fileType = format;
  }

  const cleanFile = await imageCompression(file, options);

  let outputName = file.name;
  if (format !== "original") {
    const ext = format.split("/")[1];
    const lastDotIndex = outputName.lastIndexOf(".");
    const extStr = ext === "jpeg" ? "jpg" : ext;
    if (lastDotIndex <= 0) {
      outputName = `${outputName}.${extStr}`;
    } else {
      outputName = `${outputName.slice(0, lastDotIndex)}.${extStr}`;
    }
  }

  return new File([cleanFile], withSuffix(outputName, "compressed"), {
    type: cleanFile.type || file.type,
    lastModified: Date.now(),
  });
}

function stripJpegExif(arrayBuffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
    return arrayBuffer; // Không phải JPEG
  }

  let offset = 2;
  const length = view.byteLength;
  const segmentsToKeep: { start: number; end: number }[] = [{ start: 0, end: 2 }];

  while (offset < length) {
    if (offset + 1 >= length) break;
    if (view.getUint8(offset) !== 0xFF) {
      return arrayBuffer; // Lỗi định dạng marker, trả về gốc để an toàn
    }

    const marker = view.getUint8(offset + 1);
    
    // SOS (Start of Scan) - phần dữ liệu ảnh nén bắt đầu từ đây, dừng tìm metadata
    if (marker === 0xDA) {
      segmentsToKeep.push({ start: offset, end: length });
      break;
    }

    // EOI (End of Image)
    if (marker === 0xD9) {
      segmentsToKeep.push({ start: offset, end: offset + 2 });
      offset += 2;
      continue;
    }

    if (offset + 3 >= length) break;
    const segmentLength = view.getUint16(offset + 2, false);
    const segmentEnd = offset + 2 + segmentLength;

    if (segmentEnd > length) {
      return arrayBuffer; // File bị lỗi, trả về gốc
    }

    // APP1 (0xE1) chứa Exif/GPS/XMP và APP13 (0xED) chứa IPTC
    if (marker === 0xE1 || marker === 0xED) {
      // Bỏ qua không thêm vào segmentsToKeep
    } else {
      segmentsToKeep.push({ start: offset, end: segmentEnd });
    }

    offset = segmentEnd;
  }

  let totalLength = 0;
  segmentsToKeep.forEach((seg) => {
    totalLength += seg.end - seg.start;
  });

  const cleanBuffer = new ArrayBuffer(totalLength);
  const cleanView = new Uint8Array(cleanBuffer);
  const originalView = new Uint8Array(arrayBuffer);
  let currentOffset = 0;

  segmentsToKeep.forEach((seg) => {
    cleanView.set(originalView.subarray(seg.start, seg.end), currentOffset);
    currentOffset += seg.end - seg.start;
  });

  return cleanBuffer;
}

async function clearMetadataFile(file: File, customName?: string) {
  try {
    if (file.type === "image/jpeg" || file.type === "image/jpg") {
      const buffer = await file.arrayBuffer();
      const cleanBuffer = stripJpegExif(buffer);
      return new File([cleanBuffer], customName ?? withSuffix(file.name, "private"), {
        type: file.type,
        lastModified: Date.now(),
      });
    }

    // Fallback cho PNG/WebP dùng browser-image-compression
    const cleanFile = await imageCompression(file, {
      alwaysKeepResolution: true,
      initialQuality: 0.98,
      maxIteration: 1,
      maxSizeMB: Math.max(file.size / 1024 / 1024 + 1, 4),
      preserveExif: false,
      useWebWorker: true,
    });

    return new File([cleanFile], customName ?? withSuffix(file.name, "private"), {
      type: cleanFile.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    throw new Error(
      "Không thể xóa metadata. Ảnh có thể bị hỏng hoặc định dạng này chưa được trình duyệt hỗ trợ.",
    );
  }
}

function SettingsIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className="h-4 w-4 text-cyan-300"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
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
