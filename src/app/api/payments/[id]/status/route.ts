import { type NextRequest } from "next/server";
import { getPayment } from "@/lib/codes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return Response.json(
        { error: "Missing payment ID." },
        { status: 400 }
      );
    }

    const payment = await getPayment(id);

    if (!payment) {
      return Response.json(
        { error: "Payment not found or expired." },
        { status: 404 }
      );
    }

    return Response.json({
      status: payment.status,
      amount: payment.amount,
      ...(payment.code && { code: payment.code }),
      ...(payment.reference && { reference: payment.reference }),
    });
  } catch (error) {
    console.error("[GET /api/payments/[id]/status]", error);
    return Response.json(
      { error: "Failed to fetch payment status." },
      { status: 500 }
    );
  }
}
