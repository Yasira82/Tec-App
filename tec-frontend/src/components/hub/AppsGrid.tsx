"use client";

import { apps } from "@/data/apps";
import AppCard from "./AppCard";
import { useRouter } from "next/navigation";

export default function AppsGrid() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-lg text-gray-300 mb-3">Apps</h2>

      <div className="grid grid-cols-3 gap-4">
        {apps.map((app) => (
          <div key={app.name} onClick={() => router.push(app.route)}>
            <AppCard name={app.name} icon={app.icon} />
          </div>
        ))}
      </div>
    </div>
  );
}
