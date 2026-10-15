import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "@/components/listing-form";
export default function NewListingPage(){return <div className="mx-auto max-w-[720px]"><Link href="/marketplace" className="button-ghost mb-4"><ArrowLeft size={17}/>Elanlara qayıt</Link><div className="card p-5 sm:p-8"><p className="eyebrow mb-1">MARKETPLACE</p><h1 className="section-title mb-6">Yeni elan</h1><ListingForm/></div></div>}
