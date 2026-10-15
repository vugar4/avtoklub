"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Post } from "@/lib/client/api";
import { MeResponse, useResource } from "@/lib/client/hooks";
import { ErrorState, LoadingCards } from "@/components/ui";
import { PostCard } from "@/components/post-card";
export default function PostPage(){const id=String(useParams().id);const {data,loading,error,reload}=useResource<Post>(`/api/posts/${id}`),{data:me}=useResource<MeResponse>("/api/me");return <div className="mx-auto max-w-[680px]"><Link href="/feed" className="button-ghost mb-4"><ArrowLeft size={18}/>Lentə qayıt</Link>{loading?<LoadingCards count={1}/>:error?<ErrorState message={error} retry={()=>void reload()}/>:data?<PostCard item={data} currentUserId={me?.user?.id} detail onChange={()=>void reload()}/>:null}</div>}
