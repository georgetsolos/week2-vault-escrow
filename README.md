# Solana Vault & Escrow Programs

A Solana development project built with **Rust, Anchor, and TypeScript**. It contains three Anchor programs, including a SOL escrow application that allows a depositor to fund an escrow account and subsequently release or refund the funds.

## Project Overview

This repository contains three Solana programs:

- **Vault:** A PDA-based SOL vault supporting initialization, deposits, withdrawals, and account closure.
- **Escrow:** A SOL escrow program supporting initialization, deposits, release of funds to a recipient, and refunds to the depositor.
- **Week 2 Vault Escrow:** An additional Anchor program developed as part of the project.

## Technology Stack

- Solana
- Rust
- Anchor Framework 0.31.0
- TypeScript
- Node.js
- Solana Devnet

## Escrow Architecture

The escrow program uses a Program Derived Address (PDA) to hold SOL.

```text
                 Depositor
                     |
                     |
               Initialize
                     |
                     v
             Escrow State PDA
                     |
                     |
                  Deposit
                     |
                     v
              SOL held in PDA
                     |
             +-------+-------+
             |               |
             v               v
          Release           Refund
             |               |
             v               v
          Recipient       Depositor
```

## Escrow Instructions

| Instruction | Description |
|---|---|
| `initialize` | Creates the escrow state and defines the recipient and amount. |
| `deposit` | Transfers SOL into the escrow PDA. |
| `release` | Releases the funds to the recipient. |
| `refund` | Returns the funds to the depositor. |

The escrow PDA is derived using:

```rust
[b"escrow", depositor.key().as_ref()]
```

## Repository Structure

```text
week2-vault-escrow/
├── programs/
│   ├── vault/
│   ├── escrow/
│   └── week2-vault-escrow/
├── tests/
│   ├── escrow.ts
│   ├── vault.ts
│   └── week2-vault-escrow.ts
├── scripts/
│   └── devnet-escrow.ts
├── migrations/
├── Anchor.toml
├── Cargo.toml
├── Cargo.lock
├── package.json
├── tsconfig.json
├── yarn.lock
└── README.md
```

## Installation

Clone the repository:

```bash
git clone https://github.com/georgetsolos/week2-vault-escrow.git
cd week2-vault-escrow
```

Install dependencies:

```bash
yarn install
```

Build the programs:

```bash
anchor build
```

Run the local tests:

```bash
anchor test
```

## Test Results

The local test suite completed successfully:

**16 tests passing**

- Escrow: 11 tests
- Vault: 4 tests
- Week 2 Vault Escrow: 1 test

The escrow tests cover initialization, deposits, releases, refunds, zero-amount rejection, duplicate deposits, and unauthorized operations.

## Devnet Deployment

The escrow program was successfully deployed to Solana Devnet.

**Program ID:**

`4Mg1vWZ6YhQCqfNVGXZHASzoZynuXHM5YbQU9dLuG624`

**Network:** Solana Devnet

**Explorer:**

https://explorer.solana.com/address/4Mg1vWZ6YhQCqfNVGXZHASzoZynuXHM5YbQU9dLuG624?cluster=devnet

Deployment command:

```bash
anchor deploy \
  --program-name escrow \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/id.json \
  --program-keypair target/deploy/escrow-keypair.json
```

## Devnet Testing

The Devnet test script is:

```bash
npx ts-node --transpile-only scripts/devnet-escrow.ts
```

Both end-to-end scenarios passed:

- **Release test:** Initialize escrow, deposit 0.01 SOL, release funds to the recipient, and close the escrow account.
- **Refund test:** Initialize escrow, deposit 0.01 SOL, refund the depositor, and close the escrow account.

### Transaction Signatures

**Release flow**

- Initialize: `3mWCKm5ThonaVXHuKzb5SxM3rJGhYTehViQArohteKiHppZNAg7kKJXn85PC3SFcvgcXbD6jncotvJhiiFDmR24u`
- Deposit: `njckwjFs6pZUgSjuSNMFpfYd7e8jVsS5ue4H9uARZJYtMPcD925pzJNLAe2ujQth8pdbgxQH3td1pg66gP3ps3F`
- Release: `kX9VhmrMsz33sBhWMED9b41c2pXhDmrvYLLT4TdREdENWy6eviAzniYSFMXgiNvVVoYFoY9GjHKxfGHeP42k9Z3`

**Refund flow**

- Initialize: `4bMRkiZBHKvHF4wUACx7nmRUft9rDLbBKAuQ9fr9AWjtqz2VTXy2NLKTij27WMCn2yzGtQhiZUfFpMadz1G9jTii`
- Deposit: `KxRwoCahRhXFQbJw6iosGZRXFhvULRWsVMq5W93zt385zWQprXYM4V6eYSKeutyKYuiSZdy2R66x1vhFsYvY9uV`
- Refund: `3RdV9Jm98z1L3cozcYX4TvX7kNEgunzjnTP8xXe4AEA65vVJwzubx5aAkUHeyVdr8w2TmUyNVLcUsG9ocXXzPCD2`

## Security Considerations

This is an educational project and is not intended for production use without further security review.

Current limitations:

- The depositor authorizes both release and refund.
- The PDA seeds support only one active escrow per depositor.
- The program supports native SOL rather than SPL tokens.
- A production implementation should include stronger authorization, dispute resolution, and comprehensive
