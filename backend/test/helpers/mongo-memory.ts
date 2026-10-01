/**
 * TASK 2.1 (helpers) - Instancia de teste do MongoDB (Replica Set em memoria).
 *
 * Motivos da decisao de design:
 *  1. O motor financeiro usa sessoes ACID multi-documento (RULES.md secao 2.2);
 *     standalone mongod NAO suporta transacoes — por isso o ambiente sobe um
 *     REPLICA SET local via mongodb-memory-server (`MongoMemoryReplSet`).
 *  2. Versao pinada em 7.0.14: binarios MongoDB < 7.0.3 nao existem para
 *     Debian 12+ (verificado na execucao da suite).
 *  3. Binario baixado uma unica vez e cacheado no host (.cache/mongodb-binaries).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const MONGO_TEST_VERSION = process.env.MONGOMS_VERSION ?? '7.0.14';

let replSet: MongoMemoryReplSet | undefined;

export async function startMemoryReplicaSet(): Promise<MongoMemoryReplSet> {
  if (!replSet) {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      binary: { version: MONGO_TEST_VERSION },
    });
  }
  return replSet;
}

/** URI de banco de teste (database isolado por suíte). */
export function getMemoryUri(set: MongoMemoryReplSet, db = 'fincore_test'): string {
  return set.getUri(db);
}

export async function stopMemoryReplicaSet(): Promise<void> {
  if (replSet) {
    await replSet.stop();
    replSet = undefined;
  }
}
