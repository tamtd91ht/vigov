"use client";

import { useState } from "react";
import Link from "next/link";
import { appConfig } from "@/config/app.config";
import { navSections } from "@/config/nav.config";
import { roles, type Permission } from "@/config/roles.config";
import { defaultSlaRules, feedbackCategories } from "@/config/sla.config";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHead } from "@/components/ui/PageHead";
import { Tabs } from "@/components/ui/Tabs";
import { Icon } from "@/lib/icons";
import { MIN_PASSWORD_LENGTH } from "@/services/profile.service";
import { formatFileSize, FORMAT_HINT_BY_PURPOSE, MAX_FILE_SIZE } from "@/services/files.service";

const TAB_ITEMS = [
  { key: "modules", label: "Hướng dẫn theo phân hệ" },
  { key: "roles", label: "Vai trò & quyền" },
  { key: "faq", label: "Câu hỏi thường gặp" },
];

/**
 * Hướng dẫn ngắn cho từng phân hệ, tra theo `id` của nav.config.
 *
 * Khoá lấy từ nav.config nên thêm phân hệ mới mà quên viết hướng dẫn sẽ thấy
 * ngay trên trang (mục hiện dòng "chưa có hướng dẫn"), thay vì im lặng biến mất.
 */
const MODULE_GUIDE: Record<string, string[]> = {
  overview: [
    "Sáu thẻ chỉ số đầu trang là số liệu của kỳ đang chọn, do máy chủ tính — không phải cộng tay từ các bảng bên dưới.",
    "Danh sách “Cần xử lý ngay” xếp theo hạn còn lại; bấm một dòng để mở thẳng bản ghi ở phân hệ tương ứng.",
  ],
  tasks: [
    "Hai chế độ xem chung một nguồn dữ liệu: Kanban để nhìn theo trạng thái, Bảng để lọc và phân trang.",
    "Tiến độ tính tự động theo số việc con đã tick — không nhập tay. Muốn khoá tiến độ thì đổi trạng thái sang Hoàn thành.",
    "Tệp minh chứng tải lên ở chế độ riêng tư: chỉ cán bộ có quyền mở được, và mở bằng liên kết có chữ ký hết hạn sau ít phút.",
    "Nhiệm vụ sinh từ văn bản hoặc phản ánh có ô “Nguồn liên kết” để mở lại bản ghi gốc.",
  ],
  documents: [
    "Vào sổ trước, đính kèm bản scan sau: chưa có bản scan thì chưa chạy được nhận dạng ký tự (OCR).",
    "Các trường có nhãn OCR là máy đọc — cán bộ phải kiểm tra và bấm xác nhận từng trường trước khi dùng làm căn cứ.",
    "Nút “Chuyển thành công việc” tạo nhiệm vụ theo dõi; bấm lại lần nữa không tạo thêm nhiệm vụ trùng.",
  ],
  disbursement: [
    "Thêm hạng mục là ghi nhận KẾ HOẠCH vốn được giao; số đã giải ngân cập nhật dần theo từng lần chi.",
    "Số tiền nhập theo đơn vị " + appConfig.currencyUnit + ", chấp nhận cả dấu phẩy (1,25) lẫn dấu chấm (1.25).",
    "Số liệu tổng hợp trên 4 thẻ do máy chủ tính lại sau mỗi lần ghi — nếu thấy lệch, tải lại trang trước khi báo lỗi.",
  ],
  feedback: [
    "Phiếu chưa phân công có cảnh báo màu cam; phân công cán bộ sẽ tự đưa phiếu sang trạng thái Đang xử lý.",
    "Chuyển bộ phận và xác nhận đã xử lý đều BẮT BUỘC nhập lý do / kết quả — máy chủ từ chối nếu bỏ trống.",
    "Ảnh nghiệm thu để công khai vì app công dân phải xem được kết quả xử lý.",
    "Đồng hồ đếm ngược tính theo cam kết thời hạn (SLA) của từng lĩnh vực, xem bảng ở tab Câu hỏi thường gặp.",
  ],
  map: [
    "Bản đồ hiện là khung mô phỏng: ghim đặt theo phần trăm khung hình, chưa phải toạ độ thật.",
    "Nhà cung cấp bản đồ chốt sau; khi đổi chỉ sửa cấu hình bản đồ, các lớp dữ liệu giữ nguyên.",
  ],
  reports: [
    "Kết xuất Excel dùng được ngay; bản PDF và PPTX chưa mở ở giai đoạn này, giao diện sẽ báo rõ khi bấm.",
    "Kỳ báo cáo đổi thì mọi biểu đồ trong trang đổi theo — số liệu lấy cùng một lượt gọi.",
  ],
  cms: [
    "Bài viết, video và bản tin truyền thanh là nội dung cho Zalo Mini App công dân; ảnh bìa và tệp phát tải lên kho tệp dùng chung.",
    "Gửi thông báo hàng loạt tách hai đối tượng: công dân và nội bộ cán bộ. Đã gửi thì không thu hồi được.",
  ],
  users: [
    "Số điện thoại công dân luôn hiển thị dạng che theo quy định bảo vệ dữ liệu cá nhân, kể cả với quản trị viên.",
    "Khoá tài khoản bắt buộc nêu lý do — lý do đó hiện cho công dân khi họ mở Mini App.",
    "Xoá tài khoản là xoá mềm: dữ liệu vẫn còn, khôi phục ở bộ lọc “Đã xoá”, và chỉ vai trò quản trị làm được.",
  ],
  settings: [
    "Sửa cam kết thời hạn (SLA) chỉ ảnh hưởng phiếu phản ánh phát sinh SAU đó, không tính lại phiếu cũ.",
    "Tạo tài khoản cán bộ xong, mật khẩu tạm chỉ hiện MỘT LẦN — ghi lại và giao cho cán bộ ngay.",
  ],
};

