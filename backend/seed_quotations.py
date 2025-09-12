#!/usr/bin/env python3
"""
Admin script to seed approved quotations for all enhanced-opportunities
Run this script to automatically create approved quotations for opportunities that don't have them
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# Add the parent directory to Python path to import models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# MongoDB configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/crm_db')

async def seed_approved_quotations():
    """Seed approved quotations for all opportunities"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_default_database()
        
        print("🔍 Fetching all opportunities...")
        
        # Get all opportunities
        opportunities = await db.opportunities.find({
            "is_deleted": False
        }).to_list(1000)
        
        print(f"📊 Found {len(opportunities)} opportunities")
        
        created_count = 0
        updated_count = 0
        
        for opportunity in opportunities:
            print(f"Processing opportunity: {opportunity.get('opportunity_title', 'Unnamed')} (ID: {opportunity['id']})")
            
            # Check if opportunity already has an approved quotation
            existing_approved = await db.quotations.find_one({
                "opportunity_id": opportunity["id"],
                "status": "Approved",
                "is_deleted": False
            })
            
            if existing_approved:
                print(f"  ✅ Already has approved quotation: {existing_approved.get('quotation_number')}")
                continue
            
            # Check if opportunity has any quotation that can be updated to approved
            existing_quotation = await db.quotations.find_one({
                "opportunity_id": opportunity["id"],
                "is_deleted": False
            })
            
            if existing_quotation:
                # Update existing quotation to Approved
                await db.quotations.update_one(
                    {"id": existing_quotation["id"]},
                    {"$set": {
                        "status": "Approved",
                        "approved_by": "system-admin",
                        "approved_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
                print(f"  📝 Updated existing quotation to Approved: {existing_quotation.get('quotation_number')}")
                updated_count += 1
            else:
                # Create new approved quotation
                quotation_id = str(uuid.uuid4())
                quotation_number = f"QUO-{datetime.now().strftime('%Y%m%d')}-{opportunity['id'][:8].upper()}"
                
                # Calculate totals based on opportunity value
                opportunity_value = opportunity.get("expected_revenue", 100000)  # Default 100k if no value
                if not opportunity_value or opportunity_value <= 0:
                    opportunity_value = 100000
                
                otp_amount = round(opportunity_value * 0.3, 2)  # 30% OTP
                recurring_monthly = round(opportunity_value * 0.05, 2)  # 5% monthly recurring
                recurring_total = round(recurring_monthly * 12, 2)  # 1 year of recurring
                grand_total = round(otp_amount + recurring_total, 2)
                
                # Create new quotation document
                new_quotation = {
                    "id": quotation_id,
                    "quotation_number": quotation_number,
                    "opportunity_id": opportunity["id"],
                    "customer_id": opportunity["id"],  # Using opportunity ID as customer ID
                    "customer_name": opportunity.get("company_name", "Unknown Client"),
                    "customer_contact_email": f"contact@{opportunity.get('company_name', 'unknown').lower().replace(' ', '')}.com",
                    "pricing_list_id": "standard-pricing-001",
                    "currency_id": "1",
                    "validity_date": (datetime.now(timezone.utc) + timedelta(days=30)).strftime('%Y-%m-%d'),
                    "quotation_date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                    "status": "Approved",  # Set to Approved directly
                    "overall_discount_type": None,
                    "overall_discount_value": 0.0,
                    "discount_reason": None,
                    "total_otp": otp_amount,
                    "total_year1": recurring_monthly,
                    "total_year2": 0.0,
                    "total_year3": 0.0,
                    "total_year4": 0.0,
                    "total_year5": 0.0,
                    "total_year6": 0.0,
                    "total_year7": 0.0,
                    "total_year8": 0.0,
                    "total_year9": 0.0,
                    "total_year10": 0.0,
                    "grand_total": grand_total,
                    "terms_and_conditions": "Standard terms and conditions apply. Payment terms: 30% advance, 70% on delivery.",
                    "internal_notes": f"Auto-generated quotation for opportunity {opportunity.get('opportunity_title', '')}",
                    "external_notes": "This quotation is valid for 30 days from the date of issue.",
                    "is_active": True,
                    "created_by": "system-admin",
                    "created_at": datetime.now(timezone.utc),
                    "modified_by": None,
                    "updated_at": datetime.now(timezone.utc),
                    "is_deleted": False,
                    "submitted_by": "system-admin",
                    "submitted_at": datetime.now(timezone.utc),
                    "approved_by": "system-admin",
                    "approved_at": datetime.now(timezone.utc),
                    "rejection_reason": None,
                    "deleted_by": None,
                    "deleted_at": None,
                    "delete_reason": None
                }
                
                await db.quotations.insert_one(new_quotation)
                
                # Create a basic phase structure for the quotation
                phase_id = str(uuid.uuid4())
                phase = {
                    "id": phase_id,
                    "quotation_id": quotation_id,
                    "phase_name": "Implementation Phase",
                    "phase_description": f"Standard implementation and deployment for {opportunity.get('opportunity_title', 'project')}",
                    "start_date": (datetime.now(timezone.utc) + timedelta(days=7)).strftime('%Y-%m-%d'),
                    "tenure_months": 12,
                    "currency_id": "1",
                    "phase_total_otp": otp_amount,
                    "phase_total_year1": recurring_monthly,
                    "phase_total_year2": 0.0,
                    "phase_total_year3": 0.0,
                    "phase_total_year4": 0.0,
                    "phase_total_year5": 0.0,
                    "phase_total_year6": 0.0,
                    "phase_total_year7": 0.0,
                    "phase_total_year8": 0.0,
                    "phase_total_year9": 0.0,
                    "phase_total_year10": 0.0,
                    "phase_grand_total": grand_total,
                    "created_by": "system-admin",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "is_active": True,
                    "is_deleted": False
                }
                
                await db.quotation_phases.insert_one(phase)
                
                # Create a basic group within the phase
                group_id = str(uuid.uuid4())
                group = {
                    "id": group_id,
                    "phase_id": phase_id,
                    "group_name": "Core Services",
                    "group_description": "Primary service delivery components",
                    "created_by": "system-admin",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "is_active": True,
                    "is_deleted": False
                }
                
                await db.quotation_groups.insert_one(group)
                
                # Create basic items within the group
                item_id = str(uuid.uuid4())
                item = {
                    "id": item_id,
                    "group_id": group_id,
                    "core_product_id": "default-product-001",
                    "item_name": "Standard Service Package",
                    "item_description": f"Comprehensive service package for {opportunity.get('opportunity_title', 'project')}",
                    "quantity": 1,
                    "unit_price_otp": otp_amount,
                    "unit_price_year1": recurring_monthly,
                    "unit_price_year2": 0.0,
                    "unit_price_year3": 0.0,
                    "unit_price_year4": 0.0,
                    "unit_price_year5": 0.0,
                    "unit_price_year6": 0.0,
                    "unit_price_year7": 0.0,
                    "unit_price_year8": 0.0,
                    "unit_price_year9": 0.0,
                    "unit_price_year10": 0.0,
                    "total_otp": otp_amount,
                    "total_year1": recurring_monthly,
                    "total_year2": 0.0,
                    "total_year3": 0.0,
                    "total_year4": 0.0,
                    "total_year5": 0.0,
                    "total_year6": 0.0,
                    "total_year7": 0.0,
                    "total_year8": 0.0,
                    "total_year9": 0.0,
                    "total_year10": 0.0,
                    "created_by": "system-admin",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "is_active": True,
                    "is_deleted": False
                }
                
                await db.quotation_items.insert_one(item)
                
                print(f"  ✨ Created new approved quotation: {quotation_number} (${grand_total:,.2f})")
                created_count += 1
        
        print(f"\n🎉 Quotation seeding completed!")
        print(f"   📝 Created new quotations: {created_count}")
        print(f"   🔄 Updated to Approved: {updated_count}")
        print(f"   📊 Total processed: {created_count + updated_count}")
        
        # Close MongoDB connection
        client.close()
        
        return {
            "created_quotations": created_count,
            "updated_quotations": updated_count,
            "total_processed": created_count + updated_count
        }
        
    except Exception as e:
        print(f"❌ Error seeding quotations: {str(e)}")
        raise e

if __name__ == "__main__":
    print("🚀 Starting quotation seeding process...")
    result = asyncio.run(seed_approved_quotations())
    print(f"✅ Process completed successfully: {result}")