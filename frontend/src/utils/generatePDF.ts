import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function generatePdfFromElement(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff"
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const ratio = pdfWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;

  let yOffset = 0;
  let remainingHeight = scaledHeight;

  while (remainingHeight > 0) {
    if (yOffset > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imgData,
      "PNG",
      0,
      -yOffset,
      pdfWidth,
      scaledHeight
    );

    yOffset += pdfHeight;
    remainingHeight -= pdfHeight;
  }

  pdf.save(filename);
}
