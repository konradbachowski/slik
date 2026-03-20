import { type NextRequest } from "next/server";
import {
  resolveCode,
  getPayment,
  updatePayment,
  linkCodeToPayment,
} from "@/lib/codes";
import { createReference, pollForPayment } from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, code } = body;

    if (!paymentId || typeof paymentId !== "string") {
      return Response.json(
        { error: "Missing or invalid paymentId." },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return Response.json(
        { error: "Invalid code. Must be a 6-digit number." },
        { status: 400 }
      );
    }

    // Look up the code
    const codeData = await resolveCode(code);
    if (!codeData) {
      return Response.json(
        { error: "Code not found or expired." },
        { status: 404 }
      );
    }

    // Look up the payment
    const payment = await getPayment(paymentId);
    if (!payment) {
      return Response.json(
        { error: "Payment not found or expired." },
        { status: 404 }
      );
    }

    if (payment.status !== "awaiting_code") {
      return Response.json(
        {
          error: `Payment cannot be linked. Current status: ${payment.status}`,
        },
        { status: 409 }
      );
    }

    // Generate a reference keypair for on-chain tracking
    const referenceKeypair = await createReference(paymentId);

    // Link the code to the payment
    await linkCodeToPayment(code, paymentId);

    // Update payment with linked data
    await updatePayment(paymentId, {
      status: "linked",
      code,
      walletPubkey: codeData.walletPubkey,
      reference: referenceKeypair.publicKey.toBase58(),
    });

    // Start polling for on-chain confirmation in the background
    pollForPayment(referenceKeypair.publicKey, paymentId).catch((err) => {
      console.error(`[pollForPayment] Background error for ${paymentId}:`, err);
    });

    return Response.json({
      matched: true,
      amount: payment.amount,
      walletPubkey: codeData.walletPubkey,
      reference: referenceKeypair.publicKey.toBase58(),
    });
  } catch (error) {
    console.error("[POST /api/payments/link]", error);
    return Response.json(
      { error: "Failed to link payment." },
      { status: 500 }
    );
  }
}
