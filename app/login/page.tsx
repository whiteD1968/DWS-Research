import { getSearchParam, type PageSearchParams } from "@/lib/search-params";
import { signInWithPassword } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const error = await getSearchParam(searchParams, "error");
  const signedOut = await getSearchParam(searchParams, "signedOut");

  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">DWS Research</p>
        <h1 className="login-title">Sign in to continue.</h1>
        <p className="login-copy">
          Use the email and password configured for the private DWS Research workspace.
        </p>

        {signedOut ? <p className="notice notice-success">You have been signed out.</p> : null}
        {error ? (
          <p className="notice notice-error">
            {error === "missing" ? "Enter both email and password." : error}
          </p>
        ) : null}

        <form action={signInWithPassword} className="form-stack">
          <label className="field">
            <span>Email</span>
            <input name="email" required type="email" />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" required type="password" />
          </label>

          <button className="button button-primary" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
