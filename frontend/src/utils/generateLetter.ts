import type { TenderBidItem } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS } from "@/lib/domain";

function formatCurrencyWords(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function getWorkCategoryLabel(code: string): string {
  return WORK_CATEGORY_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

export function generateLoaRequestLetter(bid: TenderBidItem): string {
  const today = formatDate(new Date());
  const wcLabel = getWorkCategoryLabel(bid.workCategory);

  return `
<p style="text-align: right;"><strong>Date:</strong> ${today}</p>

<p><strong>To,</strong></p>
<p>The Managing Director / Chief Engineer,<br/>
<strong>${bid.client}</strong>,<br/>
${bid.state || "________"}.</p>

<p><strong>Subject:</strong> Request for Issuance of Letter of Acceptance (LOA) for the work of <strong>"${bid.nameOfWork}"</strong> under <strong>${wcLabel} (${bid.workCategory})</strong> category.</p>

<p><strong>Ref:</strong> Tender Notice / NIT No. ________</p>

<p>Respected Sir/Madam,</p>

<p>With reference to the above-mentioned subject, we are pleased to inform you that we, <strong>M/s Sankalp Infracon Pvt. Ltd.</strong>, have been declared as the successful bidder for the work titled:</p>

<blockquote style="margin: 16px 24px; padding: 12px 16px; border-left: 4px solid #0ea5e9; background: #f0f9ff;">
<strong>"${bid.nameOfWork}"</strong><br/>
Work Category: <strong>${wcLabel} (${bid.workCategory})</strong><br/>
Client: <strong>${bid.client}</strong><br/>
State: <strong>${bid.state || "________"}</strong>
</blockquote>

<p>We have duly submitted the Earnest Money Deposit (EMD) amounting to <strong>${formatCurrencyWords(bid.emd)}</strong> as per the tender requirements.</p>

<p>In view of the above, we hereby request you to kindly issue the <strong>Letter of Acceptance (LOA)</strong> at the earliest convenience so that we may proceed with the necessary formalities and commence the work within the stipulated time frame.</p>

<p>We assure you of our best services and look forward to your kind consideration.</p>

<p style="margin-top: 40px;">Thanking you,</p>

<p>Yours faithfully,<br/>
<strong>For M/s Sankalp Infracon Pvt. Ltd.</strong></p>

<p style="margin-top: 48px;">
<strong>Authorized Signatory</strong><br/>
Name: ________________________<br/>
Designation: ________________________<br/>
Contact: ________________________
</p>
`.trim();
}

export function generateEmdRefundLetter(bid: TenderBidItem): string {
  const today = formatDate(new Date());
  const wcLabel = getWorkCategoryLabel(bid.workCategory);

  return `
<p style="text-align: right;"><strong>Date:</strong> ${today}</p>

<p><strong>To,</strong></p>
<p>The Managing Director / Chief Engineer,<br/>
<strong>${bid.client}</strong>,<br/>
${bid.state || "________"}.</p>

<p><strong>Subject:</strong> Request for Refund of Earnest Money Deposit (EMD) for the work of <strong>"${bid.nameOfWork}"</strong> under <strong>${wcLabel} (${bid.workCategory})</strong> category.</p>

<p><strong>Ref:</strong> Tender Notice / NIT No. ________</p>

<p>Respected Sir/Madam,</p>

<p>With reference to the above-mentioned subject, we had participated in the tender for the following work:</p>

<blockquote style="margin: 16px 24px; padding: 12px 16px; border-left: 4px solid #f59e0b; background: #fffbeb;">
<strong>"${bid.nameOfWork}"</strong><br/>
Work Category: <strong>${wcLabel} (${bid.workCategory})</strong><br/>
Client: <strong>${bid.client}</strong><br/>
State: <strong>${bid.state || "________"}</strong>
</blockquote>

<p>We had submitted an Earnest Money Deposit (EMD) amounting to <strong>${formatCurrencyWords(bid.emd)}</strong> as part of the tender submission requirements.</p>

<p>As per the tender evaluation, the work has <strong>not been allotted</strong> to our firm. In view of the same, we hereby request you to kindly process the refund of the EMD amount of <strong>${formatCurrencyWords(bid.emd)}</strong> at the earliest.</p>

<p>The refund may kindly be credited to the following bank account:</p>

<table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
  <tr>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f9fafb; font-weight: bold; width: 200px;">Bank Name</td>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px;">________________________</td>
  </tr>
  <tr>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f9fafb; font-weight: bold;">Account Number</td>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px;">________________________</td>
  </tr>
  <tr>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f9fafb; font-weight: bold;">IFSC Code</td>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px;">________________________</td>
  </tr>
  <tr>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px; background: #f9fafb; font-weight: bold;">Account Holder Name</td>
    <td style="border: 1px solid #d1d5db; padding: 8px 12px;">M/s Sankalp Infracon Pvt. Ltd.</td>
  </tr>
</table>

<p>We request your kind cooperation in processing the refund at the earliest.</p>

<p style="margin-top: 40px;">Thanking you,</p>

<p>Yours faithfully,<br/>
<strong>For M/s Sankalp Infracon Pvt. Ltd.</strong></p>

<p style="margin-top: 48px;">
<strong>Authorized Signatory</strong><br/>
Name: ________________________<br/>
Designation: ________________________<br/>
Contact: ________________________
</p>
`.trim();
}

export function generateLetterHtml(bid: TenderBidItem): string {
  if (bid.status === "ALLOTTED") {
    return generateLoaRequestLetter(bid);
  }
  return generateEmdRefundLetter(bid);
}

export function getLetterFilename(bid: TenderBidItem): string {
  const sanitized = bid.nameOfWork.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 50);
  if (bid.status === "ALLOTTED") {
    return `LOA_Request_${sanitized}.pdf`;
  }
  return `EMD_Refund_${sanitized}.pdf`;
}
