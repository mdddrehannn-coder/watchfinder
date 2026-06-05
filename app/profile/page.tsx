import type { Metadata } from "next";
import ProfileMenu from "@/components/ProfileMenu";
import { getCurrentUserAndProfile } from "@/lib/data";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your WatchFinder account, favorites and settings."
};

export default async function ProfilePage() {
  const { user } = await getCurrentUserAndProfile();

  return (
    <main className="page-inner">
      <h1>Profile</h1>
      <ProfileMenu initialEmail={user?.email || "Guest profile"} initiallyLoggedIn={Boolean(user)} />
    </main>
  );
}
