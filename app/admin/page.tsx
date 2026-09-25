import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { AdminLogin } from "@/components/admin/login";
import { AdminDashboard } from "@/components/admin/dashboard";

export const metadata: Metadata = {
  title: "Панель администратора",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authorized = await isAdmin();

  return (
    <section className="min-h-[100svh] bg-ink pb-20 pt-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        {authorized ? <AdminDashboard /> : <AdminLogin />}
      </div>
    </section>
  );
}
