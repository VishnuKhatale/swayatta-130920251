#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import ERPBackendTester

def main():
    print("🚀 Starting Service Delivery Module Testing...")
    
    # Initialize tester
    tester = ERPBackendTester()
    
    # Initialize database first
    if not tester.test_database_initialization():
        print("❌ Database initialization failed - stopping tests")
        return False
    
    # Test authentication
    if not tester.test_authentication():
        print("❌ Authentication failed - stopping tests")
        return False
    
    # Run Service Delivery Module test
    success = tester.test_service_delivery_module()
    
    print("\n" + "="*60)
    print("SERVICE DELIVERY MODULE TEST RESULTS")
    print("="*60)
    
    if success:
        print("🎉 SERVICE DELIVERY MODULE TESTS PASSED!")
        return True
    else:
        print("❌ SERVICE DELIVERY MODULE TESTS FAILED!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)