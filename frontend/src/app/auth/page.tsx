"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/types";

type Step = "phone" | "otp" | "register" | "login";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<Step>("phone");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.trim()) return toast.error("Enter a phone number");
    setLoading(true);
    try {
      await authApi.sendOtp(phone);
      toast.success("OTP sent! (Use: 123456)");
      setStep("otp");
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp !== "123456") return toast.error("Invalid OTP. Use 123456");
    setStep(mode === "register" ? "register" : "login");
  };

  const handleRegister = async () => {
    if (!name.trim()) return toast.error("Enter your name");
    if (password.length < 6) return toast.error("Password must be 6+ characters");
    setLoading(true);
    try {
      const res = await authApi.register({ phone_number: phone, display_name: name, password, otp });
      setAuth(res.data.user as User, res.data.access_token);
      router.replace("/chat");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) return toast.error("Enter your password");
    setLoading(true);
    try {
      const res = await authApi.login({ phone_number: phone, password });
      setAuth(res.data.user as User, res.data.access_token);
      router.replace("/chat");
    } catch {
      toast.error("Invalid phone or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-signal-bg flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-signal-teal flex items-center justify-center mb-4 shadow-lg">
            <svg viewBox="0 0 56 56" className="w-12 h-12 fill-white">
              <path d="M28 2C13.641 2 2 13.641 2 28s11.641 26 26 26 26-11.641 26-26S42.359 2 28 2zm12.4 18.2L26.8 35.6a1.5 1.5 0 01-2.1.1l-7.1-6.5a1.5 1.5 0 012-2.2l6 5.5 12.5-14.3a1.5 1.5 0 012.3 1.9v.1z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Signal</h1>
          <p className="text-signal-secondary text-sm mt-1">Private messaging for everyone</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-signal-border p-6">
          {/* Tab switch */}
          {step === "phone" && (
            <div className="flex rounded-lg bg-signal-bg p-1 mb-5">
              {(["register", "login"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    mode === m ? "bg-white shadow-sm text-signal-teal" : "text-signal-secondary"
                  }`}
                >
                  {m === "register" ? "Create account" : "Sign in"}
                </button>
              ))}
            </div>
          )}

          {/* Step: Phone */}
          {step === "phone" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                  placeholder="+1 234 567 8900"
                  className="mt-1 w-full border border-signal-border rounded-lg px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-signal-teal text-white py-3 rounded-lg font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send OTP"}
              </button>
              <p className="text-xs text-signal-secondary text-center">
                Demo: use any number, OTP is <strong>123456</strong>
              </p>
            </div>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-signal-secondary">Enter the code sent to</p>
                <p className="font-semibold text-gray-800">{phone}</p>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                placeholder="123456"
                maxLength={6}
                className="w-full border border-signal-border rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:border-signal-teal"
              />
              <button
                onClick={handleVerifyOtp}
                className="w-full bg-signal-teal text-white py-3 rounded-lg font-medium text-sm hover:bg-signal-teal-dark transition-colors"
              >
                Verify
              </button>
              <button onClick={() => setStep("phone")} className="w-full text-signal-secondary text-sm">
                ← Back
              </button>
            </div>
          )}

          {/* Step: Register */}
          {step === "register" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice Johnson"
                  className="mt-1 w-full border border-signal-border rounded-lg px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  placeholder="Min. 6 characters"
                  className="mt-1 w-full border border-signal-border rounded-lg px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-signal-teal text-white py-3 rounded-lg font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </div>
          )}

          {/* Step: Login */}
          {step === "login" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Your password"
                  className="mt-1 w-full border border-signal-border rounded-lg px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-signal-teal text-white py-3 rounded-lg font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          )}
        </div>

        {/* Seeded accounts hint */}
        <div className="mt-4 bg-white rounded-xl border border-signal-border p-4">
          <p className="text-xs font-semibold text-signal-secondary mb-2">Demo Accounts (password: password123)</p>
          <div className="space-y-1">
            {[
              ["+1234567890", "Alice Johnson"],
              ["+1234567891", "Bob Smith"],
              ["+1234567892", "Carol White"],
            ].map(([num, name]) => (
              <button
                key={num}
                onClick={() => { setPhone(num); setMode("login"); }}
                className="w-full flex justify-between text-xs text-left px-2 py-1.5 rounded hover:bg-signal-bg transition-colors"
              >
                <span className="font-medium text-gray-700">{name}</span>
                <span className="text-signal-secondary font-mono">{num}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
