"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/types";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";

type Step = "phone" | "otp" | "register" | "login";

const OTP_RESEND_SECONDS = 60;

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
  const [otpMode, setOtpMode] = useState<"twilio" | "mock" | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown > 0) {
      countdownRef.current = setTimeout(() => setResendCountdown((n) => n - 1), 1000);
    }
    return () => { if (countdownRef.current) clearTimeout(countdownRef.current); };
  }, [resendCountdown]);

  // Sync otpDigits -> otp string
  useEffect(() => {
    setOtp(otpDigits.join(""));
  }, [otpDigits]);

  const handleOtpDigit = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    if (digit && idx < 5) otpInputsRef.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpInputsRef.current[idx - 1]?.focus();
    }
  };

  const handleSendOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return toast.error("Enter a phone number");
    if (!trimmed.startsWith("+")) return toast.error("Include country code, e.g. +91…");
    setLoading(true);
    try {
      const res = await authApi.sendOtp(trimmed);
      const data = res.data;
      setOtpMode(data.mode || "mock");
      setResendCountdown(OTP_RESEND_SECONDS);
      setOtpDigits(["", "", "", "", "", ""]);
      setStep("otp");
      if (data.mode === "mock") {
        toast("Demo mode: OTP is shown in the server console.", { icon: "🛠️", duration: 5000 });
        if (data.mock_otp) {
          // Auto-fill for demo convenience
          const digits = data.mock_otp.split("").slice(0, 6);
          setOtpDigits([...digits, ...Array(6 - digits.length).fill("")]);
        }
      } else {
        toast.success(`OTP sent to ${trimmed} via SMS`);
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to send OTP";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setStep(mode === "register" ? "register" : "login");
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    await handleSendOtp();
  };

  const handleRegister = async () => {
    if (!name.trim()) return toast.error("Enter your name");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
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

          {/* ── Step: Phone ── */}
          {step === "phone" && (
            <>
              {/* Mode tabs */}
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

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    placeholder="+91 98765 43210"
                    className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                    autoFocus
                  />
                  <p className="text-[11px] text-signal-secondary mt-1.5">
                    Include your country code (e.g. +1, +91, +44)
                  </p>
                </div>
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full bg-signal-teal text-white py-3 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : "Send OTP"}
                </button>
              </div>
            </>
          )}

          {/* ── Step: OTP ── */}
          {step === "otp" && (
            <div className="space-y-5">
              <button onClick={() => setStep("phone")} className="flex items-center gap-1 text-signal-secondary text-sm hover:text-gray-700 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>

              <div className="text-center">
                <p className="text-sm text-signal-secondary">
                  {otpMode === "twilio"
                    ? "We sent a 6-digit code via SMS to"
                    : "Demo mode — code auto-filled below"}
                </p>
                <p className="font-bold text-gray-800 mt-0.5">{phone}</p>
              </div>

              {/* 6-box OTP input */}
              <div className="flex justify-center gap-2">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigit(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-11 h-12 text-center text-xl font-bold border-2 rounded-xl transition-colors focus:outline-none ${
                      digit ? "border-signal-teal bg-signal-teal-light text-signal-teal" : "border-signal-border focus:border-signal-teal"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6}
                className="w-full bg-signal-teal text-white py-3 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-40"
              >
                Verify Code
              </button>

              {/* Resend */}
              <div className="text-center">
                {resendCountdown > 0 ? (
                  <p className="text-sm text-signal-secondary">
                    Resend code in <span className="font-semibold text-signal-teal">{resendCountdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    className="flex items-center gap-1.5 text-sm text-signal-teal font-medium hover:underline mx-auto"
                  >
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Register ── */}
          {step === "register" && (
            <div className="space-y-4">
              <button onClick={() => setStep("otp")} className="flex items-center gap-1 text-signal-secondary text-sm hover:text-gray-700">
                <ArrowLeft size={14} /> Back
              </button>
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">Your Name</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alice Johnson"
                  className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  placeholder="Min. 6 characters"
                  className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-signal-teal text-white py-3 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : "Create Account"}
              </button>
            </div>
          )}

          {/* ── Step: Login ── */}
          {step === "login" && (
            <div className="space-y-4">
              <button onClick={() => setStep("otp")} className="flex items-center gap-1 text-signal-secondary text-sm hover:text-gray-700">
                <ArrowLeft size={14} /> Back
              </button>
              <p className="text-sm text-signal-secondary text-center">Signing in as <strong className="text-gray-800">{phone}</strong></p>
              <div>
                <label className="text-xs font-semibold text-signal-secondary uppercase tracking-wide block mb-1.5">Password</label>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Your password"
                  className="w-full border border-signal-border rounded-xl px-4 py-3 text-sm focus:border-signal-teal transition-colors"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-signal-teal text-white py-3 rounded-xl font-medium text-sm hover:bg-signal-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign In"}
              </button>
            </div>
          )}
        </div>

        {/* Demo accounts */}
        {step === "phone" && (
          <div className="mt-4 bg-white rounded-xl border border-signal-border p-4">
            <p className="text-xs font-semibold text-signal-secondary mb-2">Demo Accounts (password: password123)</p>
            <div className="space-y-1">
              {[
                ["+1234567890", "Alice Johnson"],
                ["+1234567891", "Bob Smith"],
                ["+1234567892", "Carol White"],
              ].map(([num, uname]) => (
                <button
                  key={num}
                  onClick={() => { setPhone(num); setMode("login"); }}
                  className="w-full flex justify-between text-xs text-left px-2 py-1.5 rounded hover:bg-signal-bg transition-colors"
                >
                  <span className="font-medium text-gray-700">{uname}</span>
                  <span className="text-signal-secondary font-mono">{num}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
