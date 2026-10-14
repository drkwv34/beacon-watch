import { AuthForm } from '../../components/auth-form';

export default function LoginPage() {
  return (
    <>
      <h1>Sign in</h1>
      <AuthForm action="/api/v1/auth/login" submitLabel="Sign in" />
      <p>
        No account? <a href="/register">Create one</a>
      </p>
    </>
  );
}
