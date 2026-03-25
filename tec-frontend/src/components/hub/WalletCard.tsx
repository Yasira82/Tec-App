export default function WalletCard() {
  return (
    <div className="bg-[#111827] p-5 rounded-2xl border border-gray-700 shadow">
      <p className="text-gray-400 text-sm">TEC Wallet</p>

      <h2 className="text-3xl text-yellow-400 mt-2">0.000 π</h2>

      <div className="flex gap-3 mt-5">
        <button className="bg-yellow-500 text-black px-4 py-2 rounded-lg w-full">
          Send
        </button>

        <button className="border border-gray-600 px-4 py-2 rounded-lg w-full">
          Receive
        </button>
      </div>
    </div>
  );
}
