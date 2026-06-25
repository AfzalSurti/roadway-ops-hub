import { Linkedin } from "lucide-react";
import { OpsForgeLogo } from "@/components/OpsForgeLogo";
import { SITE } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 px-5">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 text-center">
        <OpsForgeLogo size={40} />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Portfolio demonstration · Generic product preview · No client data</p>
          <p className="text-sm">
            Built by{" "}
            <a
              href={SITE.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
            >
              {SITE.authorName}
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
