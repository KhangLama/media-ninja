"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/components/LanguageContext";
import jsQR from "jsqr";

type TabId = "generate" | "scan";
type ColorType = "solid" | "gradient";
type DotsType = "rounded" | "classy" | "square";
type CornersType = "dot" | "square";

export default function QrStudio() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("generate");

  // Generate States
  const [qrData, setQrData] = useState("https://media-ninja.vercel.app");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [dotsType, setDotsType] = useState<DotsType>("rounded");
  const [cornersType, setCornersType] = useState<CornersType>("dot");
  const [colorType, setColorType] = useState<ColorType>("gradient");
  const [dotsColor, setDotsColor] = useState("#06b6d4");
  const [gradientStart, setGradientStart] = useState("#06b6d4");
  const [gradientEnd, setGradientEnd] = useState("#3b82f6");

  // Scan States
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [scanResult, setScanResult] = useState("");
  const [scanCopied, setScanCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // References
  const qrRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrCodeInstanceRef = useRef<any>(null);

  // Dynamic Library State
  const [qrCodeStylingLib, setQrCodeStylingLib] = useState<any>(null);

  // Lazy load qr-code-styling on client to prevent Next.js SSR build errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("qr-code-styling").then((module) => {
        setQrCodeStylingLib(module.default);
      }).catch((err) => console.error("Error loading qr-code-styling:", err));
    }
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    };
  }, [logoUrl, scanPreviewUrl]);

  // Instantiate QR code styling when library and ref are ready
  useEffect(() => {
    if (qrCodeStylingLib && qrRef.current && activeTab === "generate") {
      qrRef.current.innerHTML = "";
      
      const qrCode = new qrCodeStylingLib({
        width: 280,
        height: 280,
        type: "svg",
        backgroundOptions: {
          color: "transparent",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 6,
          imageSizeFactor: 0.4, // Max size factor to prevent covering code completely
        },
      });

      qrCode.append(qrRef.current);
      qrCodeInstanceRef.current = qrCode;
    }
  }, [qrCodeStylingLib, activeTab]);

  // Dynamically update QR code config when states change
  useEffect(() => {
    if (qrCodeInstanceRef.current && activeTab === "generate") {
      const isGrad = colorType === "gradient";

      qrCodeInstanceRef.current.update({
        data: qrData.trim() || "https://media-ninja.vercel.app",
        image: logoUrl || undefined,
        dotsOptions: {
          type: dotsType,
          color: isGrad ? undefined : dotsColor,
          gradient: isGrad
            ? {
                type: "linear",
                rotation: 0,
                colorStops: [
                  { offset: 0, color: gradientStart },
                  { offset: 1, color: gradientEnd },
                ],
              }
            : undefined,
        },
        cornersSquareOptions: {
          type: cornersType,
          color: isGrad ? undefined : dotsColor,
          gradient: isGrad
            ? {
                type: "linear",
                rotation: 0,
                colorStops: [
                  { offset: 0, color: gradientStart },
                  { offset: 1, color: gradientEnd },
                ],
              }
            : undefined,
        },
        cornersDotOptions: {
          type: cornersType === "dot" ? "dot" : "square",
          color: isGrad ? undefined : dotsColor,
          gradient: isGrad
            ? {
                type: "linear",
                rotation: 0,
                colorStops: [
                  { offset: 0, color: gradientStart },
                  { offset: 1, color: gradientEnd },
                ],
              }
            : undefined,
        },
      });
    }
  }, [
    activeTab,
    qrData,
    logoUrl,
    dotsType,
    cornersType,
    colorType,
    dotsColor,
    gradientStart,
    gradientEnd,
  ]);

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  // Clear logo image
  const clearLogo = () => {
    setLogoFile(null);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Handle downloading QR code
  const downloadQr = (ext: "png" | "svg") => {
    if (qrCodeInstanceRef.current) {
      qrCodeInstanceRef.current.download({
        name: "medianinja-qrcode",
        extension: ext,
      });
    }
  };

  // Scan QR processing using jsQR
  const handleScanFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    setScanStatus("idle");
    setScanResult("");
    
    const fileList = Array.from(selectedFiles);
    if (fileList.length === 0) return;

    const file = fileList[0];
    if (!file.type.startsWith("image/")) {
      setScanStatus("error");
      return;
    }

    setScanFile(file);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(URL.createObjectURL(file));

    // Decode QR Code
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            setScanResult(code.data);
            setScanStatus("success");
          } else {
            setScanStatus("error");
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [scanPreviewUrl]);

  // Copy scanned text
  const handleCopyScan = async () => {
    if (!scanResult) return;
    try {
      await navigator.clipboard.writeText(scanResult);
      setScanCopied(true);
      setTimeout(() => setScanCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const clearScan = () => {
    setScanFile(null);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(null);
    setScanStatus("idle");
    setScanResult("");
    setScanCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
      {/* Tab Switcher */}
      <div className="flex border-b border-white/10 pb-4 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("generate")}
          className={[
            "px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
            activeTab === "generate"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "border border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800/50",
          ].join(" ")}
          type="button"
        >
          {t("qr_tab_generate")}
        </button>
        <button
          onClick={() => setActiveTab("scan")}
          className={[
            "px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
            activeTab === "scan"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "border border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800/50",
          ].join(" ")}
          type="button"
        >
          {t("qr_tab_scan")}
        </button>
      </div>

      {activeTab === "generate" ? (
        /* ── GENERATE TAB ── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* QR Code Realtime Preview Box */}
          <div className="flex flex-col items-center justify-center min-h-[300px] border border-white/5 bg-neutral-950/40 rounded-xl p-6 relative">
            <div className="bg-white p-4 rounded-xl shadow-2xl relative overflow-hidden" style={{ minHeight: "312px", minWidth: "312px" }}>
              <div ref={qrRef} />
              {!qrCodeStylingLib && (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-neutral-600 text-xs gap-2">
                  <svg className="animate-spin h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading generator...</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => downloadQr("png")}
                disabled={!qrCodeStylingLib}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow transition hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
                type="button"
              >
                {t("qr_btn_download_png")}
              </button>
              <button
                onClick={() => downloadQr("svg")}
                disabled={!qrCodeStylingLib}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800 cursor-pointer"
                type="button"
              >
                {t("qr_btn_download_svg")}
              </button>
            </div>
          </div>

          {/* Generator Controls Sidebar */}
          <div className="rounded-xl border border-white/5 bg-neutral-900/60 p-4 sm:p-5 space-y-5">
            <h3 className="text-md font-bold text-white tracking-wide border-b border-white/5 pb-2.5">
              Cấu hình QR Code
            </h3>

            {/* Input Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 block">
                {t("qr_label_content")}
              </label>
              <input
                type="text"
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                className="w-full px-3 py-2 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
              />
            </div>

            {/* Logo Image Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 block">
                {t("qr_label_logo")}
              </label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleLogoChange}
                className="sr-only"
              />
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex-1 px-3 py-2 text-left text-xs text-neutral-400 bg-neutral-950 border border-white/10 rounded-lg hover:border-white/20 transition cursor-pointer truncate"
                  type="button"
                >
                  {logoFile ? logoFile.name : "Chọn file ảnh logo..."}
                </button>
                {logoFile && (
                  <button
                    onClick={clearLogo}
                    className="p-2 rounded-lg text-red-400 bg-neutral-900 border border-white/10 hover:bg-red-950/20 transition cursor-pointer"
                    title={t("qr_label_logo_clear")}
                    type="button"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>

            {/* Customize Style Options */}
            <div className="space-y-3.5 pt-2 border-t border-white/5">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                {t("qr_label_style")}
              </h4>

              {/* Dots Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 block">
                  {t("qr_style_dots")}
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "rounded", label: "qr_style_dots_rounded" },
                      { id: "classy", label: "qr_style_dots_classy" },
                      { id: "square", label: "qr_style_dots_square" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setDotsType(option.id)}
                      className={[
                        "px-2 py-1.5 text-[10px] font-bold rounded border cursor-pointer transition truncate",
                        dotsType === option.id
                          ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                          : "bg-neutral-950 border-white/5 text-neutral-400 hover:text-white",
                      ].join(" ")}
                      type="button"
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Corners Type Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 block">
                  {t("qr_style_corners")}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "dot", label: "qr_style_corners_dot" },
                      { id: "square", label: "qr_style_corners_square" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setCornersType(option.id)}
                      className={[
                        "px-2.5 py-1.5 text-[10px] font-bold rounded border cursor-pointer transition truncate",
                        cornersType === option.id
                          ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                          : "bg-neutral-950 border-white/5 text-neutral-400 hover:text-white",
                      ].join(" ")}
                      type="button"
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Config */}
            <div className="space-y-3.5 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  {t("qr_label_color")}
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setColorType("solid")}
                    className={[
                      "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition",
                      colorType === "solid" ? "text-cyan-400 bg-neutral-900" : "text-neutral-500 hover:text-neutral-300",
                    ].join(" ")}
                    type="button"
                  >
                    Solid
                  </button>
                  <button
                    onClick={() => setColorType("gradient")}
                    className={[
                      "text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition",
                      colorType === "gradient" ? "text-cyan-400 bg-neutral-900" : "text-neutral-500 hover:text-neutral-300",
                    ].join(" ")}
                    type="button"
                  >
                    Gradient
                  </button>
                </div>
              </div>

              {colorType === "solid" ? (
                /* Solid Color Input */
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={dotsColor}
                    onChange={(e) => setDotsColor(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={dotsColor}
                    onChange={(e) => setDotsColor(e.target.value)}
                    className="flex-1 px-3 py-1 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                  />
                </div>
              ) : (
                /* Gradient Color Inputs */
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400 block">
                      {t("qr_label_color_start")}
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="color"
                        value={gradientStart}
                        onChange={(e) => setGradientStart(e.target.value)}
                        className="w-7 h-7 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={gradientStart}
                        onChange={(e) => setGradientStart(e.target.value)}
                        className="w-full px-2 py-1 text-xs text-neutral-200 bg-neutral-950 border border-white/10 rounded focus:border-cyan-400 outline-none transition"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400 block">
                      {t("qr_label_color_end")}
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="color"
                        value={gradientEnd}
                        onChange={(e) => setGradientEnd(e.target.value)}
                        className="w-7 h-7 rounded border border-white/10 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={gradientEnd}
                        onChange={(e) => setGradientEnd(e.target.value)}
                        className="w-full px-2 py-1 text-xs text-neutral-200 bg-neutral-950 border border-white/10 rounded focus:border-cyan-400 outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── SCAN TAB ── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleScanFilesSelect(e.target.files)}
            className="sr-only"
          />

          {!scanFile ? (
            /* Dropzone when idle */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleScanFilesSelect(e.dataTransfer.files);
              }}
              className={[
                "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all duration-300",
                isDragging
                  ? "border-cyan-400 bg-cyan-500/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                  : "border-white/15 bg-neutral-950/60 hover:border-white/30 hover:bg-neutral-950/90",
              ].join(" ")}
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5.01 16.01h2a1 1 0 001-1V13a1 1 0 00-1-1h-2a1 1 0 00-1 1v2.01a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {t("qr_tab_scan")}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                {t("qr_scan_drop_desc")}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-md transition-all duration-200 hover:from-cyan-300 hover:to-blue-400 hover:scale-[1.02] cursor-pointer"
                type="button"
              >
                {t("pdf_label_select_files")}
              </button>
            </div>
          ) : (
            /* Workspace scanning result display */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white">{scanFile.name}</h3>
                </div>
                <button
                  onClick={clearScan}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-400 rounded-lg border border-white/10 bg-neutral-900/60 hover:bg-red-950/20 hover:text-red-300 transition cursor-pointer"
                  type="button"
                >
                  Xóa ảnh
                </button>
              </div>

              {/* Status and output */}
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 bg-neutral-950/20 border border-white/5 rounded-xl p-5">
                {scanPreviewUrl && (
                  <div className="flex justify-center bg-neutral-900/50 p-2 rounded-lg border border-white/5 max-h-[200px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={scanPreviewUrl} alt="Preview" className="max-w-full h-auto object-contain rounded" />
                  </div>
                )}
                
                <div className="space-y-3 flex flex-col justify-center">
                  {scanStatus === "success" ? (
                    <>
                      <div className="flex items-center gap-2 text-cyan-400">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-semibold">{t("qr_scan_status_success")}</span>
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <label className="text-xs font-bold text-neutral-400 uppercase">
                          {t("qr_scan_result")}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={scanResult}
                            className="w-full px-3 py-1.5 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg outline-none font-mono"
                          />
                          <button
                            onClick={handleCopyScan}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-cyan-400 shrink-0 cursor-pointer"
                            type="button"
                          >
                            {scanCopied ? t("ocr_copied") : t("qr_scan_btn_copy")}
                          </button>
                          {scanResult.startsWith("http") && (
                            <a
                              href={scanResult}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-400 text-neutral-950 hover:bg-cyan-300 shrink-0"
                            >
                              {t("qr_scan_btn_open")}
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  ) : scanStatus === "error" ? (
                    <div className="flex items-center gap-2 text-red-400 py-4">
                      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold">{t("qr_scan_status_error")}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar */}
          <div className="rounded-xl border border-white/5 bg-neutral-900/60 p-4 sm:p-5 space-y-5 text-sm text-neutral-400 leading-relaxed">
            <h3 className="text-md font-bold text-white tracking-wide border-b border-white/5 pb-2.5">
              Hướng dẫn quét QR
            </h3>
            <p>
              Tải lên một hình ảnh (PNG, JPEG, WebP) có chứa mã QR.
            </p>
            <p>
              Hệ thống sẽ quét mã QR tự động bằng thư viện <code className="text-cyan-300 font-mono">jsQR</code> chạy offline trực tiếp trong trình duyệt để giải mã liên kết hoặc thông điệp văn bản ẩn trong ảnh.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
