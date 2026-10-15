"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Settings2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload, ErrorState, LoadingCards } from "@/components/ui";
import { Field, Textarea } from "@/components/ui";
import { patch, post, User } from "@/lib/client/api";
import { MeResponse, useResource } from "@/lib/client/hooks";

export default function SettingsPage() {
  const { data, loading, error, reload } = useResource<MeResponse>("/api/me");
  const [name, setName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string[] | null>(null);
  const [cover, setCover] = useState<string[] | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const user = data?.user;
  const profile = { name: name ?? user?.name ?? "", handle: handle ?? user?.handle ?? "", bio: bio ?? user?.bio ?? "", location: location ?? user?.location ?? "", avatar: avatar ?? (user?.avatarUrl ? [user.avatarUrl] : []), cover: cover ?? (user?.coverUrl ? [user.coverUrl] : []) };
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true);
    try { await patch<{user:User}>("/api/me", { name: profile.name, handle: profile.handle, bio: profile.bio, location: profile.location, avatarUrl: profile.avatar[0] || null, coverUrl: profile.cover[0] || null }); toast.success("Profil yeniləndi"); void reload(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Yadda saxlamaq alınmadı"); }
    finally { setSaving(false); }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault(); setChanging(true);
    try { await post("/api/auth/change-password", { oldPassword, newPassword }); setOldPassword(""); setNewPassword(""); toast.success("Parol dəyişdirildi"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Parol dəyişdirilmədi"); }
    finally { setChanging(false); }
  }
  return <div className="mx-auto max-w-[760px] space-y-5">
    <div><p className="eyebrow">Hesabın</p><h1 className="section-title mt-1">Tənzimləmələr</h1><p className="mt-1 text-sm text-[#747b86]">İcmada necə göründüyünü və giriş məlumatlarını idarə et.</p></div>
    {loading ? <LoadingCards count={2}/> : error ? <ErrorState message={error} retry={()=>void reload()}/> : <>
      <form onSubmit={save} className="card space-y-5 p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-bold"><UserRound size={20}/> Profil</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Ad və soyad" required minLength={2} maxLength={80} value={profile.name} onChange={e=>setName(e.target.value)}/><Field label="İstifadəçi adı" required minLength={3} maxLength={24} pattern="[a-z0-9_]+" value={profile.handle} onChange={e=>setHandle(e.target.value.toLowerCase())}/></div><Textarea label="Haqqımda" maxLength={500} value={profile.bio} onChange={e=>setBio(e.target.value)} placeholder="Avtomobillər və maraqların haqqında qısa yaz"/><Field label="Şəhər" maxLength={100} value={profile.location} onChange={e=>setLocation(e.target.value)} placeholder="Bakı"/><div className="grid gap-5 sm:grid-cols-2"><div><span className="label">Profil şəkli</span><ImageUpload value={profile.avatar} onChange={setAvatar} multiple={false}/></div><div><span className="label">Örtük şəkli</span><ImageUpload value={profile.cover} onChange={setCover} multiple={false}/></div></div><button className="button-primary" disabled={saving}>{saving ? "Yadda saxlanır..." : "Dəyişiklikləri saxla"}</button></form>
      <form onSubmit={changePassword} className="card space-y-4 p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-bold"><LockKeyhole size={20}/> Təhlükəsizlik</h2><p className="text-sm text-[#747b86]">Parolunu yeniləmək üçün hazırkı parolunu daxil et.</p><Field label="Hazırkı parol" type="password" required autoComplete="current-password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)}/><Field label="Yeni parol" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><button className="button-secondary" disabled={changing}>{changing ? "Dəyişdirilir..." : "Parolu dəyiş"}</button></form>
      <div className="card flex items-start gap-3 p-5 text-sm text-[#747b86]"><Settings2 size={20} className="mt-0.5 shrink-0"/><p>Profilin, qarajın və paylaşımların digər üzvlərə görünür. Avtomobilin qeydiyyat nömrəsini və VIN məlumatını əlavə etmə.</p></div>
    </>}
  </div>;
}
