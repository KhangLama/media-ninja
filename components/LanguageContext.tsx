"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "vi" | "en";

type Translations = Record<string, string>;

const viTranslations: Translations = {
  // Common / General
  "open_source": "Open Source",
  "tools": "Công cụ",
  "privacy": "Riêng tư",
  "github": "GitHub",
  "none": "Không có",

  // Home Page
  "hero_tagline": "Client-side media toolkit",
  "hero_title": "Xử lý media nhanh, riêng tư và không cần upload.",
  "hero_description": "MediaNinja gom các tác vụ nén ảnh, chỉnh metadata và xử lý video ngắn vào một giao diện tối giản, chạy trực tiếp trên trình duyệt của bạn.",
  "metric_server_upload": "Server upload",
  "metric_media_tools": "Media tools",
  "metric_local_first": "Local-first",
  "workspace_title": "Bắt đầu xử lý",
  "workspace_description": "Chọn công cụ, kéo thả file và xử lý tại chỗ trong trình duyệt.",

  // Tools Tab
  "tool_image_title": "Nén ảnh",
  "tool_image_label": "Image Optimizer",
  "tool_image_desc": "Tối ưu hàng loạt ảnh WebP, JPEG, PNG với chất lượng linh hoạt.",
  "tool_image_accept": "Kéo thả ảnh vào đây",
  "tool_video_title": "Xử lý Video",
  "tool_video_label": "FFmpeg.wasm",
  "tool_video_desc": "Chuyển đổi định dạng, cắt video ngắn ngay trong trình duyệt.",
  "tool_video_accept": "Kéo thả video ngắn vào đây",

  // Footer
  "footer_tagline": "© 2026 MediaNinja. Local-first media tools.",
  "footer_privacy_note": "Không upload file mặc định. Không khóa dữ liệu của bạn.",
  "footer_github_link": "Mã nguồn mở trên GitHub",

  // Image Processor Dropzone
  "img_drop_title": "Nén ảnh trong trình duyệt",
  "img_drop_desc": "Chọn hoặc kéo thả ảnh JPEG, PNG, WebP. Ảnh được xử lý 100% cục bộ trên thiết bị của bạn, bảo mật tuyệt đối.",
  "img_drop_btn": "Chọn ảnh từ máy",

  // Image Processor Workspace
  "img_queue_title": "Hàng chờ xử lý",
  "img_queue_count": "{count} ảnh",
  "img_btn_add": "Thêm ảnh",
  "img_btn_clear_all": "Xóa tất cả",
  "img_btn_download_zip": "Tải tất cả ZIP ({count})",
  "img_btn_zipping": "Đang tạo ZIP...",
  "img_btn_remove": "Xóa khỏi danh sách",
  "img_status_pending": "Chờ nén",
  "img_status_processing": "Đang xử lý",
  "img_status_ready": "Sẵn sàng",
  "img_status_error": "Lỗi",
  "img_no_preview": "Không có xem trước",
  "img_size_original": "Gốc: {size}",
  "img_size_reduced": "Giảm {percent}%",
  "img_size_increased": "Tăng {percent}%",
  "img_size_unchanged": "(Không đổi)",
  "img_exif_title": "EXIF gốc",
  "img_exif_cleared": "✓ Đã làm sạch",
  "img_exif_camera": "📷 {camera}",
  "img_exif_cleared_msg": "✓ Đã làm sạch Metadata bảo mật.",
  "img_btn_clear_exif": "Xóa EXIF",
  "img_btn_download": "Tải về",
  
  // Image Processor Sidebar
  "img_side_title": "Cấu hình nén ảnh",
  "img_side_quality": "Chất lượng (Quality)",
  "img_side_max_res": "Kích thước ảnh tối đa",
  "img_side_keep_res": "Giữ nguyên độ phân giải",
  "img_side_output_fmt": "Định dạng xuất",
  "img_side_keep_fmt": "Giữ nguyên định dạng gốc",
  "img_side_fmt_webp": "Chuyển sang WebP (Tối ưu)",
  "img_side_fmt_jpeg": "Chuyển sang JPEG",
  "img_side_fmt_png": "Chuyển sang PNG",
  "img_side_auto_clear_exif": "Tự động xóa Metadata",
  "img_side_auto_clear_exif_desc": "Xóa EXIF & GPS bảo mật riêng tư",
  "img_side_btn_compress": "Bắt đầu nén ({count})",
  "img_side_btn_compressing": "Đang nén ảnh...",

  // Image Processor Errors
  "img_err_invalid_type": "Định dạng không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
  "img_err_processing_failed": "Không thể xử lý file này. Vui lòng thử ảnh khác.",
  "img_err_metadata_not_supported": "Không thể xóa metadata cho định dạng file này.",
  "img_err_metadata_failed": "Không thể xóa metadata. Ảnh có thể đang bị lỗi hoặc không được trình duyệt hỗ trợ.",
  "img_err_metadata_failed_fallback": "Không thể xóa metadata. Ảnh có thể bị hỏng hoặc định dạng này chưa được trình duyệt hỗ trợ.",

  // Video Processor Global Bar
  "vid_err_global_close": "✕",
  "vid_batch_title": "Xử lý hàng loạt ({count} video)",
  "vid_batch_completed": "Hoàn thành {done}/{total} video.",
  "vid_btn_start": "Bắt đầu xử lý",
  "vid_btn_rendering_queue": "Đang xử lý queue...",
  "vid_btn_download_zip": "Tải tất cả ZIP",
  "vid_btn_zipping": "Đang tạo ZIP...",

  // Video Processor Sidebar Queue
  "vid_queue_title": "Hàng đợi",
  "vid_queue_count": "{count} file",
  "vid_queue_reading": "Đang đọc...",
  "vid_queue_rendering": "Đang render...",
  "vid_queue_rendering_pct": "Đang render... {percent}%",
  "vid_queue_done": "Xong ({size})",
  "vid_queue_error": "Lỗi",
  "vid_queue_pending": "Đang chờ...",
  "vid_queue_btn_remove": "Xóa video khỏi hàng đợi",
  "vid_queue_btn_add": "Thêm video",
  "vid_queue_btn_clear": "Xóa tất cả",

  // Video Processor Editor Overlay
  "vid_editor_overlay_rendering": "Đang xử lý hàng đợi...",
  "vid_editor_overlay_rendering_video": "Đang render: {name}",

  // Video Processor Editor
  "vid_btn_pause_preview": "Dừng phát thử",
  "vid_btn_play_preview": "Phát thử đoạn chọn",
  "vid_editor_loop": "Lặp lại (Loop)",
  "vid_editor_range": "Khoảng phát: {start} - {end}",
  "vid_editor_timeline": "Timeline",
  "vid_editor_selected_duration": "Đoạn cắt {duration}",
  "vid_editor_warning_150mb": "Cảnh báo: Video lớn hơn 150MB. Tiến trình render bình thường có thể làm tràn bộ nhớ trình duyệt. Khuyến nghị bật 'Cắt nhanh (Fast Cut)'.",
  "vid_editor_trimmed_output": "Đoạn cắt {duration}",
  "vid_editor_btn_download": "Tải về",
  "vid_editor_empty": "Vui lòng chọn hoặc tải lên video để biên tập",

  // Video Processor Sidebar Configuration
  "vid_config_title": "Cấu hình xuất",
  "vid_config_format": "Định dạng",
  "vid_config_mute": "Tắt âm thanh",
  "vid_config_fast_cut": "Cắt nhanh (Fast Cut)",
  "vid_config_fast_cut_desc": "Không encode lại, nhanh hơn 100 lần",
  "vid_config_start": "Bắt đầu",
  "vid_config_end": "Kết thúc",

  // Video Processor Upload Panel
  "vid_upload_title": "Chọn nhiều video để cắt trực quan",
  "vid_upload_desc": "Hỗ trợ MP4, MOV và WebM. Video chạy cục bộ trong trình duyệt bằng FFmpeg.wasm, không upload lên server. Sắp xếp tuần tự tránh tràn bộ nhớ.",
  "vid_upload_btn": "Chọn video",

  // Video Processor Status Messages
  "vid_status_select": "Chọn video để bắt đầu.",
  "vid_status_loading": "Đang tải FFmpeg WebAssembly...",
  "vid_status_ready": "Bộ xử lý đã sẵn sàng.",
  "vid_status_error": "Không thể tải FFmpeg.",
  
  // Video Processor Errors
  "vid_err_invalid_type": "Có file không hợp lệ. Vui lòng chọn MP4, MOV hoặc WebM.",
  "vid_err_too_large": "File \"{name}\" quá lớn (vượt quá 300MB). Vui lòng chọn file nhỏ hơn.",
  "vid_err_duration_failed": "Không đọc được thời lượng video. Hãy thử file khác.",
  "vid_err_failed": "Xử lý video thất bại.",
  "vid_err_startup": "Đã xảy ra lỗi khi khởi động tiến trình xử lý.",
  "vid_err_ffmpeg_load_failed": "Không thể tải FFmpeg WebAssembly. Vui lòng thử lại."
};

