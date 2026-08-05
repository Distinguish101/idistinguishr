// Admin — US-30 (manual teacher approval before going live).
// Gated by email allowlist (src/lib/admin.ts), not the Role enum — see
// that file's comment for why. Not one of the README's numbered screens;
// built because the MVP's "manual approval" shortcut had no UI at all,
// only a direct DB edit.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ApprovalButtons } from "./ApprovalButtons";

type SearchParams = { [key: string]: string | string[] | undefined };
type StatusFilter = "PENDING" | "APPROVED" | "REJECTED";

const TABS: StatusFilter[] = ["PENDING", "APPROVED", "REJECTED"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (!isAdminEmail(session.user.email)) redirect("/");

  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status: StatusFilter = TABS.includes(statusParam as StatusFilter)
    ? (statusParam as StatusFilter)
    : "PENDING";

  const teachers = await prisma.teacherProfile.findMany({
    where: { approvalStatus: status },
    include: { user: { select: { fullName: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="wrap dash-shell">
      <span className="eyebrow">US-30</span>
      <h1 className="t-display-l">Teacher approvals</h1>

      <div className="dash-tabs">
        {TABS.map((t) => (
          <a key={t} href={`/admin?status=${t}`}>
            <span className={status === t ? "sel" : ""}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </span>
          </a>
        ))}
      </div>

      {teachers.length === 0 ? (
        <p className="t-soft">Nothing here.</p>
      ) : (
        teachers.map((t) => (
          <div key={t.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <div className="who" style={{ fontSize: 18 }}>
                  {t.user.fullName}
                </div>
                <div className="t-soft" style={{ fontSize: 13 }}>
                  {t.user.email}
                </div>
              </div>
              <span className={`badge badge-${t.stripeOnboardingComplete ? "approved" : "pending"}`}>
                {t.stripeOnboardingComplete ? "Stripe connected" : "Stripe not connected"}
              </span>
            </div>

            <p style={{ marginTop: 12 }}>{t.bio}</p>

            <div className="t-soft" style={{ fontSize: 13, marginTop: 8 }}>
              <strong>Instruments:</strong> {t.instruments.join(", ")}
            </div>
            <div className="t-soft" style={{ fontSize: 13 }}>
              <strong>Rate:</strong> £{(t.hourlyRateMinorUnits / 100).toFixed(2)}/hr ·{" "}
              <strong>Formats:</strong> {t.formatsOffered.join(", ")}
              {t.locationText ? ` · ${t.locationText}` : ""}
            </div>
            <div className="t-soft" style={{ fontSize: 13, marginTop: 8 }}>
              <strong>Credentials:</strong> {t.credentials}
            </div>

            {status === "PENDING" && (
              <div style={{ marginTop: 16 }}>
                <ApprovalButtons teacherId={t.id} />
              </div>
            )}
          </div>
        ))
      )}
    </main>
  );
}
