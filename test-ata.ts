import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createPayUsdcTransaction } from "./packages/sdk/src/transactions";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const customer = Keypair.generate().publicKey;
  const merchant = Keypair.generate().publicKey;
  
  const { transaction } = await createPayUsdcTransaction({
    customer,
    merchant,
    amountUsdc: 10,
    paymentId: "123e4567-e89b-12d3-a456-426614174000",
    connection,
  });

  console.log("Transaction instructions:", transaction.instructions.length);
  for (const ix of transaction.instructions) {
    console.log("Program ID:", ix.programId.toBase58());
  }
}

main().catch(console.error);
