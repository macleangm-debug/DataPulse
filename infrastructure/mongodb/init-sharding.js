// MongoDB Sharding Initialization Script
// Run on mongos after cluster is set up

// Connect to mongos
// mongo mongodb://mongos:27017

// Enable sharding on database
sh.enableSharding("datapulse");

// ============================================================================
// SHARD KEY STRATEGIES
// ============================================================================

// Submissions collection - Shard by org_id (hashed for even distribution)
// This ensures data for each organization is distributed across shards
sh.shardCollection("datapulse.submissions", { "org_id": "hashed" });

// Alternative: Compound shard key for time-series queries
// sh.shardCollection("datapulse.submissions", { "org_id": 1, "submitted_at": 1 });

// Forms collection - Shard by org_id
sh.shardCollection("datapulse.forms", { "org_id": "hashed" });

// Users collection - Shard by email (hashed)
sh.shardCollection("datapulse.users", { "email": "hashed" });

// Chat sessions - Shard by session_id (hashed)
sh.shardCollection("datapulse.chat_sessions", { "session_id": "hashed" });

// Audit logs - Shard by org_id and timestamp for range queries
sh.shardCollection("datapulse.audit_logs", { "org_id": 1, "timestamp": 1 });

// Bulk operation logs - Shard by batch_id
sh.shardCollection("datapulse.bulk_operation_logs", { "batch_id": "hashed" });

// ============================================================================
// ZONE SHARDING (Optional - for data locality)
// ============================================================================

// Example: Route EU data to EU shard
// sh.addShardTag("shard1-rs", "EU");
// sh.addShardTag("shard2-rs", "US");
// sh.addShardTag("shard3-rs", "APAC");

// sh.addTagRange(
//     "datapulse.submissions",
//     { "region": "EU" },
//     { "region": "EV" },
//     "EU"
// );

// ============================================================================
// CHUNK SIZE CONFIGURATION
// ============================================================================

// Set chunk size (default is 128MB, reduce for more granular distribution)
use config;
db.settings.updateOne(
    { _id: "chunksize" },
    { $set: { value: 64 } },
    { upsert: true }
);

// ============================================================================
// BALANCER CONFIGURATION
// ============================================================================

// Enable balancer
sh.startBalancer();

// Set balancer window (optional - run only during off-peak hours)
// use config;
// db.settings.updateOne(
//     { _id: "balancer" },
//     { $set: { activeWindow: { start: "02:00", stop: "06:00" } } },
//     { upsert: true }
// );

// ============================================================================
// MONITORING COMMANDS
// ============================================================================

// Check sharding status
// sh.status();

// Check chunk distribution
// db.submissions.getShardDistribution();

// Check balancer status
// sh.getBalancerState();
// sh.isBalancerRunning();

// ============================================================================
// INDEX HINTS
// ============================================================================

// Ensure indexes exist on shard key fields
db.submissions.createIndex({ "org_id": "hashed" });
db.submissions.createIndex({ "org_id": 1, "submitted_at": -1 });
db.submissions.createIndex({ "form_id": 1, "submitted_at": -1 });
db.submissions.createIndex({ "batch_id": 1 });

db.forms.createIndex({ "org_id": "hashed" });
db.forms.createIndex({ "org_id": 1, "status": 1 });

db.users.createIndex({ "email": "hashed" });
db.users.createIndex({ "email": 1 }, { unique: true });

db.chat_sessions.createIndex({ "session_id": "hashed" });
db.chat_sessions.createIndex({ "session_id": 1 }, { unique: true });

print("Sharding initialization complete!");
print("Run sh.status() to verify configuration.");
