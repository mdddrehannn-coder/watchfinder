import Link from "next/link";

export default function EmptyState({
  title = "Nothing here yet",
  message = "Add content in Supabase or the admin panel and it will appear here.",
  actionHref,
  actionLabel
}: {
  title?: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {actionHref && actionLabel ? (
        <Link className="button" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
