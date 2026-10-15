"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { Avatar, Empty, ErrorState, LoadingCards } from "@/components/ui";
import { useResource } from "@/lib/client/hooks";
import { post, relativeDate, User } from "@/lib/client/api";

type Notice = { id: string; type: string; text: string; href: string; read: boolean; createdAt: string; actor: User | null };

export default function NotificationsPage() {
  const { data, setData, loading, error, reload } = useResource<Notice[]>("/api/notifications");
  async function markRead(item: Notice) {
    if (item.read) return;
    try { await post(`/api/notifications/${item.id}/read`, {}); setData(current => current?.map(n => n.id === item.id ? { ...n, read: true } : n) || null); } catch { /* destination remains available */ }
  }
  return <div className="mx-auto max-w-[760px] space-y-5">
    <div><p className="eyebrow">Sənin çevrən</p><h1 className="section-title mt-1">Bildirişlər</h1><p className="mt-1 text-sm text-[#747b86]">Klublarından və paylaşımlarından yeniliklər.</p></div>
    {loading ? <LoadingCards count={2}/> : error ? <ErrorState message={error} retry={()=>void reload()}/> : !data?.length ? <Empty icon={<Bell size={26}/>} title="Hələ bildiriş yoxdur" text="Paylaşımlara və klublara qoşulduqca yeniliklər burada görünəcək."/> : <div className="card overflow-hidden divide-y divide-[#eef0f2]">{data.map(item=><Link key={item.id} href={item.href} onClick={()=>void markRead(item)} className={`flex items-center gap-3 px-4 py-4 transition hover:bg-[#fafbfc] sm:px-5 ${item.read ? "" : "bg-[#fffbee]"}`}><Avatar name={item.actor?.name || "Avtoklub"} src={item.actor?.avatarUrl} size={42}/><span className="min-w-0 flex-1"><span className="block text-sm leading-5">{item.text}</span><small className="mt-1 block text-[#8a919b]">{relativeDate(item.createdAt)}</small></span>{!item.read&&<span className="h-2 w-2 shrink-0 rounded-full bg-[#ffcc00]"/>}<ChevronRight size={17} className="shrink-0 text-[#9ca2aa]"/></Link>)}</div>}
  </div>;
}
