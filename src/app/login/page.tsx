import { LoginForm } from "@/features/auth/login-form";
import { safeNextPath } from "@/lib/share";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-sans text-sm font-semibold tracking-[0.22em] uppercase">Margin</p>
      <h1 className="mt-6 font-serif text-3xl leading-tight">Capture first. Organize afterward.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Private investment-research memory. Create an account, then add a Gemini API key in Settings
        when you want AI processing. Raw notes always save.
      </p>
      <div className="mt-8">
        <LoginForm next={safeNextPath(params.next)} />
      </div>
    </div>
  );
}
