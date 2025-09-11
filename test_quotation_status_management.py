#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import ERPBackendTester

if __name__ == "__main__":
    tester = ERPBackendTester()
    
    print("🎯 QUOTATION STATUS MANAGEMENT & L5 STAGE GATING TESTING")
    print("Testing the new quotation status management system and L5 stage gating functionality")
    print("Focus: Role-based Approval, Status Flow, Stage Gating, Internal Cost Permissions")
    print("="*80)
    
    # Initialize database first
    if not tester.test_database_initialization():
        print("❌ Database initialization failed. Stopping tests.")
        exit(1)
    
    # Test authentication
    if not tester.test_authentication():
        print("❌ Authentication failed. Stopping tests.")
        exit(1)
    
    # Run Quotation Status Management & L5 Stage Gating testing
    quotation_status_success = tester.test_quotation_status_management_and_l5_stage_gating()
    
    # Print final results
    print("\n" + "="*80)
    print("🎯 QUOTATION STATUS MANAGEMENT & L5 STAGE GATING TEST RESULTS")
    print("="*80)
    print(f"Total Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run) * 100:.1f}%")
    
    if quotation_status_success:
        print("🎉 EXCELLENT! Quotation Status Management & L5 Stage Gating is working correctly!")
        print("✅ NEW ENDPOINTS TESTED:")
        print("   - POST /api/quotations/{id}/approve - Role-based quotation approval")
        print("   - DELETE /api/quotations/{id} - Status-based deletion restrictions")
        print("   - GET /api/opportunities/{id}/quotations - Retrieve quotations for opportunity")
        print("   - GET /api/opportunities/{id}/stage-access/L5 - L5 stage gating logic")
        print("   - GET /api/auth/permissions/internal-costs - Internal cost permission checking")
        print("✅ UPDATED FUNCTIONALITY VERIFIED:")
        print("   - POST /api/quotations/{id}/submit - Now sets status to 'Unapproved'")
        print("   - PUT /api/quotations/{id} - Approved quotations cannot be edited")
        print("   - Quotation Model - Default status is 'Draft'")
        print("✅ BUSINESS RULES ENFORCED:")
        print("   - Status flow: Draft → Unapproved → Approved")
        print("   - Role-based approval permissions (Commercial Approver, Sales Manager, Admin)")
        print("   - Deletion restrictions (Draft/Unapproved only)")
        print("   - L5 stage gating (requires ≥1 Approved quotation)")
        print("   - Audit logging for approve/delete actions")
        print("✅ VALIDATION POINTS CONFIRMED:")
        print("   - Proper error messages and status codes")
        print("   - Permission checking for internal cost visibility")
        print("   - Complete status transition validation")
    else:
        print("❌ Quotation Status Management & L5 Stage Gating has issues that need attention.")
        print("Some components may not be working correctly.")
        print("Please review the test results above for specific failures.")
    
    exit(0 if quotation_status_success else 1)