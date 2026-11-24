"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap section center">
      <h1>Something went wrong</h1>
      <p className="muted">Please try again. If it keeps happening, let us know via the contact page.</p>
      <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
    </main>
  );
}
