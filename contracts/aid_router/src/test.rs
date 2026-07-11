#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token, Address, Env, IntoVal, String, Symbol, FromVal,
};

// Import RecipientRegistryContract from the recipient_registry package dependency
use recipient_registry::{
    RecipientRegistryContract, RecipientRegistryContractClient,
};

fn setup_test<'a>(env: &'a Env) -> (
    Address, // admin
    Address, // user
    Address, // ngo
    Address, // registry contract id
    RecipientRegistryContractClient<'a>, // registry client
    Address, // asset token id
    token::Client<'a>, // token client
    Address, // router contract id
    AidRouterContractClient<'a>, // router client
) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let user = Address::generate(env);
    let ngo = Address::generate(env);

    // Register registry contract
    let registry_contract_id = env.register(RecipientRegistryContract, ());
    let registry_client = RecipientRegistryContractClient::new(env, &registry_contract_id);
    registry_client.initialize(&admin);

    // Register token contract (SAC)
    let asset_token_id = env.register_stellar_asset_contract(admin.clone());
    let token_client = token::Client::new(env, &asset_token_id);

    // Register router contract
    let router_contract_id = env.register(AidRouterContract, ());
    let router_client = AidRouterContractClient::new(env, &router_contract_id);

    (
        admin,
        user,
        ngo,
        registry_contract_id,
        registry_client,
        asset_token_id,
        token_client,
        router_contract_id,
        router_client,
    )
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let (admin, _, _, registry_id, _, asset_id, _, _, router) = setup_test(&env);

    let campaign_name = String::from_str(&env, "Global Aid Campaign");
    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);

    assert_eq!(router.get_admin(), admin);
    assert_eq!(router.get_registry(), registry_id);
    assert_eq!(router.get_asset(), asset_id);
    assert_eq!(router.get_campaign_active(), true);
    assert_eq!(router.get_campaign_name(), campaign_name);
}

#[test]
fn test_reinitialization_fails() {
    let env = Env::default();
    let (admin, _, _, registry_id, _, asset_id, _, _, router) = setup_test(&env);
    let campaign_name = String::from_str(&env, "Global Aid Campaign");

    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);

    let res = router.try_initialize(&admin, &registry_id, &asset_id, &campaign_name);
    assert_eq!(res.unwrap_err(), Ok(Error::AlreadyInitialized));
}

#[test]
fn test_payout_fails_unverified() {
    let env = Env::default();
    let (admin, _, ngo, registry_id, _, asset_id, _, _, router) = setup_test(&env);
    let campaign_name = String::from_str(&env, "Global Aid Campaign");

    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);

    // NGO is unverified since we didn't whitelist it yet
    let res = router.try_disburse_aid(&ngo, &100);
    assert_eq!(res.unwrap_err(), Ok(Error::UnverifiedRecipient));
}

#[test]
fn test_payout_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let ngo = Address::generate(&env);

    // Register registry contract
    let registry_contract_id = env.register(RecipientRegistryContract, ());
    let registry = RecipientRegistryContractClient::new(&env, &registry_contract_id);
    registry.initialize(&admin);

    // Register token contract (SAC)
    let asset_token_id = env.register_stellar_asset_contract(admin.clone());
    let token = token::Client::new(&env, &asset_token_id);

    // Register router contract
    let router_contract_id = env.register(AidRouterContract, ());
    let router = AidRouterContractClient::new(&env, &router_contract_id);

    let campaign_name = String::from_str(&env, "Global Aid Campaign");
    router.initialize(&admin, &registry_contract_id, &asset_token_id, &campaign_name);

    // Whitelist NGO
    registry.whitelist_recipient(&ngo);
    assert_eq!(registry.validate_recipient(&ngo), true);

    // Mint some tokens to router using StellarAssetClient
    let sac_client = token::StellarAssetClient::new(&env, &asset_token_id);
    sac_client.mint(&router_contract_id, &500);
    assert_eq!(token.balance(&router_contract_id), 500);

    // Disburse aid
    router.disburse_aid(&ngo, &200);

    // Capture events IMMEDIATELY after calling disburse_aid
    let events = env.events().all();

    // Assert balances adjusted (can be done after capturing events)
    assert_eq!(token.balance(&router_contract_id), 300);
    assert_eq!(token.balance(&ngo), 200);

    // Verify event was emitted by checking topics
    let mut disburse_event_found = false;
    for event in events.iter() {
        let topics = event.1;
        if topics.len() > 0 {
            let sym = Symbol::from_val(&env, &topics.get(0).unwrap());
            if sym == Symbol::short("disburse") {
                disburse_event_found = true;
            }
        }
    }
    assert!(disburse_event_found);
}

#[test]
#[should_panic]
fn test_non_admin_auth_fault() {
    let env = Env::default();
    // Do NOT mock all auths initially to let signature check fail
    let admin = Address::generate(&env);
    let registry_id = env.register(RecipientRegistryContract, ());
    let asset_id = env.register_stellar_asset_contract(admin.clone());
    let router_id = env.register(AidRouterContract, ());
    let router = AidRouterContractClient::new(&env, &router_id);

    let campaign_name = String::from_str(&env, "Global Aid Campaign");
    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);

    // Alter parameter without admin auth mocked should panic/throw authorization fault
    router.update_campaign_active(&false);
}

#[test]
fn test_exceeds_available_balance() {
    let env = Env::default();
    let (admin, _, ngo, registry_id, registry, asset_id, token, router_id, router) = setup_test(&env);
    let campaign_name = String::from_str(&env, "Global Aid Campaign");

    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);

    // Whitelist NGO
    registry.whitelist_recipient(&ngo);

    // Mint some tokens to router
    let sac_client = token::StellarAssetClient::new(&env, &asset_id);
    sac_client.mint(&router_id, &100);
    assert_eq!(token.balance(&router_id), 100);

    // Attempt to disburse 101 tokens (exceeds balance)
    let res = router.try_disburse_aid(&ngo, &101);
    assert_eq!(res.unwrap_err(), Ok(Error::InsufficientFunds));

    // Verify balance was untouched
    assert_eq!(token.balance(&router_id), 100);
    assert_eq!(token.balance(&ngo), 0);
}

#[test]
fn test_inactive_campaign_fails() {
    let env = Env::default();
    let (admin, _, ngo, registry_id, registry, asset_id, token, router_id, router) = setup_test(&env);
    let campaign_name = String::from_str(&env, "Global Aid Campaign");

    router.initialize(&admin, &registry_id, &asset_id, &campaign_name);
    registry.whitelist_recipient(&ngo);
    
    let sac_client = token::StellarAssetClient::new(&env, &asset_id);
    sac_client.mint(&router_id, &500);

    // Set campaign inactive
    router.update_campaign_active(&false);
    assert_eq!(router.get_campaign_active(), false);

    // Disburse aid should fail
    let res = router.try_disburse_aid(&ngo, &200);
    assert_eq!(res.unwrap_err(), Ok(Error::CampaignInactive));
}
