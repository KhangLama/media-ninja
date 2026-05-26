"use client";

import EXIF from "exif-js";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

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
  const [activeEditConfig, setActiveEditConfig] = useState<ImageEditConfig>({ ...DEFAULT_EDIT_CONFIG });
  const [editorTab, setEditorTab] = useState<"transform" | "adjust" | "watermark">("transform");

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

      setItems((currentItems) => [...currentItems, ...newItems]);
    },
    []
  );

  // Apply edits to state and close editor
  const handleSaveEdits = () => {
    if (activeEditId) {
      updateImageItem(activeEditId, {
        editConfig: { ...activeEditConfig },
        status: "idle", // Reset status to idle so they are re-processed
      });
      setActiveEditId(null);
    }
  };

  // Apply current edits to ALL items in queue
  const handleApplyEditsToAll = () => {
    setItems((currentItems) =>
      currentItems.map((item) => ({
        ...item,
        editConfig: { ...activeEditConfig },
        status: "idle", // Reset to re-process with new settings
      }))
    );
    setActiveEditId(null);
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

  // Handle open editor overlay
  const openEditor = (item: ProcessedImage) => {
    setActiveEditId(item.id);
    setActiveEditConfig({ ...item.editConfig });
    setEditorTab("transform");
  };

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

      {/* ── IMAGE EDITOR OVERLAY ── */}
      {activeEditId && activeEditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-white/10 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_340px]">
            {/* Left Preview Screen */}
            <div className="relative flex flex-col items-center justify-center p-6 bg-neutral-950/40 border-r border-white/5 h-full overflow-hidden">
              <div className="relative max-h-full max-w-full flex items-center justify-center overflow-hidden">
                <div className="relative select-none" style={{ transform: previewTransformStyle }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeEditItem.originalPreviewUrl}
                    alt="Original Preview"
                    style={{ filter: previewFilterStyle }}
                    className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl transition-all duration-200"
                  />
                  {/* Watermark Live Preview Overlay */}
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
              <span className="absolute bottom-4 left-6 text-xs text-neutral-500 font-mono">
                {activeEditItem.displayName} ({activeEditItem.originalFile.type})
              </span>
            </div>

            {/* Right Controls Panel */}
            <div className="flex flex-col h-full bg-neutral-900 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-md font-bold text-white tracking-wide">{t("img_edit_title")}</h3>
                <button
                  onClick={() => setActiveEditId(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-white/5 bg-neutral-950/20 p-2 gap-1">
                {(
                  [
                    { id: "transform", labelKey: "img_edit_tab_transform" },
                    { id: "adjust", labelKey: "img_edit_tab_adjust" },
                    { id: "watermark", labelKey: "img_edit_tab_watermark" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setEditorTab(tab.id)}
                    className={[
                      "flex-1 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer text-center",
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
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                {/* ── TRANSFORM TAB ── */}
                {editorTab === "transform" && (
                  <div className="space-y-4">
                    {/* Rotations */}
                    <div className="space-y-2">
                      <span className="text-neutral-400 block font-semibold">Xoay ảnh</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveEditConfig((prev) => ({ ...prev, rotate: (prev.rotate + 270) % 360 }))}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-white/10 hover:border-white/20 bg-neutral-950 text-white font-medium cursor-pointer"
                          type="button"
                        >
                          🔄 {t("img_edit_rotate_left")}
                        </button>
                        <button
                          onClick={() => setActiveEditConfig((prev) => ({ ...prev, rotate: (prev.rotate + 90) % 360 }))}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-white/10 hover:border-white/20 bg-neutral-950 text-white font-medium cursor-pointer"
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
                          onClick={() => setActiveEditConfig((prev) => ({ ...prev, flipH: !prev.flipH }))}
                          className={[
                            "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium cursor-pointer transition",
                            activeEditConfig.flipH
                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                              : "border-white/10 hover:border-white/20 bg-neutral-950 text-white",
                          ].join(" ")}
                          type="button"
                        >
                          ↔️ {t("img_edit_flip_h")}
                        </button>
                        <button
                          onClick={() => setActiveEditConfig((prev) => ({ ...prev, flipV: !prev.flipV }))}
                          className={[
                            "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border font-medium cursor-pointer transition",
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
                        onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, brightness: Number(e.target.value) }))}
                        className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
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
                        onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, contrast: Number(e.target.value) }))}
                        className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
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
                        onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, saturation: Number(e.target.value) }))}
                        className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
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
                        onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, blur: Number(e.target.value) }))}
                        className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
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
                            onClick={() => setActiveEditConfig((prev) => ({ ...prev, filter: filterOpt.id }))}
                            className={[
                              "py-1.5 px-2.5 rounded text-left border cursor-pointer font-medium transition truncate",
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
                        onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkEnabled: e.target.checked }))}
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
                            onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkText: e.target.value }))}
                            className="w-full px-3 py-1.5 text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-450 outline-none transition"
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
                              onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkSize: Number(e.target.value) }))}
                              className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-neutral-400 block">{t("img_edit_watermark_opacity")}</span>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              value={Math.round(activeEditConfig.watermarkOpacity * 100)}
                              onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkOpacity: Number(e.target.value) / 100 }))}
                              className="w-full h-1 bg-neutral-850 rounded appearance-none cursor-pointer accent-cyan-300"
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
                              onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkColor: e.target.value }))}
                              className="w-full h-8 rounded border border-white/10 bg-transparent cursor-pointer"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-neutral-400 block">{t("img_edit_watermark_pos")}</span>
                            <select
                              value={activeEditConfig.watermarkPosition}
                              onChange={(e) => setActiveEditConfig((prev) => ({ ...prev, watermarkPosition: e.target.value as ImageEditConfig["watermarkPosition"] }))}
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
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-white/5 space-y-2 bg-neutral-950/20">
                <button
                  onClick={handleSaveEdits}
                  className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-cyan-400 font-bold text-neutral-950 hover:bg-cyan-300 transition cursor-pointer"
                  type="button"
                >
                  ✓ {t("img_edit_btn_save")}
                </button>
                <button
                  onClick={handleApplyEditsToAll}
                  className="w-full flex items-center justify-center py-2 px-4 rounded-lg border border-cyan-500/20 text-cyan-300 hover:bg-cyan-500/10 transition cursor-pointer"
                  type="button"
                >
                  ✨ {t("img_edit_btn_apply_all")}
                </button>
                <button
                  onClick={() => setActiveEditId(null)}
                  className="w-full flex items-center justify-center py-2 px-4 rounded-lg border border-white/10 hover:bg-neutral-800 text-neutral-300 transition cursor-pointer"
                  type="button"
                >
                  {t("img_edit_btn_cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE ── */}
      {items.length === 0 ? (
        /* Large Dropzone */
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
      ) : (
        /* Workspace queue and sidebar grid */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Left Queue Panel */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white">{t("img_queue_title")}</h3>
                <span className="rounded-full bg-neutral-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                  {t("img_queue_count", { count: items.length })}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white cursor-pointer"
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  <PlusIcon />
                  {t("img_btn_add")}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-red-400/90 transition-all hover:bg-red-950/20 hover:text-red-300 cursor-pointer"
                  onClick={clearAll}
                  type="button"
                >
                  <TrashIcon />
                  {t("img_btn_clear_all")}
                </button>
                {readyItems.length > 0 && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-550/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 cursor-pointer"
                    disabled={isZipping}
                    onClick={() => void downloadAll()}
                    type="button"
                  >
                    {isZipping ? t("img_btn_zipping") : t("img_btn_download_zip", { count: readyItems.length })}
                  </button>
                )}
              </div>
            </div>

            {/* Grid display of files */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((item) => {
                const isItemExifPresent = hasExif(item.exif);
                
                // Live preview filters inside individual card thumbnails
                const cardFilter = `brightness(${item.editConfig.brightness}%) contrast(${item.editConfig.contrast}%) saturate(${item.editConfig.saturation}%) blur(${item.editConfig.blur / 3}px) ${
                  item.editConfig.filter === "grayscale" ? "grayscale(100%)" :
                  item.editConfig.filter === "sepia" ? "sepia(100%)" :
                  item.editConfig.filter === "invert" ? "invert(100%)" :
                  item.editConfig.filter === "vintage" ? "contrast(120%) saturate(80%) sepia(20%)" : ""
                }`;

                const cardTransform = `rotate(${item.editConfig.rotate}deg) scaleX(${item.editConfig.flipH ? -1 : 1}) scaleY(${item.editConfig.flipV ? -1 : 1})`;

                return (
                  <article
                    className="relative flex flex-col rounded-xl border border-white/5 bg-neutral-950/40 overflow-hidden shadow-md group hover:border-white/10 transition-all duration-300"
                    key={item.id}
                  >
                    {/* Delete Item Button */}
                    <button
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-neutral-950/80 border border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer"
                      onClick={() => removeItem(item.id)}
                      title={t("img_btn_remove")}
                      type="button"
                    >
                      <CloseIcon />
                    </button>

                    {/* Interactive Edit/Crop Overlay Button */}
                    <button
                      className="absolute top-2 left-2 z-10 py-1 px-2.5 rounded-lg bg-cyan-400 border border-cyan-500/10 text-neutral-950 font-bold text-[10px] uppercase shadow-md hover:bg-cyan-300 hover:scale-[1.03] transition-all cursor-pointer"
                      onClick={() => openEditor(item)}
                      type="button"
                    >
                      🛠️ {t("img_item_btn_edit")}
                    </button>

                    {/* Preview Thumbnail Container */}
                    <div className="relative aspect-[16/10] w-full bg-neutral-900 overflow-hidden flex items-center justify-center">
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ transform: cardTransform }}>
                        {item.originalPreviewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.originalPreviewUrl}
                            alt={item.displayName}
                            style={{ filter: cardFilter }}
                            className="object-cover w-full h-full group-hover:scale-[1.03] transition-all duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">
                            {t("img_no_preview")}
                          </div>
                        )}
                        {/* Thumbnail Watermark Preview Overlay */}
                        {item.editConfig.watermarkEnabled && item.editConfig.watermarkText && (
                          <div
                            style={{
                              color: item.editConfig.watermarkColor,
                              opacity: item.editConfig.watermarkOpacity * 0.7,
                              fontSize: "7px",
                            }}
                            className={[
                              "absolute pointer-events-none font-bold uppercase select-none p-1.5 max-w-[80%] truncate",
                              item.editConfig.watermarkPosition === "top-left" && "top-1 left-1",
                              item.editConfig.watermarkPosition === "top-right" && "top-1 right-1",
                              item.editConfig.watermarkPosition === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                              item.editConfig.watermarkPosition === "bottom-left" && "bottom-1 left-1",
                              item.editConfig.watermarkPosition === "bottom-right" && "bottom-1 right-1",
                            ].join(" ")}
                          >
                            {item.editConfig.watermarkText}
                          </div>
                        )}
                      </div>
                      
                      {/* Processing status pills */}
                      <div className="absolute bottom-2 left-2 flex gap-1.5 z-10">
                        {item.status === "idle" && (
                          <span className="rounded bg-neutral-950/80 border border-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                            {t("img_status_pending")}
                          </span>
                        )}
                        {item.status === "processing" && (
                          <span className="rounded bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                            {t("img_status_processing")}
                          </span>
                        )}
                        {item.status === "ready" && (
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            {t("img_status_ready")}
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="rounded bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-medium text-red-300">
                            {t("img_status_error")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata and Stats */}
                    <div className="flex-1 p-3.5 flex flex-col justify-between">
                      <div className="min-w-0 mb-3">
                        <h4 className="truncate text-xs font-semibold text-neutral-200" title={item.displayName}>
                          {item.outputFile ? item.outputFile.name : item.displayName}
                        </h4>
                        
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
                          <span>{t("img_size_original", { size: formatBytes(item.originalSize) })}</span>
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
                                      {t("img_size_reduced", { percent })}
                                    </span>
                                  );
                                } else if (percent < 0) {
                                  return (
                                    <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-400 border border-amber-500/10">
                                      {t("img_size_increased", { percent: Math.abs(percent) })}
                                    </span>
                                  );
                                } else {
                                  return <span className="text-neutral-500">{t("img_size_unchanged")}</span>;
                                }
                              })()}
                            </>
                          ) : null}
                        </div>

                        {item.error && (
                          <p className="mt-2 text-xs text-red-400/90 bg-red-950/20 border border-red-500/10 rounded p-1.5 break-words">
                            {t(item.error)}
                          </p>
                        )}

                        {item.exif && isItemExifPresent && (
                          <div className="mt-2.5 rounded-lg bg-neutral-950/30 p-2 text-[10px] text-neutral-400 border border-white/[0.03] space-y-1">
                            <div className="flex justify-between items-center text-neutral-500">
                              <span>{t("img_exif_title")}</span>
                              {item.metadataCleared && (
                                <span className="text-emerald-400/90 font-medium">{t("img_exif_cleared")}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                              {item.exif.camera !== "none" && (
                                <div className="truncate" title={item.exif.camera}>
                                  {t("img_exif_camera", { camera: item.exif.camera })}
                                </div>
                              )}
                              {item.exif.aperture !== "none" && <div>⭕ {item.exif.aperture}</div>}
                              {item.exif.shutterSpeed !== "none" && <div>⚡ {item.exif.shutterSpeed}</div>}
                              {item.exif.iso !== "none" && <div>🎞️ {item.exif.iso}</div>}
                            </div>
                          </div>
                        )}
                        
                        {item.metadataCleared && !isItemExifPresent && (
                          <p className="mt-2 text-[10px] text-emerald-400/90">
                            {t("img_exif_cleared_msg")}
                          </p>
                        )}
                      </div>

                      {/* Card actions */}
                      <div className="flex gap-2 border-t border-white/[0.05] pt-3">
                        <button
                          className="flex-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          disabled={item.status === "processing" || item.metadataCleared}
                          onClick={() => void clearMetadata(item)}
                          type="button"
                        >
                          {t("img_btn_clear_exif")}
                        </button>
                        {item.downloadUrl ? (
                          <a
                            className="flex-1 rounded-md bg-cyan-400 px-2.5 py-1.5 text-center text-xs font-bold text-neutral-950 hover:bg-cyan-300 transition-all shadow-sm cursor-pointer"
                            download={item.outputFile?.name ?? item.displayName}
                            href={item.downloadUrl}
                          >
                            {t("img_btn_download")}
                          </a>
                        ) : (
                          <button
                            className="flex-1 rounded-md bg-neutral-850 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 cursor-not-allowed"
                            disabled
                          >
                            {t("img_btn_download")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress slider overlay during batch processing */}
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

          {/* Right Global Configuration Sidebar */}
          <aside className="lg:sticky lg:top-6 rounded-xl border border-white/10 bg-neutral-900/60 p-4.5 backdrop-blur-md shadow-xl space-y-5">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <SettingsIcon />
              <h3 className="text-sm font-bold text-white">{t("img_side_title")}</h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Quality Compression Slider */}
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
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-300"
                />
              </div>

              {/* Max Resolution Select */}
              <div className="space-y-2">
                <label className="text-neutral-400 block">{t("img_side_max_res")}</label>
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

              {/* Output Format Select */}
              <div className="space-y-2">
                <label className="text-neutral-400 block">{t("img_side_output_fmt")}</label>
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

              {/* Auto Metadata Clear Switch */}
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

            {/* Run Button */}
            <button
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 py-3 text-sm font-extrabold text-neutral-950 shadow-md shadow-cyan-500/10 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 cursor-pointer"
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
          </aside>
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

function SettingsIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" className="h-4 w-4 text-cyan-300">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
