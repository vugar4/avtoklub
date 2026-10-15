"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CarFront, CalendarDays, Fuel, Gauge, Plus, Settings2, Trash2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { del, formatDate, post, User, Vehicle } from "@/lib/client/api";
import { MeResponse, useResource } from "@/lib/client/hooks";
import { Avatar, Empty, ErrorState, ImageUpload, LoadingCards } from "@/components/ui";
import { Button, Dialog, Input } from "@/components/primitives";

type Update = { id: string; title: string; body: string; imageUrls: string[]; createdAt: string };
type VehicleDetail = Vehicle & { owner: User; updates: Update[]; followers: number; following: boolean };

export default function VehiclePage() {
  const id = String(useParams().id);
  const { data, loading, error, reload } = useResource<VehicleDetail>(`/api/vehicles/${id}`);
  const { data: me } = useResource<MeResponse>("/api/me");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const isOwner = Boolean(data && me?.user?.id === data.userId);

  async function follow() {
    setBusy(true);
    try { await post(`/api/vehicles/${id}/follow`, {}); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "İzləmə alınmadı"); }
    finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true);
    try {
      await post(`/api/vehicles/${id}/updates`, { title, body, imageUrls });
      setTitle(""); setBody(""); setImageUrls([]); setOpen(false);
      toast.success("Qeyd jurnala əlavə edildi"); await reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Qeyd əlavə edilmədi"); }
    finally { setBusy(false); }
  }
  async function remove(updateId: string) {
    if (!confirm("Bu jurnal qeydini silmək istəyirsən?")) return;
    try { await del(`/api/vehicles/${id}/updates/${updateId}`); toast.success("Qeyd silindi"); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Qeyd silinmədi"); }
  }

  return <div className="mx-auto max-w-[1040px] space-y-5">
    <Link href="/garage" className="inline-flex items-center gap-2 text-sm font-semibold text-[#69717c] hover:text-[#181a1f]"><ArrowLeft size={17}/>Qaraj</Link>
    {loading ? <LoadingCards count={2}/> : error ? <ErrorState message={error} retry={() => void reload()}/> : data && <>
      <div className="card overflow-hidden">
        <div className={`relative bg-[#1b1f25] ${data.imageUrls[0] ? "h-64 sm:h-[380px]" : "h-48 sm:h-56"}`}>
          {data.imageUrls[0] ? <img src={data.imageUrls[0]} alt={`${data.brand} ${data.model}`} className="h-full w-full object-cover"/> : <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60"><CarFront size={48} strokeWidth={1.3}/><span className="text-sm">Avtomobil şəkli əlavə edilməyib</span></div>}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent"/>
          <span className="absolute bottom-5 left-5 rounded-md bg-[#ffcc00] px-3 py-1 text-xs font-extrabold text-[#181a1f] sm:left-7">{data.brand}</span>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow mb-1">AVTOMOBİL PROFİLİ</p><h1 className="text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">{data.brand} {data.model}</h1><p className="mt-2 text-sm text-[#7d8590]">{data.year} · {data.color || "Rəng qeyd edilməyib"}</p></div>{!isOwner && <Button disabled={busy} variant={data.following ? "secondary" : "primary"} onClick={() => void follow()}><UserRoundPlus size={17}/>{data.following ? "İzləyirsən" : "Avtomobili izlə"}</Button>}</div>
          <Link href={`/profile/${data.owner.id}`} className="mt-6 inline-flex items-center gap-3 rounded-xl border border-[#e8e9ed] px-3 py-2.5 hover:border-[#c7cbd0]"><Avatar name={data.owner.name} src={data.owner.avatarUrl} size={36}/><span><span className="block text-xs text-[#858d98]">Sahibi</span><span className="text-sm font-bold">{data.owner.name}</span></span></Link>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#e8e9ed] pt-6 text-sm sm:grid-cols-4"><span className="flex items-center gap-2"><CalendarDays size={17}/>{data.year}</span><span className="flex items-center gap-2"><Fuel size={17}/>{data.fuel || "—"}</span><span className="flex items-center gap-2"><Settings2 size={17}/>{data.transmission || "—"}</span><span className="flex items-center gap-2"><Gauge size={17}/>{data.mileage != null ? `${data.mileage.toLocaleString("az-AZ")} km` : "Yürüş qeyd edilməyib"}</span></div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5"><section className="card p-5 sm:p-6"><h2 className="text-lg font-bold">Avtomobilin hekayəsi</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#59616b]">{data.description || "Sahibi hələ avtomobilin hekayəsini yazmayıb."}</p></section><section><div className="mb-4 flex items-center justify-between gap-3"><div><p className="eyebrow">YOL BOYU</p><h2 className="section-title">Build jurnalı</h2></div>{isOwner && <Button onClick={() => setOpen(true)}><Plus size={17}/>Qeyd əlavə et</Button>}</div>{data.updates.length ? <div className="space-y-4">{data.updates.map(update => <article key={update.id} className="card p-5 sm:p-6"><div className="flex justify-between gap-3"><div><p className="text-xs text-[#8b929c]">{formatDate(update.createdAt)}</p><h3 className="mt-1 text-lg font-bold">{update.title}</h3></div>{isOwner && <button className="button-ghost self-start" aria-label="Qeydi sil" onClick={() => void remove(update.id)}><Trash2 size={17}/></button>}</div>{update.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#626a75]">{update.body}</p>}{update.imageUrls.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{update.imageUrls.map(url => <img key={url} src={url} alt={`${update.title} şəkli`} className="max-h-72 w-full rounded-xl object-cover"/>)}</div>}</article>)}</div> : <Empty icon={<CarFront size={28}/>} title="Jurnalda hələ qeyd yoxdur" text={isOwner ? "İlk baxım, dəyişiklik və ya yol hekayəni əlavə et." : "Sahibi hələ bu avtomobil haqqında yenilik paylaşmayıb."}/>}</section></div>
        <aside className="space-y-4"><div className="card p-5"><p className="eyebrow">QARAJ BİLGİLƏRİ</p><p className="mt-3 text-sm text-[#626a75]">{data.followers} izləyici · {data.updates.length} jurnal qeydi</p>{data.engine && <p className="mt-3 text-sm"><span className="text-[#8b929c]">Mühərrik:</span> {data.engine}</p>}{isOwner && <Link href="/garage" className="button-secondary mt-4 w-full">Qarajda düzəlt</Link>}</div>{data.modifications.length > 0 && <div className="card p-5"><h2 className="text-sm font-bold">Dəyişikliklər</h2><div className="mt-3 flex flex-wrap gap-2">{data.modifications.map(x => <span key={x} className="rounded-md bg-[#f2f3f5] px-2.5 py-1.5 text-xs text-[#555d67]">{x}</span>)}</div></div>}</aside>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title="Build jurnalına qeyd əlavə et"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void publish(); }}><label className="block"><span className="label">Başlıq *</span><Input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Məsələn, yeni təkər dəsti"/></label><label className="block"><span className="label">Hekayə</span><textarea className="field" maxLength={3000} value={body} onChange={e => setBody(e.target.value)} placeholder="Nə dəyişdi? Sürüşdə fərq hiss olunur?"/></label><ImageUpload value={imageUrls} onChange={setImageUrls}/><div className="flex justify-end"><Button type="submit" disabled={busy || (!body.trim() && imageUrls.length === 0)}>{busy ? "Yayımlanır..." : "Qeydi yayımla"}</Button></div></form></Dialog>
    </>}
  </div>;
}
