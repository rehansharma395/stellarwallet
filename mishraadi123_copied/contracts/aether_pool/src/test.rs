#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use sweep_coupon::SweepCouponContract;
use commission_vault::CommissionVaultContract;

fn setup_test(
    env: &Env,
) -> (
    Address,
    Address,
    Address,
    Address,
    Address,
    AetherPoolContractClient<'_>,
    sweep_coupon::SweepCouponContractClient<'_>,
    commission_vault::CommissionVaultContractClient<'_>,
) {
    env.mock_all_auths();
    env.ledger().set_timestamp(1000);

    let admin = Address::generate(env);
    let buyer1 = Address::generate(env);
    let buyer2 = Address::generate(env);
    let treasury_admin = Address::generate(env);

    // Register XLM mock token using register_stellar_asset_contract_v2
    let token_admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let xlm_token_addr = sac.address();
    let sac_client = StellarAssetClient::new(env, &xlm_token_addr);

    // Mint XLM mock tokens to buyers
    sac_client.mint(&buyer1, &10000);
    sac_client.mint(&buyer2, &10000);

    // Deploy SweepCouponContract
    let token_id = env.register(SweepCouponContract, ());
    let token_client = sweep_coupon::SweepCouponContractClient::new(env, &token_id);

    // Deploy CommissionVaultContract
    let treasury_id = env.register(CommissionVaultContract, ());
    let treasury_client = commission_vault::CommissionVaultContractClient::new(env, &treasury_id);

    // Deploy AetherPoolContract
    let lottery_id = env.register(AetherPoolContract, ());
    let lottery_client = AetherPoolContractClient::new(env, &lottery_id);

    // Initialize contracts
    lottery_client.setup_aether_draw(
        &admin,
        &token_id,
        &treasury_id,
        &xlm_token_addr,
        &100, // ticket price: 100 XLM
        &500, // fee bps: 5% (500 bps)
    );

    token_client.setup_ticket(&lottery_id);
    treasury_client.setup_treasury(&treasury_admin, &lottery_id, &xlm_token_addr);

    (
        admin,
        buyer1,
        buyer2,
        treasury_admin,
        xlm_token_addr,
        lottery_client,
        token_client,
        treasury_client,
    )
}

#[test]
fn test_lottery_initialization() {
    let env = Env::default();
    let (_, _, _, _, _, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.fetch_active_round_id();
    assert_eq!(round_id, 0);
}

#[test]
fn test_open_round_success() {
    let env = Env::default();
    let (_admin, _, _, _, _, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);
    assert_eq!(round_id, 1);

    let info = lottery_client.fetch_round_details(&round_id);
    assert_eq!(info.status, 1); // active
    assert_eq!(info.ticket_count, 0);
    assert_eq!(info.pot, 0);
    assert_eq!(info.close_time, 4600);
    assert_eq!(info.winner, None);
}

#[test]
#[should_panic(expected = "previous round is still active")]
fn test_open_round_fails_if_active() {
    let env = Env::default();
    let (_admin, _, _, _, _, lottery_client, _, _) = setup_test(&env);

    lottery_client.start_sweepstakes_round(&3600);
    lottery_client.start_sweepstakes_round(&3600);
}

#[test]
fn test_buy_ticket_success() {
    let env = Env::default();
    let (_, buyer1, _, _, xlm_token, lottery_client, token_client, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    // Approve lottery contract to spend buyer1's XLM
    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &100, &10000);

    lottery_client.purchase_entry_ticket(&buyer1, &round_id);

    // Check balances
    assert_eq!(xlm_client.balance(&buyer1), 9900);
    assert_eq!(xlm_client.balance(&lottery_client.address), 100);

    // Check ticket count
    assert_eq!(token_client.coupon_balance(&buyer1, &round_id), 1);
    assert_eq!(lottery_client.fetch_user_entry_count(&round_id, &buyer1), 1);

    let info = lottery_client.fetch_round_details(&round_id);
    assert_eq!(info.ticket_count, 1);
    assert_eq!(info.pot, 100);
}

#[test]
#[should_panic(expected = "round already closed")]
fn test_buy_ticket_fails_if_closed() {
    let env = Env::default();
    let (_, buyer1, _, _, xlm_token, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &100, &10000);

    // Travel in time to end of round
    env.ledger().set_timestamp(4700);

    lottery_client.purchase_entry_ticket(&buyer1, &round_id);
}

#[test]
fn test_settle_round_success() {
    let env = Env::default();
    let (_admin, buyer1, buyer2, _treasury_admin, xlm_token, lottery_client, _token_client, treasury_client) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &300, &10000);
    xlm_client.approve(&buyer2, &lottery_client.address, &200, &10000);

    // Buyer1 buys 3 tickets, Buyer2 buys 2 tickets
    lottery_client.purchase_entry_ticket(&buyer1, &round_id);
    lottery_client.purchase_entry_ticket(&buyer1, &round_id);
    lottery_client.purchase_entry_ticket(&buyer1, &round_id);
    lottery_client.purchase_entry_ticket(&buyer2, &round_id);
    lottery_client.purchase_entry_ticket(&buyer2, &round_id);

    assert_eq!(xlm_client.balance(&lottery_client.address), 500);

    // Advance block time
    env.ledger().set_timestamp(4700);

    // Settle round
    let winner = lottery_client.resolve_and_draw(&round_id);
    assert!(winner == buyer1 || winner == buyer2);

    // Total fee is 5% of 500 = 25 XLM. Winner payout is 475 XLM.
    assert_eq!(xlm_client.balance(&lottery_client.address), 0);
    assert_eq!(xlm_client.balance(&treasury_client.address), 25);
    assert_eq!(treasury_client.accumulated_commissions(), 25);

    if winner == buyer1 {
        assert_eq!(xlm_client.balance(&buyer1), 9700 + 475);
    } else {
        assert_eq!(xlm_client.balance(&buyer2), 9800 + 475);
    }

    let info = lottery_client.fetch_round_details(&round_id);
    assert_eq!(info.status, 2); // settled
    assert_eq!(info.winner, Some(winner));
}

