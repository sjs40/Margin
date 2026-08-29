import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-sans text-sm font-semibold tracking-[0.22em] uppercase">Margin</p>
      <h1 className="mt-6 font-serif text-3xl leading-tight">Capture first. Organize afterward.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Private research memory for one analyst. Sign in to start capturing.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}
