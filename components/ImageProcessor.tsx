"use client";

import EXIF from "exif-js";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { getSharedFile, clearSharedFile } from "@/lib/sharedFileStore";

type ProcessingStatus = "idle" | "processing" | "ready" | "error";

type ExifSummary = {
  camera: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  capturedAt: string;
};

type ImageEditConfig = {
  rotate: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  brightness: number; // 0 - 200, default 100
  contrast: number; // 0 - 200, default 100
  saturation: number; // 0 - 200, default 100
  blur: number; // 0 - 20, default 0
  filter: "none" | "grayscale" | "sepia" | "invert" | "vintage";
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkColor: string;
  watermarkSize: number; // 10 - 100, default 30
  watermarkOpacity: number; // 0.1 - 1.0, default 0.5
  watermarkPosition: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

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
  editConfig: ImageEditConfig;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXIF_TYPES = new Set(["image/jpeg", "image/tiff"]);

const DEFAULT_EDIT_CONFIG: ImageEditConfig = {
  rotate: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  filter: "none",
  watermarkEnabled: false,
  watermarkText: "MEDIA NINJA",
  watermarkColor: "#ffffff",
  watermarkSize: 30,
  watermarkOpacity: 0.5,
  watermarkPosition: "bottom-right",
};

export default function ImageProcessor() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ProcessedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Global Export Configs
  const [quality, setQuality] = useState(80);
  const [maxWidthHeight, setMaxWidthHeight] = useState<number | "original">("original");
  const [outputFormat, setOutputFormat] = useState<"original" | "image/jpeg" | "image/png" | "image/webp">("original");
  const [autoClearMetadata, setAutoClearMetadata] = useState(true);

  // Active Editing States
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<"transform" | "adjust" | "watermark" | "export">("transform");

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(previewContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeEditId]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const readyItems = useMemo(
    () => items.filter((item) => item.status === "ready" && item.outputFile),
    [items]
  );

  const activeEditItem = useMemo(
    () => items.find((item) => item.id === activeEditId),
    [items, activeEditId]
  );

  const activeEditConfig = useMemo(() => {
    return activeEditItem?.editConfig ?? DEFAULT_EDIT_CONFIG;
  }, [activeEditItem]);

  const isRotated90or270 = activeEditConfig.rotate === 90 || activeEditConfig.rotate === 270;

  const updateImageItem = useCallback((id: string, patch: Partial<ProcessedImage>) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
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
            editConfig: { ...DEFAULT_EDIT_CONFIG },
          };
        })
      );

      setItems((currentItems) => {
        let updatedItems = [...currentItems];
        const filteredNewItems: ProcessedImage[] = [];

        for (const newItem of newItems) {
          const duplicateIndex = updatedItems.findIndex(
            (item) => item.originalFile.name === newItem.originalFile.name && item.originalFile.size === newItem.originalFile.size
          );

          if (duplicateIndex !== -1) {
            const existingItem = updatedItems[duplicateIndex];
            if (existingItem.originalPreviewUrl) {
              URL.revokeObjectURL(existingItem.originalPreviewUrl);
              objectUrlsRef.current.delete(existingItem.originalPreviewUrl);
            }
            updatedItems[duplicateIndex] = {
              ...existingItem,
              originalPreviewUrl: newItem.originalPreviewUrl,
            };
          } else {
            filteredNewItems.push(newItem);
          }
        }

        if (filteredNewItems.length > 0) {
          setActiveEditId((currentId) => currentId || filteredNewItems[0].id);
        }

        return [...updatedItems, ...filteredNewItems];
      });
    },
    []
  );

  useEffect(() => {
    const sharedFile = getSharedFile();
    if (sharedFile) {
      void processFiles([sharedFile]);
      setTimeout(clearSharedFile, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateActiveConfig = useCallback((patch: Partial<ImageEditConfig>) => {
    if (activeEditId) {
      const currentItem = items.find(item => item.id === activeEditId);
      if (currentItem) {
        if (currentItem.downloadUrl) {
          URL.revokeObjectURL(currentItem.downloadUrl);
          objectUrlsRef.current.delete(currentItem.downloadUrl);
        }

        updateImageItem(activeEditId, {
          editConfig: { ...currentItem.editConfig, ...patch },
          status: "idle",
          progress: 0,
          outputSize: undefined,
          outputFile: undefined,
          downloadUrl: undefined,
        });
      }
    }
  }, [activeEditId, items, updateImageItem]);

  // Apply current edits to ALL items in queue
  const handleApplyEditsToAll = () => {
    if (!activeEditId) return;
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.downloadUrl) {
          URL.revokeObjectURL(item.downloadUrl);
          objectUrlsRef.current.delete(item.downloadUrl);
        }
        return {
          ...item,
          editConfig: { ...activeEditConfig },
          status: "idle",
          progress: 0,
          outputSize: undefined,
          outputFile: undefined,
          downloadUrl: undefined,
        };
      })
    );
  };

  const processAll = useCallback(async () => {
    if (items.length === 0) return;
    setIsCompressing(true);

    await Promise.all(
      items.map(async (item) => {
        updateImageItem(item.id, { status: "processing", progress: 10, error: undefined });

        try {
          if (!ACCEPTED_TYPES.has(item.originalFile.type)) {
            throw new Error("img_err_invalid_type");
          }

          // Combined canvas image processing & compression pipeline
          const outputFile = await processImageCanvas(
            item.originalFile,
            item.editConfig,
            quality,
            maxWidthHeight,
            outputFormat,
            !autoClearMetadata,
            (progress) => {
              updateImageItem(item.id, { progress: Math.round(10 + progress * 0.9) });
            }
          );

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
            error: error instanceof Error ? error.message : "img_err_processing_failed",
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

    setActiveEditId((currentId) => {
      if (currentId === id) {
        const nextItems = items.filter((item) => item.id !== id);
        return nextItems.length > 0 ? nextItems[0].id : null;
      }
      return currentId;
    });
  }, [items]);

  const clearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.originalPreviewUrl) URL.revokeObjectURL(item.originalPreviewUrl);
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    });
    objectUrlsRef.current.clear();
    setItems([]);
    setActiveEditId(null);
  }, [items]);

  const clearMetadata = useCallback(async (item: ProcessedImage) => {
    if (!ACCEPTED_TYPES.has(item.originalFile.type)) {
      updateImageItem(item.id, {
        status: "error",
        error: "img_err_metadata_not_supported",
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
        error: error instanceof Error ? error.message : "img_err_metadata_failed",
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



  // Preview computed styles
  const previewFilterStyle = useMemo(() => {
    const parts = [
      `brightness(${activeEditConfig.brightness}%)`,
      `contrast(${activeEditConfig.contrast}%)`,
      `saturate(${activeEditConfig.saturation}%)`,
      `blur(${activeEditConfig.blur}px)`,
    ];
    if (activeEditConfig.filter === "grayscale") parts.push("grayscale(100%)");
    if (activeEditConfig.filter === "sepia") parts.push("sepia(100%)");
    if (activeEditConfig.filter === "invert") parts.push("invert(100%)");
    if (activeEditConfig.filter === "vintage") parts.push("contrast(120%) saturate(80%) sepia(20%)");
    return parts.join(" ");
  }, [activeEditConfig]);

  const previewTransformStyle = useMemo(() => {
    return `rotate(${activeEditConfig.rotate}deg) scaleX(${activeEditConfig.flipH ? -1 : 1}) scaleY(${activeEditConfig.flipV ? -1 : 1})`;
  }, [activeEditConfig]);

  const renderDropzone = () => {
    return (
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
          {t("img_drop_title")}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          {t("img_drop_desc")}
        </p>
        <button
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-md transition-all duration-200 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.02] cursor-pointer"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {t("img_drop_btn")}
        </button>
      </div>
    );
  };

  const renderQueue = () => {
    return (
      <div className="flex flex-col border border-white/10 rounded-xl bg-neutral-900/40 p-4 h-[120px] lg:h-[135px] overflow-hidden shrink-0">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-xs sm:text-sm">{t("img_queue_title")}</span>
            <span className="rounded-full bg-neutral-800 border border-white/5 px-2 py-0.5 text-[10px] font-semibold text-neutral-300">
              {items.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 rounded-lg bg-neutral-950 border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300 transition-all hover:bg-neutral-900 hover:text-white cursor-pointer"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <PlusIcon />
              <span className="hidden sm:inline">{t("img_btn_add")}</span>
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-neutral-950 border border-white/10 px-3 py-1 text-xs font-bold text-red-400/90 transition-all hover:bg-red-950/20 hover:text-red-300 cursor-pointer"
              onClick={clearAll}
              type="button"
            >
              <TrashIcon />
              <span className="hidden sm:inline">{t("img_btn_clear_all")}</span>
            </button>
            {readyItems.length > 0 && (
              <button
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20 cursor-pointer"
                disabled={isZipping}
                onClick={() => void downloadAll()}
                type="button"
              >
                📦 <span className="hidden sm:inline">{isZipping ? t("img_btn_zipping") : t("img_btn_download_zip", { count: readyItems.length })}</span>
                <span className="sm:hidden">{readyItems.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filmstrip Horizontal List */}
        <div className="flex-1 flex flex-row overflow-x-auto gap-3 py-1 scrollbar-thin">
          {items.map((item) => {
            const isSelected = item.id === activeEditId;
            const cardFilter = `brightness(${item.editConfig.brightness}%) contrast(${item.editConfig.contrast}%) saturate(${item.editConfig.saturation}%) blur(${item.editConfig.blur / 4}px) ${
              item.editConfig.filter === "grayscale" ? "grayscale(100%)" :
              item.editConfig.filter === "sepia" ? "sepia(100%)" :
              item.editConfig.filter === "invert" ? "invert(100%)" :
              item.editConfig.filter === "vintage" ? "contrast(120%) saturate(80%) sepia(20%)" : ""
            }`;
            const cardTransform = `rotate(${item.editConfig.rotate}deg) scaleX(${item.editConfig.flipH ? -1 : 1}) scaleY(${item.editConfig.flipV ? -1 : 1})`;

            return (
              <div
                key={item.id}
                onClick={() => setActiveEditId(item.id)}
                className={[
                  "relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-neutral-950 overflow-hidden flex items-center justify-center shrink-0 border-2 transition cursor-pointer group",
                  isSelected
                    ? "border-cyan-400 shadow-md shadow-cyan-500/10 scale-[1.02]"
                    : "border-white/10 hover:border-white/20",
                ].join(" ")}
                title={item.displayName}
              >
                <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ transform: cardTransform }}>
                  {item.originalPreviewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.originalPreviewUrl}
                      alt={item.displayName}
                      style={{ filter: cardFilter }}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-[8px] text-neutral-600">No Preview</span>
                  )}
                </div>

                {/* Status dot in bottom right */}
                <span className={[
                  "absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-black/50",
                  item.status === "idle" && "bg-neutral-500",
                  item.status === "processing" && "bg-blue-400 animate-pulse",
                  item.status === "ready" && "bg-emerald-400",
                  item.status === "error" && "bg-red-500",
                ].join(" ")}></span>

                {/* Delete button (visible on hover, or always on mobile) */}
                <button
                  className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-black/70 text-neutral-400 hover:text-white sm:opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (!activeEditId || !activeEditItem) {
      return (
        <div className="flex flex-col flex-1 border border-white/10 rounded-xl bg-neutral-900/20 p-4 h-[350px] lg:h-full items-center justify-center text-neutral-500 text-sm gap-2">
          <span>Vui lòng chọn hoặc thêm ảnh để xử lý</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 border border-white/10 rounded-xl bg-neutral-900/20 p-4 h-[420px] sm:h-[480px] lg:h-full overflow-hidden">
        {/* Image Preview Window */}
        <div 
          ref={previewContainerRef}
          className="flex-1 relative flex items-center justify-center rounded-lg overflow-hidden border border-white/5 bg-[linear-gradient(45deg,#161616_25%,transparent_25%),linear-gradient(-45deg,#161616_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#161616_75%),linear-gradient(-45deg,transparent_75%,#161616_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] p-4"
        >
          {/* Fullscreen Button */}
          <button
            className="absolute top-3 right-3 z-20 p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white hover:bg-black/80 transition cursor-pointer"
            onClick={() => setIsFullscreen(true)}
            type="button"
            title={t("img_btn_fullscreen")}
          >
            <MaximizeIcon />
          </button>

          {containerDimensions.width > 0 && containerDimensions.height > 0 && (
            <div className="relative max-h-full max-w-full flex items-center justify-center overflow-hidden">
              <div className="relative select-none" style={{ transform: previewTransformStyle }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeEditItem.originalPreviewUrl}
                  alt="Active Preview"
                  style={{ 
                    filter: previewFilterStyle,
                    maxWidth: isRotated90or270 ? `${containerDimensions.height - 32}px` : "100%",
                    maxHeight: isRotated90or270 ? `${containerDimensions.width - 32}px` : "100%",
                  }}
                  className="object-contain rounded shadow-2xl transition-all duration-200"
                />
                {/* Watermark Overlay */}
                {activeEditConfig.watermarkEnabled && activeEditConfig.watermarkText && (
                  <div
                    style={{
                      color: activeEditConfig.watermarkColor,
                      opacity: activeEditConfig.watermarkOpacity,
                      fontSize: `${activeEditConfig.watermarkSize / 1.5}%`,
                      textAlign: activeEditConfig.watermarkPosition.includes("left") ? "left" : activeEditConfig.watermarkPosition.includes("right") ? "right" : "center",
                    }}
                    className={[
                      "absolute pointer-events-none font-bold uppercase select-none p-3 break-all max-w-[80%]",
                      activeEditConfig.watermarkPosition === "top-left" && "top-2 left-2",
                      activeEditConfig.watermarkPosition === "top-right" && "top-2 right-2",
                      activeEditConfig.watermarkPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                      activeEditConfig.watermarkPosition === "bottom-left" && "bottom-2 left-2",
                      activeEditConfig.watermarkPosition === "bottom-right" && "bottom-2 right-2",
                    ].join(" ")}
                  >
                    {activeEditConfig.watermarkText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info & Stats / Metadata actions */}
        <div className="mt-4 p-3 bg-neutral-950/40 rounded-lg border border-white/5 space-y-2 text-xs text-left">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="font-mono text-neutral-400 truncate max-w-[180px] lg:max-w-[300px]" title={activeEditItem.displayName}>
              {activeEditItem.displayName}
            </span>
            <div className="flex items-center gap-2 text-neutral-300">
              <span>{formatBytes(activeEditItem.originalSize)}</span>
              {activeEditItem.outputSize && (
                <>
                  <span className="text-neutral-500">→</span>
                  <span className="font-bold text-white">{formatBytes(activeEditItem.outputSize)}</span>
                  {(() => {
                    const diff = activeEditItem.originalSize - activeEditItem.outputSize;
                    const percent = Math.round((diff / activeEditItem.originalSize) * 100);
                    if (percent > 0) {
                      return <span className="text-emerald-400 font-semibold">(-{percent}%)</span>;
                    } else if (percent < 0) {
                      return <span className="text-amber-400 font-semibold">(+{Math.abs(percent)}%)</span>;
                    }
                    return null;
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Exif and Clean Actions Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex-1 min-w-0">
              {activeEditItem.exif && hasExif(activeEditItem.exif) ? (
                <div className="text-[10px] text-neutral-400 flex flex-wrap gap-x-2.5 gap-y-0.5">
                  <span>📷 {activeEditItem.exif.camera}</span>
                  {activeEditItem.exif.aperture !== "none" && <span>⭕ {activeEditItem.exif.aperture}</span>}
                  {activeEditItem.exif.shutterSpeed !== "none" && <span>⚡ {activeEditItem.exif.shutterSpeed}</span>}
                  {activeEditItem.exif.iso !== "none" && <span>🎞️ {activeEditItem.exif.iso}</span>}
                </div>
              ) : (
                <span className="text-[10px] text-neutral-500">
                  {activeEditItem.metadataCleared ? t("img_exif_cleared_msg") : "Không có Metadata EXIF."}
                </span>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                className="px-2.5 py-1 rounded bg-neutral-900 border border-white/10 hover:border-white/20 text-[10px] text-neutral-300 font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                disabled={activeEditItem.status === "processing" || activeEditItem.metadataCleared || !(activeEditItem.exif && hasExif(activeEditItem.exif))}
                onClick={() => void clearMetadata(activeEditItem)}
                type="button"
              >
                {t("img_btn_clear_exif")}
              </button>
              {activeEditItem.downloadUrl ? (
                <a
                  className="px-3 py-1 rounded bg-cyan-400 text-neutral-950 font-extrabold text-[10px] hover:bg-cyan-300 transition shadow-sm cursor-pointer"
                  download={activeEditItem.outputFile?.name ?? activeEditItem.displayName}
                  href={activeEditItem.downloadUrl}
                >
                  {t("img_btn_download")}
                </a>
              ) : (
                <button
                  className="px-3 py-1 rounded bg-neutral-850 text-neutral-500 text-[10px] font-semibold cursor-not-allowed"
                  disabled
                >
                  {t("img_btn_download")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderControls = () => {
    return (
      <div className="flex flex-col border border-white/10 rounded-xl bg-neutral-900/60 h-auto lg:h-full overflow-hidden">
        {/* Tabs Navigation */}
        <div className="flex border-b border-white/5 bg-neutral-950/20 p-2 gap-1 overflow-x-auto shrink-0 scrollbar-none">
          {(
            [
              { id: "transform", labelKey: "img_edit_tab_transform" },
              { id: "adjust", labelKey: "img_edit_tab_adjust" },
              { id: "watermark", labelKey: "img_edit_tab_watermark" },
              { id: "export", labelKey: "img_edit_tab_export" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEditorTab(tab.id)}
              className={[
                "flex-1 py-1.5 px-2 text-[10.5px] font-bold rounded-md transition cursor-pointer text-center whitespace-nowrap",
                editorTab === tab.id
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/30",
              ].join(" ")}
              type="button"
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Tab Contents Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs text-left scrollbar-thin">
          {/* ── TRANSFORM TAB ── */}
          {editorTab === "transform" && (
            <div className="space-y-4">
              {/* Rotations */}
              <div className="space-y-2">
                <span className="text-neutral-400 block font-semibold">Xoay ảnh</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateActiveConfig({ rotate: (activeEditConfig.rotate + 270) % 360 })}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-white/10 hover:border-white/20 bg-neutral-950 text-white font-medium cursor-pointer"
                    type="button"
                  >
                    🔄 {t("img_edit_rotate_left")}
                  </button>
                  <button
                    onClick={() => updateActiveConfig({ rotate: (activeEditConfig.rotate + 90) % 360 })}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-white/10 hover:border-white/20 bg-neutral-950 text-white font-medium cursor-pointer"
                    type="button"
                  >
                    🔄 {t("img_edit_rotate_right")}
                  </button>
                </div>
              </div>

              {/* Flips */}
              <div className="space-y-2">
                <span className="text-neutral-400 block font-semibold">Lật ảnh</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateActiveConfig({ flipH: !activeEditConfig.flipH })}
                    className={[
                      "flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border font-medium cursor-pointer transition",
                      activeEditConfig.flipH
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                        : "border-white/10 hover:border-white/20 bg-neutral-950 text-white",
                    ].join(" ")}
                    type="button"
                  >
                    ↔️ {t("img_edit_flip_h")}
                  </button>
                  <button
                    onClick={() => updateActiveConfig({ flipV: !activeEditConfig.flipV })}
                    className={[
                      "flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border font-medium cursor-pointer transition",
                      activeEditConfig.flipV
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                        : "border-white/10 hover:border-white/20 bg-neutral-950 text-white",
                    ].join(" ")}
                    type="button"
                  >
                    ↕️ {t("img_edit_flip_v")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ADJUSTMENTS TAB ── */}
          {editorTab === "adjust" && (
            <div className="space-y-4">
              {/* Brightness */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("img_edit_brightness")}</span>
                  <span className="font-bold text-cyan-300">{activeEditConfig.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={activeEditConfig.brightness}
                  onChange={(e) => updateActiveConfig({ brightness: Number(e.target.value) })}
                  style={{ '--value-percent': `${((activeEditConfig.brightness - 50) / 100) * 100}%` } as React.CSSProperties}
                  className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("img_edit_contrast")}</span>
                  <span className="font-bold text-cyan-300">{activeEditConfig.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={activeEditConfig.contrast}
                  onChange={(e) => updateActiveConfig({ contrast: Number(e.target.value) })}
                  style={{ '--value-percent': `${((activeEditConfig.contrast - 50) / 100) * 100}%` } as React.CSSProperties}
                  className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("img_edit_saturation")}</span>
                  <span className="font-bold text-cyan-300">{activeEditConfig.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={activeEditConfig.saturation}
                  onChange={(e) => updateActiveConfig({ saturation: Number(e.target.value) })}
                  style={{ '--value-percent': `${(activeEditConfig.saturation / 200) * 100}%` } as React.CSSProperties}
                  className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                />
              </div>

              {/* Blur */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("img_edit_blur")}</span>
                  <span className="font-bold text-cyan-300">{activeEditConfig.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={activeEditConfig.blur}
                  onChange={(e) => updateActiveConfig({ blur: Number(e.target.value) })}
                  style={{ '--value-percent': `${(activeEditConfig.blur / 15) * 100}%` } as React.CSSProperties}
                  className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                />
              </div>

              {/* Preset Filters */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-neutral-400 block font-semibold">{t("img_edit_filter")}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "none", label: "Original" },
                      { id: "grayscale", label: "Grayscale" },
                      { id: "sepia", label: "Sepia" },
                      { id: "invert", label: "Invert" },
                      { id: "vintage", label: "Vintage" },
                    ] as const
                  ).map((filterOpt) => (
                    <button
                      key={filterOpt.id}
                      onClick={() => updateActiveConfig({ filter: filterOpt.id })}
                      className={[
                        "py-1.5 px-2 rounded text-left border cursor-pointer font-medium transition truncate",
                        activeEditConfig.filter === filterOpt.id
                          ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                          : "bg-neutral-950 border-white/5 text-neutral-400 hover:text-white",
                      ].join(" ")}
                      type="button"
                    >
                      {filterOpt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── WATERMARK TAB ── */}
          {editorTab === "watermark" && (
            <div className="space-y-4">
              <label className="relative flex items-center justify-between cursor-pointer py-1">
                <span className="font-semibold text-neutral-300">Bật đóng dấu ảnh</span>
                <input
                  type="checkbox"
                  checked={activeEditConfig.watermarkEnabled}
                  onChange={(e) => updateActiveConfig({ watermarkEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-neutral-800 border border-white/10 peer-checked:bg-cyan-500/20 peer-checked:border-cyan-500/40 transition-all duration-300 relative shrink-0 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 peer-checked:after:bg-cyan-300 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all after:duration-300 peer-checked:after:translate-x-4"></div>
              </label>

              {activeEditConfig.watermarkEnabled && (
                <div className="space-y-3.5 pt-2.5 border-t border-white/5 animate-slideDown">
                  {/* Text */}
                  <div className="space-y-1.5">
                    <label className="text-neutral-400 block font-semibold">{t("img_edit_watermark_text")}</label>
                    <input
                      type="text"
                      value={activeEditConfig.watermarkText}
                      onChange={(e) => updateActiveConfig({ watermarkText: e.target.value })}
                      className="w-full px-3 py-1.5 text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                    />
                  </div>

                  {/* Font size & Opacity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-neutral-400 block">{t("img_edit_watermark_size")}</span>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={activeEditConfig.watermarkSize}
                        onChange={(e) => updateActiveConfig({ watermarkSize: Number(e.target.value) })}
                        style={{ '--value-percent': `${((activeEditConfig.watermarkSize - 10) / 70) * 100}%` } as React.CSSProperties}
                        className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-neutral-400 block">{t("img_edit_watermark_opacity")}</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={Math.round(activeEditConfig.watermarkOpacity * 100)}
                        onChange={(e) => updateActiveConfig({ watermarkOpacity: Number(e.target.value) / 100 })}
                        style={{ '--value-percent': `${((activeEditConfig.watermarkOpacity * 100 - 10) / 90) * 100}%` } as React.CSSProperties}
                        className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Color & Position */}
                  <div className="grid grid-cols-[60px_1fr] gap-3">
                    <div className="space-y-1.5">
                      <span className="text-neutral-400 block">{t("img_edit_watermark_color")}</span>
                      <input
                        type="color"
                        value={activeEditConfig.watermarkColor}
                        onChange={(e) => updateActiveConfig({ watermarkColor: e.target.value })}
                        className="w-full h-8 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-neutral-400 block">{t("img_edit_watermark_pos")}</span>
                      <select
                        value={activeEditConfig.watermarkPosition}
                        onChange={(e) => updateActiveConfig({ watermarkPosition: e.target.value as ImageEditConfig["watermarkPosition"] })}
                        className="w-full h-8 rounded-lg border border-white/10 bg-neutral-950 px-2 text-white outline-none focus:border-cyan-300/70"
                      >
                        <option value="top-left">{t("img_edit_watermark_pos_tl")}</option>
                        <option value="top-right">{t("img_edit_watermark_pos_tr")}</option>
                        <option value="center">{t("img_edit_watermark_pos_center")}</option>
                        <option value="bottom-left">{t("img_edit_watermark_pos_bl")}</option>
                        <option value="bottom-right">{t("img_edit_watermark_pos_br")}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EXPORT TAB ── */}
          {editorTab === "export" && (
            <div className="space-y-4">
              {/* Quality */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("img_side_quality")}</span>
                  <span className="font-bold text-cyan-300">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ '--value-percent': `${((quality - 10) / 90) * 100}%` } as React.CSSProperties}
                  className="custom-slider w-full h-5 bg-transparent appearance-none cursor-pointer"
                />
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <label className="text-neutral-400 block font-semibold">{t("img_side_max_res")}</label>
                <select
                  value={maxWidthHeight}
                  onChange={(e) => setMaxWidthHeight(e.target.value === "original" ? "original" : Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/40"
                >
                  <option value="original">{t("img_side_keep_res")}</option>
                  <option value="3840">4K UHD (3840px)</option>
                  <option value="2048">2K (2048px)</option>
                  <option value="1920">Full HD 1080p (1920px)</option>
                  <option value="1280">HD 720p (1280px)</option>
                </select>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <label className="text-neutral-400 block font-semibold">{t("img_side_output_fmt")}</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as "original" | "image/jpeg" | "image/png" | "image/webp")}
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/40"
                >
                  <option value="original">{t("img_side_keep_fmt")}</option>
                  <option value="image/webp">{t("img_side_fmt_webp")}</option>
                  <option value="image/jpeg">{t("img_side_fmt_jpeg")}</option>
                  <option value="image/png">{t("img_side_fmt_png")}</option>
                </select>
              </div>

              {/* Auto Clear EXIF */}
              <label className="relative flex items-center justify-between cursor-pointer select-none py-1 border-t border-white/5 pt-4">
                <div className="space-y-0.5">
                  <span className="block font-semibold text-white">{t("img_side_auto_clear_exif")}</span>
                  <span className="block text-[10px] text-neutral-500">{t("img_side_auto_clear_exif_desc")}</span>
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
          )}
        </div>

        {/* Sticky Actions Center */}
        <div className="p-4 border-t border-white/5 bg-neutral-950/20 space-y-2 shrink-0">
          <button
            onClick={handleApplyEditsToAll}
            disabled={items.length <= 1}
            className="w-full flex items-center justify-center py-2 px-4 rounded-lg border border-cyan-500/20 text-cyan-300 font-bold hover:bg-cyan-500/10 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            type="button"
          >
            ✨ {t("img_edit_btn_apply_all")}
          </button>
          <button
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 py-3 text-sm font-extrabold text-neutral-950 shadow-md shadow-cyan-500/10 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 cursor-pointer"
            disabled={isCompressing}
            onClick={() => void processAll()}
            type="button"
          >
            {isCompressing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-neutral-950" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("img_side_btn_processing")}
              </>
            ) : (
              <>
                <SparklesIcon />
                {t("img_side_btn_process", { count: items.length })}
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:p-6 backdrop-blur-md shadow-2xl relative">
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

      {items.length === 0 ? renderDropzone() : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-stretch lg:h-[780px]">
          {/* Column 1: Preview & Queue */}
          <div className="flex flex-col gap-6 min-w-0 lg:h-full">
            {renderPreview()}
            {renderQueue()}
          </div>
          {/* Column 2: Controls */}
          {renderControls()}
        </div>
      )}

      {/* Fullscreen Modal Overlay */}
      {isFullscreen && activeEditItem && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-neutral-900/80 border border-white/10 text-neutral-400 hover:text-white hover:scale-105 transition cursor-pointer"
            onClick={() => setIsFullscreen(false)}
            type="button"
          >
            <CloseIcon />
          </button>
          
          {/* Main Image Container */}
          <div 
            className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center select-none" 
            onClick={(e) => e.stopPropagation()}
            style={{ transform: previewTransformStyle }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={activeEditItem.originalPreviewUrl}
              alt="Fullscreen Preview"
              style={{ 
                filter: previewFilterStyle,
                maxWidth: isRotated90or270 ? "85vh" : "90vw",
                maxHeight: isRotated90or270 ? "90vw" : "85vh",
              }}
              className="object-contain rounded-lg shadow-2xl"
            />
            {/* Watermark Overlay */}
            {activeEditConfig.watermarkEnabled && activeEditConfig.watermarkText && (
              <div
                style={{
                  color: activeEditConfig.watermarkColor,
                  opacity: activeEditConfig.watermarkOpacity,
                  fontSize: `${activeEditConfig.watermarkSize / 1.5}%`,
                  textAlign: activeEditConfig.watermarkPosition.includes("left") ? "left" : activeEditConfig.watermarkPosition.includes("right") ? "right" : "center",
                }}
                className={[
                  "absolute pointer-events-none font-bold uppercase select-none p-3 break-all max-w-[80%]",
                  activeEditConfig.watermarkPosition === "top-left" && "top-2 left-2",
                  activeEditConfig.watermarkPosition === "top-right" && "top-2 right-2",
                  activeEditConfig.watermarkPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  activeEditConfig.watermarkPosition === "bottom-left" && "bottom-2 left-2",
                  activeEditConfig.watermarkPosition === "bottom-right" && "bottom-2 right-2",
                ].join(" ")}
              >
                {activeEditConfig.watermarkText}
              </div>
            )}
          </div>
          
          {/* Caption / Filename */}
          <div className="mt-4 text-xs font-mono text-neutral-400 bg-neutral-900/60 border border-white/5 px-4 py-2 rounded-full">
            {activeEditItem.displayName} ({formatBytes(activeEditItem.originalSize)})
          </div>
        </div>
      )}
    </section>
  );
}

function hasExif(exif?: ExifSummary): exif is ExifSummary {
  if (!exif) return false;
  return (
    exif.camera !== "none" ||
    exif.aperture !== "none" ||
    exif.shutterSpeed !== "none" ||
    exif.iso !== "none" ||
    exif.capturedAt !== "none"
  );
}

// Inline SVGs
function PlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-3 w-3">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 16V4M7 9l5-5 5 5M20 16.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.5" />
    </svg>
  );
}

// Canvas-based image editing and rendering pipeline
async function processImageCanvas(
  file: File,
  editConfig: ImageEditConfig,
  quality: number,
  maxWidthHeight: number | "original",
  format: "original" | "image/jpeg" | "image/png" | "image/webp",
  preserveExif: boolean,
  onProgress: (progress: number) => void
): Promise<File> {
  onProgress(10);
  
  // Load original image file into HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
  
  onProgress(30);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");

  const isRotated90or270 = editConfig.rotate === 90 || editConfig.rotate === 270;
  const srcWidth = img.width;
  const srcHeight = img.height;

  // Compute maximum dimensions
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;
  if (maxWidthHeight !== "original") {
    const maxDim = maxWidthHeight;
    if (srcWidth > maxDim || srcHeight > maxDim) {
      if (srcWidth > srcHeight) {
        targetWidth = maxDim;
        targetHeight = Math.round((srcHeight * maxDim) / srcWidth);
      } else {
        targetHeight = maxDim;
        targetWidth = Math.round((srcWidth * maxDim) / srcHeight);
      }
    }
  }

  // Set canvas size (swap width/height if rotated 90 or 270)
  if (isRotated90or270) {
    canvas.width = targetHeight;
    canvas.height = targetWidth;
  } else {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  onProgress(50);

  ctx.save();
  // Move context grid origin to canvas center
  ctx.translate(canvas.width / 2, canvas.height / 2);

  // Apply rotations
  if (editConfig.rotate !== 0) {
    ctx.rotate((editConfig.rotate * Math.PI) / 180);
  }

  // Apply flips (scaling -1)
  const scaleX = editConfig.flipH ? -1 : 1;
  const scaleY = editConfig.flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  // Apply Filters
  const filterParts: string[] = [];
  if (editConfig.brightness !== 100) filterParts.push(`brightness(${editConfig.brightness}%)`);
  if (editConfig.contrast !== 100) filterParts.push(`contrast(${editConfig.contrast}%)`);
  if (editConfig.saturation !== 100) filterParts.push(`saturate(${editConfig.saturation}%)`);
  if (editConfig.blur !== 0) filterParts.push(`blur(${editConfig.blur}px)`);
  if (editConfig.filter === "grayscale") filterParts.push("grayscale(100%)");
  if (editConfig.filter === "sepia") filterParts.push("sepia(100%)");
  if (editConfig.filter === "invert") filterParts.push("invert(100%)");
  if (editConfig.filter === "vintage") filterParts.push("contrast(120%) saturate(80%) sepia(20%)");
  
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(" ");
  }

  // Draw image (center aligned, width/height matching computed target)
  ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  ctx.restore();

  onProgress(70);

  // Draw Watermark text
  if (editConfig.watermarkEnabled && editConfig.watermarkText) {
    ctx.save();
    
    // Scale watermark font dynamically with canvas width
    const fontSize = Math.max(12, Math.round((canvas.width * editConfig.watermarkSize) / 1000));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = editConfig.watermarkColor || "#ffffff";
    ctx.globalAlpha = editConfig.watermarkOpacity;
    ctx.textBaseline = "middle";

    const textMetrics = ctx.measureText(editConfig.watermarkText);
    const textWidth = textMetrics.width;
    const padding = fontSize * 0.8;

    let x = padding;
    let y = padding;

    switch (editConfig.watermarkPosition) {
      case "top-left":
        x = padding;
        y = padding;
        ctx.textAlign = "left";
        break;
      case "top-right":
        x = canvas.width - textWidth - padding;
        y = padding;
        ctx.textAlign = "left";
        break;
      case "center":
        x = canvas.width / 2;
        y = canvas.height / 2;
        ctx.textAlign = "center";
        break;
      case "bottom-left":
        x = padding;
        y = canvas.height - padding;
        ctx.textAlign = "left";
        break;
      case "bottom-right":
        x = canvas.width - textWidth - padding;
        y = canvas.height - padding;
        ctx.textAlign = "left";
        break;
    }

    ctx.fillText(editConfig.watermarkText, x, y);
    ctx.restore();
  }

  onProgress(85);

  // Compress & Output file to Blob
  const mimeType = format === "original" ? file.type : format;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas export toBlob failed"));
      },
      mimeType,
      quality / 100
    );
  });

  onProgress(95);

  let finalBlob = blob;
  // Apply EXIF removal if not preserved (only natively possible for JPEG currently)
  if (!preserveExif && (mimeType === "image/jpeg" || mimeType === "image/jpg")) {
    const arrayBuffer = await blob.arrayBuffer();
    const cleanBuffer = stripJpegExif(arrayBuffer);
    finalBlob = new Blob([cleanBuffer], { type: mimeType });
  }

  // Construct output filename
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

  return new File([finalBlob], withSuffix(outputName, "processed"), {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function stripJpegExif(arrayBuffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
    return arrayBuffer; // Not JPEG
  }

  let offset = 2;
  const length = view.byteLength;
  const segmentsToKeep: { start: number; end: number }[] = [{ start: 0, end: 2 }];

  while (offset < length) {
    if (offset + 1 >= length) break;
    if (view.getUint8(offset) !== 0xFF) {
      return arrayBuffer; // Format marker error, return fallback
    }

    const marker = view.getUint8(offset + 1);
    if (marker === 0xDA) { // SOS (Start of Scan)
      segmentsToKeep.push({ start: offset, end: length });
      break;
    }
    if (marker === 0xD9) { // EOI (End of Image)
      segmentsToKeep.push({ start: offset, end: offset + 2 });
      offset += 2;
      continue;
    }

    if (offset + 3 >= length) break;
    const segmentLength = view.getUint16(offset + 2, false);
    const segmentEnd = offset + 2 + segmentLength;

    if (segmentEnd > length) {
      return arrayBuffer;
    }

    // Strip APP1 (Exif/XMP) and APP13 (IPTC)
    if (marker === 0xE1 || marker === 0xED) {
      // Bypassed
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
    throw new Error("img_err_metadata_failed_fallback");
  }
}

async function readExifSummary(file: File): Promise<ExifSummary> {
  if (!EXIF_TYPES.has(file.type)) {
    return emptyExifSummary();
  }

  return new Promise((resolve) => {
    EXIF.getData(file as unknown as string, function (this: unknown) {
      const allTags = EXIF.getAllTags(this) as Record<string, unknown>;
      resolve({
        camera: [formatExifValue(allTags.Make), formatExifValue(allTags.Model)]
          .filter((v) => v !== "none")
          .join(" ")
          .trim() || "none",
        aperture: allTags.FNumber ? `f/${formatExifNumber(allTags.FNumber)}` : "none",
        shutterSpeed: formatShutterSpeed(allTags.ExposureTime),
        iso: allTags.ISOSpeedRatings ? `ISO ${formatExifValue(allTags.ISOSpeedRatings)}` : "none",
        capturedAt: formatExifValue(allTags.DateTimeOriginal ?? allTags.DateTime),
      });
    });
  });
}

function emptyExifSummary(): ExifSummary {
  return {
    camera: "none",
    aperture: "none",
    shutterSpeed: "none",
    iso: "none",
    capturedAt: "none",
  };
}

function formatExifValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "none";
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
  if (!Number.isFinite(numberValue)) return "none";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
}

function formatShutterSpeed(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "none";
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

// Add custom suffix to output files
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
