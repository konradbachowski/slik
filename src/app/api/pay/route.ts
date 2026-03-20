import { type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getPayment, updatePayment } from "@/lib/codes";
import { createPaymentTransaction, createReference } from "@/lib/payment";

/**
 * Solana Pay Transaction Request - GET
 *
 * Returns the label and icon for the payment request
 * as per the Solana Pay spec.
 */
export async function GET() {
  return Response.json({
    label: "SolanaBLIK",
    icon: "/icon.png",
  });
}

/**
 * Solana Pay Transaction Request - POST
 *
 * Receives the wallet account from the Solana Pay client,
 * builds a USDC transfer transaction, and returns it serialized.
 *
 * Query params:
 *   - paymentId: the payment UUID to fulfill
 */
export async function POST(request: NextRequest) {
  try {
    const paymentId = request.nextUrl.searchParams.get("paymentId");

    if (!paymentId) {
      return Response.json(
        { error: "Missing paymentId query parameter." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { account } = body;

    if (!account || typeof account !== "string") {
      return Response.json(
        { error: "Missing or invalid account in request body." },
        { status: 400 }
      );
    }

    // Validate account is a valid public key
    let senderPubkey: PublicKey;
    try {
      senderPubkey = new PublicKey(account);
    } catch {
      return Response.json(
        { error: "Invalid Solana public key." },
        { status: 400 }
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

    if (payment.status !== "linked") {
      return Response.json(
        {
          error: `Payment is not ready for transaction. Current status: ${payment.status}`,
        },
        { status: 409 }
      );
    }

    // Use the existing reference if one was already generated during linking,
    // otherwise create a new one
    let referencePubkey: PublicKey;
    if (payment.reference) {
      referencePubkey = new PublicKey(payment.reference);
    } else {
      const refKeypair = await createReference(paymentId);
      referencePubkey = refKeypair.publicKey;
      await updatePayment(paymentId, {
        reference: referencePubkey.toBase58(),
      });
    }

    // Build the transaction
    const transaction = await createPaymentTransaction(
      senderPubkey,
      payment.amount,
      referencePubkey
    );

    // Serialize the transaction (no signatures yet, wallet will sign)
    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return Response.json({
      transaction: serialized,
      message: `Pay ${payment.amount} USDC via SolanaBLIK`,
    });
  } catch (error) {
    console.error("[POST /api/pay]", error);
    return Response.json(
      { error: "Failed to create payment transaction." },
      { status: 500 }
    );
  }
}
