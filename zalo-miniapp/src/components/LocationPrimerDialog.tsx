import { Icon } from "./Icon";
import { locationPrimer } from "@/config/demo.config";

interface Props {
  /** Người dân đồng ý cho ứng dụng hỏi vị trí — mở hộp thoại quyền của hệ thống */
  onAccept: () => void;
  /** Người dân chọn tự nhập địa chỉ, không hỏi vị trí */
  onDecline: () => void;
}

/**
 * Màn mồi trước khi gọi `navigator.geolocation`.
 *
 * VÌ SAO CẦN: hộp thoại xin quyền vị trí đứng sau đây là hộp thoại GỐC của
 * WebView, do hệ điều hành vẽ. Nó hiển thị `h5.zdn.vn` — tên miền Zalo dùng để
 * phục vụ mọi Mini App — chứ không phải tên ViGov, và KHÔNG có API nào đổi được
 * chuỗi đó (đổi được thì thành lỗ hổng giả mạo của trình duyệt). Người dân đang
 * ở màn "Gửi phản ánh" của UBND mà bị một tên miền lạ hỏi vị trí thì phản xạ tự
 * nhiên là bấm "Từ chối" — mất toạ độ hiện trường, phiếu phải nhập địa chỉ tay.
 *
 * Nên ta nói trước bằng tiếng của mình: giải thích xin để làm gì, báo trước là
 * hộp thoại sau sẽ mang tên miền của Zalo, rồi mới gọi định vị. Đây là thứ duy
 * nhất đổi được ở phía ứng dụng; chuỗi trong hộp thoại hệ thống thì không.
 *
 * Hiện ở CẢ bản demo lẫn bản chính thức: tên miền `h5.zdn.vn` là đặc điểm của
 * nền tảng Mini App, không phải của bản demo, nên bản live vẫn cần lời dẫn này.
 *
 * Nút "Tự nhập địa chỉ" không phải nút phụ cho đủ bộ: theo câu hỏi mở #16, từ
 * chối chia sẻ vị trí là lựa chọn hợp lệ và luồng nhập tay phải luôn đi tiếp
 * được. Không có nút này thì người ngại chia sẻ vị trí sẽ tắt app.
 */
export function LocationPrimerDialog({ onAccept, onDecline }: Props) {
  return (
    <div className="demo-ov" role="dialog" aria-modal="true" aria-labelledby="loc-primer-title">
      <div className="demo-dlg">
        <span className="demo-dlg-ic">
          <Icon name="pin" size={26} color="var(--blue)" />
        </span>
        <h2 id="loc-primer-title">{locationPrimer.title}</h2>
        {locationPrimer.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button className="btn pri" onClick={onAccept}>
          {locationPrimer.accept}
        </button>
        <button className="btn" onClick={onDecline}>
          {locationPrimer.decline}
        </button>
      </div>
    </div>
  );
}
