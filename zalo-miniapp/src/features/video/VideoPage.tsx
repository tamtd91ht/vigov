import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { DemoNote, formatNumber, SubHeader } from "@/components/common";
import { demoConfig } from "@/config/demo.config";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { contentService, distinctBy, youtubeId } from "@/services/content.service";
import type { VideoItem } from "@/types";

/** Chip lọc "tất cả chủ đề" */
export const ALL_TOPICS = "Tất cả";

/** Tỉ lệ khung hình thumbnail video */
export const VIDEO_RATIO = "16 / 9";

/** Nền thumbnail: gradient từ màu video sang chính màu đó pha 25% đen */
/**
 * Ảnh đại diện lấy thẳng từ YouTube khi video là link YouTube.
 * hqdefault có ở MỌI video (maxresdefault thì không — video cũ hoặc chất lượng
 * thấp sẽ trả ảnh 404 và ô thumbnail thành khoảng trắng).
 * Video tự host chưa có ảnh bìa nên trả null và dùng gradient như cũ.
 */
export function videoThumb(video: VideoItem): string | null {
  if (video.source !== "youtube") return null;
  const id = youtubeId(video.youtubeUrl);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function videoGradient(color: string): string {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, #000 25%, ${color}))`;
}

/** Cắt chữ sau n dòng */
export function clampLines(lines: number): CSSProperties {
  return { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" };
}

/** Video tuyên truyền — lưới 2 cột, lọc theo chủ đề (WBS #18) — GET /content/public/videos */
export function VideoPage() {
  const [topic, setTopic] = useState<string>(ALL_TOPICS);
  const resource = useApiResource(() => contentService.listVideos(), []);
  const all = useMemo(() => resource.data ?? [], [resource.data]);

  // Chip chủ đề lấy từ chính dữ liệu CMS trả về, không cố định trong mã nguồn
  const topics = useMemo(() => distinctBy(all, (v) => v.topic), [all]);
  const videos = useMemo(
    () => (topic === ALL_TOPICS ? all : all.filter((v) => v.topic === topic)),
    [all, topic],
  );

  return (
    <div className="app">
      <SubHeader title="Video tuyên truyền" />
      <div className="page plain">
        <DemoNote>{demoConfig.notes.video}</DemoNote>
        <div className="chips-row" style={{ marginBottom: 14 }}>
          {[ALL_TOPICS, ...topics].map((t) => (
            <button key={t} className={`fchip ${t === topic ? "on" : ""}`} onClick={() => setTopic(t)}>
              {t}
            </button>
          ))}
        </div>

        <DataState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={videos.length === 0}
          emptyIcon="play"
          emptyMessage={
            topic === ALL_TOPICS ? "Chưa có video tuyên truyền" : `Chưa có video nào thuộc chủ đề ${topic}`
          }
        >
          <div className="grid2">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
}

/** Ô video trong lưới — thumbnail 16:9 + tiêu đề + chủ đề */
function VideoCard({ video }: { video: VideoItem }) {
  const navigate = useNavigate();
  const thumb = videoThumb(video);

  return (
    <div className="card tap" role="button" style={{ overflow: "hidden" }} onClick={() => navigate(`/video/${video.id}`)}>
      <div
        style={{
          position: "relative",
          aspectRatio: VIDEO_RATIO,
          background: videoGradient(video.coverColor),
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {thumb && (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            /* Ảnh hỏng (video bị gỡ, mất mạng) thì ẩn hẳn để lộ gradient bên
               dưới, thay vì để trình duyệt vẽ khung ảnh vỡ. */
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Icon name="playFill" size={30} color="#fff" fill />
        <span
          style={{
            position: "absolute",
            right: 6,
            bottom: 6,
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            fontSize: ".66rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 5,
          }}
        >
          {video.duration}
        </span>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: ".84rem", fontWeight: 600, color: "var(--navy)", lineHeight: 1.4, ...clampLines(2) }}>
          {video.title}
        </div>
        <div className="tiny muted" style={{ marginTop: 5, ...clampLines(1) }}>
          {video.topic} · {formatNumber(video.views)} lượt xem
        </div>
      </div>
    </div>
  );
}
