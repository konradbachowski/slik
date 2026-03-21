import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { buildPayInstruction, buildPayUsdcInstruction } from "./instructions";
import { PROGRAM_ID } from "./constants";

export async function createPayTransaction(config: {
  customer: PublicKey;
  merchant: PublicKey;
  amountSol: number;
  paymentId: string;
  connection: Connection;
  programId?: PublicKey;
}): Promise<{ transaction: Transaction; receiptPda: PublicKey }> {
  const {
    customer,
    merchant,
    amountSol,
    paymentId,
    connection,
    programId = PROGRAM_ID,
  } = config;

  const { instruction, receiptPda } = buildPayInstruction({
    customer,
    merchant,
    amountSol,
    paymentId,
    programId,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: customer,
  });

  transaction.add(instruction);

  return { transaction, receiptPda };
}

export async function createPayUsdcTransaction(config: {
  customer: PublicKey;
  merchant: PublicKey;
  amountUsdc: number;
  paymentId: string;
  connection: Connection;
  programId?: PublicKey;
}): Promise<{ transaction: Transaction; receiptPda: PublicKey }> {
  const {
    customer,
    merchant,
    amountUsdc,
    paymentId,
    connection,
    programId = PROGRAM_ID,
  } = config;

  const { instruction, receiptPda } = buildPayUsdcInstruction({
    customer,
    merchant,
    amountUsdc,
    paymentId,
    programId,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: customer,
  });

  transaction.add(instruction);

  return { transaction, receiptPda };
}
