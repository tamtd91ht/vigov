import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { Chip, SectionHead, formatNumber } from "@/components/common";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { contentService } from "@/services/content.service";
import type { VideoItem } from "@/types";
import { VIDEO_RATIO, clampLines, videoGradient } from "./VideoPage";

const RELATED_COUNT = 3;
const RELATED_THUMB_W = 120;
const TOPIC_COLOR = "var(--pink)";
/**
 * Câu hỏi mở #19: chốt nguồn phát video (nhúng YouTube hay tự host trên hạ tầng xã)
 * — trước khi có kết luận, khối phát chỉ là bản demo tĩnh.
 */
const PLAYER_NOTE = "Bản demo — trình phát thật (YouTube hoặc tự host) chờ khách chốt";
const PLAYING_PROGRESS = "35%";
/** Màu khối phát khi chưa biết video (đang tải hoặc không tìm thấy) */
const NEUTRAL_COVER = "var(--navy)";

/** Nút tròn nền đen mờ đè lên khối phát */
const overlayBtn: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 12,
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "rgba(0,0,0,.4)",
  display: "grid",
  placeItems: "center",
  zIndex: 2,
};

/**
 * Chi tiết video tuyên truyền (WBS #18).
 * Backend chỉ mở endpoint danh sách /content/public/videos (chưa có
 * /public/videos/:id), nên trang này lấy danh sách rồi chọn đúng video —
 * quy mô nội dung cấp xã nhỏ nên một lượt gọi là đủ.
 */
export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);

  const resource = useApiResource(() => contentService.listVideos(), []);
  const all = resource.data ?? [];
  const video = all.find((v) => v.id === id);
  const related = video
    ? all.filter((v) => v.topic === video.topic && v.id !== video.id).slice(0, RELATED_COUNT)
    : [];

  return (
    <div className="app">
      {/* Khối phát MOCK — chưa gắn trình phát thật (câu hỏi mở #19) */}
      <div
        style={{
          position: "relative",
          aspectRatio: VIDEO_RATIO,
          background: "#000",
          overflow: "hidden",
          flex: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: videoGradient(video?.coverColor ?? NEUTRAL_COVER),
            opacity: 0.42,
          }}
        />
        <button style={overlayBtn} onClick={() => navigate(-1)} aria-label="Quay lại">
          <Icon name="back" size={19} color="#fff" />
        </button>

        <button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Tạm dừng" : "Phát"}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "#fff",
            display: "grid",
            placeItems: "center",
            zIndex: 2,
            boxShadow: "0 6px 18px rgba(0,0,0,.35)",
          }}
        >
          <Icon
            name={playing ? "pause" : "playFill"}
            size={24}
            color="var(--navy)"
            fill={!playing}
            strokeWidth={2.2}
          />
        </button>

        {/* Thanh tiến trình giả */}
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 30,
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,.3)",
            zIndex: 2,
            overflow: "hidden",
          }}
        >
          <i
            style={{
              display: "block",
              height: "100%",
              width: playing ? PLAYING_PROGRESS : "0%",
              background: "var(--pink)",
              transition: ".3s",
            }}
          />
        </div>

        <div
          className="tiny"
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 8,
            color: "rgba(255,255,255,.7)",
            zIndex: 2,
          }}
        >
          {PLAYER_NOTE}
        </div>
      </div>

      <div className="page plain">
        <DataState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={!video}
          emptyIcon="play"
          emptyMessage="Không tìm thấy video"
        >
          {video && (
            <>
              <h1 style={{ lineHeight: 1.35 }}>{video.title}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 10 }}>
                {video.topic && <Chip label={video.topic} color={TOPIC_COLOR} icon="play" />}
                <span className="tiny muted">
                  {formatNumber(video.views)} lượt xem · {video.publishedAt}
                </span>
              </div>

              {video.description && (
                <p style={{ marginTop: 14, lineHeight: 1.75, textAlign: "justify" }}>{video.description}</p>
              )}

              <div className="divider" />

              {related.length > 0 && (
                <>
                  <SectionHead title="Video liên quan" />
                  <div style={{ display: "grid", gap: 10 }}>
                    {related.map((r) => (
                      <RelatedRow key={r.id} video={r} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </DataState>
      </div>
    </div>
  );
}

/** Video liên quan — thay thế video hiện tại trong lịch sử điều hướng */
function RelatedRow({ video }: { video: VideoItem }) {
  const navigate = useNavigate();

  return (
    <div
      className="card card-b tap"
      role="button"
      style={{ display: "flex", gap: 11, alignItems: "center" }}
      onClick={() => navigate(`/video/${video.id}`, { replace: true })}
    >
      <span
        style={{
          position: "relative",
          width: RELATED_THUMB_W,
          aspectRatio: VIDEO_RATIO,
          borderRadius: "var(--radius-sm)",
          background: videoGradient(video.coverColor),
          display: "grid",
          placeItems: "center",
          flex: "none",
          overflow: "hidden",
        }}
      >
        <Icon name="playFill" size={22} color="#fff" fill />
        <span
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            fontSize: ".62rem",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          {video.duration}
        </span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".86rem", fontWeight: 600, color: "var(--navy)", lineHeight: 1.4, ...clampLines(2) }}>
          {video.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {formatNumber(video.views)} lượt xem
        </div>
      </div>
    </div>
  );
}
