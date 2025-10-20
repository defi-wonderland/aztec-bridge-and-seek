import { AztecAddress, type AztecAddressLike, type ContractArtifact, ContractBase, ContractFunctionInteraction, type ContractMethod, type ContractStorageLayout, DeployMethod, type FieldLike, PublicKeys, type Wallet } from '@aztec/aztec.js';
export declare const NFTContractArtifact: ContractArtifact;
/**
 * Type-safe interface for contract NFT;
 */
export declare class NFTContract extends ContractBase {
    private constructor();
    /**
     * Creates a contract instance.
     * @param address - The deployed contract's address.
     * @param wallet - The wallet to use when interacting with the contract.
     * @returns A promise that resolves to a new Contract instance.
     */
    static at(address: AztecAddress, wallet: Wallet): Promise<NFTContract>;
    /**
     * Creates a tx to deploy a new instance of this contract.
     */
    static deploy(wallet: Wallet, name: string, symbol: string, minter: AztecAddressLike, upgrade_authority: AztecAddressLike): DeployMethod<NFTContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
     */
    static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, name: string, symbol: string, minter: AztecAddressLike, upgrade_authority: AztecAddressLike): DeployMethod<NFTContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified constructor method.
     */
    static deployWithOpts<M extends keyof NFTContract['methods']>(opts: {
        publicKeys?: PublicKeys;
        method?: M;
        wallet: Wallet;
    }, ...args: Parameters<NFTContract['methods'][M]>): DeployMethod<NFTContract>;
    /**
     * Returns this contract's artifact.
     */
    static get artifact(): ContractArtifact;
    /**
     * Returns this contract's artifact with public bytecode.
     */
    static get artifactForPublic(): ContractArtifact;
    static get storage(): ContractStorageLayout<'symbol' | 'name' | 'private_nfts' | 'nft_exists' | 'public_owners' | 'minter' | 'upgrade_authority'>;
    /** Type-safe wrappers for the public methods exposed by the contract. */
    methods: {
        /** burn_private(from: struct, token_id: field, _nonce: field) */
        burn_private: ((from: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** burn_public(from: struct, token_id: field, _nonce: field) */
        burn_public: ((from: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** constructor_with_minter(name: string, symbol: string, minter: struct, upgrade_authority: struct) */
        constructor_with_minter: ((name: string, symbol: string, minter: AztecAddressLike, upgrade_authority: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_private_nfts(owner: struct, page_index: integer) */
        get_private_nfts: ((owner: AztecAddressLike, page_index: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** initialize_transfer_commitment(from: struct, to: struct, completer: struct) */
        initialize_transfer_commitment: ((from: AztecAddressLike, to: AztecAddressLike, completer: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_to_private(to: struct, token_id: field) */
        mint_to_private: ((to: AztecAddressLike, token_id: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_to_public(to: struct, token_id: field) */
        mint_to_public: ((to: AztecAddressLike, token_id: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** process_message(message_ciphertext: struct, message_context: struct) */
        process_message: ((message_ciphertext: FieldLike[], message_context: {
            tx_hash: FieldLike;
            unique_note_hashes_in_tx: FieldLike[];
            first_nullifier_in_tx: FieldLike;
            recipient: AztecAddressLike;
        }) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_dispatch(selector: field) */
        public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_get_name() */
        public_get_name: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_get_symbol() */
        public_get_symbol: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_owner_of(token_id: field) */
        public_owner_of: ((token_id: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** sync_private_state() */
        sync_private_state: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_commitment(from: struct, token_id: field, commitment: field, _nonce: field) */
        transfer_private_to_commitment: ((from: AztecAddressLike, token_id: FieldLike, commitment: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_private(from: struct, to: struct, token_id: field, _nonce: field) */
        transfer_private_to_private: ((from: AztecAddressLike, to: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_public(from: struct, to: struct, token_id: field, _nonce: field) */
        transfer_private_to_public: ((from: AztecAddressLike, to: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_private_to_public_with_commitment(from: struct, to: struct, token_id: field, _nonce: field) */
        transfer_private_to_public_with_commitment: ((from: AztecAddressLike, to: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_commitment(from: struct, token_id: field, commitment: field, _nonce: field) */
        transfer_public_to_commitment: ((from: AztecAddressLike, token_id: FieldLike, commitment: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_private(from: struct, to: struct, token_id: field, _nonce: field) */
        transfer_public_to_private: ((from: AztecAddressLike, to: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer_public_to_public(from: struct, to: struct, token_id: field, _nonce: field) */
        transfer_public_to_public: ((from: AztecAddressLike, to: AztecAddressLike, token_id: FieldLike, _nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** upgrade_contract(new_contract_class_id: field) */
        upgrade_contract: ((new_contract_class_id: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
    };
}
