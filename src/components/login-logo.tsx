"use client";

import Image from "next/image";

export function LoginLogo() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative p-4 rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-white/10 shadow-xl">
        <Image
          src="/logopepweb.png"
          alt="Credipep Logo"
          width={200}
          height={200}
          priority
          className="object-contain"
        />
      </div>
    </div>
  );
}
