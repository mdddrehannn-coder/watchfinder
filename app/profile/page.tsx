import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileMenu from "@/components/ProfileMenu";
import { isAdminEmail } from "@/lib/admin-access";
import { getCurrentUserAndProfile } from "@/lib/data";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your WatchFinder account, favorites and settings."
};

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { user } = await getCurrentUserAndProfile();
  const params = searchParams ? await searchParams : {};
  if (!user) redirect("/login?next=/profile");

  return (
    <main className="page-inner">
      <h1>Profile</h1>
      <ProfileMenu
        accessDenied={params?.error === "access-denied"}
        initialEmail={user?.email || "Guest profile"}
        initiallyAdmin={isAdminEmail(user?.email)}
        initiallyLoggedIn={Boolean(user)}
      />
    </main>
  );
}
