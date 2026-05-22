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

## 💻 Hardware & Performance Guide / Khuyến Nghị Cấu Hình & Tối Ưu

Running complex tools like **FFmpeg.wasm** and **Whisper AI** 100% locally in the browser can be CPU and RAM intensive. Below are recommended settings and practices to ensure smooth performance and prevent browser crashes:

Việc chạy các tác vụ nặng như **FFmpeg.wasm** và **Whisper AI** trực tiếp 100% trên trình duyệt đòi hỏi nhiều tài nguyên CPU và RAM. Dưới đây là các khuyến nghị cấu hình và lưu ý để tránh treo trình duyệt:

### ⚙️ Recommended System Specs / Cấu hình khuyến nghị
* **CPU**: Multi-core processor (Apple Silicon M1/M2/M3, Intel Core i5/i7 10th Gen+, AMD Ryzen 5+) is highly recommended for multi-threaded WebAssembly execution / Bộ vi xử lý đa nhân được khuyến nghị để xử lý WebAssembly đa luồng mượt mà.
* **RAM**: **8 GB** minimum (**16 GB** recommended) to prevent out-of-memory crashes / Tối thiểu **8 GB** RAM (khuyến nghị **16 GB**) để tránh bị tràn bộ nhớ gây sập tab trình duyệt.
* **Browser**: Latest Google Chrome, Microsoft Edge, or Brave (due to superior WebAssembly performance and shared memory support) / Trình duyệt Chrome, Edge hoặc Brave bản mới nhất.

### 💡 Optimization Tips / Mẹo tối ưu hóa
1. **Use Fast Cut (Ưu tiên Cắt Nhanh)**:
   * If you only need to trim or mute, keep **Fast Cut** enabled. It extracts video frames without re-encoding, taking seconds and using minimal CPU / Nếu chỉ cần cắt hoặc tắt âm, hãy giữ bật **Cắt Nhanh (Fast Cut)**. Tác vụ này không encode lại, hoàn thành trong vài giây và tốn cực ít tài nguyên.
2. **Video File Size (Kích thước tệp video)**:
   * Keep video files under **100MB** (hard limit is **300MB**) when applying complex filters (Crop, Blur, Denoise) to prevent browser memory overflow / Khuyên dùng tệp video dưới **100MB** (giới hạn cứng **300MB**) khi sử dụng các bộ lọc như cắt khung hình, che mờ, lọc tiếng ồn để tránh tràn bộ nhớ trình duyệt.
3. **Whisper AI Model (Mô hình Whisper AI)**:
   * The first transcription downloads a **75MB** Whisper-Tiny model. It is cached in the browser's local Cache Storage. Subsequent runs will work instantly and 100% offline / Lần chạy đầu tiên sẽ tải mô hình Whisper-Tiny (~75MB). Mô hình sau đó được lưu cache cục bộ và chạy ngay lập tức hoàn toàn offline ở các lần sau.
4. **Close Heavy Tabs (Đóng bớt tab nặng)**:
   * Close resource-heavy browser tabs (e.g., Figma, YouTube, games) while processing queue / Đóng bớt các tab tốn RAM khác trước khi chạy hàng đợi xử lý video để tránh xung đột tài nguyên.

---

## 📄 License / Giấy Phép
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Dự án này tuân thủ theo giấy phép MIT - xem file [LICENSE](LICENSE) để biết thêm thông tin chi tiết.
