import type { Comment } from "@/types";

export function CommentList({ comments }: { comments: Comment[] }) {
  return (
    <div>
      {comments.map((c, i) => (
        <div key={i} className="cmt">
          <span className="av" style={{ background: c.authorColor }}>{c.authorInitials}</span>
          <div className="bd">
            <div className="hd">
              <b>{c.authorName}</b>
              <span>{c.time}</span>
            </div>
            <div className="tx">{c.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
