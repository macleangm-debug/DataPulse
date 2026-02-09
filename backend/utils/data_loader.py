"""
DataPulse - Scalable Data Loader

Memory-safe data loading with:
- Cursor-based pagination
- Automatic sampling for large datasets
- Chunked processing
- Progress tracking
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple, List, Dict, AsyncGenerator, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio
import random

from config.scalability import (
    MAX_ROWS_IN_MEMORY,
    SAMPLING_THRESHOLD,
    DEFAULT_SAMPLE_SIZE,
    CHUNK_SIZE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PROGRESS_UPDATE_INTERVAL
)


class DataLoadResult:
    """Result of data loading operation"""
    def __init__(
        self,
        data: pd.DataFrame,
        schema: List[dict],
        total_count: int,
        is_sampled: bool = False,
        sample_size: Optional[int] = None
    ):
        self.data = data
        self.schema = schema
        self.total_count = total_count
        self.is_sampled = is_sampled
        self.sample_size = sample_size
    
    def to_dict(self) -> dict:
        return {
            "row_count": len(self.data),
            "total_count": self.total_count,
            "is_sampled": self.is_sampled,
            "sample_size": self.sample_size,
            "columns": list(self.data.columns)
        }


async def get_collection_count(
    db: AsyncIOMotorDatabase,
    collection: str,
    query: dict
) -> int:
    """Get count of documents matching query"""
    return await db[collection].count_documents(query)


async def load_data_paginated(
    db: AsyncIOMotorDatabase,
    collection: str,
    query: dict,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    projection: Optional[dict] = None
) -> Tuple[List[dict], int]:
    """
    Load data with cursor-based pagination
    
    Returns:
        Tuple of (documents, total_count)
    """
    page_size = min(page_size, MAX_PAGE_SIZE)
    skip = (page - 1) * page_size
    
    total_count = await get_collection_count(db, collection, query)
    
    cursor = db[collection].find(query, projection).skip(skip).limit(page_size)
    documents = await cursor.to_list(length=page_size)
    
    return documents, total_count


async def load_data_sampled(
    db: AsyncIOMotorDatabase,
    collection: str,
    query: dict,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    projection: Optional[dict] = None
) -> Tuple[List[dict], int]:
    """
    Load a random sample of data using MongoDB aggregation
    
    Returns:
        Tuple of (sampled_documents, total_count)
    """
    total_count = await get_collection_count(db, collection, query)
    
    if total_count <= sample_size:
        # Load all if under sample size
        documents = await db[collection].find(query, projection).to_list(length=total_count)
        return documents, total_count
    
    # Use MongoDB $sample for random sampling
    pipeline = [
        {"$match": query},
        {"$sample": {"size": sample_size}}
    ]
    
    if projection:
        pipeline.append({"$project": projection})
    
    documents = await db[collection].aggregate(pipeline).to_list(length=sample_size)
    return documents, total_count


async def stream_data_chunks(
    db: AsyncIOMotorDatabase,
    collection: str,
    query: dict,
    chunk_size: int = CHUNK_SIZE,
    projection: Optional[dict] = None
) -> AsyncGenerator[List[dict], None]:
    """
    Stream data in chunks for memory-efficient processing
    
    Yields:
        Lists of documents in chunks
    """
    cursor = db[collection].find(query, projection).batch_size(chunk_size)
    
    chunk = []
    async for doc in cursor:
        chunk.append(doc)
        if len(chunk) >= chunk_size:
            yield chunk
            chunk = []
    
    if chunk:
        yield chunk


async def load_analysis_data(
    db: AsyncIOMotorDatabase,
    snapshot_id: Optional[str] = None,
    form_id: Optional[str] = None,
    sample: bool = True,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    max_rows: int = MAX_ROWS_IN_MEMORY
) -> DataLoadResult:
    """
    Load data for analysis with automatic sampling for large datasets
    
    Args:
        db: Database connection
        snapshot_id: Optional snapshot ID to load from
        form_id: Optional form ID to load submissions from
        sample: Whether to auto-sample large datasets
        sample_size: Size of sample if sampling
        max_rows: Maximum rows to load into memory
    
    Returns:
        DataLoadResult with data, schema, and metadata
    """
    if snapshot_id:
        # Load from snapshot
        snapshot = await db.snapshots.find_one({"_id": snapshot_id})
        if not snapshot:
            return DataLoadResult(pd.DataFrame(), [], 0)
        
        data = snapshot.get("data", [])
        schema = snapshot.get("schema", [])
        total_count = len(data)
        
        # Sample if needed
        if sample and total_count > sample_size:
            indices = random.sample(range(total_count), sample_size)
            data = [data[i] for i in sorted(indices)]
            return DataLoadResult(
                pd.DataFrame(data),
                schema,
                total_count,
                is_sampled=True,
                sample_size=sample_size
            )
        
        return DataLoadResult(pd.DataFrame(data), schema, total_count)
    
    elif form_id:
        # Load from submissions
        form = await db.forms.find_one({"id": form_id})
        schema = form.get("fields", []) if form else []
        
        query = {"form_id": form_id}
        total_count = await get_collection_count(db, "submissions", query)
        
        # Determine loading strategy
        if total_count > max_rows:
            # Force sampling for very large datasets
            documents, _ = await load_data_sampled(
                db, "submissions", query,
                sample_size=min(sample_size, max_rows)
            )
            data = [doc.get("data", {}) for doc in documents]
            return DataLoadResult(
                pd.DataFrame(data),
                schema,
                total_count,
                is_sampled=True,
                sample_size=len(data)
            )
        
        elif sample and total_count > sample_size:
            # Sample for moderately large datasets
            documents, _ = await load_data_sampled(
                db, "submissions", query,
                sample_size=sample_size
            )
            data = [doc.get("data", {}) for doc in documents]
            return DataLoadResult(
                pd.DataFrame(data),
                schema,
                total_count,
                is_sampled=True,
                sample_size=len(data)
            )
        
        else:
            # Load all for small datasets
            documents = await db.submissions.find(query).to_list(length=max_rows)
            data = [doc.get("data", {}) for doc in documents]
            return DataLoadResult(pd.DataFrame(data), schema, total_count)
    
    return DataLoadResult(pd.DataFrame(), [], 0)


async def process_data_in_chunks(
    db: AsyncIOMotorDatabase,
    collection: str,
    query: dict,
    processor: callable,
    chunk_size: int = CHUNK_SIZE,
    progress_callback: Optional[callable] = None
) -> List[Any]:
    """
    Process large datasets in chunks with progress tracking
    
    Args:
        db: Database connection
        collection: Collection name
        query: Query filter
        processor: Function to process each chunk
        chunk_size: Size of each chunk
        progress_callback: Optional callback(processed, total) for progress updates
    
    Returns:
        List of results from each chunk
    """
    total_count = await get_collection_count(db, collection, query)
    processed = 0
    results = []
    
    async for chunk in stream_data_chunks(db, collection, query, chunk_size):
        result = await processor(chunk) if asyncio.iscoroutinefunction(processor) else processor(chunk)
        results.append(result)
        
        processed += len(chunk)
        if progress_callback and processed % PROGRESS_UPDATE_INTERVAL < chunk_size:
            await progress_callback(processed, total_count)
    
    return results


def sample_dataframe(
    df: pd.DataFrame,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
    random_state: int = 42
) -> Tuple[pd.DataFrame, bool]:
    """
    Sample a DataFrame if it exceeds the threshold
    
    Returns:
        Tuple of (sampled_df, was_sampled)
    """
    if len(df) <= sample_size:
        return df, False
    
    return df.sample(n=sample_size, random_state=random_state), True
