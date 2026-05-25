"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "vi" | "en";

type Translations = Record<string, string>;

const viTranslations: Translations = {
  // Common / General
  "tools": "Công cụ",
  "privacy": "Riêng tư",
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

  // Crop & Denoise
  "vid_config_crop": "Tỉ lệ khung hình",
  "vid_config_crop_original": "Giữ nguyên (Original)",
  "vid_config_crop_916_center": "Dọc 9:16 (TikTok/Reels - Giữa)",
  "vid_config_crop_916_left": "Dọc 9:16 (TikTok/Reels - Trái)",
  "vid_config_crop_916_right": "Dọc 9:16 (TikTok/Reels - Phải)",
  "vid_config_crop_11": "Vuông 1:1 (Square)",
  "vid_config_denoise": "Lọc tiếng ồn (Denoise)",
  "vid_config_denoise_desc": "Giảm tạp âm rè, gió, còi xe...",
  "vid_config_fast_cut_disabled": "Cắt nhanh bị tắt do bạn bật bộ lọc (Crop/Denoise/Blur)",

  // Redaction / Area Blur
  "vid_blur_title": "Che mờ vùng nhạy cảm",
  "vid_blur_add_btn": "Thêm vùng mờ",
  "vid_blur_box_label": "Vùng mờ {index}",
  "vid_blur_start_time": "Từ giây",
  "vid_blur_end_time": "Đến giây",
  "vid_blur_remove_btn": "Xóa",
  "vid_blur_empty": "Chưa có vùng mờ nào được thêm",
  "vid_blur_helper": "Bấm 'Thêm vùng mờ' và kéo/thay đổi kích thước khung màu xanh trên video. Đặt khoảng thời gian áp dụng tương ứng.",

  // Speech-to-Text Subtitle Generator
  "tool_subtitle_title": "Tạo phụ đề",
  "tool_subtitle_label": "Whisper AI",
  "tool_subtitle_desc": "Tự động trích xuất phụ đề offline bằng AI 100% trong trình duyệt.",
  "sub_title": "Trình tạo Phụ đề tự động (Speech to Text)",
  "sub_desc": "Nhận dạng giọng nói và trích xuất phụ đề offline sử dụng Whisper AI. Chạy 100% trên trình duyệt của bạn.",
  "sub_upload_title": "Tải lên file video hoặc audio",
  "sub_upload_desc": "Hỗ trợ MP4, MOV, WebM, MP3, WAV, M4A... Dữ liệu chạy cục bộ, không upload lên máy chủ.",
  "sub_upload_btn": "Chọn file âm thanh/video",
  "sub_status_idle": "Sẵn sàng trích xuất phụ đề.",
  "sub_status_loading_model": "Đang tải mô hình Whisper AI... (~75MB, chỉ tải lần đầu)",
  "sub_status_decoding_audio": "Đang giải mã và resample âm thanh...",
  "sub_status_transcribing": "Đang nhận diện giọng nói... {percent}%",
  "sub_status_done": "Đã trích xuất phụ đề thành công!",
  "sub_status_error": "Lỗi trích xuất phụ đề.",
  "sub_err_decode": "Không thể giải mã âm thanh từ file này. Vui lòng kiểm tra xem tệp có chứa tiếng (audio track) hoặc chuyển đổi sang MP3/WAV/MP4 chuẩn để thử lại.",
  "sub_btn_transcribe": "Bắt đầu trích xuất phụ đề",
  "sub_btn_download_srt": "Tải file .SRT",
  "sub_btn_download_vtt": "Tải file .VTT",
  "sub_btn_download_txt": "Tải file .TXT",
  "sub_btn_burn_in": "Chèn cứng phụ đề vào video",
  "sub_btn_burn_in_rendering": "Đang chèn phụ đề...",
  "sub_editor_title": "Bảng phụ đề ({count})",
  "sub_editor_add_btn": "Thêm câu phụ đề",
  "sub_editor_no_segments": "Chưa có câu phụ đề nào. Nhấn bắt đầu để trích xuất phụ đề tự động.",
  "sub_editor_sync_player": "Đồng bộ video",
  "sub_editor_btn_delete": "Xóa câu",

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
  "vid_err_ffmpeg_load_failed": "Không thể tải FFmpeg WebAssembly. Vui lòng thử lại.",

  // PDF Processor
  "tool_pdf_title": "Bộ công cụ PDF",
  "tool_pdf_label": "PDF Suite",
  "tool_pdf_desc": "Ghép, tách, nén, đóng dấu, xoay và chuyển đổi PDF trực tiếp trong trình duyệt.",
  "pdf_tab_merge": "Ghép PDF",
  "pdf_tab_split": "Tách PDF",
  "pdf_tab_img_to_pdf": "Ảnh sang PDF",
  "pdf_tab_pdf_to_img": "PDF sang Ảnh",
  "pdf_tab_compress": "Nén PDF",
  "pdf_tab_rotate": "Xoay trang",
  "pdf_tab_watermark": "Đóng dấu bản quyền",
  "pdf_drop_desc": "Chọn hoặc kéo thả các file PDF/ảnh vào đây. Quá trình xử lý chạy 100% offline.",
  "pdf_btn_merge": "Ghép các file PDF",
  "pdf_btn_split": "Tách file PDF",
  "pdf_btn_img_to_pdf": "Chuyển ảnh sang PDF",
  "pdf_btn_pdf_to_img": "Chuyển PDF sang ảnh",
  "pdf_btn_compress": "Nén file PDF",
  "pdf_btn_rotate": "Xoay trang PDF",
  "pdf_btn_watermark": "Đóng dấu bản quyền",
  "pdf_label_select_files": "Chọn file",
  "pdf_label_watermark_text": "Chữ đóng dấu",
  "pdf_label_watermark_opacity": "Độ mờ (Opacity)",
  "pdf_label_watermark_size": "Kích thước chữ",
  "pdf_label_watermark_color": "Màu sắc",
  "pdf_label_compress_level": "Mức nén",
  "pdf_label_compress_low": "Nén ít (Chất lượng cao)",
  "pdf_label_compress_medium": "Nén vừa (Khuyên dùng)",
  "pdf_label_compress_high": "Nén nhiều (Chất lượng thấp)",
  "pdf_label_rotate_angle": "Góc xoay",
  "pdf_label_rotate_90": "Xoay phải 90°",
  "pdf_label_rotate_180": "Xoay 180°",
  "pdf_label_rotate_270": "Xoay trái 90° (270°)",
  "pdf_label_split_range": "Trang cần tách (ví dụ: 1-3, 5, 8)",
  "pdf_status_processing": "Đang xử lý PDF...",
  "pdf_status_ready": "Sẵn sàng",
  "pdf_status_error": "Lỗi xử lý PDF. Vui lòng kiểm tra lại file.",
  "pdf_status_success": "Xử lý thành công!",
  "pdf_btn_download": "Tải về file kết quả",
  "pdf_btn_show_preview": "Xem trước",
  "pdf_btn_hide_preview": "Ẩn xem trước",
  "pdf_preview_loading": "Đang tải xem trước...",
  "pdf_preview_prev": "Trước",
  "pdf_preview_next": "Sau",
  "pdf_preview_page": "Trang {page} / {total}",

  // OCR Extractor
  "tool_ocr_title": "Trích xuất chữ",
  "tool_ocr_label": "OCR Text Extractor",
  "tool_ocr_desc": "Nhận diện và trích xuất chữ viết từ ảnh hoặc PDF quét offline.",
  "ocr_drop_desc": "Kéo thả tệp ảnh (PNG, JPEG, WebP) hoặc tài liệu PDF vào đây. Quá trình nhận diện chạy 100% offline.",
  "ocr_btn_extract": "Bắt đầu trích xuất chữ",
  "ocr_status_loading_model": "Đang tải mô hình ngôn ngữ... (~15MB, chỉ tải lần đầu)",
  "ocr_status_processing": "Đang trích xuất chữ... {percent}%",
  "ocr_status_pdf_page": "Đang xử lý trang PDF {page}/{total}...",
  "ocr_status_success": "Trích xuất chữ thành công!",
  "ocr_status_error": "Lỗi nhận diện chữ. Vui lòng kiểm tra lại file.",
  "ocr_label_lang": "Ngôn ngữ nhận diện",
  "ocr_lang_vi": "Tiếng Việt",
  "ocr_lang_en": "Tiếng Anh",
  "ocr_lang_both": "Cả hai (Anh + Việt)",
  "ocr_result_title": "Kết quả văn bản trích xuất",
  "ocr_btn_copy": "Sao chép văn bản",
  "ocr_copied": "Đã sao chép!",

  // QR Studio
  "tool_qr_title": "QR Studio",
  "tool_qr_label": "QR Customizer & Scanner",
  "tool_qr_desc": "Tạo mã QR nghệ thuật (gradient, chèn logo) và quét mã QR offline.",
  "qr_tab_generate": "Tạo mã QR",
  "qr_tab_scan": "Quét mã QR",
  "qr_label_content": "Nội dung mã QR (URL hoặc Văn bản)",
  "qr_label_logo": "Tải ảnh Logo chèn ở giữa (Tùy chọn)",
  "qr_label_logo_clear": "Xóa logo",
  "qr_label_style": "Tùy chỉnh phong cách",
  "qr_style_dots": "Kiểu điểm (Dots)",
  "qr_style_dots_rounded": "Tròn mềm",
  "qr_style_dots_classy": "Cách điệu",
  "qr_style_dots_square": "Vuông cổ điển",
  "qr_style_corners": "Kiểu góc (Corners)",
  "qr_style_corners_dot": "Hình tròn",
  "qr_style_corners_square": "Hình vuông",
  "qr_label_color_type": "Loại màu",
  "qr_color_solid": "Màu đơn (Solid)",
  "qr_color_gradient": "Màu chuyển (Gradient)",
  "qr_label_color": "Màu sắc QR",
  "qr_label_color_start": "Màu bắt đầu",
  "qr_label_color_end": "Màu kết thúc",
  "qr_btn_download_png": "Tải ảnh PNG",
  "qr_btn_download_svg": "Tải file SVG",
  "qr_scan_drop_desc": "Kéo thả ảnh chứa mã QR cần quét vào đây. Quá trình quét chạy 100% offline.",
  "qr_scan_status_success": "Quét mã QR thành công!",
  "qr_scan_status_error": "Không tìm thấy hoặc không đọc được mã QR trong ảnh.",
  "qr_scan_result": "Nội dung giải mã QR",
  "qr_scan_btn_open": "Mở liên kết",
  "qr_scan_btn_copy": "Sao chép nội dung"
};

