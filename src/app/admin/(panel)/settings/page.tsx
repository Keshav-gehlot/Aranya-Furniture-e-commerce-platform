import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toMajor } from "@/lib/money";
import { PageHeader } from "@/components/admin/ui";
import { StoreSettingsForm } from "@/components/admin/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings");
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Store settings" sub="Changes apply to new checkouts immediately. Saving asks for an authenticator code." />
      <StoreSettingsForm
        init={{
          gstPercent: String(s.gstRateBps / 100),
          domesticShipping: toMajor(s.domesticShipping),
          domesticFreeShippingOver: toMajor(s.domesticFreeShippingOver),
          exportHandling: toMajor(s.exportHandling),
          defaultMoq: String(s.defaultMoq),
          reservationMinutes: String(s.reservationMinutes),
          notifyEmail: s.notifyEmail ?? "",
        }}
      />
    </>
  );
}
