import * as anchor from '@coral-xyz/anchor'
import * as dotenv from 'dotenv'

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js'
import { AnchorProvider, Program, Wallet, web3 } from '@coral-xyz/anchor'
import { IDL, JupiterSwap } from '../target/types/jupiter_swap'

import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'

dotenv.config()

export const programId = new PublicKey(
  'DA8tQZHYfoPoHGusDGj9SRdzaDEuwDbUSjndCX3SzzEr'
)
export const jupiterProgramId = new PublicKey(
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
)
export const wallet = new Wallet(
  Keypair.fromSecretKey(bs58.decode(process.env.KEYPAIR))
)
export const connection = new Connection(process.env.RPC_URL)
export const provider = new AnchorProvider(connection, wallet, {
  commitment: 'processed',
})
anchor.setProvider(provider)
export const program = anchor.workspace.JupiterSwap as Program<JupiterSwap>

const findProgramAuthority = (): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('authority')],
    programId
  )[0]
}
export const programAuthority = findProgramAuthority()

const findProgramWSOLAccount = (): PublicKey => {
  return PublicKey.findProgramAddressSync([Buffer.from('wsol')], programId)[0]
}

export const programWSOLAccount = findProgramWSOLAccount()

export const findAssociatedTokenAddress = ({
  walletAddress,
  tokenMintAddress,
}: {
  walletAddress: PublicKey
  tokenMintAddress: PublicKey
}): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0]
}

export const getAdressLookupTableAccounts = async (
  keys: string[]
): Promise<AddressLookupTableAccount[]> => {
  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    )

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index]
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      })
      acc.push(addressLookupTableAccount)
    }

    return acc
  }, new Array<AddressLookupTableAccount>())
}

export const instructionDataToTransactionInstruction = (
  instructionPayload: any
) => {
  if (instructionPayload === null) {
    return null
  }

  return new TransactionInstruction({
    programId: new PublicKey(instructionPayload.programId),
    keys: instructionPayload.accounts.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instructionPayload.data, 'base64'),
  })
}
