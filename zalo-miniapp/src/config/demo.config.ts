/**
 * Nội dung của bản DEMO — pop-up khi mở app và các dòng ghi chú gắn ở đầu từng
 * màn mô phỏng. Chỉ hiển thị khi `appConfig.demoMode` bật (VITE_DEMO_MODE).
 *
 * Vì sao gom vào đây: Zalo từ chối hồ sơ xét duyệt ngày 05/09/2026 với yêu cầu
 * "hiển thị pop-up khi người dùng truy cập vào app" và "bổ sung thông tin Demo
 * tại các mục mô phỏng". Lời văn của những dòng này là thứ bên xét duyệt đọc,
 * nên để một chỗ sửa được ngay mà không phải lần tìm trong từng component.
 */

export const demoConfig = {
  /** Nhãn nhỏ gắn cạnh tiêu đề mỗi màn */
  badge: "DEMO",

  /** Pop-up bắt buộc, hiện mỗi lần mở app */
  intro: {
    title: "Đây là ứng dụng DEMO",
    lines: [
      "Ứng dụng chỉ phục vụ mục đích trải nghiệm và kiểm thử tính năng, không phải kênh hành chính chính thức của bất kỳ UBND xã/phường nào.",
      "Toàn bộ tên đơn vị, tin tức, hồ sơ, danh bạ và phiếu phản ánh trong ứng dụng đều là dữ liệu mẫu, không phải thông tin thật của cơ quan nhà nước.",
      "Phản ánh gửi trong ứng dụng không được chuyển tới cơ quan chức năng. Khi cần phản ánh thật, vui lòng liên hệ trực tiếp UBND xã/phường nơi bạn cư trú.",
    ],
    confirm: "Tôi đã hiểu",
  },

  /** Ghi chú đầu màn — khoá trùng với tên màn để dễ dò ngược */
  notes: {
    onboarding: "Bản demo: số điện thoại chỉ dùng để tạo phiên trải nghiệm, không đăng ký với cơ quan nhà nước.",
    sendFeedback: "Bản demo: phiếu bạn gửi chỉ được lưu để trải nghiệm, KHÔNG chuyển tới cơ quan chức năng và không được xử lý.",
    myFeedback: "Bản demo: trạng thái và tiến độ xử lý của các phiếu dưới đây là kết quả mô phỏng.",
    lookup: "Bản demo: kết quả tra cứu lấy từ dữ liệu mẫu, không kết nối hệ thống một cửa thật.",
    directory: "Bản demo: tên cán bộ và số điện thoại dưới đây là dữ liệu mẫu, không gọi tới cơ quan thật.",
    news: "Bản demo: các bản tin dưới đây là nội dung mẫu, không phải thông báo chính thức của chính quyền.",
    radio: "Bản demo: bản tin truyền thanh là nội dung mẫu dùng để thử tính năng phát thanh.",
    video: "Bản demo: video dưới đây là nội dung mẫu, không phải tư liệu tuyên truyền chính thức.",
    map: "Bản demo: các điểm kinh doanh, dịch vụ trên bản đồ là dữ liệu mẫu.",
    cccd: "Bản demo: dữ liệu quét được chỉ hiển thị tại chỗ để thử tính năng, không gửi đi và không lưu vào hồ sơ nào.",
  },
} as const;
