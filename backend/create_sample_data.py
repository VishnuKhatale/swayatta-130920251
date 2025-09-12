#!/usr/bin/env python3
"""
Admin script to create sample enhanced-opportunities and approved quotations
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# MongoDB configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/crm_db')

async def create_sample_opportunities_and_quotations():
    """Create sample opportunities and approved quotations"""
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_default_database()
        
        print("🏢 Creating sample enhanced-opportunities...")
        
        # Sample opportunities data
        sample_opportunities = [
            {
                "opportunity_title": "Cloud Infrastructure Modernization - TechCorp",
                "company_name": "TechCorp Solutions",
                "opportunity_type": "Non-Tender",
                "expected_revenue": 250000,
                "current_stage_name": "L5",
                "state": "Open"
            },
            {
                "opportunity_title": "Digital Transformation Initiative - FinanceInc",
                "company_name": "FinanceInc Limited",
                "opportunity_type": "Tender",
                "expected_revenue": 450000,
                "current_stage_name": "L4",
                "state": "Open"
            },
            {
                "opportunity_title": "Data Analytics Platform - RetailMax",
                "company_name": "RetailMax Corporation",
                "opportunity_type": "Non-Tender",
                "expected_revenue": 180000,
                "current_stage_name": "L6",
                "state": "Open"
            },
            {
                "opportunity_title": "Cybersecurity Enhancement - SecureBank",
                "company_name": "SecureBank Ltd",
                "opportunity_type": "Tender",
                "expected_revenue": 320000,
                "current_stage_name": "L3",
                "state": "Open"
            },
            {
                "opportunity_title": "ERP Implementation - ManufacturingCo",
                "company_name": "ManufacturingCo Inc",
                "opportunity_type": "Non-Tender",
                "expected_revenue": 380000,
                "current_stage_name": "L5",
                "state": "Open"
            },
            {
                "opportunity_title": "Mobile App Development - StartupXYZ",
                "company_name": "StartupXYZ",
                "opportunity_type": "Non-Tender",
                "expected_revenue": 95000,
                "current_stage_name": "L2",
                "state": "Open"
            },
            {
                "opportunity_title": "AI/ML Integration - InnovateTech",
                "company_name": "InnovateTech Solutions",
                "opportunity_type": "Tender",
                "expected_revenue": 520000,
                "current_stage_name": "L6",
                "state": "Open"
            },
            {
                "opportunity_title": "Cloud Migration - LegacySystems",
                "company_name": "LegacySystems Corp",
                "opportunity_type": "Non-Tender",
                "expected_revenue": 280000,
                "current_stage_name": "L4",
                "state": "Open"
            }
        ]
        
        created_opps = 0
        created_quotations = 0
        
        for opp_data in sample_opportunities:
            # Create opportunity
            opportunity_id = str(uuid.uuid4())
            opportunity = {
                "id": opportunity_id,
                "opportunity_id": f"OPP-{datetime.now().strftime('%Y%m%d')}-{opportunity_id[:6].upper()}",
                "lead_id": str(uuid.uuid4()),  # Generate random lead ID
                "opportunity_title": opp_data["opportunity_title"],
                "opportunity_type": opp_data["opportunity_type"],
                "company_id": str(uuid.uuid4()),  # Generate random company ID
                "company_name": opp_data["company_name"],
                "opportunity_owner_id": "system-admin",
                "partner_id": None,
                "expected_closure_date": (datetime.now(timezone.utc) + timedelta(days=60)).strftime('%Y-%m-%d'),
                "expected_revenue": opp_data["expected_revenue"],
                "current_stage_name": opp_data["current_stage_name"],
                "current_stage_id": opp_data["current_stage_name"],  # Using same as stage_name for consistency
                "state": opp_data["state"],
                "remarks": f"Sample opportunity for {opp_data['company_name']}",
                "stage_form_data": {},
                "created_by": "system-admin",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_active": True,
                "is_deleted": False
            }
            
            await db.opportunities.insert_one(opportunity)
            print(f"  ✨ Created opportunity: {opp_data['opportunity_title']}")
            created_opps += 1
            
            # Create approved quotation for this opportunity
            quotation_id = str(uuid.uuid4())
            quotation_number = f"QUO-{datetime.now().strftime('%Y%m%d')}-{opportunity_id[:8].upper()}"
            
            # Calculate totals based on opportunity value
            opportunity_value = opp_data["expected_revenue"]
            otp_amount = round(opportunity_value * 0.3, 2)  # 30% OTP
            recurring_monthly = round(opportunity_value * 0.05, 2)  # 5% monthly recurring
            recurring_total = round(recurring_monthly * 12, 2)  # 1 year of recurring
            grand_total = round(otp_amount + recurring_total, 2)
            
            # Create approved quotation
            quotation = {
                "id": quotation_id,
                "quotation_number": quotation_number,
                "opportunity_id": opportunity_id,
                "customer_id": opportunity_id,
                "customer_name": opp_data["company_name"],
                "customer_contact_email": f"contact@{opp_data['company_name'].lower().replace(' ', '').replace(',', '').replace('.', '')}.com",
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
                "internal_notes": f"Auto-generated quotation for {opp_data['opportunity_title']}",
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
            
            await db.quotations.insert_one(quotation)
            
            # Create basic phase, group, and item structure
            phase_id = str(uuid.uuid4())
            phase = {
                "id": phase_id,
                "quotation_id": quotation_id,
                "phase_name": "Implementation Phase",
                "phase_description": f"Standard implementation and deployment for {opp_data['opportunity_title']}",
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
            
            item_id = str(uuid.uuid4())
            item = {
                "id": item_id,
                "group_id": group_id,
                "core_product_id": "default-product-001",
                "item_name": "Standard Service Package",
                "item_description": f"Comprehensive service package for {opp_data['opportunity_title']}",
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
            
            print(f"    💰 Created approved quotation: {quotation_number} (${grand_total:,.2f})")
            created_quotations += 1
        
        print(f"\n🎉 Sample data creation completed!")
        print(f"   🏢 Created opportunities: {created_opps}")
        print(f"   💰 Created approved quotations: {created_quotations}")
        
        # Close MongoDB connection
        client.close()
        
        return {
            "created_opportunities": created_opps,
            "created_quotations": created_quotations
        }
        
    except Exception as e:
        print(f"❌ Error creating sample data: {str(e)}")
        raise e

if __name__ == "__main__":
    print("🚀 Starting sample data creation process...")
    result = asyncio.run(create_sample_opportunities_and_quotations())
    print(f"✅ Process completed successfully: {result}")