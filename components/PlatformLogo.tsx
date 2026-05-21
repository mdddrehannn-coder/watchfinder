import { platformLogoFor } from "@/lib/platform-logos";
import type { Platform } from "@/types/watchfinder";

export default function PlatformLogo({ platform }: { platform: Platform }) {
  const logo = platformLogoFor(platform);

  return (
    <div className="platform-logo">
      {logo ? (
        <img src={logo} alt={`${platform.name} logo`} />
      ) : (
        <span>{platform.name.slice(0, 1)}</span>
      )}
    </div>
  );
}