#[test]
fn test_settle_round_voided_if_no_tickets() {
    let env = Env::default();
    let (_, _, _, _, _, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    env.ledger().set_timestamp(4700);

    let winner = lottery_client.resolve_and_draw(&round_id);
    assert_eq!(winner, lottery_client.address); // returns contract address to represent void/no winner

    let info = lottery_client.fetch_round_details(&round_id);
    assert_eq!(info.status, 0); // voided
    assert_eq!(info.winner, None);
}

#[test]
#[should_panic]
fn test_treasury_unauthorized_deposit() {
    let env = Env::default();
    let treasury_id = env.register(CommissionVaultContract, ());
    let treasury_client = commission_vault::CommissionVaultContractClient::new(&env, &treasury_id);
    let admin = Address::generate(&env);
    let lottery = Address::generate(&env);
    let token = Address::generate(&env);
    treasury_client.setup_treasury(&admin, &lottery, &token);

    treasury_client.record_commission(&1, &100);
}

#[test]
#[should_panic]
fn test_ticket_unauthorized_mint() {
    let env = Env::default();
    let token_id = env.register(SweepCouponContract, ());
    let token_client = sweep_coupon::SweepCouponContractClient::new(&env, &token_id);
    let lottery = Address::generate(&env);
    token_client.setup_ticket(&lottery);

    let buyer1 = Address::generate(&env);
    token_client.issue_entry_coupon(&buyer1, &1);
}

#[test]
#[should_panic(expected = "round timer has not expired")]
fn test_settle_round_fails_before_close_time() {
    let env = Env::default();
    let (_, buyer1, _, _, xlm_token, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &100, &10000);
    lottery_client.purchase_entry_ticket(&buyer1, &round_id);

    // Settle immediately (before close_time) - should panic
    lottery_client.resolve_and_draw(&round_id);
}

#[test]
#[should_panic(expected = "round is not active")]
fn test_settle_round_cannot_be_called_twice() {
    let env = Env::default();
    let (_, buyer1, _, _, xlm_token, lottery_client, _, _) = setup_test(&env);

    let round_id = lottery_client.start_sweepstakes_round(&3600);

    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &100, &10000);
    lottery_client.purchase_entry_ticket(&buyer1, &round_id);

    // Advance time
    env.ledger().set_timestamp(4700);

    // Settle first time - succeeds
    lottery_client.resolve_and_draw(&round_id);

    // Settle second time - fails/panics
    lottery_client.resolve_and_draw(&round_id);
}

#[test]
fn test_winner_index_always_within_bounds() {
    let env = Env::default();
    let (_, buyer1, buyer2, _, xlm_token, lottery_client, _, _) = setup_test(&env);

    let xlm_client = TokenClient::new(&env, &xlm_token);
    xlm_client.approve(&buyer1, &lottery_client.address, &10000, &10000);
    xlm_client.approve(&buyer2, &lottery_client.address, &10000, &10000);

    // Test across 5 different rounds with varying ticket counts
    for i in 1..=5 {
        let round_id = lottery_client.start_sweepstakes_round(&3600);
        
        let tickets_count = i * 2; // 2, 4, 6, 8, 10
        for _ in 0..tickets_count / 2 {
            lottery_client.purchase_entry_ticket(&buyer1, &round_id);
            lottery_client.purchase_entry_ticket(&buyer2, &round_id);
        }

        // Vary seed triggers (timestamp, sequence)
        env.ledger().set_timestamp(1000 + i * 5000);
        env.ledger().set_sequence_number((i * 1000) as u32);

        let winner = lottery_client.resolve_and_draw(&round_id);
        let info = lottery_client.fetch_round_details(&round_id);

        assert!(winner == buyer1 || winner == buyer2);
        assert_eq!(info.status, 2); // settled
    }
}
