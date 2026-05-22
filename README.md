# 🥷 MediaNinja

**MediaNinja** is a client-side, local-first media toolkit to compress images, clear EXIF metadata, and edit/trim short videos directly in your browser. All processing is done 100% on the client side. No server uploads. Absolute privacy.

**MediaNinja** là bộ công cụ xử lý media cục bộ (local-first) chạy trực tiếp trong trình duyệt, giúp nén ảnh hàng loạt, xóa sạch metadata EXIF và cắt/chỉnh sửa video ngắn nhanh chóng. Tất cả tác vụ được thực hiện 100% trên máy khách. Không tải lên máy chủ. Bảo mật tuyệt đối.

---

## 🌟 Key Features / Các Tính Năng Nổi Bật

### 📷 Image Optimizer (Nén ảnh & Xử lý Metadata)
* **Batch Compression (Nén hàng loạt)**: Optimize multiple JPEG, PNG, and WebP images simultaneously / Tối ưu cùng lúc nhiều ảnh JPEG, PNG, WebP.
* **Smart Preview (Xem trước thông minh)**: Drag & drop files to view original thumbnail, scan EXIF metadata, and estimate compressed file sizes before exporting / Kéo thả ảnh để xem trước hình thu nhỏ, quét thông tin EXIF và dự đoán dung lượng giảm trước khi xuất.
* **Privacy Guard (Bảo vệ riêng tư)**: Auto-strip EXIF metadata (camera, GPS, capture date) to secure your photos / Tự động loại bỏ thông tin EXIF và GPS nhạy cảm khỏi ảnh.
* **Flexible Export (Xuất linh hoạt)**: Control quality sliders, limit max resolution, choose output formats (WebP, JPEG, PNG, or keep original), and download everything as a single `.zip` file / Điều chỉnh chất lượng, giới hạn độ phân giải, đổi định dạng xuất và tải về tất cả dưới dạng file `.zip`.

### 🎥 Video Processor (Biên tập & Xử lý Video)
* **Client-side FFmpeg (FFmpeg trong trình duyệt)**: Power processing using `FFmpeg.wasm` (WebAssembly) / Xử lý video trực tiếp bằng sức mạnh của WebAssembly `FFmpeg.wasm`.
* **Fast Cut (Cắt cực nhanh)**: Extract and trim video clips without re-encoding, making it up to 100x faster / Cắt và trích xuất đoạn video không cần mã hóa lại, nhanh hơn tới 100 lần.
* **Aspect Ratio Crop (Cắt tỉ lệ khung hình)**: Crop videos to Vertical 9:16 (Center, Left, Right) or Square 1:1, perfect for TikTok, Reels, and Shorts / Cắt khung hình theo tỉ lệ dọc 9:16 (Giữa, Trái, Phải) hoặc vuông 1:1, tối ưu cho TikTok, Reels, Shorts.
* **Audio Denoise (Khử nhiễu âm thanh)**: Remove background noise (wind, hum, hiss) using smart audio filters / Loại bỏ tiếng rè, gió, tạp âm nền nhờ bộ lọc âm thanh thông minh.
* **Sensitive Area Blur (Che mờ vùng nhạy cảm)**: Add multiple customizable blur boxes over sensitive parts of the video with configurable start/end timestamps / Vẽ và kéo thả các hộp che mờ đối tượng nhạy cảm với khoảng thời gian áp dụng tùy ý.
* **Format Conversion & Muting (Định dạng & Âm thanh)**: Export to MP4, WebM, GIF, or MP3 (audio only), and toggle audio muting / Hỗ trợ chuyển đổi sang MP4, WebM, GIF, MP3 (chỉ lấy nhạc) và tùy chọn tắt âm thanh.
* **Batch Queue (Hàng đợi xử lý)**: Process and queue multiple video edits sequentially to prevent browser memory overflow / Sắp xếp hàng đợi xử lý tuần tự để tránh tràn bộ nhớ trình duyệt.

### 🎙️ Subtitle Generator (Trình tạo Phụ đề tự động)
* **Local Whisper AI (Whisper AI cục bộ)**: Offline speech-to-text running directly in the browser via `@huggingface/transformers` WebAssembly runtime / Nhận dạng giọng nói ngoại tuyến trực tiếp trong trình duyệt sử dụng mô hình Whisper AI.
* **Format Export (Xuất định dạng)**: Generate and download subtitles in `.srt`, `.vtt`, or plain `.txt` files / Trích xuất và tải về phụ đề dưới định dạng `.srt`, `.vtt` hoặc văn bản thuần `.txt`.
* **Interactive Editor (Trình chỉnh sửa trực quan)**: View, edit, add, or delete subtitle segments in real-time, synchronized with the video player / Xem, chỉnh sửa nội dung, thời gian hoặc thêm/xóa các dòng phụ đề đồng bộ với video.
* **Burn-in Subtitles (Chèn cứng phụ đề)**: Embed generated subtitles directly into the video file locally using FFmpeg / Ghi đè chèn cứng phụ đề trực tiếp vào video thông qua FFmpeg.

### 🌐 Global / Tiện ích khác
* **Bilingual Support (Hỗ trợ Song ngữ)**: Switch seamlessly between Vietnamese (`vi`) and English (`en`) via the footer language dropdown / Chuyển đổi mượt mà giữa Tiếng Việt và Tiếng Anh qua hộp chọn ngôn ngữ ở Footer.
* **Persistent Preferences (Ghi nhớ cấu hình)**: Saves language selection and settings in browser's local storage / Tự động ghi nhớ ngôn ngữ đã chọn bằng `localStorage`.

---

## 🛠️ Tech Stack / Công Nghệ Sử Dụng

* **Framework**: Next.js (App Router, Turbopack)
* **Styling**: Tailwind CSS v4
* **Core Libraries**:
  * [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) (WebAssembly FFmpeg)
  * [@huggingface/transformers](https://github.com/huggingface/transformers) (WebAssembly Machine Learning for Whisper AI)
  * [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) (Client-side image optimizer)
  * [exif-js](https://github.com/exif-js/exif-js) (EXIF parser)
  * [jszip](https://github.com/Stuk/jszip) (Client-side zip archive generator)

---

## 🚀 Getting Started / Khởi Chạy Dự Án

### Prerequisites / Yêu cầu
Make sure you have Node.js (v18+) installed / Đảm bảo máy của bạn đã cài đặt Node.js (từ v18 trở lên).

### Installation / Cài đặt

1. Clone the repository / Tải mã nguồn về máy:
   ```bash
   git clone https://github.com/KhangLama/media-ninja.git
   cd media-ninja
   ```

2. Install dependencies / Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

3. Run the development server / Chạy server phát triển:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

4. Build for production / Biên dịch phiên bản chạy thực tế:
   ```bash
   npm run build
   ```

### ⚠️ Deployment Note (Lưu ý khi Deploy)
Because `FFmpeg.wasm` relies on shared memory buffer headers, your hosting server (Vercel, Netlify, etc.) **must** respond with the following HTTP headers for the video tools to load properly:

Vì `FFmpeg.wasm` sử dụng cấu trúc bộ nhớ chia sẻ, máy chủ lưu trữ của bạn **bắt buộc** phải trả về các HTTP header sau để các tính năng video hoạt động:
```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

*(Note: In this repository, these headers are pre-configured in `next.config.ts` for local development and Vercel).*

---

## 📄 License / Giấy Phép
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Dự án này tuân thủ theo giấy phép MIT - xem file [LICENSE](LICENSE) để biết thêm thông tin chi tiết.
