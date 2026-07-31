import { useCallback, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { LetterEditor } from "@/components/LetterEditor";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { generateLetterHtml, getLetterFilename } from "@/utils/generateLetter";
import { generatePdfFromElement } from "@/utils/generatePDF";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

export default function LetterPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bidId = searchParams.get("id");
  const letterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: bidsResponse } = useQuery({
    queryKey: ["tender-bids"],
    queryFn: () => api.getTenderBids({ page: 1, limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const bid = bidsResponse?.items.find((b) => b.id === bidId);

  const [letterHtml, setLetterHtml] = useState<string | null>(null);

  const initialContent = bid ? generateLetterHtml(bid) : "";

  if (bid && letterHtml === null) {
    setLetterHtml(initialContent);
  }

  const handleDownloadPdf = useCallback(async () => {
    if (!letterRef.current || !bid) return;
    setDownloading(true);
    try {
      await generatePdfFromElement(letterRef.current, getLetterFilename(bid));
      toast.success("PDF downloaded successfully");
    } catch (err) {
      toast.error("Failed to generate PDF");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }, [bid]);

  const handlePrint = useCallback(() => {
    if (!letterRef.current) return;
    const printContents = letterRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups for printing.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${bid ? getLetterFilename(bid).replace(".pdf", "") : "Letter"}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Times New Roman', Georgia, serif; font-size: 14px; line-height: 1.7; color: #111; }
            p { margin: 0 0 12px; }
            strong { font-weight: 700; }
            blockquote { margin: 16px 24px; padding: 12px 16px; border-left: 4px solid #0ea5e9; background: #f0f9ff; }
            table { border-collapse: collapse; width: 100%; }
            td { border: 1px solid #d1d5db; padding: 8px 12px; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }, [bid]);

  if (!bidId) {
    return (
      <PageWrapper>
        <div className="glass-panel p-10 text-center text-muted-foreground">
          No tender bid selected. <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </PageWrapper>
    );
  }

  if (!bid) {
    return (
      <PageWrapper>
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tender data...
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold inline-flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {bid.status === "ALLOTTED" ? "LOA Request Letter" : "EMD Refund Letter"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-md">
                {bid.nameOfWork}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={downloading}
              onClick={handleDownloadPdf}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        {/* A4 paper */}
        <div className="flex justify-center bg-secondary/30 rounded-xl p-4 sm:p-8 min-h-[80vh]">
          <div className="w-full max-w-[210mm] bg-white shadow-xl rounded-lg border border-border/30 overflow-hidden">
            {/* Editor toolbar rendered by LetterEditor */}
            <div ref={letterRef}>
              <LetterEditor
                content={initialContent}
                onUpdate={(html) => setLetterHtml(html)}
                editable
              />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
