import * as anchor from '@coral-xyz/anchor'

import { PublicKey, TransactionInstruction } from '@solana/web3.js'

// Import your Anchor program's IDL and type
import { JupiterSwap } from '../target/types/jupiter_swap'
import { Program } from '@coral-xyz/anchor'
import { assert } from 'chai'
import { createJupiterApiClient } from '@jup-ag/api'
import { getAssociatedTokenAddress } from '@solana/spl-token'

describe('jupiter-swap', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.JupiterSwap as Program<JupiterSwap>

  // Define token mints (you'll need to replace these with actual devnet token addresses)
  const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const jlpMint = new PublicKey('27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4')

  it('Performs a swap from USDC to JLP', async () => {
    // // Create token accounts for the user
    // const usdcAccount = await getAssociatedTokenAddress(
    //   usdcMint,
    //   provider.wallet.publicKey
    // )

    // const jlpAccount = await getAssociatedTokenAddress(
    //   jlpMint,
    //   provider.wallet.publicKey
    // )

    const jupiterQuoteApi = createJupiterApiClient()

    // Amount to swap (e.g., 1 USDC)
    const amountToSwap = 1000000 // 1 USDC (6 decimals)
    // Compute routes
    const quote = await jupiterQuoteApi.quoteGet({
      inputMint: usdcMint.toString(),
      outputMint: jlpMint.toString(),
      amount: amountToSwap,
      maxAccounts: 20,
    })

    const {
      computeBudgetInstructions,
      setupInstructions,
      swapInstruction,
      cleanupInstruction,
      addressLookupTableAddresses,
    } = await jupiterQuoteApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: provider.wallet.publicKey.toBase58(),
        prioritizationFeeLamports: 'auto',
      },
    })

    // Create the transaction
    const transaction = new anchor.web3.Transaction()

    // Add compute budget instructions
    if (computeBudgetInstructions) {
      computeBudgetInstructions.forEach((instruction) => {
        transaction.add(instructionToTransactionInstruction(instruction))
      })
    }

    // Add setup instructions
    if (setupInstructions) {
      setupInstructions.forEach((instruction) => {
        transaction.add(instructionToTransactionInstruction(instruction))
      })
    }

    // Add swap instruction
    if (swapInstruction) {
      transaction.add(instructionToTransactionInstruction(swapInstruction))
    }

    // Add cleanup instruction (if it exists)
    if (cleanupInstruction) {
      transaction.add(instructionToTransactionInstruction(cleanupInstruction))
    }

    try {
      console.log(transaction)
      // Sign and send the transaction
      const txSignature = await provider.sendAndConfirm(transaction)
      // const txSignature = await provider.simulate(transaction)
      console.log('Swap transaction signature:', txSignature)
    } catch (e) {
      console.log(e)
    }
  })
})
// Helper function to convert an instruction to TransactionInstruction
function instructionToTransactionInstruction(
  instruction: any
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((acc: any) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(instruction.data, 'base64'),
  })
}
