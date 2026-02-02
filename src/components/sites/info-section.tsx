interface InfoSectionProps {
  infoBox1Title?: string | null;
  infoBox1Content?: string | null;
  infoBox2Title?: string | null;
  infoBox2Content?: string | null;
  infoBox3Title?: string | null;
  infoBox3Content?: string | null;
}

// Helper to check if HTML content has actual text (not just empty tags)
function hasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  // Strip HTML tags and check if there's any text content
  const textContent = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return textContent.length > 0;
}

interface InfoBox {
  title: string;
  content: string;
}

export function InfoSection({ 
  infoBox1Title, 
  infoBox1Content, 
  infoBox2Title, 
  infoBox2Content, 
  infoBox3Title, 
  infoBox3Content 
}: InfoSectionProps) {
  // Build array of boxes that have content (both title AND content required)
  const boxes: InfoBox[] = [];
  
  if (infoBox1Title && hasContent(infoBox1Content)) {
    boxes.push({ title: infoBox1Title, content: infoBox1Content! });
  }
  if (infoBox2Title && hasContent(infoBox2Content)) {
    boxes.push({ title: infoBox2Title, content: infoBox2Content! });
  }
  if (infoBox3Title && hasContent(infoBox3Content)) {
    boxes.push({ title: infoBox3Title, content: infoBox3Content! });
  }

  // If no boxes have content, return null to collapse the section entirely
  if (boxes.length === 0) {
    return null;
  }

  // Determine grid columns based on number of boxes
  const gridClass = boxes.length === 3 
    ? "grid gap-8 md:grid-cols-3" 
    : boxes.length === 2 
      ? "grid gap-8 md:grid-cols-2" 
      : "flex justify-center";

  return (
    <section className="border-t bg-muted/30 py-16">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        <div className={gridClass}>
          {boxes.map((box, index) => (
            <div 
              key={index} 
              className={`rounded-lg border bg-card p-6 ${boxes.length === 1 ? "max-w-md w-full" : ""}`}
            >
              <h3 className="mb-2 font-semibold">{box.title}</h3>
              <div 
                className="prose prose-sm text-muted-foreground" 
                dangerouslySetInnerHTML={{ __html: box.content }} 
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
