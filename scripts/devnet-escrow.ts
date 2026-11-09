
const anchor = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");
const {
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");

async function main() {
  // Devnet configuration
  const rpcUrl = "https://api.devnet.solana.com";
  const walletPath = "/home/georgetsolos/.config/solana/id.json";
  const expectedWallet = "CqBhy4zRMyvHhXtKLHhmkqmPLEgZcQ3X1XpAbKY4HPw9";

  // Load the existing wallet locally. Never print its secret key.
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(secretKey)
  );

  if (walletKeypair.publicKey.toBase58() !== expectedWallet) {
    throw new Error("The loaded wallet does not match the expected wallet.");
  }

  const wallet = new anchor.Wallet(walletKeypair);
  const connection = new Connection(rpcUrl, "confirmed");

  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );

  anchor.setProvider(provider);

  // Load the generated IDL.
  const idlPath = path.join(__dirname, "../target/idl/escrow.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, provider);

  const programId = new PublicKey(idl.address);

  console.log("Escrow program:", programId.toBase58());
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Network: Devnet");

  const walletBalance = await connection.getBalance(wallet.publicKey);
  console.log(
    "Wallet balance:",
    (walletBalance / LAMPORTS_PER_SOL).toFixed(6),
    "SOL"
  );

  // Each test uses 0.01 SOL.
  const amount = new anchor.BN(10_000_000);

  // Your Rust program uses these PDA seeds:
  // [b"escrow", depositor.key().as_ref()]
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      wallet.publicKey.toBuffer(),
    ],
    programId
  );

  async function checkClosed() {
    const accountInfo = await connection.getAccountInfo(
      escrowPda,
      "confirmed"
    );

    if (accountInfo !== null) {
      throw new Error("Escrow account was not closed.");
    }

    console.log("Escrow account successfully closed.");
  }

  // --------------------------------------------------
  // TEST 1: INITIALIZE -> DEPOSIT -> RELEASE
  // --------------------------------------------------

  console.log("\n========== RELEASE TEST ==========");

  const recipient = Keypair.generate();

  console.log("Recipient:", recipient.publicKey.toBase58());
  console.log("Escrow PDA:", escrowPda.toBase58());

  const initializeSignature = await program.methods
    .initialize(amount, recipient.publicKey)
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Initialize transaction:", initializeSignature);

  const depositSignature = await program.methods
    .deposit()
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Deposit transaction:", depositSignature);

  const escrowBalance = await connection.getBalance(
    escrowPda,
    "confirmed"
  );

  console.log(
    "Escrow balance after deposit:",
    (escrowBalance / LAMPORTS_PER_SOL).toFixed(9),
    "SOL"
  );

  if (escrowBalance < amount.toNumber()) {
    throw new Error("Escrow balance is lower than the deposited amount.");
  }

  const recipientBalanceBefore = await connection.getBalance(
    recipient.publicKey,
    "confirmed"
  );

  const releaseSignature = await program.methods
    .release()
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
      recipient: recipient.publicKey,
    })
    .rpc();

  console.log("Release transaction:", releaseSignature);

  const recipientBalanceAfter = await connection.getBalance(
    recipient.publicKey,
    "confirmed"
  );

  const received = recipientBalanceAfter - recipientBalanceBefore;

  console.log(
    "Recipient received:",
    (received / LAMPORTS_PER_SOL).toFixed(9),
    "SOL"
  );

  if (received !== amount.toNumber()) {
    throw new Error("Recipient did not receive the expected amount.");
  }

  await checkClosed();

  console.log("RELEASE TEST PASSED!");

  // --------------------------------------------------
  // TEST 2: INITIALIZE -> DEPOSIT -> REFUND
  // --------------------------------------------------

  console.log("\n========== REFUND TEST ==========");

  const refundRecipient = Keypair.generate();

  const initializeRefundSignature = await program.methods
    .initialize(amount, refundRecipient.publicKey)
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Initialize transaction:", initializeRefundSignature);

  const depositRefundSignature = await program.methods
    .deposit()
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Deposit transaction:", depositRefundSignature);

  const refundSignature = await program.methods
    .refund()
    .accounts({
      escrow: escrowPda,
      depositor: wallet.publicKey,
    })
    .rpc();

  console.log("Refund transaction:", refundSignature);

  await checkClosed();

  console.log("REFUND TEST PASSED!");

  // --------------------------------------------------
  // SUMMARY
  // --------------------------------------------------

  const finalBalance = await connection.getBalance(wallet.publicKey);

  console.log("\n========== FINAL RESULTS ==========");
  console.log("Release: PASSED");
  console.log("Refund: PASSED");
  console.log("Both escrow accounts closed successfully.");
  console.log(
    "Final wallet balance:",
    (finalBalance / LAMPORTS_PER_SOL).toFixed(6),
    "SOL"
  );

  console.log("\nView transactions on Solana Explorer:");
  console.log(
    "https://explorer.solana.com/address/" +
      programId.toBase58() +
      "?cluster=devnet"
  );
}

main().catch((error) => {
  console.error("\nDEVNET TEST FAILED:");
  console.error(error);
  process.exitCode = 1;
});
