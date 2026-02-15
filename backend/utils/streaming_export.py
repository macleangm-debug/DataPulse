"""
DataPulse - Streaming Exports

Memory-efficient streaming exports for large datasets.
"""

import csv
import io
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
from fastapi.responses import StreamingResponse
import pandas as pd

from config.scalability import CHUNK_SIZE, STREAM_CHUNK_SIZE


async def stream_csv_response(
    data_generator: AsyncGenerator[List[Dict], None],
    filename: str,
    columns: Optional[List[str]] = None
) -> StreamingResponse:
    """
    Create a streaming CSV response from a data generator.
    
    Args:
        data_generator: Async generator yielding chunks of data
        filename: Output filename
        columns: Column names (if None, inferred from first row)
    """
    async def generate():
        header_written = False
        
        async for chunk in data_generator:
            if not chunk:
                continue
            
            output = io.StringIO()
            
            # Get columns from first chunk if not provided
            nonlocal columns
            if columns is None:
                columns = list(chunk[0].keys()) if chunk else []
            
            writer = csv.DictWriter(output, fieldnames=columns, extrasaction='ignore')
            
            # Write header only once
            if not header_written:
                writer.writeheader()
                header_written = True
            
            for row in chunk:
                writer.writerow(row)
            
            yield output.getvalue().encode('utf-8')
    
    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff"
        }
    )


async def stream_json_response(
    data_generator: AsyncGenerator[List[Dict], None],
    filename: str
) -> StreamingResponse:
    """
    Create a streaming JSON response from a data generator.
    Outputs JSON Lines format for efficient streaming.
    """
    async def generate():
        yield b'[\n'
        first = True
        
        async for chunk in data_generator:
            for row in chunk:
                if not first:
                    yield b',\n'
                first = False
                yield json.dumps(row).encode('utf-8')
        
        yield b'\n]'
    
    return StreamingResponse(
        generate(),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


async def stream_jsonl_response(
    data_generator: AsyncGenerator[List[Dict], None],
    filename: str
) -> StreamingResponse:
    """
    Create a streaming JSON Lines response.
    Each line is a valid JSON object.
    """
    async def generate():
        async for chunk in data_generator:
            for row in chunk:
                yield (json.dumps(row) + '\n').encode('utf-8')
    
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


def dataframe_to_chunks(
    df: pd.DataFrame,
    chunk_size: int = CHUNK_SIZE
) -> List[List[Dict]]:
    """
    Convert DataFrame to list of chunks for streaming.
    
    Args:
        df: DataFrame to convert
        chunk_size: Rows per chunk
    
    Returns:
        List of chunks, each chunk is a list of dicts
    """
    chunks = []
    for i in range(0, len(df), chunk_size):
        chunk_df = df.iloc[i:i + chunk_size]
        chunks.append(chunk_df.to_dict('records'))
    return chunks


async def async_dataframe_chunks(
    df: pd.DataFrame,
    chunk_size: int = CHUNK_SIZE
) -> AsyncGenerator[List[Dict], None]:
    """
    Async generator that yields DataFrame chunks.
    """
    for i in range(0, len(df), chunk_size):
        chunk_df = df.iloc[i:i + chunk_size]
        yield chunk_df.to_dict('records')


class ProgressTrackingExporter:
    """
    Export with progress tracking for UI feedback.
    """
    
    def __init__(self, total_rows: int, progress_callback=None):
        self.total_rows = total_rows
        self.processed_rows = 0
        self.progress_callback = progress_callback
    
    async def export_chunk(self, chunk: List[Dict]) -> List[Dict]:
        """Process a chunk and update progress"""
        self.processed_rows += len(chunk)
        
        if self.progress_callback:
            progress = int((self.processed_rows / self.total_rows) * 100)
            await self.progress_callback(progress, f"Exported {self.processed_rows}/{self.total_rows} rows")
        
        return chunk