/** Bốn mức quyền của khung phân quyền theo phân hệ */
const PERMISSION_GUIDE: { key: Permission; label: string; detail: string; color: string }[] = [
  { key: "view", label: "Xem", detail: "Chỉ đọc: mở danh sách, ngăn chi tiết, báo cáo. Mọi nút ghi đều bị máy chủ từ chối.", color: "var(--mut)" },
  { key: "edit", label: "Sửa", detail: "Thêm và cập nhật bản ghi của phân hệ: giao việc, vào sổ văn bản, phân công phản ánh, ghi nhận giải ngân.", color: "var(--blue)" },
  { key: "approve", label: "Phê duyệt", detail: "Ngoài quyền sửa còn duyệt kết quả: chốt nhiệm vụ, duyệt đề nghị giải ngân.", color: "var(--orange)" },
  { key: "admin", label: "Quản trị", detail: "Toàn quyền trên phân hệ, gồm cả việc không thể hoàn lại như xoá tài khoản công dân.", color: "var(--red)" },
];

interface Faq {
  q: string;
  a: React.ReactNode;
}

/** Trang Trợ giúp (WBS #1) — nội dung tĩnh, tra cấu hình thật chứ không chép cứng */
export function HelpPage() {
  const [tab, setTab] = useState(TAB_ITEMS[0].key);
  const navItems = navSections.flatMap((s) => s.items);

  const faqs: Faq[] = [
    {
      q: "Đồng hồ đếm ngược trên phiếu phản ánh tính từ đâu?",
      a: (
        <>
          Từ cam kết thời hạn (SLA) của lĩnh vực phiếu đó, đặt ở trang{" "}
          <Link href="/settings" className="lnk">
            Cấu hình
          </Link>
          . Mỗi lĩnh vực có hai mốc: số ngày tiếp nhận – phân loại, và số ngày xử lý xong. Máy chủ tính
          hạn ngay khi phiếu vào hệ thống, nên sửa SLA về sau KHÔNG tính lại phiếu cũ.
          <div className="tw" style={{ marginTop: 12 }}>
            <table className="tb2">
              <thead>
                <tr>
                  <th>Lĩnh vực</th>
                  <th>Tiếp nhận</th>
                  <th>Xử lý</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {defaultSlaRules.map((rule) => {
                  const category = feedbackCategories.find((c) => c.key === rule.categoryKey);
                  return (
                    <tr key={rule.categoryKey} style={{ cursor: "default" }}>
                      <td>
                        <Chip color={category?.color ?? "var(--mut)"} dot>
                          {category?.label ?? rule.categoryKey}
                        </Chip>
                      </td>
                      <td>
                        {rule.intakeDays} {rule.unit}
                      </td>
                      <td>
                        {rule.resolveDays} {rule.unit}
                      </td>
                      <td>{rule.warnBefore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      q: "Vì sao đang làm thì bị đăng xuất?",
      a: (
        <>
          Hệ thống đăng xuất khi máy chủ báo phiên không còn hiệu lực: token hết hạn, quản trị viên thu
          hồi phiên, hoặc chính bạn vừa đổi mật khẩu ở máy khác (đổi mật khẩu thu hồi mọi phiên còn lại).
          Kiểm tra danh sách thiết bị đang đăng nhập ở{" "}
          <Link href="/profile" className="lnk">
            Hồ sơ cá nhân
          </Link>
          .
        </>
      ),
    },
    {
      q: "Tôi tự đổi mật khẩu được không?",
      a: (
        <>
          Được, ở trang{" "}
          <Link href="/profile" className="lnk">
            Hồ sơ cá nhân
          </Link>
          : nhập mật khẩu hiện tại rồi mật khẩu mới (ít nhất {MIN_PASSWORD_LENGTH} ký tự). Quên mật khẩu
          thì phải nhờ quản trị viên đặt lại ở trang Cấu hình · Tài khoản &amp; phân quyền — hệ thống
          không gửi thư đặt lại mật khẩu.
        </>
      ),
    },
    {
      q: "Tệp đính kèm giới hạn thế nào?",
      a: (
        <>
          Mỗi tệp tối đa <b>{formatFileSize(MAX_FILE_SIZE)}</b>. Định dạng tuỳ chỗ dùng: bản scan văn bản
          nhận {FORMAT_HINT_BY_PURPOSE.scan.toLowerCase()}, ảnh phản ánh nhận{" "}
          {FORMAT_HINT_BY_PURPOSE.feedback.toLowerCase()}, tệp minh chứng nhiệm vụ nhận{" "}
          {FORMAT_HINT_BY_PURPOSE.other.toLowerCase()}. Tệp có thể thực thi mã trong trình duyệt (HTML,
          SVG, JS…) bị chặn ở cả hai đầu.
        </>
      ),
    },
    {
      q: "Tệp minh chứng nội bộ có bị lộ ra ngoài không?",
      a: "Không. Bản scan văn bản và tệp minh chứng nhiệm vụ lưu ở chế độ riêng tư: mỗi lần mở, hệ thống cấp một liên kết có chữ ký và tự hết hạn sau ít phút, nên đường dẫn bị chia sẻ lại cũng không mở được. Riêng ảnh nghiệm thu phản ánh là công khai có chủ ý, vì app công dân phải xem được kết quả xử lý.",
    },
    {
      q: "Tìm kiếm trên thanh trên cùng tìm được những gì?",
      a: "Nhiệm vụ, văn bản – đơn thư và phản ánh (theo mã, tiêu đề, trích yếu, nội dung). Bấm một kết quả sẽ mở đúng phân hệ kèm ngăn chi tiết của bản ghi đó. Hồ sơ công dân cố tình không nằm trong phạm vi tìm kiếm vì liên quan dữ liệu cá nhân; tra công dân làm ở trang Người dùng Mini App.",
    },
    {
      q: "Danh sách không tự cập nhật khi đồng nghiệp vừa sửa?",
      a: "Bình thường thì trang Phản ánh, Nhiệm vụ và chuông thông báo tự làm mới nhờ kênh thời gian thực. Kênh này chỉ là tiện lợi: nếu máy chủ chưa bật hoặc mạng chặn WebSocket, hệ thống KHÔNG báo lỗi mà vẫn chạy như thường — chỉ cần bấm tải lại hoặc đổi bộ lọc để lấy số liệu mới.",
    },
    {
      q: "Số liệu trên trang Tổng quan lệch với bảng chi tiết thì tin số nào?",
      a: "Tin số của máy chủ. Mọi thẻ chỉ số và số liệu tổng hợp đều do máy chủ tính trên toàn bộ dữ liệu, còn bảng chi tiết chỉ hiển thị trang hiện tại theo bộ lọc đang chọn — hai con số khác nhau về phạm vi, không phải sai lệch.",
    },
  ];

  return (
    <div className="pg">
      <PageHead
        title="Trợ giúp"
        sub={`Hướng dẫn sử dụng ${appConfig.appName} — ${appConfig.appTagline}`}
      />

      <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />

      {tab === "modules" && (
        <div style={{ marginTop: 16 }}>
          <div className="note" style={{ marginBottom: 16 }}>
            <Icon name="alert" size={15} /> Không thấy một phân hệ trong menu bên trái nghĩa là vai trò
            của bạn chưa được cấp quyền xem phân hệ đó — liên hệ quản trị viên, không phải lỗi hệ thống.
          </div>
          {navItems.map((item) => (
            <Card key={item.id} style={{ marginBottom: 14 }}>
              <CardHeader
                title={
                  <span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}>
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </span>
                }
                extra={
                  <Link href={item.href} className="btn sm">
                    <Icon name="right" size={13} />
                    Mở phân hệ
                  </Link>
                }
              />
              <CardBody>
                {MODULE_GUIDE[item.moduleKey]?.length ? (
                  <ul style={{ paddingLeft: 18, display: "grid", gap: 7 }}>
                    {MODULE_GUIDE[item.moduleKey].map((line, i) => (
                      <li key={i} style={{ fontSize: 13 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="tiny muted">Chưa có hướng dẫn cho phân hệ này.</div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {tab === "roles" && (
        <div style={{ marginTop: 16 }}>
          <Card style={{ marginBottom: 16 }}>
            <CardHeader title="Bốn mức quyền" />
            <CardBody>
              <div className="fhint" style={{ marginTop: 0, marginBottom: 12 }}>
                Phân quyền hiện đặt theo PHÂN HỆ: mỗi vai trò có một mức quyền tối đa trên từng phân hệ.
                Giao diện ẩn những nút vượt quyền, nhưng quyết định cuối cùng luôn ở máy chủ.
              </div>
              {PERMISSION_GUIDE.map((p) => (
                <div className="fld" key={p.key}>
                  <div className="k">
                    <Chip color={p.color} dot>
                      {p.label}
                    </Chip>
                  </div>
                  <div className="v">{p.detail}</div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`${roles.length} vai trò và quyền trên từng phân hệ`} />
            <div className="tw">
              <table className="tb2">
                <thead>
                  <tr>
                    <th>Vai trò</th>
                    {navItems.map((item) => (
                      <th key={item.moduleKey}>{item.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.key} style={{ cursor: "default" }}>
                      <td>
                        <b style={{ color: "var(--navy)" }}>{role.label}</b>
                        <div className="tiny muted">{role.key}</div>
                      </td>
                      {navItems.map((item) => {
                        const level = role.modules[item.moduleKey];
                        const meta = PERMISSION_GUIDE.find((p) => p.key === level);
                        return (
                          <td key={item.moduleKey}>
                            {meta ? (
                              <span style={{ color: meta.color, fontWeight: 700, fontSize: 12 }}>
                                {meta.label}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody>
              <div className="fhint" style={{ marginTop: 0 }}>
                Dấu “—” nghĩa là vai trò đó không truy cập được phân hệ; mục tương ứng cũng không hiện
                trong menu. Bảng này đọc trực tiếp từ khung phân quyền của hệ thống, không phải bản chép
                tay, nên luôn khớp với hành vi thật.
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "faq" && (
        <div style={{ marginTop: 16 }}>
          {faqs.map((faq, i) => (
            <Card key={i} style={{ marginBottom: 12 }}>
              <CardHeader
                title={
                  <span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}>
                    <Icon name="help" size={16} />
                    {faq.q}
                  </span>
                }
              />
              <CardBody>
                <div style={{ fontSize: 13 }}>{faq.a}</div>
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader title="Liên hệ hỗ trợ" />
            <CardBody>
              <div className="fld">
                <div className="k">
                  <Icon name="phone" size={13} />
                  Điện thoại
                </div>
                <div className="v">
                  {appConfig.support.phone || (
                    <span className="muted">
                      Chưa cấu hình — đặt biến môi trường đầu mối hỗ trợ khi triển khai
                    </span>
                  )}
                </div>
              </div>
              <div className="fld">
                <div className="k">
                  <Icon name="send" size={13} />
                  Thư điện tử
                </div>
                <div className="v">
                  {appConfig.support.email ? (
                    <a className="lnk" href={`mailto:${appConfig.support.email}`}>
                      {appConfig.support.email}
                    </a>
                  ) : (
                    <span className="muted">
                      Chưa cấu hình — đặt biến môi trường đầu mối hỗ trợ khi triển khai
                    </span>
                  )}
                </div>
              </div>
              <div className="fld">
                <div className="k">
                  <Icon name="clock" size={13} />
                  Thời gian hỗ trợ
                </div>
                <div className="v">{appConfig.support.hours}</div>
              </div>
              <div className="fhint">
                Khi báo lỗi, gửi kèm: tên phân hệ, mã bản ghi (NV-…, PA-…, số đến), thời điểm xảy ra và
                ảnh chụp màn hình. Phiên bản đang dùng: {appConfig.version}.
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
