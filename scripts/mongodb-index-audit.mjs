import "dotenv/config";
import mongoose from "mongoose";

const requested = [
  { label: "users", actual: "users" },
  { label: "meetings", actual: "meetings" },
  { label: "messages", actual: "chatmessages" },
  { label: "notifications", actual: "notifications" },
  { label: "tasks", actual: "tasks" },
  { label: "teams", actual: "teams" },
];

const TYPE_MAP = new Map([
  [1, "btree-asc"],
  [-1, "btree-desc"],
  ["text", "text"],
  ["hashed", "hashed"],
  ["2dsphere", "2dsphere"],
  ["2d", "2d"],
  ["geoHaystack", "geoHaystack"],
]);

function normalizeObject(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeObject);

  return Object.keys(value)
    .sort()
    .reduce((accumulator, key) => {
      accumulator[key] = normalizeObject(value[key]);
      return accumulator;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalizeObject(value));
}

function keyEntries(key) {
  return Object.entries(key || {});
}

function hasSameKeyPattern(left, right) {
  return stableStringify(left?.key) === stableStringify(right?.key);
}

function optionsSignature(indexDef) {
  return stableStringify({
    unique: !!indexDef.unique,
    sparse: !!indexDef.sparse,
    partialFilterExpression: indexDef.partialFilterExpression || null,
    collation: indexDef.collation || null,
    expireAfterSeconds: indexDef.expireAfterSeconds ?? null,
  });
}

function beginsWithKey(candidateSuperset, candidatePrefix) {
  const superset = keyEntries(candidateSuperset);
  const prefix = keyEntries(candidatePrefix);

  if (prefix.length > superset.length) return false;

  for (let index = 0; index < prefix.length; index += 1) {
    if (
      superset[index][0] !== prefix[index][0] ||
      superset[index][1] !== prefix[index][1]
    ) {
      return false;
    }
  }

  return true;
}

