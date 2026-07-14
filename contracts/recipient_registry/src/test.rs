#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};

#[test]
fn test_registry_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let ngo = Address::generate(&env);

    let contract_id = env.register(RecipientRegistryContract, ());
    let client = RecipientRegistryContractClient::new(&env, &contract_id);

    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Should be false initially
    assert!(!client.validate_recipient(&ngo));

    // Whitelist NGO
    client.whitelist_recipient(&ngo);
    assert!(client.validate_recipient(&ngo));

    // Remove NGO
    client.remove_recipient(&ngo);
    assert!(!client.validate_recipient(&ngo));
}

#[test]
fn test_registry_events() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let ngo = Address::generate(&env);

    let contract_id = env.register(RecipientRegistryContract, ());
    let client = RecipientRegistryContractClient::new(&env, &contract_id);

    client.initialize(&admin);
    client.whitelist_recipient(&ngo);

    let events = env.events().all();
    std::println!("REGISTRY_EVENTS_COUNT: {}", events.len());
    for (i, event) in events.iter().enumerate() {
        std::println!(
            "Registry Event {}: Contract = {:?}, Topics = {:?}, Value = {:?}",
            i,
            event.0,
            event.1,
            event.2
        );
    }
    assert_ne!(events.len(), 0);
}
