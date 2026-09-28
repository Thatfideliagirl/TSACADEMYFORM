import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Dashboard | TS Academy Submit" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <div className="min-h-screen bg-sky/50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard"><Image src="/ts-academy-logo.png" alt="TS Academy" width={359} height={79} className="h-8 w-auto" /></Link>
            <nav className="flex gap-1 text-sm font-semibold">
              <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-sky">Cohorts</Link>
              {profile.role === "admin" && <><Link href="/dashboard/courses" className="rounded-lg px-3 py-2 hover:bg-sky">Courses</Link><Link href="/dashboard/people" className="rounded-lg px-3 py-2 hover:bg-sky">People</Link></>}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted"><span className="font-semibold text-navy">{profile.full_name}</span>, {profile.role}</span>
            <form action={signOut}><button className="rounded-lg border-[1.5px] border-line px-3 py-1.5 font-semibold hover:bg-sky">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
