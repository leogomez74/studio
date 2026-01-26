import { LoginForm } from "@/components/login-form";
import { LoginLogo } from "@/components/login-logo";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
          <section className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-8 lg:mb-12">
              <LoginLogo />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Administración segura para el equipo CREDIPEP
            </h1>
            <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
              Centraliza Clientes, Creditos y operaciones internas desde un
              punto único de control. Inicia sesión para continuar con tu
              trabajo diario.
            </p>
            <dl className="mt-10 grid w-full gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-left sm:grid-cols-3">
              <div>
                <dt className="text-sm text-white/60">Casos gestionados</dt>
                <dd className="text-2xl font-semibold text-white">+1.2k</dd>
              </div>
              <div>
                <dt className="text-sm text-white/60">Voluntarios activos</dt>
                <dd className="text-2xl font-semibold text-white">87</dd>
              </div>
              <div>
                <dt className="text-sm text-white/60">Tiempo promedio de respuesta</dt>
                <dd className="text-2xl font-semibold text-white">&lt; 4h</dd>
              </div>
            </dl>
          </section>

          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
