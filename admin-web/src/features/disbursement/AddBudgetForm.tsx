"use client";

import { useState, type FormEvent } from "react";
import { appConfig } from "@/config/app.config";
import { Icon } from "@/lib/icons";
import { Drawer } from "@/components/ui/Drawer";
import type { CreateBudgetInput } from "@/services/disbursement.service";

/** id form — nút "Lưu hạng mục" ở footer drawer submit qua thuộc tính form */
export const ADD_BUDGET_FORM_ID = "add-budget-form";

/**
 * Nguồn vốn kèm màu nhận diện.
 *
 * Backend nhận `fundingSource` là chuỗi tự do và `fundingColor` tuỳ chọn, chưa có
 * endpoint danh mục nguồn vốn (khác với bộ phận / năm ngân sách đã có
 * /catalogs/*). Bộ dưới đây khớp dữ liệu đang dùng thật để hai hạng mục cùng
 * nguồn không bị hai màu khác nhau; cán bộ vẫn nhập được nguồn ngoài danh sách.
 */
const FUNDING_SOURCES = [
  { label: "Vốn đầu tư công", color: "var(--blue)" },
  { label: "Vốn sự nghiệp", color: "var(--teal)" },
  { label: "Ngân sách xã", color: "var(--green)" },
  { label: "Vốn Chương trình mục tiêu quốc gia", color: "var(--purple)" },
  { label: "Nguồn vốn khác", color: "var(--mut)" },
] as const;

/** Giá trị "nhập nguồn vốn khác" trong dropdown */
const CUSTOM_SOURCE = "__custom__";

interface FieldErrors {
  name?: string;
  fundingSource?: string;
  owner?: string;
  planned?: string;
}

export interface AddBudgetFormProps {
  open: boolean;
  onClose: () => void;
  /** Danh mục bộ phận lấy từ /catalogs/departments — dùng cho ô "Đơn vị chủ trì" */
  departments: string[];
  /** Danh mục năm ngân sách; năm mới nhất đứng đầu */
  years: number[];
  /** Năm đang xem trên trang — chọn sẵn cho hạng mục mới */
  defaultYear: number;
  saving: boolean;
  onSubmit: (values: CreateBudgetInput) => void;
}

/**
 * Biểu mẫu tạo hạng mục ngân sách mới (POST /disbursement — WBS #5).
 *
 * Kế hoạch vốn nhập theo ĐƠN VỊ TỶ ĐỒNG giống mọi chỗ khác trong phân hệ; đây là
 * số thực nên chấp nhận cả dấu phẩy (1,25) lẫn dấu chấm (1.25) — người dùng Việt
 * gõ dấu phẩy theo phản xạ, còn backend chỉ nhận số.
 */
