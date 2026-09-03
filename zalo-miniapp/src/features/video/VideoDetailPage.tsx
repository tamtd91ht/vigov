import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { Chip, SectionHead, formatNumber } from "@/components/common";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { useGoBack } from "@/hooks/useGoBack";
import {
  contentService,
  hostedVideoUrl,
  youtubeId,
} from "@/services/content.service";
import type { VideoItem } from "@/types";
import { VIDEO_RATIO, clampLines, videoGradient } from "./VideoPage";

const RELATED_COUNT = 3;
const RELATED_THUMB_W = 120;
const TOPIC_COLOR = "var(--pink)";
/** Màu khối phát khi chưa biết video (đang tải hoặc không tìm thấy) */
const NEUTRAL_COVER = "var(--navy)";
/** Link YouTube hỏng hoặc thiếu tệp — nói rõ để cán bộ CMS biết đường sửa */
const BROKEN_YOUTUBE =
  "Link YouTube không hợp lệ. Cán bộ kiểm tra lại ở Web Quản trị → Nội dung Mobile → Video.";
const BROKEN_HOSTED = "Video chưa có tệp đính kèm.";

/**
 * Chi tiết video tuyên truyền (WBS #18).
 * Backend chỉ mở endpoint danh sách /content/public/videos (chưa có
 * /public/videos/:id), nên trang này lấy danh sách rồi chọn đúng video —
 * quy mô nội dung cấp xã nhỏ nên một lượt gọi là đủ.
 */
export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack("/video");
  const resource = useApiResource(() => contentService.listVideos(), []);
  const all = resource.data ?? [];
  const video = all.find((v) => v.id === id);
  const related = video
    ? all
        .filter((v) => v.topic === video.topic && v.id !== video.id)
        .slice(0, RELATED_COUNT)
    : [];
  const ytId = video?.source === "youtube" ? youtubeId(video.youtubeUrl) : null;

  return (
    <div className="app">
      {/* Trình phát thật — nguồn do cán bộ chọn ở CMS (source: youtube | hosted) */}
      <div className="vplayer">
        <button
          type="button"
          className="overlay-btn"
          onClick={goBack}
          aria-label="Quay lại"
        >
          <Icon name="back" size={20} color="#fff" />
        </button>

        <div className="vplayer-box">
          {!video && (
            <span
              className="vplayer-fill"
              style={{
                background: videoGradient(NEUTRAL_COVER),
                opacity: 0.42,
              }}
            />
          )}

          {video?.source === "youtube" &&
            (ytId ? (
              /* Nhúng qua youtube-nocookie: không gắn cookie theo dõi cho người
               dân khi họ mới chỉ mở trang, chưa bấm phát. */
              <iframe
                className="vplayer-fill"
                src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="vplayer-msg">{BROKEN_YOUTUBE}</div>
            ))}

          {video?.source === "hosted" &&
            (video.videoFileId ? (
              /* playsInline: iOS mặc định bung toàn màn hình khi bấm phát, làm
               người dùng mất ngữ cảnh trang. controls để dùng luôn thanh điều
               khiển gốc của hệ điều hành thay vì tự dựng. */
              <video
                className="vplayer-fill"
                src={hostedVideoUrl(video.videoFileId)}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="vplayer-msg">{BROKEN_HOSTED}</div>
            ))}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                {video.topic && (
                  <Chip label={video.topic} color={TOPIC_COLOR} icon="play" />
                )}
                <span className="tiny muted">
                  {formatNumber(video.views)} lượt xem · {video.publishedAt}
                </span>
              </div>

              {video.description && (
                <p
                  style={{
                    marginTop: 14,
                    lineHeight: 1.75,
                    textAlign: "justify",
                  }}
                >
                  {video.description}
                </p>
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
        <div
          style={{
            fontSize: ".86rem",
            fontWeight: 600,
            color: "var(--navy)",
            lineHeight: 1.4,
            ...clampLines(2),
          }}
        >
          {video.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          {formatNumber(video.views)} lượt xem
        </div>
      </div>
    </div>
  );
}
