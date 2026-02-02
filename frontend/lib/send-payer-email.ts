/**
 * Send payer notification email after invoice funding (FE/BE-014).
 * Uses Resend if RESEND_API_KEY is set; otherwise logs payload in dev.
 */

export interface PayerEmailParams {
  to: string;
  invoiceNumber?: string;
  reference: string; // intentId or refHash
  amountUsdc: string;
  dueDate: string;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Sugarc <onboarding@resend.dev>";

export async function sendPayerNotificationEmail(params: PayerEmailParams): Promise<boolean> {
  const { to, invoiceNumber, reference, amountUsdc, dueDate } = params;
  const subject = `Updated payment instructions for Invoice ${invoiceNumber ?? reference}`;
  const body = `
Your invoice has been factored. Please use the following payment instructions:

Invoice amount: ${amountUsdc} 
Due date: ${dueDate}

Payment reference (include in wire memo): ${reference}

New payment instructions:
Please send payment to the account details provided by your factor. Reference: ${reference}.

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
