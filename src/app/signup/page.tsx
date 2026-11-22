import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Page } from "@/components/Shell";

export default function SignupPage() {
  return (
    <Page nav={false}>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </Page>
  );
}
