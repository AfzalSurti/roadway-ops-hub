import type { TenderBidItem } from "@/lib/domain";
import { WORK_CATEGORY_OPTIONS } from "@/lib/domain";

function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateLong(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateField(val?: string | null): string {
  if (!val) return "________";
  return fmtDate(new Date(val));
}

function getWorkCategoryLabel(code: string): string {
  return WORK_CATEGORY_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

function formatBidderSignatory(name: string): string {
  const trimmed = name.trim() || "Geo Designs & Research (P) Ltd.";
  if (/^m\/?s\.?\s/i.test(trimmed)) return trimmed.endsWith(",") ? trimmed : `${trimmed},`;
  return `M/s. ${trimmed.replace(/,?$/, "")},`;
}

/** Closing block: empty stamp space (no digital stamp image) + signatory + office footer */
function letterClosing(bidderName: string): string {
  const company = formatBidderSignatory(bidderName);
  return `
<p>Thanking you and assuring you of our best services,</p>

<p>Yours faithfully,</p>

<p style="margin-bottom: 0;"><strong>${company}</strong></p>

<!-- Blank area for physical company stamp / seal -->
<div style="height: 140px; min-height: 140px;"></div>

<p style="margin-top: 0;"><strong>Authorized Signatory</strong></p>

<p>If any query, please Contact to this number 91+ 9265322086</p>

<p style="font-size: 11px; line-height: 1.5; margin-top: 28px;">
<strong>Registered Office: GEO DESIGNS &amp; RESEARCH (P) LTD.</strong><br/>
B-10, Krishna Industrial Estate, Opp. B.I.D.C. Gorwa, Vadodara - 390 016.<br/>
Gujarat, India. Tel: +91 82380 98214 and +91 97126 16960.<br/>
E-mail: <a href="mailto:tender@geogroup.in">tender@geogroup.in</a>, <a href="mailto:info@geogroup.in">info@geogroup.in</a>
</p>
`.trim();
}

function formatToBlock(authority: string, address?: string | null): string {
  const lines = [authority || "________"];
  if (address?.trim()) lines.push(address.trim());
  return lines.join("<br/>");
}

export function generateEmdRefundLetter(bid: TenderBidItem): string {
  const today = fmtDate(new Date());
  const bidderName = bid.nameOfBidder || "M/s Sankalp Infracon Pvt. Ltd.";
  const authority = bid.bidInvitingAuthority || "________";
  const tenderId = bid.tenderId || "________";

  return `
<p><strong>Ref. No.:</strong> GDR/EMD/REFUND/TENDER/____
<span style="float:right;"><strong>Date:</strong> ${today}</span></p>

<p><strong>To,</strong><br/>
${formatToBlock(authority, bid.bidInvitingAuthorityAddress)}</p>

<p><strong>Tender No. :</strong> ${tenderId}</p>

<p><strong>Ref:</strong> ________</p>

<p><u><strong>Subject: Request for Release of Our Earnest Money Deposit.</strong></u></p>

<p><strong>Name Of Work:</strong> "${bid.nameOfWork}" in the state of ${bid.state || "________"}.</p>

<p>Dear Sir,</p>

<p>We, <strong>${bidderName},</strong> ${bid.state || "________"}, participated above mentioned Work, now this Tender was Allotted to our Firm, and we had submitted Security Deposit (SD). So, we are requesting to Authority Kindly release Our EMD Amount as soon as possible.</p>

<p><strong>Tender EMD Remittance Details:</strong></p>

<table style="border-collapse: collapse; margin: 16px 0;">
  <tr>
    <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">EMD Amount</td>
    <td style="border: 1px solid #000; padding: 6px 12px;">Rs. ${bid.emd ? new Intl.NumberFormat("en-IN").format(bid.emd) : "________"}/-</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">EMD Details</td>
    <td style="border: 1px solid #000; padding: 6px 12px;">
      <strong>${bid.emdType || "________"} No:</strong> ${bid.emdNumber || "________"}<br/>
      <strong>Date.:</strong>${fmtDateField(bid.emdIssuedDate)}<br/>
      <strong>Valid Up to.:</strong> ${fmtDateField(bid.emdValidUpto)}<br/>
      <strong>Bank:</strong> ${bid.emdBank || "________"}
    </td>
  </tr>
</table>

${letterClosing(bidderName)}
`.trim();
}

export function generateLoaRequestLetter(bid: TenderBidItem): string {
  const today = fmtDate(new Date());
  const bidderName = bid.nameOfBidder || "M/s Sankalp Infracon Pvt. Ltd.";
  const authority = bid.bidInvitingAuthority || "________";
  const tenderId = bid.tenderId || "________";
  const wcLabel = getWorkCategoryLabel(bid.workCategory);

  return `
<p><strong>Ref. No.:</strong> ____
<span style="float:right;"><strong>Date:</strong> ${today}</span></p>

<p><strong>To,</strong><br/>
${formatToBlock(authority, bid.bidInvitingAuthorityAddress)}</p>

<p><strong>Tender No. :</strong> ${tenderId}</p>

<p><strong>Ref:</strong> ________</p>

<p><u><strong>Subject: Request for Issuance of Letter of Acceptance (LOA).</strong></u></p>

<p><strong>Name Of Work:</strong> "${bid.nameOfWork}" in the state of ${bid.state || "________"}.</p>

<p>Dear Sir,</p>

<p>With reference to the above-mentioned subject, we, <strong>${bidderName},</strong> have been declared as the successful bidder for the above mentioned work under <strong>${wcLabel} (${bid.workCategory})</strong> category.</p>

<p>We have duly submitted the Earnest Money Deposit (EMD) as per the tender requirements.</p>

<p><strong>Tender EMD Remittance Details:</strong></p>

<table style="border-collapse: collapse; margin: 16px 0;">
  <tr>
    <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">EMD Amount</td>
    <td style="border: 1px solid #000; padding: 6px 12px;">Rs. ${bid.emd ? new Intl.NumberFormat("en-IN").format(bid.emd) : "________"}/-</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">EMD Details</td>
    <td style="border: 1px solid #000; padding: 6px 12px;">
      <strong>${bid.emdType || "________"} No:</strong> ${bid.emdNumber || "________"}<br/>
      <strong>Date.:</strong>${fmtDateField(bid.emdIssuedDate)}<br/>
      <strong>Valid Up to.:</strong> ${fmtDateField(bid.emdValidUpto)}<br/>
      <strong>Bank:</strong> ${bid.emdBank || "________"}
    </td>
  </tr>
</table>

${letterClosing(bidderName)}
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
