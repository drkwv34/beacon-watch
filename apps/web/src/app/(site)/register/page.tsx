import { AuthForm } from '../../../components/auth-form';

export default function RegisterPage() {
  return (
    <>
      <h1>Create an account</h1>
      <AuthForm action="/api/v1/auth/register" submitLabel="Register" />
      <p>
        Already registered? <a href="/login">Sign in</a>
      </p>
    </>
  );
}