async function runAudit() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI missing");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;

  const perCollection = [];
  const allIndexes = [];

  const findings = {
    duplicateIndexes: [],
    conflictingIndexes: [],
    redundantIndexes: [],
    unusedIndexesByStats: [],
    requirementCoverage: [],
  };

  for (const target of requested) {
    const collection = db.collection(target.actual);
    const [indexes, stats] = await Promise.all([
      collection.indexes(),
      collection.aggregate([{ $indexStats: {} }]).toArray().catch(() => []),
    ]);

    const statsByName = new Map(stats.map((entry) => [entry.name, entry]));

    const enrichedIndexes = indexes.map((indexDef) => {
      const keys = keyEntries(indexDef.key).map(([field, direction]) => ({
        field,
        direction,
        type: TYPE_MAP.get(direction) || String(direction),
      }));

      const usageOps = statsByName.get(indexDef.name)?.accesses?.ops ?? null;

      return {
        requestedCollection: target.label,
        actualCollection: target.actual,
        indexName: indexDef.name,
        key: indexDef.key,
        indexType: keys.length === 1 ? keys[0].type : "compound",
        uniqueness: !!indexDef.unique,
        sparse: !!indexDef.sparse,
        partialFilterExpression: indexDef.partialFilterExpression || null,
        collation: indexDef.collation || null,
        expireAfterSeconds: indexDef.expireAfterSeconds ?? null,
        usageOps,
      };
    });

    perCollection.push({
      requestedCollection: target.label,
      actualCollection: target.actual,
      indexes: enrichedIndexes,
    });

    allIndexes.push(...enrichedIndexes);

    for (let left = 0; left < enrichedIndexes.length; left += 1) {
      for (
        let right = left + 1;
        right < enrichedIndexes.length;
        right += 1
      ) {
        const indexLeft = enrichedIndexes[left];
        const indexRight = enrichedIndexes[right];

        if (!hasSameKeyPattern(indexLeft, indexRight)) continue;

        if (optionsSignature(indexLeft) === optionsSignature(indexRight)) {
          findings.duplicateIndexes.push({
            collection: target.actual,
            indexA: indexLeft.indexName,
            indexB: indexRight.indexName,
            key: indexLeft.key,
          });
        } else {
          findings.conflictingIndexes.push({
            collection: target.actual,
            indexA: indexLeft.indexName,
            indexB: indexRight.indexName,
            key: indexLeft.key,
            optionsA: JSON.parse(optionsSignature(indexLeft)),
            optionsB: JSON.parse(optionsSignature(indexRight)),
          });
        }
      }
    }

    const nonIdIndexes = enrichedIndexes.filter(
      (indexDef) => indexDef.indexName !== "_id_"
    );

    for (const candidate of nonIdIndexes) {
      for (const covering of nonIdIndexes) {
        if (candidate.indexName === covering.indexName) continue;

        const candidateLength = keyEntries(candidate.key).length;
        const coveringLength = keyEntries(covering.key).length;
        if (coveringLength <= candidateLength) continue;

        if (!beginsWithKey(covering.key, candidate.key)) continue;

        const safeToMarkRedundant =
          !candidate.uniqueness &&
          !candidate.sparse &&
          !candidate.partialFilterExpression &&
          !candidate.expireAfterSeconds;

        if (safeToMarkRedundant) {
          findings.redundantIndexes.push({
            collection: target.actual,
            redundantIndex: candidate.indexName,
            coveredByIndex: covering.indexName,
            key: candidate.key,
            coveredByKey: covering.key,
          });
          break;
        }
      }
    }

    for (const indexDef of nonIdIndexes) {
      if ((indexDef.usageOps ?? 0) === 0) {
        findings.unusedIndexesByStats.push({
          collection: target.actual,
          indexName: indexDef.indexName,
          key: indexDef.key,
          usageOps: indexDef.usageOps,
        });
      }
    }
  }

  findings.requirementCoverage = [
    {
      name: "email indexed",
      pass: allIndexes.some(
        (indexDef) =>
          indexDef.actualCollection === "users" &&
          Object.hasOwn(indexDef.key, "email")
      ),
    },
    {
      name: "meetingCode indexed",
      pass: allIndexes.some(
        (indexDef) =>
          indexDef.actualCollection === "meetings" &&
          Object.hasOwn(indexDef.key, "meetingCode")
      ),
    },
    {
      name: "participants indexed",
      pass: allIndexes.some(
        (indexDef) =>
          indexDef.actualCollection === "meetings" &&
          Object.hasOwn(indexDef.key, "participants")
      ),
    },
    {
      name: "createdAt indexed",
      pass: allIndexes.some((indexDef) => Object.hasOwn(indexDef.key, "createdAt")),
    },
    {
      name: "user references indexed",
      pass: allIndexes.some(
        (indexDef) =>
          ["notifications", "tasks", "meetings", "chatmessages"].includes(
            indexDef.actualCollection
          ) &&
          ["user", "host", "sender", "assignee", "createdBy", "participants"].some(
            (field) => Object.hasOwn(indexDef.key, field)
          )
      ),
    },
    {
      name: "room/meeting lookup indexed",
      pass: allIndexes.some(
        (indexDef) =>
          ["chatmessages", "meetings"].includes(indexDef.actualCollection) &&
          ["meeting", "meetingCode"].some((field) => Object.hasOwn(indexDef.key, field))
      ),
    },
  ];

  const uniqueRequired = [
    {
      collection: "users",
      field: "email",
      pass: allIndexes.some(
        (indexDef) =>
          indexDef.actualCollection === "users" &&
          indexDef.uniqueness &&
          Object.hasOwn(indexDef.key, "email")
      ),
    },
    {
      collection: "meetings",
      field: "meetingCode",
      pass: allIndexes.some(
        (indexDef) =>
          indexDef.actualCollection === "meetings" &&
          indexDef.uniqueness &&
          Object.hasOwn(indexDef.key, "meetingCode")
      ),
    },
  ];

  const output = {
    generatedAt: new Date().toISOString(),
    database: db.databaseName,
    collectionsAudited: requested,
    perCollection,
    uniqueRequired,
    findings,
  };

  console.log(JSON.stringify(output, null, 2));
}

runAudit()
  .catch((error) => {
    console.error("Index audit failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });