export default function LoadingSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}
