import HubHeader from "@/components/hub/HubHeader";
import WalletCard from "@/components/hub/WalletCard";
import QuickActions from "@/components/hub/QuickActions";
import AppsGrid from "@/components/hub/AppsGrid";

export default function HubPage() {
  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white px-4 py-6">
      <HubHeader />

      <div className="mt-6 space-y-6">
        <WalletCard />
        <QuickActions />
        <AppsGrid />
      </div>
    </main>
  );
}
