Real-Time Performance Dashboard: SSE vs WebSocket 📊
Server-Sent Events (SSE) vs WebSocket Performance Demo là một dự án minh họa thực tế nhằm so sánh hiệu suất và hành vi của hai công nghệ giao tiếp thời gian thực phổ biến: Server-Sent Events (SSE) và WebSocket. Dự án sử dụng Node.js (Express + ws) ở Backend và một bảng điều khiển (dashboard) thời gian thực ở Frontend để trực quan hóa dữ liệu và số liệu độ trễ.

🌟 Tính Năng Chính
So Sánh Hiệu Suất Trực Tiếp: Hiển thị độ trễ trung bình (Latency) và thông lượng (Throughput) của SSE và WebSocket trên biểu đồ thời gian thực.

Xử Lý Kết Nối Mạnh Mẽ: Minh họa cơ chế tự động kết nối lại (auto-reconnect) tích hợp của SSE so với yêu cầu kết nối lại thủ công của WebSocket.

Giao Tiếp Hai Chiều: Hỗ trợ tính năng echo (gửi - nhận) độc quyền của WebSocket để kiểm tra giao tiếp hai chiều.

Simulate Mạng: Kiểm tra hành vi kết nối khi mô phỏng mạng bị ngắt (Offline/Online).

Thống Kê Server: Cung cấp API để truy vấn số liệu thống kê máy chủ theo thời gian thực (số client, số tin nhắn đã gửi, thời gian hoạt động).

🛠️ Ngăn Xếp Công Nghệ (Tech Stack)
Thành Phần	Công Nghệ	Ghi Chú
Backend	Node.js (16+), Express	Khung sườn máy chủ HTTP.
ws	Thư viện WebSocket hiệu suất cao.
Frontend	HTML, JavaScript (EventSource, WebSocket)	Bảng điều khiển và logic kết nối.
Testing	performance-test.js	Kịch bản stress test hiệu suất.

Xuất sang Trang tính
🚀 Bắt Đầu Nhanh
Yêu Cầu
Node.js phiên bản 16 trở lên

npm

1. Cài Đặt
Clone kho lưu trữ và cài đặt các gói phụ thuộc:

Bash

git clone <repository_url> ws_sse_v2
cd ws_sse_v2/server
npm install
2. Chạy Server
Sử dụng lệnh start hoặc dev (với nodemon để tự động khởi động lại):

Bash

# Chạy trong môi trường Sản xuất
npm run start 

# Hoặc Chạy trong môi trường Phát triển
npm run dev 
3. Mở Dashboard
Truy cập URL sau trên trình duyệt của bạn:

http://localhost:3000
💻 Hướng Dẫn Sử Dụng & Kiểm Thử
Sau khi truy cập Dashboard, bạn có thể thực hiện các bước sau để so sánh hai giao thức:

Thiết Lập Kết Nối: Bấm "Connect SSE" và "Connect WebSocket". Quan sát dữ liệu bắt đầu truyền trên Biểu đồ và Log tin nhắn.

Kiểm Thử Độ Trễ: Quan sát đường biểu đồ Latency (ms). WebSocket luôn được kỳ vọng có độ trễ thấp hơn (thường dưới 5ms) so với SSE (thường trên 5ms) do overhead giao thức thấp hơn.

Kiểm Thử Khả Năng Tự Phục Hồi (Auto-Reconnect):

Mở DevTools (F12) → Tab Network → Chọn Offline/Online.

SSE: Khi Offline, trạng thái chuyển sang "Lỗi kết nối" và tự động thử kết nối lại sau 3 giây (do retry: 3000) khi chuyển sang Online.

WebSocket: Khi Offline, trạng thái chuyển sang "Đã ngắt kết nối" và cần bấm lại nút "Kết nối WebSocket" để phục hồi.

Kiểm Thử Broadcast: Sử dụng ô "Phát sóng" để gửi tin nhắn từ Server tới tất cả các client (SSE và WS).

Kiểm Thử Giao Tiếp Hai Chiều (Chỉ WS): Sử dụng ô nhập liệu trong Panel WebSocket để gửi tin nhắn lên Server (Server sẽ echo lại tin nhắn đó).

⚙️ Chạy Benchmark Tự Động
Để đo lường hiệu suất trong môi trường không bị ảnh hưởng bởi trình duyệt, hãy chạy kịch bản kiểm thử hiệu suất bằng Node.js:

Bash

cd server
npm run test
Kết quả sẽ in ra số liệu latency (p95, p99) và throughput của cả hai giao thức.

📂 Cấu Trúc Dự Án
ws-sse-v2/
├── client/
│   ├── dashboard.js      # Logic phía máy khách: quản lý EventSource, WebSocket, tính toán độ trễ
│   ├── index.html        # Giao diện dashboard
│   └── style.css         # CSS cho giao diện
├── server/
│   ├── server.js         # Logic máy chủ: quản lý endpoints, tạo dữ liệu mô phỏng, broadcast
│   ├── performance-test.js # Kịch bản kiểm thử hiệu suất tự động (benchmark)
│   └── package.json
└── README.md
📝 Lưu Ý Kỹ Thuật Quan Trọng
SSE Resilience: Sự mạnh mẽ của SSE đến từ hai yếu tố: header Content-Type: text/event-stream và hai trường tiêu chuẩn là retry: (thiết lập thời gian chờ reconnect) và id: (giúp client resume luồng dữ liệu chính xác).

WebSocket Overhead: WebSocket đạt độ trễ thấp vì sau quá trình bắt tay HTTP, nó chuyển sang giao thức riêng, truyền dữ liệu bằng các frame nhỏ (minimal overhead), giữ kết nối TCP mở liên tục.

Proxy Buffering: Khi triển khai SSE trong môi trường production, cần đảm bảo các proxy (như Nginx) đã tắt tính năng buffering (ví dụ: X-Accel-Buffering: no) để tránh dữ liệu bị giữ lại và gửi đi theo lô (batch), làm mất tính thời gian thực.

🤝 Đóng Góp
Mọi đóng góp (Pull Requests) hoặc báo cáo lỗi (Issues) đều được hoan nghênh.

📧 Liên Hệ
Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ: haicalisthenic132@gmail.com

📜 Giấy Phép
Dự án này được cấp phép theo MIT License.
