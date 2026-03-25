"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 🔐 Handle Pi Login
  const handlePiLogin = async () => {
    try {
      setLoading(true);

      // تحقق من وجود Pi SDK
      if (!(window as any).Pi) {
        alert("Pi SDK not available");
        return;
      }

      const Pi = (window as any).Pi;

      // Initialize SDK
      Pi.init({
        version: "2.0",
        sandbox: true, // غيرها false في production
      });

      // Authenticate
      const scopes = ["username", "payments"];
      const auth = await Pi.authenticate(scopes, onIncompletePaymentFound);

      console.log("User Auth:", auth);

      // ⛳ هنا المفروض تبعت الـ token للـ backend
      // await fetch("/api/auth", { method: "POST", body: JSON.stringify(auth) })

      // ✅ redirect للـ Hub
      router.push("/hub");
    } catch (err) {
      console.error("Login Error:", err);
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  // 🧠 Handle incomplete payments
  const onIncompletePaymentFound = (payment: any) => {
    console.log("Incomplete payment:", payment);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0B0F1A] text-white">
      <div className="bg-[#111827] p-8 rounded-2xl border border-gray-700 text-center w-full max-w-sm">
        
        <h1 className="text-2xl font-bold text-yellow-400 mb-6">
          TEC Login
        </h1>

        <p className="text-gray-400 mb-6 text-sm">
          Sign in with Pi to access the TEC Ecosystem
        </p>

        <button
          onClick={handlePiLogin}
          disabled={loading}
          className="w-full bg-yellow-500 text-black py-3 rounded-xl font-semibold hover:opacity-90 transition"
        >
          {loading ? "Signing in..." : "Sign in with Pi"}
        </button>
      </div>
    </main>
  );
}
