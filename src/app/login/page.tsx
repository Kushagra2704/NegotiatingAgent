import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-sm text-airbnb-gray">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
