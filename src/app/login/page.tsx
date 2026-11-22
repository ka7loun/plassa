import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Page } from "@/components/Shell";

export default function LoginPage() {
  return (
    <Page nav={false}>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </Page>
  );
}
