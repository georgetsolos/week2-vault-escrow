use anchor_lang::prelude::*;

declare_id!("37bgH1S5CRV7AfCkpJSHK2ZPNZTgbHrTPXodyKcDhYAo");

#[program]
pub mod vault {
    use super::*;

    // Initialize the vault and its state PDA.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;

        state.owner = ctx.accounts.owner.key();
        state.state_bump = ctx.bumps.state;
        state.vault_bump = ctx.bumps.vault;

        msg!("Vault initialized for {}", state.owner);
        Ok(())
    }

    // Deposit SOL into the vault PDA.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };

        let cpi_context =
            CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);

        anchor_lang::system_program::transfer(cpi_context, amount)?;

        msg!("Deposited {} lamports", amount);
        Ok(())
    }

    // Withdraw SOL from the vault PDA.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let vault_balance = ctx.accounts.vault.lamports();

        require!(vault_balance >= amount, VaultError::InsufficientFunds);

        let state_key = ctx.accounts.state.key();
        let vault_bump = ctx.accounts.state.vault_bump;

        let signer_seeds: &[&[u8]] = &[b"vault", state_key.as_ref(), &[vault_bump]];

        let signer = &[signer_seeds];

        let cpi_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.owner.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            signer,
        );

        anchor_lang::system_program::transfer(cpi_context, amount)?;

        msg!("Withdrawn {} lamports", amount);
        Ok(())
    }

    // Close the state account after the vault has been emptied.
    pub fn close(ctx: Context<Close>) -> Result<()> {
        require!(
            ctx.accounts.vault.lamports() == 0,
            VaultError::VaultNotEmpty
        );

        msg!("Vault closed successfully");
        Ok(())
    }
}

// Vault state account.
#[account]
pub struct VaultState {
    pub owner: Pubkey,
    pub state_bump: u8,
    pub vault_bump: u8,
}

// Initialize accounts.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 1 + 1,
        seeds = [b"state", owner.key().as_ref()],
        bump
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: This is a PDA used as a SOL vault.
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Deposit accounts.
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"state", owner.key().as_ref()],
        bump = state.state_bump,
        has_one = owner
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: PDA validated by seeds and used as a SOL vault.
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Withdraw accounts.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [b"state", owner.key().as_ref()],
        bump = state.state_bump,
        has_one = owner
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: PDA validated by seeds and used as a SOL vault.
    #[account(
        mut,
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Close accounts.
#[derive(Accounts)]
pub struct Close<'info> {
    #[account(
        mut,
        seeds = [b"state", owner.key().as_ref()],
        bump = state.state_bump,
        has_one = owner,
        close = owner
    )]
    pub state: Account<'info, VaultState>,

    /// CHECK: PDA validated by seeds.
    #[account(
        seeds = [b"vault", state.key().as_ref()],
        bump = state.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

// Custom errors.
#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,

    #[msg("Vault must be empty before closing")]
    VaultNotEmpty,
}
