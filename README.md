# Real-Time Performance Dashboard: SSE vs WebSocket 📊

**Server-Sent Events (SSE) vs WebSocket Performance Demo** là một dự án minh họa thực tế nhằm so sánh hiệu suất và hành vi của hai công nghệ giao tiếp thời gian thực phổ biến: **Server-Sent Events (SSE)** và **WebSocket**.  

Dự án sử dụng **Node.js (Express + ws)** cho backend và một **real-time dashboard** ở frontend để trực quan hóa dữ liệu & độ trễ.

---

## 🌟 Tính Năng Chính
- **So Sánh Hiệu Suất Trực Tiếp**: Biểu đồ latency (ms) và throughput theo thời gian.  
- **Xử Lý Kết Nối Mạnh Mẽ**: SSE có auto-reconnect, WS cần reconnect thủ công.  
- **Giao Tiếp Hai Chiều**: WebSocket hỗ trợ tính năng echo (send ↔ receive).  
- **Mô Phỏng Mạng**: Test hành vi Offline/Online.  
- **Thống Kê Server**: API theo dõi số client, uptime, số tin nhắn.  

---

## 🛠️ Ngăn Xếp Công Nghệ
| Thành phần | Công nghệ | Ghi chú |
|------------|-----------|---------|
| Backend    | Node.js (16+), Express | HTTP Server |
|            | ws | Thư viện WebSocket hiệu suất cao |
| Frontend   | HTML, JavaScript | Dashboard + logic kết nối (EventSource, WebSocket) |
| Testing    | performance-test.js | Script stress test |

---

## 🚀 Bắt Đầu Nhanh

### Yêu Cầu
- Node.js **>= 16**
- npm

### 1. Cài đặt
```bash
git clone <repository_url> ws_sse_v2
cd ws_sse_v2/server
npm install
2. Chạy server
bash
Sao chép mã
# Production
npm run start 

# Development (với nodemon)
npm run dev
3. Mở dashboard
Truy cập: http://localhost:3000

💻 Hướng Dẫn Sử Dụng
Kết nối: Bấm Connect SSE và Connect WebSocket.

So sánh latency: Quan sát biểu đồ Latency (ms).

WebSocket thường <5ms.

SSE thường >5ms do overhead.

Auto-reconnect:

SSE: Tự động reconnect sau 3s khi Online trở lại.

WS: Cần click reconnect.

Broadcast: Gửi tin nhắn từ server đến mọi client.

Echo (chỉ WS): Gửi tin nhắn từ client, server echo trả về.

⚙️ Benchmark Tự Động
bash
Sao chép mã
cd server
npm run test
Kết quả sẽ in ra:

Latency: p95, p99

Throughput

📂 Cấu Trúc Dự Án
bash
Sao chép mã
ws-sse-v2/
├── client/
│   ├── dashboard.js        # Logic SSE/WS + tính latency
│   ├── index.html          # Dashboard UI
│   └── style.css           # CSS
├── server/
│   ├── server.js           # Endpoint SSE, WS + broadcast
│   ├── performance-test.js # Benchmark script
│   └── package.json
└── README.md
📝 Lưu Ý Kỹ Thuật
SSE Resilience: Dùng Content-Type: text/event-stream, field retry: và id: để resume stream.

WebSocket Overhead: WS dùng TCP persistent + frame nhỏ → latency thấp.

Proxy Buffering: Tắt buffering (VD: X-Accel-Buffering: no trong Nginx) khi dùng SSE.

🤝 Đóng Góp
PRs và Issues đều được hoan nghênh 🎉.

📧 Liên Hệ
Email: haicalisthenic132@gmail.com

📜 Giấy Phép
Dự án phát hành dưới giấy phép MIT License.
