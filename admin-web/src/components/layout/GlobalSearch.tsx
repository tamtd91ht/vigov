"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/lib/icons";
import { findCategory } from "@/config/sla.config";
import { findStatus, taskStatuses } from "@/config/status.config";
import {
  emptySearchResponse,
  globalSearch,
  SEARCH_MIN_LENGTH,
  type SearchResponse,
} from "@/services/search.service";

/** Độ trễ gõ phím trước khi gọi máy chủ — cùng khuôn mẫu với trang Người dùng */
const SEARCH_DEBOUNCE_MS = 300;

const PLACEHOLDER = "Tìm nhiệm vụ, văn bản, phản ánh…";

/** Nhãn tiếng Việt của ba nhóm kết quả */
const GROUP_LABEL = {
  tasks: "Nhiệm vụ",
  documents: "Văn bản & Đơn thư",
  feedback: "Phản ánh người dân",
} as const;

/**
 * Một dòng kết quả đã chuẩn hoá.
 * Ba loại dữ liệu có tên trường khác nhau (code / arrivalNo, title / summary) nên
 * quy về một hình dạng duy nhất trước khi vẽ và trước khi đi lại bằng bàn phím.
 */
interface Hit {
  key: string;
  group: keyof typeof GROUP_LABEL;
  /** Mã hiển thị ở đầu dòng (NV-2601, số đến, PA-2608) */
  code: string;
  title: string;
  /** Dòng phụ: bộ phận, số ký hiệu… */
  meta: string;
  /** Nhãn trạng thái / lĩnh vực hiển thị bên phải */
  tag: string;
  tagColor: string;
  /** Đường dẫn mở đúng phân hệ và bung sẵn ngăn chi tiết bản ghi */
  href: string;
}

/** Gộp ba nhóm kết quả thành một danh sách phẳng theo đúng thứ tự hiển thị */
function toHits(data: SearchResponse): Hit[] {
  const tasks = data.results.tasks.map<Hit>((t) => {
    const status = findStatus(taskStatuses, t.status);
    return {
      key: `task-${t.code}`,
      group: "tasks",
      code: t.code,
      title: t.title,
      meta: t.department,
      tag: status.label,
      tagColor: status.color,
      href: `/tasks?code=${encodeURIComponent(t.code)}`,
    };
  });

  /* Backend chỉ trả 4 trường cho văn bản (không có trạng thái) nên nhãn bên phải
     là bộ phận đang giữ — thông tin hữu ích nhất còn lại để nhận ra bản ghi. */
  const documents = data.results.documents.map<Hit>((d) => ({
    key: `doc-${d.arrivalNo}`,
    group: "documents",
    code: `Số đến ${d.arrivalNo}`,
    title: d.summary,
    meta: d.refNo,
    tag: d.department,
    tagColor: "var(--mut)",
    href: `/documents?arrivalNo=${encodeURIComponent(d.arrivalNo)}`,
  }));

  const feedback = data.results.feedback.map<Hit>((f) => {
    const category = findCategory(f.categoryKey);
    return {
      key: `fb-${f.code}`,
      group: "feedback",
      code: f.code,
      title: f.title,
      meta: category.label,
      tag: category.label,
      tagColor: category.color,
      href: `/feedback?code=${encodeURIComponent(f.code)}`,
    };
  });

  return [...tasks, ...documents, ...feedback];
}

/**
 * Ô tìm kiếm toàn cục trên thanh trên cùng (WBS #1, #28).
 *
 * Gõ có độ trễ, kết quả xếp theo ba nhóm; bấm một dòng thì điều hướng sang đúng
 * phân hệ kèm mã bản ghi trên thanh địa chỉ — phân hệ đích đọc tham số đó và mở
 * sẵn ngăn chi tiết, nên chia sẻ đường dẫn cho đồng nghiệp cũng mở đúng bản ghi.
 */
