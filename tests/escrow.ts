
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { assert } from "chai";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.escrow as Program<Escrow>;

  const depositor = provider.wallet.publicKey;
  const recipient = anchor.web3.Keypair.generate();
  const attacker = anchor.web3.Keypair.generate();
  const wrongRecipient = anchor.web3.Keypair.generate();

  const amount = new anchor.BN(1_000_000);

  const [escrowPda] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        depositor.toBuffer(),
      ],
      program.programId
    );

  before(async () => {
    const signature = await provider.connection.requestAirdrop(
      recipient.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(
      signature,
      "confirmed"
    );
  });

  it("Initializes the escrow", async () => {
    await program.methods
      .initialize(amount, recipient.publicKey)
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.escrowState.fetch(escrowPda);

    assert.equal(
      escrow.depositor.toBase58(),
      depositor.toBase58()
    );

    assert.equal(
      escrow.recipient.toBase58(),
      recipient.publicKey.toBase58()
    );

    assert.equal(escrow.amount.toString(), amount.toString());
    assert.equal(escrow.funded, false);
  });

  it("Deposits SOL into escrow", async () => {
    await program.methods
      .deposit()
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.escrowState.fetch(escrowPda);

    assert.equal(escrow.funded, true);

    const balance = await provider.connection.getBalance(escrowPda);

    assert.isAtLeast(balance, amount.toNumber());
  });

  it("Releases SOL to the recipient", async () => {
    const balanceBefore = await provider.connection.getBalance(
      recipient.publicKey
    );

    await program.methods
      .release()
      .accounts({
        escrow: escrowPda,
        depositor,
        recipient: recipient.publicKey,
      })
      .rpc();

    const balanceAfter = await provider.connection.getBalance(
      recipient.publicKey
    );

    assert.equal(
      balanceAfter - balanceBefore,
      amount.toNumber()
    );

    const escrowAccount = await provider.connection.getAccountInfo(
      escrowPda
    );

    assert.equal(escrowAccount, null);
  });

  it("Refunds SOL to the depositor", async () => {
    await program.methods
      .initialize(amount, recipient.publicKey)
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .deposit()
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .refund()
      .accounts({
        escrow: escrowPda,
        depositor,
      })
      .rpc();

    const escrowAccount = await provider.connection.getAccountInfo(
      escrowPda
    );

    assert.equal(escrowAccount, null);
  });

  it("Rejects an escrow with a zero amount", async () => {
    let failed = false;

    try {
      await program.methods
        .initialize(new anchor.BN(0), recipient.publicKey)
        .accounts({
          escrow: escrowPda,
          depositor,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch {
      failed = true;
    }

    assert.isTrue(failed, "Zero-amount escrow should be rejected");
  });

  it("Creates a fresh escrow for security tests", async () => {
    await program.methods
      .initialize(amount, recipient.publicKey)
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("Deposits SOL for security tests", async () => {
    await program.methods
      .deposit()
      .accounts({
        escrow: escrowPda,
        depositor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("Rejects a second deposit", async () => {
    let failed = false;

    try {
      await program.methods
        .deposit()
        .accounts({
          escrow: escrowPda,
          depositor,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch {
      failed = true;
    }

    assert.isTrue(failed, "Duplicate deposit should be rejected");

    const escrow = await program.account.escrowState.fetch(escrowPda);

    assert.equal(escrow.funded, true);
  });

  it("Rejects an unauthorized release", async () => {
    let failed = false;

    try {
      await program.methods
        .release()
        .accounts({
          escrow: escrowPda,
          depositor: attacker.publicKey,
          recipient: recipient.publicKey,
        })
        .signers([attacker])
        .rpc();
    } catch {
      failed = true;
    }

    assert.isTrue(failed, "Unauthorized release should be rejected");
  });

  it("Rejects release to the wrong recipient", async () => {
    let failed = false;

    try {
      await program.methods
        .release()
        .accounts({
          escrow: escrowPda,
          depositor,
          recipient: wrongRecipient.publicKey,
        })
        .rpc();
    } catch {
      failed = true;
    }

    assert.isTrue(failed, "Wrong recipient should be rejected");

    const escrow = await program.account.escrowState.fetch(escrowPda);

    assert.equal(escrow.funded, true);
  });

  it("Allows the depositor to refund after failed attacks", async () => {
    await program.methods
      .refund()
      .accounts({
        escrow: escrowPda,
        depositor,
      })
      .rpc();

    const account = await provider.connection.getAccountInfo(escrowPda);

    assert.equal(account, null);
  });
});
