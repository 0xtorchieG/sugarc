/**
 * Send payer notification email after invoice funding (FE/BE-014).
 * Uses Resend if RESEND_API_KEY is set; otherwise logs payload in dev.
 */

export interface PayerEmailParams {
  to: string;
  invoiceNumber?: string;
  /** Onchain invoice ID — payer must include this in wire memo/reference */
  reference: string;
  amountUsdc: string;
  dueDate: string;
  /** Pay page URL for wire instructions and demo (e.g. https://app.example.com/pay/0) */
  payPageUrl?: string;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Sugarc <onboarding@resend.dev>";

export async function sendPayerNotificationEmail(params: PayerEmailParams): Promise<boolean> {
  const { to, invoiceNumber, reference, amountUsdc, dueDate, payPageUrl } = params;
  const subject = `Updated payment instructions for Invoice ${invoiceNumber ?? reference}`;
  const payLink = payPageUrl
    ? `\n\nPay here (wire instructions & payment): ${payPageUrl}\n`
    : "";
  const body = `
Your invoice has been factored. Please use the following payment instructions:

Invoice amount: ${amountUsdc} USDC
Due date: ${dueDate}

Payment reference (MUST include in wire memo/reference): ${reference}

Please send your bank wire to the account details at the link below. Include the payment reference above in the wire memo/reference field so we can match your payment to this invoice.
${payLink}
—
Sugarc Invoice Factoring
  `.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [to],
        subject,
        text: body,
      });
      if (error) {
        console.error("Resend send failed", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("sendPayerNotificationEmail", err);
      return false;
    }
  }

  console.log("[DEV] Payer email (no RESEND_API_KEY):", {
    to,
    subject,
    body: body.slice(0, 200) + "...",
  });
  return true;
}
