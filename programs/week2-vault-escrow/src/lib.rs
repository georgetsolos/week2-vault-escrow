use anchor_lang::prelude::*;

declare_id!("2xrsmEHbcfHg3PDcDRd6Q3FLT34FD3R8wRkfUyJ12YcE");

#[program]
pub mod week2_vault_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
