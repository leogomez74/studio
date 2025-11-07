import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center justify-center p-2 h-16">
      <Image
        src="/logo-white.png"
        alt="Credipep Logo"
        width={140}
        height={40}
        priority
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}
