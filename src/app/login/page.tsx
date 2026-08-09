"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { persistThemeCookie } from "@/lib/theme-cookie";

function ZalesLogoMark({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt="Zales"
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  );
}

/** Fades + slides an element in the first time it scrolls into view. */
function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
// Replace the old destructured "lucide-react" import with this:
import { Languages } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Sun } from "lucide-react";
import { Moon } from "lucide-react";
import { PhoneCall } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Phone } from "lucide-react";
import { Mail } from "lucide-react";
import { Clock } from "lucide-react";
import { Lock } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Plus } from "lucide-react";

const translations = {
  id: {
    title: "AI Agentic and Automation Workflow",
    subtitle: "your business partner to realize big ambition",
    loginWorkspace: "Masuk ke workspace kamu",
    createAccount: "Bikin akun baru",
    emailPlaceholder: "Masukkan email Anda",
    namePlaceholder: "Nama Lengkap",
    passwordPlaceholder: "Kata Sandi",
    continueEmail: "Lanjut dengan email",
    continueGoogle: "Lanjut dengan Google",
    alreadyHaveAccount: "Sudah punya akun? Masuk",
    dontHaveAccount: "Belum punya akun? Daftar",
    or: "ATAU",
    downloadDesktop: "Unduh aplikasi desktop",
    meet: "Kenali Zales",
    platform: "Platform",
    solutions: "Solusi",
    navFaq: "FAQ",
    contactSales: "Hubungi Sales",
    tryZales: "Coba Zales",
    footerDesc: "Mewujudkan alur kerja impian Anda dengan otomatisasi AI canggih dan kualitas profesional. Solusi digital terbaik untuk bisnis global.",
    layanan: "LAYANAN",
    perusahaan: "PERUSAHAAN",
    hubungiKami: "HUBUNGI KAMI",
    webCreation: "Pembuatan Website",
    landingPage: "Landing Page UMKM",
    ecommerce: "E-Commerce Website",
    customApp: "Custom Web Application",
    aboutUs: "Tentang Kami",
    portfolio: "Portofolio",
    testimonials: "Testimoni",
    contact: "Kontak",
    signUp: "Sign up",
    logIn: "Log in",
    forgotPassword: "Lupa password?",
    resetTitle: "Reset password",
    resetDesc: "Masukkan email akun kamu. Kami kirim link reset password ke sana.",
    sendResetLink: "Kirim link reset",
    backToLogin: "Kembali ke login",
    resetSent: "Kalau akun itu ada, link reset udah kami kirim ke emailnya. Cek inbox (atau folder spam).",
    faqTitle: "Pertanyaan yang Sering Diajukan",
    faqQ1: "Apa kegunaan utama Zales AI?",
    faqA1: "Zales AI adalah platform hyper-automation yang mengintegrasikan agen AI cerdas ke dalam alur kerja bisnis untuk mengotomatiskan tugas berulang, memproses data skala besar, dan mempercepat realisasi ambisi bisnis Anda.",
    faqQ2: "Bagaimana cara melakukan setup dan integrasi API Key?",
    faqA2: "Anda dapat memasukkan API Key dari penyedia AI (seperti OpenAI, Google Gemini, dll.) langsung pada node workflow yang bersangkutan di dalam dashboard, atau sekali di halaman Pengaturan Akun agar berlaku otomatis di semua workflow.",
    faqQ3: "Apakah data API Key yang saya simpan dijamin aman?",
    faqA3: "Ya. Seluruh kredensial dan API Key dienkripsi menggunakan standar industri AES-256 di sisi server sebelum masuk ke database, sehingga tidak bisa dibaca mentah oleh pihak ketiga.",
    faqQ4: "Node apa aja yang tersedia buat nyusun workflow?",
    faqA4: "Ada 30-an lebih node siap pakai: trigger (manual, jadwal, webhook, WhatsApp, pesan sosial), AI (chat, agent, image, video), integrasi (Slack, Discord, Notion, Airtable, kirim email, SMS, Google Sheets, Telegram), Office (Excel/Word/PowerPoint), sampai transform & logic (set fields, filter, switch, loop). Daftarnya terus ditambah.",
    faqQ5: "AI Agent-nya bisa manggil AI lain atau tool lain sendiri?",
    faqA5: "Bisa. Node AI Agent punya tool-calling asli — kamu tinggal tempelin node lain (MCP Connector, HTTP Request, bahkan AI Agent lain) sebagai 'Tools & Sub-agents', dan modelnya sendiri yang mutusin kapan perlu manggil tool itu, bukan alur kaku yang digambar manual.",
    faqQ6: "Trigger apa aja yang didukung buat mulai workflow?",
    faqA6: "Manual (klik run), jadwal (cron), webhook custom, WhatsApp Gateway, dan pesan Instagram/Facebook. Setiap trigger bisa dipakai buat memicu satu workflow yang sama.",
    faqQ7: "Data akun saya (profil, riwayat login, dll) bisa saya kelola di mana?",
    faqA7: "Semua ada di halaman Pengaturan Akun setelah login: profil & zona waktu, ubah kata sandi + log aktivitas login, API Key ter-enkripsi, ringkasan data akun, pusat bantuan, sampai opsi hapus akun permanen.",
    lihatJasa: "Lihat Jasa Lainnya",
    portofolio: "Portofolio",
  },
  en: {
    title: "AI Agentic and Automation Workflow",
    subtitle: "your business partner to realize big ambition",
    loginWorkspace: "Log in to your workspace",
    createAccount: "Create a new account",
    emailPlaceholder: "Enter your email",
    namePlaceholder: "Full Name",
    passwordPlaceholder: "Password",
    continueEmail: "Continue with email",
    continueGoogle: "Continue with Google",
    alreadyHaveAccount: "Already have an account? Log in",
    dontHaveAccount: "Don't have an account? Sign up",
    or: "OR",
    downloadDesktop: "Download desktop app",
    meet: "Meet Zales",
    platform: "Platform",
    solutions: "Solutions",
    navFaq: "FAQ",
    contactSales: "Contact sales",
    tryZales: "Try Zales",
    footerDesc: "Realizing your dream workflows with advanced AI automation and professional quality. The best digital solution for global business.",
    layanan: "SERVICES",
    perusahaan: "COMPANY",
    hubungiKami: "CONTACT US",
    webCreation: "Website Development",
    landingPage: "UMKM Landing Page",
    ecommerce: "E-Commerce Website",
    customApp: "Custom Web Application",
    aboutUs: "About Us",
    portfolio: "Portfolio",
    testimonials: "Testimonials",
    contact: "Contact",
    signUp: "Sign up",
    logIn: "Log in",
    forgotPassword: "Forgot password?",
    resetTitle: "Reset password",
    resetDesc: "Enter your account email. We'll send a password reset link there.",
    sendResetLink: "Send reset link",
    backToLogin: "Back to login",
    resetSent: "If that account exists, a reset link has been sent to its email. Check your inbox (or spam folder).",
    faqTitle: "Frequently Asked Questions",
    faqQ1: "What's the main purpose of Zales AI?",
    faqA1: "Zales AI is a hyper-automation platform that integrates smart AI agents into business workflows to automate repetitive tasks, process data at scale, and speed up your big ambitions.",
    faqQ2: "How do I set up and integrate an API key?",
    faqA2: "You can enter an API key from an AI provider (OpenAI, Google Gemini, etc.) directly on the relevant workflow node in the dashboard, or once in Account Settings so it applies automatically across all workflows.",
    faqQ3: "Is the API key data I store guaranteed to be secure?",
    faqA3: "Yes. All credentials and API keys are encrypted server-side using the industry-standard AES-256 before they're stored in the database, so they can never be read in the raw by a third party.",
    faqQ4: "What nodes are available to build a workflow?",
    faqA4: "30+ ready-to-use nodes: triggers (manual, schedule, webhook, WhatsApp, social message), AI (chat, agent, image, video), integrations (Slack, Discord, Notion, Airtable, send email, SMS, Google Sheets, Telegram), Office (Excel/Word/PowerPoint), plus transform & logic nodes (set fields, filter, switch, loop). The list keeps growing.",
    faqQ5: "Can the AI Agent call other AI models or tools on its own?",
    faqA5: "Yes. The AI Agent node has real tool-calling — attach other nodes (an MCP Connector, HTTP Request, even another AI Agent) as 'Tools & Sub-agents', and the model itself decides when to call them, instead of a fixed chain you draw by hand.",
    faqQ6: "What triggers are supported to start a workflow?",
    faqA6: "Manual (click run), schedule (cron), custom webhook, WhatsApp Gateway, and Instagram/Facebook messages. Any trigger can kick off the same workflow.",
    faqQ7: "Where can I manage my account data (profile, login history, etc.)?",
    faqA7: "All in Account Settings after logging in: profile & timezone, password + login activity log, encrypted API keys, an account data summary, a help center, and a permanent account deletion option.",
    lihatJasa: "More services",
    portofolio: "Portfolio",
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lang, setLang] = useState<"en" | "id">("id");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const langMenuRef = useRef<HTMLDivElement>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    // The <html> class is already correct from the server (via the theme
    // cookie), so just read it back instead of localStorage — this avoids
    // the light/dark flash the old localStorage-based init caused.
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const savedLang = localStorage.getItem("zales-lang") || "id";
    setLang(savedLang as "en" | "id");
  }, []);

  useEffect(() => {
    if (!showLangMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLangMenu]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    persistThemeCookie(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const changeLang = (l: "en" | "id") => {
    setLang(l);
    localStorage.setItem("zales-lang", l);
    setShowLangMenu(false);
  };

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetSending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
    } catch {
      // Intentionally silent — we show the same generic message either way
      // so this endpoint can't be used to check which emails are registered.
    } finally {
      setResetSending(false);
      setResetDone(true);
    }
  }

  const t = translations[lang];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || (lang === "id" ? "Registrasi gagal." : "Registration failed."));
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(
          mode === "register"
            ? (lang === "id" ? "Akun dibuat, tapi gagal auto-login. Coba masuk manual." : "Account created, but auto-login failed. Try logging in manually.")
            : (lang === "id" ? "Email atau password salah." : "Invalid email or password.")
        );
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : (lang === "id" ? "Terjadi kesalahan." : "An error occurred."));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#FBF9F6] text-[#191919] dark:bg-[#0B0A09] dark:text-[#EAE9E6] transition-colors duration-200 overflow-x-hidden font-sans">
      
      {/* Upper Navbar */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-b border-neutral-200/50 dark:border-neutral-800/40 shrink-0">
        <div className="flex items-center gap-2">
          <ZalesLogoMark size={30} />
          <span className="text-xl font-bold tracking-tight">Zales</span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-medium text-neutral-600 dark:text-neutral-400">
          <a href="#faq" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.navFaq}</a>
          <a href="https://gabzstore.web.id" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.lihatJasa}</a>
          <a href="https://gabzdev.my.id" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.portofolio}</a>
        </nav>

        {/* Navbar Actions */}
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-[12.5px] font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            >
              <Languages size={14} />
              <span>{lang.toUpperCase()}</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${showLangMenu ? "rotate-180" : ""}`} />
            </button>
            
            {showLangMenu && (
              <div className="absolute right-0 mt-1.5 w-28 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 z-50">
                <button
                  onClick={() => changeLang("en")}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-neutral-50 dark:hover:bg-neutral-900 ${lang === "en" ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-500 dark:text-neutral-400"}`}
                >
                  English
                </button>
                <button
                  onClick={() => changeLang("id")}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-neutral-50 dark:hover:bg-neutral-900 ${lang === "id" ? "font-semibold text-neutral-950 dark:text-white" : "text-neutral-500 dark:text-neutral-400"}`}
                >
                  Indonesia
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Mock sales / CTA */}
          <button className="hidden sm:inline-block px-4 py-2 rounded-full border border-neutral-900 dark:border-white text-[12.5px] font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
            {t.contactSales}
          </button>
          <button className="hidden sm:inline-block px-4 py-2 rounded-full bg-neutral-900 text-white dark:bg-white text-neutral-950 text-[12.5px] font-medium hover:opacity-90 transition-opacity">
            {t.tryZales}
          </button>
        </div>
      </header>

      {/* Main Container splitscreen */}
      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 px-6 py-10 lg:px-12 items-start max-w-7xl mx-auto">
        
        {/* Left Side: Login Form */}
        <div className="w-full flex flex-col justify-center py-4 lg:pr-8">
          <div className="max-w-md w-full mx-auto">
            {/* Title Section */}
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-serif font-normal tracking-tight leading-tight mb-3">
                {t.title}
              </h1>
              <p className="text-base text-neutral-500 dark:text-neutral-400 font-medium">
                {t.subtitle}
              </p>
            </div>

            {/* Login Card */}
            <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800/50 bg-[#FAF7F2] dark:bg-[#121110] p-6 shadow-sm mb-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                  {mode === "register" ? t.createAccount : t.loginWorkspace}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {mode === "register" && (
                  <div className="flex flex-col">
                    <input
                      type="text"
                      required
                      placeholder={t.namePlaceholder}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181716] px-3.5 py-3 text-[13.5px] text-neutral-900 dark:text-white outline-none focus:border-neutral-500 dark:focus:border-neutral-500 transition-colors"
                    />
                  </div>
                )}
                <div className="flex flex-col">
                  <input
                    type="email"
                    required
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181716] px-3.5 py-3 text-[13.5px] text-neutral-900 dark:text-white outline-none focus:border-neutral-500 dark:focus:border-neutral-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col">
                  <input
                    type="password"
                    required
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181716] px-3.5 py-3 text-[13.5px] text-neutral-900 dark:text-white outline-none focus:border-neutral-500 dark:focus:border-neutral-500 transition-colors"
                  />
                </div>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setResetDone(false);
                      setResetEmail(email);
                    }}
                    className="-mt-1.5 self-end text-[12px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                  >
                    {t.forgotPassword}
                  </button>
                )}

                {error && <p className="text-[12px] text-red-600 dark:text-red-400 font-medium">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 py-3 text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 mt-1 cursor-pointer"
                >
                  {loading ? "..." : mode === "register" ? t.createAccount : t.loginWorkspace}
                </button>
              </form>

              {/* OR Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-800" />
                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-600 tracking-wider">{t.or}</span>
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-800" />
              </div>

              {/* Google Login Button */}
              <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181716] py-3 text-[13.5px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t.continueGoogle}
              </button>
            </div>

            {/* Form Toggle Switcher */}
            <p className="text-center text-[13px] text-neutral-500 dark:text-neutral-400">
              {mode === "login" ? t.dontHaveAccount : t.alreadyHaveAccount}{" "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="font-semibold text-neutral-900 underline dark:text-white hover:opacity-85"
              >
                {mode === "login" ? t.signUp : t.logIn}
              </button>
            </p>

          </div>
        </div>

        {/* Right Side: Claude style image container */}
        <div className="hidden lg:block w-full h-[550px] sticky top-8 rounded-2xl overflow-hidden shadow-lg border border-neutral-200/50 dark:border-neutral-800/40 bg-neutral-100 dark:bg-neutral-900">
          <img
            src="/login-illustration.png"
            alt="Zales Workspace Illustration"
            className="w-full h-full object-cover select-none"
          />
        </div>
      </main>

      {/* FAQ Section (before footer) */}
      <section id="faq" className="w-full px-6 py-14 lg:px-12 border-t border-neutral-200/50 dark:border-neutral-800/40">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <HelpCircle size={20} />
              {t.faqTitle}
            </h2>
          </Reveal>
          <div className="space-y-2">
            {[
              { q: t.faqQ1, a: t.faqA1 },
              { q: t.faqQ2, a: t.faqA2 },
              { q: t.faqQ3, a: t.faqA3 },
              { q: t.faqQ4, a: t.faqA4 },
              { q: t.faqQ5, a: t.faqA5 },
              { q: t.faqQ6, a: t.faqA6 },
              { q: t.faqQ7, a: t.faqA7 },
            ].map((item, i) => (
              <Reveal key={i} delayMs={i * 60}>
                <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/50 bg-[#FAF7F2] dark:bg-[#121110] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[13.5px] font-semibold text-neutral-900 dark:text-white"
                  >
                    {item.q}
                    <Plus
                      size={16}
                      className={`shrink-0 text-neutral-400 transition-transform duration-300 ${openFaq === i ? "rotate-45" : ""}`}
                    />
                  </button>
                  <div
                    className="grid transition-all duration-300 ease-in-out"
                    style={{ gridTemplateRows: openFaq === i ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-4 pb-4 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs"
            onClick={() => setShowForgotPassword(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex items-center gap-2">
              <Lock size={16} className="text-neutral-700 dark:text-neutral-300" />
              <h3 className="text-[14px] font-bold text-neutral-900 dark:text-white">{t.resetTitle}</h3>
            </div>

            {resetDone ? (
              <>
                <p className="mb-4 text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {t.resetSent}
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 dark:bg-white dark:text-neutral-950"
                >
                  <ArrowLeft size={14} />
                  {t.backToLogin}
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <p className="text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {t.resetDesc}
                </p>
                <input
                  type="email"
                  required
                  placeholder={t.emailPlaceholder}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-[#181716] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={resetSending}
                  className="w-full rounded-xl bg-neutral-900 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-neutral-950"
                >
                  {resetSending ? "..." : t.sendResetLink}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-center text-[12px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  {t.backToLogin}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {/* Footer Section */}
      <footer className="w-full bg-[#F4F1EC] dark:bg-[#0D0C0B] border-t border-neutral-200 dark:border-neutral-900 py-12 px-6 lg:px-12 mt-16 transition-colors duration-200">
        <Reveal>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Logo & Description */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <ZalesLogoMark size={26} />
              <span className="text-lg font-bold">Zales</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {t.footerDesc}
            </p>
            {/* Social Media Links */}
            <div className="flex items-center gap-2 pt-2">
              <a href="#" className="p-2 rounded-xl bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800/40 dark:hover:bg-neutral-800 transition-colors">
                <PhoneCall size={14} className="text-neutral-600 dark:text-neutral-300" />
              </a>
              <a href="#" className="p-2 rounded-xl bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800/40 dark:hover:bg-neutral-800 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-600 dark:text-neutral-300">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="#" className="p-2 rounded-xl bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800/40 dark:hover:bg-neutral-800 transition-colors">
                <MessageCircle size={14} className="text-neutral-600 dark:text-neutral-300" />
              </a>
              <a href="#" className="p-2 rounded-xl bg-neutral-200/50 hover:bg-neutral-200 dark:bg-neutral-800/40 dark:hover:bg-neutral-800 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-neutral-600 dark:text-neutral-300">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.02 2.89-.02 3.29 0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>

          {/* LAYANAN (Services) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t.layanan}
            </h3>
            <ul className="space-y-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.webCreation}</a></li>
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.landingPage}</a></li>
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.ecommerce}</a></li>
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.customApp}</a></li>
            </ul>
          </div>

          {/* PERUSAHAAN (Company) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t.perusahaan}
            </h3>
            <ul className="space-y-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.aboutUs}</a></li>
              <li><a href="https://gabzdev.my.id" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.portfolio}</a></li>
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.testimonials}</a></li>
              <li><a href="#" className="hover:text-neutral-900 dark:hover:text-white transition-colors">{t.contact}</a></li>
            </ul>
          </div>

          {/* HUBUNGI KAMI (Contact Us) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t.hubungiKami}
            </h3>
            <ul className="space-y-3.5 text-[13px] font-medium text-neutral-600 dark:text-neutral-400">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-neutral-400" />
                <span>+62 881-1494-688</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-neutral-400" />
                <span>gabzstoreid@gmail.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock size={14} className="text-neutral-400" />
                <span>Support 24/7</span>
              </li>
            </ul>
          </div>

        </div>
        </Reveal>
        
        {/* Copyright */}
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-neutral-200/60 dark:border-neutral-800/40 text-center text-xs text-neutral-400">
          <p>© {new Date().getFullYear()} Zales. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
