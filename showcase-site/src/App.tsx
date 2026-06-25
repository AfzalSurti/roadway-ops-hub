import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { StatsBar } from "@/components/StatsBar";
import { Modules } from "@/components/Modules";
import { Roles } from "@/components/Roles";
import { Screenshots } from "@/components/Screenshots";
import { Capabilities } from "@/components/Capabilities";
import { TechStack } from "@/components/TechStack";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" aria-hidden />
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" aria-hidden />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/8 blur-[100px] pointer-events-none" aria-hidden />

      <Navbar />
      <main className="relative z-10">
        <Hero />
        <StatsBar />
        <Screenshots />
        <Modules />
        <Roles />
        <Capabilities />
        <TechStack />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
