"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLanguage } from "@/components/LanguageContext";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { getSharedFile, clearSharedFile } from "@/lib/sharedFileStore";

// Simple SVG Icons to keep component self-contained and clean
const MergeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const SplitIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 11-4.243 0 3 3 0 014.243 0z" />
  </svg>
);

const ImgToPdfIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const PdfToImgIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h1a1 1 0 110 2H9m3 4h2a1 1 0 110 2h-2" />
  </svg>
);

const CompressIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

const RotateIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
  </svg>
);

const WatermarkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

type TabId = "merge" | "split" | "img-to-pdf" | "pdf-to-img" | "compress" | "rotate" | "watermark";

type QueuedFile = {
  id: string;
  file: File;
  pageCount?: number;
  error?: string;
};

export default function PdfProcessor() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("merge");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("");
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Configuration States
  const [splitRange, setSplitRange] = useState("1-");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3);
  const [watermarkSize, setWatermarkSize] = useState(40);
  const [watermarkColor, setWatermarkColor] = useState("#ff0000");
  const [compressLevel, setCompressLevel] = useState<"low" | "medium" | "high">("medium");
  const [rotateAngle, setRotateAngle] = useState(90);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lazy load PDF.js in client to avoid Next.js SSR build errors
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("pdfjs-dist").then((module) => {
        // Use CDN worker matching our exact installed package version
        module.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs`;
        setPdfjs(module);
      }).catch((err) => console.error("Error loading PDF.js worker:", err));
    }
  }, []);

  // Cleanup object URLs on unmount or file reset
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  // Check if multiple files are allowed
  const allowsMultiple = useMemo(() => {
    return activeTab === "merge" || activeTab === "img-to-pdf";
  }, [activeTab]);

  // Determine file accept constraints based on tab
  const acceptTypes = useMemo(() => {
    if (activeTab === "img-to-pdf") {
      return "image/png,image/jpeg,image/jpg,image/webp,.png,.jpeg,.jpg,.webp";
    }
    return "application/pdf,.pdf";
  }, [activeTab]);

  // Reset queue when active tab changes
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setFiles([]);
    setStatus("idle");
    setProgress(0);
    setShowPreview(false);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper: Read page count of PDF files safely
  const readPdfPageCount = async (file: File): Promise<number> => {
    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
      return pdfDoc.getPageCount();
    } catch {
      return 0;
    }
  };

  // Process files when dropped or selected
  const handleFilesSelect = useCallback(async (selectedFiles: FileList | File[]) => {
    setStatus("idle");
    const fileList = Array.from(selectedFiles);
    if (fileList.length === 0) return;

    // Filter by type
    const isImgTab = activeTab === "img-to-pdf";
    const filteredFiles = fileList.filter((f) => {
      if (isImgTab) {
        return f.type.startsWith("image/");
      }
      return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    });

    if (filteredFiles.length === 0) {
      setStatus("error");
      return;
    }

    const processedFiles = await Promise.all(
      filteredFiles.map(async (file) => {
        const item: QueuedFile = {
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
        };
        if (!isImgTab) {
          item.pageCount = await readPdfPageCount(file);
        }
        return item;
      })
    );

    setFiles((prev) => {
      const filteredNewFiles = processedFiles.filter((newFile) => {
        const isDuplicate = prev.some(
          (item) => item.file.name === newFile.file.name && item.file.size === newFile.file.size
        );
        return !isDuplicate;
      });

      if (filteredNewFiles.length === 0) return prev;

      if (allowsMultiple) {
        return [...prev, ...filteredNewFiles];
      }
      return [filteredNewFiles[0]];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [activeTab, allowsMultiple]);

  useEffect(() => {
    const sharedFile = getSharedFile();
    if (sharedFile) {
      void handleFilesSelect([sharedFile]);
      setTimeout(clearSharedFile, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove individual file from list
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
    setStatus("idle");
  };

  // Clear all files
  const clearAll = () => {
    setFiles([]);
    setStatus("idle");
    setProgress(0);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Reordering helpers (for merge and img-to-pdf order)
  const moveFile = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;

    setFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Helper to load image for PDF embedding
  const loadImageElement = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  };

  // Helper to convert hex color (#ffffff) to rgb fraction (0.0 to 1.0)
  const hexToRgbFraction = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 0.8, g: 0.8, b: 0.8 };
  };

  // Helper: Format bytes cleanly
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  // Main Processor Logic
  const handleProcess = async () => {
    if (files.length === 0) return;
    setStatus("processing");
    setProgress(10);
    setShowPreview(false);

    try {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }

      if (activeTab === "merge") {
        const mergedPdf = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          const bytes = await files[i].file.arrayBuffer();
          const pdf = await PDFDocument.load(bytes);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          setProgress(Math.round(10 + (i / files.length) * 80));
        }
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName("medianinja-merged.pdf");
      }

      else if (activeTab === "split") {
        const mainFile = files[0];
        const bytes = await mainFile.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const newPdf = await PDFDocument.create();
        const totalPages = srcPdf.getPageCount();

        // Parse page ranges (e.g. 1-3, 5, 8)
        const pageIndices: number[] = [];
        const parts = splitRange.split(",");
        
        for (const part of parts) {
          const cleanPart = part.trim();
          if (cleanPart.includes("-")) {
            const [startStr, endStr] = cleanPart.split("-");
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : totalPages;
            
            if (!isNaN(start)) {
              const from = Math.max(1, start);
              const to = Math.min(isNaN(end) ? totalPages : end, totalPages);
              for (let i = from; i <= to; i++) {
                pageIndices.push(i - 1);
              }
            }
          } else {
            const pageNum = parseInt(cleanPart, 10);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              pageIndices.push(pageNum - 1);
            }
          }
        }

        if (pageIndices.length === 0) {
          throw new Error("Invalid range");
        }

        const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));
        
        const splitPdfBytes = await newPdf.save();
        const blob = new Blob([splitPdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName(`medianinja-split-${mainFile.file.name}`);
      }

      else if (activeTab === "img-to-pdf") {
        const pdfDoc = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          const file = files[i].file;
          const imageBytes = await file.arrayBuffer();
          let pdfImage;
          
          if (file.type === "image/png") {
            pdfImage = await pdfDoc.embedPng(imageBytes);
          } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            // Render non-standard formats (e.g. WebP) to canvas first to convert to PNG
            const img = await loadImageElement(file);
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL("image/png");
            const response = await fetch(pngUrl);
            const pngBytes = await response.arrayBuffer();
            pdfImage = await pdfDoc.embedPng(pngBytes);
          }

          const page = pdfDoc.addPage([pdfImage.width, pdfImage.height]);
          page.drawImage(pdfImage, {
            x: 0,
            y: 0,
            width: pdfImage.width,
            height: pdfImage.height,
          });
          setProgress(Math.round(10 + (i / files.length) * 80));
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName("medianinja-images.pdf");
      }

      else if (activeTab === "pdf-to-img") {
        if (!pdfjs) {
          throw new Error("PDF.js library is not loaded yet.");
        }

        const mainFile = files[0];
        const arrayBuffer = await mainFile.file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        
        const zip = new JSZip();

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // 2x resolution scale for clean quality
          
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (blob) {
              zip.file(`page-${i}.png`, blob);
            }
          }
          setProgress(Math.round(10 + (i / numPages) * 80));
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        setDownloadUrl(URL.createObjectURL(zipBlob));
        setOutputName(`medianinja-images-${mainFile.file.name.replace(/\.pdf$/i, "")}.zip`);
      }

      else if (activeTab === "compress") {
        // Client-side compression runs pdf-lib cleanup and uses stream compression settings
        const mainFile = files[0];
        const bytes = await mainFile.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const compPdf = await PDFDocument.create();
        
        const pageIndices = srcPdf.getPageIndices();
        const copiedPages = await compPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach((page) => compPdf.addPage(page));

        // Setting object streams compression
        const compPdfBytes = await compPdf.save({
          useObjectStreams: true,
        });

        const blob = new Blob([compPdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName(`medianinja-compressed-${mainFile.file.name}`);
      }

      else if (activeTab === "rotate") {
        const mainFile = files[0];
        const bytes = await mainFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = pdf.getPages();

        pages.forEach((page) => {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees(currentRotation + rotateAngle));
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName(`medianinja-rotated-${mainFile.file.name}`);
      }

      else if (activeTab === "watermark") {
        const mainFile = files[0];
        const bytes = await mainFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = pdf.getPages();

        const helveticaFont = await pdf.embedFont(StandardFonts.HelveticaBold);
        const { r, g, b } = hexToRgbFraction(watermarkColor);

        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, watermarkSize);
        const textHeight = helveticaFont.heightAtSize(watermarkSize);
        const angleRad = (45 * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        pages.forEach((page) => {
          const { width, height } = page.getSize();
          const cx = width / 2;
          const cy = height / 2;
          
          // Calculate starting x, y coordinates so the center of the rotated text lies exactly at (cx, cy)
          const x = cx - (textWidth / 2) * cos + (textHeight / 2) * sin;
          const y = cy - (textWidth / 2) * sin - (textHeight / 2) * cos;

          page.drawText(watermarkText, {
            x,
            y,
            size: watermarkSize,
            font: helveticaFont,
            color: rgb(r, g, b),
            opacity: watermarkOpacity,
            rotate: degrees(45),
          });
        });

        const pdfBytes = await pdf.save();
        const blob = new Blob([pdfBytes] as any, { type: "application/pdf" });
        setDownloadUrl(URL.createObjectURL(blob));
        setOutputName(`medianinja-watermarked-${mainFile.file.name}`);
      }

      setProgress(100);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  const triggerDownload = () => {
    if (!downloadUrl) return;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = outputName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
      
      {/* Horizontal Scrollable Navigation Tabs */}
      <div className="flex border-b border-white/10 pb-4 mb-6 overflow-x-auto gap-2 scrollbar-none">
        {(
          [
            { id: "merge", icon: MergeIcon, labelKey: "pdf_tab_merge" },
            { id: "split", icon: SplitIcon, labelKey: "pdf_tab_split" },
            { id: "img-to-pdf", icon: ImgToPdfIcon, labelKey: "pdf_tab_img_to_pdf" },
            { id: "pdf-to-img", icon: PdfToImgIcon, labelKey: "pdf_tab_pdf_to_img" },
            { id: "compress", icon: CompressIcon, labelKey: "pdf_tab_compress" },
            { id: "rotate", icon: RotateIcon, labelKey: "pdf_tab_rotate" },
            { id: "watermark", icon: WatermarkIcon, labelKey: "pdf_tab_watermark" },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={[
                "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 shrink-0 cursor-pointer",
                isActive
                  ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                  : "border border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800/50",
              ].join(" ")}
              type="button"
            >
              <Icon />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple={allowsMultiple}
        accept={acceptTypes}
        onChange={(e) => e.target.files && void handleFilesSelect(e.target.files)}
        className="sr-only"
      />

      {files.length === 0 ? (
        /* Large Dropzone when idle */
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
            if (e.dataTransfer.files) void handleFilesSelect(e.dataTransfer.files);
          }}
          className={[
            "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all duration-300",
            isDragging
              ? "border-cyan-400 bg-cyan-500/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
              : "border-white/15 bg-neutral-950/60 hover:border-white/30 hover:bg-neutral-950/90",
          ].join(" ")}
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 shadow-inner">
            <UploadIcon />
          </div>
          <h3 className="text-xl font-semibold text-white">
            {t(activeTab === "img-to-pdf" ? "pdf_tab_img_to_pdf" : "tool_pdf_title")}
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            {t("pdf_drop_desc")}
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
        /* Workspace when files are loaded */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          
          {/* Main workspace section */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white">{t("img_queue_title")}</h3>
                <span className="rounded-full bg-neutral-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                  {files.length} file
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {allowsMultiple && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white cursor-pointer"
                    type="button"
                  >
                    <PlusIcon />
                    {t("img_btn_add")}
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs font-semibold text-red-400/90 transition-all hover:bg-red-950/20 hover:text-red-300 cursor-pointer"
                  type="button"
                >
                  <TrashIcon />
                  {t("img_btn_clear_all")}
                </button>
              </div>
            </div>

            {/* List of files with drag-free reordering */}
            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {files.map((queued, idx) => (
                <div
                  key={queued.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-neutral-950/40 p-3 hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col gap-1 pr-4 min-w-0">
                    <span className="text-sm font-medium text-neutral-200 truncate block">
                      {queued.file.name}
                    </span>
                    <span className="text-xs text-neutral-500 flex items-center gap-2">
                      <span>{formatBytes(queued.file.size)}</span>
                      {queued.pageCount !== undefined && (
                        <>
                          <span className="text-neutral-700">•</span>
                          <span>{queued.pageCount} trang</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Reordering Controls */}
                    {allowsMultiple && (
                      <div className="flex flex-col sm:flex-row gap-1">
                        <button
                          onClick={() => moveFile(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/60 disabled:opacity-30 disabled:hover:bg-transparent"
                          type="button"
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          onClick={() => moveFile(idx, "down")}
                          disabled={idx === files.length - 1}
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/60 disabled:opacity-30 disabled:hover:bg-transparent"
                          type="button"
                        >
                          <ArrowDownIcon />
                        </button>
                      </div>
                    )}
                    
                    {/* Remove file */}
                    <button
                      onClick={() => removeFile(queued.id)}
                      className="p-1.5 rounded-lg border border-white/5 bg-neutral-900/60 text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-all"
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Results Actions */}
            {status === "success" && downloadUrl && (
              <div className="space-y-4 mt-4">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-300">
                        {t("pdf_status_success")}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 truncate max-w-sm sm:max-w-md">
                        {outputName}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {outputName.endsWith(".pdf") && (
                        <button
                          onClick={() => setShowPreview((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800 cursor-pointer"
                          type="button"
                        >
                          {showPreview ? t("pdf_btn_hide_preview") : t("pdf_btn_show_preview")}
                        </button>
                      )}
                      <button
                        onClick={triggerDownload}
                        className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow transition hover:bg-cyan-300 cursor-pointer"
                        type="button"
                      >
                        {t("pdf_btn_download")}
                      </button>
                    </div>
                  </div>
                </div>
                
                {showPreview && outputName.endsWith(".pdf") && (
                  <PdfPreviewer pdfjs={pdfjs} url={downloadUrl} />
                )}
              </div>
            )}
          </div>

          {/* Sidebar / Parameters Section */}
          <div className="rounded-xl border border-white/5 bg-neutral-900/60 p-4 sm:p-5 space-y-5">
            <h3 className="text-md font-bold text-white tracking-wide border-b border-white/5 pb-2.5">
              {t("img_side_title")}
            </h3>

            {/* Config Fields based on Active Tab */}
            {activeTab === "split" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 block">
                  {t("pdf_label_split_range")}
                </label>
                <input
                  type="text"
                  value={splitRange}
                  onChange={(e) => setSplitRange(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                  className="w-full px-3 py-2 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                />
              </div>
            )}

            {activeTab === "watermark" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    {t("pdf_label_watermark_text")}
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      {t("pdf_label_watermark_size")}
                    </label>
                    <input
                      type="number"
                      value={watermarkSize}
                      onChange={(e) => setWatermarkSize(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      {t("pdf_label_watermark_opacity")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1.0"
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300 block">
                    {t("pdf_label_watermark_color")}
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={watermarkColor}
                      onChange={(e) => setWatermarkColor(e.target.value)}
                      className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={watermarkColor}
                      onChange={(e) => setWatermarkColor(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "compress" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 block">
                  {t("pdf_label_compress_level")}
                </label>
                <div className="space-y-1">
                  {(
                    [
                      { id: "low", label: "pdf_label_compress_low" },
                      { id: "medium", label: "pdf_label_compress_medium" },
                      { id: "high", label: "pdf_label_compress_high" },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800/40 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="compressLevel"
                        checked={compressLevel === option.id}
                        onChange={() => setCompressLevel(option.id)}
                        className="text-cyan-400 focus:ring-0 focus:ring-offset-0 bg-neutral-950 border-white/10"
                      />
                      <span>{t(option.label)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "rotate" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 block">
                  {t("pdf_label_rotate_angle")}
                </label>
                <select
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-neutral-200 bg-neutral-950 border border-white/10 rounded-lg focus:border-cyan-400 outline-none cursor-pointer"
                >
                  <option value={90}>{t("pdf_label_rotate_90")}</option>
                  <option value={180}>{t("pdf_label_rotate_180")}</option>
                  <option value={270}>{t("pdf_label_rotate_270")}</option>
                </select>
              </div>
            )}

            {/* Execute processing Button */}
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={handleProcess}
                disabled={status === "processing"}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-md transition hover:bg-cyan-300 disabled:opacity-40 cursor-pointer"
                type="button"
              >
                {status === "processing" ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-neutral-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {progress}% {t("pdf_status_processing")}
                  </>
                ) : (
                  <>
                    {t(
                      activeTab === "merge"
                        ? "pdf_btn_merge"
                        : activeTab === "split"
                        ? "pdf_btn_split"
                        : activeTab === "img-to-pdf"
                        ? "pdf_btn_img_to_pdf"
                        : activeTab === "pdf-to-img"
                        ? "pdf_btn_pdf_to_img"
                        : activeTab === "compress"
                        ? "pdf_btn_compress"
                        : activeTab === "rotate"
                        ? "pdf_btn_rotate"
                        : "pdf_btn_watermark"
                    )}
                  </>
                )}
              </button>
              
              {status === "error" && (
                <p className="mt-2 text-xs font-semibold text-red-400 text-center">
                  {t("pdf_status_error")}
                </p>
              )}
            </div>

          </div>

        </div>
      )}
    </section>
  );
}

// ── PdfPreviewer Helper Component ──
function PdfPreviewer({ pdfjs, url }: { pdfjs: any; url: string }) {
  const { t } = useLanguage();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF document
  useEffect(() => {
    if (!pdfjs || !url) return;
    
    // Set state asynchronously to avoid React cascading renders warning
    const timer = setTimeout(() => {
      setLoading(true);
      setPageNum(1);
    }, 0);
    
    const loadingTask = pdfjs.getDocument(url);
    loadingTask.promise.then(
      (pdf: any) => {
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      },
      (err: any) => {
        console.error("Error loading PDF for preview:", err);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timer);
    };
  }, [pdfjs, url]);

  // Render page when pdfDoc or pageNum changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel previous render task if active
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    pdfDoc.getPage(pageNum).then((page: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      // 1.5x scale for clean preview quality
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      renderTask.promise.then(
        () => {
          renderTaskRef.current = null;
        },
        (err: any) => {
          // Ignore canceled renders
          if (err.name !== "RenderingCancelledException") {
            console.error("Render error:", err);
          }
        }
      );
    });

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-neutral-400 text-sm">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>{t("pdf_preview_loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-neutral-950/80 p-4 rounded-lg border border-white/5 mt-4">
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <button
          onClick={() => setPageNum((prev) => Math.max(1, prev - 1))}
          disabled={pageNum <= 1}
          className="px-2.5 py-1 rounded bg-neutral-900 border border-white/10 hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:hover:text-neutral-400 cursor-pointer transition text-xs font-semibold"
          type="button"
        >
          {t("pdf_preview_prev")}
        </button>
        <span>
          {t("pdf_preview_page", { page: pageNum, total: numPages })}
        </span>
        <button
          onClick={() => setPageNum((prev) => Math.min(numPages, prev + 1))}
          disabled={pageNum >= numPages}
          className="px-2.5 py-1 rounded bg-neutral-900 border border-white/10 hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-neutral-900 disabled:hover:text-neutral-400 cursor-pointer transition text-xs font-semibold"
          type="button"
        >
          {t("pdf_preview_next")}
        </button>
      </div>

      <div className="w-full max-w-full overflow-auto flex justify-center bg-neutral-900/50 p-2 rounded border border-white/5 max-h-[500px]">
        <canvas ref={canvasRef} className="max-w-full h-auto shadow-2xl bg-white rounded border border-neutral-700" />
      </div>
    </div>
  );
}
