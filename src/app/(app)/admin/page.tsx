"use client";

import Link from "next/link";
import { Flag, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Empty, ErrorState, LoadingCards } from "@/components/ui";
import { post } from "@/lib/client/api";
import { useResource } from "@/lib/client/hooks";

type Report = { id: string; targetType: "post"|"listing"|"event"|"user"; targetId: string; reason: string; status: "open"|"resolved"|"dismissed"; reporterName: string; createdAt: string };
const label: Record<Report["targetType"], string> = { post:"Paylaşım", listing:"Elan", event:"Tədbir", user:"İstifadəçi" };
function destination(item: Report) { return item.targetType === "post" ? `/posts/${item.targetId}` : item.targetType === "listing" ? `/marketplace/${item.targetId}` : item.targetType === "event" ? `/events/${item.targetId}` : `/profile/${item.targetId}`; }

export default function AdminPage() {
  const { data, loading, error, reload } = useResource<Report[]>("/api/admin/reports");
  const open = data?.filter(item => item.status === "open") || [];
  const closed = data?.filter(item => item.status !== "open") || [];
  async function decide(item: Report, action: "dismiss"|"remove"|"suspend") {
    if (action !== "dismiss" && !window.confirm(action === "remove" ? "Bu məzmun silinsin?" : "Bu istifadəçinin hesabı məhdudlaşdırılsın?")) return;
    try { await post(`/api/admin/reports/${item.id}/action`, { action }); toast.success("Şikayət nəzərdən keçirildi"); void reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Əməliyyat alınmadı"); }
  }
  return <div className="mx-auto max-w-[900px] space-y-5">
    <div><p className="eyebrow">İcma təhlükəsizliyi</p><h1 className="section-title mt-1">İdarəetmə</h1><p className="mt-1 text-sm text-[#747b86]">Üzvlərdən gələn şikayətləri yoxla və qərar ver.</p></div>
    {loading ? <LoadingCards count={2}/> : error ? <ErrorState message={error} retry={()=>void reload()}/> : <>
      <section className="space-y-3"><h2 className="flex items-center gap-2 text-base font-bold"><Flag size={19}/> Baxılacaq şikayətlər <span className="rounded-full bg-[#ffcc00] px-2 py-0.5 text-xs">{open.length}</span></h2>{open.length === 0 ? <Empty icon={<ShieldCheck size={26}/>} title="Hazırda açıq şikayət yoxdur"/> : open.map(item=><article key={item.id} className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-[#f4f5f7] px-2.5 py-1 text-xs font-bold">{label[item.targetType]}</span><time className="text-xs text-[#8a919b]">{new Date(item.createdAt).toLocaleDateString("az-AZ")}</time></div><p className="mt-3 text-sm leading-6">{item.reason}</p><p className="mt-1 text-xs text-[#8a919b]">Şikayət edən: {item.reporterName}</p><div className="mt-4 flex flex-wrap items-center gap-2"><Link href={destination(item)} className="button-secondary">Məzmuna bax</Link><button className="button-secondary" onClick={()=>void decide(item,"dismiss")}>Əsassızdır</button>{item.targetType === "user" ? <button className="button-primary" onClick={()=>void decide(item,"suspend")}>Hesabı məhdudlaşdır</button> : <button className="button-primary" onClick={()=>void decide(item,"remove")}>Məzmunu sil</button>}</div></article>)}</section>
      {!!closed.length && <section className="space-y-3 pt-3"><h2 className="text-base font-bold">Baxılmış şikayətlər</h2><div className="card divide-y divide-[#eef0f2]">{closed.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>{label[item.targetType]} · {item.reason}</span><span className="text-xs font-semibold text-[#747b86]">{item.status === "resolved" ? "Həll edildi" : "Əsassız sayıldı"}</span></div>)}</div></section>}
    </>}
  </div>;
}
