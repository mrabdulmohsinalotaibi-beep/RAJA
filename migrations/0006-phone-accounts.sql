-- The existing email column is the unique canonical login key. For a phone
-- account it stores the normalized phone key; public profiles expose phone,
-- and an empty email. Existing email accounts and foreign keys are preserved.
ALTER TABLE raja_accounts ADD COLUMN phone TEXT;
CREATE UNIQUE INDEX raja_accounts_phone ON raja_accounts(phone) WHERE phone IS NOT NULL;
