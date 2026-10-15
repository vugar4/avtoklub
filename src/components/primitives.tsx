"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?:"primary"|"secondary"|"ghost" }>(function Button({className,variant="primary",...props},ref){return <button ref={ref} className={clsx(variant==="primary"?"button-primary":variant==="secondary"?"button-secondary":"button-ghost",className)} {...props}/>});
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({className,...props},ref){return <input ref={ref} className={clsx("field",className)} {...props}/>});
export function Card({children,className}: {children:ReactNode;className?:string}){return <div className={clsx("card",className)}>{children}</div>}
export function Dialog({open,onOpenChange,title,children}: {open:boolean;onOpenChange:(open:boolean)=>void;title:string;children:ReactNode}){return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#111318]/60"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-[#e8e9ed] bg-white px-5 py-4"><DialogPrimitive.Title className="text-lg font-bold">{title}</DialogPrimitive.Title><DialogPrimitive.Close className="button-ghost !p-2" aria-label="Bağla"><X size={20}/></DialogPrimitive.Close></div><div className="p-5">{children}</div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>}
