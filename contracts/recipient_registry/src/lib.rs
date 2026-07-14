#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Recipient(Address),
}

#[contract]
pub struct RecipientRegistryContract;

#[contractimpl]
impl RecipientRegistryContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    pub fn whitelist_recipient(env: Env, target: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Recipient(target.clone()), &true);

        env.events()
            .publish((Symbol::new(&env, "reg_ngo"),), target);
    }

    pub fn remove_recipient(env: Env, target: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Recipient(target), &false);
    }

    pub fn validate_recipient(env: Env, target: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Recipient(target))
            .unwrap_or(false)
    }
}

mod test;
