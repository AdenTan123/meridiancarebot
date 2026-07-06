import mongoose from 'mongoose';
import { logger } from './logger.js';

const kvStoreSchema = new mongoose.Schema({
    _id: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    expiresAt: { type: Date, default: null },
}, {
    timestamps: false,
    strict: false,
    _id: false,
});

kvStoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const verificationAuditSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    action: { type: String, required: true },
    source: { type: String, default: null },
    moderatorId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
});

let KVStore;
let VerificationAudit;

function getModels() {
    const conn = mongoose.connection;
    KVStore = conn.models.KVStore || conn.model('KVStore', kvStoreSchema);
    VerificationAudit = conn.models.VerificationAudit || conn.model('VerificationAudit', verificationAuditSchema);
    return { KVStore, VerificationAudit };
}

class MongoDBDatabase {
    constructor() {
        this.isConnected = false;
        this.connectionPromise = null;
        this.lastFailureReason = null;
        this.lastFailureMessage = null;
        this.uri = process.env.MONGODB_URI || null;
    }

    async connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this._establishConnection();
        return this.connectionPromise;
    }

    async _establishConnection() {
        if (!this.uri) {
            this.lastFailureReason = 'MONGODB_URI_NOT_SET';
            this.lastFailureMessage = 'MONGODB_URI environment variable is not set';
            return false;
        }

        try {
            await mongoose.connect(this.uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
            });

            getModels();

            this.isConnected = true;
            this.lastFailureReason = null;
            this.lastFailureMessage = null;
            logger.info('MongoDB Database initialized successfully');
            return true;
        } catch (error) {
            this.lastFailureReason = 'MONGODB_CONNECTION_FAILED';
            this.lastFailureMessage = error.message;
            this.isConnected = false;
            logger.error('Failed to initialize MongoDB Database:', error);
            return false;
        }
    }

    isAvailable() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    getLastFailure() {
        return {
            reason: this.lastFailureReason,
            message: this.lastFailureMessage,
        };
    }

    async get(key, defaultValue = null) {
        try {
            if (!this.isAvailable()) {
                return defaultValue;
            }

            const { KVStore } = getModels();
            const doc = await KVStore.findById(key);

            if (!doc) {
                return defaultValue;
            }

            if (doc.expiresAt && doc.expiresAt <= new Date()) {
                await KVStore.deleteOne({ _id: key });
                return defaultValue;
            }

            return doc.value !== undefined ? doc.value : defaultValue;
        } catch (error) {
            logger.error(`Error getting value for key ${key}:`, error);
            return defaultValue;
        }
    }

    async set(key, value, ttl = null) {
        try {
            if (!this.isAvailable()) {
                logger.warn('MongoDB not available, cannot set value');
                return false;
            }

            const { KVStore } = getModels();
            const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;

            await KVStore.findOneAndUpdate(
                { _id: key },
                { value, expiresAt },
                { upsert: true, new: true },
            );

            return true;
        } catch (error) {
            logger.error(`Error setting value for key ${key}:`, error);
            return false;
        }
    }

    async delete(key) {
        try {
            if (!this.isAvailable()) {
                logger.warn('MongoDB not available, cannot delete key');
                return false;
            }

            const { KVStore } = getModels();
            await KVStore.deleteOne({ _id: key });
            return true;
        } catch (error) {
            logger.error(`Error deleting key ${key}:`, error);
            return false;
        }
    }

    async list(prefix) {
        try {
            if (!this.isAvailable()) {
                logger.warn('MongoDB not available, returning empty list');
                return [];
            }

            const { KVStore } = getModels();
            const docs = await KVStore.find({
                _id: { $regex: `^${prefix}` },
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } },
                ],
            }).select('_id').lean();

            return docs.map(doc => doc._id);
        } catch (error) {
            logger.error(`Error listing keys with prefix ${prefix}:`, error);
            return [];
        }
    }

    async exists(key) {
        try {
            if (!this.isAvailable()) {
                return false;
            }

            const { KVStore } = getModels();
            const doc = await KVStore.findById(key);

            if (!doc) {
                return false;
            }

            if (doc.expiresAt && doc.expiresAt <= new Date()) {
                await KVStore.deleteOne({ _id: key });
                return false;
            }

            return true;
        } catch (error) {
            logger.error(`Error checking if key exists ${key}:`, error);
            return false;
        }
    }

    async increment(key, amount = 1) {
        try {
            if (!this.isAvailable()) {
                return amount;
            }

            const currentValue = await this.get(key, 0);
            const numericValue = typeof currentValue === 'number' ? currentValue : 0;
            const newValue = numericValue + amount;
            await this.set(key, newValue);
            return newValue;
        } catch (error) {
            logger.error(`Error incrementing key ${key}:`, error);
            return amount;
        }
    }

    async decrement(key, amount = 1) {
        try {
            if (!this.isAvailable()) {
                return -amount;
            }

            const currentValue = await this.get(key, 0);
            const numericValue = typeof currentValue === 'number' ? currentValue : 0;
            const newValue = numericValue - amount;
            await this.set(key, newValue);
            return newValue;
        } catch (error) {
            logger.error(`Error decrementing key ${key}:`, error);
            return -amount;
        }
    }

    async insertVerificationAudit(record) {
        try {
            if (!this.isAvailable()) {
                return false;
            }

            const { VerificationAudit } = getModels();
            await VerificationAudit.create({
                guildId: record.guildId,
                userId: record.userId,
                action: record.action,
                source: record.source || null,
                moderatorId: record.moderatorId || null,
                metadata: record.metadata || {},
                createdAt: record.createdAt || new Date(),
            });

            return true;
        } catch (error) {
            logger.error('Error inserting verification audit:', error);
            return false;
        }
    }

    async disconnect() {
        try {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
                logger.info('MongoDB connection closed');
            }
        } catch (error) {
            logger.error('Error closing MongoDB connection:', error);
        }
    }
}

export const mongoDb = new MongoDBDatabase();
