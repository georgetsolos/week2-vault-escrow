
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { assert } from "chai";

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.vault as Program<Vault>;
  const owner = provider.wallet.publicKey;

  const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state"), owner.toBuffer()],
    program.programId
  );

  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), statePda.toBuffer()],
    program.programId
  );

  const amount = new anchor.BN(1_000_000);

  it("Initializes the vault", async () => {
    await program.methods
      .initialize()
      .accounts({
        state: statePda,
        vault: vaultPda,
        owner,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const state = await program.account.vaultState.fetch(statePda);

    assert.equal(state.owner.toBase58(), owner.toBase58());
  });

  it("Deposits SOL into the vault", async () => {
    await program.methods
      .deposit(amount)
      .accounts({
        state: statePda,
        vault: vaultPda,
        owner,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const balance = await provider.connection.getBalance(vaultPda);

    assert.equal(balance, amount.toNumber());
  });

  it("Withdraws SOL from the vault", async () => {
    await program.methods
      .withdraw(amount)
      .accounts({
        state: statePda,
        vault: vaultPda,
        owner,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const balance = await provider.connection.getBalance(vaultPda);

    assert.equal(balance, 0);
  });

  it("Closes the vault state account", async () => {
    await program.methods
      .close()
      .accounts({
        state: statePda,
        vault: vaultPda,
        owner,
      })
      .rpc();

    const state = await provider.connection.getAccountInfo(statePda);

    assert.equal(state, null);
  });
});

