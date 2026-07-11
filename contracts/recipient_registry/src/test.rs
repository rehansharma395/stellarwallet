#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

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
    assert_eq!(client.validate_recipient(&ngo), false);

    // Whitelist NGO
    client.whitelist_recipient(&ngo);
    assert_eq!(client.validate_recipient(&ngo), true);

    // Remove NGO
    client.remove_recipient(&ngo);
    assert_eq!(client.validate_recipient(&ngo), false);
}
