#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/32b6be56625d0ad0556caddd50ef14e131eff0bb63da2c477a7588bbb9896165/contract';
import startContract from '../../snapshots/32b6be56625d0ad0556caddd50ef14e131eff0bb63da2c477a7588bbb9896165/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f5da6bdb5eff81fb8662a2a451341c04ef118b85a9303a08c5ad6f0cfa813e00/contract';
import endContract from '../../snapshots/f5da6bdb5eff81fb8662a2a451341c04ef118b85a9303a08c5ad6f0cfa813e00/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'TaxSettings',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('gstin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hsnCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'int4', { notNull: true, default: lit(1), codecRef: { codecId: 'pg/int4@1' } }),
          col('iec', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('invoiceNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('legalName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('pan', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamp(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamp-date@1', typeParams: { precision: 3 } },
          }),
          col('updatedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      // One row only, like StoreSettings.
      this.addCheckConstraint({
        schema: 'public',
        table: 'TaxSettings',
        constraint: 'TaxSettings_singleton',
        expression: '"id" = 1',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
