import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { signOut } from "@/app/actions/auth";
import { MainNav } from "@/components/main-nav";
import { NotificationBell } from "@/components/notification-bell";

export const metadata = { title: "Dashboard | TS Academy Submit" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <div className="min-h-screen bg-sky/50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/dashboard" className="order-1 flex-none"><Image src="/ts-academy-logo.png" alt="TS Academy" width={359} height={79} className="h-8 w-auto" /></Link>
          <div className="order-2 ml-auto flex min-w-0 items-center gap-3 text-sm lg:order-3">
            <NotificationBell />
            <span className="min-w-0 truncate text-muted"><span className="font-semibold text-navy">{profile.full_name}</span><span className="hidden sm:inline">, {profile.role}</span></span>
            <form action={signOut}><button className="whitespace-nowrap rounded-lg border-[1.5px] border-line px-3 py-1.5 font-semibold hover:bg-sky">Sign out</button></form>
          </div>
          <div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1"><MainNav admin={profile.role === "admin"} /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