const enTranslations: Translations = {
  // Common / General
  "tools": "Tools",
  "privacy": "Privacy",
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

  // Crop & Denoise
  "vid_config_crop": "Aspect Ratio",
  "vid_config_crop_original": "Original",
  "vid_config_crop_916_center": "Vertical 9:16 (Center)",
  "vid_config_crop_916_left": "Vertical 9:16 (Left)",
  "vid_config_crop_916_right": "Vertical 9:16 (Right)",
  "vid_config_crop_11": "Square 1:1",
  "vid_config_denoise": "Denoise Audio",
  "vid_config_denoise_desc": "Reduce background noise (wind, hum, hiss)",
  "vid_config_fast_cut_disabled": "Fast Cut disabled due to active filters (Crop/Denoise/Blur)",

  // Redaction / Area Blur
  "vid_blur_title": "Video Redaction / Blur",
  "vid_blur_add_btn": "Add Blur Box",
  "vid_blur_box_label": "Blur Box {index}",
  "vid_blur_start_time": "Start (sec)",
  "vid_blur_end_time": "End (sec)",
  "vid_blur_remove_btn": "Delete",
  "vid_blur_empty": "No blur boxes added yet",
  "vid_blur_helper": "Click 'Add Blur Box' and drag/resize the blue box on the video. Set the start and end times for the blur.",

  // Speech-to-Text Subtitle Generator
  "tool_subtitle_title": "Subtitles",
  "tool_subtitle_label": "Whisper AI",
  "tool_subtitle_desc": "Automatically generate subtitles offline using AI in your browser.",
  "sub_title": "Automatic Subtitle Generator (Speech to Text)",
  "sub_desc": "Transcribe audio offline using Whisper AI. Runs 100% in your browser.",
  "sub_upload_title": "Upload video or audio file",
  "sub_upload_desc": "Supports MP4, MOV, WebM, MP3, WAV, M4A... Processed locally, no server uploads.",
  "sub_upload_btn": "Select Audio/Video File",
  "sub_status_idle": "Ready to generate subtitles.",
  "sub_status_loading_model": "Loading Whisper AI model... (~75MB, first time only)",
  "sub_status_decoding_audio": "Decoding and resampling audio...",
  "sub_status_transcribing": "Transcribing speech... {percent}%",
  "sub_status_done": "Subtitles generated successfully!",
  "sub_status_error": "Failed to generate subtitles.",
  "sub_err_decode": "Could not decode audio from this file. Please verify that the file has an audio track, or convert it to standard MP3/WAV/MP4 format and try again.",
  "sub_btn_transcribe": "Start Transcription",
  "sub_btn_download_srt": "Download .SRT",
  "sub_btn_download_vtt": "Download .VTT",
  "sub_btn_download_txt": "Download .TXT",
  "sub_btn_burn_in": "Burn Subtitles into Video",
  "sub_btn_burn_in_rendering": "Burning subtitles...",
  "sub_editor_title": "Subtitle List ({count})",
  "sub_editor_add_btn": "Add Segment",
  "sub_editor_no_segments": "No subtitle segments yet. Start transcription to generate subtitles.",
  "sub_editor_sync_player": "Sync Video",
  "sub_editor_btn_delete": "Delete",

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
  "vid_err_ffmpeg_load_failed": "Failed to load FFmpeg WebAssembly. Please try again.",

  // PDF Processor
  "tool_pdf_title": "PDF Tools",
  "tool_pdf_label": "PDF Suite",
  "tool_pdf_desc": "Merge, split, compress, watermark, rotate, and convert PDFs directly in the browser.",
  "pdf_tab_merge": "Merge PDF",
  "pdf_tab_split": "Split PDF",
  "pdf_tab_img_to_pdf": "Images to PDF",
  "pdf_tab_pdf_to_img": "PDF to Images",
  "pdf_tab_compress": "Compress PDF",
  "pdf_tab_rotate": "Rotate Pages",
  "pdf_tab_watermark": "Watermark",
  "pdf_drop_desc": "Select or drag and drop PDF files or images here. Processing runs 100% offline.",
  "pdf_btn_merge": "Merge PDF Files",
  "pdf_btn_split": "Split PDF File",
  "pdf_btn_img_to_pdf": "Convert Images to PDF",
  "pdf_btn_pdf_to_img": "Convert PDF to Images",
  "pdf_btn_compress": "Compress PDF",
  "pdf_btn_rotate": "Rotate PDF Pages",
  "pdf_btn_watermark": "Add Watermark",
  "pdf_label_select_files": "Select files",
  "pdf_label_watermark_text": "Watermark Text",
  "pdf_label_watermark_opacity": "Opacity",
  "pdf_label_watermark_size": "Font Size",
  "pdf_label_watermark_color": "Color",
  "pdf_label_compress_level": "Compression Level",
  "pdf_label_compress_low": "Low (High Quality)",
  "pdf_label_compress_medium": "Medium (Recommended)",
  "pdf_label_compress_high": "High (Low Quality)",
  "pdf_label_rotate_angle": "Rotate Angle",
  "pdf_label_rotate_90": "90° Clockwise",
  "pdf_label_rotate_180": "180°",
  "pdf_label_rotate_270": "90° Counter-Clockwise (270°)",
  "pdf_label_split_range": "Pages to extract (e.g. 1-3, 5, 8)",
  "pdf_status_processing": "Processing PDF...",
  "pdf_status_ready": "Ready",
  "pdf_status_error": "Failed to process PDF. Please check your files.",
  "pdf_status_success": "Processed successfully!",
  "pdf_btn_download": "Download Result",
  "pdf_btn_show_preview": "Preview",
  "pdf_btn_hide_preview": "Hide Preview",
  "pdf_preview_loading": "Loading preview...",
  "pdf_preview_prev": "Prev",
  "pdf_preview_next": "Next",
  "pdf_preview_page": "Page {page} / {total}",

  // OCR Extractor
  "tool_ocr_title": "Extract Text",
  "tool_ocr_label": "OCR Text Extractor",
  "tool_ocr_desc": "Recognize and extract text from images or scanned PDFs offline.",
  "ocr_drop_desc": "Drag and drop image files (PNG, JPEG, WebP) or PDF documents here. Recognition runs 100% offline.",
  "ocr_btn_extract": "Start Text Extraction",
  "ocr_status_loading_model": "Loading language models... (~15MB, first time only)",
  "ocr_status_processing": "Extracting text... {percent}%",
  "ocr_status_pdf_page": "Processing PDF page {page}/{total}...",
  "ocr_status_success": "Text extracted successfully!",
  "ocr_status_error": "Failed to extract text. Please check your files.",
  "ocr_label_lang": "Recognition Language",
  "ocr_lang_vi": "Vietnamese",
  "ocr_lang_en": "English",
  "ocr_lang_both": "Both (English + Vietnamese)",
  "ocr_result_title": "Extracted Text Result",
  "ocr_btn_copy": "Copy Text",
  "ocr_copied": "Copied!",

  // QR Studio
  "tool_qr_title": "QR Studio",
  "tool_qr_label": "QR Customizer & Scanner",
  "tool_qr_desc": "Generate custom QR codes (gradients, logos) and scan QRs offline.",
  "qr_tab_generate": "Generate QR",
  "qr_tab_scan": "Scan QR",
  "qr_label_content": "QR Code Content (URL or Text)",
  "qr_label_logo": "Upload Logo image for center (Optional)",
  "qr_label_logo_clear": "Remove logo",
  "qr_label_style": "Customize Style",
  "qr_style_dots": "Dot Style",
  "qr_style_dots_rounded": "Rounded",
  "qr_style_dots_classy": "Classy",
  "qr_style_dots_square": "Square",
  "qr_style_corners": "Corner Style",
  "qr_style_corners_dot": "Dot",
  "qr_style_corners_square": "Square",
  "qr_label_color_type": "Color Type",
  "qr_color_solid": "Solid Color",
  "qr_color_gradient": "Gradient",
  "qr_label_color": "QR Color",
  "qr_label_color_start": "Start Color",
  "qr_label_color_end": "End Color",
  "qr_btn_download_png": "Download PNG",
  "qr_btn_download_svg": "Download SVG",
  "qr_scan_drop_desc": "Drag and drop an image containing a QR code here. Scanning runs 100% offline.",
  "qr_scan_status_success": "QR code scanned successfully!",
  "qr_scan_status_error": "No QR code found or could not read QR code from the image.",
  "qr_scan_result": "Decoded QR Content",
  "qr_scan_btn_open": "Open Link",
  "qr_scan_btn_copy": "Copy Content"
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
      setTimeout(() => {
        setLanguageState((prev) => (prev !== savedLanguage ? savedLanguage : prev));
      }, 0);
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
