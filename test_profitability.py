#!/usr/bin/env python3

"""
Profitability Visualization Module Testing Script
Tests the new profitability APIs as requested in the review.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import ERPBackendTester

def main():
    """Run profitability module testing"""
    print("🎯 PROFITABILITY VISUALIZATION MODULE TESTING")
    print("COMPREHENSIVE VALIDATION OF NEW PROFITABILITY APIs")
    print("="*60)
    
    tester = ERPBackendTester()
    
    # Initialize database first
    if not tester.test_database_initialization():
        print("❌ Database initialization failed. Stopping tests.")
        return False
    
    # Test authentication
    if not tester.test_authentication():
        print("❌ Authentication failed. Stopping tests.")
        return False
    
    # Run Profitability Module testing
    profitability_success = tester.test_profitability_visualization_module()
    
    # Print final results
    print("\n" + "="*60)
    print("🎯 PROFITABILITY VISUALIZATION MODULE TEST RESULTS")
    print("="*60)
    print(f"Total Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run) * 100:.1f}%")
    
    if profitability_success:
        print("🎉 EXCELLENT! Profitability Visualization Module APIs are production ready!")
        print("✅ Profitability Analysis API working (GET /api/opportunities/{id}/profitability)")
        print("   - Currency parameter support (INR, USD, EUR)")
        print("   - Exchange rate conversion working")
        print("   - Items, summary, phase totals, and grand total structure correct")
        print("   - Profit percentage calculations accurate")
        print("✅ What-If Analysis API working (POST /api/opportunities/{id}/profitability/what-if)")
        print("   - Hypothetical discount scenarios (5%, 10%, 15%)")
        print("   - Recalculated profit margins with discounts")
        print("   - Modified items and summary data")
        print("✅ Export Functionality working (GET /api/opportunities/{id}/profitability/export)")
        print("   - Excel export metadata generation")
        print("   - Multi-currency export support")
        print("   - Proper filename and export URL generation")
        print("✅ Historical Trends API working (GET /api/opportunities/{id}/profitability/trends)")
        print("   - Profit evolution over time")
        print("   - Labels, values, percentages, and dates structure")
        print("   - Mock historical data for visualization")
        print("✅ Error Handling working correctly")
        print("   - Invalid opportunity IDs return 404")
        print("   - Invalid currencies return 400")
        print("   - Proper error messages and status codes")
        print("✅ Role-Based Access Control enforced")
        print("   - Sales Executive/Manager role requirements")
        print("   - Permission-based endpoint protection")
        print("   - Admin bypass functionality working")
    else:
        print("❌ Profitability Visualization Module APIs have issues that need attention.")
        print("Please review the test results above for specific failures.")
    
    return profitability_success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)