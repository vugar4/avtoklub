"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CarFront, Search, ShoppingBag, UsersRound } from "lucide-react";
import { Avatar, Empty, ErrorState, LoadingCards } from "@/components/ui";
import { Club, Event, Listing, Post, User } from "@/lib/client/api";
import { useResource } from "@/lib/client/hooks";

type Results = { people: User[]; clubs: Club[]; posts: Post[]; listings: Listing[]; events: Event[] };

function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") || "").trim();
  const [query, setQuery] = useState(q);
  const { data, loading, error, reload } = useResource<Results>(q.length >= 2 ? `/api/search?q=${encodeURIComponent(q)}` : null);
  function submit(e: FormEvent) { e.preventDefault(); router.push(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search"); }
  const total = data ? Object.values(data).reduce((sum, list) => sum + list.length, 0) : 0;
  return <div className="mx-auto max-w-[900px] space-y-5">
    <div><p className="eyebrow">Kəşf et</p><h1 className="section-title mt-1">Axtarış</h1><p className="mt-1 text-sm text-[#747b86]">İnsanları, klubları, paylaşımları, elanları və tədbirləri bir yerdə tap.</p></div>
    <form onSubmit={submit} className="card flex items-center gap-3 p-3"><Search className="ml-2 shrink-0 text-[#747b86]" size={20}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Məsələn, BMW E39" aria-label="Axtarış sorğusu" className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm outline-none"/><button type="submit" className="button-primary">Axtar</button></form>
    {q.length < 2 ? <Empty icon={<Search size={25}/>} title="Nə axtarırsan?" text="Avtomobil modeli, klub adı və ya maraqlandığın mövzu ilə başla."/> : loading ? <LoadingCards count={2}/> : error ? <ErrorState message={error} retry={()=>void reload()}/> : total === 0 ? <Empty icon={<Search size={25}/>} title="Nəticə tapılmadı" text="Başqa sözlə yenidən axtar."/> : <div className="space-y-5">
      {!!data?.people.length && <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><UsersRound size={18}/> İnsanlar</h2><div className="divide-y divide-[#eef0f2]">{data.people.map(person=><Link key={person.id} href={`/profile/${person.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-[#947900]"><Avatar name={person.name} src={person.avatarUrl}/><span><b className="block text-sm">{person.name}</b><small className="text-[#747b86]">@{person.handle}{person.location ? ` · ${person.location}` : ""}</small></span></Link>)}</div></section>}
      {!!data?.clubs.length && <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><UsersRound size={18}/> Klublar</h2><div className="grid gap-3 sm:grid-cols-2">{data.clubs.map(club=><Link key={club.id} href={`/clubs/${club.slug}`} className="overflow-hidden rounded-xl border border-[#e8e9ed] hover:border-[#d6b400]"><div className="h-24 bg-[#242830] bg-cover bg-center" style={{backgroundImage:club.coverUrl?`url(${club.coverUrl})`:undefined}}/><div className="p-3"><b className="block text-sm">{club.name}</b><small className="text-[#747b86]">{club.memberCount} üzv</small></div></Link>)}</div></section>}
      {!!data?.posts.length && <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><CarFront size={18}/> Paylaşımlar</h2><div className="divide-y divide-[#eef0f2]">{data.posts.map(item=><Link key={item.id} href={`/posts/${item.id}`} className="block py-3 first:pt-0 last:pb-0"><span className="text-xs font-semibold text-[#747b86]">{item.author.name} · {item.category}</span><p className="mt-1 line-clamp-2 text-sm">{item.body}</p></Link>)}</div></section>}
      {!!data?.listings.length && <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><ShoppingBag size={18}/> Elanlar</h2><div className="grid gap-3 sm:grid-cols-2">{data.listings.map(item=><Link key={item.id} href={`/marketplace/${item.id}`} className="flex overflow-hidden rounded-xl border border-[#e8e9ed] hover:border-[#d6b400]"><div className="w-24 shrink-0 bg-[#f2f3f5] bg-cover bg-center" style={{backgroundImage:item.imageUrls[0]?`url(${item.imageUrls[0]})`:undefined}}/><span className="p-3"><b className="line-clamp-2 block text-sm">{item.title}</b><small className="mt-1 block font-bold">{item.price.toLocaleString("az-AZ")} ₼</small></span></Link>)}</div></section>}
      {!!data?.events.length && <section className="card p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><CalendarDays size={18}/> Tədbirlər</h2><div className="divide-y divide-[#eef0f2]">{data.events.map(item=><Link key={item.id} href={`/events/${item.id}`} className="block py-3 first:pt-0 last:pb-0"><b className="block text-sm">{item.title}</b><small className="text-[#747b86]">{new Date(item.startsAt).toLocaleDateString("az-AZ")} · {item.location}</small></Link>)}</div></section>}
    </div>}
  </div>;
}

export default function SearchPage() { return <Suspense fallback={<LoadingCards count={2}/>}><SearchResults/></Suspense>; }
