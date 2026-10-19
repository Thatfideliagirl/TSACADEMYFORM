import Image from "next/image";

export const metadata = {
  title: "Collect your certificate | TS Academy",
  robots: { index: false, follow: false },
};

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sky/60">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-4">
          <Image src="/ts-academy-logo.png" alt="TS Academy" width={359} height={79} priority className="h-8 w-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-16">{children}</main>
    </div>
  );
}
