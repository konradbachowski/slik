use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_lang::system_program;

declare_id!("AqdVcH7aYHXtWCQbkEweCDoXGR8qMn4pdKhWScbMcyNv");

const FEE_WALLET: Pubkey = pubkey!("2df3JmriVkhkBqdmYT2TgDBRo8E71WAJE1SbtLQ71Fkc");
const FEE_BPS: u64 = 20; // 0.2% = 20 basis points

#[program]
pub mod solanablik {
    use super::*;

    pub fn pay(ctx: Context<Pay>, amount: u64, payment_id: [u8; 16]) -> Result<()> {
        require!(amount > 0, BlikError::ZeroAmount);

        // Calculate fee (0.2% = amount * 20 / 10000)
        let fee = amount.checked_mul(FEE_BPS).unwrap().checked_div(10000).unwrap();
        let merchant_amount = amount.checked_sub(fee).unwrap();

        // Transfer to merchant (amount - fee)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.customer.to_account_info(),
                    to: ctx.accounts.merchant.to_account_info(),
                },
            ),
            merchant_amount,
        )?;

        // Transfer fee to protocol
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.customer.to_account_info(),
                        to: ctx.accounts.fee_wallet.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // Initialize receipt PDA (stores FULL amount, not net)
        let receipt = &mut ctx.accounts.receipt;
        receipt.customer = ctx.accounts.customer.key();
        receipt.merchant = ctx.accounts.merchant.key();
        receipt.amount = amount; // Full amount including fee
        receipt.payment_id = payment_id;
        receipt.timestamp = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        emit!(PaymentCompleted {
            payment_id,
            customer: ctx.accounts.customer.key(),
            merchant: ctx.accounts.merchant.key(),
            amount, // Full amount
            timestamp: receipt.timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, payment_id: [u8; 16])]
pub struct Pay<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Merchant wallet, validated by the backend when constructing TX
    #[account(mut)]
    pub merchant: UncheckedAccount<'info>,

    /// CHECK: SolanaBLIK protocol fee recipient
    #[account(
        mut,
        address = FEE_WALLET @ BlikError::InvalidFeeWallet
    )]
    pub fee_wallet: UncheckedAccount<'info>,

    #[account(
        init,
        payer = customer,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", payment_id.as_ref()],
        bump,
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub customer: Pubkey,     // 32
    pub merchant: Pubkey,     // 32
    pub amount: u64,          // 8
    pub payment_id: [u8; 16], // 16
    pub timestamp: i64,       // 8
    pub bump: u8,             // 1
}

#[event]
pub struct PaymentCompleted {
    pub payment_id: [u8; 16],
    pub customer: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum BlikError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid fee wallet address")]
    InvalidFeeWallet,
}