export function GlobalSearch() {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchResponse>(() => emptySearchResponse());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** Dòng đang chọn bằng phím mũi tên; -1 = chưa chọn dòng nào */
  const [active, setActive] = useState(-1);

  const trimmed = keyword.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH;

  /*
   * Gõ có độ trễ. Effect KHÔNG đặt state ngay trong thân nó: mọi thay đổi state
   * nằm trong hàm hẹn giờ hoặc trong callback của lời gọi API — nhờ vậy đổi từ
   * khoá không sinh ra lượt render trung gian nào.
   *
   * Kết quả cũ nhận ra bằng `data.q !== trimmed` (backend trả lại từ khoá đã
   * chuẩn hoá), nên không cần thêm state "đang chờ" thứ hai.
   */
  useEffect(() => {
    if (trimmed.length < SEARCH_MIN_LENGTH) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      globalSearch(trimmed)
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setError("");
          setActive(-1);
        })
        .catch(() => {
          if (cancelled) return;
          setData(emptySearchResponse(trimmed));
          setError("Không tìm kiếm được, vui lòng thử lại");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Bấm ra ngoài thì đóng bảng kết quả (giữ nguyên từ khoá đã gõ)
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  /** Kết quả có đúng của từ khoá đang gõ hay còn là của lần gõ trước */
  const fresh = data.q === trimmed;
  const searching = trimmed.length >= SEARCH_MIN_LENGTH && (loading || !fresh);
  const hits = useMemo(() => (fresh ? toHits(data) : []), [data, fresh]);

  const go = (hit: Hit) => {
    setOpen(false);
    setActive(-1);
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (hits.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((prev) => {
        const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
        // Quay vòng để không kẹt ở hai đầu danh sách
        if (next >= hits.length) return 0;
        if (next < 0) return hits.length - 1;
        return next;
      });
      return;
    }
    if (e.key === "Enter") {
      // Chưa chọn dòng nào thì Enter mở kết quả đầu tiên — thao tác quen thuộc nhất
      const hit = hits[active >= 0 ? active : 0];
      if (hit) go(hit);
    }
  };

  /** Chỉ số đầu tiên của mỗi nhóm — dùng để chèn dòng tiêu đề nhóm khi vẽ */
  const groupStart = new Map<number, keyof typeof GROUP_LABEL>();
  let seen: string | null = null;
  hits.forEach((hit, i) => {
    if (hit.group !== seen) {
      groupStart.set(i, hit.group);
      seen = hit.group;
    }
  });

  return (
    <div className="tb-search-wrap" ref={boxRef}>
      <div className="tb-search">
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Tìm kiếm toàn hệ thống"
          placeholder={PLACEHOLDER}
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {keyword && (
          <button
            type="button"
            className="tb-search-clear"
            title="Xoá từ khoá"
            aria-label="Xoá từ khoá"
            onClick={() => {
              setKeyword("");
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {open && keyword.trim().length > 0 && (
        <div className="tb-results" role="listbox" aria-label="Kết quả tìm kiếm">
          {tooShort ? (
            <div className="tb-results-msg">Nhập ít nhất {SEARCH_MIN_LENGTH} ký tự để tìm kiếm</div>
          ) : searching ? (
            <div className="tb-results-msg">
              <span className="spinner" style={{ width: 16, height: 16, verticalAlign: "-3px" }} /> Đang tìm…
            </div>
          ) : error ? (
            <div className="tb-results-msg" style={{ color: "var(--red)" }}>
              {error}
            </div>
          ) : hits.length === 0 ? (
            <div className="tb-results-msg">Không tìm thấy kết quả cho “{trimmed}”</div>
          ) : (
            <>
              {hits.map((hit, i) => (
                <div key={hit.key}>
                  {groupStart.has(i) && <div className="tb-results-cap">{GROUP_LABEL[groupStart.get(i)!]}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`tb-result${i === active ? " on" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                  >
                    <span className="cd">{hit.code}</span>
                    <span className="tx">
                      <b>{hit.title}</b>
                      {hit.meta && <span>{hit.meta}</span>}
                    </span>
                    <span className="tg" style={{ color: hit.tagColor }}>
                      {hit.tag}
                    </span>
                  </button>
                </div>
              ))}
              <div className="tb-results-foot">
                {data.total} kết quả · dùng phím ↑ ↓ để chọn, Enter để mở
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
