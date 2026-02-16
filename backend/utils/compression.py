"""
DataPulse - Response Compression Middleware
Enables gzip/brotli compression for API responses
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
import gzip
import io
from typing import Callable
import logging

logger = logging.getLogger(__name__)

# Try to import brotli, fallback to gzip only
try:
    import brotli
    BROTLI_AVAILABLE = True
except ImportError:
    BROTLI_AVAILABLE = False
    logger.info("Brotli not available, using gzip compression only")


class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to compress responses using gzip or brotli.
    Automatically selects best compression based on Accept-Encoding header.
    """
    
    # Minimum size to compress (bytes)
    MIN_SIZE = 500
    
    # Content types to compress
    COMPRESSIBLE_TYPES = {
        'application/json',
        'text/plain',
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/xml',
        'text/xml',
        'application/ld+json',
    }
    
    # Compression level (1-9 for gzip, 0-11 for brotli)
    GZIP_LEVEL = 6
    BROTLI_LEVEL = 4
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get accepted encodings
        accept_encoding = request.headers.get('Accept-Encoding', '')
        
        # Call the next middleware/endpoint
        response = await call_next(request)
        
        # Skip compression for streaming responses or small responses
        if isinstance(response, StreamingResponse):
            return response
        
        # Get response body
        body = b''
        async for chunk in response.body_iterator:
            body += chunk
        
        # Check if we should compress
        content_type = response.headers.get('Content-Type', '')
        base_content_type = content_type.split(';')[0].strip()
        
        if (
            len(body) < self.MIN_SIZE or
            base_content_type not in self.COMPRESSIBLE_TYPES or
            'Content-Encoding' in response.headers
        ):
            # Return original response
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )
        
        # Choose compression method
        compressed_body = None
        encoding = None
        
        if BROTLI_AVAILABLE and 'br' in accept_encoding:
            try:
                compressed_body = brotli.compress(body, quality=self.BROTLI_LEVEL)
                encoding = 'br'
            except Exception as e:
                logger.debug(f"Brotli compression failed: {e}")
        
        if compressed_body is None and 'gzip' in accept_encoding:
            try:
                buffer = io.BytesIO()
                with gzip.GzipFile(mode='wb', fileobj=buffer, compresslevel=self.GZIP_LEVEL) as f:
                    f.write(body)
                compressed_body = buffer.getvalue()
                encoding = 'gzip'
            except Exception as e:
                logger.debug(f"Gzip compression failed: {e}")
        
        # If compression didn't help or failed, return original
        if compressed_body is None or len(compressed_body) >= len(body):
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )
        
        # Return compressed response
        headers = dict(response.headers)
        headers['Content-Encoding'] = encoding
        headers['Content-Length'] = str(len(compressed_body))
        headers['Vary'] = 'Accept-Encoding'
        
        return Response(
            content=compressed_body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type
        )


class GzipMiddleware:
    """
    Alternative lightweight gzip middleware using Starlette's built-in.
    Use this for simpler gzip-only compression.
    """
    
    def __init__(self, app, minimum_size: int = 500, compresslevel: int = 6):
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel
    
    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        
        # Check if client accepts gzip
        headers = dict(scope.get('headers', []))
        accept_encoding = headers.get(b'accept-encoding', b'').decode()
        
        if 'gzip' not in accept_encoding:
            await self.app(scope, receive, send)
            return
        
        # Wrap send to compress response
        body_parts = []
        initial_headers = []
        status_code = None
        
        async def compressed_send(message):
            nonlocal body_parts, initial_headers, status_code
            
            if message['type'] == 'http.response.start':
                status_code = message['status']
                initial_headers = list(message.get('headers', []))
                return
            
            if message['type'] == 'http.response.body':
                body = message.get('body', b'')
                body_parts.append(body)
                
                if not message.get('more_body', False):
                    # Compress full body
                    full_body = b''.join(body_parts)
                    
                    if len(full_body) >= self.minimum_size:
                        buffer = io.BytesIO()
                        with gzip.GzipFile(mode='wb', fileobj=buffer, compresslevel=self.compresslevel) as f:
                            f.write(full_body)
                        compressed = buffer.getvalue()
                        
                        if len(compressed) < len(full_body):
                            # Update headers
                            new_headers = []
                            for name, value in initial_headers:
                                if name.lower() != b'content-length':
                                    new_headers.append((name, value))
                            new_headers.append((b'content-encoding', b'gzip'))
                            new_headers.append((b'content-length', str(len(compressed)).encode()))
                            new_headers.append((b'vary', b'Accept-Encoding'))
                            
                            await send({
                                'type': 'http.response.start',
                                'status': status_code,
                                'headers': new_headers
                            })
                            await send({
                                'type': 'http.response.body',
                                'body': compressed
                            })
                            return
                    
                    # Send uncompressed
                    await send({
                        'type': 'http.response.start',
                        'status': status_code,
                        'headers': initial_headers
                    })
                    await send({
                        'type': 'http.response.body',
                        'body': full_body
                    })
        
        await self.app(scope, receive, compressed_send)
