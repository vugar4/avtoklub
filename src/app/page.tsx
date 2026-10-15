"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/app-shell";
import { JourneyProgress } from "@/components/journey-progress";
import { api } from "@/lib/client/api";
import type { MeResponse } from "@/lib/client/hooks";

const BakuDrive = dynamic(() => import("@/components/baku-drive"), { ssr: false });

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api<MeResponse>("/api/me").then(result => {
      if (result.user) router.replace("/feed");
    }).catch(() => {});
  }, [router]);

  return <main className="landing landing-split">
    <section className="landing-panel" aria-labelledby="landing-title">
      <header className="landing-nav"><Brand href="/" compact /></header>

      <div className="landing-intro">
        <h1 id="landing-title">Sənin yolun.<br/>Sənin klubun.</h1>
        <p>Bakının yollarında Avtoklub-u kəşf et. Tədbirlərə, klublara və elanlara öz marşrutunla çat.</p>
        <div className="landing-actions">
          <Link href="/login">Daxil ol</Link>
          <Link href="/register">Qeydiyyatdan keç <ArrowRight size={18}/></Link>
        </div>
        <JourneyProgress progress={22} label="Marşrut" compact />
      </div>

      <div className="landing-instructions" aria-label="Sürüş qaydası">
        <div><strong>İdarə et</strong><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><br/>və ya ox düymələri</span></div>
        <div><strong>Sərbəst sür</strong><span>Küçədə sürəti və<br/>döngələri özün idarə et</span></div>
        <div><strong>Dayanacaq seç</strong><span>Xəritədəki nişanlara<br/>toxun</span></div>
      </div>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} Avtoklub</span><a href="https://grab3d.com/models/vehicles/sports-car/" target="_blank" rel="noreferrer">3D avtomobil: Grab3D · CC0</a></footer>
    </section>
    <div className="landing-map-panel"><BakuDrive /></div>
  </main>;
}
