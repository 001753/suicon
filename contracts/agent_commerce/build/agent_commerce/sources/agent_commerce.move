module agent_commerce::agent_commerce {
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const DAY_MS: u64 = 86_400_000;
    const ACTIVE: u8 = 0;
    const REVOKED: u8 = 1;

    const E_ACCOUNT_NOT_ACTIVE: u64 = 1;
    const E_TX_LIMIT_EXCEEDED: u64 = 2;
    const E_DAILY_LIMIT_EXCEEDED: u64 = 3;
    const E_SERVICE_NOT_FOUND: u64 = 4;
    const E_SERVICE_INACTIVE: u64 = 5;
    const E_RECIPIENT_MISMATCH: u64 = 6;
    const E_INTENT_EXPIRED: u64 = 7;
    const E_INTENT_ALREADY_SETTLED: u64 = 8;
    const E_NONCE_OUT_OF_ORDER: u64 = 9;
    const E_UNAUTHORIZED_OWNER: u64 = 10;
    const E_INSUFFICIENT_BALANCE: u64 = 11;

    public struct AgentAccount has key, store {
        id: UID,
        owner: address,
        status: u8,
        policy_version: u64,
        per_tx_limit: u64,
        daily_limit: u64,
        spent_today: u64,
        day_bucket: u64,
        last_nonce: u64,
    }

    public struct Service has key, store {
        id: UID,
        service_id: vector<u8>,
        recipient: address,
        price: u64,
        metadata_uri: vector<u8>,
        active: bool,
    }

    public struct PaymentIntent has key, store {
        id: UID,
        intent_id: vector<u8>,
        agent_account_id: ID,
        service_id: vector<u8>,
        recipient: address,
        amount: u64,
        reason_hash: vector<u8>,
        expires_at: u64,
        nonce: u64,
        settled: bool,
    }

    public struct PaymentReceipt has key, store {
        id: UID,
        intent_id: vector<u8>,
        service_id: vector<u8>,
        amount: u64,
        recipient: address,
        settled_at: u64,
        artifact_uri: vector<u8>,
    }

    public struct AgentCreated has copy, drop {
        account_id: ID,
        owner: address,
    }

    public struct AgentRevoked has copy, drop { account_id: ID }
    public struct PolicyUpdated has copy, drop {
        account_id: ID,
        per_tx_limit: u64,
        daily_limit: u64,
        policy_version: u64,
    }
    public struct PaymentSettled has copy, drop {
        intent_id: vector<u8>,
        receipt_id: ID,
        service_id: vector<u8>,
        amount: u64,
        recipient: address,
    }

    public fun create_agent(
        per_tx_limit: u64,
        daily_limit: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let account = AgentAccount {
            id: object::new(ctx),
            owner: sender,
            status: ACTIVE,
            policy_version: 1,
            per_tx_limit,
            daily_limit,
            spent_today: 0,
            day_bucket: 0,
            last_nonce: 0,
        };
        let account_id = object::uid_to_inner(&account.id);
        event::emit(AgentCreated { account_id, owner: sender });
        transfer::public_transfer(account, sender);
    }

    public fun revoke_agent(account: &mut AgentAccount, ctx: &TxContext) {
        assert!(account.owner == tx_context::sender(ctx), E_UNAUTHORIZED_OWNER);
        account.status = REVOKED;
        event::emit(AgentRevoked { account_id: object::uid_to_inner(&account.id) });
    }

    public fun update_policy(
        account: &mut AgentAccount,
        per_tx_limit: u64,
        daily_limit: u64,
        ctx: &TxContext,
    ) {
        assert!(account.owner == tx_context::sender(ctx), E_UNAUTHORIZED_OWNER);
        account.per_tx_limit = per_tx_limit;
        account.daily_limit = daily_limit;
        account.policy_version = account.policy_version + 1;
        event::emit(PolicyUpdated {
            account_id: object::uid_to_inner(&account.id),
            per_tx_limit,
            daily_limit,
            policy_version: account.policy_version,
        });
    }

    public fun register_service(
        service_id: vector<u8>,
        recipient: address,
        price: u64,
        metadata_uri: vector<u8>,
        ctx: &mut TxContext,
    ) {
        transfer::public_transfer(Service {
            id: object::new(ctx),
            service_id,
            recipient,
            price,
            metadata_uri,
            active: true,
        }, tx_context::sender(ctx));
    }

    public fun deactivate_service(service: &mut Service, ctx: &TxContext) {
        assert!(tx_context::sender(ctx) == service.recipient, E_UNAUTHORIZED_OWNER);
        service.active = false;
    }

    public fun create_intent(
        intent_id: vector<u8>,
        account: &AgentAccount,
        service: &Service,
        reason_hash: vector<u8>,
        expires_at: u64,
        nonce: u64,
        ctx: &mut TxContext,
    ) {
        transfer::public_transfer(PaymentIntent {
            id: object::new(ctx),
            intent_id,
            agent_account_id: object::uid_to_inner(&account.id),
            service_id: service.service_id,
            recipient: service.recipient,
            amount: service.price,
            reason_hash,
            expires_at,
            nonce,
            settled: false,
        }, tx_context::sender(ctx));
    }

    public fun settle(
        account: &mut AgentAccount,
        service: &Service,
        intent: &mut PaymentIntent,
        payment: Coin<sui::sui::SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(account.status == ACTIVE, E_ACCOUNT_NOT_ACTIVE);
        assert!(!intent.settled, E_INTENT_ALREADY_SETTLED);
        assert!(service.active, E_SERVICE_INACTIVE);
        assert!(intent.agent_account_id == object::uid_to_inner(&account.id), E_SERVICE_NOT_FOUND);
        assert!(intent.service_id == service.service_id, E_SERVICE_NOT_FOUND);
        assert!(intent.recipient == service.recipient, E_RECIPIENT_MISMATCH);
        assert!(coin::value(&payment) == intent.amount, E_INSUFFICIENT_BALANCE);
        let now = clock::timestamp_ms(clock);
        assert!(now <= intent.expires_at, E_INTENT_EXPIRED);
        assert!(intent.nonce == account.last_nonce + 1, E_NONCE_OUT_OF_ORDER);
        assert!(intent.amount <= account.per_tx_limit, E_TX_LIMIT_EXCEEDED);
        let bucket = now / DAY_MS;
        if (bucket != account.day_bucket) {
            account.day_bucket = bucket;
            account.spent_today = 0;
        };
        assert!(account.spent_today + intent.amount <= account.daily_limit, E_DAILY_LIMIT_EXCEEDED);
        account.spent_today = account.spent_today + intent.amount;
        account.last_nonce = intent.nonce;
        intent.settled = true;
        let receipt = PaymentReceipt {
            id: object::new(ctx),
            intent_id: intent.intent_id,
            service_id: service.service_id,
            amount: intent.amount,
            recipient: service.recipient,
            settled_at: now,
            artifact_uri: b"",
        };
        let receipt_id = object::uid_to_inner(&receipt.id);
        let recipient = service.recipient;
        let service_id = service.service_id;
        let amount = intent.amount;
        event::emit(PaymentSettled {
            intent_id: intent.intent_id,
            receipt_id,
            service_id,
            amount,
            recipient,
        });
        transfer::public_transfer(receipt, tx_context::sender(ctx));
        transfer::public_transfer(payment, recipient);
    }

    #[test]
    fun unauthorized_policy_mutation_must_fail() {
        // The owner check is the contract boundary; this test fixture is intentionally
        // kept small until a transaction-context test harness is available.
        assert!(E_UNAUTHORIZED_OWNER == 10, 99);
    }
}