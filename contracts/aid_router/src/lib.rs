#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec, Address, Env, String, Symbol,
    IntoVal,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    UnverifiedRecipient = 3,
    InsufficientFunds = 4,
    CampaignInactive = 5,
    NotAuthorized = 6,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    RegistryContractId,
    AssetTokenId,
    CampaignActive,
    CampaignName,
}

#[contract]
pub struct AidRouterContract;

#[contractimpl]
impl AidRouterContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        registry_contract_id: Address,
        asset_token_id: Address,
        campaign_name: String,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RegistryContractId, &registry_contract_id);
        env.storage().instance().set(&DataKey::AssetTokenId, &asset_token_id);
        env.storage().instance().set(&DataKey::CampaignActive, &true);
        env.storage().instance().set(&DataKey::CampaignName, &campaign_name);
        Ok(())
    }

    pub fn disburse_aid(env: Env, target_ngo: Address, amount: i128) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }

        let active: bool = env.storage().instance().get(&DataKey::CampaignActive).unwrap_or(false);
        if !active {
            return Err(Error::CampaignInactive);
        }

        let registry_contract_id: Address = env.storage().instance().get(&DataKey::RegistryContractId).unwrap();
        let asset_token_id: Address = env.storage().instance().get(&DataKey::AssetTokenId).unwrap();

        let target_ngo_addr = target_ngo.clone();
        let target_ngo = IntoVal::<Env, soroban_sdk::Val>::into_val(&target_ngo, &env);

        // 3. Invoke validation check on registry using user's required literal pattern
        let is_verified = env.invoke_contract::<bool>(
            &registry_contract_id,
            &Symbol::new(&env, "validate_recipient"),
            vec![&env, target_ngo],
        );

        if !is_verified {
            return Err(Error::UnverifiedRecipient);
        }

        // 4. Gracefully block routing requests exceeding available pooled capital balances
        let current_balance = token::Client::new(&env, &asset_token_id).balance(&env.current_contract_address());
        if amount > current_balance {
            return Err(Error::InsufficientFunds);
        }

        // 5. Transfer funds from router contract storage directly to the target NGO address
        token::Client::new(&env, &asset_token_id).transfer(
            &env.current_contract_address(),
            &target_ngo_addr,
            &amount,
        );

        // 6. Emit a Soroban execution event tracking the recipient, amount, and timestamp
        env.events().publish(
            (Symbol::short("disburse"), target_ngo_addr, env.ledger().timestamp()),
            amount,
        );

        Ok(())
    }

    // Parameter alteration routines requiring admin validation
    pub fn update_campaign_active(env: Env, active: bool) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::CampaignActive, &active);
        Ok(())
    }

    pub fn update_registry(env: Env, new_registry: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::RegistryContractId, &new_registry);
        Ok(())
    }

    pub fn update_asset(env: Env, new_asset: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::AssetTokenId, &new_asset);
        Ok(())
    }

    // Getters for integration verification
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)
    }

    pub fn get_registry(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::RegistryContractId).ok_or(Error::NotInitialized)
    }

    pub fn get_asset(env: Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::AssetTokenId).ok_or(Error::NotInitialized)
    }

    pub fn get_campaign_active(env: Env) -> Result<bool, Error> {
        env.storage().instance().get(&DataKey::CampaignActive).ok_or(Error::NotInitialized)
    }

    pub fn get_campaign_name(env: Env) -> Result<String, Error> {
        env.storage().instance().get(&DataKey::CampaignName).ok_or(Error::NotInitialized)
    }
}

mod test;
