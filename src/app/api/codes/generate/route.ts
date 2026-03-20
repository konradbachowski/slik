import { type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createPaymentCode } from "@/lib/codes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletPubkey } = body;

    if (!walletPubkey || typeof walletPubkey !== "string") {
      return Response.json(
        { error: "Missing or invalid walletPubkey." },
        { status: 400 }
      );
    }

    // Validate that it's a legit Solana public key
    try {
      new PublicKey(walletPubkey);
    } catch {
      return Response.json(
        { error: "Invalid Solana public key format." },
        { status: 400 }
      );
    }

    const code = await createPaymentCode(walletPubkey);

    return Response.json({
      code,
      expiresIn: 120,
    });
  } catch (error) {
    console.error("[POST /api/codes/generate]", error);
    return Response.json(
      { error: "Failed to generate code." },
      { status: 500 }
    );
  }
}
