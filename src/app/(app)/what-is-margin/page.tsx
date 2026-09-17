export default function WhatIsMarginPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-3xl">What is Margin?</h1>
      <p className="mt-4 text-[17px] leading-7 text-muted-foreground">
        Margin is a persistent research-memory layer between your raw thinking and whichever
        reasoning model you use. Notes are inputs, not the end product.
      </p>

      <section className="mt-10">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          The three loops
        </h2>
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <Loop
            name="Think"
            body="Capture quick thoughts, voice-note output, handwritten pages, URLs, and structured imports. Preserve the raw source. Organization happens asynchronously."
          />
          <Loop
            name="Compound"
            body="Claims stay specific assertions. Insights are conclusions worth keeping. Frameworks are reusable mechanisms. Themes describe the world. Evidence, counterevidence, and typed connections explain why two pieces of thinking belong together."
          />
          <Loop
            name="Develop"
            body="Margin retrieves only the context that matters. Develop the idea here, or copy a context pack into ChatGPT or Claude. Useful outcomes return as insights, framework updates, evidence, questions, or a change in view."
          />
        </div>
      </section>

      <section className="mt-10 space-y-3 text-[17px] leading-7">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Compound, more precisely
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Claims remain specific assertions.</li>
          <li>Insights are specific, useful conclusions.</li>
          <li>Frameworks are reusable reasoning mechanisms.</li>
          <li>Themes describe what is happening in the world.</li>
          <li>Evidence and counterevidence strengthen, weaken, or bound a view.</li>
          <li>Connections explain why two pieces of thinking belong together. Similarity is not a connection.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3 text-[17px] leading-7">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Practical workflow
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Capture or import.</li>
          <li>Review Today.</li>
          <li>Resolve or defer Loose Ends and Inbox decisions.</li>
          <li>Inspect Insights/Frameworks and their provenance.</li>
          <li>Use Related Thinking or Discover only when Margin has a high-value connection.</li>
          <li>Develop an idea here, or copy a context pack externally.</li>
          <li>Save or import the useful result back into Margin.</li>
        </ol>
      </section>

      <section className="mt-10 space-y-3 text-[17px] leading-7">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Guardrails
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Blank is better than a weak connection.</li>
          <li>Margin distinguishes your prior thinking from AI suggestions.</li>
          <li>Every generated intellectual object retains provenance.</li>
        </ul>
      </section>
    </div>
  );
}

function Loop({ name, body }: { name: string; body: string }) {
  return (
    <div className="bg-background p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{name}</p>
      <p className="mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}
