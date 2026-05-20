import type { Metadata } from "next";
import ProfileMenu from "@/components/ProfileMenu";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your WatchFinder account, favorites and settings."
};

export default function ProfilePage() {
  return (
    <main className="page-inner">
      <h1>Profile</h1>
      <ProfileMenu />
    </main>
  );
}
