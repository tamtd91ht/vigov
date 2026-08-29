"use client";

import { useState, type FormEvent } from "react";
import type { BudgetItem } from "@/types";
import { appConfig } from "@/config/app.config";
import { formatBillion } from "@/lib/format";

export interface DisburseRequestValues {
  amount: string;
  content: string;
  vendor: string;
}

interface FieldErrors {
  amount?: string;
  content?: string;
  vendor?: string;
}

/**
 * Form đề nghị giải ngân đợt tiếp theo — hiển thị trong drawer chi tiết hạng mục.
 * Câu hỏi mở #8: ai là người duyệt đề nghị (Chủ tịch UBND xã hay Kế toán trưởng)?
 * Phase 1 chỉ ghi nhận đề nghị ở trạng thái "chờ duyệt", luồng duyệt nối ở P3.
 */
/** id form — nút "Gửi đề nghị" ở footer drawer submit qua thuộc tính form */
export const DISBURSE_REQUEST_FORM_ID = "disburse-request-form";

export function DisburseRequestForm({
  item,
  onSubmit,
}: {
  item: BudgetItem;
  onSubmit: (values: DisburseRequestValues) => void;
}) {
  const [amount, setAmount] = useState("");
  const [content, setContent] = useState("");
  const [vendor, setVendor] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const remaining = Math.max(0, item.planned - item.actual);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const parsed = Number(amount.replace(",", "."));
    if (!amount.trim()) next.amount = "Vui lòng nhập số tiền đề nghị";
    else if (!Number.isFinite(parsed) || parsed <= 0) next.amount = "Số tiền phải là số lớn hơn 0";
    else if (parsed > remaining) next.amount = `Vượt phần vốn còn lại (${formatBillion(remaining)})`;
    if (!content.trim()) next.content = "Vui lòng nhập nội dung chi";
    if (!vendor.trim()) next.vendor = "Vui lòng nhập đơn vị thụ hưởng";
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ amount: amount.trim(), content: content.trim(), vendor: vendor.trim() });
  }

  return (
    <form id={DISBURSE_REQUEST_FORM_ID} onSubmit={handleSubmit} noValidate>
      <div className="note" style={{ marginBottom: 16 }}>
        Đề nghị giải ngân đợt tiếp theo cho hạng mục <b>{item.name}</b> ({item.id}). Còn lại{" "}
        <b>{formatBillion(remaining)}</b> trên kế hoạch vốn giao.
      </div>

      <div className="fgroup">
        <label htmlFor="dr-amount">
          Số tiền đề nghị ({appConfig.currencyUnit}) <span className="req">*</span>
        </label>
        <input
          id="dr-amount"
          className={errors.amount ? "finp err" : "finp"}
          type="text"
          inputMode="decimal"
          placeholder="Ví dụ: 0,5"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {errors.amount ? <div className="ferr">{errors.amount}</div> : <div className="fhint">Đơn vị tính: {appConfig.currencyUnit}</div>}
      </div>

      <div className="fgroup">
        <label htmlFor="dr-content">
          Nội dung chi <span className="req">*</span>
        </label>
        <textarea
          id="dr-content"
          className={errors.content ? "finp err" : "finp"}
          placeholder="Ví dụ: Thanh toán khối lượng hoàn thành đợt 3"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        {errors.content && <div className="ferr">{errors.content}</div>}
      </div>

      <div className="fgroup">
        <label htmlFor="dr-vendor">
          Đơn vị thụ hưởng <span className="req">*</span>
        </label>
        <input
          id="dr-vendor"
          className={errors.vendor ? "finp err" : "finp"}
          type="text"
          placeholder="Tên đơn vị nhận tiền"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        {errors.vendor && <div className="ferr">{errors.vendor}</div>}
      </div>

      <div className="fhint" style={{ marginBottom: 4 }}>
        Đề nghị sẽ chuyển sang trạng thái chờ duyệt. Cấp duyệt cụ thể chốt sau (câu hỏi mở #8).
      </div>
    </form>
  );
}
