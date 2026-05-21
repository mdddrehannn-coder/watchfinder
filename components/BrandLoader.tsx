import BrandLogo from "@/components/BrandLogo";

export default function BrandLoader({
  label = "Loading WatchFinder..."
}: {
  label?: string;
}) {
  return (
    <div className="brand-loader" role="status" aria-live="polite">
      <div className="brand-loader-core">
        <BrandLogo href="" variant="splash" showText={false} />
        <p>{label}</p>
      </div>
    </div>
  );
}