export function AddBudgetForm({
  open,
  onClose,
  departments,
  years,
  defaultYear,
  saving,
  onSubmit,
}: AddBudgetFormProps) {
  const [name, setName] = useState("");
  const [sourceChoice, setSourceChoice] = useState<string>(FUNDING_SOURCES[0].label);
  const [customSource, setCustomSource] = useState("");
  const [owner, setOwner] = useState("");
  const [year, setYear] = useState(defaultYear);
  const [planned, setPlanned] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  // Mở lại form → xoá nội dung nháp của lần trước (điều chỉnh state trong render)
  const [loadedOpen, setLoadedOpen] = useState(open);
  if (open !== loadedOpen) {
    setLoadedOpen(open);
    if (open) {
      setName("");
      setSourceChoice(FUNDING_SOURCES[0].label);
      setCustomSource("");
      setOwner("");
      setYear(defaultYear);
      setPlanned("");
      setErrors({});
    }
  }

  const isCustomSource = sourceChoice === CUSTOM_SOURCE;
  const fundingSource = isCustomSource ? customSource.trim() : sourceChoice;
  /** Nguồn tự nhập không có màu quy ước — để backend dùng màu mặc định của nó */
  const fundingColor = FUNDING_SOURCES.find((s) => s.label === fundingSource)?.color;

  /** "1,25" và "1.25" đều là 1.25; chuỗi không phải số trả về NaN */
  const parsedPlanned = Number(planned.replace(",", ".").trim());

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Vui lòng nhập tên hạng mục";
    if (!fundingSource) next.fundingSource = "Vui lòng nhập tên nguồn vốn";
    if (!owner.trim()) next.owner = "Vui lòng chọn đơn vị chủ trì";
    if (!planned.trim()) next.planned = "Vui lòng nhập kế hoạch vốn được giao";
    else if (!Number.isFinite(parsedPlanned) || parsedPlanned <= 0) {
      next.planned = "Kế hoạch vốn phải là số lớn hơn 0";
    }
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      name: name.trim(),
      fundingSource,
      owner: owner.trim(),
      year,
      planned: parsedPlanned,
      fundingColor,
    });
  }

  /** Năm ngân sách: gộp danh mục với năm đang xem để không bao giờ rỗng */
  const yearOptions = Array.from(new Set([defaultYear, ...years])).sort((a, b) => b - a);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Thêm hạng mục ngân sách"
      meta="Ghi nhận kế hoạch vốn được giao; số đã giải ngân cập nhật sau theo từng lần chi"
      footer={
        <>
          <button className="btn pri" type="submit" form={ADD_BUDGET_FORM_ID} disabled={saving}>
            <Icon name="ok" size={15} />
            {saving ? "Đang lưu…" : "Lưu hạng mục"}
          </button>
          <button className="btn" type="button" onClick={onClose} disabled={saving}>
            Huỷ
          </button>
        </>
      }
    >
      <form
        id={ADD_BUDGET_FORM_ID}
        onSubmit={handleSubmit}
        noValidate
        className={saving ? "saving" : undefined}
      >
        <div className="fgroup">
          <label htmlFor="ab-name">
            Tên hạng mục <span className="req">*</span>
          </label>
          <input
            id="ab-name"
            className={errors.name ? "finp err" : "finp"}
            value={name}
            placeholder="Ví dụ: Cải tạo đường trục thôn Đông"
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <div className="ferr">{errors.name}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div className="fgroup">
            <label htmlFor="ab-source">
              Nguồn vốn <span className="req">*</span>
            </label>
            <select
              id="ab-source"
              className="finp"
              value={sourceChoice}
              onChange={(e) => setSourceChoice(e.target.value)}
            >
              {FUNDING_SOURCES.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
              <option value={CUSTOM_SOURCE}>Nguồn vốn khác (tự nhập)…</option>
            </select>
          </div>
          <div className="fgroup">
            <label htmlFor="ab-year">
              Năm ngân sách <span className="req">*</span>
            </label>
            <select
              id="ab-year"
              className="finp"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isCustomSource && (
          <div className="fgroup">
            <label htmlFor="ab-source-custom">
              Tên nguồn vốn <span className="req">*</span>
            </label>
            <input
              id="ab-source-custom"
              className={errors.fundingSource ? "finp err" : "finp"}
              value={customSource}
              placeholder="Ví dụ: Vốn xã hội hoá"
              onChange={(e) => setCustomSource(e.target.value)}
            />
            {errors.fundingSource && <div className="ferr">{errors.fundingSource}</div>}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <div className="fgroup">
            <label htmlFor="ab-owner">
              Đơn vị chủ trì <span className="req">*</span>
            </label>
            <select
              id="ab-owner"
              className={errors.owner ? "finp err" : "finp"}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">— Chọn bộ phận —</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {errors.owner && <div className="ferr">{errors.owner}</div>}
          </div>
          <div className="fgroup">
            <label htmlFor="ab-planned">
              Kế hoạch vốn ({appConfig.currencyUnit}) <span className="req">*</span>
            </label>
            <input
              id="ab-planned"
              className={errors.planned ? "finp err" : "finp"}
              inputMode="decimal"
              value={planned}
              placeholder="Ví dụ: 3,7"
              onChange={(e) => setPlanned(e.target.value)}
            />
            {errors.planned ? (
              <div className="ferr">{errors.planned}</div>
            ) : (
              <div className="fhint">Đơn vị tính: {appConfig.currencyUnit}</div>
            )}
          </div>
        </div>

        <div className="fhint">
          Mã hạng mục (HM-xx) do máy chủ cấp. Hạng mục mới có số giải ngân bằng 0 nên sẽ xuất hiện trong
          nhóm chậm tiến độ cho tới khi ghi nhận lần chi đầu tiên.
        </div>
      </form>
    </Drawer>
  );
}