const enTranslations: Translations = {
  // Common / General
  "open_source": "Open Source",
  "tools": "Tools",
  "privacy": "Privacy",
  "github": "GitHub",
  "none": "None",

  // Home Page
  "hero_tagline": "Client-side media toolkit",
  "hero_title": "Fast, private media processing without uploading.",
  "hero_description": "MediaNinja combines image compression, metadata editing, and short video processing into a minimalist interface, running directly in your browser.",
  "metric_server_upload": "Server upload",
  "metric_media_tools": "Media tools",
  "metric_local_first": "Local-first",
  "workspace_title": "Start Processing",
  "workspace_description": "Choose a tool, drag and drop files, and process them locally in your browser.",

  // Tools Tab
  "tool_image_title": "Compress Images",
  "tool_image_label": "Image Optimizer",
  "tool_image_desc": "Batch optimize WebP, JPEG, PNG with flexible quality settings.",
  "tool_image_accept": "Drag & drop images here",
  "tool_video_title": "Trim Video",
  "tool_video_label": "FFmpeg.wasm",
  "tool_video_desc": "Convert formats, trim short videos directly in the browser.",
  "tool_video_accept": "Drag & drop short videos here",

  // Footer
  "footer_tagline": "© 2026 MediaNinja. Local-first media tools.",
  "footer_privacy_note": "No file uploads by default. No data lock-in.",
  "footer_github_link": "Open Source on GitHub",

  // Image Processor Dropzone
  "img_drop_title": "Compress Images in Browser",
  "img_drop_desc": "Select or drag and drop JPEG, PNG, WebP images. Images are processed 100% locally on your device, absolutely secure.",
  "img_drop_btn": "Choose images from device",

  // Image Processor Workspace
  "img_queue_title": "Processing Queue",
  "img_queue_count": "{count} images",
  "img_btn_add": "Add Images",
  "img_btn_clear_all": "Clear All",
  "img_btn_download_zip": "Download All ZIP ({count})",
  "img_btn_zipping": "Creating ZIP...",
  "img_btn_remove": "Remove from list",
  "img_status_pending": "Pending",
  "img_status_processing": "Processing",
  "img_status_ready": "Ready",
  "img_status_error": "Error",
  "img_no_preview": "No preview",
  "img_size_original": "Original: {size}",
  "img_size_reduced": "Reduced {percent}%",
  "img_size_increased": "Increased {percent}%",
  "img_size_unchanged": "(Unchanged)",
  "img_exif_title": "Original EXIF",
  "img_exif_cleared": "✓ Cleaned",
  "img_exif_camera": "📷 {camera}",
  "img_exif_cleared_msg": "✓ Cleaned privacy metadata.",
  "img_btn_clear_exif": "Clear EXIF",
  "img_btn_download": "Download",
  
  // Image Processor Sidebar
  "img_side_title": "Compression Settings",
  "img_side_quality": "Quality",
  "img_side_max_res": "Max Resolution",
  "img_side_keep_res": "Keep original resolution",
  "img_side_output_fmt": "Output Format",
  "img_side_keep_fmt": "Keep original format",
  "img_side_fmt_webp": "Convert to WebP (Optimized)",
  "img_side_fmt_jpeg": "Convert to JPEG",
  "img_side_fmt_png": "Convert to PNG",
  "img_side_auto_clear_exif": "Auto-clear Metadata",
  "img_side_auto_clear_exif_desc": "Remove EXIF & GPS for privacy",
  "img_side_btn_compress": "Start Compression ({count})",
  "img_side_btn_compressing": "Compressing images...",

  // Image Processor Errors
  "img_err_invalid_type": "Invalid format. Please select JPEG, PNG, or WebP images.",
  "img_err_processing_failed": "Cannot process this file. Please try another image.",
  "img_err_metadata_not_supported": "Cannot clear metadata for this file format.",
  "img_err_metadata_failed": "Cannot clear metadata. The image might be corrupted or not supported by the browser.",
  "img_err_metadata_failed_fallback": "Cannot clear metadata. The image might be corrupted or this format is not supported by the browser.",

  // Video Processor Global Bar
  "vid_err_global_close": "✕",
  "vid_batch_title": "Batch Processing ({count} videos)",
  "vid_batch_completed": "Completed {done}/{total} videos.",
  "vid_btn_start": "Start Processing",
  "vid_btn_rendering_queue": "Processing queue...",
  "vid_btn_download_zip": "Download All ZIP",
  "vid_btn_zipping": "Creating ZIP...",

  // Video Processor Sidebar Queue
  "vid_queue_title": "Queue",
  "vid_queue_count": "{count} files",
  "vid_queue_reading": "Reading...",
  "vid_queue_rendering": "Rendering...",
  "vid_queue_rendering_pct": "Rendering... {percent}%",
  "vid_queue_done": "Done ({size})",
  "vid_queue_error": "Error",
  "vid_queue_pending": "Pending...",
  "vid_queue_btn_remove": "Remove video from queue",
  "vid_queue_btn_add": "Add Video",
  "vid_queue_btn_clear": "Clear All",

  // Video Processor Editor Overlay
  "vid_editor_overlay_rendering": "Processing queue...",
  "vid_editor_overlay_rendering_video": "Rendering: {name}",

  // Video Processor Editor
  "vid_btn_pause_preview": "Pause Preview",
  "vid_btn_play_preview": "Play Selected Clip",
  "vid_editor_loop": "Loop",
  "vid_editor_range": "Play range: {start} - {end}",
  "vid_editor_timeline": "Timeline",
  "vid_editor_selected_duration": "Clip length {duration}",
  "vid_editor_warning_150mb": "Warning: Video is larger than 150MB. Regular rendering might cause browser out-of-memory. 'Fast Cut' is highly recommended.",
  "vid_editor_trimmed_output": "Clip length {duration}",
  "vid_editor_btn_download": "Download",
  "vid_editor_empty": "Please select or upload a video to edit",

  // Video Processor Sidebar Configuration
  "vid_config_title": "Export Settings",
  "vid_config_format": "Format",
  "vid_config_mute": "Mute Audio",
  "vid_config_fast_cut": "Fast Cut",
  "vid_config_fast_cut_desc": "No re-encoding, 100x faster",
  "vid_config_start": "Start",
  "vid_config_end": "End",

  // Video Processor Upload Panel
  "vid_upload_title": "Select multiple videos for visual trimming",
  "vid_upload_desc": "Supports MP4, MOV, and WebM. Videos are processed locally using FFmpeg.wasm, no server uploads. Sequential queuing avoids memory overflow.",
  "vid_upload_btn": "Select Video",

  // Video Processor Status Messages
  "vid_status_select": "Choose videos to start.",
  "vid_status_loading": "Loading FFmpeg WebAssembly...",
  "vid_status_ready": "Processor is ready.",
  "vid_status_error": "Failed to load FFmpeg.",
  
  // Video Processor Errors
  "vid_err_invalid_type": "Invalid file format. Please select MP4, MOV, or WebM.",
  "vid_err_too_large": "File \"{name}\" is too large (exceeds 300MB). Please select a smaller file.",
  "vid_err_duration_failed": "Cannot read video duration. Please try another file.",
  "vid_err_failed": "Video processing failed.",
  "vid_err_startup": "An error occurred while starting the process.",
  "vid_err_ffmpeg_load_failed": "Failed to load FFmpeg WebAssembly. Please try again."
};

const translations: Record<Language, Translations> = {
  vi: viTranslations,
  en: enTranslations,
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("vi");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("medianinja_lang") as Language;
    if (savedLanguage === "vi" || savedLanguage === "en") {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("medianinja_lang", lang);
  };

  const t = (key: string, variables?: Record<string, string | number>) => {
    let text = translations[language]?.[key] || translations["vi"]?.[key] || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, "g"), String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
