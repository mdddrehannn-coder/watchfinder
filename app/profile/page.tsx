import type { Metadata } from "next";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import ProfileMenu from "@/components/ProfileMenu";
import { getCurrentUserAndProfile } from "@/lib/data";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your WatchFinder account, favorites and settings."
};

export default async function ProfilePage() {
  const { user } = await getCurrentUserAndProfile();

  if (!user) {
    return (
      <main className="page-inner">
        <section className="section panel profile-login-card">
          <BrandLogo variant="profile" showText={false} />
          <h1>Please login to access your profile</h1>
          <p className="muted">Login to save favorites and watch history.</p>
          <Link className="button primary" href="/login?next=/profile">
            Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-inner">
      <h1>Profile</h1>
      <ProfileMenu initialEmail={user.email || "Signed in"} />
    </main>
  );
}
