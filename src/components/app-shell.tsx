"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, CarFront, House, LogOut, MessageCircle, Search, Settings, Shield, ShoppingBag, UsersRound } from "lucide-react";
import { post } from "@/lib/client/api";
import { MeResponse, useResource } from "@/lib/client/hooks";
import { Avatar, LoadingCards } from "./ui";
import { toast } from "sonner";

export const mainNav = [
  { href:"/feed", label:"Ana səhifə", icon:House },
  { href:"/clubs", label:"Klublar", icon:UsersRound },
  { href:"/garage", label:"Qarajım", icon:CarFront },
  { href:"/marketplace", label:"Marketplace", icon:ShoppingBag },
  { href:"/events", label:"Tədbirlər", icon:CalendarDays },
  { href:"/messages", label:"Mesajlar", icon:MessageCircle },
  { href:"/notifications", label:"Bildirişlər", icon:Bell },
];
const mobileNav = [mainNav[0],mainNav[1],mainNav[2],mainNav[3],mainNav[5]];

export function Brand({ compact=false, href="/feed" }: { compact?:boolean; href?:string }) { return <Link href={href} className="inline-flex items-center gap-2 text-[23px] font-extrabold tracking-[-.025em] text-[#111318]" aria-label="avtoklub"><span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#ffcc00] text-[19px] font-black italic leading-none">a.</span>{!compact&&<span>avtoklub<span className="text-[#ffcc00]">.</span></span>}</Link>; }

export function AppShell({ children }: { children: ReactNode }) {
  const router=useRouter(), pathname=usePathname();
  const {data,loading,error,reload}=useResource<MeResponse>("/api/me");
  const user=data?.user;
  useEffect(()=>{if(!loading&&data&&!user)router.replace(`/login?next=${encodeURIComponent(pathname)}`)},[loading,data,user,router,pathname]);
  async function logout(){try{await post("/api/auth/logout",{});router.replace("/");router.refresh()}catch(e){toast.error(e instanceof Error?e.message:"Çıxış alınmadı")}}
  if(loading||(!data&&!error))return <div className="mx-auto max-w-[1100px] p-6"><LoadingCards/></div>;
  if(error)return <div className="mx-auto max-w-md p-10 text-center"><p>{error}</p><button className="button-primary mt-4" onClick={()=>void reload()}>Yenidən cəhd et</button></div>;
  if(!user)return null;
  return <div className="min-h-screen mobile-safe">
    <header className="sticky top-0 z-40 h-[70px] border-b border-[#e9eaed] bg-white/95 backdrop-blur-sm"><div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-9"><Brand/><Link href="/search" className="hidden h-10 w-full max-w-[420px] items-center gap-3 rounded-xl bg-[#f4f5f7] px-4 text-sm text-[#898f99] transition hover:bg-[#eceef1] md:flex"><Search size={18}/>İnsan, klub, paylaşım axtar</Link><div className="flex items-center gap-1 sm:gap-2"><Link href="/search" aria-label="Axtar" className="button-ghost md:hidden"><Search size={21}/></Link><Link href="/notifications" aria-label="Bildirişlər" className="button-ghost relative"><Bell size={20}/>{!!data?.counts?.notifications&&<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ffcc00]"/>}</Link><Link href="/messages" aria-label="Mesajlar" className="button-ghost hidden sm:inline-flex"><MessageCircle size={20}/></Link><Link href={`/profile/${user.id}`} className="ml-1"><Avatar name={user.name} src={user.avatarUrl} size={35}/></Link></div></div></header>
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-3 py-5 sm:px-6 xl:grid-cols-[235px_minmax(0,1fr)] xl:gap-7 xl:px-9">
      <aside className="hidden xl:block"><div className="sticky top-[90px]"><Link href={`/profile/${user.id}`} className="mb-5 flex items-center gap-3 rounded-xl p-2 hover:bg-white"><Avatar name={user.name} src={user.avatarUrl} size={43}/><span className="min-w-0"><b className="block truncate text-sm">{user.name}</b><span className="text-xs text-[#88909a]">@{user.handle}</span></span></Link><nav className="space-y-1" aria-label="Əsas naviqasiya">{mainNav.map(item=>{const Icon=item.icon, active=pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-[11px] text-sm font-semibold transition ${active?"bg-[#ffcc00] text-[#111318]":"text-[#515965] hover:bg-white"}`}><Icon size={19} strokeWidth={active?2.4:1.9}/>{item.label}</Link>})}</nav><div className="my-5 h-px bg-[#e1e4e8]"/><nav className="space-y-1"><Link href={`/profile/${user.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#515965] hover:bg-white"><Avatar name={user.name} src={user.avatarUrl} size={21}/>Profilim</Link><Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#515965] hover:bg-white"><Settings size={19}/>Tənzimləmələr</Link>{user.role==="admin"&&<Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#515965] hover:bg-white"><Shield size={19}/>İdarəetmə</Link>}<button onClick={()=>void logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#515965] hover:bg-white"><LogOut size={19}/>Çıxış</button></nav><p className="mt-7 px-3 text-xs leading-5 text-[#a0a5ad]">Sənin avtomobilin. Sənin klubun. Sənin çevrən.</p></div></aside>
      <main className="min-w-0">{children}</main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[69px] items-center justify-around border-t border-[#e7e9ec] bg-white px-1 pb-[env(safe-area-inset-bottom)] xl:hidden" aria-label="Mobil naviqasiya">{mobileNav.map(item=>{const Icon=item.icon, active=pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} className={`flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold ${active?"text-[#111318]":"text-[#8a929e]"}`}><span className={`flex h-7 w-11 items-center justify-center rounded-lg ${active?"bg-[#ffcc00]":""}`}><Icon size={20} strokeWidth={active?2.4:2}/></span>{item.label}</Link>})}</nav>
  </div>;
}


