use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("4Mg1vWZ6YhQCqfNVGXZHASzoZynuXHM5YbQU9dLuG624");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);

        let escrow = &mut ctx.accounts.escrow;
        escrow.depositor = ctx.accounts.depositor.key();
        escrow.recipient = recipient;
        escrow.amount = amount;
        escrow.funded = false;
        escrow.bump = ctx.bumps.escrow;

        msg!("Escrow initialized for {} lamports", amount);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(!escrow.funded, EscrowError::AlreadyFunded);

        let amount = escrow.amount;

        let cpi_accounts = Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: escrow.to_account_info(),
        };

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
        );

        system_program::transfer(cpi_context, amount)?;

        escrow.funded = true;

        msg!("Deposited {} lamports into escrow", amount);
        Ok(())
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        let amount = ctx.accounts.escrow.amount;

        require!(ctx.accounts.escrow.funded, EscrowError::NotFunded);

        let escrow_balance = escrow_info.lamports();
        let recipient_balance = recipient_info.lamports();

        let remaining = escrow_balance
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        let recipient_new_balance = recipient_balance
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        **escrow_info.try_borrow_mut_lamports()? = remaining;
        **recipient_info.try_borrow_mut_lamports()? = recipient_new_balance;

        msg!("Released {} lamports to recipient", amount);
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let depositor_info = ctx.accounts.depositor.to_account_info();

        let amount = ctx.accounts.escrow.amount;

        require!(ctx.accounts.escrow.funded, EscrowError::NotFunded);

        let escrow_balance = escrow_info.lamports();
        let depositor_balance = depositor_info.lamports();

        let remaining = escrow_balance
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientFunds)?;

        let depositor_new_balance = depositor_balance
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        **escrow_info.try_borrow_mut_lamports()? = remaining;
        **depositor_info.try_borrow_mut_lamports()? = depositor_new_balance;

        msg!("Refunded {} lamports to depositor", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [b"escrow", depositor.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"escrow", depositor.key().as_ref()],
        bump = escrow.bump,
        has_one = depositor
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(
        mut,
        close = depositor,
        seeds = [b"escrow", depositor.key().as_ref()],
        bump = escrow.bump,
        has_one = depositor
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    /// CHECK: The address is checked against the recipient stored in escrow.
    #[account(mut, address = escrow.recipient)]
    pub recipient: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        close = depositor,
        seeds = [b"escrow", depositor.key().as_ref()],
        bump = escrow.bump,
        has_one = depositor
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub depositor: Signer<'info>,
}

#[account]
pub struct EscrowState {
    pub depositor: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub funded: bool,
    pub bump: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("The amount must be greater than zero.")]
    InvalidAmount,
    #[msg("This escrow has already been funded.")]
    AlreadyFunded,
    #[msg("This escrow has not been funded.")]
    NotFunded,
    #[msg("The escrow does not have enough lamports.")]
    InsufficientFunds,
    #[msg("The balance calculation overflowed.")]
    Overflow,
}
