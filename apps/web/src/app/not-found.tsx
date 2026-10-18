import { StatePanel } from '../components/state-panel';

export default function NotFound() {
  return (
    <main id="main" className="container">
      <StatePanel title="Not found" body="This page does not exist." action={<a href="/">Go home</a>} />
    </main>
  );
}
