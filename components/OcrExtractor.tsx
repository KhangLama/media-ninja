"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { createWorker } from "tesseract.js";
import { useRouter } from "next/navigation";
import { getSharedFile, clearSharedFile, setSharedFile } from "@/lib/sharedFileStore";

type OcrLang = "vie" | "eng" | "vie+eng";

export default function OcrExtractor() {
  const { t } = useLanguage();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrLang, setOcrLang] = useState<OcrLang>("vie+eng");
  const [status, setStatus] = useState<"idle" | "loading" | "processing" | "success" | "error">("idle");
  const [ocrStatusMsg, setOcrStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [pdfPageStatus, setPdfPageStatus] = useState<{ current: number; total: number } | null>(null);
  const [resultText, setResultText] = useState("");
  const [copied, setCopied] = useState(false);
  const [pdfjs, setPdfjs] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("pdfjs-dist").then((module) => {
        module.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs`;
        setPdfjs(module);
      }).catch((err) => console.error("Error loading PDF.js worker:", err));
    }
  }, []);

  // Load shared file on mount
  useEffect(() => {
    const sharedFile = getSharedFile();
    if (sharedFile) {
      const isImage = sharedFile.type.startsWith("image/");
      const isPdf = sharedFile.type === "application/pdf" || sharedFile.name.toLowerCase().endsWith(".pdf");
      if (isImage || isPdf) {
        setFile(sharedFile);
        setTimeout(clearSharedFile, 100);
      }
    }
  }, []);

  const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    setStatus("idle");
    setResultText("");
    const fileList = Array.from(selectedFiles);
    if (fileList.length === 0) return;

    const selectedFile = fileList[0];
    const isImage = selectedFile.type.startsWith("image/");
    const isPdf = selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");

    if (isImage || isPdf) {
      setFile(selectedFile);
    } else {
      setStatus("error");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const clearAll = () => {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setPdfPageStatus(null);
    setResultText("");
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyText = async () => {
    if (!resultText) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const runOcr = async () => {
    if (!file) return;
    setStatus("loading");
    setProgress(0);
    setResultText("");
    setPdfPageStatus(null);

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        if (!pdfjs) {
          throw new Error("PDF.js library is not loaded yet.");
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        let fullText = "";

        const worker = await createWorker(ocrLang, 1, {
          logger: (m) => {
            if (m.status === "loading tesseract core" || m.status === "loading language traineddata") {
              setStatus("loading");
              setOcrStatusMsg(t("ocr_status_loading_model"));
            } else if (m.status === "recognizing text") {
              setStatus("processing");
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        for (let i = 1; i <= totalPages; i++) {
          setPdfPageStatus({ current: i, total: totalPages });
          
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for balanced quality & speed
          
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const { data: { text } } = await worker.recognize(canvas);

            fullText += `--- [${t("pdf_preview_page").replace("{page}", i.toString()).replace("{total}", totalPages.toString())}] ---\n${text.trim()}\n\n`;
            setResultText(fullText);
          }
        }

        await worker.terminate();
        setStatus("success");
      } else {
        // Handle direct image files
        const worker = await createWorker(ocrLang, 1, {
          logger: (m) => {
            if (m.status === "loading tesseract core" || m.status === "loading language traineddata") {
              setStatus("loading");
              setOcrStatusMsg(t("ocr_status_loading_model"));
            } else if (m.status === "recognizing text") {
              setStatus("processing");
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        const { data: { text } } = await worker.recognize(file);

        await worker.terminate();
        setResultText(text.trim());
        setStatus("success");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.pdf"
        onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
        className="sr-only"
      />

      {!file ? (
        /* Large Dropzone */
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
            if (e.dataTransfer.files) handleFilesSelect(e.dataTransfer.files);
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white">
            {t("tool_ocr_title")}
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            {t("ocr_drop_desc")}
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
        /* Workspace split */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Main Content Area */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h3 className="text-lg font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</h3>
                <span className="text-xs text-neutral-400 shrink-0">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {file.type.startsWith("image/") ? (
                  <>
                    <button
                      onClick={() => {
                        setSharedFile(file);
                        router.push("/image-optimizer");
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-cyan-400 rounded-lg border border-cyan-500/30 bg-neutral-900/60 hover:bg-cyan-500/10 transition cursor-pointer"
                      type="button"
                    >
                      🖼️ {t("tool_image_label") || "Image Studio"}
                    </button>
                    <button
                      onClick={() => {
                        setSharedFile(file);
                        router.push("/qr-studio");
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-400 rounded-lg border border-amber-500/30 bg-neutral-900/60 hover:bg-amber-500/10 transition cursor-pointer"
                      type="button"
                    >
                      📱 {t("tool_qr_title") || "QR Studio"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setSharedFile(file);
                      router.push("/pdf-tools");
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 rounded-lg border border-emerald-500/30 bg-neutral-900/60 hover:bg-emerald-500/10 transition cursor-pointer"
                    type="button"
                  >
                    📄 {t("tool_pdf_label") || "PDF Suite"}
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-400 rounded-lg border border-white/10 bg-neutral-900/60 hover:bg-red-950/20 hover:text-red-300 transition cursor-pointer"
                  type="button"
                >
                  {t("ocr_btn_clear") || "Clear File"}
                </button>
              </div>
            </div>

            {/* Extraction progress indicator */}
            {(status === "loading" || status === "processing") && (
              <div className="rounded-xl border border-cyan-500/10 bg-cyan-950/5 p-5">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cyan-300">
                      {status === "loading"
                        ? ocrStatusMsg || t("ocr_status_loading_model")
                        : pdfPageStatus
                        ? t("ocr_status_pdf_page", { page: pdfPageStatus.current, total: pdfPageStatus.total })
                        : t("ocr_status_processing", { percent: progress })}
                    </p>
                    <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-cyan-400 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${status === "loading" ? 15 : progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results display */}
            {(status === "success" || resultText) && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-neutral-300">
                    {t("ocr_result_title")}
                  </h4>
                  <button
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-cyan-400 transition cursor-pointer"
                    type="button"
                  >
                    {copied ? t("ocr_copied") : t("ocr_btn_copy")}
                  </button>
                </div>
                <textarea
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                  className="w-full h-[400px] px-4 py-3 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg outline-none focus:border-cyan-400/50 resize-none font-mono"
                />
              </div>
            )}
          </div>

          {/* Configuration Sidebar */}
          <div className="rounded-xl border border-white/5 bg-neutral-900/60 p-4 sm:p-5 space-y-5">
            <h3 className="text-md font-bold text-white tracking-wide border-b border-white/5 pb-2.5">
              {t("ocr_sidebar_title") || "OCR Configuration"}
            </h3>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-neutral-300 block">
                {t("ocr_label_lang")}
              </label>
              <div className="space-y-1">
                {(
                  [
                    { id: "vie+eng", label: "ocr_lang_both" },
                    { id: "vie", label: "ocr_lang_vi" },
                    { id: "eng", label: "ocr_lang_en" },
                  ] as const
                ).map((langOpt) => (
                  <label
                    key={langOpt.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/40 cursor-pointer transition"
                  >
                    <input
                      type="radio"
                      name="ocrLanguage"
                      checked={ocrLang === langOpt.id}
                      onChange={() => setOcrLang(langOpt.id)}
                      disabled={status === "loading" || status === "processing"}
                      className="text-cyan-400 focus:ring-0 focus:ring-offset-0 bg-neutral-950 border-white/10 disabled:opacity-40"
                    />
                    <span>{t(langOpt.label)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <button
                onClick={runOcr}
                disabled={status === "loading" || status === "processing"}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-md transition hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
                type="button"
              >
                {t("ocr_btn_extract")}
              </button>

              {status === "error" && (
                <p className="mt-2 text-xs font-semibold text-red-400 text-center">
                  {t("ocr_status_error")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
