"use client";

import { useState, type FormEvent } from "react";
import { appConfig } from "@/config/app.config";
import { Icon } from "@/lib/icons";
import type { CreateEntryInput } from "@/services/disbursement.service";

/** Ngày hôm nay dạng dd/MM/yyyy — mặc định cho ô ngày giải ngân */
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Biểu mẫu ghi nhận một lần giải ngân của hạng mục (POST /disbursement/:code/entries).
 * Số tiền nhập dạng chuỗi ("1,25 tỷ") đúng như hợp đồng API — server tự quy đổi
 * sang tỷ đồng và cộng vào luỹ kế.
 */
export function AddEntryForm({
  saving,
  onSubmit,
  onCancel,
}: {
  saving: boolean;
  onSubmit: (values: CreateEntryInput) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(today());
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [voucherNo, setVoucherNo] = useState("");

  const valid = date.trim() && content.trim() && amount.trim();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    onSubmit({
      date: date.trim(),
      content: content.trim(),
      amount: amount.trim(),
      vendor: vendor.trim(),
      voucherNo: voucherNo.trim(),
    });
  }

  return (
    <form
      className={saving ? "saving" : undefined}
      onSubmit={handleSubmit}
      noValidate
      style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "13px 15px", marginTop: 12 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fgroup">
          <label htmlFor="de-date">
            Ngày giải ngân <span className="req">*</span>
          </label>
          <input id="de-date" className="finp" value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/MM/yyyy" />
        </div>
        <div className="fgroup">
          <label htmlFor="de-amount">
            Số tiền <span className="req">*</span>
          </label>
          <input
            id="de-amount"
            className="finp"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Ví dụ: 1,25 ${appConfig.currencyUnit.split(" ")[0]}`}
          />
        </div>
      </div>

      <div className="fgroup">
        <label htmlFor="de-content">
          Nội dung chi <span className="req">*</span>
        </label>
        <input
          id="de-content"
          className="finp"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ví dụ: Thanh toán khối lượng hoàn thành đợt 2"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fgroup">
          <label htmlFor="de-vendor">Đơn vị thụ hưởng</label>
          <input id="de-vendor" className="finp" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="fgroup">
          <label htmlFor="de-voucher">Số chứng từ</label>
          <input id="de-voucher" className="finp" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="UNC 118/2026" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn sm pri" type="submit" disabled={!valid || saving}>
          <Icon name="ok" size={14} />
          Lưu lần giải ngân
        </button>
        <button className="btn sm" type="button" onClick={onCancel} disabled={saving}>
          Huỷ
        </button>
      </div>
    </form>
  );
}
