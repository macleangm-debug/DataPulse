"""
DataPulse - Scalability Configuration

This module contains configuration for handling large-scale data processing:
- Data sampling thresholds
- Pagination limits
- Rate limiting settings
- Background job configuration
"""

import os

# Data Processing Limits
MAX_ROWS_IN_MEMORY = 50000  # Maximum rows to load into memory at once
SAMPLING_THRESHOLD = 10000  # Auto-sample if dataset exceeds this
DEFAULT_SAMPLE_SIZE = 10000  # Default sample size for large datasets
CHUNK_SIZE = 5000  # Rows per chunk for streaming operations

# Pagination
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 1000

# Rate Limiting (requests per minute)
RATE_LIMIT_STATS = "30/minute"  # Heavy statistical operations
RATE_LIMIT_EXPORT = "10/minute"  # Export operations
RATE_LIMIT_GENERAL = "100/minute"  # General API calls

# Background Jobs
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
JOB_TIMEOUT = 300  # 5 minutes max for background jobs
JOB_CLEANUP_AFTER = 3600  # Clean up job results after 1 hour

# MongoDB Connection Pool
MONGO_MIN_POOL_SIZE = 5
MONGO_MAX_POOL_SIZE = 50
MONGO_MAX_IDLE_TIME_MS = 30000

# File Processing
MAX_UPLOAD_SIZE_MB = 100
STREAM_CHUNK_SIZE = 8192  # Bytes for streaming responses

# Progress Tracking
PROGRESS_UPDATE_INTERVAL = 1000  # Update progress every N rows
