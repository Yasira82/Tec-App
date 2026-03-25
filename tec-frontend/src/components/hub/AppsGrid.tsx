import { apps } from "@/data/apps";
import AppCard from "./AppCard";
import Link from "next/link";

export default function AppsGrid() {
  return (
    <div>
      <h2 className="text-lg text-gray-300 mb-3">Apps</h2>

      <div className="grid grid-cols-3 gap-4">
        {apps.map((app) => (
          <Link key={app.name} href={app.route}>
            <AppCard name={app.name} icon={app.icon} />
          </Link>
        ))}
      </div>
    </div>
  );
}
