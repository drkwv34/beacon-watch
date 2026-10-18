import { TargetForm } from '../../../../../components/target-form';

export default function NewTargetPage() {
  return (
    <>
      <h1>Add a monitor</h1>
      <p>
        <a href="/dashboard">Back to monitors</a>
      </p>
      <TargetForm mode="create" />
    </>
  );
}
