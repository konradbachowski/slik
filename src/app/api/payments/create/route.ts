import { type NextRequest } from "next/server";
import { createPayment } from "@/lib/codes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return Response.json(
        { error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    // Cap at a reasonable max to prevent abuse (10,000 USDC)
    if (amount > 10_000) {
      return Response.json(
        { error: "Amount exceeds maximum allowed (10,000 USDC)." },
        { status: 400 }
      );
    }

    const paymentId = await createPayment(amount);

    return Response.json({
      paymentId,
      status: "awaiting_code",
    });
  } catch (error) {
    console.error("[POST /api/payments/create]", error);
    return Response.json(
      { error: "Failed to create payment." },
      { status: 500 }
    );
  }
}
