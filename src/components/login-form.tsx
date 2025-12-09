"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/env";
import { persistAuth, clearRememberedEmail, getRememberedEmail, storeRememberedEmail } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedEmail = getRememberedEmail();
    if (storedEmail) {
      setEmail(storedEmail);
      setRemember(true);
    } else {
      setRemember(false);
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      toast({
        title: "Credenciales incompletas",
        description: "Por favor ingresa tu correo y contraseña.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password, remember }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message =
          errorPayload?.errors?.email?.[0] ||
          errorPayload?.errors?.password?.[0] ||
          errorPayload?.message ||
          "Credenciales inválidas.";
        toast({
          title: "No podemos iniciar sesión",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const payload: { token: string; user: AuthUser } = await response.json();
      persistAuth(payload.token, payload.user, { remember });

      const normalizedEmail = email.trim();
      if (remember && normalizedEmail) {
        storeRememberedEmail(normalizedEmail);
      } else {
        clearRememberedEmail();
      }

      toast({
        title: "Bienvenido",
        description: "Acceso concedido.",
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Error iniciando sesión", error);
      toast({
        title: "Error inesperado",
        description: "Intenta nuevamente en unos minutos.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-semibold">Panel Administrativo DSF</CardTitle>
        <CardDescription>
          Inicia sesión para acceder al panel de gestión.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-6">
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="ejemplo@dsf.cr"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(value) => {
                  const isChecked = value === true;
                  setRemember(isChecked);
                  if (!isChecked) {
                    clearRememberedEmail();
                  } else if (email.trim()) {
                    storeRememberedEmail(email.trim());
                  }
                }}
                disabled={isSubmitting}
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                Recordarme
              </Label>
            </div>
            <Button variant="link" type="button" className="px-0 text-sm" disabled={isSubmitting} onClick={() => toast({
                title: "Funcionalidad en desarrollo",
                description: "Contacta a soporte para recuperar tu contraseña.",
              })}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            Al ingresar aceptas los términos de confidencialidad de DSF.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
