use anchor_lang::prelude::*;

use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::Token;
use std::str::FromStr;
declare_id!("DA8tQZHYfoPoHGusDGj9SRdzaDEuwDbUSjndCX3SzzEr");

pub const AUTHORITY_SEED: &[u8] = b"authority";
pub const WSOL_SEED: &[u8] = b"wsol";

mod jupiter {
    use anchor_lang::declare_id;
    declare_id!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
}

#[derive(Clone)]
pub struct Jupiter;
impl anchor_lang::Id for Jupiter {
    fn id() -> Pubkey {
        jupiter::id()
    }
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SwapTokenToToken<'info> {
    pub user_account: Signer<'info>,
    pub jupiter_program: Program<'info, Jupiter>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
mod jupiter_override {
    use super::*;

    #[derive(AnchorSerialize)]
    pub struct Route {
        pub swap_leg: Vec<u8>,
        pub in_amount: u64,
        pub quoted_out_amount: u64,
        pub slippage_bps: u16,
        pub platform_fee_bps: u16,
    }
}

#[error_code]
pub enum ErrorCode {
    InvalidReturnData,
    InvalidJupiterProgram,
    IncorrectOwner,
    SerializationFailed,
}

#[program]
pub mod jupiter_swap {

    use super::*;

    pub fn swap_token_to_token(ctx: Context<SwapTokenToToken>, data: Vec<u8>) -> Result<()> {
        msg!("Swap on Jupiter");
        swap_on_jupiter(ctx.remaining_accounts, &ctx.accounts.jupiter_program, data)?;

        Ok(())
    }
}
fn swap_on_jupiter<'a, 'b, 'c, 'info>(
    remaining_accounts: &'a [AccountInfo<'b>],
    jupiter_program: &'c Program<'info, Jupiter>,
    data: Vec<u8>,
) -> ProgramResult {
    let accounts: Vec<AccountMeta> = remaining_accounts
        .iter()
        .map(|acc| AccountMeta {
            pubkey: *acc.key,
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        })
        .collect();

    let instruction = Instruction {
        program_id: jupiter_program.key(),
        accounts,
        data,
    };

    invoke(&instruction, remaining_accounts)
}
pub fn execute_swap(
    ctx: Context<ExecuteSwap>,
    input_amount: u64,
    minimum_output_amount: u64,
    platform_fee_bps: u8,
) -> Result<()> {
    let accounts = ctx.remaining_accounts;

    // Construct the Jupiter swap instruction
    let jupiter_program_id =
        Pubkey::from_str("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4").unwrap();

    let mut swap_data = vec![];
    swap_data.extend_from_slice(&input_amount.to_le_bytes());
    swap_data.extend_from_slice(&minimum_output_amount.to_le_bytes());
    swap_data.extend_from_slice(&[platform_fee_bps]);

    // Convert AccountInfo to AccountMeta
    let account_metas: Vec<AccountMeta> = accounts
        .iter()
        .map(|acc| {
            if acc.is_writable {
                AccountMeta::new(acc.key(), acc.is_signer)
            } else {
                AccountMeta::new_readonly(acc.key(), acc.is_signer)
            }
        })
        .collect();

    let swap_ix = Instruction {
        program_id: jupiter_program_id,
        accounts: account_metas,
        data: swap_data,
    };

    // Execute the Jupiter swap instruction
    invoke(&swap_ix, accounts)?;

    Ok(())
}
