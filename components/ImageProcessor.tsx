"use client";

import EXIF from "exif-js";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProcessingStatus = "idle" | "processing" | "ready" | "error";

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
  originalPreviewUrl: string;
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
  const [isCompressing, setIsCompressing] = useState(false);
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

      const newItems = await Promise.all(
        selectedFiles.map(async (file) => {
          const originalPreviewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(originalPreviewUrl);
          let exif: ExifSummary = emptyExifSummary();
          if (ACCEPTED_TYPES.has(file.type)) {
            try {
              exif = await readExifSummary(file);
            } catch {
              // ignore
            }
          }
          return {
            id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
            originalFile: file,
            displayName: file.name,
            status: "idle" as ProcessingStatus,
            progress: 0,
            originalSize: file.size,
            originalPreviewUrl,
            exif,
            metadataCleared: false,
          };
        })
      );

      setItems((currentItems) => [...currentItems, ...newItems]);
    },
    []
  );

  const compressAll = useCallback(async () => {
    if (items.length === 0) return;
    setIsCompressing(true);

    await Promise.all(
      items.map(async (item) => {
        updateImageItem(item.id, { status: "processing", progress: 5, error: undefined });

        try {
          if (!ACCEPTED_TYPES.has(item.originalFile.type)) {
            throw new Error(
              "Định dạng không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
            );
          }

          let outputFile = await compressImageFile(
            item.originalFile,
            quality,
            maxWidthHeight,
            outputFormat,
            !autoClearMetadata,
            (progress) => {
              updateImageItem(item.id, { progress });
            }
          );

          if (autoClearMetadata && (outputFile.type === "image/jpeg" || outputFile.type === "image/jpg")) {
            outputFile = await clearMetadataFile(outputFile, outputFile.name);
          }

          const downloadUrl = URL.createObjectURL(outputFile);
          objectUrlsRef.current.add(downloadUrl);

          if (item.downloadUrl) {
            URL.revokeObjectURL(item.downloadUrl);
            objectUrlsRef.current.delete(item.downloadUrl);
          }

          updateImageItem(item.id, {
            status: "ready",
            progress: 100,
            outputFile,
            outputSize: outputFile.size,
            downloadUrl,
            metadataCleared: autoClearMetadata,
          });
        } catch (error) {
          updateImageItem(item.id, {
            status: "error",
            progress: 0,
            error:
              error instanceof Error
                ? error.message
                : "Không thể xử lý file này. Vui lòng thử ảnh khác.",
          });
        }
      })
    );

    setIsCompressing(false);
  }, [items, quality, maxWidthHeight, outputFormat, autoClearMetadata, updateImageItem]);

  const removeItem = useCallback((id: string) => {
    setItems((currentItems) => {
      const itemToRemove = currentItems.find((item) => item.id === id);
      if (itemToRemove) {
        if (itemToRemove.originalPreviewUrl) {
          URL.revokeObjectURL(itemToRemove.originalPreviewUrl);
          objectUrlsRef.current.delete(itemToRemove.originalPreviewUrl);
        }
        if (itemToRemove.downloadUrl) {
          URL.revokeObjectURL(itemToRemove.downloadUrl);
          objectUrlsRef.current.delete(itemToRemove.downloadUrl);
        }
      }
      return currentItems.filter((item) => item.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    });
    objectUrlsRef.current.clear();
    setItems([]);
  }, [items]);

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
    <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
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

      {items.length === 0 ? (
        <div
          className={[
            "flex min-h-[350px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all duration-300",
            isDragging
              ? "border-cyan-400 bg-cyan-500/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
              : "border-white/15 bg-neutral-950/60 hover:border-white/30 hover:bg-neutral-950/90",
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
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 shadow-inner">
            <UploadIcon />
          </div>
          <h3 className="text-xl font-semibold text-white">
            Nén ảnh trong trình duyệt
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            Chọn hoặc kéo thả ảnh JPEG, PNG, WebP. Ảnh được xử lý 100% cục bộ trên thiết bị của bạn, bảo mật tuyệt đối.
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-md transition-all duration-200 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.02] cursor-pointer"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            Chọn ảnh từ máy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white">Hàng chờ xử lý</h3>
                <span className="rounded-full bg-neutral-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                  {items.length} ảnh
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white cursor-pointer"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  <PlusIcon />
                  Thêm ảnh
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-red-400/90 transition-all hover:bg-red-950/20 hover:text-red-300 cursor-pointer"
                  onClick={clearAll}
                  type="button"
                >
                  <TrashIcon />
                  Xóa tất cả
                </button>
                {readyItems.length > 0 && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 cursor-pointer"
                    disabled={isZipping}
                    onClick={() => void downloadAll()}
                    type="button"
                  >
                    {isZipping ? "Đang tạo ZIP..." : `Tải tất cả ZIP (${readyItems.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((item) => {
                const isItemExifPresent = hasExif(item.exif);
                
                return (
                  <article
                    className="relative flex flex-col rounded-xl border border-white/5 bg-neutral-950/40 overflow-hidden shadow-md group hover:border-white/10 transition-all duration-300"
                    key={item.id}
                  >
                    <button
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-neutral-950/80 border border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer"
                      onClick={() => removeItem(item.id)}
                      title="Xóa khỏi danh sách"
                      type="button"
                    >
                      <CloseIcon />
                    </button>

                    <div className="relative aspect-[16/10] w-full bg-neutral-900 overflow-hidden">
                      {item.originalPreviewUrl ? (
                        <img
                          src={item.originalPreviewUrl}
                          alt={item.displayName}
                          className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
                          Không có xem trước
                        </div>
                      )}
                      
                      <div className="absolute bottom-2 left-2 flex gap-1.5">
                        {item.status === "idle" && (
                          <span className="rounded bg-neutral-950/80 border border-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                            Chờ nén
                          </span>
                        )}
                        {item.status === "processing" && (
                          <span className="rounded bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                            Đang xử lý
                          </span>
                        )}
                        {item.status === "ready" && (
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            Sẵn sàng
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="rounded bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-medium text-red-300">
                            Lỗi
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 p-3.5 flex flex-col justify-between">
                      <div className="min-w-0 mb-3">
                        <h4 className="truncate text-xs font-semibold text-neutral-200" title={item.displayName}>
                          {item.outputFile ? item.outputFile.name : item.displayName}
                        </h4>
                        
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
                          <span>Gốc: {formatBytes(item.originalSize)}</span>
                          {item.outputSize ? (
                            <>
                              <span className="text-neutral-600">→</span>
                              <span className="font-medium text-white">{formatBytes(item.outputSize)}</span>
                              {(() => {
                                const diff = item.originalSize - item.outputSize;
                                const percent = Math.round((diff / item.originalSize) * 100);
                                if (percent > 0) {
                                  return (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/10">
                                      Giảm {percent}%
                                    </span>
                                  );
                                } else if (percent < 0) {
                                  return (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-400 border border-amber-500/10">
                                      Tăng {Math.abs(percent)}%
                                    </span>
                                  );
                                } else {
                                  return <span className="text-neutral-500">(Không đổi)</span>;
                                }
                              })()}
                            </>
                          ) : null}
                        </div>

                        {item.error && (
                          <p className="mt-2 text-xs text-red-400/90 bg-red-950/20 border border-red-500/10 rounded p-1.5 break-words">
                            {item.error}
                          </p>
                        )}

                        {item.exif && isItemExifPresent && (
                          <div className="mt-2.5 rounded-lg bg-neutral-950/30 p-2 text-[10px] text-neutral-400 border border-white/[0.03] space-y-1">
                            <div className="flex justify-between items-center text-neutral-500">
                              <span>EXIF gốc</span>
                              {item.metadataCleared && (
                                <span className="text-emerald-400/90 font-medium">✓ Đã làm sạch</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                              {item.exif.camera !== "Không có" && (
                                <div className="truncate" title={item.exif.camera}>📷 {item.exif.camera}</div>
                              )}
                              {item.exif.aperture !== "Không có" && (
                                <div>⭕ {item.exif.aperture}</div>
                              )}
                              {item.exif.shutterSpeed !== "Không có" && (
                                <div>⚡ {item.exif.shutterSpeed}</div>
                              )}
                              {item.exif.iso !== "Không có" && (
                                <div>🎞️ {item.exif.iso}</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {item.metadataCleared && !isItemExifPresent && (
                          <p className="mt-2 text-[10px] text-emerald-400/90">
                            ✓ Đã làm sạch Metadata bảo mật.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 border-t border-white/[0.05] pt-3">
                        <button
                          className="flex-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          disabled={item.status === "processing" || item.metadataCleared}
                          onClick={() => void clearMetadata(item)}
                          type="button"
                        >
                          Xóa EXIF
                        </button>
                        {item.downloadUrl ? (
                          <a
                            className="flex-1 rounded-md bg-cyan-400 px-2.5 py-1.5 text-center text-xs font-bold text-neutral-950 hover:bg-cyan-300 transition-all shadow-sm cursor-pointer"
                            download={item.outputFile?.name ?? item.displayName}
                            href={item.downloadUrl}
                          >
                            Tải về
                          </a>
                        ) : (
                          <button
                            className="flex-1 rounded-md bg-neutral-850 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 cursor-not-allowed"
                            disabled
                          >
                            Tải về
                          </button>
                        )}
                      </div>
                    </div>

                    {item.status === "processing" && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                          style={{ width: `${Math.max(item.progress, 5)}%` }}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 rounded-xl border border-white/10 bg-neutral-900/60 p-4.5 backdrop-blur-md shadow-xl space-y-5">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <SettingsIcon />
              <h3 className="text-sm font-bold text-white">Cấu hình nén ảnh</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Chất lượng (Quality)</span>
                  <span className="font-bold text-cyan-300">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-neutral-400 block">Kích thước ảnh tối đa</label>
                <select
                  value={maxWidthHeight}
                  onChange={(e) => setMaxWidthHeight(e.target.value === "original" ? "original" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/40"
                >
                  <option value="original">Giữ nguyên độ phân giải</option>
                  <option value="3840">4K UHD (3840px)</option>
                  <option value="2048">2K (2048px)</option>
                  <option value="1920">Full HD 1080p (1920px)</option>
                  <option value="1280">HD 720p (1280px)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-neutral-400 block">Định dạng xuất</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/40"
                >
                  <option value="original">Giữ nguyên định dạng gốc</option>
                  <option value="image/webp">Chuyển sang WebP (Tối ưu)</option>
                  <option value="image/jpeg">Chuyển sang JPEG</option>
                  <option value="image/png">Chuyển sang PNG</option>
                </select>
              </div>

              <label className="relative flex items-center justify-between cursor-pointer select-none py-1 border-t border-white/5 pt-4">
                <div className="space-y-0.5">
                  <span className="block font-semibold text-white">Tự động xóa Metadata</span>
                  <span className="block text-[10px] text-neutral-500">Xóa EXIF & GPS bảo mật riêng tư</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoClearMetadata}
                  onChange={(e) => setAutoClearMetadata(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-neutral-800 border border-white/10 peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/40 transition-all duration-300 relative shrink-0 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all after:duration-300 peer-checked:after:translate-x-4"></div>
              </label>
            </div>

            <button
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 py-3 text-sm font-extrabold text-neutral-950 shadow-md shadow-cyan-500/10 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 cursor-pointer"
              disabled={isCompressing}
              onClick={() => void compressAll()}
              type="button"
            >
              {isCompressing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-neutral-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang nén ảnh...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Bắt đầu nén ({items.length})
                </>
              )}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}

function hasExif(exif?: ExifSummary): exif is ExifSummary {
  if (!exif) return false;
  return (
    exif.camera !== "Không có" ||
    exif.aperture !== "Không có" ||
    exif.shutterSpeed !== "Không có" ||
    exif.iso !== "Không có" ||
    exif.capturedAt !== "Không có"
  );
}

function PlusIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className="h-3 w-3"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
    >
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
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
