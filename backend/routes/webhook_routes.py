"""DataPulse - Webhook Routes
Handles incoming webhooks from Stripe and other services
"""
from fastapi import APIRouter, Request, HTTPException, Header
from datetime import datetime, timezone
import os
import logging

from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.payments.stripe.checkout import StripeCheckout

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


@router.post("/stripe")
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature")
):
    """Handle Stripe webhook events"""
    db = request.app.state.db
    
    # Get raw body
    body = await request.body()
    
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}api/webhooks/stripe"
    
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    try:
        # Handle webhook event
        webhook_response = await stripe_checkout.handle_webhook(body, stripe_signature)
        
        logger.info(f"Stripe webhook received: {webhook_response.event_type}")
        
        # Log webhook event
        webhook_log = {
            "event_id": webhook_response.event_id,
            "event_type": webhook_response.event_type,
            "session_id": webhook_response.session_id,
            "payment_status": webhook_response.payment_status,
            "metadata": webhook_response.metadata,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.webhook_logs.insert_one(webhook_log)
        
        # Process based on event type
        if webhook_response.event_type == "checkout.session.completed":
            # Payment was successful
            session_id = webhook_response.session_id
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status": "complete",
                    "payment_status": webhook_response.payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Payment completed for session: {session_id}")
            
        elif webhook_response.event_type == "checkout.session.expired":
            # Session expired
            session_id = webhook_response.session_id
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status": "expired",
                    "payment_status": "expired",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Checkout session expired: {session_id}")
        
        return {"status": "received", "event_type": webhook_response.event_type}
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        # Return 200 to acknowledge receipt even if processing fails
        # This prevents Stripe from retrying unnecessarily
        return {"status": "error", "message": str(e)}
