import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/event-form";
export default function NewEventPage(){return <div className="mx-auto max-w-[720px]"><Link href="/events" className="button-ghost mb-4"><ArrowLeft size={17}/>Tədbirlərə qayıt</Link><div className="card p-5 sm:p-8"><p className="eyebrow mb-1">BİRLİKDƏ YOLDA</p><h1 className="section-title mb-6">Yeni tədbir</h1><EventForm/></div></div>}
