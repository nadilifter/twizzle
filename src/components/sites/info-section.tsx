interface InfoSectionProps {
  organizationName: string;
}

export function InfoSection({ organizationName }: InfoSectionProps) {
  return (
    <section className="border-t bg-muted/30 py-16">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-2 font-semibold">Membership Includes</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Access to all registered programs</li>
              <li>• Facility and equipment access</li>
              <li>• Member communications and updates</li>
              <li>• Participation in club events</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-2 font-semibold">Financial Assistance</h3>
            <p className="text-sm text-muted-foreground">
              We believe in accessible athletics for all. Financial assistance may be available 
              for qualifying families. Contact us for more information about assistance options.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-2 font-semibold">Get Involved</h3>
            <p className="text-sm text-muted-foreground">
              {organizationName} runs on community support. Volunteer opportunities are available 
              for parents and members who want to contribute to our programs and events.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
