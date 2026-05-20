import type { AdSlot as AdSlotType } from "@/types/watchfinder";

export default function AdSlot({ slot }: { slot?: AdSlotType | null }) {
  if (!slot) return null;

  return (
    <aside className="ad-slot" aria-label={slot.slot_name}>
      <strong>{slot.slot_name}</strong>
      <p>Clean ad placement. Activate approved brand-safe ads from the admin panel.</p>
      {slot.notes ? <small>{slot.notes}</small> : null}
    </aside>
  );
}
