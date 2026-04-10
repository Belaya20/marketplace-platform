// src/migrations/20240101120000_create_discount_codes.ts
// Place at: src/migrations/20240101120000_create_discount_codes.ts
// ────────────────────────────────────────────────────────────────
// Run with:  pnpm migrate
// Roll back: pnpm migrate:down

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('discount_codes', (t) => {
    t.uuid('id').primary();

    // Owner — the seller who created this code
    t.uuid('seller_id')
      .notNullable()
      .references('id')
      .inTable('seller_profiles')
      .onDelete('CASCADE');

    // Code string — always stored UPPERCASE, unique per seller
    t.string('code', 64).notNullable();

    // Discount type
    t.enum('type', ['percentage', 'fixed_amount', 'free_shipping']).notNullable();

    // Discount value — 0 for free_shipping
    t.decimal('value', 10, 2).notNullable().defaultTo(0);

    // Minimum cart total required to apply the code (0 = no minimum)
    t.decimal('min_order', 10, 2).notNullable().defaultTo(0);

    // null = unlimited uses
    t.integer('usage_limit').nullable();

    // Incremented each time the code is successfully applied
    t.integer('usage_count').notNullable().defaultTo(0);

    // Active window
    t.timestamp('starts_at',  { useTz: true }).notNullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();

    // Sellers can pause a code without deleting it
    t.boolean('is_active').notNullable().defaultTo(true);

    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Same seller cannot have two codes with the same name
    t.unique(['seller_id', 'code']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('discount_codes');
}