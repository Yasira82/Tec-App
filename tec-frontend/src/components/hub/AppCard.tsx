type Props = {
  name: string;
  icon: string;
};

export default function AppCard({ name, icon }: Props) {
  return (
    <div className="bg-[#111827] p-4 rounded-xl text-center border border-gray-700 hover:border-yellow-500 cursor-pointer transition">
      <div className="text-2xl">{icon}</div>
      <p className="mt-2 text-sm">{name}</p>
    </div>
  );
}
