export default function HubHeader() {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold text-yellow-400">TEC</h1>

      <div className="flex items-center gap-3">
        <button className="bg-yellow-500 text-black px-3 py-1 rounded-lg">
          Wallet
        </button>

        <button className="border border-gray-600 px-3 py-1 rounded-lg">
          ☰
        </button>
      </div>
    </div>
  );
}
