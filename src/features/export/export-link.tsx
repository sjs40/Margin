import { Button } from "@/components/ui/button";

export function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="min-h-11 md:h-8 md:min-h-8">
      <a href={href}>{label}</a>
    </Button>
  );
}
